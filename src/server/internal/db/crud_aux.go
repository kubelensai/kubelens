package db

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// =============================================================================
// MFA Secret CRUD Operations
// =============================================================================

// CreateMFASecret creates a new MFA secret for a user
func (db *GormDB) CreateMFASecret(mfaSecret *MFASecret) error {
	return db.Create(mfaSecret).Error
}

// GetMFASecret retrieves MFA secret for a user
func (db *GormDB) GetMFASecret(userID uint) (*MFASecret, error) {
	var mfaSecret MFASecret
	err := db.Where("user_id = ?", userID).First(&mfaSecret).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("MFA secret not found for user ID: %d", userID)
	}
	return &mfaSecret, err
}

// UpdateMFASecret updates an existing MFA secret
func (db *GormDB) UpdateMFASecret(mfaSecret *MFASecret) error {
	return db.Save(mfaSecret).Error
}

// DeleteMFASecret deletes MFA secret for a user
func (db *GormDB) DeleteMFASecret(userID uint) error {
	return db.Where("user_id = ?", userID).Delete(&MFASecret{}).Error
}

// MFASecretExists checks if a user has an MFA secret
func (db *GormDB) MFASecretExists(userID uint) (bool, error) {
	var count int64
	err := db.Model(&MFASecret{}).Where("user_id = ?", userID).Count(&count).Error
	return count > 0, err
}

// =============================================================================
// Notification CRUD Operations
// =============================================================================

// CreateNotification creates a new notification
func (db *GormDB) CreateNotification(notification *Notification) error {
	return db.Create(notification).Error
}

// CreateBulkNotifications creates multiple notifications
func (db *GormDB) CreateBulkNotifications(notifications []*Notification) error {
	return db.Create(&notifications).Error
}

// GetNotification retrieves a notification by ID
func (db *GormDB) GetNotification(id uint) (*Notification, error) {
	var notification Notification
	err := db.First(&notification, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("notification not found with ID: %d", id)
	}
	return &notification, err
}

// GetUserNotifications retrieves all notifications for a user
func (db *GormDB) GetUserNotifications(userID uint, limit int) ([]*Notification, error) {
	var notifications []*Notification
	err := db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&notifications).Error
	return notifications, err
}

// GetUnreadNotifications retrieves unread notifications for a user
func (db *GormDB) GetUnreadNotifications(userID uint) ([]*Notification, error) {
	var notifications []*Notification
	err := db.Where("user_id = ? AND is_read = ?", userID, false).
		Order("created_at DESC").
		Find(&notifications).Error
	return notifications, err
}

// CountUnreadNotifications counts unread notifications for a user
func (db *GormDB) CountUnreadNotifications(userID uint) (int64, error) {
	var count int64
	err := db.Model(&Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Count(&count).Error
	return count, err
}

// MarkNotificationAsRead marks a notification as read
func (db *GormDB) MarkNotificationAsRead(id uint) error {
	return db.Model(&Notification{}).
		Where("id = ?", id).
		Update("is_read", true).Error
}

// MarkAllNotificationsAsRead marks all notifications as read for a user
func (db *GormDB) MarkAllNotificationsAsRead(userID uint) error {
	return db.Model(&Notification{}).
		Where("user_id = ?", userID).
		Update("is_read", true).Error
}

// DeleteNotification deletes a notification
func (db *GormDB) DeleteNotification(id uint) error {
	return db.Delete(&Notification{}, id).Error
}

// DeleteUserNotifications deletes all notifications for a user
func (db *GormDB) DeleteUserNotifications(userID uint) error {
	return db.Where("user_id = ?", userID).Delete(&Notification{}).Error
}

// DeleteOldNotifications deletes notifications older than specified days
func (db *GormDB) DeleteOldNotifications(days int) error {
	cutoff := time.Now().AddDate(0, 0, -days)
	return db.Where("created_at < ?", cutoff).Delete(&Notification{}).Error
}

// =============================================================================
// Audit Log CRUD Operations
// =============================================================================

// CreateAuditLog creates a new audit log entry
func (db *GormDB) CreateAuditLog(auditLog *AuditLog) error {
	return db.Create(auditLog).Error
}

// GetAuditLog retrieves an audit log by ID
func (db *GormDB) GetAuditLog(id uint) (*AuditLog, error) {
	var auditLog AuditLog
	err := db.First(&auditLog, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("audit log not found with ID: %d", id)
	}
	return &auditLog, err
}

// GetAuditLogs retrieves audit logs with filters and pagination
func (db *GormDB) GetAuditLogs(filters *AuditLogFilters) ([]*AuditLog, int64, error) {
	var logs []*AuditLog
	var total int64
	
	tx := db.Model(&AuditLog{})
	
	// Apply filters
	if filters.EventType != "" {
		tx = tx.Where("event_type = ?", filters.EventType)
	}
	
	if filters.UserID != 0 {
		tx = tx.Where("user_id = ?", filters.UserID)
	}
	
	if !filters.StartDate.IsZero() {
		tx = tx.Where("created_at >= ?", filters.StartDate)
	}
	
	if !filters.EndDate.IsZero() {
		tx = tx.Where("created_at <= ?", filters.EndDate)
	}
	
	// Count total
	tx.Count(&total)
	
	// Get paginated results
	offset := (filters.Page - 1) * filters.PageSize
	err := tx.Offset(offset).
		Limit(filters.PageSize).
		Order("created_at DESC").
		Find(&logs).Error
	
	return logs, total, err
}

// DeleteOldAuditLogs deletes audit logs older than specified days
func (db *GormDB) DeleteOldAuditLogs(days int) error {
	cutoff := time.Now().AddDate(0, 0, -days)
	return db.Where("created_at < ?", cutoff).Delete(&AuditLog{}).Error
}

// =============================================================================
// Audit Settings CRUD Operations
// =============================================================================

// GetAuditSettings retrieves audit settings
func (db *GormDB) GetAuditSettings() (*AuditSettings, error) {
	var settings AuditSettings
	err := db.First(&settings).Error
	if err == gorm.ErrRecordNotFound {
		// Create default settings
		settings = AuditSettings{
			AuthEventsEnabled:     true,
			SecurityEventsEnabled: true,
			K8sEventsEnabled:      false,
			RetentionDays:         90,
		}
		if err := db.Create(&settings).Error; err != nil {
			return nil, err
		}
	}
	return &settings, nil
}

// UpdateAuditSettings updates audit settings
func (db *GormDB) UpdateAuditSettings(settings *AuditSettings) error {
	return db.Save(settings).Error
}

// [Removed Integration CRUD Operations]

// [Removed IntegrationCluster and OAuth2Token CRUD Operations]

