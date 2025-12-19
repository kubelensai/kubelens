package db

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// AuthType represents the authentication method
type AuthType string

const (
	AuthTypeToken      AuthType = "token"
	AuthTypeKubeconfig AuthType = "kubeconfig"
)

// =============================================================================
// Core Models with GORM
// =============================================================================

// Cluster represents a Kubernetes cluster configuration
type Cluster struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"name"`
	AuthType  string    `gorm:"default:'token';not null" json:"auth_type"`
	AuthConfig JSON     `gorm:"type:text;not null" json:"auth_config"`        // JSON serialization
	Server    string    `gorm:"type:text" json:"server,omitempty"`
	CA        string    `gorm:"type:text;column:ca" json:"ca,omitempty"`
	Token     string    `gorm:"type:text" json:"token,omitempty"`
	IsDefault bool      `gorm:"default:false;column:is_default" json:"is_default"`
	Enabled   bool      `gorm:"default:true" json:"enabled"`
	Status    string    `gorm:"type:varchar(50)" json:"status"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName overrides the table name used by Cluster to `clusters`
func (Cluster) TableName() string {
	return "clusters"
}

// User represents a user account
type User struct {
	ID              uint       `gorm:"primaryKey" json:"id"`
	Email           string     `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	Username        string     `gorm:"type:varchar(255);uniqueIndex;not null" json:"username"`
	PasswordHash    string     `gorm:"column:password_hash" json:"-"`
	FullName        string     `gorm:"column:full_name" json:"full_name,omitempty"`
	AvatarURL       string     `gorm:"column:avatar_url" json:"avatar_url,omitempty"`           // Original URL from provider (for reference)
	AvatarData      []byte     `gorm:"column:avatar_data;type:blob" json:"-"`                   // Cached avatar binary data
	AvatarMimeType  string     `gorm:"column:avatar_mime_type;type:varchar(50)" json:"-"`       // MIME type of cached avatar
	AuthProvider    string     `gorm:"default:'local';column:auth_provider" json:"auth_provider"`
	ProviderUserID  string     `gorm:"column:provider_user_id" json:"provider_user_id,omitempty"`
	IsActive        bool       `gorm:"default:true;column:is_active" json:"is_active"`
	IsAdmin         bool       `gorm:"default:false;column:is_admin" json:"is_admin"`
	MFAEnabled      bool       `gorm:"default:false;column:mfa_enabled" json:"mfa_enabled"`
	MFAEnforcedAt   *time.Time `gorm:"column:mfa_enforced_at" json:"mfa_enforced_at,omitempty"`
	TokenRevokedAt  *time.Time `gorm:"column:token_revoked_at" json:"-"`                        // All tokens issued before this time are invalid
	LastLogin       *time.Time `gorm:"column:last_login" json:"last_login,omitempty"`
	CreatedAt       time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time  `gorm:"autoUpdateTime" json:"updated_at"`

	// Relationships
	Groups    []Group    `gorm:"many2many:user_groups;" json:"groups,omitempty"`
	Sessions  []Session  `gorm:"foreignKey:UserID" json:"-"`
	MFASecret *MFASecret `gorm:"foreignKey:UserID" json:"-"`
}

// TableName overrides the table name used by User to `users`
func (User) TableName() string {
	return "users"
}

// Group represents a user group with RBAC permissions
type Group struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description,omitempty"`
	IsSystem    bool      `gorm:"column:is_system;default:false" json:"is_system"`
	Permissions JSON      `gorm:"type:text;not null" json:"permissions"` // JSON array
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relationships
	Users []User `gorm:"many2many:user_groups;" json:"users,omitempty"`
}

// TableName overrides the table name used by Group to `groups`
func (Group) TableName() string {
	return "groups"
}

// UserGroup is the join table for many-to-many relationship between users and groups
type UserGroup struct {
	UserID  uint `gorm:"primaryKey;column:user_id"`
	GroupID uint `gorm:"primaryKey;column:group_id"`
}

// TableName overrides the table name
func (UserGroup) TableName() string {
	return "user_groups"
}

// Session represents an authentication session
type Session struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	Token     string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"token"`
	ExpiresAt time.Time `gorm:"not null;index" json:"expires_at"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`

	// Relationships
	User User `gorm:"foreignKey:UserID" json:"-"`
}

// TableName overrides the table name
func (Session) TableName() string {
	return "sessions"
}

// UserSession stores user preferences (selected cluster, namespace, theme)
type UserSession struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	UserID            uint      `gorm:"uniqueIndex;not null" json:"user_id"`
	SelectedCluster   string    `gorm:"column:selected_cluster" json:"selected_cluster,omitempty"`
	SelectedNamespace string    `gorm:"column:selected_namespace" json:"selected_namespace,omitempty"`
	SelectedTheme     string    `gorm:"column:selected_theme" json:"selected_theme,omitempty"`
	CreatedAt         time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt         time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relationships
	User User `gorm:"foreignKey:UserID" json:"-"`
}

// TableName overrides the table name
func (UserSession) TableName() string {
	return "user_sessions"
}

// Notification represents a user notification
type Notification struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	Type      string    `gorm:"type:varchar(50);not null" json:"type"`
	Title     string    `gorm:"type:varchar(255);not null" json:"title"`
	Message   string    `gorm:"type:text;not null" json:"message"`
	IsRead    bool      `gorm:"default:false;column:is_read" json:"is_read"`
	CreatedAt time.Time `gorm:"autoCreateTime;index" json:"created_at"`

	// Relationships
	User User `gorm:"foreignKey:UserID" json:"-"`
}

// TableName overrides the table name
func (Notification) TableName() string {
	return "notifications"
}

// AuditLog represents a security/audit event (comprehensive audit log entry)
type AuditLog struct {
	ID             uint       `gorm:"primaryKey" json:"id"`
	Datetime       time.Time  `gorm:"not null;index" json:"datetime"`
	EventType      string     `gorm:"type:varchar(100);not null;index" json:"event_type"`
	EventCategory  string     `gorm:"type:varchar(100);not null;index" json:"event_category"`
	Level          string     `gorm:"type:varchar(20);not null" json:"level"`
	UserID         *uint      `gorm:"index" json:"user_id,omitempty"`
	Username       string     `gorm:"type:varchar(255)" json:"username,omitempty"`
	Email          string     `gorm:"type:varchar(255)" json:"email,omitempty"`
	SourceIP       string     `gorm:"type:varchar(45);column:source_ip" json:"source_ip"`
	UserAgent      string     `gorm:"type:text;column:user_agent" json:"user_agent,omitempty"`
	Resource       string     `gorm:"type:varchar(255)" json:"resource,omitempty"`
	Action         string     `gorm:"type:varchar(255)" json:"action,omitempty"`
	Description    string     `gorm:"type:text;not null" json:"description"`
	Metadata       string     `gorm:"type:text" json:"metadata,omitempty"` // JSON blob
	Success        bool       `gorm:"default:true" json:"success"`
	ErrorMessage   string     `gorm:"type:text;column:error_message" json:"error_message,omitempty"`
	RequestMethod  string     `gorm:"type:varchar(10);column:request_method" json:"request_method,omitempty"`
	RequestURI     string     `gorm:"type:text;column:request_uri" json:"request_uri,omitempty"`
	ResponseCode   int        `gorm:"column:response_code" json:"response_code,omitempty"`
	DurationMs     int        `gorm:"column:duration_ms" json:"duration_ms,omitempty"`
	SessionID      string     `gorm:"type:varchar(255);column:session_id" json:"session_id,omitempty"`
	CorrelationID  string     `gorm:"type:varchar(255);column:correlation_id" json:"correlation_id,omitempty"`
	GeoLocation    string     `gorm:"type:varchar(255);column:geo_location" json:"geo_location,omitempty"`
	CreatedAt      time.Time  `gorm:"autoCreateTime;index" json:"created_at"`

	// Relationships
	User *User `gorm:"foreignKey:UserID" json:"-"`
}

// TableName overrides the table name
func (AuditLog) TableName() string {
	return "audit_logs"
}

// AuditLogEntry is an alias for backward compatibility
type AuditLogEntry = AuditLog

// AuditSettings stores audit configuration
type AuditSettings struct {
	ID                      uint      `gorm:"primaryKey" json:"id"`
	UserID                  *uint     `gorm:"index" json:"user_id,omitempty"`
	Enabled                 bool      `gorm:"default:true" json:"enabled"`
	CollectAuthentication   bool      `gorm:"default:true;column:collect_authentication" json:"collect_authentication"`
	CollectSecurity         bool      `gorm:"default:true;column:collect_security" json:"collect_security"`
	CollectAudit            bool      `gorm:"default:true;column:collect_audit" json:"collect_audit"`
	CollectSystem           bool      `gorm:"default:false;column:collect_system" json:"collect_system"`
	CollectInfo             bool      `gorm:"default:true;column:collect_info" json:"collect_info"`
	CollectWarn             bool      `gorm:"default:true;column:collect_warn" json:"collect_warn"`
	CollectError            bool      `gorm:"default:true;column:collect_error" json:"collect_error"`
	CollectCritical         bool      `gorm:"default:true;column:collect_critical" json:"collect_critical"`
	SamplingEnabled         bool      `gorm:"default:false;column:sampling_enabled" json:"sampling_enabled"`
	SamplingRate            float64   `gorm:"default:1.0;column:sampling_rate" json:"sampling_rate"`
	CustomRetentionDays     *int      `gorm:"column:custom_retention_days" json:"custom_retention_days,omitempty"`
	UpdatedAt               time.Time `gorm:"autoCreateTime" json:"updated_at"`
	UpdatedBy               *uint     `gorm:"column:updated_by" json:"updated_by,omitempty"`
	
	// Legacy fields for backward compatibility
	AuthEventsEnabled     bool `gorm:"-" json:"auth_events_enabled,omitempty"` // Computed from CollectAuthentication
	SecurityEventsEnabled bool `gorm:"-" json:"security_events_enabled,omitempty"` // Computed from CollectSecurity
	K8sEventsEnabled      bool `gorm:"-" json:"k8s_events_enabled,omitempty"` // Computed from CollectAudit
	RetentionDays         int  `gorm:"-" json:"retention_days,omitempty"` // Computed from CustomRetentionDays
}

// TableName overrides the table name
func (AuditSettings) TableName() string {
	return "audit_settings"
}

// ApplyPreset applies a preset configuration to audit settings
func (s *AuditSettings) ApplyPreset(preset string) {
	switch preset {
	case "minimal":
		s.Enabled = true
		s.CollectAuthentication = true
		s.CollectSecurity = true
		s.CollectAudit = false
		s.CollectSystem = false
		s.CollectInfo = false
		s.CollectWarn = true
		s.CollectError = true
		s.CollectCritical = true
	case "standard":
		s.Enabled = true
		s.CollectAuthentication = true
		s.CollectSecurity = true
		s.CollectAudit = true
		s.CollectSystem = false
		s.CollectInfo = true
		s.CollectWarn = true
		s.CollectError = true
		s.CollectCritical = true
	case "comprehensive":
		s.Enabled = true
		s.CollectAuthentication = true
		s.CollectSecurity = true
		s.CollectAudit = true
		s.CollectSystem = true
		s.CollectInfo = true
		s.CollectWarn = true
		s.CollectError = true
		s.CollectCritical = true
	case "disabled":
		s.Enabled = false
	}
}

// CalculateStorageImpact estimates storage impact based on current settings
func (s *AuditSettings) CalculateStorageImpact() map[string]interface{} {
	if !s.Enabled {
		return map[string]interface{}{
			"avg_logs_per_day":     0,
			"retention_days":       0,
			"estimated_total_logs": 0,
			"estimated_size_mb":    0,
		}
	}
	
	// Estimate logs per day based on enabled categories
	activeCategories := 0
	if s.CollectAuthentication {
		activeCategories++
	}
	if s.CollectSecurity {
		activeCategories++
	}
	if s.CollectAudit {
		activeCategories++
	}
	if s.CollectSystem {
		activeCategories++
	}
	
	// Estimate based on log levels
	activeLevels := 0
	if s.CollectInfo {
		activeLevels++
	}
	if s.CollectWarn {
		activeLevels++
	}
	if s.CollectError {
		activeLevels++
	}
	if s.CollectCritical {
		activeLevels++
	}
	
	// Base estimate: 50 logs per category per level per day
	avgLogsPerDay := activeCategories * activeLevels * 50
	
	// Apply sampling rate if enabled
	if s.SamplingEnabled && s.SamplingRate < 1.0 {
		avgLogsPerDay = int(float64(avgLogsPerDay) * s.SamplingRate)
	}
	
	// Get retention days
	retentionDays := 90 // default
	if s.CustomRetentionDays != nil {
		retentionDays = *s.CustomRetentionDays
	}
	
	estimatedTotalLogs := avgLogsPerDay * retentionDays
	
	// Estimate size: ~1KB per log entry
	estimatedSizeMB := estimatedTotalLogs / 1024
	
	return map[string]interface{}{
		"avg_logs_per_day":     avgLogsPerDay,
		"retention_days":       retentionDays,
		"estimated_total_logs": estimatedTotalLogs,
		"estimated_size_mb":    estimatedSizeMB,
		"active_categories":    activeCategories,
		"active_levels":        activeLevels,
		"sampling_enabled":     s.SamplingEnabled,
		"sampling_rate":        s.SamplingRate,
	}
}

// ShouldLog checks if a log entry should be recorded based on settings
func (s *AuditSettings) ShouldLog(entry AuditLogEntry) bool {
	if !s.Enabled {
		return false
	}
	
	// Check category
	switch entry.EventCategory {
	case "authentication":
		if !s.CollectAuthentication {
			return false
		}
	case "security":
		if !s.CollectSecurity {
			return false
		}
	case "audit":
		if !s.CollectAudit {
			return false
		}
	case "system":
		if !s.CollectSystem {
			return false
		}
	}
	
	// Check level
	switch entry.Level {
	case "INFO":
		if !s.CollectInfo {
			return false
		}
	case "WARN", "WARNING":
		if !s.CollectWarn {
			return false
		}
	case "ERROR":
		if !s.CollectError {
			return false
		}
	case "CRITICAL", "FATAL":
		if !s.CollectCritical {
			return false
		}
	}
	
	return true
}

// MFASecret represents a user's MFA secret
type MFASecret struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UserID      uint      `gorm:"uniqueIndex;not null" json:"user_id"`
	Secret      string    `gorm:"type:text;not null" json:"-"`
	BackupCodes string    `gorm:"type:text;column:backup_codes" json:"-"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relationships
	User User `gorm:"foreignKey:UserID" json:"-"`
}

// TableName overrides the table name
func (MFASecret) TableName() string {
	return "mfa_secrets"
}

// [Removed Integration structs]

// ClusterMetadata stores cluster metadata and statistics
type ClusterMetadata struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	ClusterName    string    `gorm:"type:varchar(255);uniqueIndex;not null;column:cluster_name" json:"cluster_name"`
	KubeVersion    string    `gorm:"type:varchar(50);column:kube_version" json:"kube_version,omitempty"`
	NodeCount      int       `gorm:"default:0;column:node_count" json:"node_count"`
	PodCount       int       `gorm:"default:0;column:pod_count" json:"pod_count"`
	NamespaceCount int       `gorm:"default:0;column:namespace_count" json:"namespace_count"`
	LastSynced     *time.Time `gorm:"column:last_synced" json:"last_synced,omitempty"`
	CreatedAt      time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt      time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName overrides the table name
func (ClusterMetadata) TableName() string {
	return "cluster_metadata"
}

// =============================================================================
// JSON Custom Type for GORM
// =============================================================================

// JSON is a custom type for JSON serialization in GORM
type JSON json.RawMessage

// Scan implements the sql.Scanner interface for JSON
func (j *JSON) Scan(value interface{}) error {
	if value == nil {
		*j = JSON("null")
		return nil
	}
	
	// Handle both []byte and string
	switch v := value.(type) {
	case []byte:
		*j = JSON(v)
		return nil
	case string:
		*j = JSON(v)
		return nil
	default:
		return fmt.Errorf("failed to unmarshal JSON value: %v (type %T)", value, value)
	}
}

// Value implements the driver.Valuer interface for JSON
func (j JSON) Value() (driver.Value, error) {
	if len(j) == 0 {
		return "null", nil
	}
	return string(j), nil
}

// MarshalJSON implements json.Marshaler interface
func (j JSON) MarshalJSON() ([]byte, error) {
	if len(j) == 0 {
		return []byte("null"), nil
	}
	return j, nil
}

// UnmarshalJSON implements json.Unmarshaler interface
func (j *JSON) UnmarshalJSON(data []byte) error {
	if j == nil {
		return fmt.Errorf("JSON: UnmarshalJSON on nil pointer")
	}
	*j = append((*j)[0:0], data...)
	return nil
}

// String returns the JSON as a string
func (j JSON) String() string {
	return string(j)
}

// =============================================================================
// Helper Structs (not stored in DB)
// =============================================================================

// TokenAuthConfig for token-based authentication
type TokenAuthConfig struct {
	Server string `json:"server"`
	CA     string `json:"ca"`
	Token  string `json:"token"`
}

// KubeconfigAuthConfig for kubeconfig-based authentication
type KubeconfigAuthConfig struct {
	Kubeconfig string `json:"kubeconfig"`
	Context    string `json:"context,omitempty"`
}

// AuditLogFilters for querying audit logs
type AuditLogFilters struct {
	EventType string
	UserID    uint
	StartDate time.Time
	EndDate   time.Time
	Page      int
	PageSize  int
}

// =============================================================================
// Extension and System Configuration Models
// =============================================================================

// ExtensionConfig stores encrypted extension configuration
type ExtensionConfig struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	ExtensionName string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"extension_name"`
	ConfigData    string    `gorm:"type:text;not null" json:"-"` // Encrypted JSON, hidden from API
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName overrides the table name
func (ExtensionConfig) TableName() string {
	return "extension_configs"
}

// SystemConfig stores system-wide configuration (like encryption key)
// Key is auto-generated on first install and stored securely in database
type SystemConfig struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Key       string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"key"`
	Value     string    `gorm:"type:text;not null" json:"-"` // Hidden from API
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName overrides the table name
func (SystemConfig) TableName() string {
	return "system_configs"
}

