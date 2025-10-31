package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// Audit log types (moved here to avoid circular import)

// AuditLogEntry represents a single audit log entry
type AuditLogEntry struct {
	ID             int       `json:"id"`
	Datetime       time.Time `json:"datetime"`
	EventType      string    `json:"event_type"`
	EventCategory  string    `json:"event_category"`
	Level          string    `json:"level"`
	UserID         *int      `json:"user_id,omitempty"`
	Username       string    `json:"username,omitempty"`
	Email          string    `json:"email,omitempty"`
	SourceIP       string    `json:"source_ip"`
	UserAgent      string    `json:"user_agent,omitempty"`
	Resource       string    `json:"resource,omitempty"`
	Action         string    `json:"action,omitempty"`
	Description    string    `json:"description"`
	Metadata       string    `json:"metadata,omitempty"`
	Success        bool      `json:"success"`
	ErrorMessage   string    `json:"error_message,omitempty"`
	RequestMethod  string    `json:"request_method,omitempty"`
	RequestURI     string    `json:"request_uri,omitempty"`
	ResponseCode   int       `json:"response_code,omitempty"`
	DurationMs     int       `json:"duration_ms,omitempty"`
	SessionID      string    `json:"session_id,omitempty"`
	CorrelationID  string    `json:"correlation_id,omitempty"`
	GeoLocation    string    `json:"geo_location,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

// AuditSettings represents audit log settings
type AuditSettings struct {
	ID                      int       `json:"id"`
	UserID                  *int      `json:"user_id,omitempty"`
	Enabled                 bool      `json:"enabled"`
	CollectAuthentication   bool      `json:"collect_authentication"`
	CollectSecurity         bool      `json:"collect_security"`
	CollectAudit            bool      `json:"collect_audit"`
	CollectSystem           bool      `json:"collect_system"`
	CollectInfo             bool      `json:"collect_info"`
	CollectWarn             bool      `json:"collect_warn"`
	CollectError            bool      `json:"collect_error"`
	CollectCritical         bool      `json:"collect_critical"`
	EnabledEventTypes       []string  `json:"enabled_event_types"`
	DisabledEventTypes      []string  `json:"disabled_event_types"`
	SamplingEnabled         bool      `json:"sampling_enabled"`
	SamplingRate            float64   `json:"sampling_rate"`
	ExcludeUsers            []int     `json:"exclude_users"`
	ExcludeIPs              []string  `json:"exclude_ips"`
	IncludeOnlyUsers        []int     `json:"include_only_users"`
	IncludeOnlyIPs          []string  `json:"include_only_ips"`
	CustomRetentionDays     *int      `json:"custom_retention_days,omitempty"`
	UpdatedAt               time.Time `json:"updated_at"`
	UpdatedBy               *int      `json:"updated_by,omitempty"`
}

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
	RecentCritical     []AuditLogEntry  `json:"recent_critical"`
	EventsByCategory   map[string]int   `json:"events_by_category"`
	EventsByLevel      map[string]int   `json:"events_by_level"`
}

// UserActivity represents user activity statistics
type UserActivity struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
	Count    int    `json:"count"`
}

// IPActivity represents IP activity statistics
type IPActivity struct {
	SourceIP string `json:"source_ip"`
	Count    int    `json:"count"`
}

// CreateAuditLog creates a new audit log entry
func (db *DB) CreateAuditLog(entry AuditLogEntry) error {
	// Metadata is already a string in AuditLogEntry
	metadataJSON := entry.Metadata

	query := `
		INSERT INTO audit_logs (
			datetime, event_type, event_category, level,
			user_id, username, email, source_ip, user_agent,
			resource, action, description, metadata,
			success, error_message, request_method, request_uri,
			response_code, duration_ms, session_id, correlation_id, geo_location
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := db.conn.Exec(query,
		time.Now().UTC(),
		entry.EventType,
		entry.EventCategory,
		entry.Level,
		entry.UserID,
		entry.Username,
		entry.Email,
		entry.SourceIP,
		entry.UserAgent,
		entry.Resource,
		entry.Action,
		entry.Description,
		metadataJSON,
		entry.Success,
		entry.ErrorMessage,
		entry.RequestMethod,
		entry.RequestURI,
		entry.ResponseCode,
		entry.DurationMs,
		entry.SessionID,
		entry.CorrelationID,
		entry.GeoLocation,
	)

	return err
}

// ListAuditLogs retrieves audit logs with pagination and filters
func (db *DB) ListAuditLogs(page, pageSize int, filters map[string]interface{}) ([]AuditLogEntry, int, error) {
	// Build WHERE clause
	whereClauses := []string{}
	args := []interface{}{}

	if eventCategory, ok := filters["event_category"].(string); ok && eventCategory != "" {
		whereClauses = append(whereClauses, "event_category = ?")
		args = append(args, eventCategory)
	}

	if eventType, ok := filters["event_type"].(string); ok && eventType != "" {
		whereClauses = append(whereClauses, "event_type = ?")
		args = append(args, eventType)
	}

	if level, ok := filters["level"].(string); ok && level != "" {
		whereClauses = append(whereClauses, "level = ?")
		args = append(args, level)
	}

	if userID, ok := filters["user_id"].(string); ok && userID != "" {
		whereClauses = append(whereClauses, "user_id = ?")
		args = append(args, userID)
	}

	if sourceIP, ok := filters["source_ip"].(string); ok && sourceIP != "" {
		whereClauses = append(whereClauses, "source_ip = ?")
		args = append(args, sourceIP)
	}

	if success, ok := filters["success"].(string); ok && success != "" {
		whereClauses = append(whereClauses, "success = ?")
		if success == "true" {
			args = append(args, 1)
		} else {
			args = append(args, 0)
		}
	}

	if startDate, ok := filters["start_date"].(string); ok && startDate != "" {
		whereClauses = append(whereClauses, "datetime >= ?")
		args = append(args, startDate)
	}

	if endDate, ok := filters["end_date"].(string); ok && endDate != "" {
		whereClauses = append(whereClauses, "datetime <= ?")
		args = append(args, endDate)
	}

	if search, ok := filters["search"].(string); ok && search != "" {
		whereClauses = append(whereClauses, "(description LIKE ? OR username LIKE ? OR email LIKE ? OR source_ip LIKE ?)")
		searchPattern := "%" + search + "%"
		args = append(args, searchPattern, searchPattern, searchPattern, searchPattern)
	}

	whereClause := ""
	if len(whereClauses) > 0 {
		whereClause = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	// Get total count
	countQuery := "SELECT COUNT(*) FROM audit_logs " + whereClause
	var total int
	err := db.conn.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count audit logs: %w", err)
	}

	// Get paginated results
	offset := (page - 1) * pageSize
	query := fmt.Sprintf(`
		SELECT 
			id, datetime, event_type, event_category, level,
			user_id, username, email, source_ip, user_agent,
			resource, action, description, metadata,
			success, error_message, request_method, request_uri,
			response_code, duration_ms, session_id, correlation_id, geo_location,
			created_at
		FROM audit_logs
		%s
		ORDER BY datetime DESC
		LIMIT ? OFFSET ?
	`, whereClause)

	args = append(args, pageSize, offset)
	rows, err := db.conn.Query(query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query audit logs: %w", err)
	}
	defer rows.Close()

	logs := []AuditLogEntry{}
	for rows.Next() {
		var log AuditLogEntry
		var userID sql.NullInt64
		var username, email, userAgent, resource, action, metadataJSON, errorMessage sql.NullString
		var requestMethod, requestURI, sessionID, correlationID, geoLocation sql.NullString
		var responseCode, durationMS sql.NullInt64

		err := rows.Scan(
			&log.ID,
			&log.Datetime,
			&log.EventType,
			&log.EventCategory,
			&log.Level,
			&userID,
			&username,
			&email,
			&log.SourceIP,
			&userAgent,
			&resource,
			&action,
			&log.Description,
			&metadataJSON,
			&log.Success,
			&errorMessage,
			&requestMethod,
			&requestURI,
			&responseCode,
			&durationMS,
			&sessionID,
			&correlationID,
			&geoLocation,
			&log.CreatedAt,
		)
		if err != nil {
			continue
		}

		// Handle nullable fields
		if userID.Valid {
			id := int(userID.Int64)
			log.UserID = &id
		}
		if username.Valid {
			log.Username = username.String
		}
		if email.Valid {
			log.Email = email.String
		}
		if userAgent.Valid {
			log.UserAgent = userAgent.String
		}
		if resource.Valid {
			log.Resource = resource.String
		}
		if action.Valid {
			log.Action = action.String
		}
		if errorMessage.Valid {
			log.ErrorMessage = errorMessage.String
		}
		if requestMethod.Valid {
			log.RequestMethod = requestMethod.String
		}
		if requestURI.Valid {
			log.RequestURI = requestURI.String
		}
		if responseCode.Valid {
			log.ResponseCode = int(responseCode.Int64)
		}
		if durationMS.Valid {
			log.DurationMs = int(durationMS.Int64)
		}
		if sessionID.Valid {
			log.SessionID = sessionID.String
		}
		if correlationID.Valid {
			log.CorrelationID = correlationID.String
		}
		if geoLocation.Valid {
			log.GeoLocation = geoLocation.String
		}

		// Parse metadata JSON
		if metadataJSON.Valid && metadataJSON.String != "" {
			log.Metadata = metadataJSON.String
		}

		logs = append(logs, log)
	}

	return logs, total, nil
}

// GetAuditLog retrieves a single audit log by ID
func (db *DB) GetAuditLog(id int) (*AuditLogEntry, error) {
	query := `
		SELECT 
			id, datetime, event_type, event_category, level,
			user_id, username, email, source_ip, user_agent,
			resource, action, description, metadata,
			success, error_message, request_method, request_uri,
			response_code, duration_ms, session_id, correlation_id, geo_location,
			created_at
		FROM audit_logs
		WHERE id = ?
	`

	var log AuditLogEntry
	var userID sql.NullInt64
	var username, email, userAgent, resource, action, metadataJSON, errorMessage sql.NullString
	var requestMethod, requestURI, sessionID, correlationID, geoLocation sql.NullString
	var responseCode, durationMS sql.NullInt64

	err := db.conn.QueryRow(query, id).Scan(
		&log.ID,
		&log.Datetime,
		&log.EventType,
		&log.EventCategory,
		&log.Level,
		&userID,
		&username,
		&email,
		&log.SourceIP,
		&userAgent,
		&resource,
		&action,
		&log.Description,
		&metadataJSON,
		&log.Success,
		&errorMessage,
		&requestMethod,
		&requestURI,
		&responseCode,
		&durationMS,
		&sessionID,
		&correlationID,
		&geoLocation,
		&log.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Handle nullable fields (same as ListAuditLogs)
	if userID.Valid {
		id := int(userID.Int64)
		log.UserID = &id
	}
	if username.Valid {
		log.Username = username.String
	}
	if email.Valid {
		log.Email = email.String
	}
	if userAgent.Valid {
		log.UserAgent = userAgent.String
	}
	if resource.Valid {
		log.Resource = resource.String
	}
	if action.Valid {
		log.Action = action.String
	}
	if errorMessage.Valid {
		log.ErrorMessage = errorMessage.String
	}
	if requestMethod.Valid {
		log.RequestMethod = requestMethod.String
	}
	if requestURI.Valid {
		log.RequestURI = requestURI.String
	}
	if responseCode.Valid {
		log.ResponseCode = int(responseCode.Int64)
	}
	if durationMS.Valid {
		log.DurationMs = int(durationMS.Int64)
	}
	if sessionID.Valid {
		log.SessionID = sessionID.String
	}
	if correlationID.Valid {
		log.CorrelationID = correlationID.String
	}
	if geoLocation.Valid {
		log.GeoLocation = geoLocation.String
	}

	// Parse metadata JSON
	if metadataJSON.Valid && metadataJSON.String != "" {
		log.Metadata = metadataJSON.String
	}

	return &log, nil
}

// GetAuditStats retrieves audit log statistics
func (db *DB) GetAuditStats(period string) (*AuditStats, error) {
	// Parse period (24h, 7d, 30d)
	var since time.Time
	switch period {
	case "24h":
		since = time.Now().Add(-24 * time.Hour)
	case "7d":
		since = time.Now().Add(-7 * 24 * time.Hour)
	case "30d":
		since = time.Now().Add(-30 * 24 * time.Hour)
	default:
		since = time.Now().Add(-24 * time.Hour)
	}

	stats := &AuditStats{
		EventsByCategory: make(map[string]int),
		EventsByLevel:    make(map[string]int),
		TopUsers:         []UserActivity{},
		TopIPs:           []IPActivity{},
		RecentCritical:   []AuditLogEntry{},
	}

	// Total events
	err := db.conn.QueryRow("SELECT COUNT(*) FROM audit_logs WHERE datetime >= ?", since).Scan(&stats.TotalEvents)
	if err != nil {
		return nil, err
	}

	// Auth events
	err = db.conn.QueryRow("SELECT COUNT(*) FROM audit_logs WHERE event_category = ? AND datetime >= ?",
		"authentication", since).Scan(&stats.AuthEvents)
	if err != nil {
		return nil, err
	}

	// Security violations
	err = db.conn.QueryRow("SELECT COUNT(*) FROM audit_logs WHERE event_category = ? AND datetime >= ?",
		"security", since).Scan(&stats.SecurityViolations)
	if err != nil {
		return nil, err
	}

	// Failed actions
	err = db.conn.QueryRow("SELECT COUNT(*) FROM audit_logs WHERE success = 0 AND datetime >= ?", since).Scan(&stats.FailedActions)
	if err != nil {
		return nil, err
	}

	// Events by category
	rows, err := db.conn.Query("SELECT event_category, COUNT(*) as count FROM audit_logs WHERE datetime >= ? GROUP BY event_category", since)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var category string
			var count int
			if err := rows.Scan(&category, &count); err == nil {
				stats.EventsByCategory[category] = count
			}
		}
	}

	// Events by level
	rows, err = db.conn.Query("SELECT level, COUNT(*) as count FROM audit_logs WHERE datetime >= ? GROUP BY level", since)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var level string
			var count int
			if err := rows.Scan(&level, &count); err == nil {
				stats.EventsByLevel[level] = count
			}
		}
	}

	// Top users
	rows, err = db.conn.Query(`
		SELECT user_id, username, COUNT(*) as count 
		FROM audit_logs 
		WHERE datetime >= ? AND user_id IS NOT NULL
		GROUP BY user_id, username 
		ORDER BY count DESC 
		LIMIT 10
	`, since)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var activity UserActivity
			if err := rows.Scan(&activity.UserID, &activity.Username, &activity.Count); err == nil {
				stats.TopUsers = append(stats.TopUsers, activity)
			}
		}
	}

	// Top IPs
	rows, err = db.conn.Query(`
		SELECT source_ip, COUNT(*) as count 
		FROM audit_logs 
		WHERE datetime >= ? 
		GROUP BY source_ip 
		ORDER BY count DESC 
		LIMIT 10
	`, since)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var activity IPActivity
			if err := rows.Scan(&activity.SourceIP, &activity.Count); err == nil {
				stats.TopIPs = append(stats.TopIPs, activity)
			}
		}
	}

	// Recent critical events (simplified, just get IDs and basic info)
	rows, err = db.conn.Query(`
		SELECT id, datetime, event_type, description, source_ip
		FROM audit_logs 
		WHERE level = ? AND datetime >= ?
		ORDER BY datetime DESC 
		LIMIT 10
	`, "CRITICAL", since)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var log AuditLogEntry
			if err := rows.Scan(&log.ID, &log.Datetime, &log.EventType, &log.Description, &log.SourceIP); err == nil {
				log.Level = "CRITICAL"
				stats.RecentCritical = append(stats.RecentCritical, log)
			}
		}
	}

	return stats, nil
}

// CountAuditLogsOlderThan counts logs older than the given date
func (db *DB) CountAuditLogsOlderThan(cutoff time.Time) (int, error) {
	var count int
	err := db.conn.QueryRow("SELECT COUNT(*) FROM audit_logs WHERE datetime < ?", cutoff).Scan(&count)
	return count, err
}

// CountAuditLogsNewerThan counts logs newer than the given date
func (db *DB) CountAuditLogsNewerThan(cutoff time.Time) (int, error) {
	var count int
	err := db.conn.QueryRow("SELECT COUNT(*) FROM audit_logs WHERE datetime >= ?", cutoff).Scan(&count)
	return count, err
}

// CountAuditLogsBetween counts logs between two dates
func (db *DB) CountAuditLogsBetween(start, end time.Time) (int, error) {
	var count int
	err := db.conn.QueryRow("SELECT COUNT(*) FROM audit_logs WHERE datetime >= ? AND datetime < ?", start, end).Scan(&count)
	return count, err
}

// ArchiveAuditLogs moves old logs to archive table (creates if not exists)
func (db *DB) ArchiveAuditLogs(cutoff time.Time) (int, error) {
	// Create archive table if it doesn't exist
	archiveSchema := `
		CREATE TABLE IF NOT EXISTS audit_logs_archive (
			id INTEGER PRIMARY KEY,
			datetime DATETIME,
			event_type TEXT,
			event_category TEXT,
			level TEXT,
			user_id INTEGER,
			username TEXT,
			email TEXT,
			source_ip TEXT,
			user_agent TEXT,
			resource TEXT,
			action TEXT,
			description TEXT,
			metadata TEXT,
			success BOOLEAN,
			error_message TEXT,
			request_method TEXT,
			request_uri TEXT,
			response_code INTEGER,
			duration_ms INTEGER,
			session_id TEXT,
			correlation_id TEXT,
			geo_location TEXT,
			created_at DATETIME,
			archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		CREATE INDEX IF NOT EXISTS idx_audit_archive_datetime ON audit_logs_archive(datetime DESC);
	`
	
	if _, err := db.conn.Exec(archiveSchema); err != nil {
		return 0, fmt.Errorf("failed to create archive table: %w", err)
	}
	
	// Move logs to archive
	result, err := db.conn.Exec(`
		INSERT INTO audit_logs_archive 
		SELECT *, datetime('now') as archived_at 
		FROM audit_logs 
		WHERE datetime < ? AND level != 'CRITICAL'
	`, cutoff)
	if err != nil {
		return 0, fmt.Errorf("failed to archive logs: %w", err)
	}
	
	archived, _ := result.RowsAffected()
	
	// Delete from main table
	if archived > 0 {
		_, err = db.conn.Exec("DELETE FROM audit_logs WHERE datetime < ? AND level != 'CRITICAL'", cutoff)
		if err != nil {
			return 0, fmt.Errorf("failed to delete archived logs: %w", err)
		}
	}
	
	return int(archived), nil
}

// DeleteAuditLogsOlderThan permanently deletes old logs
func (db *DB) DeleteAuditLogsOlderThan(cutoff time.Time, includeCritical bool) (int, error) {
	var result sql.Result
	var err error
	
	if includeCritical {
		result, err = db.conn.Exec("DELETE FROM audit_logs WHERE datetime < ?", cutoff)
	} else {
		result, err = db.conn.Exec("DELETE FROM audit_logs WHERE datetime < ? AND level != 'CRITICAL'", cutoff)
	}
	
	if err != nil {
		return 0, fmt.Errorf("failed to delete logs: %w", err)
	}
	
	deleted, _ := result.RowsAffected()
	return int(deleted), nil
}

// DeleteCriticalAuditLogsOlderThan deletes CRITICAL logs older than cutoff
func (db *DB) DeleteCriticalAuditLogsOlderThan(cutoff time.Time) (int, error) {
	result, err := db.conn.Exec("DELETE FROM audit_logs WHERE datetime < ? AND level = 'CRITICAL'", cutoff)
	if err != nil {
		return 0, fmt.Errorf("failed to delete critical logs: %w", err)
	}
	
	deleted, _ := result.RowsAffected()
	return int(deleted), nil
}

// VacuumDatabase runs VACUUM to reclaim space
func (db *DB) VacuumDatabase() error {
	_, err := db.conn.Exec("VACUUM")
	return err
}

// GetAuditLogTableSize returns the approximate size of audit_logs table in MB
func (db *DB) GetAuditLogTableSize() (float64, error) {
	var pageCount, pageSize int64
	
	// Get page count
	err := db.conn.QueryRow("SELECT COUNT(*) FROM pragma_page_count('audit_logs')").Scan(&pageCount)
	if err != nil {
		// Fallback: estimate based on row count
		var rowCount int
		if err := db.conn.QueryRow("SELECT COUNT(*) FROM audit_logs").Scan(&rowCount); err == nil {
			// Estimate: ~1KB per log entry
			return float64(rowCount) / 1024.0, nil
		}
		return 0, err
	}
	
	// Get page size
	err = db.conn.QueryRow("PRAGMA page_size").Scan(&pageSize)
	if err != nil {
		pageSize = 4096 // Default SQLite page size
	}
	
	// Calculate size in MB
	sizeBytes := pageCount * pageSize
	sizeMB := float64(sizeBytes) / (1024.0 * 1024.0)
	
	return sizeMB, nil
}

// PurgeAllAuditLogs deletes ALL audit logs (DANGEROUS!)
func (db *DB) PurgeAllAuditLogs() error {
	_, err := db.conn.Exec("DELETE FROM audit_logs")
	if err != nil {
		return err
	}
	
	// Also purge archive if exists
	_, _ = db.conn.Exec("DELETE FROM audit_logs_archive")
	
	// Vacuum to reclaim space
	return db.VacuumDatabase()
}

// ExportAuditLogsToFile exports logs to a file (JSON format)
func (db *DB) ExportAuditLogsToFile(startDate, endDate time.Time, filepath string) error {
	// This is a placeholder - actual implementation would:
	// 1. Query logs between dates
	// 2. Marshal to JSON
	// 3. Write to file (potentially compressed)
	// 4. Return error if any step fails
	
	// For now, just return not implemented
	return fmt.Errorf("export to file not yet implemented")
}

// ========== Audit Settings CRUD ==========

// GetAuditSettings retrieves the global audit settings
func (db *DB) GetAuditSettings() (*AuditSettings, error) {
	query := `
		SELECT 
			id, user_id, enabled,
			collect_authentication, collect_security, collect_audit, collect_system,
			collect_info, collect_warn, collect_error, collect_critical,
			enabled_event_types, disabled_event_types,
			sampling_enabled, sampling_rate,
			exclude_users, exclude_ips, include_only_users, include_only_ips,
			custom_retention_days, updated_at, updated_by
		FROM audit_settings
		WHERE user_id IS NULL
		LIMIT 1
	`

	var settings AuditSettings
	var userID, updatedBy sql.NullInt64
	var customRetentionDays sql.NullInt64
	var enabledEventTypesJSON, disabledEventTypesJSON string
	var excludeUsersJSON, excludeIPsJSON, includeOnlyUsersJSON, includeOnlyIPsJSON string

	err := db.conn.QueryRow(query).Scan(
		&settings.ID,
		&userID,
		&settings.Enabled,
		&settings.CollectAuthentication,
		&settings.CollectSecurity,
		&settings.CollectAudit,
		&settings.CollectSystem,
		&settings.CollectInfo,
		&settings.CollectWarn,
		&settings.CollectError,
		&settings.CollectCritical,
		&enabledEventTypesJSON,
		&disabledEventTypesJSON,
		&settings.SamplingEnabled,
		&settings.SamplingRate,
		&excludeUsersJSON,
		&excludeIPsJSON,
		&includeOnlyUsersJSON,
		&includeOnlyIPsJSON,
		&customRetentionDays,
		&settings.UpdatedAt,
		&updatedBy,
	)

	if err != nil {
		return nil, err
	}

	// Parse JSON arrays
	if err := json.Unmarshal([]byte(enabledEventTypesJSON), &settings.EnabledEventTypes); err != nil {
		settings.EnabledEventTypes = []string{}
	}
	if err := json.Unmarshal([]byte(disabledEventTypesJSON), &settings.DisabledEventTypes); err != nil {
		settings.DisabledEventTypes = []string{}
	}
	if err := json.Unmarshal([]byte(excludeUsersJSON), &settings.ExcludeUsers); err != nil {
		settings.ExcludeUsers = []int{}
	}
	if err := json.Unmarshal([]byte(excludeIPsJSON), &settings.ExcludeIPs); err != nil {
		settings.ExcludeIPs = []string{}
	}
	if err := json.Unmarshal([]byte(includeOnlyUsersJSON), &settings.IncludeOnlyUsers); err != nil {
		settings.IncludeOnlyUsers = []int{}
	}
	if err := json.Unmarshal([]byte(includeOnlyIPsJSON), &settings.IncludeOnlyIPs); err != nil {
		settings.IncludeOnlyIPs = []string{}
	}

	// Handle nullable fields
	if userID.Valid {
		uid := int(userID.Int64)
		settings.UserID = &uid
	}
	if updatedBy.Valid {
		ub := int(updatedBy.Int64)
		settings.UpdatedBy = &ub
	}
	if customRetentionDays.Valid {
		crd := int(customRetentionDays.Int64)
		settings.CustomRetentionDays = &crd
	}

	return &settings, nil
}

// UpdateAuditSettings updates the global audit settings
func (db *DB) UpdateAuditSettings(settings *AuditSettings, updatedByUserID int) error {
	// Marshal JSON arrays
	enabledEventTypesJSON, _ := json.Marshal(settings.EnabledEventTypes)
	disabledEventTypesJSON, _ := json.Marshal(settings.DisabledEventTypes)
	excludeUsersJSON, _ := json.Marshal(settings.ExcludeUsers)
	excludeIPsJSON, _ := json.Marshal(settings.ExcludeIPs)
	includeOnlyUsersJSON, _ := json.Marshal(settings.IncludeOnlyUsers)
	includeOnlyIPsJSON, _ := json.Marshal(settings.IncludeOnlyIPs)

	query := `
		UPDATE audit_settings SET
			enabled = ?,
			collect_authentication = ?,
			collect_security = ?,
			collect_audit = ?,
			collect_system = ?,
			collect_info = ?,
			collect_warn = ?,
			collect_error = ?,
			collect_critical = ?,
			enabled_event_types = ?,
			disabled_event_types = ?,
			sampling_enabled = ?,
			sampling_rate = ?,
			exclude_users = ?,
			exclude_ips = ?,
			include_only_users = ?,
			include_only_ips = ?,
			custom_retention_days = ?,
			updated_at = CURRENT_TIMESTAMP,
			updated_by = ?
		WHERE user_id IS NULL
	`

	_, err := db.conn.Exec(query,
		settings.Enabled,
		settings.CollectAuthentication,
		settings.CollectSecurity,
		settings.CollectAudit,
		settings.CollectSystem,
		settings.CollectInfo,
		settings.CollectWarn,
		settings.CollectError,
		settings.CollectCritical,
		string(enabledEventTypesJSON),
		string(disabledEventTypesJSON),
		settings.SamplingEnabled,
		settings.SamplingRate,
		string(excludeUsersJSON),
		string(excludeIPsJSON),
		string(includeOnlyUsersJSON),
		string(includeOnlyIPsJSON),
		settings.CustomRetentionDays,
		updatedByUserID,
	)

	return err
}


// ========== Audit Settings Methods ==========

// ShouldLog determines if an event should be logged based on settings
func (s *AuditSettings) ShouldLog(entry AuditLogEntry) bool {
	// Master switch - if disabled, log nothing
	if !s.Enabled {
		return false
	}

	// Category check
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

	// Level check
	switch entry.Level {
	case "INFO":
		if !s.CollectInfo {
			return false
		}
	case "WARN":
		if !s.CollectWarn {
			return false
		}
	case "ERROR":
		if !s.CollectError {
			return false
		}
	case "CRITICAL":
		if !s.CollectCritical {
			return false
		}
	}

	// Event type blacklist
	for _, disabled := range s.DisabledEventTypes {
		if entry.EventType == disabled {
			return false
		}
	}

	// Event type whitelist (if set)
	if len(s.EnabledEventTypes) > 0 {
		found := false
		for _, enabled := range s.EnabledEventTypes {
			if entry.EventType == enabled {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	// User filtering
	if entry.UserID != nil {
		// Exclude list
		for _, excludeID := range s.ExcludeUsers {
			if *entry.UserID == excludeID {
				return false
			}
		}

		// Include only list (if set)
		if len(s.IncludeOnlyUsers) > 0 {
			found := false
			for _, includeID := range s.IncludeOnlyUsers {
				if *entry.UserID == includeID {
					found = true
					break
				}
			}
			if !found {
				return false
			}
		}
	}

	// IP filtering
	if entry.SourceIP != "" {
		// Exclude list
		for _, excludeIP := range s.ExcludeIPs {
			if entry.SourceIP == excludeIP {
				return false
			}
		}

		// Include only list (if set)
		if len(s.IncludeOnlyIPs) > 0 {
			found := false
			for _, includeIP := range s.IncludeOnlyIPs {
				if entry.SourceIP == includeIP {
					found = true
					break
				}
			}
			if !found {
				return false
			}
		}
	}

	return true
}

// ApplyPreset applies a preset configuration to settings
func (s *AuditSettings) ApplyPreset(presetName string) bool {
	// Define presets inline to avoid circular import
	var preset *AuditSettings
	
	switch presetName {
	case "full_logging":
		preset = &AuditSettings{
			Enabled: true, CollectAuthentication: true, CollectSecurity: true,
			CollectAudit: true, CollectSystem: true, CollectInfo: true,
			CollectWarn: true, CollectError: true, CollectCritical: true,
			SamplingEnabled: false, SamplingRate: 1.0,
		}
	case "security_only":
		preset = &AuditSettings{
			Enabled: true, CollectAuthentication: true, CollectSecurity: true,
			CollectAudit: false, CollectSystem: false, CollectInfo: false,
			CollectWarn: true, CollectError: true, CollectCritical: true,
			SamplingEnabled: false, SamplingRate: 1.0,
		}
	case "critical_only":
		preset = &AuditSettings{
			Enabled: true, CollectAuthentication: false, CollectSecurity: true,
			CollectAudit: false, CollectSystem: false, CollectInfo: false,
			CollectWarn: false, CollectError: true, CollectCritical: true,
			SamplingEnabled: false, SamplingRate: 1.0,
		}
	case "sampled_logging":
		preset = &AuditSettings{
			Enabled: true, CollectAuthentication: true, CollectSecurity: true,
			CollectAudit: true, CollectSystem: true, CollectInfo: true,
			CollectWarn: true, CollectError: true, CollectCritical: true,
			SamplingEnabled: true, SamplingRate: 0.1,
		}
	case "compliance_mode":
		days := 2555
		preset = &AuditSettings{
			Enabled: true, CollectAuthentication: true, CollectSecurity: true,
			CollectAudit: true, CollectSystem: false, CollectInfo: false,
			CollectWarn: true, CollectError: true, CollectCritical: true,
			SamplingEnabled: false, SamplingRate: 1.0,
			CustomRetentionDays: &days,
		}
	default:
		return false
	}
	
	// Copy settings from preset
	s.Enabled = preset.Enabled
	s.CollectAuthentication = preset.CollectAuthentication
	s.CollectSecurity = preset.CollectSecurity
	s.CollectAudit = preset.CollectAudit
	s.CollectSystem = preset.CollectSystem
	s.CollectInfo = preset.CollectInfo
	s.CollectWarn = preset.CollectWarn
	s.CollectError = preset.CollectError
	s.CollectCritical = preset.CollectCritical
	s.SamplingEnabled = preset.SamplingEnabled
	s.SamplingRate = preset.SamplingRate
	s.CustomRetentionDays = preset.CustomRetentionDays
	
	return true
}

// CalculateStorageImpact estimates storage impact based on settings
func (s *AuditSettings) CalculateStorageImpact() float64 {
	if !s.Enabled {
		return 100.0 // 100% reduction (no logging)
	}

	reduction := 0.0

	// Category impact (each category ~25% of total)
	categoryCount := 0
	if s.CollectAuthentication {
		categoryCount++
	}
	if s.CollectSecurity {
		categoryCount++
	}
	if s.CollectAudit {
		categoryCount++
	}
	if s.CollectSystem {
		categoryCount++
	}
	categoryReduction := float64((4 - categoryCount) * 25)
	reduction += categoryReduction

	// Level impact (INFO ~40%, WARN ~30%, ERROR ~20%, CRITICAL ~10%)
	levelReduction := 0.0
	if !s.CollectInfo {
		levelReduction += 40.0
	}
	if !s.CollectWarn {
		levelReduction += 30.0
	}
	if !s.CollectError {
		levelReduction += 20.0
	}
	if !s.CollectCritical {
		levelReduction += 10.0
	}
	reduction += levelReduction * 0.5 // Level filtering has 50% weight

	// Sampling impact
	if s.SamplingEnabled {
		samplingReduction := (1.0 - s.SamplingRate) * 100.0
		reduction += samplingReduction * 0.3 // Sampling has 30% weight
	}

	// Cap at 100%
	if reduction > 100.0 {
		reduction = 100.0
	}

	return reduction
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

// GetRetentionStats retrieves retention statistics
func (db *DB) GetRetentionStats() (*RetentionStats, error) {
	stats := &RetentionStats{}

	// Count hot logs (main table)
	err := db.conn.QueryRow("SELECT COUNT(*) FROM audit_logs").Scan(&stats.HotLogs)
	if err != nil {
		return nil, err
	}

	// Count warm logs (archive table)
	err = db.conn.QueryRow("SELECT COUNT(*) FROM audit_logs_archive").Scan(&stats.WarmLogs)
	if err != nil {
		// Archive table might not exist yet
		stats.WarmLogs = 0
	}

	stats.TotalLogs = stats.HotLogs + stats.WarmLogs

	// Get database size
	stats.DatabaseSizeMB = 0 // TODO: Implement database size calculation

	// Get oldest and newest log dates
	var oldest, newest sql.NullString
	db.conn.QueryRow("SELECT MIN(datetime), MAX(datetime) FROM audit_logs").Scan(&oldest, &newest)
	if oldest.Valid {
		stats.OldestLog = oldest.String
	}
	if newest.Valid {
		stats.NewestLog = newest.String
	}

	return stats, nil
}

// DeleteOldAuditLogs deletes old audit logs based on retention policy
func (db *DB) DeleteOldAuditLogs(cutoffDate time.Time, includeCritical bool) (int, error) {
	var query string
	if includeCritical {
		// Delete all logs older than cutoff
		query = "DELETE FROM audit_logs_archive WHERE datetime < ?"
	} else {
		// Delete non-critical logs older than cutoff
		query = "DELETE FROM audit_logs_archive WHERE datetime < ? AND level != 'CRITICAL'"
	}

	result, err := db.conn.Exec(query, cutoffDate)
	if err != nil {
		return 0, err
	}

	rowsAffected, _ := result.RowsAffected()
	return int(rowsAffected), nil
}
