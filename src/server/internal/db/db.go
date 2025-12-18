package db

import (
	"encoding/json"
	"fmt"

	log "github.com/sirupsen/logrus"
)

// DB is the main database interface for Kubelens
// It wraps GormDB and provides backward compatibility
type DB struct {
	*GormDB
}

// New creates a new database connection
// Automatically detects database type and runs migrations
func New(connectionString string) (*DB, error) {
	gormDB, err := NewGorm(connectionString)
	if err != nil {
		return nil, err
	}
	
	return &DB{GormDB: gormDB}, nil
}

// Close closes the database connection
func (db *DB) Close() error {
	return db.GormDB.Close()
}

// =============================================================================
// Type Conversion Helpers
// =============================================================================

// These helpers convert between old API types (int, string) and new GORM types (uint, time.Time)
// This ensures backward compatibility with existing API handlers

// intToUint safely converts int to uint
func intToUint(i int) uint {
	if i < 0 {
		return 0
	}
	return uint(i)
}

// uintToInt safely converts uint to int
func uintToInt(u uint) int {
	return int(u)
}

// =============================================================================
// Permission represents a single permission entry (for JSON serialization)
// =============================================================================

type Permission struct {
	Resource   string   `json:"resource"`   // "clusters", "pods", "deployments", etc.
	Actions    []string `json:"actions"`    // ["read", "create", "update", "delete"]
	Clusters   []string `json:"clusters"`   // ["*"] for all or specific cluster names
	Namespaces []string `json:"namespaces"` // ["*"] for all or specific namespace names
}

// MarshalJSON customizes JSON marshalling for Group to parse permissions
func (g Group) MarshalJSON() ([]byte, error) {
	type Alias Group
	var permissions []Permission
	
	// Parse JSON permissions
	if len(g.Permissions) > 0 {
		if err := json.Unmarshal([]byte(g.Permissions), &permissions); err != nil {
			log.Warnf("Failed to unmarshal permissions for group %s: %v", g.Name, err)
			permissions = []Permission{} // Return empty array on error
		}
	} else {
		permissions = []Permission{}
	}
	
	return json.Marshal(&struct {
		Permissions []Permission `json:"permissions"`
		*Alias
	}{
		Permissions: permissions,
		Alias:       (*Alias)(&g),
	})
}

// AuditLogFilters (already defined in models.go, re-export for compatibility)
// type AuditLogFilters = AuditLogFilters

// =============================================================================
// Legacy Type Aliases (for backward compatibility)
// =============================================================================

// These are kept for backward compatibility with existing code
// They will be gradually phased out

type (
	// LegacyCluster represents the old Cluster type with int ID and string timestamps
	LegacyCluster = Cluster
	
	// LegacyUser represents the old User type
	LegacyUser = User
	
	// LegacyGroup represents the old Group type
	LegacyGroup = Group
	
	// LegacySession represents the old Session type
	LegacySession = Session
	
	// LegacyUserSession represents the old UserSession type
	LegacyUserSession = UserSession
	
	// LegacyNotification represents the old Notification type
	LegacyNotification = Notification
)

// =============================================================================
// Helper Functions
// =============================================================================

// ValidateCluster validates cluster configuration
func ValidateCluster(cluster *Cluster) error {
	if cluster.Name == "" {
		return fmt.Errorf("cluster name cannot be empty")
	}
	
	if cluster.AuthType == "" {
		cluster.AuthType = string(AuthTypeToken)
	}
	
	if cluster.AuthType != string(AuthTypeToken) && cluster.AuthType != string(AuthTypeKubeconfig) {
		return fmt.Errorf("invalid auth type: %s", cluster.AuthType)
	}
	
	// Validate AuthConfig is valid JSON
	if cluster.AuthConfig != nil && len(cluster.AuthConfig) > 0 {
		var temp interface{}
		if err := json.Unmarshal([]byte(cluster.AuthConfig), &temp); err != nil {
			return fmt.Errorf("invalid auth_config JSON: %w", err)
		}
	}
	
	return nil
}

// ValidateUser validates user data
func ValidateUser(user *User) error {
	if user.Username == "" {
		return fmt.Errorf("username cannot be empty")
	}
	
	if user.Email == "" {
		return fmt.Errorf("email cannot be empty")
	}
	
	if user.AuthProvider == "" {
		user.AuthProvider = "local"
	}
	
	return nil
}

// ValidateGroup validates group data
func ValidateGroup(group *Group) error {
	if group.Name == "" {
		return fmt.Errorf("group name cannot be empty")
	}
	
	// Validate Permissions is valid JSON
	if group.Permissions != nil && len(group.Permissions) > 0 {
		var temp interface{}
		if err := json.Unmarshal([]byte(group.Permissions), &temp); err != nil {
			return fmt.Errorf("invalid permissions JSON: %w", err)
		}
	}
	
	return nil
}

// ParseAuthConfig parses auth_config JSON into appropriate struct
func ParseAuthConfig(authType, authConfigJSON string) (interface{}, error) {
	switch authType {
	case string(AuthTypeToken):
		var config TokenAuthConfig
		if err := json.Unmarshal([]byte(authConfigJSON), &config); err != nil {
			return nil, fmt.Errorf("invalid token auth config: %w", err)
		}
		return config, nil
		
	case string(AuthTypeKubeconfig):
		var config KubeconfigAuthConfig
		if err := json.Unmarshal([]byte(authConfigJSON), &config); err != nil {
			return nil, fmt.Errorf("invalid kubeconfig auth config: %w", err)
		}
		return config, nil
		
	default:
		return nil, fmt.Errorf("unsupported auth type: %s", authType)
	}
}

// =============================================================================
// Backward Compatibility Methods
// =============================================================================

// These methods maintain the old API signatures while using GORM internally
// They handle type conversions between old (int, string) and new (uint, time.Time) types

// Note: All the actual CRUD operations are implemented in the crud_*.go files
// This file only provides the DB struct and compatibility layer
