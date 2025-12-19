package dex

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
)

// InternalDexAddress is the address where Dex server listens internally
const InternalDexAddress = "127.0.0.1:5556"

// RealDexServer is a lightweight OIDC provider that handles OAuth2 flow
// It acts as an intermediary between Kubelens and upstream identity providers (Google, GitHub, etc.)
type RealDexServer struct {
	config     *Config
	server     *http.Server
	privateKey *rsa.PrivateKey
	keyID      string
	mu         sync.RWMutex
	state      ProcessState
	lastError  error
	logHandler LogHandler
	address    string

	// Pending authorizations: state -> AuthorizationRequest
	pendingAuths map[string]*AuthorizationRequest

	// Authorization codes: code -> AuthorizationCode
	authCodes map[string]*AuthorizationCode
}

// AuthorizationRequest stores pending authorization info
type AuthorizationRequest struct {
	ClientID            string
	RedirectURI         string
	State               string
	Scope               string
	CodeChallenge       string
	CodeChallengeMethod string
	ConnectorID         string
	CreatedAt           time.Time
}

// AuthorizationCode stores issued authorization codes
type AuthorizationCode struct {
	Code                string
	ClientID            string
	RedirectURI         string
	CodeChallenge       string
	CodeChallengeMethod string
	UserInfo            *UserInfo
	CreatedAt           time.Time
	ExpiresAt           time.Time
}

// UserInfo stores authenticated user information
type UserInfo struct {
	Sub           string   `json:"sub"`
	Email         string   `json:"email"`
	EmailVerified bool     `json:"email_verified"`
	Name          string   `json:"name"`
	Picture       string   `json:"picture,omitempty"`
	Groups        []string `json:"groups,omitempty"`
}

// ProviderTokenResponse represents response from upstream provider
type ProviderTokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token,omitempty"`
	IDToken      string `json:"id_token,omitempty"`
	Scope        string `json:"scope,omitempty"`
}

// NewRealDexServer creates a new real Dex server instance
func NewRealDexServer(config *Config, logHandler LogHandler) (*RealDexServer, error) {
	// Generate RSA key for signing tokens
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, fmt.Errorf("failed to generate RSA key: %w", err)
	}

	return &RealDexServer{
		config:       config,
		privateKey:   privateKey,
		keyID:        fmt.Sprintf("key-%d", time.Now().Unix()),
		state:        StateStopped,
		logHandler:   logHandler,
		address:      InternalDexAddress,
		pendingAuths: make(map[string]*AuthorizationRequest),
		authCodes:    make(map[string]*AuthorizationCode),
	}, nil
}

// GetAddress returns the internal address where the server is listening
func (s *RealDexServer) GetAddress() string {
	return s.address
}

// Start starts the OIDC server
func (s *RealDexServer) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state == StateRunning {
		return nil
	}

	s.state = StateStarting

	mux := http.NewServeMux()

	// OIDC Discovery endpoint - handle both with and without /dex prefix
	// Without prefix: for requests coming through Kubelens proxy (which strips /dex)
	// With prefix: for direct internal calls from backend
	mux.HandleFunc("/.well-known/openid-configuration", s.handleDiscovery)
	mux.HandleFunc("/dex/.well-known/openid-configuration", s.handleDiscovery)

	// JWKS endpoint
	mux.HandleFunc("/keys", s.handleJWKS)
	mux.HandleFunc("/dex/keys", s.handleJWKS)

	// Authorization endpoint - shows connector selection or redirects to provider
	mux.HandleFunc("/auth", s.handleAuth)
	mux.HandleFunc("/dex/auth", s.handleAuth)

	// Connector-specific auth endpoint
	mux.HandleFunc("/auth/", s.handleConnectorAuth)
	mux.HandleFunc("/dex/auth/", s.handleConnectorAuth)

	// Callback from upstream provider (Google, GitHub, etc.)
	mux.HandleFunc("/callback", s.handleProviderCallback)
	mux.HandleFunc("/dex/callback", s.handleProviderCallback)

	// Token endpoint - exchanges code for tokens
	mux.HandleFunc("/token", s.handleToken)
	mux.HandleFunc("/dex/token", s.handleToken)

	// Userinfo endpoint
	mux.HandleFunc("/userinfo", s.handleUserinfo)
	mux.HandleFunc("/dex/userinfo", s.handleUserinfo)

	// Health endpoint
	mux.HandleFunc("/health", s.handleHealth)

	// Root endpoint
	mux.HandleFunc("/", s.handleRoot)

	s.server = &http.Server{
		Addr:    s.address,
		Handler: mux,
	}

	go func() {
		s.log(LogInfo, fmt.Sprintf("Starting Dex server on %s", s.address))
		if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			s.mu.Lock()
			s.lastError = err
			s.state = StateError
			s.mu.Unlock()
			s.log(LogError, fmt.Sprintf("Server error: %v", err))
		}
	}()

	// Start cleanup goroutine
	go s.cleanupExpired()

	s.state = StateRunning
	return nil
}

// Stop stops the OIDC server
func (s *RealDexServer) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.state == StateStopped {
		return nil
	}

	s.state = StateStopping
	s.log(LogInfo, "Stopping Dex server...")

	if s.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := s.server.Shutdown(ctx); err != nil {
			s.log(LogError, fmt.Sprintf("Error shutting down server: %v", err))
			return err
		}
	}

	s.state = StateStopped
	s.log(LogInfo, "Dex server stopped")
	return nil
}

// GetState returns the current state
func (s *RealDexServer) GetState() ProcessState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.state
}

// GetLastError returns the last error
func (s *RealDexServer) GetLastError() error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastError
}

// UpdateConfig updates the configuration
func (s *RealDexServer) UpdateConfig(config *Config) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config = config
}

// Handlers

func (s *RealDexServer) handleDiscovery(w http.ResponseWriter, r *http.Request) {
	// Build issuer URL dynamically from request
	issuer := s.getIssuerFromRequest(r)

	discovery := map[string]interface{}{
		"issuer":                                issuer,
		"authorization_endpoint":                issuer + "/auth",
		"token_endpoint":                        issuer + "/token",
		"userinfo_endpoint":                     issuer + "/userinfo",
		"jwks_uri":                              issuer + "/keys",
		"response_types_supported":              []string{"code"},
		"subject_types_supported":               []string{"public"},
		"id_token_signing_alg_values_supported": []string{"RS256"},
		"scopes_supported":                      []string{"openid", "email", "profile", "groups", "offline_access"},
		"token_endpoint_auth_methods_supported": []string{"client_secret_basic", "client_secret_post"},
		"claims_supported":                      []string{"sub", "iss", "aud", "exp", "iat", "email", "email_verified", "name", "picture", "groups"},
		"code_challenge_methods_supported":      []string{"S256", "plain"},
		"grant_types_supported":                 []string{"authorization_code", "refresh_token"},
	}

	s.writeJSON(w, discovery)
}

func (s *RealDexServer) handleJWKS(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	publicKey := &s.privateKey.PublicKey
	keyID := s.keyID
	s.mu.RUnlock()

	jwk := jose.JSONWebKey{
		Key:       publicKey,
		KeyID:     keyID,
		Algorithm: string(jose.RS256),
		Use:       "sig",
	}

	jwks := map[string]interface{}{
		"keys": []interface{}{jwk.Public()},
	}

	s.writeJSON(w, jwks)
}

// getIssuerFromRequest builds the issuer URL dynamically from the incoming request
// This allows the server to work with any domain without configuration
func (s *RealDexServer) getIssuerFromRequest(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	// Check X-Forwarded-Proto header (set by reverse proxy)
	if proto := r.Header.Get("X-Forwarded-Proto"); proto != "" {
		scheme = proto
	}
	
	// Get host from X-Forwarded-Host or Host header
	host := r.Header.Get("X-Forwarded-Host")
	if host == "" {
		host = r.Host
	}
	
	issuer := fmt.Sprintf("%s://%s/dex", scheme, host)
	s.log(LogDebug, fmt.Sprintf("getIssuerFromRequest: X-Forwarded-Host=%s, Host=%s, scheme=%s, issuer=%s", 
		r.Header.Get("X-Forwarded-Host"), r.Host, scheme, issuer))
	return issuer
}

func (s *RealDexServer) handleAuth(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	connectors := s.config.Connectors
	s.mu.RUnlock()

	// Build issuer URL dynamically from request
	issuer := s.getIssuerFromRequest(r)

	// Parse query parameters
	clientID := r.URL.Query().Get("client_id")
	redirectURI := r.URL.Query().Get("redirect_uri")
	state := r.URL.Query().Get("state")
	scope := r.URL.Query().Get("scope")
	codeChallenge := r.URL.Query().Get("code_challenge")
	codeChallengeMethod := r.URL.Query().Get("code_challenge_method")

	// Validate client
	if !s.isValidClient(clientID, redirectURI) {
		http.Error(w, "Invalid client_id or redirect_uri", http.StatusBadRequest)
		return
	}

	// If only one connector, redirect directly
	if len(connectors) == 1 {
		connector := connectors[0]
		connURL := fmt.Sprintf("%s/auth/%s?client_id=%s&redirect_uri=%s&state=%s&scope=%s&code_challenge=%s&code_challenge_method=%s",
			issuer, connector.ID, clientID, url.QueryEscape(redirectURI), state, url.QueryEscape(scope), codeChallenge, codeChallengeMethod)
		http.Redirect(w, r, connURL, http.StatusFound)
		return
	}

	// Show connector selection page
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprintf(w, `<!DOCTYPE html>
<html>
<head>
    <title>Login - Kubelens</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); }
        .container { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 400px; width: 100%%; }
        h1 { margin: 0 0 30px; text-align: center; color: #333; }
        .connector { display: block; padding: 15px 20px; margin: 10px 0; background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; text-decoration: none; color: #333; font-weight: 500; text-align: center; transition: all 0.2s; }
        .connector:hover { background: #eee; border-color: #ccc; transform: translateY(-2px); }
        .connector.github { background: #24292e; color: white; border-color: #24292e; }
        .connector.google { background: #4285f4; color: white; border-color: #4285f4; }
        .connector.gitlab { background: #fc6d26; color: white; border-color: #fc6d26; }
        .connector.microsoft { background: #00a4ef; color: white; border-color: #00a4ef; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Sign In to Kubelens</h1>`)

	for _, conn := range connectors {
		connURL := fmt.Sprintf("%s/auth/%s?client_id=%s&redirect_uri=%s&state=%s&scope=%s&code_challenge=%s&code_challenge_method=%s",
			issuer, conn.ID, clientID, url.QueryEscape(redirectURI), state, url.QueryEscape(scope), codeChallenge, codeChallengeMethod)
		fmt.Fprintf(w, `<a href="%s" class="connector %s">%s</a>`, connURL, conn.Type, conn.Name)
	}

	fmt.Fprintf(w, `
    </div>
</body>
</html>`)
}

func (s *RealDexServer) handleConnectorAuth(w http.ResponseWriter, r *http.Request) {
	// Extract connector ID from path: /auth/{connector_id}
	path := strings.TrimPrefix(r.URL.Path, "/auth/")
	connectorID := strings.Split(path, "?")[0]

	s.mu.RLock()
	var connector *Connector
	for _, c := range s.config.Connectors {
		if c.ID == connectorID {
			connector = &c
			break
		}
	}
	s.mu.RUnlock()

	if connector == nil {
		http.Error(w, "Unknown connector", http.StatusBadRequest)
		return
	}

	// Build issuer URL dynamically from request
	issuer := s.getIssuerFromRequest(r)

	// Parse query parameters
	clientID := r.URL.Query().Get("client_id")
	redirectURI := r.URL.Query().Get("redirect_uri")
	state := r.URL.Query().Get("state")
	scope := r.URL.Query().Get("scope")
	codeChallenge := r.URL.Query().Get("code_challenge")
	codeChallengeMethod := r.URL.Query().Get("code_challenge_method")

	// Generate internal state for tracking
	internalState := s.generateRandomString(32)

	// Store pending authorization
	s.mu.Lock()
	s.pendingAuths[internalState] = &AuthorizationRequest{
		ClientID:            clientID,
		RedirectURI:         redirectURI,
		State:               state,
		Scope:               scope,
		CodeChallenge:       codeChallenge,
		CodeChallengeMethod: codeChallengeMethod,
		ConnectorID:         connectorID,
		CreatedAt:           time.Now(),
	}
	s.mu.Unlock()

	// Build upstream provider authorization URL
	var authURL string
	switch connector.Type {
	case "google":
		cfg := connector.Config.(*GoogleConnectorConfig)
		authURL = fmt.Sprintf("https://accounts.google.com/o/oauth2/v2/auth?client_id=%s&redirect_uri=%s&response_type=code&scope=%s&state=%s&access_type=offline&prompt=consent",
			cfg.ClientID,
			url.QueryEscape(issuer+"/callback"),
			url.QueryEscape("openid email profile"),
			internalState)
	case "github":
		cfg := connector.Config.(*GitHubConnectorConfig)
		authURL = fmt.Sprintf("https://github.com/login/oauth/authorize?client_id=%s&redirect_uri=%s&scope=%s&state=%s",
			cfg.ClientID,
			url.QueryEscape(issuer+"/callback"),
			url.QueryEscape("user:email read:org"),
			internalState)
	case "gitlab":
		cfg := connector.Config.(*GitLabConnectorConfig)
		baseURL := cfg.BaseURL
		if baseURL == "" {
			baseURL = "https://gitlab.com"
		}
		authURL = fmt.Sprintf("%s/oauth/authorize?client_id=%s&redirect_uri=%s&response_type=code&scope=%s&state=%s",
			baseURL,
			cfg.ClientID,
			url.QueryEscape(issuer+"/callback"),
			url.QueryEscape("openid email profile read_user"),
			internalState)
	case "microsoft":
		cfg := connector.Config.(*MicrosoftConnectorConfig)
		tenant := cfg.Tenant
		if tenant == "" {
			tenant = "common"
		}
		authURL = fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/authorize?client_id=%s&redirect_uri=%s&response_type=code&scope=%s&state=%s",
			tenant,
			cfg.ClientID,
			url.QueryEscape(issuer+"/callback"),
			url.QueryEscape("openid email profile"),
			internalState)
	default:
		http.Error(w, "Unsupported connector type", http.StatusBadRequest)
		return
	}

	s.log(LogInfo, fmt.Sprintf("Redirecting to %s provider with redirect_uri: %s/callback", connector.Type, issuer))
	s.log(LogInfo, fmt.Sprintf("Full auth URL: %s", authURL))
	http.Redirect(w, r, authURL, http.StatusFound)
}

func (s *RealDexServer) handleProviderCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	errorParam := r.URL.Query().Get("error")

	if errorParam != "" {
		errorDesc := r.URL.Query().Get("error_description")
		s.log(LogError, fmt.Sprintf("Provider returned error: %s - %s", errorParam, errorDesc))
		http.Error(w, fmt.Sprintf("Authentication error: %s", errorDesc), http.StatusBadRequest)
		return
	}

	// Find pending authorization
	s.mu.Lock()
	pendingAuth, ok := s.pendingAuths[state]
	if ok {
		delete(s.pendingAuths, state)
	}
	s.mu.Unlock()

	if !ok {
		http.Error(w, "Invalid or expired state", http.StatusBadRequest)
		return
	}

	// Find connector
	s.mu.RLock()
	var connector *Connector
	for _, c := range s.config.Connectors {
		if c.ID == pendingAuth.ConnectorID {
			connector = &c
			break
		}
	}
	s.mu.RUnlock()

	if connector == nil {
		http.Error(w, "Connector not found", http.StatusInternalServerError)
		return
	}

	// Build issuer URL dynamically from request
	issuer := s.getIssuerFromRequest(r)

	// Exchange code with upstream provider
	userInfo, err := s.exchangeCodeWithProvider(connector, code, issuer+"/callback")
	if err != nil {
		s.log(LogError, fmt.Sprintf("Failed to exchange code: %v", err))
		http.Error(w, "Failed to authenticate with provider", http.StatusInternalServerError)
		return
	}

	s.log(LogInfo, fmt.Sprintf("User authenticated: %s (%s)", userInfo.Email, userInfo.Name))

	// Generate authorization code for Kubelens client
	authCode := s.generateRandomString(32)

	s.mu.Lock()
	s.authCodes[authCode] = &AuthorizationCode{
		Code:                authCode,
		ClientID:            pendingAuth.ClientID,
		RedirectURI:         pendingAuth.RedirectURI,
		CodeChallenge:       pendingAuth.CodeChallenge,
		CodeChallengeMethod: pendingAuth.CodeChallengeMethod,
		UserInfo:            userInfo,
		CreatedAt:           time.Now(),
		ExpiresAt:           time.Now().Add(10 * time.Minute),
	}
	s.mu.Unlock()

	// Redirect back to Kubelens frontend with code
	redirectURL := fmt.Sprintf("%s?code=%s&state=%s", pendingAuth.RedirectURI, authCode, pendingAuth.State)
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

func (s *RealDexServer) handleToken(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	grantType := r.FormValue("grant_type")
	code := r.FormValue("code")
	clientID := r.FormValue("client_id")
	clientSecret := r.FormValue("client_secret")
	redirectURI := r.FormValue("redirect_uri")
	codeVerifier := r.FormValue("code_verifier")

	// Also check Basic auth
	if clientID == "" {
		var ok bool
		clientID, clientSecret, ok = r.BasicAuth()
		if !ok {
			http.Error(w, "Missing client credentials", http.StatusUnauthorized)
			return
		}
	}

	// Validate client
	if !s.isValidClientWithSecret(clientID, clientSecret) {
		http.Error(w, "Invalid client credentials", http.StatusUnauthorized)
		return
	}

	switch grantType {
	case "authorization_code":
		s.handleAuthorizationCodeGrant(w, r, code, clientID, redirectURI, codeVerifier)
	default:
		http.Error(w, "Unsupported grant type", http.StatusBadRequest)
	}
}

func (s *RealDexServer) handleAuthorizationCodeGrant(w http.ResponseWriter, r *http.Request, code, clientID, redirectURI, codeVerifier string) {
	// Find and validate authorization code
	s.mu.Lock()
	authCode, ok := s.authCodes[code]
	if ok {
		delete(s.authCodes, code)
	}
	s.mu.Unlock()

	if !ok {
		http.Error(w, "Invalid authorization code", http.StatusBadRequest)
		return
	}

	if time.Now().After(authCode.ExpiresAt) {
		http.Error(w, "Authorization code expired", http.StatusBadRequest)
		return
	}

	if authCode.ClientID != clientID {
		http.Error(w, "Client ID mismatch", http.StatusBadRequest)
		return
	}

	if authCode.RedirectURI != redirectURI {
		http.Error(w, "Redirect URI mismatch", http.StatusBadRequest)
		return
	}

	// Verify PKCE if code_challenge was provided
	if authCode.CodeChallenge != "" {
		if codeVerifier == "" {
			http.Error(w, "Code verifier required", http.StatusBadRequest)
			return
		}

		if !s.verifyPKCE(codeVerifier, authCode.CodeChallenge, authCode.CodeChallengeMethod) {
			http.Error(w, "Invalid code verifier", http.StatusBadRequest)
			return
		}
	}

	// Generate tokens with dynamic issuer from request
	issuer := s.getIssuerFromRequest(r)

	idToken, err := s.generateIDToken(authCode.UserInfo, clientID, issuer)
	if err != nil {
		s.log(LogError, fmt.Sprintf("Failed to generate ID token: %v", err))
		http.Error(w, "Failed to generate tokens", http.StatusInternalServerError)
		return
	}

	accessToken := s.generateRandomString(32)

	response := map[string]interface{}{
		"access_token": accessToken,
		"token_type":   "Bearer",
		"expires_in":   3600,
		"id_token":     idToken,
	}

	s.writeJSON(w, response)
}

func (s *RealDexServer) handleUserinfo(w http.ResponseWriter, r *http.Request) {
	// In a production implementation, validate the access token
	// For now, return 401 if no auth header
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Missing authorization header", http.StatusUnauthorized)
		return
	}

	// Return user info from the token
	// This is a simplified implementation
	s.writeJSON(w, map[string]interface{}{
		"sub":            "user",
		"email":          "user@example.com",
		"email_verified": true,
		"name":           "User",
	})
}

func (s *RealDexServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	state := s.state
	issuer := s.config.Issuer
	connectorCount := len(s.config.Connectors)
	s.mu.RUnlock()

	health := map[string]interface{}{
		"status":     state.String(),
		"issuer":     issuer,
		"connectors": connectorCount,
		"timestamp":  time.Now().Format(time.RFC3339),
	}

	if state == StateRunning {
		w.WriteHeader(http.StatusOK)
	} else {
		w.WriteHeader(http.StatusServiceUnavailable)
	}

	s.writeJSON(w, health)
}

func (s *RealDexServer) handleRoot(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	s.mu.RLock()
	issuer := s.config.Issuer
	connectorCount := len(s.config.Connectors)
	s.mu.RUnlock()

	fmt.Fprintf(w, `<!DOCTYPE html>
<html>
<head>
    <title>Kubelens OAuth2 Extension</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%%, #764ba2 100%%); }
        .container { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 500px; }
        h1 { margin: 0 0 20px; color: #333; }
        .info { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-top: 20px; }
        .info p { margin: 10px 0; color: #666; }
        .info code { background: #e0e0e0; padding: 2px 6px; border-radius: 4px; }
        a { color: #667eea; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Kubelens OAuth2 Extension</h1>
        <p>This extension provides OAuth2/OIDC authentication for Kubelens.</p>
        <div class="info">
            <p><strong>Issuer:</strong> <code>%s</code></p>
            <p><strong>Connectors:</strong> %d configured</p>
            <p><strong>Discovery:</strong> <a href="/.well-known/openid-configuration">/.well-known/openid-configuration</a></p>
            <p><strong>Health:</strong> <a href="/health">/health</a></p>
        </div>
    </div>
</body>
</html>`, issuer, connectorCount)
}

// Provider-specific code exchange

func (s *RealDexServer) exchangeCodeWithProvider(connector *Connector, code, redirectURI string) (*UserInfo, error) {
	switch connector.Type {
	case "google":
		return s.exchangeGoogleCode(connector.Config.(*GoogleConnectorConfig), code, redirectURI)
	case "github":
		return s.exchangeGitHubCode(connector.Config.(*GitHubConnectorConfig), code, redirectURI)
	case "gitlab":
		return s.exchangeGitLabCode(connector.Config.(*GitLabConnectorConfig), code, redirectURI)
	case "microsoft":
		return s.exchangeMicrosoftCode(connector.Config.(*MicrosoftConnectorConfig), code, redirectURI)
	default:
		return nil, fmt.Errorf("unsupported connector type: %s", connector.Type)
	}
}

func (s *RealDexServer) exchangeGoogleCode(cfg *GoogleConnectorConfig, code, redirectURI string) (*UserInfo, error) {
	// Exchange code for tokens
	tokenURL := "https://oauth2.googleapis.com/token"
	data := url.Values{
		"code":          {code},
		"client_id":     {cfg.ClientID},
		"client_secret": {cfg.ClientSecret},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
	}

	resp, err := http.PostForm(tokenURL, data)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("token exchange failed: %s", string(body))
	}

	var tokenResp ProviderTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	// Get user info
	userInfoURL := "https://www.googleapis.com/oauth2/v2/userinfo"
	req, _ := http.NewRequest("GET", userInfoURL, nil)
	req.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)

	client := &http.Client{}
	resp, err = client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	var googleUser struct {
		ID            string `json:"id"`
		Email         string `json:"email"`
		VerifiedEmail bool   `json:"verified_email"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&googleUser); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	return &UserInfo{
		Sub:           googleUser.ID,
		Email:         googleUser.Email,
		EmailVerified: googleUser.VerifiedEmail,
		Name:          googleUser.Name,
		Picture:       googleUser.Picture,
	}, nil
}

func (s *RealDexServer) exchangeGitHubCode(cfg *GitHubConnectorConfig, code, redirectURI string) (*UserInfo, error) {
	// Exchange code for tokens
	tokenURL := "https://github.com/login/oauth/access_token"
	data := url.Values{
		"code":          {code},
		"client_id":     {cfg.ClientID},
		"client_secret": {cfg.ClientSecret},
		"redirect_uri":  {redirectURI},
	}

	req, _ := http.NewRequest("POST", tokenURL, strings.NewReader(data.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}
	defer resp.Body.Close()

	var tokenResp ProviderTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	// Get user info
	userReq, _ := http.NewRequest("GET", "https://api.github.com/user", nil)
	userReq.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)
	userReq.Header.Set("Accept", "application/json")

	resp, err = client.Do(userReq)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	var githubUser struct {
		ID        int    `json:"id"`
		Login     string `json:"login"`
		Name      string `json:"name"`
		Email     string `json:"email"`
		AvatarURL string `json:"avatar_url"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&githubUser); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	// If email is not public, fetch from emails endpoint
	if githubUser.Email == "" {
		emailReq, _ := http.NewRequest("GET", "https://api.github.com/user/emails", nil)
		emailReq.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)
		emailReq.Header.Set("Accept", "application/json")

		resp, err = client.Do(emailReq)
		if err == nil {
			defer resp.Body.Close()
			var emails []struct {
				Email    string `json:"email"`
				Primary  bool   `json:"primary"`
				Verified bool   `json:"verified"`
			}
			if json.NewDecoder(resp.Body).Decode(&emails) == nil {
				for _, e := range emails {
					if e.Primary && e.Verified {
						githubUser.Email = e.Email
						break
					}
				}
			}
		}
	}

	name := githubUser.Name
	if name == "" {
		name = githubUser.Login
	}

	return &UserInfo{
		Sub:           fmt.Sprintf("%d", githubUser.ID),
		Email:         githubUser.Email,
		EmailVerified: true,
		Name:          name,
		Picture:       githubUser.AvatarURL,
	}, nil
}

func (s *RealDexServer) exchangeGitLabCode(cfg *GitLabConnectorConfig, code, redirectURI string) (*UserInfo, error) {
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = "https://gitlab.com"
	}

	// Exchange code for tokens
	tokenURL := baseURL + "/oauth/token"
	data := url.Values{
		"code":          {code},
		"client_id":     {cfg.ClientID},
		"client_secret": {cfg.ClientSecret},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
	}

	resp, err := http.PostForm(tokenURL, data)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}
	defer resp.Body.Close()

	var tokenResp ProviderTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	// Get user info
	userReq, _ := http.NewRequest("GET", baseURL+"/api/v4/user", nil)
	userReq.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)

	client := &http.Client{}
	resp, err = client.Do(userReq)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	var gitlabUser struct {
		ID        int    `json:"id"`
		Username  string `json:"username"`
		Name      string `json:"name"`
		Email     string `json:"email"`
		AvatarURL string `json:"avatar_url"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&gitlabUser); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	return &UserInfo{
		Sub:           fmt.Sprintf("%d", gitlabUser.ID),
		Email:         gitlabUser.Email,
		EmailVerified: true,
		Name:          gitlabUser.Name,
		Picture:       gitlabUser.AvatarURL,
	}, nil
}

func (s *RealDexServer) exchangeMicrosoftCode(cfg *MicrosoftConnectorConfig, code, redirectURI string) (*UserInfo, error) {
	tenant := cfg.Tenant
	if tenant == "" {
		tenant = "common"
	}

	// Exchange code for tokens
	tokenURL := fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", tenant)
	data := url.Values{
		"code":          {code},
		"client_id":     {cfg.ClientID},
		"client_secret": {cfg.ClientSecret},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
		"scope":         {"openid email profile"},
	}

	resp, err := http.PostForm(tokenURL, data)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}
	defer resp.Body.Close()

	var tokenResp ProviderTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	// Get user info from Microsoft Graph
	userReq, _ := http.NewRequest("GET", "https://graph.microsoft.com/v1.0/me", nil)
	userReq.Header.Set("Authorization", "Bearer "+tokenResp.AccessToken)

	client := &http.Client{}
	resp, err = client.Do(userReq)
	if err != nil {
		return nil, fmt.Errorf("failed to get user info: %w", err)
	}
	defer resp.Body.Close()

	var msUser struct {
		ID                string `json:"id"`
		DisplayName       string `json:"displayName"`
		Mail              string `json:"mail"`
		UserPrincipalName string `json:"userPrincipalName"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&msUser); err != nil {
		return nil, fmt.Errorf("failed to decode user info: %w", err)
	}

	email := msUser.Mail
	if email == "" {
		email = msUser.UserPrincipalName
	}

	return &UserInfo{
		Sub:           msUser.ID,
		Email:         email,
		EmailVerified: true,
		Name:          msUser.DisplayName,
	}, nil
}

// Helper methods

func (s *RealDexServer) isValidClient(clientID, redirectURI string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, client := range s.config.StaticClients {
		if client.ID == clientID {
			for _, uri := range client.RedirectURIs {
				// Exact match
				if uri == redirectURI {
					return true
				}
				// Path-based match: validate only the path portion
				// This allows flexibility for different hosts/ports in dev vs production
				// e.g., configured: http://localhost:8080/auth/callback
				//       requested: http://localhost:3030/auth/callback (dev)
				//       requested: https://kubelens.example.com/auth/callback (prod)
				if matchRedirectPath(uri, redirectURI) {
					return true
				}
			}
		}
	}
	return false
}

// matchRedirectPath checks if two redirect URIs have the same path
// This allows flexibility for different hosts/ports while ensuring
// the callback path is correct and secure
func matchRedirectPath(configured, requested string) bool {
	configuredPath := extractPath(configured)
	requestedPath := extractPath(requested)

	// Path must be non-empty and match exactly
	return configuredPath != "" && configuredPath == requestedPath
}

// extractPath extracts the path portion from a URI
// e.g., "http://localhost:8080/auth/callback" -> "/auth/callback"
func extractPath(uri string) string {
	// Find the start of path (after scheme://host:port)
	schemeEnd := strings.Index(uri, "://")
	if schemeEnd < 0 {
		return ""
	}

	hostStart := schemeEnd + 3
	pathStart := strings.Index(uri[hostStart:], "/")
	if pathStart < 0 {
		return "/"
	}

	return uri[hostStart+pathStart:]
}

func (s *RealDexServer) isValidClientWithSecret(clientID, clientSecret string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, client := range s.config.StaticClients {
		if client.ID == clientID && client.Secret == clientSecret {
			return true
		}
	}
	return false
}

func (s *RealDexServer) verifyPKCE(verifier, challenge, method string) bool {
	if method == "" || method == "plain" {
		return verifier == challenge
	}

	if method == "S256" {
		hash := sha256.Sum256([]byte(verifier))
		computed := base64.RawURLEncoding.EncodeToString(hash[:])
		return computed == challenge
	}

	return false
}

func (s *RealDexServer) generateIDToken(userInfo *UserInfo, clientID, issuer string) (string, error) {
	s.mu.RLock()
	privateKey := s.privateKey
	keyID := s.keyID
	s.mu.RUnlock()

	signer, err := jose.NewSigner(
		jose.SigningKey{Algorithm: jose.RS256, Key: privateKey},
		(&jose.SignerOptions{}).WithType("JWT").WithHeader("kid", keyID),
	)
	if err != nil {
		return "", err
	}

	now := time.Now()
	claims := jwt.Claims{
		Issuer:    issuer,
		Subject:   userInfo.Sub,
		Audience:  jwt.Audience{clientID},
		IssuedAt:  jwt.NewNumericDate(now),
		Expiry:    jwt.NewNumericDate(now.Add(1 * time.Hour)),
		NotBefore: jwt.NewNumericDate(now),
	}

	customClaims := map[string]interface{}{
		"email":          userInfo.Email,
		"email_verified": userInfo.EmailVerified,
		"name":           userInfo.Name,
	}

	if userInfo.Picture != "" {
		customClaims["picture"] = userInfo.Picture
	}

	if len(userInfo.Groups) > 0 {
		customClaims["groups"] = userInfo.Groups
	}

	token, err := jwt.Signed(signer).Claims(claims).Claims(customClaims).Serialize()
	if err != nil {
		return "", err
	}

	return token, nil
}

func (s *RealDexServer) generateRandomString(length int) string {
	b := make([]byte, length)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)[:length]
}

func (s *RealDexServer) writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func (s *RealDexServer) log(level LogLevel, message string) {
	if s.logHandler != nil {
		s.logHandler(LogEntry{
			Level:     level,
			Message:   message,
			Timestamp: time.Now(),
			Source:    "dex-server",
		})
	}
}

func (s *RealDexServer) cleanupExpired() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		<-ticker.C
		s.mu.Lock()
		now := time.Now()

		// Cleanup expired pending auths (older than 10 minutes)
		for state, auth := range s.pendingAuths {
			if now.Sub(auth.CreatedAt) > 10*time.Minute {
				delete(s.pendingAuths, state)
			}
		}

		// Cleanup expired auth codes
		for code, authCode := range s.authCodes {
			if now.After(authCode.ExpiresAt) {
				delete(s.authCodes, code)
			}
		}
		s.mu.Unlock()
	}
}
