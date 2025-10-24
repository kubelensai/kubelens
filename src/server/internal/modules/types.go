package modules

import (
	"context"

	"github.com/gin-gonic/gin"
)

// Module defines the interface that all modules must implement
type Module interface {
	// Metadata
	Name() string
	Version() string
	Description() string
	Type() ModuleType

	// Lifecycle
	Initialize(ctx context.Context, deps *ModuleDependencies) error
	Shutdown(ctx context.Context) error

	// Schema management
	GetSchema() *SchemaDefinition
	Migrate(db interface{}) error

	// API endpoints
	RegisterRoutes(router *gin.RouterGroup) error

	// UI metadata (for dynamic frontend)
	GetUIMetadata() *UIMetadata
}

// ModuleType represents the category of module
type ModuleType string

const (
	ModuleTypeCloudIntegration ModuleType = "cloud_integration" // GCP, AWS, Azure
	ModuleTypeObservability    ModuleType = "observability"     // Prometheus, Datadog
	ModuleTypeAlertManagement  ModuleType = "alert_management"  // PagerDuty, Slack
	ModuleTypeCostManagement   ModuleType = "cost_management"   // Kubecost, CloudHealth
)

// ModuleDependencies provides access to core services
type ModuleDependencies struct {
	DB             interface{} // *db.DB instance (should be *db.DB)
	ClusterManager interface{} // Cluster manager reference
	OAuth2Handler  interface{} // OAuth2 handler for token management
	Logger         interface{} // Logger
	Config         map[string]interface{}
}

// SchemaDefinition defines database schema requirements
type SchemaDefinition struct {
	Tables  []TableDefinition
	Indexes []IndexDefinition
}

// TableDefinition defines a database table
type TableDefinition struct {
	Name   string
	Schema string // SQL CREATE TABLE statement
}

// IndexDefinition defines a database index
type IndexDefinition struct {
	Name   string
	Schema string // SQL CREATE INDEX statement
}

// UIMetadata defines how the module appears in the frontend
type UIMetadata struct {
	Name        string           `json:"name"`
	DisplayName string           `json:"display_name"`
	Description string           `json:"description"`
	Icon        string           `json:"icon"`        // Icon name/URL
	Category    string           `json:"category"`    // "cloud", "monitoring", "alerts", "cost"
	ConfigForm  ConfigFormSchema `json:"config_form"` // Dynamic form schema
	Actions     []ModuleAction   `json:"actions"`     // Available actions
}

// ConfigFormSchema defines the configuration form structure
type ConfigFormSchema struct {
	Fields []FormField `json:"fields"`
}

// FormField defines a single form field
type FormField struct {
	Name        string        `json:"name"`
	Type        string        `json:"type"`        // "text", "textarea", "file", "select", "password"
	Label       string        `json:"label"`
	Placeholder string        `json:"placeholder,omitempty"`
	Required    bool          `json:"required"`
	Validation  interface{}   `json:"validation,omitempty"`
	Help        string        `json:"help,omitempty"`
	Options     []FormOption  `json:"options,omitempty"` // For select fields
}

// FormOption defines an option for select fields
type FormOption struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

// ModuleAction defines an action that can be performed with the module
type ModuleAction struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Description string `json:"description"`
	Endpoint    string `json:"endpoint"` // API endpoint
	Method      string `json:"method"`   // HTTP method
}

