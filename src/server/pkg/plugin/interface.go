package plugin

import (
	"encoding/json"
	"net/rpc"

	"github.com/hashicorp/go-plugin"
)

// HandshakeConfig is the handshake configuration for the plugin
var HandshakeConfig = plugin.HandshakeConfig{
	ProtocolVersion:  1,
	MagicCookieKey:   "KUBELENS_PLUGIN",
	MagicCookieValue: "kubelens-extension-v1",
}

// Metadata represents extension metadata
type Metadata struct {
	Name             string   `json:"name"`
	Version          string   `json:"version"`
	Description      string   `json:"description"`
	Author           string   `json:"author"`
	MinServerVersion string   `json:"min_server_version"`
	Permissions      []string `json:"permissions"`
}

// UIMetadata represents UI assets and configuration
type UIMetadata struct {
	AssetsURL string `json:"assets_url"` // Local path or URL to JS bundle
	RootID    string `json:"root_id"`    // DOM ID to mount
}

// Extension is the interface that all extensions must implement
type Extension interface {
	// Init initializes the extension with configuration
	Init(config map[string]string) error

	// Start starts the extension service
	Start() error

	// Stop stops the extension service
	Stop() error

	// GetMetadata returns extension metadata
	GetMetadata() (Metadata, error)

	// GetUI returns UI configuration
	GetUI() (UIMetadata, error)

	// ValidateConfig validates configuration without applying
	ValidateConfig(config map[string]string) error

	// UpdateConfig updates configuration (hot-reload)
	UpdateConfig(config map[string]string) error

	// GetHTTPEndpoint returns internal HTTP address for reverse proxy
	// Returns empty string if extension doesn't expose HTTP
	// Example: "127.0.0.1:5556" for Dex server
	GetHTTPEndpoint() (string, error)
}

// ExtensionRPC is the RPC implementation of the Extension interface
type ExtensionRPC struct {
	client *rpc.Client
}

func (e *ExtensionRPC) Init(config map[string]string) error {
	var resp interface{}
	configBytes, _ := json.Marshal(config)
	return e.client.Call("Plugin.Init", configBytes, &resp)
}

func (e *ExtensionRPC) Start() error {
	var resp interface{}
	return e.client.Call("Plugin.Start", new(interface{}), &resp)
}

func (e *ExtensionRPC) Stop() error {
	var resp interface{}
	return e.client.Call("Plugin.Stop", new(interface{}), &resp)
}

func (e *ExtensionRPC) GetMetadata() (Metadata, error) {
	var resp Metadata
	err := e.client.Call("Plugin.GetMetadata", new(interface{}), &resp)
	return resp, err
}

func (e *ExtensionRPC) GetUI() (UIMetadata, error) {
	var resp UIMetadata
	err := e.client.Call("Plugin.GetUI", new(interface{}), &resp)
	return resp, err
}

func (e *ExtensionRPC) ValidateConfig(config map[string]string) error {
	var resp interface{}
	configBytes, _ := json.Marshal(config)
	return e.client.Call("Plugin.ValidateConfig", configBytes, &resp)
}

func (e *ExtensionRPC) UpdateConfig(config map[string]string) error {
	var resp interface{}
	configBytes, _ := json.Marshal(config)
	return e.client.Call("Plugin.UpdateConfig", configBytes, &resp)
}

func (e *ExtensionRPC) GetHTTPEndpoint() (string, error) {
	var resp string
	err := e.client.Call("Plugin.GetHTTPEndpoint", new(interface{}), &resp)
	return resp, err
}

// ExtensionRPCServer is the RPC server implementation
type ExtensionRPCServer struct {
	Impl Extension
}

func (s *ExtensionRPCServer) Init(args []byte, resp *interface{}) error {
	var config map[string]string
	if err := json.Unmarshal(args, &config); err != nil {
		return err
	}
	return s.Impl.Init(config)
}

func (s *ExtensionRPCServer) Start(args interface{}, resp *interface{}) error {
	return s.Impl.Start()
}

func (s *ExtensionRPCServer) Stop(args interface{}, resp *interface{}) error {
	return s.Impl.Stop()
}

func (s *ExtensionRPCServer) GetMetadata(args interface{}, resp *Metadata) error {
	meta, err := s.Impl.GetMetadata()
	*resp = meta
	return err
}

func (s *ExtensionRPCServer) GetUI(args interface{}, resp *UIMetadata) error {
	ui, err := s.Impl.GetUI()
	*resp = ui
	return err
}

func (s *ExtensionRPCServer) ValidateConfig(args []byte, resp *interface{}) error {
	var config map[string]string
	if err := json.Unmarshal(args, &config); err != nil {
		return err
	}
	return s.Impl.ValidateConfig(config)
}

func (s *ExtensionRPCServer) UpdateConfig(args []byte, resp *interface{}) error {
	var config map[string]string
	if err := json.Unmarshal(args, &config); err != nil {
		return err
	}
	return s.Impl.UpdateConfig(config)
}

func (s *ExtensionRPCServer) GetHTTPEndpoint(args interface{}, resp *string) error {
	endpoint, err := s.Impl.GetHTTPEndpoint()
	*resp = endpoint
	return err
}

// ExtensionPlugin is the go-plugin implementation
type ExtensionPlugin struct {
	Impl Extension
}

func (p *ExtensionPlugin) Server(*plugin.MuxBroker) (interface{}, error) {
	return &ExtensionRPCServer{Impl: p.Impl}, nil
}

func (p *ExtensionPlugin) Client(b *plugin.MuxBroker, c *rpc.Client) (interface{}, error) {
	return &ExtensionRPC{client: c}, nil
}
