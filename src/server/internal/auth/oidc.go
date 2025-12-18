package auth

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	"golang.org/x/oauth2"

	"github.com/sonnguyen/kubelens/internal/audit"
	"github.com/sonnguyen/kubelens/internal/db"
)

const (
	maxAvatarSize = 1 * 1024 * 1024 // 1MB max avatar size
	avatarTimeout = 10 * time.Second
)

// OIDCConfig holds OIDC provider configuration
type OIDCConfig struct {
	IssuerURL       string
	ClientID        string
	ClientSecret    string
	RedirectURL     string
	DefaultGroup    string   // Default group for new users
	GroupMapping    map[string]string // Map OIDC groups to Kubelens groups
	AutoCreateGroup bool     // Auto-create groups that don't exist
}

// OIDCClaims represents the claims from OIDC token
type OIDCClaims struct {
	Subject       string   `json:"sub"`
	Email         string   `json:"email"`
	EmailVerified bool     `json:"email_verified"`
	Name          string   `json:"name"`
	GivenName     string   `json:"given_name"`
	FamilyName    string   `json:"family_name"`
	Picture       string   `json:"picture"`
	Groups        []string `json:"groups"`
	PreferredName string   `json:"preferred_username"`
}

// OIDCSyncRequest represents a sync request from the OAuth2 extension
type OIDCSyncRequest struct {
	Subject       string   `json:"sub"`
	Email         string   `json:"email"`
	EmailVerified bool     `json:"email_verified"`
	Name          string   `json:"name"`
	Picture       string   `json:"picture"`
	Groups        []string `json:"groups"`
	Provider      string   `json:"provider"`
	ProviderID    string   `json:"provider_id"`
}

// OIDCSyncResponse represents the sync response
type OIDCSyncResponse struct {
	UserID       uint     `json:"user_id"`
	Email        string   `json:"email"`
	Username     string   `json:"username"`
	IsNewUser    bool     `json:"is_new_user"`
	Groups       []string `json:"groups"`
	SessionToken string   `json:"session_token"`
	ExpiresAt    int64    `json:"expires_at"`
}

// GetOIDCConfig returns the OIDC configuration
func (h *Handler) GetOIDCConfig() OIDCConfig {
	// Load config from environment or database
	return OIDCConfig{
		IssuerURL:       getEnvOrDefault("OIDC_ISSUER_URL", "http://localhost:5556"),
		ClientID:        getEnvOrDefault("OIDC_CLIENT_ID", "kubelens"),
		ClientSecret:    getEnvOrDefault("OIDC_CLIENT_SECRET", "kubelens-secret"),
		RedirectURL:     getEnvOrDefault("KUBELENS_URL", "http://localhost:3030") + "/auth/callback",
		DefaultGroup:    getEnvOrDefault("OIDC_DEFAULT_GROUP", "viewer"),
		AutoCreateGroup: getEnvOrDefault("OIDC_AUTO_CREATE_GROUP", "true") == "true",
		GroupMapping:    parseGroupMapping(os.Getenv("OIDC_GROUP_MAPPING")),
	}
}

// HandleOIDCCallback handles the OIDC callback
func (h *Handler) HandleOIDCCallback(c *gin.Context) {
	config := h.GetOIDCConfig()

	state := c.Query("state")
	code := c.Query("code")
	errorMsg := c.Query("error")

	// Check for error from provider
	if errorMsg != "" {
		errorDesc := c.Query("error_description")
		log.Warnf("OIDC error: %s - %s", errorMsg, errorDesc)
		h.auditLogger.LogAuth(
			audit.EventAuthLoginFailed,
			nil,
			"",
			"",
			c.ClientIP(),
			fmt.Sprintf("OIDC login failed: %s", errorDesc),
			false,
		)
		c.Redirect(http.StatusFound, "/login?error="+errorMsg)
		return
	}

	// Validate state (should be validated against session-stored state)
	_ = state

	ctx := context.Background()
	provider, err := oidc.NewProvider(ctx, config.IssuerURL)
	if err != nil {
		log.Errorf("Failed to query OIDC provider: %v", err)
		c.Redirect(http.StatusFound, "/login?error=provider_error")
		return
	}

	oauth2Config := oauth2.Config{
		ClientID:     config.ClientID,
		ClientSecret: config.ClientSecret,
		RedirectURL:  config.RedirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email", "groups"},
	}

	token, err := oauth2Config.Exchange(ctx, code)
	if err != nil {
		log.Errorf("Failed to exchange token: %v", err)
		c.Redirect(http.StatusFound, "/login?error=token_exchange_failed")
		return
	}

	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		log.Error("No id_token in response")
		c.Redirect(http.StatusFound, "/login?error=no_id_token")
		return
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: config.ClientID})
	idToken, err := verifier.Verify(ctx, rawIDToken)
	if err != nil {
		log.Errorf("Failed to verify ID token: %v", err)
		c.Redirect(http.StatusFound, "/login?error=token_verification_failed")
		return
	}

	var claims OIDCClaims
	if err := idToken.Claims(&claims); err != nil {
		log.Errorf("Failed to parse claims: %v", err)
		c.Redirect(http.StatusFound, "/login?error=invalid_claims")
		return
	}

	// Sync user and groups
	user, isNew, err := h.syncOIDCUser(claims, config)
	if err != nil {
		log.Errorf("Failed to sync user: %v", err)
		c.Redirect(http.StatusFound, "/login?error=user_sync_failed")
		return
	}

	// Sync groups
	syncedGroups, err := h.syncOIDCGroups(user, claims.Groups, config)
	if err != nil {
		log.Warnf("Failed to sync groups for user %s: %v", user.Email, err)
		// Don't fail login for group sync errors
	}

	// Update last login
	now := time.Now()
	user.LastLogin = &now
	h.db.UpdateUser(user)

	// Create session token
	sessionToken, err := GenerateToken(int(user.ID), user.Email, user.Username, user.IsAdmin, h.secret)
	if err != nil {
		log.Errorf("Failed to generate session token: %v", err)
		c.Redirect(http.StatusFound, "/login?error=session_creation_failed")
		return
	}

	// Audit Log
	userIDInt := int(user.ID)
	eventType := audit.EventAuthLoginSuccess
	description := "OIDC login success"
	if isNew {
		eventType = audit.EventUserCreated
		description = "User created via OIDC login"
	}
	h.auditLogger.LogAuth(
		eventType,
		&userIDInt,
		user.Username,
		user.Email,
		c.ClientIP(),
		fmt.Sprintf("%s (groups: %v)", description, syncedGroups),
		true,
	)

	log.Infof("OIDC login successful for user %s (new: %v, groups: %v)", user.Email, isNew, syncedGroups)

	// Redirect to frontend with token
	c.Redirect(http.StatusFound, fmt.Sprintf("/dashboard?token=%s", sessionToken))
}

// HandleOIDCSync handles sync requests from the OAuth2 extension
func (h *Handler) HandleOIDCSync(c *gin.Context) {
	var req OIDCSyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	config := h.GetOIDCConfig()

	claims := OIDCClaims{
		Subject:       req.Subject,
		Email:         req.Email,
		EmailVerified: req.EmailVerified,
		Name:          req.Name,
		Picture:       req.Picture,
		Groups:        req.Groups,
	}

	// Sync user
	user, isNew, err := h.syncOIDCUser(claims, config)
	if err != nil {
		// Check if it's a disabled account error
		if strings.Contains(err.Error(), "account is disabled") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to sync user: %v", err)})
		return
	}

	// Sync groups
	syncedGroups, err := h.syncOIDCGroups(user, claims.Groups, config)
	if err != nil {
		log.Warnf("Group sync warning: %v", err)
	}

	// Update provider info
	user.AuthProvider = req.Provider
	user.ProviderUserID = req.ProviderID
	h.db.UpdateUser(user)

	// Generate session token
	sessionToken, err := GenerateToken(int(user.ID), user.Email, user.Username, user.IsAdmin, h.secret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create session"})
		return
	}

	// Calculate expiry (24 hours from now)
	expiresAt := time.Now().Add(24 * time.Hour).Unix()

	c.JSON(http.StatusOK, OIDCSyncResponse{
		UserID:       user.ID,
		Email:        user.Email,
		Username:     user.Username,
		IsNewUser:    isNew,
		Groups:       syncedGroups,
		SessionToken: sessionToken,
		ExpiresAt:    expiresAt,
	})
}

// syncOIDCUser creates or updates a user from OIDC claims
func (h *Handler) syncOIDCUser(claims OIDCClaims, config OIDCConfig) (*db.User, bool, error) {
	isNew := false

	// Try to find existing user by email
	user, err := h.db.GetUserByEmail(claims.Email)
	if err != nil {
		// User doesn't exist, create new
		username := generateUsername(claims)

		// Ensure username is unique
		username = h.ensureUniqueUsername(username)

		user = &db.User{
			Email:        claims.Email,
			Username:     username,
			FullName:     claims.Name,
			AvatarURL:    claims.Picture,
			AuthProvider: "oidc",
			IsActive:     true,
			IsAdmin:      false,
		}

		if err := h.db.CreateUser(user); err != nil {
			return nil, false, fmt.Errorf("failed to create user: %w", err)
		}
		isNew = true
		log.Infof("Created new OIDC user: %s (%s)", user.Username, user.Email)
	} else {
		// Check if user is disabled - reject login
		if !user.IsActive {
			log.Warnf("Disabled user attempted OIDC login: %s", user.Email)
			return nil, false, fmt.Errorf("account is disabled, please contact administrator")
		}
		
		// Update existing user info
		user.FullName = claims.Name
		if claims.Picture != "" {
			user.AvatarURL = claims.Picture
		}
		if err := h.db.UpdateUser(user); err != nil {
			return nil, false, fmt.Errorf("failed to update user: %w", err)
		}
	}

	// Download and cache avatar in background (don't block login)
	if claims.Picture != "" {
		go func() {
			if err := h.downloadAndCacheAvatar(user, claims.Picture); err != nil {
				log.Warnf("Failed to cache avatar for user %s: %v", user.Email, err)
			}
		}()
	}

	return user, isNew, nil
}

// downloadAndCacheAvatar downloads avatar from URL and stores it in database
func (h *Handler) downloadAndCacheAvatar(user *db.User, avatarURL string) error {
	if avatarURL == "" {
		return nil
	}

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: avatarTimeout,
	}

	// Download avatar
	resp, err := client.Get(avatarURL)
	if err != nil {
		return fmt.Errorf("failed to download avatar: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to download avatar: status %d", resp.StatusCode)
	}

	// Check content type
	contentType := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		return fmt.Errorf("invalid content type: %s", contentType)
	}

	// Read with size limit
	limitedReader := io.LimitReader(resp.Body, maxAvatarSize+1)
	data, err := io.ReadAll(limitedReader)
	if err != nil {
		return fmt.Errorf("failed to read avatar data: %w", err)
	}

	if len(data) > maxAvatarSize {
		return fmt.Errorf("avatar too large: %d bytes (max %d)", len(data), maxAvatarSize)
	}

	// Update user with cached avatar
	user.AvatarData = data
	user.AvatarMimeType = contentType

	if err := h.db.UpdateUser(user); err != nil {
		return fmt.Errorf("failed to save avatar: %w", err)
	}

	log.Infof("Cached avatar for user %s (%d bytes, %s)", user.Email, len(data), contentType)
	return nil
}

// syncOIDCGroups syncs user groups from OIDC claims
func (h *Handler) syncOIDCGroups(user *db.User, oidcGroups []string, config OIDCConfig) ([]string, error) {
	var syncedGroups []string

	// Map OIDC groups to Kubelens groups
	mappedGroups := make([]string, 0)
	for _, oidcGroup := range oidcGroups {
		// Check if there's a mapping
		if mapped, ok := config.GroupMapping[oidcGroup]; ok {
			mappedGroups = append(mappedGroups, mapped)
		} else {
			// Use normalized group name
			mappedGroups = append(mappedGroups, normalizeGroupName(oidcGroup))
		}
	}

	// If no groups, use default
	if len(mappedGroups) == 0 && config.DefaultGroup != "" {
		mappedGroups = append(mappedGroups, config.DefaultGroup)
	}

	// Get current user groups
	currentGroups, err := h.db.GetUserGroups(user.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get current groups: %w", err)
	}

	// Build set of current group names
	currentGroupSet := make(map[string]bool)
	for _, g := range currentGroups {
		currentGroupSet[g.Name] = true
	}

	// Add user to new groups
	for _, groupName := range mappedGroups {
		if currentGroupSet[groupName] {
			syncedGroups = append(syncedGroups, groupName)
			continue
		}

		// Find or create group
		group, err := h.db.GetGroupByName(groupName)
		if err != nil {
			if !config.AutoCreateGroup {
				log.Warnf("Group %s not found and auto-create disabled", groupName)
				continue
			}
			// Create the group
			group = &db.Group{
				Name:        groupName,
				Description: fmt.Sprintf("Auto-created from OIDC group: %s", groupName),
				IsSystem:    false,
			}
			if err := h.db.CreateGroup(group); err != nil {
				log.Warnf("Failed to create group %s: %v", groupName, err)
				continue
			}
			log.Infof("Auto-created group from OIDC: %s", groupName)
		}

		// Add user to group
		if err := h.db.AddUserToGroup(user.ID, group.ID); err != nil {
			log.Warnf("Failed to add user %s to group %s: %v", user.Email, groupName, err)
			continue
		}

		syncedGroups = append(syncedGroups, groupName)
		log.Infof("Added user %s to group %s", user.Email, groupName)
	}

	return syncedGroups, nil
}

// ensureUniqueUsername ensures the username is unique by appending numbers if needed
func (h *Handler) ensureUniqueUsername(username string) string {
	originalUsername := username
	counter := 1

	for {
		_, err := h.db.GetUserByUsername(username)
		if err != nil {
			// Username is available
			return username
		}
		// Username taken, try with number suffix
		username = fmt.Sprintf("%s%d", originalUsername, counter)
		counter++
		if counter > 100 {
			// Failsafe: use timestamp
			return fmt.Sprintf("%s_%d", originalUsername, time.Now().Unix())
		}
	}
}

// Helper functions

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func parseGroupMapping(mapping string) map[string]string {
	result := make(map[string]string)
	if mapping == "" {
		return result
	}
	// Format: "oidc-group1:kubelens-group1,oidc-group2:kubelens-group2"
	pairs := strings.Split(mapping, ",")
	for _, pair := range pairs {
		parts := strings.SplitN(pair, ":", 2)
		if len(parts) == 2 {
			result[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
		}
	}
	return result
}

func generateUsername(claims OIDCClaims) string {
	// Priority: preferred_username > email prefix > name > subject
	if claims.PreferredName != "" {
		return normalizeUsername(claims.PreferredName)
	}
	if claims.Email != "" {
		parts := strings.Split(claims.Email, "@")
		return normalizeUsername(parts[0])
	}
	if claims.Name != "" {
		return normalizeUsername(claims.Name)
	}
	return normalizeUsername(claims.Subject)
}

func normalizeUsername(s string) string {
	// Convert to lowercase, replace spaces with underscores, remove invalid chars
	var result strings.Builder
	for _, c := range strings.ToLower(s) {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_' || c == '-' {
			result.WriteRune(c)
		} else if c == ' ' || c == '.' {
			result.WriteRune('_')
		}
	}
	username := result.String()
	if len(username) > 50 {
		username = username[:50]
	}
	return username
}

func normalizeGroupName(s string) string {
	// Similar to username normalization
	var result strings.Builder
	for _, c := range strings.ToLower(s) {
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_' || c == '-' {
			result.WriteRune(c)
		} else if c == ' ' || c == '.' || c == '/' {
			result.WriteRune('_')
		}
	}
	return result.String()
}

// OAuthExchangeRequest represents the request to exchange an authorization code for tokens
type OAuthExchangeRequest struct {
	Code         string `json:"code" binding:"required"`
	CodeVerifier string `json:"code_verifier" binding:"required"`
	RedirectURI  string `json:"redirect_uri" binding:"required"`
}

// OAuthExchangeResponse represents the response after successful token exchange
type OAuthExchangeResponse struct {
	Token     string                 `json:"token"`
	User      map[string]interface{} `json:"user"`
	IsNewUser bool                   `json:"is_new_user"`
}

// HandleOAuthExchange handles the OAuth2 code exchange with PKCE
// POST /api/v1/auth/oauth/exchange
func (h *Handler) HandleOAuthExchange(c *gin.Context) {
	var req OAuthExchangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
		return
	}

	// Get internal Dex address (from environment or default)
	// The issuer must include /dex path as that's how the Dex extension is configured
	dexIssuer := getEnvOrDefault("DEX_INTERNAL_ISSUER", "http://127.0.0.1:5556/dex")

	ctx := context.Background()

	// Create OIDC provider pointing to internal Dex
	provider, err := oidc.NewProvider(ctx, dexIssuer)
	if err != nil {
		log.Errorf("Failed to create OIDC provider: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to connect to identity provider"})
		return
	}

	// Configure OAuth2 with PKCE
	oauth2Config := oauth2.Config{
		ClientID:     "kubelens",
		ClientSecret: "kubelens-secret",
		RedirectURL:  req.RedirectURI,
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email", "groups"},
	}

	// Exchange code with PKCE verifier
	token, err := oauth2Config.Exchange(ctx, req.Code,
		oauth2.SetAuthURLParam("code_verifier", req.CodeVerifier),
	)
	if err != nil {
		log.Errorf("Failed to exchange code: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to exchange code: " + err.Error()})
		return
	}

	// Extract and verify ID token
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "no id_token in response"})
		return
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: "kubelens"})
	idToken, err := verifier.Verify(ctx, rawIDToken)
	if err != nil {
		log.Errorf("Failed to verify ID token: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id_token"})
		return
	}

	// Extract claims
	var claims struct {
		Email         string   `json:"email"`
		EmailVerified bool     `json:"email_verified"`
		Name          string   `json:"name"`
		Picture       string   `json:"picture"`
		Groups        []string `json:"groups"`
	}
	if err := idToken.Claims(&claims); err != nil {
		log.Errorf("Failed to parse claims: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse claims"})
		return
	}

	config := h.GetOIDCConfig()

	// Sync user to database
	oidcClaims := OIDCClaims{
		Subject:       idToken.Subject,
		Email:         claims.Email,
		EmailVerified: claims.EmailVerified,
		Name:          claims.Name,
		Picture:       claims.Picture,
		Groups:        claims.Groups,
	}

	user, isNew, err := h.syncOIDCUser(oidcClaims, config)
	if err != nil {
		log.Errorf("Failed to sync user: %v", err)
		// Check if it's a disabled account error
		if strings.Contains(err.Error(), "account is disabled") {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sync user"})
		return
	}

	// Sync groups
	syncedGroups, err := h.syncOIDCGroups(user, claims.Groups, config)
	if err != nil {
		log.Warnf("Failed to sync groups for user %s: %v", user.Email, err)
	}

	// Update last login
	now := time.Now()
	user.LastLogin = &now
	h.db.UpdateUser(user)

	// Generate Kubelens JWT
	jwtToken, err := GenerateToken(int(user.ID), user.Email, user.Username, user.IsAdmin, h.secret)
	if err != nil {
		log.Errorf("Failed to generate token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	// Audit log
	userIDInt := int(user.ID)
	eventType := audit.EventAuthLoginSuccess
	description := "OAuth2 login success via PKCE"
	if isNew {
		eventType = audit.EventUserCreated
		description = "User created via OAuth2 PKCE login"
	}
	h.auditLogger.LogAuth(
		eventType,
		&userIDInt,
		user.Username,
		user.Email,
		c.ClientIP(),
		fmt.Sprintf("%s (groups: %v)", description, syncedGroups),
		true,
	)

	log.Infof("OAuth2 PKCE login successful for user %s (new: %v, groups: %v)", user.Email, isNew, syncedGroups)

	// Get user permissions for frontend
	permissions, permErr := h.db.GetUserPermissions(user.ID)
	if permErr != nil {
		log.Warnf("Failed to get permissions for user %s: %v", user.Email, permErr)
		permissions = []db.Permission{}
	}

	// Return response
	c.JSON(http.StatusOK, OAuthExchangeResponse{
		Token: jwtToken,
		User: map[string]interface{}{
			"id":          user.ID,
			"email":       user.Email,
			"username":    user.Username,
			"full_name":   user.FullName,
			"avatar":      user.AvatarURL,
			"is_admin":    user.IsAdmin,
			"permissions": permissions,
		},
		IsNewUser: isNew,
	})
}
