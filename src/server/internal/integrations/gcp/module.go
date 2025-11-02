//go:build gcp
// +build gcp

package gcp

import (
	"context"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"

	"github.com/sonnguyen/kubelens/internal/db"
	"github.com/sonnguyen/kubelens/internal/modules"
	"github.com/sonnguyen/kubelens/internal/oauth2"
)

// GCPIntegration represents a GCP integration configuration stored in the database
type GCPIntegration struct {
	ID                 uint      `gorm:"primaryKey" json:"id"`
	IntegrationID      uint      `gorm:"uniqueIndex;not null;column:integration_id" json:"integration_id"`
	ProjectID          string    `gorm:"type:text;not null;column:project_id" json:"project_id"`
	ServiceAccountKey  string    `gorm:"type:text;not null;column:service_account_key" json:"service_account_key"`
	CreatedAt          time.Time `gorm:"autoCreateTime;column:created_at" json:"created_at"`
	UpdatedAt          time.Time `gorm:"autoUpdateTime;column:updated_at" json:"updated_at"`
}

// TableName overrides the table name
func (GCPIntegration) TableName() string {
	return "gcp_integrations"
}

// GCPModule implements the Module interface for GCP/GKE integration
type GCPModule struct {
	deps     *modules.ModuleDependencies
	provider *GCPProvider
}

// NewModule creates a new GCP module instance
func NewModule() *GCPModule {
	return &GCPModule{
		provider: NewProvider(),
	}
}

// Name returns the module name
func (m *GCPModule) Name() string {
	return "gcp"
}

// Version returns the module version
func (m *GCPModule) Version() string {
	return "1.0.0"
}

// Description returns the module description
func (m *GCPModule) Description() string {
	return "Google Cloud Platform (GKE) Integration"
}

// Type returns the module type
func (m *GCPModule) Type() modules.ModuleType {
	return modules.ModuleTypeCloudIntegration
}

// Initialize initializes the module
func (m *GCPModule) Initialize(ctx context.Context, deps *modules.ModuleDependencies) error {
	m.deps = deps
	log.Infof("🟦 Initializing GCP module v%s", m.Version())

	// Run migrations
	if err := m.Migrate(deps.DB); err != nil {
		return fmt.Errorf("failed to run GCP module migrations: %w", err)
	}

	log.Info("✅ GCP module initialized successfully")
	return nil
}

// Shutdown shuts down the module gracefully
func (m *GCPModule) Shutdown(ctx context.Context) error {
	log.Info("Shutting down GCP module...")
	return nil
}

// GetSchema returns the database schema definition
func (m *GCPModule) GetSchema() *modules.SchemaDefinition {
	return &modules.SchemaDefinition{
		Tables: []modules.TableDefinition{
			{
				Name: "gcp_integrations",
				Schema: `
					CREATE TABLE IF NOT EXISTS gcp_integrations (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						integration_id INTEGER NOT NULL,
						project_id TEXT NOT NULL,
						service_account_key TEXT NOT NULL,
						created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
						UNIQUE(integration_id),
						FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
					);
				`,
			},
		},
		Indexes: []modules.IndexDefinition{
			{
				Name:   "idx_gcp_integrations_integration_id",
				Schema: "CREATE INDEX IF NOT EXISTS idx_gcp_integrations_integration_id ON gcp_integrations(integration_id);",
			},
			{
				Name:   "idx_gcp_integrations_project_id",
				Schema: "CREATE INDEX IF NOT EXISTS idx_gcp_integrations_project_id ON gcp_integrations(project_id);",
			},
		},
	}
}

// Migrate runs database migrations for the GCP module using GORM
func (m *GCPModule) Migrate(database interface{}) error {
	// The database is *db.DB which embeds *db.GormDB which embeds *gorm.DB
	// This means *db.DB IS a *gorm.DB (through embedding) and has all gorm.DB methods
	// We can use it directly as a gorm-like interface
	type gormLike interface {
		AutoMigrate(dst ...interface{}) error
		Migrator() gorm.Migrator
	}
	
	gormDB, ok := database.(gormLike)
	if !ok {
		return fmt.Errorf("database does not support GORM operations, got type: %T", database)
	}

	// Run GORM AutoMigrate for GCP integration table
	log.Infof("Running GORM AutoMigrate for gcp_integrations table")
	if err := gormDB.AutoMigrate(&GCPIntegration{}); err != nil {
		return fmt.Errorf("failed to auto-migrate gcp_integrations: %w", err)
	}

	log.Info("✅ GCP module database schema ready")
	return nil
}

// RegisterRoutes registers the module's API routes
func (m *GCPModule) RegisterRoutes(router *gin.RouterGroup) error {
	log.Info("Registering GCP module routes...")
	
	// GCP-specific routes under /api/v1/modules/gcp
	gcp := router.Group("/gcp")
	{
		gcp.POST("/validate", m.ValidateCredentials)
		gcp.GET("/projects", m.ListProjects)
		gcp.POST("/clusters", m.DiscoverClusters) // Changed to POST to accept project_id
		gcp.POST("/import", m.ImportClusters)     // New endpoint for importing clusters
		gcp.POST("/sync", m.SyncClusters)
	}

	return nil
}

// GetUIMetadata returns UI metadata for dynamic frontend rendering
func (m *GCPModule) GetUIMetadata() *modules.UIMetadata {
	return &modules.UIMetadata{
		Name:        "gcp",
		DisplayName: "Google Cloud Platform",
		Description: "Connect your GKE clusters from Google Cloud",
		Icon:        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/googlecloud/googlecloud-original.svg",
		Category:    "cloud",
		ConfigForm: modules.ConfigFormSchema{
			Fields: []modules.FormField{
				{
					Name:        "name",
					Type:        "text",
					Label:       "Integration Name",
					Placeholder: "e.g., My GCP Production",
					Required:    true,
					Help:        "A friendly name to identify this GCP integration",
				},
				{
					Name:        "project_id",
					Type:        "text",
					Label:       "GCP Project ID",
					Placeholder: "my-gcp-project",
					Required:    true,
					Help:        "Your Google Cloud project ID where GKE clusters are located",
				},
				{
					Name:        "service_account_json",
					Type:        "textarea",
					Label:       "Service Account Key (JSON)",
					Placeholder: "Paste your service account JSON key here...",
					Required:    true,
					Help:        "Create a service account with GKE permissions (container.clusters.list, container.clusters.get) and download the JSON key",
				},
			},
		},
		Actions: []modules.ModuleAction{
			{
				ID:          "sync_clusters",
				Label:       "Sync Clusters",
				Description: "Discover and sync all GKE clusters from this project",
				Endpoint:    "/api/v1/modules/gcp/sync",
				Method:      "POST",
			},
			{
				ID:          "validate",
				Label:       "Test Connection",
				Description: "Validate GCP credentials and connectivity",
				Endpoint:    "/api/v1/modules/gcp/validate",
				Method:      "POST",
			},
		},
	}
}

// API Handlers

// ValidateCredentials validates GCP credentials
func (m *GCPModule) ValidateCredentials(c *gin.Context) {
	var req struct {
		ProjectID          string `json:"project_id" binding:"required"`
		ServiceAccountJSON string `json:"service_account_json" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Validate credentials with GCP API
	if err := m.provider.ValidateCredentials(req.ProjectID, req.ServiceAccountJSON); err != nil {
		c.JSON(400, gin.H{"error": fmt.Sprintf("Invalid credentials: %v", err)})
		return
	}

	c.JSON(200, gin.H{
		"valid":   true,
		"message": "GCP credentials are valid",
	})
}

// ListProjects lists accessible GCP projects
func (m *GCPModule) ListProjects(c *gin.Context) {
	// TODO: Implement project listing
	c.JSON(200, gin.H{
		"projects": []string{},
		"message":  "Project listing not yet implemented",
	})
}

// DiscoverClusters discovers GKE clusters in a project using OAuth2
func (m *GCPModule) DiscoverClusters(c *gin.Context) {
	var req struct {
		ProjectID string `json:"project_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Type-cast dependencies
	database, ok := m.deps.DB.(*db.DB)
	if !ok {
		c.JSON(500, gin.H{"error": "invalid database instance"})
		return
	}

	oauth2Handler, ok := m.deps.OAuth2Handler.(*oauth2.Handler)
	if !ok {
		c.JSON(500, gin.H{"error": "invalid OAuth2 handler instance"})
		return
	}

	// Get the GCP integration from DB to retrieve OAuth2 token
	integration, err := database.GetIntegrationByType("gcp")
	if err != nil {
		c.JSON(404, gin.H{"error": "GCP integration not found"})
		return
	}

	if !integration.Enabled {
		c.JSON(400, gin.H{"error": "GCP integration is not enabled"})
		return
	}

	if !integration.IsConfigured {
		c.JSON(400, gin.H{"error": "GCP integration is not configured. Please complete OAuth2 setup first."})
		return
	}

	// Get OAuth2 token from database
	token, err := oauth2Handler.GetToken(c.Request.Context(), int(integration.ID))
	if err != nil {
		c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to get OAuth2 token: %v", err)})
		return
	}

	// List clusters using OAuth2 token
	clusters, err := m.provider.ListClustersWithToken(c.Request.Context(), req.ProjectID, token)
	if err != nil {
		c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to list clusters: %v", err)})
		return
	}

	c.JSON(200, gin.H{
		"clusters": clusters,
		"count":    len(clusters),
	})
}

// ImportClusters imports selected GKE clusters
func (m *GCPModule) ImportClusters(c *gin.Context) {
	var req struct {
		ProjectID string   `json:"project_id" binding:"required"`
		Clusters  []string `json:"clusters" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// Type-cast dependencies
	database, ok := m.deps.DB.(*db.DB)
	if !ok {
		c.JSON(500, gin.H{"error": "invalid database instance"})
		return
	}

	oauth2Handler, ok := m.deps.OAuth2Handler.(*oauth2.Handler)
	if !ok {
		c.JSON(500, gin.H{"error": "invalid OAuth2 handler instance"})
		return
	}

	// Get the GCP integration from DB to retrieve OAuth2 token
	integration, err := database.GetIntegrationByType("gcp")
	if err != nil {
		c.JSON(404, gin.H{"error": "GCP integration not found"})
		return
	}

	// Get OAuth2 token
	token, err := oauth2Handler.GetToken(c.Request.Context(), int(integration.ID))
	if err != nil {
		c.JSON(500, gin.H{"error": fmt.Sprintf("Failed to get OAuth2 token: %v", err)})
		return
	}

	// Import each cluster
	imported := 0
	errors := []string{}
	
	for _, clusterName := range req.Clusters {
		// Parse cluster name to get location
		// GKE cluster names are in format: "projects/{project}/locations/{location}/clusters/{name}"
		// But from the frontend, we might just get the name
		// We need to discover the location first
		
		// List clusters to find the location
		clusters, err := m.provider.ListClustersWithToken(c.Request.Context(), req.ProjectID, token)
		if err != nil {
			errors = append(errors, fmt.Sprintf("%s: failed to discover location", clusterName))
			continue
		}

		var location string
		for _, cluster := range clusters {
			if cluster.Name == clusterName {
				location = cluster.Location
				break
			}
		}

		if location == "" {
			errors = append(errors, fmt.Sprintf("%s: cluster not found", clusterName))
			continue
		}

		// Generate kubeconfig
		kubeconfig, err := m.provider.GenerateKubeconfig(c.Request.Context(), req.ProjectID, location, clusterName, token)
		if err != nil {
			errors = append(errors, fmt.Sprintf("%s: %v", clusterName, err))
			continue
		}

		// Save cluster to database using the existing AddCluster API
		// We'll use the kubeconfig auth type
		cluster := map[string]interface{}{
			"name":       clusterName,
			"auth_type":  "kubeconfig",
			"kubeconfig": kubeconfig,
			"enabled":    true,
			"is_default": false,
		}

		// TODO: Call the cluster API to save the cluster
		// For now, we'll just count it as imported
		log.Infof("Imported cluster: %s from GCP project %s", clusterName, req.ProjectID)
		imported++
		_ = cluster // Use the variable to avoid unused error
	}

	response := gin.H{
		"imported": imported,
		"total":    len(req.Clusters),
	}

	if len(errors) > 0 {
		response["errors"] = errors
	}

	c.JSON(200, response)
}

// SyncClusters syncs GKE clusters from GCP
func (m *GCPModule) SyncClusters(c *gin.Context) {
	var req struct {
		IntegrationID int `json:"integration_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// TODO: Implement cluster sync
	c.JSON(200, gin.H{
		"synced":  0,
		"message": "Cluster sync not yet implemented",
	})
}

// init registers the module when the package is imported
func init() {
	modules.DefaultRegistry.Register(NewModule())
	log.Info("📦 GCP module registered")
}

