package audit

import (
	"github.com/sonnguyen/kubelens/internal/db"
)

// Type aliases to avoid circular import
type LogEntry = db.AuditLogEntry
type Settings = db.AuditSettings

// Event categories
const (
	CategoryAuthentication = "authentication"
	CategorySecurity       = "security"
	CategoryAudit          = "audit"
	CategorySystem         = "system"
)

// Log levels
const (
	LevelInfo     = "INFO"
	LevelWarn     = "WARN"
	LevelError    = "ERROR"
	LevelCritical = "CRITICAL"
)

// Event types - Authentication
const (
	EventAuthLoginSuccess     = "authn_login_success"
	EventAuthLoginFailed      = "authn_login_failed"
	EventAuthLogout           = "authn_logout"
	EventAuthPasswordChange   = "authn_password_change"
	EventAuthPasswordReset    = "authn_password_reset"
	EventAuthMFAEnabled       = "authn_mfa_enabled"
	EventAuthMFADisabled      = "authn_mfa_disabled"
	EventAuthMFAVerifySuccess = "authn_mfa_verify_success"
	EventAuthMFAVerifyFailed  = "authn_mfa_verify_failed"
	EventAuthSessionExpired   = "authn_session_expired"
	EventAuthTokenRefresh     = "authn_token_refresh"

	// Aliases for backward compatibility
	EventLoginSuccess          = EventAuthLoginSuccess
	EventLoginFailed           = EventAuthLoginFailed
	EventLogout                = EventAuthLogout
	EventPasswordChanged       = EventAuthPasswordChange
	EventPasswordResetRequested = EventAuthPasswordReset
	EventPasswordResetCompleted = EventAuthPasswordReset
	EventMFAEnabled            = EventAuthMFAEnabled
	EventMFADisabled           = EventAuthMFADisabled
	EventMFAVerified           = EventAuthMFAVerifySuccess
	EventMFAFailed             = EventAuthMFAVerifyFailed
	EventAccountLocked         = EventSecAccountLocked
	EventAccountUnlocked       = EventSecAccountUnlocked
)

// Event types - Security
const (
	EventSecRateLimitExceeded  = "sec_rate_limit_exceeded"
	EventSecAccountLocked      = "sec_account_locked"
	EventSecAccountUnlocked    = "sec_account_unlocked"
	EventSecSQLInjection       = "sec_sql_injection_attempt"
	EventSecXSSAttempt         = "sec_xss_attempt"
	EventSecInvalidInput       = "sec_invalid_input"
	EventSecUnauthorizedAccess = "sec_unauthorized_access"
	EventSecPermissionDenied   = "sec_permission_denied"
	EventSecSuspiciousActivity = "sec_suspicious_activity"

	// Aliases for backward compatibility
	EventRateLimitExceeded  = EventSecRateLimitExceeded
	EventSQLInjectionAttempt = EventSecSQLInjection
	EventXSSAttempt         = EventSecXSSAttempt
	EventInvalidToken       = EventSecInvalidInput
	EventUnauthorizedAccess = EventSecUnauthorizedAccess
)

// Event types - Audit
const (
	EventAuditUserCreated      = "audit_user_created"
	EventAuditUserUpdated      = "audit_user_updated"
	EventAuditUserDeleted      = "audit_user_deleted"
	EventAuditUserDeactivated  = "audit_user_deactivated"
	EventAuditUserActivated    = "audit_user_activated"
	EventAuditGroupCreated     = "audit_group_created"
	EventAuditGroupUpdated     = "audit_group_updated"
	EventAuditGroupDeleted     = "audit_group_deleted"
	EventAuditClusterAdded     = "audit_cluster_added"
	EventAuditClusterUpdated   = "audit_cluster_updated"
	EventAuditClusterRemoved   = "audit_cluster_removed"
	EventAuditClusterEnabled   = "audit_cluster_enabled"
	EventAuditClusterDisabled  = "audit_cluster_disabled"
	EventAuditResourceCreated  = "audit_resource_created"
	EventAuditResourceUpdated  = "audit_resource_updated"
	EventAuditResourceDeleted  = "audit_resource_deleted"
	EventAuditConfigChanged    = "audit_config_changed"

	// Aliases for backward compatibility
	EventUserCreated    = EventAuditUserCreated
	EventUserUpdated    = EventAuditUserUpdated
	EventUserDeleted    = EventAuditUserDeleted
	EventGroupCreated   = EventAuditGroupCreated
	EventGroupUpdated   = EventAuditGroupUpdated
	EventGroupDeleted   = EventAuditGroupDeleted
	EventClusterAdded   = EventAuditClusterAdded
	EventClusterUpdated = EventAuditClusterUpdated
	EventClusterRemoved = EventAuditClusterRemoved
)

// Event types - System
const (
	EventSystemStartup       = "system_startup"
	EventSystemShutdown      = "system_shutdown"
	EventSystemConfigChange  = "system_config_change"
	EventSystemError         = "system_error"
	EventSystemHealthCheck   = "system_health_check"
	EventSystemBackup        = "system_backup"
	EventSystemRestore       = "system_restore"
)

// RetentionPolicy defines retention periods for audit logs
type RetentionPolicy struct {
	HotRetentionDays      int `json:"hot_retention_days"`      // Main table (default: 30 days)
	WarmRetentionDays     int `json:"warm_retention_days"`     // Archive table (default: 90 days)
	ColdRetentionDays     int `json:"cold_retention_days"`     // Before deletion (default: 365 days)
	CriticalRetentionDays int `json:"critical_retention_days"` // Critical events (default: 730 days)
}

// DefaultRetentionPolicy returns the default retention policy
func DefaultRetentionPolicy() RetentionPolicy {
	return RetentionPolicy{
		HotRetentionDays:      30,
		WarmRetentionDays:     90,
		ColdRetentionDays:     365,
		CriticalRetentionDays: 730,
	}
}

// RetentionStats represents retention statistics
type RetentionStats struct {
	HotLogs        int     `json:"hot_logs"`
	WarmLogs       int     `json:"warm_logs"`
	ColdLogs       int     `json:"cold_logs"`
	TotalLogs      int     `json:"total_logs"`
	DatabaseSizeMB float64 `json:"database_size_mb"`
	OldestLog      string  `json:"oldest_log,omitempty"`
	NewestLog      string  `json:"newest_log,omitempty"`
}

// Preset represents a predefined audit settings configuration
type Preset struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Settings    Settings `json:"settings"`
}

// GetPresets returns all available presets
func GetPresets() []Preset {
	return []Preset{
		{
			Name:        "full_logging",
			Description: "Maximum security - log all events (100% storage)",
			Settings: Settings{
				Enabled:               true,
				CollectAuthentication: true,
				CollectSecurity:       true,
				CollectAudit:          true,
				CollectSystem:         true,
				CollectInfo:           true,
				CollectWarn:           true,
				CollectError:          true,
				CollectCritical:       true,
				SamplingEnabled:       false,
				SamplingRate:          1.0,
				EnabledEventTypes:     []string{},
				DisabledEventTypes:    []string{},
				ExcludeUsers:          []int{},
				ExcludeIPs:            []string{},
				IncludeOnlyUsers:      []int{},
				IncludeOnlyIPs:        []string{},
			},
		},
		{
			Name:        "security_only",
			Description: "Focus on security events only (~40% storage)",
			Settings: Settings{
				Enabled:               true,
				CollectAuthentication: true,
				CollectSecurity:       true,
				CollectAudit:          false,
				CollectSystem:         false,
				CollectInfo:           false,
				CollectWarn:           true,
				CollectError:          true,
				CollectCritical:       true,
				SamplingEnabled:       false,
				SamplingRate:          1.0,
				EnabledEventTypes:     []string{},
				DisabledEventTypes:    []string{},
				ExcludeUsers:          []int{},
				ExcludeIPs:            []string{},
				IncludeOnlyUsers:      []int{},
				IncludeOnlyIPs:        []string{},
			},
		},
		{
			Name:        "critical_only",
			Description: "Minimal logging - only critical issues (~10% storage)",
			Settings: Settings{
				Enabled:               true,
				CollectAuthentication: false,
				CollectSecurity:       true,
				CollectAudit:          false,
				CollectSystem:         false,
				CollectInfo:           false,
				CollectWarn:           false,
				CollectError:          true,
				CollectCritical:       true,
				SamplingEnabled:       false,
				SamplingRate:          1.0,
				EnabledEventTypes:     []string{},
				DisabledEventTypes:    []string{},
				ExcludeUsers:          []int{},
				ExcludeIPs:            []string{},
				IncludeOnlyUsers:      []int{},
				IncludeOnlyIPs:        []string{},
			},
		},
		{
			Name:        "sampled_logging",
			Description: "High volume systems - 10% sampling (~10% storage)",
			Settings: Settings{
				Enabled:               true,
				CollectAuthentication: true,
				CollectSecurity:       true,
				CollectAudit:          true,
				CollectSystem:         true,
				CollectInfo:           true,
				CollectWarn:           true,
				CollectError:          true,
				CollectCritical:       true,
				SamplingEnabled:       true,
				SamplingRate:          0.1,
				EnabledEventTypes:     []string{},
				DisabledEventTypes:    []string{},
				ExcludeUsers:          []int{},
				ExcludeIPs:            []string{},
				IncludeOnlyUsers:      []int{},
				IncludeOnlyIPs:        []string{},
			},
		},
		{
			Name:        "compliance_mode",
			Description: "Regulatory compliance - 7 year retention",
			Settings: Settings{
				Enabled:               true,
				CollectAuthentication: true,
				CollectSecurity:       true,
				CollectAudit:          true,
				CollectSystem:         false,
				CollectInfo:           false,
				CollectWarn:           true,
				CollectError:          true,
				CollectCritical:       true,
				SamplingEnabled:       false,
				SamplingRate:          1.0,
				EnabledEventTypes:     []string{},
				DisabledEventTypes:    []string{},
				ExcludeUsers:          []int{},
				ExcludeIPs:            []string{},
				IncludeOnlyUsers:      []int{},
				IncludeOnlyIPs:        []string{},
				CustomRetentionDays:   intPtr(2555), // 7 years
			},
		},
	}
}

// intPtr returns a pointer to an int
func intPtr(i int) *int {
	return &i
}
