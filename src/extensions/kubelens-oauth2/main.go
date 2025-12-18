package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/hashicorp/go-plugin"
	kbplugin "github.com/sonnguyen/kubelens/pkg/plugin"
	"github.com/sonnguyen/kubelens-oauth2/dex"
)

// ConfigField represents a configuration field schema
type ConfigField struct {
	Key         string   `json:"key"`
	Label       string   `json:"label"`
	Description string   `json:"description"`
	Type        string   `json:"type"` // text, password, select
	Required    bool     `json:"required"`
	Options     []string `json:"options,omitempty"` // for select type
	Default     string   `json:"default,omitempty"`
}

// ProviderConfig represents a single identity provider configuration
type ProviderConfig struct {
	ID            string `json:"id"`                       // Unique ID (e.g., "github-main")
	Type          string `json:"type"`                     // github, google, gitlab, microsoft, oidc
	Name          string `json:"name"`                     // Display name ("GitHub Corporate")
	ClientID      string `json:"client_id"`                // OAuth2 Client ID
	ClientSecret  string `json:"client_secret"`            // OAuth2 Client Secret
	AllowedDomain string `json:"allowed_domain,omitempty"` // Restrict to domain (Google Workspace) or Azure AD tenant
	AllowedOrg    string `json:"allowed_org,omitempty"`    // Restrict to organization members (GitHub/GitLab)
	BaseURL       string `json:"base_url,omitempty"`       // For GitLab self-hosted
	Tenant        string `json:"tenant,omitempty"`         // For Microsoft Azure AD
	IssuerURL     string `json:"issuer_url,omitempty"`     // For generic OIDC
}

// ParseProviders parses the providers JSON array from config
func ParseProviders(config map[string]string) ([]ProviderConfig, error) {
	providersJSON := config["providers"]
	if providersJSON == "" {
		// Backward compatibility: convert old single-provider config to new format
		if config["connector_type"] != "" && config["provider_client_id"] != "" {
			provider := ProviderConfig{
				ID:            config["connector_type"],
				Type:          config["connector_type"],
				Name:          config["connector_name"],
				ClientID:      config["provider_client_id"],
				ClientSecret:  config["provider_client_secret"],
				AllowedDomain: config["allowed_domain"],
				AllowedOrg:    config["allowed_org"],
			}
			if provider.Name == "" {
				provider.Name = "Login with " + capitalizeFirst(provider.Type)
			}
			return []ProviderConfig{provider}, nil
		}
		return []ProviderConfig{}, nil
	}

	var providers []ProviderConfig
	if err := json.Unmarshal([]byte(providersJSON), &providers); err != nil {
		return nil, fmt.Errorf("failed to parse providers config: %w", err)
	}
	return providers, nil
}

// SerializeProviders serializes providers to JSON string for storage
func SerializeProviders(providers []ProviderConfig) (string, error) {
	data, err := json.Marshal(providers)
	if err != nil {
		return "", fmt.Errorf("failed to serialize providers: %w", err)
	}
	return string(data), nil
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

// OAuth2Extension implements the Extension interface for OAuth2/OIDC
type OAuth2Extension struct {
	config       map[string]string
	dexServer    *dex.RealDexServer
	configGen    *dex.ConfigGenerator
	dataDir      string
	mu           sync.RWMutex
	logMu        sync.Mutex // separate mutex for log buffer
	logBuffer    []dex.LogEntry
	maxLogBuffer int
}

// NewOAuth2Extension creates a new OAuth2 extension
func NewOAuth2Extension() *OAuth2Extension {
	dataDir := os.Getenv("EXTENSION_DATA_DIR")
	if dataDir == "" {
		dataDir = "/data/extensions/kubelens-oauth2/data"
	}

	return &OAuth2Extension{
		dataDir:      dataDir,
		configGen:    dex.NewConfigGenerator(dataDir),
		maxLogBuffer: 500,
		logBuffer:    make([]dex.LogEntry, 0),
	}
}

// GetConfigSchema returns the configuration schema for this extension
// Now supports multiple providers stored as JSON array
func (e *OAuth2Extension) GetConfigSchema() []ConfigField {
	return []ConfigField{
		// Multi-provider config is stored as JSON array in "providers" key
		// The frontend will handle this specially with a provider list UI
		{
			Key:         "providers",
			Label:       "Identity Providers",
			Description: "Configure multiple SSO providers (stored as JSON array)",
			Type:        "providers", // Special type for multi-provider UI
			Required:    false,
		},
	}
}

// GetProviderTypes returns the list of supported provider types
func (e *OAuth2Extension) GetProviderTypes() []string {
	return []string{"github", "google", "gitlab", "microsoft", "oidc"}
}

func (e *OAuth2Extension) logHandler(entry dex.LogEntry) {
	// Use separate mutex for log buffer to avoid deadlock
	e.logMu.Lock()
	e.logBuffer = append(e.logBuffer, entry)
	if len(e.logBuffer) > e.maxLogBuffer {
		e.logBuffer = e.logBuffer[1:]
	}
	e.logMu.Unlock()

	// Print to stderr for go-plugin to capture
	levelStr := "INFO"
	switch entry.Level {
	case dex.LogError:
		levelStr = "ERROR"
	case dex.LogWarn:
		levelStr = "WARN"
	case dex.LogDebug:
		levelStr = "DEBUG"
	}
	fmt.Fprintf(os.Stderr, "[%s] %s: %s\n", entry.Timestamp.Format("2006-01-02 15:04:05"), levelStr, entry.Message)
}

func (e *OAuth2Extension) Init(config map[string]string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.config = config
	if e.config == nil {
		e.config = make(map[string]string)
	}

	// Create data directory
	if err := os.MkdirAll(e.dataDir, 0755); err != nil {
		return fmt.Errorf("failed to create data directory: %w", err)
	}

	// Parse and validate providers
	providers, err := ParseProviders(e.config)
	if err != nil {
		e.logHandler(dex.LogEntry{Level: dex.LogWarn, Message: fmt.Sprintf("Failed to parse providers: %v", err)})
	} else {
		e.logHandler(dex.LogEntry{Level: dex.LogInfo, Message: fmt.Sprintf("OAuth2 Extension initialized with %d provider(s)", len(providers))})
	}

	e.logHandler(dex.LogEntry{Level: dex.LogInfo, Message: fmt.Sprintf("OAuth2 Extension initialized with data dir: %s", e.dataDir)})

	return nil
}

func (e *OAuth2Extension) Start() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.logHandler(dex.LogEntry{Level: dex.LogInfo, Message: "Starting OAuth2 Extension..."})

	// Generate Dex configuration
	dexConfig, err := e.configGen.Generate(e.config)
	if err != nil {
		e.logHandler(dex.LogEntry{Level: dex.LogError, Message: fmt.Sprintf("Failed to generate Dex config: %v", err)})
		return fmt.Errorf("failed to generate config: %w", err)
	}

	// Write config to file for debugging
	if err := e.configGen.WriteConfig(dexConfig); err != nil {
		e.logHandler(dex.LogEntry{Level: dex.LogWarn, Message: fmt.Sprintf("Failed to write config file: %v", err)})
	}

	// Create and start real Dex server
	dexServer, err := dex.NewRealDexServer(dexConfig, e.logHandler)
	if err != nil {
		e.logHandler(dex.LogEntry{Level: dex.LogError, Message: fmt.Sprintf("Failed to create Dex server: %v", err)})
		return fmt.Errorf("failed to create Dex server: %w", err)
	}

	if err := dexServer.Start(); err != nil {
		e.logHandler(dex.LogEntry{Level: dex.LogError, Message: fmt.Sprintf("Failed to start Dex server: %v", err)})
		return fmt.Errorf("failed to start Dex: %w", err)
	}

	e.dexServer = dexServer

	issuerURL := dexConfig.Issuer
	if issuerURL == "" {
		issuerURL = dex.DefaultIssuerURL
	}
	e.logHandler(dex.LogEntry{Level: dex.LogInfo, Message: fmt.Sprintf("OAuth2 Extension started. Issuer: %s, Internal: %s", issuerURL, dexServer.GetAddress())})

	return nil
}

func (e *OAuth2Extension) Stop() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.logHandler(dex.LogEntry{Level: dex.LogInfo, Message: "Stopping OAuth2 Extension..."})

	if e.dexServer != nil {
		if err := e.dexServer.Stop(); err != nil {
			e.logHandler(dex.LogEntry{Level: dex.LogError, Message: fmt.Sprintf("Error stopping Dex server: %v", err)})
			return err
		}
		e.dexServer = nil
	}

	e.logHandler(dex.LogEntry{Level: dex.LogInfo, Message: "OAuth2 Extension stopped"})
	return nil
}

func (e *OAuth2Extension) GetMetadata() (kbplugin.Metadata, error) {
	return kbplugin.Metadata{
		Name:             "kubelens-oauth2",
		Version:          "0.2.0",
		Description:      "OAuth2/OIDC Provider - enables SSO login with GitHub, Google, GitLab, Microsoft, LDAP, and more",
		Author:           "Kubelens Team",
		MinServerVersion: "1.0.0",
		Permissions:      []string{"manage_auth", "manage_users"},
	}, nil
}

func (e *OAuth2Extension) GetUI() (kbplugin.UIMetadata, error) {
	return kbplugin.UIMetadata{
		AssetsURL: "/extensions/kubelens-oauth2/ui",
		RootID:    "oauth2-root",
	}, nil
}

func (e *OAuth2Extension) ValidateConfig(config map[string]string) error {
	// Parse providers from config
	providers, err := ParseProviders(config)
	if err != nil {
		return fmt.Errorf("failed to parse providers: %w", err)
	}

	// Allow empty providers (extension can run without providers configured)
	if len(providers) == 0 {
		return nil
	}

	// Valid provider types
	validTypes := map[string]bool{
		"github":    true,
		"google":    true,
		"gitlab":    true,
		"microsoft": true,
		"oidc":      true,
	}

	// Track unique IDs
	seenIDs := make(map[string]bool)

	for i, provider := range providers {
		// Validate ID
		if provider.ID == "" {
			return fmt.Errorf("provider %d: ID is required", i+1)
		}
		if seenIDs[provider.ID] {
			return fmt.Errorf("provider %d: duplicate ID '%s'", i+1, provider.ID)
		}
		seenIDs[provider.ID] = true

		// Validate type
		if provider.Type == "" {
			return fmt.Errorf("provider '%s': type is required", provider.ID)
		}
		if !validTypes[provider.Type] {
			return fmt.Errorf("provider '%s': invalid type '%s'", provider.ID, provider.Type)
		}

		// Validate credentials
		if provider.ClientID == "" {
			return fmt.Errorf("provider '%s': client_id is required", provider.ID)
		}
		if provider.ClientSecret == "" {
			return fmt.Errorf("provider '%s': client_secret is required", provider.ID)
		}

		// Type-specific validation
		if provider.Type == "oidc" && provider.IssuerURL == "" {
			return fmt.Errorf("provider '%s': issuer_url is required for OIDC provider", provider.ID)
		}
	}

	return nil
}

func (e *OAuth2Extension) UpdateConfig(config map[string]string) error {
	if err := e.ValidateConfig(config); err != nil {
		return err
	}

	e.mu.Lock()
	e.config = config
	e.mu.Unlock()

	// Parse providers for logging
	providers, _ := ParseProviders(config)
	e.logHandler(dex.LogEntry{Level: dex.LogInfo, Message: fmt.Sprintf("Configuration updated. %d provider(s) configured", len(providers))})

	// If Dex is running, update its configuration
	if e.dexServer != nil {
		dexConfig, err := e.configGen.Generate(config)
		if err != nil {
			return fmt.Errorf("failed to generate config: %w", err)
		}

		// Write config file
		if err := e.configGen.WriteConfig(dexConfig); err != nil {
			e.logHandler(dex.LogEntry{Level: dex.LogWarn, Message: fmt.Sprintf("Failed to write config file: %v", err)})
		}

		// Update Dex server configuration
		e.dexServer.UpdateConfig(dexConfig)

		e.logHandler(dex.LogEntry{Level: dex.LogInfo, Message: "Dex configuration updated successfully"})
	}

	return nil
}

// GetProviders returns the list of configured providers
func (e *OAuth2Extension) GetProviders() ([]ProviderConfig, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	return ParseProviders(e.config)
}

// GetLogs returns recent log entries
func (e *OAuth2Extension) GetLogs(count int) []dex.LogEntry {
	e.logMu.Lock()
	defer e.logMu.Unlock()

	if count <= 0 || count > len(e.logBuffer) {
		count = len(e.logBuffer)
	}

	start := len(e.logBuffer) - count
	result := make([]dex.LogEntry, count)
	copy(result, e.logBuffer[start:])
	return result
}

// GetStatus returns the current status of the extension
func (e *OAuth2Extension) GetStatus() map[string]interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()

	status := map[string]interface{}{
		"dataDir":    e.dataDir,
		"configPath": filepath.Join(e.dataDir, "dex-config.yaml"),
	}

	if e.dexServer != nil {
		status["dexState"] = e.dexServer.GetState().String()
		status["dexAddress"] = e.dexServer.GetAddress()
		if err := e.dexServer.GetLastError(); err != nil {
			status["lastError"] = err.Error()
		}
	} else {
		status["dexState"] = "not_started"
	}

	// Parse and include provider count
	providers, err := ParseProviders(e.config)
	if err == nil {
		status["providerCount"] = len(providers)
		providerTypes := make([]string, len(providers))
		for i, p := range providers {
			providerTypes[i] = p.Type
		}
		status["providerTypes"] = providerTypes
	}

	return status
}

// GetHTTPEndpoint returns the internal HTTP address for reverse proxy
func (e *OAuth2Extension) GetHTTPEndpoint() (string, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	if e.dexServer == nil {
		return "", nil
	}
	return e.dexServer.GetAddress(), nil
}

func main() {
	plugin.Serve(&plugin.ServeConfig{
		HandshakeConfig: kbplugin.HandshakeConfig,
		Plugins: map[string]plugin.Plugin{
			"extension": &kbplugin.ExtensionPlugin{Impl: NewOAuth2Extension()},
		},
	})
}
