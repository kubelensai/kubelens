package audit

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sonnguyen/kubelens/internal/db"
	"github.com/sonnguyen/kubelens/internal/middleware"

	log "github.com/sirupsen/logrus"
)

// Global logger instance
var globalLogger *Logger

// Logger handles audit logging with settings-aware filtering
type Logger struct {
	db       *db.DB
	settings *Settings
	mu       sync.RWMutex
}

// NewLogger creates a new audit logger
func NewLogger(database *db.DB) *Logger {
	logger := &Logger{
		db: database,
	}

	// Load settings from database
	settings, err := database.GetAuditSettings()
	if err != nil {
		log.Warnf("Failed to load audit settings, using defaults: %v", err)
		settings = DefaultSettings()
	}
	logger.settings = settings

	// Refresh settings every 5 minutes
	go logger.refreshSettings()

	log.Info("✅ Audit logger initialized")
	return logger
}

// Log creates an audit log entry (with settings check)
func (al *Logger) Log(entry LogEntry) error {
	// Get current settings (thread-safe)
	al.mu.RLock()
	settings := al.settings
	al.mu.RUnlock()

	// Check if we should log this event
	if !settings.ShouldLog(entry) {
		return nil // Silently skip
	}

	// Set default timestamps if not provided
	if entry.Datetime.IsZero() {
		entry.Datetime = time.Now()
	}
	if entry.CreatedAt.IsZero() {
		entry.CreatedAt = time.Now()
	}

	// Validate and sanitize
	if err := al.validate(&entry); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	// Create log entry in database
	return al.db.CreateAuditLog(entry)
}

// LogSimple creates a simple audit log entry with minimal fields
func (al *Logger) LogSimple(eventType, eventCategory, level, description string, success bool) error {
	return al.Log(LogEntry{
		EventType:     eventType,
		EventCategory: eventCategory,
		Level:         level,
		Description:   description,
		Success:       success,
	})
}

// LogAuth creates an authentication-related audit log entry
func (al *Logger) LogAuth(eventType string, userID *int, username, email, sourceIP, description string, success bool) error {
	level := LevelInfo
	if !success {
		level = LevelWarn
	}

	// Convert *int to *uint
	var uid *uint
	if userID != nil {
		u := uint(*userID)
		uid = &u
	}

	return al.Log(LogEntry{
		EventType:     eventType,
		EventCategory: CategoryAuthentication,
		Level:         level,
		UserID:        uid,
		Username:      username,
		Email:         email,
		SourceIP:      sourceIP,
		Description:   description,
		Success:       success,
	})
}

// LogSecurity creates a security-related audit log entry
func (al *Logger) LogSecurity(eventType string, userID *int, username, sourceIP, description string, level string) error {
	// Convert *int to *uint
	var uid *uint
	if userID != nil {
		u := uint(*userID)
		uid = &u
	}

	return al.Log(LogEntry{
		EventType:     eventType,
		EventCategory: CategorySecurity,
		Level:         level,
		UserID:        uid,
		Username:      username,
		SourceIP:      sourceIP,
		Description:   description,
		Success:       false, // Security events are typically failures
	})
}

// LogAudit creates an audit-related log entry
func (al *Logger) LogAudit(eventType string, userID *int, username, resource, action, description string, success bool) error {
	level := LevelInfo
	if !success {
		level = LevelError
	}

	// Convert *int to *uint
	var uid *uint
	if userID != nil {
		u := uint(*userID)
		uid = &u
	}

	return al.Log(LogEntry{
		EventType:     eventType,
		EventCategory: CategoryAudit,
		Level:         level,
		UserID:        uid,
		Username:      username,
		Resource:      resource,
		Action:        action,
		Description:   description,
		Success:       success,
	})
}

// LogSystem creates a system-related audit log entry
func (al *Logger) LogSystem(eventType, description string, level string, success bool) error {
	return al.Log(LogEntry{
		EventType:     eventType,
		EventCategory: CategorySystem,
		Level:         level,
		Description:   description,
		Success:       success,
	})
}

// validate validates and sanitizes log entry
func (al *Logger) validate(entry *LogEntry) error {
	// Required fields
	if entry.EventType == "" {
		return fmt.Errorf("event_type is required")
	}
	if entry.EventCategory == "" {
		return fmt.Errorf("event_category is required")
	}
	if entry.Level == "" {
		return fmt.Errorf("level is required")
	}
	if entry.Description == "" {
		return fmt.Errorf("description is required")
	}

	// Sanitize strings to prevent XSS/injection
	entry.EventType = middleware.SanitizeString(entry.EventType)
	entry.EventCategory = middleware.SanitizeString(entry.EventCategory)
	entry.Level = middleware.SanitizeString(entry.Level)
	entry.Description = middleware.SanitizeString(entry.Description)
	entry.Username = middleware.SanitizeString(entry.Username)
	entry.Email = middleware.SanitizeString(entry.Email)
	entry.Resource = middleware.SanitizeString(entry.Resource)
	entry.Action = middleware.SanitizeString(entry.Action)

	// Truncate long fields to prevent database bloat
	if len(entry.Description) > 1000 {
		entry.Description = entry.Description[:1000] + "... (truncated)"
	}
	if len(entry.Metadata) > 10000 {
		entry.Metadata = entry.Metadata[:10000] + "... (truncated)"
	}
	if len(entry.ErrorMessage) > 1000 {
		entry.ErrorMessage = entry.ErrorMessage[:1000] + "... (truncated)"
	}

	// Validate event category
	validCategories := map[string]bool{
		CategoryAuthentication: true,
		CategorySecurity:       true,
		CategoryAudit:          true,
		CategorySystem:         true,
	}
	if !validCategories[entry.EventCategory] {
		return fmt.Errorf("invalid event_category: %s", entry.EventCategory)
	}

	// Validate log level
	validLevels := map[string]bool{
		LevelInfo:     true,
		LevelWarn:     true,
		LevelError:    true,
		LevelCritical: true,
	}
	if !validLevels[entry.Level] {
		return fmt.Errorf("invalid level: %s", entry.Level)
	}

	return nil
}

// refreshSettings refreshes settings from database periodically
func (al *Logger) refreshSettings() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		settings, err := al.db.GetAuditSettings()
		if err != nil {
			log.Warnf("Failed to refresh audit settings: %v", err)
			continue
		}

		al.mu.Lock()
		al.settings = settings
		al.mu.Unlock()

		log.Debug("Audit settings refreshed from database")
	}
}

// GetSettings returns the current settings (thread-safe)
func (al *Logger) GetSettings() *Settings {
	al.mu.RLock()
	defer al.mu.RUnlock()
	return al.settings
}

// UpdateSettings updates the settings and refreshes the cache
func (al *Logger) UpdateSettings(settings *Settings) {
	al.mu.Lock()
	al.settings = settings
	al.mu.Unlock()
	log.Info("Audit settings updated in memory")
}

// InitGlobalLogger initializes the global audit logger
func InitGlobalLogger(database *db.DB) {
	globalLogger = NewLogger(database)
}

// Log is a package-level helper function for logging audit events
func Log(c *gin.Context, eventType string, userID int, username, email, description string, metadata map[string]interface{}) {
	if globalLogger == nil {
		log.Warn("Global audit logger not initialized")
		return
	}

	// Convert metadata to JSON string
	metadataJSON := ""
	if metadata != nil {
		if jsonBytes, err := json.Marshal(metadata); err == nil {
			metadataJSON = string(jsonBytes)
		}
	}

	// Get source IP and user agent from context
	sourceIP := c.ClientIP()
	userAgent := c.Request.UserAgent()
	requestMethod := c.Request.Method
	requestURI := c.Request.RequestURI

	// Determine category and level based on event type
	category, level := categorizeEvent(eventType)

	// Convert int userID to *uint
	var uid *uint
	if userID > 0 {
		u := uint(userID)
		uid = &u
	}

	entry := LogEntry{
		EventType:     eventType,
		EventCategory: category,
		Level:         level,
		UserID:        uid,
		Username:      username,
		Email:         email,
		SourceIP:      sourceIP,
		UserAgent:     userAgent,
		RequestMethod: requestMethod,
		RequestURI:    requestURI,
		Description:   description,
		Metadata:      metadataJSON,
		Success:       true,
		Datetime:      time.Now(),
		CreatedAt:     time.Now(),
	}

	if err := globalLogger.Log(entry); err != nil {
		log.Errorf("Failed to create audit log: %v", err)
	}
}

// categorizeEvent determines the category and level for an event type
func categorizeEvent(eventType string) (string, string) {
	// Authentication events
	authEvents := map[string]bool{
		EventLoginSuccess: true, EventLoginFailed: true, EventLogout: true,
		EventPasswordChanged: true, EventPasswordResetRequested: true,
		EventMFAEnabled: true, EventMFADisabled: true, EventMFAVerified: true, EventMFAFailed: true,
		EventAccountLocked: true, EventAccountUnlocked: true,
	}
	if authEvents[eventType] {
		if eventType == EventLoginFailed || eventType == EventMFAFailed || eventType == EventAccountLocked {
			return CategoryAuthentication, LevelWarn
		}
		return CategoryAuthentication, LevelInfo
	}

	// Security events
	securityEvents := map[string]bool{
		EventRateLimitExceeded: true, EventSQLInjectionAttempt: true, EventXSSAttempt: true,
		EventInvalidToken: true, EventUnauthorizedAccess: true,
	}
	if securityEvents[eventType] {
		return CategorySecurity, LevelWarn
	}

	// Audit events (user, group, cluster, resource operations)
	auditEvents := map[string]bool{
		EventUserCreated: true, EventUserUpdated: true, EventUserDeleted: true,
		EventGroupCreated: true, EventGroupUpdated: true, EventGroupDeleted: true,
		EventClusterAdded: true, EventClusterUpdated: true, EventClusterRemoved: true,
	}
	if auditEvents[eventType] {
		return CategoryAudit, LevelInfo
	}

	// Default to audit/info
	return CategoryAudit, LevelInfo
}
