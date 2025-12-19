package extension

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/hashicorp/go-plugin"
	log "github.com/sirupsen/logrus"

	"github.com/sonnguyen/kubelens/internal/audit"
	"github.com/sonnguyen/kubelens/internal/crypto"
	"github.com/sonnguyen/kubelens/internal/db"
	kbplugin "github.com/sonnguyen/kubelens/pkg/plugin"
)

// MaxUploadSize is the maximum file size for extension uploads (100MB)
const MaxUploadSize = 100 << 20 // 100 MB

// ExtensionStatus represents the runtime status of an extension
type ExtensionStatus string

const (
	StatusRunning ExtensionStatus = "running"
	StatusStopped ExtensionStatus = "stopped"
	StatusError   ExtensionStatus = "error"
)

// ExtensionInfo represents full extension information including status
type ExtensionInfo struct {
	kbplugin.Metadata
	Status  ExtensionStatus   `json:"status"`
	Enabled bool              `json:"enabled"`
	Config  map[string]string `json:"config,omitempty"`
	UI      *kbplugin.UIMetadata `json:"ui,omitempty"`
}

// Manager handles extension lifecycle
type Manager struct {
	store       *Store
	discovery   *Discovery
	db          *db.DB
	auditLogger *audit.Logger
	encryptor   *crypto.Encryptor

	clients     map[string]*plugin.Client
	extensions  map[string]kbplugin.Extension
	statuses    map[string]ExtensionStatus
	configs     map[string]map[string]string
	enabled     map[string]bool
	mu          sync.RWMutex

	// HTTP proxies for extension endpoints
	httpProxies map[string]*httputil.ReverseProxy
	router      *gin.Engine
}

// NewManager creates a new extension manager
func NewManager(rootDir string, database *db.DB, auditLogger *audit.Logger) (*Manager, error) {
	store, err := NewStore(rootDir)
	if err != nil {
		return nil, err
	}

	// Initialize encryptor with auto-generated key from database
	var encryptor *crypto.Encryptor
	if database != nil {
		key, err := database.GetOrCreateEncryptionKey()
		if err != nil {
			log.Warnf("Failed to get encryption key: %v. Config will not be persisted.", err)
		} else {
			encryptor, err = crypto.NewEncryptor(key)
			if err != nil {
				log.Warnf("Failed to initialize encryptor: %v", err)
			}
		}
	}

	return &Manager{
		store:       store,
		discovery:   NewDiscovery(),
		db:          database,
		auditLogger: auditLogger,
		encryptor:   encryptor,
		clients:     make(map[string]*plugin.Client),
		extensions:  make(map[string]kbplugin.Extension),
		statuses:    make(map[string]ExtensionStatus),
		configs:     make(map[string]map[string]string),
		enabled:     make(map[string]bool),
		httpProxies: make(map[string]*httputil.ReverseProxy),
	}, nil
}

// LoadExtensions loads and starts all installed extensions
func (m *Manager) LoadExtensions() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Load persisted configs from database first
	if m.db != nil && m.encryptor != nil {
		configs, err := m.db.GetAllExtensionConfigs()
		if err != nil {
			log.Warnf("Failed to load extension configs from database: %v", err)
		} else {
			for _, cfg := range configs {
				decrypted, err := m.encryptor.Decrypt(cfg.ConfigData)
				if err != nil {
					log.Warnf("Failed to decrypt config for %s: %v", cfg.ExtensionName, err)
					continue
				}
				var configMap map[string]string
				if err := json.Unmarshal(decrypted, &configMap); err != nil {
					log.Warnf("Failed to unmarshal config for %s: %v", cfg.ExtensionName, err)
					continue
				}
				m.configs[cfg.ExtensionName] = configMap
				log.Infof("Loaded persisted config for extension: %s", cfg.ExtensionName)
			}
		}
	}

	installed, err := m.store.List()
	if err != nil {
		return fmt.Errorf("failed to list extensions: %w", err)
	}

	for _, ext := range installed {
		if err := m.loadExtension(ext); err != nil {
			log.Errorf("Failed to load extension %s: %v", ext.Manifest.Name, err)
			// Continue loading others
		}
	}

	return nil
}

func (m *Manager) loadExtension(ext InstalledExtension) error {
	// Create client config
	clientConfig := &plugin.ClientConfig{
		HandshakeConfig: kbplugin.HandshakeConfig,
		Plugins: map[string]plugin.Plugin{
			"extension": &kbplugin.ExtensionPlugin{},
		},
		Cmd:              exec.Command(ext.BinPath),
		SyncStdout:       os.Stdout,
		SyncStderr:       os.Stderr,
	}

	client := plugin.NewClient(clientConfig)
	
	// Connect via RPC
	rpcClient, err := client.Client()
	if err != nil {
		client.Kill()
		m.statuses[ext.Manifest.Name] = StatusError
		return fmt.Errorf("failed to connect to extension: %w", err)
	}

	// Request the plugin
	raw, err := rpcClient.Dispense("extension")
	if err != nil {
		client.Kill()
		m.statuses[ext.Manifest.Name] = StatusError
		return fmt.Errorf("failed to dispense plugin: %w", err)
	}

	extension := raw.(kbplugin.Extension)

	// Register
	m.clients[ext.Manifest.Name] = client
	m.extensions[ext.Manifest.Name] = extension
	m.enabled[ext.Manifest.Name] = true

	log.Infof("Loaded extension: %s v%s", ext.Manifest.Name, ext.Manifest.Version)
	
	// Initialize with saved config or empty
	config := m.configs[ext.Manifest.Name]
	if config == nil {
		config = make(map[string]string)
		m.configs[ext.Manifest.Name] = config
	}
	
	log.Infof("Initializing extension %s...", ext.Manifest.Name)
	if err := extension.Init(config); err != nil {
		log.Errorf("Failed to init extension %s: %v", ext.Manifest.Name, err)
		m.statuses[ext.Manifest.Name] = StatusError
		return err
	}
	log.Infof("✅ Extension %s initialized", ext.Manifest.Name)

	// Start
	log.Infof("Starting extension %s...", ext.Manifest.Name)
	if err := extension.Start(); err != nil {
		log.Errorf("Failed to start extension %s: %v", ext.Manifest.Name, err)
		m.statuses[ext.Manifest.Name] = StatusError
		return err
	}
	log.Infof("✅ Extension %s started successfully", ext.Manifest.Name)

	m.statuses[ext.Manifest.Name] = StatusRunning
	return nil
}

// Shutdown stops all extensions
func (m *Manager) Shutdown() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for name, ext := range m.extensions {
		if err := ext.Stop(); err != nil {
			log.Errorf("Error stopping extension %s: %v", name, err)
		}
	}

	for _, client := range m.clients {
		client.Kill()
	}
}

// ListExtensions returns list of loaded extensions with full info
func (m *Manager) ListExtensions() []ExtensionInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var list []ExtensionInfo
	for name, ext := range m.extensions {
		meta, err := ext.GetMetadata()
		if err != nil {
			log.Errorf("Failed to get metadata for %s: %v", name, err)
			continue
		}
		
		info := ExtensionInfo{
			Metadata: meta,
			Status:   m.statuses[name],
			Enabled:  m.enabled[name],
			Config:   m.configs[name],
		}
		
		// Get UI metadata
		if ui, err := ext.GetUI(); err == nil {
			info.UI = &ui
		}
		
		list = append(list, info)
	}
	return list
}

// GetExtension returns a single extension info
func (m *Manager) GetExtension(name string) (*ExtensionInfo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ext, ok := m.extensions[name]
	if !ok {
		return nil, fmt.Errorf("extension not found: %s", name)
	}

	meta, err := ext.GetMetadata()
	if err != nil {
		return nil, err
	}

	info := &ExtensionInfo{
		Metadata: meta,
		Status:   m.statuses[name],
		Enabled:  m.enabled[name],
		Config:   m.configs[name],
	}

	if ui, err := ext.GetUI(); err == nil {
		info.UI = &ui
	}

	return info, nil
}

// EnableExtension enables and starts an extension
func (m *Manager) EnableExtension(name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	ext, ok := m.extensions[name]
	if !ok {
		return fmt.Errorf("extension not found: %s", name)
	}

	if m.enabled[name] {
		return nil // Already enabled
	}

	// Re-initialize and start
	config := m.configs[name]
	if config == nil {
		config = make(map[string]string)
	}
	
	if err := ext.Init(config); err != nil {
		m.statuses[name] = StatusError
		return fmt.Errorf("failed to init extension: %w", err)
	}

	if err := ext.Start(); err != nil {
		m.statuses[name] = StatusError
		return fmt.Errorf("failed to start extension: %w", err)
	}

	m.enabled[name] = true
	m.statuses[name] = StatusRunning

	m.auditLogger.Log(audit.LogEntry{
		Action:        "enable",
		Resource:      "extension",
		EventCategory: "system",
		Level:         "INFO",
		Description:   fmt.Sprintf("Enabled extension: %s", name),
		Success:       true,
	})

	return nil
}

// DisableExtension disables and stops an extension
func (m *Manager) DisableExtension(name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	ext, ok := m.extensions[name]
	if !ok {
		return fmt.Errorf("extension not found: %s", name)
	}

	if !m.enabled[name] {
		return nil // Already disabled
	}

	if err := ext.Stop(); err != nil {
		log.Warnf("Error stopping extension %s: %v", name, err)
	}

	m.enabled[name] = false
	m.statuses[name] = StatusStopped

	m.auditLogger.Log(audit.LogEntry{
		Action:        "disable",
		Resource:      "extension",
		EventCategory: "system",
		Level:         "INFO",
		Description:   fmt.Sprintf("Disabled extension: %s", name),
		Success:       true,
	})

	return nil
}

// GetConfig returns extension configuration
func (m *Manager) GetConfig(name string) (map[string]string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if _, ok := m.extensions[name]; !ok {
		return nil, fmt.Errorf("extension not found: %s", name)
	}

	config := m.configs[name]
	if config == nil {
		return make(map[string]string), nil
	}
	return config, nil
}

// UpdateConfig updates extension configuration
func (m *Manager) UpdateConfig(name string, config map[string]string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	ext, ok := m.extensions[name]
	if !ok {
		return fmt.Errorf("extension not found: %s", name)
	}

	// Validate first
	if err := ext.ValidateConfig(config); err != nil {
		return fmt.Errorf("invalid configuration: %w", err)
	}

	// Apply config (hot reload)
	if err := ext.UpdateConfig(config); err != nil {
		return fmt.Errorf("failed to update configuration: %w", err)
	}

	m.configs[name] = config

	// Persist encrypted config to database
	if m.db != nil && m.encryptor != nil {
		configJSON, err := json.Marshal(config)
		if err != nil {
			log.Warnf("Failed to marshal config for persistence: %v", err)
		} else {
			encrypted, err := m.encryptor.Encrypt(configJSON)
			if err != nil {
				log.Warnf("Failed to encrypt config for persistence: %v", err)
			} else {
				if err := m.db.SaveExtensionConfig(name, encrypted); err != nil {
					log.Warnf("Failed to persist config to database: %v", err)
				} else {
					log.Infof("Persisted encrypted config for extension: %s", name)
				}
			}
		}
	}

	m.auditLogger.Log(audit.LogEntry{
		Action:        "configure",
		Resource:      "extension",
		EventCategory: "system",
		Level:         "INFO",
		Description:   fmt.Sprintf("Updated configuration for extension: %s", name),
		Success:       true,
	})

	return nil
}

// InstallExtension installs an extension from a package file
func (m *Manager) InstallExtension(packagePath string) error {
	ext, err := m.store.Install(packagePath)
	if err != nil {
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Load immediately
	if err := m.loadExtension(*ext); err != nil {
		return err
	}

	// Audit log
	m.auditLogger.Log(audit.LogEntry{
		Action:        "install",
		Resource:      "extension",
		EventCategory: "system",
		Level:         "INFO",
		Description:   fmt.Sprintf("Installed extension: %s", ext.Manifest.Name),
		Success:       true,
	})

	return nil
}

// UninstallExtension removes an extension
func (m *Manager) UninstallExtension(name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Stop first
	if ext, ok := m.extensions[name]; ok {
		ext.Stop()
	}
	if client, ok := m.clients[name]; ok {
		client.Kill()
	}

	delete(m.extensions, name)
	delete(m.clients, name)

	if err := m.store.Uninstall(name); err != nil {
		return err
	}

	// Audit log
	m.auditLogger.Log(audit.LogEntry{
		Action:        "uninstall",
		Resource:      "extension",
		EventCategory: "system",
		Level:         "INFO",
		Description:   fmt.Sprintf("Uninstalled extension: %s", name),
		Success:       true,
	})

	return nil
}

// ListAvailableExtensions returns available extensions from the registry
func (m *Manager) ListAvailableExtensions() ([]ExtensionRelease, error) {
	return m.discovery.ListAvailable()
}

// InstallFromRegistry downloads and installs an extension from the registry
func (m *Manager) InstallFromRegistry(name, version string) error {
	var release *ExtensionRelease
	var err error

	if version == "" || version == "latest" {
		release, err = m.discovery.GetLatestRelease(name)
	} else {
		releases, err := m.discovery.GetExtensionReleases(name)
		if err != nil {
			return err
		}
		for _, r := range releases {
			if r.Version == version {
				release = &r
				break
			}
		}
		if release == nil {
			return fmt.Errorf("version %s not found for extension %s", version, name)
		}
	}

	if err != nil {
		return fmt.Errorf("failed to get release info: %w", err)
	}

	// Download to temp directory
	tempDir, err := os.MkdirTemp("", "kubelens-ext-download-")
	if err != nil {
		return fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer os.RemoveAll(tempDir)

	packagePath, err := m.discovery.DownloadExtension(release, tempDir)
	if err != nil {
		return fmt.Errorf("failed to download extension: %w", err)
	}

	// Install from downloaded package
	return m.InstallExtension(packagePath)
}

// RegisterRoutes registers API routes (protected - requires authentication)
// Deprecated: Use RegisterRoutesWithRBAC for permission-based access control
func (m *Manager) RegisterRoutes(router *gin.RouterGroup) {
	ext := router.Group("/extensions")
	{
		ext.GET("", m.handleList)
		ext.GET("/available", m.handleListAvailable)
		ext.POST("/install", m.handleInstallFromRegistry)
		ext.GET("/:name", m.handleGet)
		ext.POST("/:name/enable", m.handleEnable)
		ext.POST("/:name/disable", m.handleDisable)
		ext.GET("/:name/config", m.handleGetConfig)
		ext.PUT("/:name/config", m.handleUpdateConfig)
		ext.DELETE("/:name", m.handleUninstall)
	}
}

// RegisterRoutesWithRBAC registers API routes with RBAC permission checks
// permissionChecker is a middleware function that checks if user has required permission
func (m *Manager) RegisterRoutesWithRBAC(router *gin.RouterGroup, permissionChecker func(resource, action string) gin.HandlerFunc) {
	ext := router.Group("/extensions")
	{
		// Read operations - all authenticated users can list/view
		ext.GET("", m.handleList)
		ext.GET("/available", m.handleListAvailable)
		ext.GET("/:name", m.handleGet)
		
		// Config read - requires extensions:read permission
		ext.GET("/:name/config", permissionChecker("extensions", "read"), m.handleGetConfig)
		
		// Management operations - requires extensions:manage permission
		ext.POST("/install", permissionChecker("extensions", "manage"), m.handleInstallFromRegistry)
		ext.POST("/upload", permissionChecker("extensions", "manage"), m.handleUploadAndInstall)
		ext.POST("/:name/enable", permissionChecker("extensions", "manage"), m.handleEnable)
		ext.POST("/:name/disable", permissionChecker("extensions", "manage"), m.handleDisable)
		ext.PUT("/:name/config", permissionChecker("extensions", "manage"), m.handleUpdateConfig)
		ext.DELETE("/:name", permissionChecker("extensions", "manage"), m.handleUninstall)
	}
}

// RegisterPublicRoutes registers public API routes (no authentication required)
// This is used for endpoints that need to be accessible before login (e.g., SSO providers)
func (m *Manager) RegisterPublicRoutes(router *gin.RouterGroup) {
	router.GET("/auth/sso/providers", m.handleGetSSOProviders)
}

// SSOProvider represents a single SSO provider for the login page
type SSOProvider struct {
	ID   string `json:"id"`
	Type string `json:"type"`
	Name string `json:"name"`
}

// SSOProviderInfo represents SSO provider information for the login page
type SSOProviderInfo struct {
	Enabled   bool          `json:"enabled"`
	Providers []SSOProvider `json:"providers"`
}

// ProviderConfigJSON represents the provider config structure for JSON parsing
type ProviderConfigJSON struct {
	ID            string `json:"id"`
	Type          string `json:"type"`
	Name          string `json:"name"`
	ClientID      string `json:"client_id"`
	ClientSecret  string `json:"client_secret"`
	AllowedDomain string `json:"allowed_domain,omitempty"`
	AllowedOrg    string `json:"allowed_org,omitempty"`
}

// handleGetSSOProviders returns available SSO providers for the login page
// This endpoint is public (no auth required) so the login page can show SSO buttons
func (m *Manager) handleGetSSOProviders(c *gin.Context) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Check if kubelens-oauth2 extension is available and running
	ext, ok := m.extensions["kubelens-oauth2"]
	if !ok {
		c.JSON(http.StatusOK, SSOProviderInfo{Enabled: false, Providers: []SSOProvider{}})
		return
	}

	// Check if extension is enabled and running
	status := m.statuses["kubelens-oauth2"]
	enabled := m.enabled["kubelens-oauth2"]

	if !enabled || status != StatusRunning {
		c.JSON(http.StatusOK, SSOProviderInfo{Enabled: false, Providers: []SSOProvider{}})
		return
	}

	// Verify the extension actually has an HTTP endpoint (Dex is running)
	endpoint, err := ext.GetHTTPEndpoint()
	if err != nil || endpoint == "" {
		c.JSON(http.StatusOK, SSOProviderInfo{Enabled: false, Providers: []SSOProvider{}})
		return
	}

	// Get config and parse providers
	config := m.configs["kubelens-oauth2"]
	providers := m.parseProvidersFromConfig(config)

	if len(providers) == 0 {
		c.JSON(http.StatusOK, SSOProviderInfo{Enabled: false, Providers: []SSOProvider{}})
		return
	}

	c.JSON(http.StatusOK, SSOProviderInfo{
		Enabled:   true,
		Providers: providers,
	})
}

// parseProvidersFromConfig parses providers from extension config
func (m *Manager) parseProvidersFromConfig(config map[string]string) []SSOProvider {
	if config == nil {
		return []SSOProvider{}
	}

	// Try new multi-provider format first
	if providersJSON := config["providers"]; providersJSON != "" {
		var providerConfigs []ProviderConfigJSON
		if err := json.Unmarshal([]byte(providersJSON), &providerConfigs); err == nil {
			providers := make([]SSOProvider, 0, len(providerConfigs))
			for _, p := range providerConfigs {
				name := p.Name
				if name == "" {
					name = "Login with " + capitalizeFirst(p.Type)
				}
				providers = append(providers, SSOProvider{
					ID:   p.ID,
					Type: p.Type,
					Name: name,
				})
			}
			return providers
		}
	}

	// Fallback to legacy single-provider format
	connectorType := config["connector_type"]
	if connectorType == "" {
		return []SSOProvider{}
	}

	connectorName := config["connector_name"]
	if connectorName == "" {
		connectorName = "Login with " + capitalizeFirst(connectorType)
	}

	return []SSOProvider{
		{
			ID:   connectorType,
			Type: connectorType,
			Name: connectorName,
		},
	}
}

// capitalizeFirst capitalizes the first letter of a string
func capitalizeFirst(s string) string {
	if s == "" {
		return s
	}
	if s[0] >= 'a' && s[0] <= 'z' {
		return string(s[0]-32) + s[1:]
	}
	return s
}

// RegisterHTTPProxies registers reverse proxy routes for extensions that expose HTTP endpoints
// This should be called with the root gin.Engine to mount routes at top level
func (m *Manager) RegisterHTTPProxies(engine *gin.Engine) {
	m.router = engine
	m.mountExtensionProxies()
}

// mountExtensionProxies sets up reverse proxies for extensions that expose HTTP endpoints
func (m *Manager) mountExtensionProxies() {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for name, ext := range m.extensions {
		if !m.enabled[name] {
			continue
		}

		endpoint, err := ext.GetHTTPEndpoint()
		if err != nil {
			log.Warnf("Failed to get HTTP endpoint for extension %s: %v", name, err)
			continue
		}

		if endpoint == "" {
			continue // Extension doesn't expose HTTP
		}

		m.setupExtensionProxy(name, endpoint)
	}
}

// setupExtensionProxy creates and registers a reverse proxy for an extension
func (m *Manager) setupExtensionProxy(name, endpoint string) {
	target, err := url.Parse("http://" + endpoint)
	if err != nil {
		log.Errorf("Failed to parse endpoint URL for extension %s: %v", name, err)
		return
	}

	proxy := httputil.NewSingleHostReverseProxy(target)

	// Custom director to handle path rewriting
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)

		// Get the mount path for this extension
		mountPath := m.getMountPath(name)

		// Strip the mount path prefix from the request
		req.URL.Path = strings.TrimPrefix(req.URL.Path, mountPath)
		if req.URL.Path == "" {
			req.URL.Path = "/"
		}

		// Update headers for proper URL reconstruction in extension
		req.Header.Set("X-Forwarded-Host", req.Host)
		req.Header.Set("X-Forwarded-Proto", "http") // TODO: detect from TLS or upstream header
		req.Header.Set("X-Original-URI", req.RequestURI)
	}

	// Custom error handler
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Errorf("Proxy error for extension %s: %v", name, err)
		http.Error(w, "Extension proxy error", http.StatusBadGateway)
	}

	m.httpProxies[name] = proxy

	// Mount the proxy route
	mountPath := m.getMountPath(name)
	if m.router != nil {
		m.router.Any(mountPath+"/*path", func(c *gin.Context) {
			proxy.ServeHTTP(c.Writer, c.Request)
		})
		// Also handle root path without trailing wildcard
		m.router.Any(mountPath, func(c *gin.Context) {
			proxy.ServeHTTP(c.Writer, c.Request)
		})
		log.Infof("Mounted HTTP proxy for extension %s at %s -> %s", name, mountPath, endpoint)
	}
}

// getMountPath returns the URL path where the extension should be mounted
func (m *Manager) getMountPath(name string) string {
	// Special case for oauth2 extension - mount at /dex for OIDC compatibility
	if name == "kubelens-oauth2" {
		return "/dex"
	}
	return "/extensions/" + name + "/proxy"
}

// GetExtensionHTTPEndpoint returns the HTTP endpoint for an extension
func (m *Manager) GetExtensionHTTPEndpoint(name string) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ext, ok := m.extensions[name]
	if !ok {
		return "", fmt.Errorf("extension not found: %s", name)
	}

	return ext.GetHTTPEndpoint()
}

func (m *Manager) handleList(c *gin.Context) {
	c.JSON(http.StatusOK, m.ListExtensions())
}

func (m *Manager) handleGet(c *gin.Context) {
	name := c.Param("name")
	info, err := m.GetExtension(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, info)
}

func (m *Manager) handleEnable(c *gin.Context) {
	name := c.Param("name")
	if err := m.EnableExtension(name); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Extension enabled"})
}

func (m *Manager) handleDisable(c *gin.Context) {
	name := c.Param("name")
	if err := m.DisableExtension(name); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Extension disabled"})
}

func (m *Manager) handleGetConfig(c *gin.Context) {
	name := c.Param("name")
	config, err := m.GetConfig(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, config)
}

func (m *Manager) handleUpdateConfig(c *gin.Context) {
	name := c.Param("name")
	
	var config map[string]string
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	if err := m.UpdateConfig(name, config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Configuration updated"})
}

func (m *Manager) handleUninstall(c *gin.Context) {
	name := c.Param("name")
	if err := m.UninstallExtension(name); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Extension uninstalled"})
}

func (m *Manager) handleListAvailable(c *gin.Context) {
	releases, err := m.ListAvailableExtensions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, releases)
}

func (m *Manager) handleInstallFromRegistry(c *gin.Context) {
	var req struct {
		Name    string `json:"name" binding:"required"`
		Version string `json:"version"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: name is required"})
		return
	}

	if err := m.InstallFromRegistry(req.Name, req.Version); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Extension %s installed successfully", req.Name)})
}

// handleUploadAndInstall handles extension installation from uploaded file
func (m *Manager) handleUploadAndInstall(c *gin.Context) {
	// Set max upload size
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxUploadSize)

	// Get the uploaded file
	file, header, err := c.Request.FormFile("extension")
	if err != nil {
		if err.Error() == "http: request body too large" {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("File too large. Maximum size is %d MB", MaxUploadSize/(1<<20))})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded. Use 'extension' as the form field name."})
		return
	}
	defer file.Close()

	// Validate file extension
	filename := header.Filename
	if !strings.HasSuffix(filename, ".tar.gz") && !strings.HasSuffix(filename, ".tgz") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file format. Only .tar.gz or .tgz files are accepted."})
		return
	}

	// Create temp directory
	tempDir, err := os.MkdirTemp("", "kubelens-ext-upload-")
	if err != nil {
		log.Errorf("Failed to create temp directory: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process upload"})
		return
	}
	defer os.RemoveAll(tempDir)

	// Save uploaded file to temp directory
	tempFile := filepath.Join(tempDir, filename)
	out, err := os.Create(tempFile)
	if err != nil {
		log.Errorf("Failed to create temp file: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process upload"})
		return
	}

	_, err = io.Copy(out, file)
	out.Close()
	if err != nil {
		log.Errorf("Failed to write temp file: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process upload"})
		return
	}

	// Install the extension from the uploaded file
	if err := m.InstallExtension(tempFile); err != nil {
		log.Errorf("Failed to install uploaded extension: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Installation failed: %s", err.Error())})
		return
	}

	// Get extension name from the installed extension (for response)
	// Try to extract the name from the manifest in the package
	extName := strings.TrimSuffix(strings.TrimSuffix(filename, ".tar.gz"), ".tgz")

	// Audit log
	m.auditLogger.Log(audit.LogEntry{
		Action:        "upload_install",
		Resource:      "extension",
		EventCategory: "system",
		Level:         "INFO",
		Description:   fmt.Sprintf("Installed extension from uploaded file: %s", filename),
		Success:       true,
	})

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Extension installed successfully from %s", filename),
		"name":    extName,
	})
}
