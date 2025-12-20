package dex

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// ProviderConfig represents a single identity provider configuration
// This mirrors the struct in main.go for JSON parsing
type ProviderConfig struct {
	ID            string `json:"id"`
	Type          string `json:"type"`
	Name          string `json:"name"`
	ClientID      string `json:"client_id"`
	ClientSecret  string `json:"client_secret"`
	AllowedDomain string `json:"allowed_domain,omitempty"`
	AllowedOrg    string `json:"allowed_org,omitempty"`
	BaseURL       string `json:"base_url,omitempty"`
	Tenant        string `json:"tenant,omitempty"`
	IssuerURL     string `json:"issuer_url,omitempty"`
}

// Config represents the Dex configuration file structure
type Config struct {
	Issuer  string  `yaml:"issuer"`
	Storage Storage `yaml:"storage"`
	Web     Web     `yaml:"web"`
	// Telemetry   Telemetry    `yaml:"telemetry,omitempty"`
	OAuth2      OAuth2       `yaml:"oauth2"`
	StaticClients []StaticClient `yaml:"staticClients"`
	Connectors  []Connector  `yaml:"connectors"`
	EnablePasswordDB bool `yaml:"enablePasswordDB,omitempty"`
}

// Storage represents storage configuration
type Storage struct {
	Type   string            `yaml:"type"`
	Config map[string]string `yaml:"config,omitempty"`
}

// Web represents web server configuration
type Web struct {
	HTTP           string `yaml:"http,omitempty"`
	HTTPS          string `yaml:"https,omitempty"`
	TLSCert        string `yaml:"tlsCert,omitempty"`
	TLSKey         string `yaml:"tlsKey,omitempty"`
	AllowedOrigins []string `yaml:"allowedOrigins,omitempty"`
}

// Telemetry represents telemetry configuration
type Telemetry struct {
	HTTP string `yaml:"http,omitempty"`
}

// OAuth2 represents OAuth2 configuration
type OAuth2 struct {
	SkipApprovalScreen  bool     `yaml:"skipApprovalScreen,omitempty"`
	AlwaysShowLoginScreen bool   `yaml:"alwaysShowLoginScreen,omitempty"`
	ResponseTypes       []string `yaml:"responseTypes,omitempty"`
}

// StaticClient represents a static OAuth2 client
type StaticClient struct {
	ID           string   `yaml:"id"`
	Secret       string   `yaml:"secret"`
	Name         string   `yaml:"name"`
	RedirectURIs []string `yaml:"redirectURIs"`
	Public       bool     `yaml:"public,omitempty"`
}

// Connector represents an identity provider connector
type Connector struct {
	Type   string      `yaml:"type"`
	ID     string      `yaml:"id"`
	Name   string      `yaml:"name"`
	Config interface{} `yaml:"config"`
}

// GitHubConnectorConfig represents GitHub connector configuration
type GitHubConnectorConfig struct {
	ClientID     string   `yaml:"clientID"`
	ClientSecret string   `yaml:"clientSecret"`
	RedirectURI  string   `yaml:"redirectURI"`
	Orgs         []GitHubOrg `yaml:"orgs,omitempty"`
	LoadAllGroups bool    `yaml:"loadAllGroups,omitempty"`
	TeamNameField string  `yaml:"teamNameField,omitempty"`
	UseLoginAsID  bool    `yaml:"useLoginAsID,omitempty"`
}

// GitHubOrg represents a GitHub organization filter
type GitHubOrg struct {
	Name  string   `yaml:"name"`
	Teams []string `yaml:"teams,omitempty"`
}

// GoogleConnectorConfig represents Google connector configuration
type GoogleConnectorConfig struct {
	ClientID     string   `yaml:"clientID"`
	ClientSecret string   `yaml:"clientSecret"`
	RedirectURI  string   `yaml:"redirectURI"`
	HostedDomains []string `yaml:"hostedDomains,omitempty"`
	Groups        []string `yaml:"groups,omitempty"`
	ServiceAccountFilePath string `yaml:"serviceAccountFilePath,omitempty"`
	AdminEmail    string   `yaml:"adminEmail,omitempty"`
}

// GitLabConnectorConfig represents GitLab connector configuration
type GitLabConnectorConfig struct {
	ClientID     string   `yaml:"clientID"`
	ClientSecret string   `yaml:"clientSecret"`
	RedirectURI  string   `yaml:"redirectURI"`
	BaseURL      string   `yaml:"baseURL,omitempty"`
	Groups       []string `yaml:"groups,omitempty"`
	UseLoginAsID bool     `yaml:"useLoginAsID,omitempty"`
}

// MicrosoftConnectorConfig represents Microsoft connector configuration
type MicrosoftConnectorConfig struct {
	ClientID     string   `yaml:"clientID"`
	ClientSecret string   `yaml:"clientSecret"`
	RedirectURI  string   `yaml:"redirectURI"`
	Tenant       string   `yaml:"tenant,omitempty"`
	OnlySecurityGroups bool `yaml:"onlySecurityGroups,omitempty"`
	Groups       []string `yaml:"groups,omitempty"`
}

// LDAPConnectorConfig represents LDAP connector configuration
type LDAPConnectorConfig struct {
	Host               string `yaml:"host"`
	InsecureNoSSL      bool   `yaml:"insecureNoSSL,omitempty"`
	InsecureSkipVerify bool   `yaml:"insecureSkipVerify,omitempty"`
	StartTLS           bool   `yaml:"startTLS,omitempty"`
	RootCA             string `yaml:"rootCA,omitempty"`
	BindDN             string `yaml:"bindDN"`
	BindPW             string `yaml:"bindPW"`
	UsernamePrompt     string `yaml:"usernamePrompt,omitempty"`
	UserSearch         LDAPUserSearch  `yaml:"userSearch"`
	GroupSearch        LDAPGroupSearch `yaml:"groupSearch,omitempty"`
}

// LDAPUserSearch represents LDAP user search configuration
type LDAPUserSearch struct {
	BaseDN    string `yaml:"baseDN"`
	Filter    string `yaml:"filter,omitempty"`
	Username  string `yaml:"username"`
	IDAttr    string `yaml:"idAttr"`
	EmailAttr string `yaml:"emailAttr"`
	NameAttr  string `yaml:"nameAttr,omitempty"`
}

// LDAPGroupSearch represents LDAP group search configuration
type LDAPGroupSearch struct {
	BaseDN    string `yaml:"baseDN"`
	Filter    string `yaml:"filter,omitempty"`
	UserMatchers []LDAPUserMatcher `yaml:"userMatchers,omitempty"`
	NameAttr  string `yaml:"nameAttr"`
}

// LDAPUserMatcher represents LDAP user matcher
type LDAPUserMatcher struct {
	UserAttr  string `yaml:"userAttr"`
	GroupAttr string `yaml:"groupAttr"`
}

// OIDCConnectorConfig represents generic OIDC connector configuration
type OIDCConnectorConfig struct {
	Issuer       string   `yaml:"issuer"`
	ClientID     string   `yaml:"clientID"`
	ClientSecret string   `yaml:"clientSecret"`
	RedirectURI  string   `yaml:"redirectURI"`
	Scopes       []string `yaml:"scopes,omitempty"`
	GetUserInfo  bool     `yaml:"getUserInfo,omitempty"`
	InsecureSkipEmailVerified bool `yaml:"insecureSkipEmailVerified,omitempty"`
}

// ConfigGenerator generates Dex configuration from extension settings
type ConfigGenerator struct {
	dataDir string
}

// NewConfigGenerator creates a new config generator
func NewConfigGenerator(dataDir string) *ConfigGenerator {
	return &ConfigGenerator{
		dataDir: dataDir,
	}
}

// GetConfigPath returns the path to the Dex config file
func (g *ConfigGenerator) GetConfigPath() string {
	return filepath.Join(g.dataDir, "dex-config.yaml")
}

// Default values - auto-configured, no user input needed
const (
	// Public URL (through Kubelens proxy) - OAuth2 is accessible via /api/v1/auth/oauth path
	DefaultIssuerURL = "http://localhost:8080/api/v1/auth/oauth"
	// Frontend callback URL - redirects to /login page which handles OAuth callback
	DefaultRedirectURI = "http://localhost:8080/login"
	// Static client for Kubelens
	DefaultClientID     = "kubelens"
	DefaultClientSecret = "kubelens-secret" // Internal secret between Kubelens and Dex
)

// Generate generates Dex configuration from extension config map
// Auto-configures internal Dex settings, supports multiple providers
func (g *ConfigGenerator) Generate(extConfig map[string]string) (*Config, error) {
	// Auto-configured values (user doesn't need to set these)
	issuerURL := DefaultIssuerURL
	clientID := DefaultClientID
	clientSecret := DefaultClientSecret
	redirectURI := DefaultRedirectURI

	// Priority 1: Use public_url if provided (injected by extension manager)
	if publicURL := extConfig["public_url"]; publicURL != "" {
		// Trim trailing slash for consistency
		publicURL = strings.TrimSuffix(publicURL, "/")
		issuerURL = publicURL + "/api/v1/auth/oauth"
		redirectURI = publicURL + "/login"
	}

	// Priority 2: Allow explicit override via issuer_url/redirect_uri if needed
	if val := extConfig["issuer_url"]; val != "" {
		issuerURL = val
	}
	if val := extConfig["redirect_uri"]; val != "" {
		redirectURI = val
	}

	config := &Config{
		Issuer: issuerURL,
		Storage: Storage{
			Type: "sqlite3",
			Config: map[string]string{
				"file": filepath.Join(g.dataDir, "dex.db"),
			},
		},
		Web: Web{
			HTTP: InternalDexAddress, // Bind to internal address only
		},
		OAuth2: OAuth2{
			SkipApprovalScreen: true,
			ResponseTypes:      []string{"code"},
		},
		StaticClients: []StaticClient{
			{
				ID:           clientID,
				Secret:       clientSecret,
				Name:         "Kubelens",
				RedirectURIs: []string{redirectURI},
			},
		},
		EnablePasswordDB: false,
	}

	// Try to parse multi-provider config first
	if providersJSON := extConfig["providers"]; providersJSON != "" {
		connectors, err := g.buildConnectorsFromProviders(providersJSON, issuerURL)
		if err != nil {
			return nil, fmt.Errorf("failed to build connectors from providers: %w", err)
		}
		config.Connectors = connectors
	} else {
		// Backward compatibility: build single connector from legacy config
		connector, err := g.buildConnectorLegacy(extConfig, issuerURL)
		if err != nil {
			return nil, err
		}
		if connector != nil {
			config.Connectors = []Connector{*connector}
		}
	}

	return config, nil
}

// buildConnectorsFromProviders builds multiple connectors from providers JSON array
func (g *ConfigGenerator) buildConnectorsFromProviders(providersJSON string, issuerURL string) ([]Connector, error) {
	var providers []ProviderConfig
	if err := json.Unmarshal([]byte(providersJSON), &providers); err != nil {
		return nil, fmt.Errorf("failed to parse providers JSON: %w", err)
	}

	if len(providers) == 0 {
		return []Connector{}, nil
	}

	connectors := make([]Connector, 0, len(providers))
	for _, provider := range providers {
		connector, err := g.buildConnectorFromProvider(provider, issuerURL)
		if err != nil {
			return nil, fmt.Errorf("failed to build connector for provider '%s': %w", provider.ID, err)
		}
		connectors = append(connectors, *connector)
	}

	return connectors, nil
}

// buildConnectorFromProvider builds a single connector from ProviderConfig
func (g *ConfigGenerator) buildConnectorFromProvider(provider ProviderConfig, issuerURL string) (*Connector, error) {
	connectorID := provider.ID
	connectorType := provider.Type
	connectorName := provider.Name

	if connectorName == "" {
		connectorName = fmt.Sprintf("Login with %s", capitalizeFirst(connectorType))
	}

	redirectURI := fmt.Sprintf("%s/callback", issuerURL)

	var connConfig interface{}

	switch connectorType {
	case "github":
		config := &GitHubConnectorConfig{
			ClientID:      provider.ClientID,
			ClientSecret:  provider.ClientSecret,
			RedirectURI:   redirectURI,
			LoadAllGroups: true,
			UseLoginAsID:  true,
		}
		if provider.AllowedOrg != "" {
			config.Orgs = []GitHubOrg{{Name: provider.AllowedOrg}}
		}
		connConfig = config

	case "google":
		config := &GoogleConnectorConfig{
			ClientID:     provider.ClientID,
			ClientSecret: provider.ClientSecret,
			RedirectURI:  redirectURI,
		}
		if provider.AllowedDomain != "" {
			config.HostedDomains = []string{provider.AllowedDomain}
		}
		connConfig = config

	case "gitlab":
		config := &GitLabConnectorConfig{
			ClientID:     provider.ClientID,
			ClientSecret: provider.ClientSecret,
			RedirectURI:  redirectURI,
			UseLoginAsID: true,
		}
		if provider.BaseURL != "" {
			config.BaseURL = provider.BaseURL
		}
		connConfig = config

	case "microsoft":
		config := &MicrosoftConnectorConfig{
			ClientID:     provider.ClientID,
			ClientSecret: provider.ClientSecret,
			RedirectURI:  redirectURI,
			Tenant:       "common",
		}
		if provider.Tenant != "" {
			config.Tenant = provider.Tenant
		} else if provider.AllowedDomain != "" {
			config.Tenant = provider.AllowedDomain
		}
		connConfig = config

	case "oidc":
		if provider.IssuerURL == "" {
			return nil, fmt.Errorf("OIDC provider requires issuer_url")
		}
		config := &OIDCConnectorConfig{
			Issuer:       provider.IssuerURL,
			ClientID:     provider.ClientID,
			ClientSecret: provider.ClientSecret,
			RedirectURI:  redirectURI,
			Scopes:       []string{"openid", "profile", "email", "groups"},
			GetUserInfo:  true,
		}
		connConfig = config

	default:
		return nil, fmt.Errorf("unsupported connector type: %s", connectorType)
	}

	return &Connector{
		Type:   connectorType,
		ID:     connectorID,
		Name:   connectorName,
		Config: connConfig,
	}, nil
}

// buildConnectorLegacy builds a connector from legacy single-provider config format
// Used for backward compatibility with old config format
func (g *ConfigGenerator) buildConnectorLegacy(extConfig map[string]string, issuerURL string) (*Connector, error) {
	connectorType := extConfig["connector_type"]
	if connectorType == "" {
		return nil, nil // No provider configured
	}

	// Convert legacy config to ProviderConfig
	provider := ProviderConfig{
		ID:            connectorType,
		Type:          connectorType,
		Name:          extConfig["connector_name"],
		ClientID:      extConfig["provider_client_id"],
		ClientSecret:  extConfig["provider_client_secret"],
		AllowedDomain: extConfig["allowed_domain"],
		AllowedOrg:    extConfig["allowed_org"],
	}

	return g.buildConnectorFromProvider(provider, issuerURL)
}

// capitalizeFirst capitalizes the first letter of a string
func capitalizeFirst(s string) string {
	if s == "" {
		return s
	}
	return string(s[0]-32) + s[1:]
}

// WriteConfig writes the Dex configuration to file
func (g *ConfigGenerator) WriteConfig(config *Config) error {
	if err := os.MkdirAll(g.dataDir, 0755); err != nil {
		return fmt.Errorf("failed to create data directory: %w", err)
	}

	data, err := yaml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	configPath := g.GetConfigPath()
	if err := os.WriteFile(configPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// GenerateAndWrite generates and writes Dex configuration
func (g *ConfigGenerator) GenerateAndWrite(extConfig map[string]string) error {
	config, err := g.Generate(extConfig)
	if err != nil {
		return err
	}
	return g.WriteConfig(config)
}
