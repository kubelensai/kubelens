package db

import (
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// =============================================================================
// Audit Statistics Types
// =============================================================================

// AuditStats represents audit log statistics
type AuditStats struct {
	TotalLogs          int              `json:"total_logs"`
	TotalEvents        int              `json:"total_events"`
	SuccessCount       int              `json:"success_count"`
	FailureCount       int              `json:"failure_count"`
	AuthEvents         int              `json:"auth_events"`
	SecurityViolations int              `json:"security_violations"`
	FailedActions      int              `json:"failed_actions"`
	TopUsers           []UserActivity   `json:"top_users"`
	TopIPs             []IPActivity     `json:"top_ips"`
	RecentCritical     []AuditLog       `json:"recent_critical"`
	EventsByCategory   map[string]int   `json:"events_by_category"`
	EventsByLevel      map[string]int   `json:"events_by_level"`
}

// UserActivity represents user activity statistics
type UserActivity struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	Count    int    `json:"count"`
}

// IPActivity represents IP activity statistics
type IPActivity struct {
	SourceIP string `json:"source_ip"`
	Count    int    `json:"count"`
}

// =============================================================================
// Audit Log CRUD Methods (extended from crud_aux.go)
// =============================================================================

// CreateAuditLog creates a new audit log entry
func (db *DB) CreateAuditLog(entry AuditLogEntry) error {
	// Set datetime if not provided
	if entry.Datetime.IsZero() {
		entry.Datetime = time.Now().UTC()
	}
	
	return db.GormDB.Create(&entry).Error
}

// ListAuditLogs retrieves audit logs with pagination and filters
func (db *DB) ListAuditLogs(page, pageSize int, filters map[string]interface{}) ([]AuditLogEntry, int, error) {
	var logs []AuditLogEntry
	var total int64
	
	tx := db.GormDB.Model(&AuditLog{})
	
	// Apply filters
	if eventCategory, ok := filters["event_category"].(string); ok && eventCategory != "" {
		tx = tx.Where("event_category = ?", eventCategory)
	}
	
	if eventType, ok := filters["event_type"].(string); ok && eventType != "" {
		tx = tx.Where("event_type = ?", eventType)
	}
	
	if level, ok := filters["level"].(string); ok && level != "" {
		tx = tx.Where("level = ?", level)
	}
	
	if userID, ok := filters["user_id"].(int); ok && userID > 0 {
		uid := uint(userID)
		tx = tx.Where("user_id = ?", uid)
	}
	
	if username, ok := filters["username"].(string); ok && username != "" {
		tx = tx.Where("username LIKE ?", "%"+username+"%")
	}
	
	if sourceIP, ok := filters["source_ip"].(string); ok && sourceIP != "" {
		tx = tx.Where("source_ip = ?", sourceIP)
	}
	
	if resource, ok := filters["resource"].(string); ok && resource != "" {
		tx = tx.Where("resource LIKE ?", "%"+resource+"%")
	}
	
	if action, ok := filters["action"].(string); ok && action != "" {
		tx = tx.Where("action LIKE ?", "%"+action+"%")
	}
	
	if success, ok := filters["success"].(bool); ok {
		tx = tx.Where("success = ?", success)
	}
	
	// Date range filters
	if startDate, ok := filters["start_date"].(time.Time); ok && !startDate.IsZero() {
		tx = tx.Where("datetime >= ?", startDate)
	}
	
	if endDate, ok := filters["end_date"].(time.Time); ok && !endDate.IsZero() {
		tx = tx.Where("datetime <= ?", endDate)
	}
	
	// Count total
	tx.Count(&total)
	
	// Get paginated results
	offset := (page - 1) * pageSize
	err := tx.Offset(offset).
		Limit(pageSize).
		Order("datetime DESC").
		Find(&logs).Error
	
	return logs, int(total), err
}

// GetAuditLogStats retrieves audit log statistics
func (db *DB) GetAuditLogStats(startDate, endDate time.Time) (*AuditStats, error) {
	stats := &AuditStats{
		EventsByCategory: make(map[string]int),
		EventsByLevel:    make(map[string]int),
	}
	
	tx := db.GormDB.Model(&AuditLog{})
	
	if !startDate.IsZero() {
		tx = tx.Where("datetime >= ?", startDate)
	}
	
	if !endDate.IsZero() {
		tx = tx.Where("datetime <= ?", endDate)
	}
	
	// Total logs
	var totalLogs int64
	tx.Count(&totalLogs)
	stats.TotalLogs = int(totalLogs)
	
	// Success/Failure counts
	var successCount int64
	tx.Where("success = ?", true).Count(&successCount)
	stats.SuccessCount = int(successCount)
	
	var failureCount int64
	tx.Where("success = ?", false).Count(&failureCount)
	stats.FailureCount = int(failureCount)
	
	// Auth events
	var authCount int64
	tx.Where("event_category = ?", "authentication").Count(&authCount)
	stats.AuthEvents = int(authCount)
	
	// Security violations
	var securityCount int64
	tx.Where("event_category = ? AND success = ?", "security", false).Count(&securityCount)
	stats.SecurityViolations = int(securityCount)
	
	// Failed actions
	stats.FailedActions = stats.FailureCount
	
	// Events by category
	type CategoryCount struct {
		EventCategory string
		Count         int64
	}
	var categoryCounts []CategoryCount
	db.GormDB.Model(&AuditLog{}).
		Select("event_category, COUNT(*) as count").
		Where("datetime >= ? AND datetime <= ?", startDate, endDate).
		Group("event_category").
		Scan(&categoryCounts)
	
	for _, cc := range categoryCounts {
		stats.EventsByCategory[cc.EventCategory] = int(cc.Count)
	}
	
	// Events by level
	type LevelCount struct {
		Level string
		Count int64
	}
	var levelCounts []LevelCount
	db.GormDB.Model(&AuditLog{}).
		Select("level, COUNT(*) as count").
		Where("datetime >= ? AND datetime <= ?", startDate, endDate).
		Group("level").
		Scan(&levelCounts)
	
	for _, lc := range levelCounts {
		stats.EventsByLevel[lc.Level] = int(lc.Count)
	}
	
	// Top users
	type UserCount struct {
		UserID   *uint
		Username string
		Count    int64
	}
	var userCounts []UserCount
	db.GormDB.Model(&AuditLog{}).
		Select("user_id, username, COUNT(*) as count").
		Where("datetime >= ? AND datetime <= ? AND user_id IS NOT NULL", startDate, endDate).
		Group("user_id, username").
		Order("count DESC").
		Limit(10).
		Scan(&userCounts)
	
	for _, uc := range userCounts {
		if uc.UserID != nil {
			stats.TopUsers = append(stats.TopUsers, UserActivity{
				UserID:   *uc.UserID,
				Username: uc.Username,
				Count:    int(uc.Count),
			})
		}
	}
	
	// Top IPs
	type IPCount struct {
		SourceIP string
		Count    int64
	}
	var ipCounts []IPCount
	db.GormDB.Model(&AuditLog{}).
		Select("source_ip, COUNT(*) as count").
		Where("datetime >= ? AND datetime <= ?", startDate, endDate).
		Group("source_ip").
		Order("count DESC").
		Limit(10).
		Scan(&ipCounts)
	
	for _, ic := range ipCounts {
		stats.TopIPs = append(stats.TopIPs, IPActivity{
			SourceIP: ic.SourceIP,
			Count:    int(ic.Count),
		})
	}
	
	// Recent critical logs
	db.GormDB.Where("level = ? AND datetime >= ? AND datetime <= ?", "CRITICAL", startDate, endDate).
		Order("datetime DESC").
		Limit(10).
		Find(&stats.RecentCritical)
	
	return stats, nil
}

// DeleteAuditLogsBefore deletes audit logs before a specific date
func (db *DB) DeleteAuditLogsBefore(before time.Time) (int64, error) {
	result := db.GormDB.Where("datetime < ?", before).Delete(&AuditLog{})
	return result.RowsAffected, result.Error
}

// =============================================================================
// Audit Settings Methods (extended from crud_aux.go)
// =============================================================================

// GetAuditSettings retrieves audit settings (overrides crud_aux.go)
func (db *DB) GetAuditSettings() (*AuditSettings, error) {
	var settings AuditSettings
	err := db.GormDB.First(&settings).Error
	if err == gorm.ErrRecordNotFound {
		// Create default settings
		settings = AuditSettings{
			Enabled:               true,
			CollectAuthentication: true,
			CollectSecurity:       true,
			CollectAudit:          true,
			CollectSystem:         false,
			CollectInfo:           true,
			CollectWarn:           true,
			CollectError:          true,
			CollectCritical:       true,
			SamplingEnabled:       false,
			SamplingRate:          1.0,
		}
		if err := db.GormDB.Create(&settings).Error; err != nil {
			return nil, err
		}
	}
	
	// Populate legacy fields for backward compatibility
	settings.AuthEventsEnabled = settings.CollectAuthentication
	settings.SecurityEventsEnabled = settings.CollectSecurity
	settings.K8sEventsEnabled = settings.CollectAudit
	if settings.CustomRetentionDays != nil {
		settings.RetentionDays = *settings.CustomRetentionDays
	} else {
		settings.RetentionDays = 90 // default
	}
	
	return &settings, nil
}

// UpdateAuditSettings updates audit settings (overrides crud_aux.go)
func (db *DB) UpdateAuditSettings(settings *AuditSettings) error {
	// Update legacy fields from new fields if set
	settings.CollectAuthentication = settings.AuthEventsEnabled || settings.CollectAuthentication
	settings.CollectSecurity = settings.SecurityEventsEnabled || settings.CollectSecurity
	settings.CollectAudit = settings.K8sEventsEnabled || settings.CollectAudit
	
	if settings.RetentionDays > 0 {
		settings.CustomRetentionDays = &settings.RetentionDays
	}
	
	return db.GormDB.Save(settings).Error
}

// IsEventEnabled checks if an event type is enabled based on settings
func (db *DB) IsEventEnabled(settings *AuditSettings, eventCategory, level string) bool {
	if !settings.Enabled {
		return false
	}
	
	// Check category
	switch eventCategory {
	case "authentication":
		if !settings.CollectAuthentication {
			return false
		}
	case "security":
		if !settings.CollectSecurity {
			return false
		}
	case "audit":
		if !settings.CollectAudit {
			return false
		}
	case "system":
		if !settings.CollectSystem {
			return false
		}
	}
	
	// Check level
	switch level {
	case "INFO":
		return settings.CollectInfo
	case "WARN", "WARNING":
		return settings.CollectWarn
	case "ERROR":
		return settings.CollectError
	case "CRITICAL", "FATAL":
		return settings.CollectCritical
	}
	
	return true
}

// SearchAuditLogs searches audit logs with flexible criteria
func (db *DB) SearchAuditLogs(query string, page, pageSize int) ([]AuditLogEntry, int, error) {
	var logs []AuditLogEntry
	var total int64
	
	tx := db.GormDB.Model(&AuditLog{})
	
	if query != "" {
		searchPattern := "%" + query + "%"
		tx = tx.Where(
			db.GormDB.Where("username LIKE ?", searchPattern).
				Or("email LIKE ?", searchPattern).
				Or("source_ip LIKE ?", searchPattern).
				Or("resource LIKE ?", searchPattern).
				Or("action LIKE ?", searchPattern).
				Or("description LIKE ?", searchPattern),
		)
	}
	
	// Count total
	tx.Count(&total)
	
	// Get paginated results
	offset := (page - 1) * pageSize
	err := tx.Offset(offset).
		Limit(pageSize).
		Order("datetime DESC").
		Find(&logs).Error
	
	return logs, int(total), err
}

// GetRecentAuditLogs retrieves the most recent audit logs
func (db *DB) GetRecentAuditLogs(limit int) ([]AuditLogEntry, error) {
	var logs []AuditLogEntry
	err := db.GormDB.Order("datetime DESC").Limit(limit).Find(&logs).Error
	return logs, err
}

// GetAuditLogsByUser retrieves audit logs for a specific user
func (db *DB) GetAuditLogsByUser(userID uint, page, pageSize int) ([]AuditLogEntry, int, error) {
	var logs []AuditLogEntry
	var total int64
	
	tx := db.GormDB.Where("user_id = ?", userID)
	
	// Count total
	tx.Model(&AuditLog{}).Count(&total)
	
	// Get paginated results
	offset := (page - 1) * pageSize
	err := tx.Offset(offset).
		Limit(pageSize).
		Order("datetime DESC").
		Find(&logs).Error
	
	return logs, int(total), err
}

// GetAuditLogsByIP retrieves audit logs for a specific IP
func (db *DB) GetAuditLogsByIP(sourceIP string, page, pageSize int) ([]AuditLogEntry, int, error) {
	var logs []AuditLogEntry
	var total int64
	
	tx := db.GormDB.Where("source_ip = ?", sourceIP)
	
	// Count total
	tx.Model(&AuditLog{}).Count(&total)
	
	// Get paginated results
	offset := (page - 1) * pageSize
	err := tx.Offset(offset).
		Limit(pageSize).
		Order("datetime DESC").
		Find(&logs).Error
	
	return logs, int(total), err
}

// CountAuditLogs counts total audit logs
func (db *DB) CountAuditLogs() (int64, error) {
	var count int64
	err := db.GormDB.Model(&AuditLog{}).Count(&count).Error
	return count, err
}

// CountAuditLogsByCategory counts audit logs by category
func (db *DB) CountAuditLogsByCategory(category string) (int64, error) {
	var count int64
	err := db.GormDB.Model(&AuditLog{}).
		Where("event_category = ?", category).
		Count(&count).Error
	return count, err
}

// GetAuditLogByID retrieves a single audit log by ID (renamed from GetAuditLog in crud_aux.go)
func (db *DB) GetAuditLogByID(id uint) (*AuditLogEntry, error) {
	var log AuditLog
	err := db.GormDB.First(&log, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("audit log not found with ID: %d", id)
	}
	return &log, err
}

// Helper function to format metadata as JSON
func FormatMetadata(data interface{}) string {
	if data == nil {
		return ""
	}
	
	bytes, err := json.Marshal(data)
	if err != nil {
		return fmt.Sprintf("%v", data)
	}
	
	return string(bytes)
}

// GetRetentionStats retrieves retention statistics
func (db *DB) GetRetentionStats() (map[string]interface{}, error) {
	stats := make(map[string]interface{})
	
	// Get total logs count
	var totalCount int64
	db.GormDB.Model(&AuditLog{}).Count(&totalCount)
	stats["total_logs"] = totalCount
	
	// Get oldest log date
	var oldestLog AuditLog
	if err := db.GormDB.Order("datetime ASC").First(&oldestLog).Error; err == nil {
		stats["oldest_log_date"] = oldestLog.Datetime
		stats["retention_period_days"] = int(time.Since(oldestLog.Datetime).Hours() / 24)
	}
	
	// Get newest log date
	var newestLog AuditLog
	if err := db.GormDB.Order("datetime DESC").First(&newestLog).Error; err == nil {
		stats["newest_log_date"] = newestLog.Datetime
	}
	
	// Get average logs per day
	if totalCount > 0 && stats["oldest_log_date"] != nil {
		days := int(time.Since(stats["oldest_log_date"].(time.Time)).Hours() / 24)
		if days > 0 {
			stats["avg_logs_per_day"] = int(totalCount) / days
		}
	}
	
	return stats, nil
}

// VacuumDatabase runs VACUUM to reclaim space (SQLite-specific optimization)
func (db *DB) VacuumDatabase() error {
	// For SQLite, run VACUUM to reclaim space
	if db.GormDB.GetDialect() == "sqlite" {
		return db.GormDB.Exec("VACUUM").Error
	}
	// For PostgreSQL and MySQL, this is less critical
	return nil
}

// ArchiveAuditLogs archives old audit logs (placeholder for future implementation)
func (db *DB) ArchiveAuditLogs(before time.Time) (int, error) {
	// Future implementation: Move logs to an archive table
	// For now, we just return 0 (no archiving)
	return 0, nil
}

// DeleteOldAuditLogs is an alias for DeleteAuditLogsBefore for backward compatibility
func (db *DB) DeleteOldAuditLogs(before time.Time) (int, error) {
	deleted, err := db.DeleteAuditLogsBefore(before)
	return int(deleted), err
}

