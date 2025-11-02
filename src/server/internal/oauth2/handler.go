package oauth2

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/coreos/go-oidc/v3/oidc"
	log "github.com/sirupsen/logrus"
	"golang.org/x/oauth2"

	"github.com/sonnguyen/kubelens/internal/db"
)

// Handler manages OAuth2 flows
type Handler struct {
	db           *db.DB
	dexIssuer    string
	dexClientID  string
	dexSecret    string
	redirectURL  string
	stateStore   map[string]*StateData // In production, use Redis
}

// StateData stores OAuth2 state information
type StateData struct {
	IntegrationID int
	Provider      string
	CreatedAt     time.Time
}

// NewHandler creates a new OAuth2 handler
func NewHandler(database *db.DB, dexIssuer, clientID, secret, redirectURL string) *Handler {
	return &Handler{
		db:          database,
		dexIssuer:   dexIssuer,
		dexClientID: clientID,
		dexSecret:   secret,
		redirectURL: redirectURL,
		stateStore:  make(map[string]*StateData),
	}
}

// generateState generates a random state parameter for CSRF protection
func generateState() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// StartOAuth2Flow initiates the OAuth2 flow
func (h *Handler) StartOAuth2Flow(c *gin.Context) {
	moduleName := c.Param("id") // Can be module name (e.g., "gcp") or integration ID
	if moduleName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "module name is required"})
		return
	}

	// Try to get existing integration by type, or create a new one
	integration, err := h.db.GetIntegrationByType(moduleName)
	if err != nil {
		// Create new integration entry
		integration = &db.Integration{
			Name:       moduleName + "-integration",
			Type:       moduleName,
			Config:     "{}",
			Enabled:    false,
			AuthMethod: "oauth2",
		}
		if err := h.db.SaveIntegration(integration); err != nil {
			log.Errorf("Failed to create integration: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create integration"})
			return
		}
		// Reload to get the ID
		integration, err = h.db.GetIntegrationByType(moduleName)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve integration"})
			return
		}
	}

	// Generate state parameter
	state, err := generateState()
	if err != nil {
		log.Errorf("Failed to generate state: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate state"})
		return
	}

	// Store state (in production, use Redis with TTL)
	h.stateStore[state] = &StateData{
		IntegrationID: int(integration.ID), // Convert uint to int
		Provider:      integration.Type,
		CreatedAt:     time.Now(),
	}

	// Clean up old states (older than 10 minutes)
	go h.cleanupOldStates()

	// Configure Dex OAuth2
	ctx := context.Background()
	provider, err := oidc.NewProvider(ctx, h.dexIssuer)
	if err != nil {
		log.Errorf("Failed to create OIDC provider: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to initialize OAuth2"})
		return
	}

	oauth2Config := oauth2.Config{
		ClientID:     h.dexClientID,
		ClientSecret: h.dexSecret,
		RedirectURL:  h.redirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email", "groups"},
	}

	// Add connector_id to force specific connector
	authCodeURL := oauth2Config.AuthCodeURL(state, oauth2.SetAuthURLParam("connector_id", integration.Type))

	// Replace internal hostname with localhost for browser access
	authCodeURL = strings.Replace(authCodeURL, "http://dex:5556", "http://localhost:5556", 1)

	c.JSON(http.StatusOK, gin.H{
		"authorize_url": authCodeURL,
		"state":         state,
	})
}

// HandleCallback processes the OAuth2 callback
func (h *Handler) HandleCallback(c *gin.Context) {
	code := c.Query("code")
	state := c.Query("state")
	errorParam := c.Query("error")

	// Check for OAuth2 errors
	if errorParam != "" {
		errorDesc := c.Query("error_description")
		log.Errorf("OAuth2 error: %s - %s", errorParam, errorDesc)
		c.Redirect(http.StatusFound, fmt.Sprintf("http://localhost/integrations?oauth_error=%s", errorParam))
		return
	}

	// Validate state
	stateData, ok := h.stateStore[state]
	if !ok {
		log.Error("Invalid state parameter")
		c.Redirect(http.StatusFound, "http://localhost/integrations?oauth_error=invalid_state")
		return
	}

	// Remove used state
	delete(h.stateStore, state)

	// Check state age (max 10 minutes)
	if time.Since(stateData.CreatedAt) > 10*time.Minute {
		log.Error("State parameter expired")
		c.Redirect(http.StatusFound, "http://localhost/integrations?oauth_error=state_expired")
		return
	}

	// Exchange code for tokens
	ctx := context.Background()
	provider, err := oidc.NewProvider(ctx, h.dexIssuer)
	if err != nil {
		log.Errorf("Failed to create OIDC provider: %v", err)
		c.Redirect(http.StatusFound, "http://localhost/integrations?oauth_error=provider_error")
		return
	}

	oauth2Config := oauth2.Config{
		ClientID:     h.dexClientID,
		ClientSecret: h.dexSecret,
		RedirectURL:  h.redirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email", "groups"},
	}

	oauth2Token, err := oauth2Config.Exchange(ctx, code)
	if err != nil {
		log.Errorf("Failed to exchange code for token: %v", err)
		c.Redirect(http.StatusFound, "http://localhost/integrations?oauth_error=token_exchange_failed")
		return
	}

	// Extract ID token
	rawIDToken, ok := oauth2Token.Extra("id_token").(string)
	if !ok {
		log.Error("No id_token in token response")
		c.Redirect(http.StatusFound, "http://localhost/integrations?oauth_error=no_id_token")
		return
	}

	// Verify ID token
	verifier := provider.Verifier(&oidc.Config{ClientID: h.dexClientID})
	idToken, err := verifier.Verify(ctx, rawIDToken)
	if err != nil {
		log.Errorf("Failed to verify ID token: %v", err)
		c.Redirect(http.StatusFound, "http://localhost/integrations?oauth_error=invalid_id_token")
		return
	}

	// Extract claims
	var claims struct {
		Email         string   `json:"email"`
		EmailVerified bool     `json:"email_verified"`
		Name          string   `json:"name"`
		Groups        []string `json:"groups"`
	}
	if err := idToken.Claims(&claims); err != nil {
		log.Errorf("Failed to parse claims: %v", err)
	}

	log.Infof("OAuth2 success for integration %d: %s (%s)", stateData.IntegrationID, claims.Name, claims.Email)

	// Save tokens to database
	dbToken := &db.OAuth2Token{
		IntegrationID: uint(stateData.IntegrationID), // Convert int to uint
		Provider:      stateData.Provider,
		AccessToken:   oauth2Token.AccessToken,
		RefreshToken:  oauth2Token.RefreshToken,
		TokenType:     oauth2Token.TokenType,
		IDToken:       rawIDToken,
		Scopes:        "openid profile email groups",
	}

	if !oauth2Token.Expiry.IsZero() {
		expiry := oauth2Token.Expiry
		dbToken.Expiry = &expiry // Convert time.Time to *time.Time
	}

	if err := h.db.SaveOAuth2Token(dbToken); err != nil {
		log.Errorf("Failed to save OAuth2 token: %v", err)
		c.Redirect(http.StatusFound, "http://localhost/integrations?oauth_error=save_failed")
		return
	}

	// Mark integration as configured
	if err := h.db.UpdateIntegrationConfigured(uint(stateData.IntegrationID), true); err != nil {
		log.Errorf("Failed to update integration status: %v", err)
	}

	// Redirect to success page
	c.Redirect(http.StatusFound, fmt.Sprintf("http://localhost/integrations?oauth_success=true&integration_id=%d", stateData.IntegrationID))
}

// RefreshToken refreshes an expired OAuth2 token
func (h *Handler) RefreshToken(integrationID int, provider string) (*oauth2.Token, error) {
	// Get stored token
	storedToken, err := h.db.GetOAuth2Token(uint(integrationID))
	if err != nil {
		return nil, fmt.Errorf("failed to get stored token: %w", err)
	}

	if storedToken.RefreshToken == "" {
		return nil, fmt.Errorf("no refresh token available")
	}

	// Configure OAuth2
	ctx := context.Background()
	oidcProvider, err := oidc.NewProvider(ctx, h.dexIssuer)
	if err != nil {
		return nil, fmt.Errorf("failed to create OIDC provider: %w", err)
	}

	oauth2Config := oauth2.Config{
		ClientID:     h.dexClientID,
		ClientSecret: h.dexSecret,
		Endpoint:     oidcProvider.Endpoint(),
	}

	// Create token source
	token := &oauth2.Token{
		AccessToken:  storedToken.AccessToken,
		RefreshToken: storedToken.RefreshToken,
		TokenType:    storedToken.TokenType,
	}

	if storedToken.Expiry != nil && !storedToken.Expiry.IsZero() {
		token.Expiry = *storedToken.Expiry
	}

	tokenSource := oauth2Config.TokenSource(ctx, token)
	newToken, err := tokenSource.Token()
	if err != nil {
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}

	// Update stored token
	storedToken.AccessToken = newToken.AccessToken
	if newToken.RefreshToken != "" {
		storedToken.RefreshToken = newToken.RefreshToken
	}
	storedToken.TokenType = newToken.TokenType
	if !newToken.Expiry.IsZero() {
		expiry := newToken.Expiry
		storedToken.Expiry = &expiry
	}

	if err := h.db.SaveOAuth2Token(storedToken); err != nil {
		return nil, fmt.Errorf("failed to update token: %w", err)
	}

	log.Infof("Refreshed OAuth2 token for integration %d", integrationID)
	return newToken, nil
}

// GetValidToken returns a valid OAuth2 token, refreshing if necessary
func (h *Handler) GetValidToken(integrationID int, provider string) (*oauth2.Token, error) {
	storedToken, err := h.db.GetOAuth2Token(uint(integrationID))
	if err != nil {
		return nil, fmt.Errorf("failed to get token: %w", err)
	}

	// Check if token is expired
	if storedToken.Expiry != nil && !storedToken.Expiry.IsZero() {
		if time.Now().After(*storedToken.Expiry) {
			// Token expired, refresh it
			log.Infof("Token expired for integration %d, refreshing...", integrationID)
			return h.RefreshToken(integrationID, provider)
		}
	}

	// Token is still valid
	token := &oauth2.Token{
		AccessToken:  storedToken.AccessToken,
		RefreshToken: storedToken.RefreshToken,
		TokenType:    storedToken.TokenType,
	}

	if storedToken.Expiry != nil && !storedToken.Expiry.IsZero() {
		token.Expiry = *storedToken.Expiry
	}

	return token, nil
}

// cleanupOldStates removes expired state entries
func (h *Handler) cleanupOldStates() {
	cutoff := time.Now().Add(-10 * time.Minute)
	for state, data := range h.stateStore {
		if data.CreatedAt.Before(cutoff) {
			delete(h.stateStore, state)
		}
	}
}

// RevokeToken revokes OAuth2 tokens for an integration
func (h *Handler) RevokeToken(c *gin.Context) {
	integrationIDStr := c.Param("id")
	provider := c.Query("provider")

	if integrationIDStr == "" || provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "integration_id and provider are required"})
		return
	}

	var integrationID int
	if _, err := fmt.Sscanf(integrationIDStr, "%d", &integrationID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid integration_id"})
		return
	}

	// Delete token from database
	if err := h.db.DeleteOAuth2Token(uint(integrationID)); err != nil {
		log.Errorf("Failed to delete OAuth2 token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke token"})
		return
	}

	// Mark integration as not configured
	if err := h.db.UpdateIntegrationConfigured(uint(integrationID), false); err != nil {
		log.Errorf("Failed to update integration status: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{"message": "token revoked successfully"})
}

// GetToken retrieves and refreshes OAuth2 token for an integration
func (h *Handler) GetToken(ctx context.Context, integrationID int) (*oauth2.Token, error) {
	// Get token from database
	token, err := h.db.GetOAuth2Token(uint(integrationID))
	if err != nil {
		return nil, fmt.Errorf("failed to get token: %w", err)
	}

	// Parse expiry
	var expiry time.Time
	if token.Expiry != nil && !token.Expiry.IsZero() {
		expiry = *token.Expiry
	}

	oauth2Tok := &oauth2.Token{
		AccessToken:  token.AccessToken,
		TokenType:    token.TokenType,
		RefreshToken: token.RefreshToken,
		Expiry:       expiry,
	}

	// Check if token needs refresh
	if oauth2Tok.Expiry.Before(time.Now().Add(5 * time.Minute)) && oauth2Tok.RefreshToken != "" {
		log.Infof("Token expired or expiring soon, refreshing...")

		// Configure OAuth2 for token refresh
		provider, err := oidc.NewProvider(ctx, h.dexIssuer)
		if err != nil {
			return nil, fmt.Errorf("failed to create OIDC provider: %w", err)
		}

		oauth2Config := oauth2.Config{
			ClientID:     h.dexClientID,
			ClientSecret:  h.dexSecret,
			Endpoint:     provider.Endpoint(),
		}

		// Refresh token
		tokenSource := oauth2Config.TokenSource(ctx, oauth2Tok)
		newToken, err := tokenSource.Token()
		if err != nil {
			return nil, fmt.Errorf("failed to refresh token: %w", err)
		}

		// Save refreshed token
		newExpiry := newToken.Expiry
		refreshedTokenData := &db.OAuth2Token{
			IntegrationID: uint(integrationID),
			Provider:      token.Provider,
			AccessToken:   newToken.AccessToken,
			RefreshToken:  newToken.RefreshToken,
			TokenType:     newToken.TokenType,
			Expiry:        &newExpiry,
			Scopes:        token.Scopes,
		}
		if err := h.db.SaveOAuth2Token(refreshedTokenData); err != nil {
			log.Errorf("Failed to save refreshed token: %v", err)
			// Continue anyway with the new token
		}

		oauth2Tok = newToken
	}

	return oauth2Tok, nil
}

// GetTokenInfo returns information about stored tokens
func (h *Handler) GetTokenInfo(c *gin.Context) {
	integrationIDStr := c.Param("id")

	var integrationID int
	if _, err := fmt.Sscanf(integrationIDStr, "%d", &integrationID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid integration_id"})
		return
	}

	token, err := h.db.GetOAuth2Token(uint(integrationID))
	if err != nil {
		log.Errorf("Failed to get token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get token"})
		return
	}

	// Sanitize token (don't return actual token value)
	sanitized := map[string]interface{}{
		"id":             token.ID,
		"integration_id": token.IntegrationID,
		"provider":       token.Provider,
		"token_type":     token.TokenType,
		"has_refresh":    token.RefreshToken != "",
		"expiry":         token.Expiry,
		"scopes":         token.Scopes,
		"created_at":     token.CreatedAt,
		"updated_at":     token.UpdatedAt,
	}

	c.JSON(http.StatusOK, sanitized)
}

