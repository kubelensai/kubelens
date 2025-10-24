package cluster

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sync"

	log "github.com/sirupsen/logrus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/dynamic"
	metricsclientset "k8s.io/metrics/pkg/client/clientset/versioned"
	apiextensionsclientset "k8s.io/apiextensions-apiserver/pkg/client/clientset/clientset"

	"github.com/sonnguyen/kubelens/internal/config"
	"github.com/sonnguyen/kubelens/internal/db"
)

// Manager manages multiple Kubernetes cluster connections
type Manager struct {
	db                   *db.DB
	clients              map[string]*kubernetes.Clientset
	dynamicClients       map[string]dynamic.Interface
	apiextensionsClients map[string]*apiextensionsclientset.Clientset
	configs              map[string]*rest.Config
	mu                   sync.RWMutex
}

// ClusterInfo holds cluster information
type ClusterInfo struct {
	Name      string                 `json:"name"`
	Version   string                 `json:"version"`
	Status    string                 `json:"status"`
	IsDefault bool                   `json:"is_default"`
	Enabled   bool                   `json:"enabled"`
	Metadata  map[string]interface{} `json:"metadata"`
}

// NewManager creates a new cluster manager
func NewManager(database *db.DB) *Manager {
	return &Manager{
		db:                   database,
		clients:              make(map[string]*kubernetes.Clientset),
		dynamicClients:       make(map[string]dynamic.Interface),
		apiextensionsClients: make(map[string]*apiextensionsclientset.Clientset),
		configs:              make(map[string]*rest.Config),
	}
}

// LoadFromConfig loads clusters from configuration
func (m *Manager) LoadFromConfig(cfg *config.Config) error {
	// NOTE: Auto-loading from kubeconfig is DISABLED
	// Clusters must be imported via UI with server/ca/token or kubeconfig
	// This ensures all clusters are stored in database with proper schema
	
	// Legacy code (disabled):
	// if cfg.KubeConfig != "" {
	// 	if err := m.AddClusterFromKubeconfig("default", cfg.KubeConfig, ""); err != nil {
	// 		log.Warnf("Failed to load default kubeconfig: %v", err)
	// 	}
	// }

	// Load clusters from database
	dbClusters, err := m.db.ListEnabledClusters()
	if err != nil {
		return err
	}

	for _, dbCluster := range dbClusters {
		if _, exists := m.clients[dbCluster.Name]; !exists {
			var loadErr error

			// Load based on auth_type
			switch dbCluster.AuthType {
			case "kubeconfig":
				// Parse auth_config JSON to extract kubeconfig
				var authConfig map[string]string
				if err := json.Unmarshal([]byte(dbCluster.AuthConfig), &authConfig); err != nil {
					log.Errorf("Failed to parse auth_config for cluster %s: %v", dbCluster.Name, err)
					m.db.UpdateClusterStatus(dbCluster.Name, "error")
					continue
				}

				kubeconfigContent := authConfig["kubeconfig"]
				context := authConfig["context"]

				if kubeconfigContent != "" {
					loadErr = m.AddClusterFromKubeconfigContent(dbCluster.Name, kubeconfigContent, context)
				} else {
					log.Errorf("Empty kubeconfig for cluster %s", dbCluster.Name)
					m.db.UpdateClusterStatus(dbCluster.Name, "error")
					continue
				}

			case "token":
				// Use extracted server/ca/token fields
				if dbCluster.Server != "" && dbCluster.CA != "" && dbCluster.Token != "" {
					loadErr = m.AddClusterFromConfig(dbCluster.Name, dbCluster.Server, dbCluster.CA, dbCluster.Token)
				} else {
					log.Errorf("Missing server/ca/token for cluster %s", dbCluster.Name)
					m.db.UpdateClusterStatus(dbCluster.Name, "error")
					continue
				}

			default:
				log.Warnf("Unsupported auth_type '%s' for cluster %s", dbCluster.AuthType, dbCluster.Name)
				m.db.UpdateClusterStatus(dbCluster.Name, "error")
				continue
			}

			// Update status based on load result
			if loadErr != nil {
				log.Warnf("Failed to load cluster %s from database: %v", dbCluster.Name, loadErr)
				m.db.UpdateClusterStatus(dbCluster.Name, "error")
			} else {
				log.Infof("Successfully loaded cluster %s (auth_type: %s)", dbCluster.Name, dbCluster.AuthType)
				m.db.UpdateClusterStatus(dbCluster.Name, "connected")
			}
		}
	}

	return nil
}

// AddClusterFromKubeconfig adds a cluster from a kubeconfig file
func (m *Manager) AddClusterFromKubeconfig(name, kubeconfigPath, kubeContext string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Build config from kubeconfig
	loadingRules := &clientcmd.ClientConfigLoadingRules{ExplicitPath: kubeconfigPath}
	configOverrides := &clientcmd.ConfigOverrides{}

	if kubeContext != "" {
		configOverrides.CurrentContext = kubeContext
	}

	kubeConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)

	config, err := kubeConfig.ClientConfig()
	if err != nil {
		return fmt.Errorf("failed to build config: %w", err)
	}

	// Create clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create clientset: %w", err)
	}

	// Create dynamic client
	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create dynamic client: %w", err)
	}

	// Create apiextensions clientset
	apiextensionsClient, err := apiextensionsclientset.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create apiextensions clientset: %w", err)
	}

	// Test connection
	_, err = clientset.ServerVersion()
	if err != nil {
		return fmt.Errorf("failed to connect to cluster: %w", err)
	}

	m.clients[name] = clientset
	m.dynamicClients[name] = dynamicClient
	m.apiextensionsClients[name] = apiextensionsClient
	m.configs[name] = config

	log.Infof("Successfully added cluster: %s", name)

	return nil
}

// AddClusterFromConfig adds a cluster from server, CA, and token
func (m *Manager) AddClusterFromConfig(name, server, ca, token string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Decode base64 CA certificate
	caDecoded, err := base64.StdEncoding.DecodeString(ca)
	if err != nil {
		return fmt.Errorf("failed to decode CA certificate (expected base64): %w", err)
	}

	// Decode base64 token
	tokenDecoded, err := base64.StdEncoding.DecodeString(token)
	if err != nil {
		return fmt.Errorf("failed to decode token (expected base64): %w", err)
	}

	// Build rest config from server, CA, and token
	config := &rest.Config{
		Host:        server,
		BearerToken: string(tokenDecoded),
		TLSClientConfig: rest.TLSClientConfig{
			CAData: caDecoded,
		},
	}

	// Create clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create clientset: %w", err)
	}

	// Create dynamic client
	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create dynamic client: %w", err)
	}

	// Create apiextensions clientset
	apiextensionsClient, err := apiextensionsclientset.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create apiextensions clientset: %w", err)
	}

	// Test connection
	_, err = clientset.ServerVersion()
	if err != nil {
		return fmt.Errorf("failed to connect to cluster: %w", err)
	}

	m.clients[name] = clientset
	m.dynamicClients[name] = dynamicClient
	m.apiextensionsClients[name] = apiextensionsClient
	m.configs[name] = config

	log.Infof("Successfully added cluster: %s", name)

	return nil
}

// AddClusterFromKubeconfigContent adds a cluster from kubeconfig content (YAML string)
func (m *Manager) AddClusterFromKubeconfigContent(name, kubeconfigContent, kubeContext string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Parse kubeconfig content
	config, err := clientcmd.RESTConfigFromKubeConfig([]byte(kubeconfigContent))
	if err != nil {
		// Try with context override if simple parsing fails
		clientConfig, err := clientcmd.NewClientConfigFromBytes([]byte(kubeconfigContent))
		if err != nil {
			return fmt.Errorf("failed to parse kubeconfig: %w", err)
		}

		// Override context if specified
		if kubeContext != "" {
			rawConfig, err := clientConfig.RawConfig()
			if err != nil {
				return fmt.Errorf("failed to get raw config: %w", err)
			}
			rawConfig.CurrentContext = kubeContext
			clientConfig = clientcmd.NewDefaultClientConfig(rawConfig, &clientcmd.ConfigOverrides{})
		}

		config, err = clientConfig.ClientConfig()
		if err != nil {
			return fmt.Errorf("failed to build config: %w", err)
		}
	}

	// Create clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create clientset: %w", err)
	}

	// Create dynamic client
	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create dynamic client: %w", err)
	}

	// Create apiextensions clientset
	apiextensionsClient, err := apiextensionsclientset.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create apiextensions clientset: %w", err)
	}

	// Test connection
	_, err = clientset.ServerVersion()
	if err != nil {
		return fmt.Errorf("failed to connect to cluster: %w", err)
	}

	m.clients[name] = clientset
	m.dynamicClients[name] = dynamicClient
	m.apiextensionsClients[name] = apiextensionsClient
	m.configs[name] = config

	log.Infof("Successfully added cluster from content: %s", name)

	return nil
}

// GetClient returns a Kubernetes client for the specified cluster
func (m *Manager) GetClient(name string) (*kubernetes.Clientset, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	client, exists := m.clients[name]
	if !exists {
		return nil, fmt.Errorf("cluster %s not found", name)
	}

	return client, nil
}

// GetDynamicClient returns a dynamic client for the specified cluster
func (m *Manager) GetDynamicClient(name string) (dynamic.Interface, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	client, exists := m.dynamicClients[name]
	if !exists {
		return nil, fmt.Errorf("cluster %s not found or dynamic client not initialized", name)
	}

	return client, nil
}

// GetApiExtensionsClient returns an apiextensions client for the specified cluster
func (m *Manager) GetApiExtensionsClient(name string) (*apiextensionsclientset.Clientset, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	client, exists := m.apiextensionsClients[name]
	if !exists {
		return nil, fmt.Errorf("cluster %s not found or apiextensions client not initialized", name)
	}

	return client, nil
}

// GetConfig returns the REST config for the specified cluster
func (m *Manager) GetConfig(name string) (*rest.Config, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	config, exists := m.configs[name]
	if !exists {
		return nil, fmt.Errorf("cluster %s not found", name)
	}

	return config, nil
}

// GetMetricsClient returns a typed metrics client for metrics-server API
func (m *Manager) GetMetricsClient(name string) (*metricsclientset.Clientset, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	cfg, exists := m.configs[name]
	if !exists {
		return nil, fmt.Errorf("cluster %s not found", name)
	}

	// Create metrics clientset
	metricsClient, err := metricsclientset.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create metrics client: %v", err)
	}

	return metricsClient, nil
}

// RemoveCluster removes a cluster from in-memory manager (does NOT delete from database)
func (m *Manager) RemoveCluster(name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.clients, name)
	delete(m.dynamicClients, name)
	delete(m.apiextensionsClients, name)
	delete(m.configs, name)

	// NOTE: Do NOT delete from database here!
	// This method is called when disabling a cluster (toggle OFF)
	// The cluster record should remain in database with enabled=false
	// Only DeleteCluster API handler should call db.DeleteCluster()

	log.Infof("Removed cluster from manager: %s", name)

	return nil
}

// ListClusters returns a list of all managed clusters
func (m *Manager) ListClusters() ([]ClusterInfo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var clusters []ClusterInfo

	for name, client := range m.clients {
		info := ClusterInfo{
			Name:   name,
			Status: "connected",
		}

		// Get cluster version
		version, err := client.ServerVersion()
		if err != nil {
			info.Status = "error"
			info.Version = "unknown"
		} else {
			info.Version = version.GitVersion
		}

		// Get additional metadata from database
		dbCluster, err := m.db.GetCluster(name)
		if err == nil {
			info.IsDefault = dbCluster.IsDefault
			info.Enabled = dbCluster.Enabled
		}

		clusters = append(clusters, info)
	}

	return clusters, nil
}

// GetClusterInfo returns information about a specific cluster
func (m *Manager) GetClusterInfo(name string) (*ClusterInfo, error) {
	m.mu.RLock()
	client, exists := m.clients[name]
	m.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("cluster %s not found", name)
	}

	info := &ClusterInfo{
		Name:   name,
		Status: "connected",
	}

	// Get cluster version
	ctx := context.Background()
	version, err := client.ServerVersion()
	if err != nil {
		info.Status = "error"
		info.Version = "unknown"
	} else {
		info.Version = version.GitVersion
	}

	// Get additional metadata
	nodes, err := client.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err == nil {
		info.Metadata = map[string]interface{}{
			"nodes_count": len(nodes.Items),
		}
	}

	namespaces, err := client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err == nil {
		if info.Metadata == nil {
			info.Metadata = make(map[string]interface{})
		}
		info.Metadata["namespaces_count"] = len(namespaces.Items)
	}

	// Get from database
	dbCluster, err := m.db.GetCluster(name)
	if err == nil {
		info.IsDefault = dbCluster.IsDefault
		info.Enabled = dbCluster.Enabled
	}

	return info, nil
}

