package db

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// =============================================================================
// Session CRUD Operations
// =============================================================================

// CreateSession creates a new authentication session
func (db *GormDB) CreateSession(session *Session) error {
	return db.Create(session).Error
}

// GetSession retrieves a valid session by token
func (db *GormDB) GetSession(token string) (*Session, error) {
	var session Session
	err := db.Preload("User").
		Where("token = ?", token).
		Where("expires_at > ?", time.Now()).
		First(&session).Error
	
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("session not found or expired")
	}
	return &session, err
}

// GetSessionWithoutExpiry retrieves a session by token without checking expiry
func (db *GormDB) GetSessionWithoutExpiry(token string) (*Session, error) {
	var session Session
	err := db.Preload("User").Where("token = ?", token).First(&session).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("session not found")
	}
	return &session, err
}

// GetUserSessions retrieves all active sessions for a user
func (db *GormDB) GetUserSessions(userID uint) ([]*Session, error) {
	var sessions []*Session
	err := db.Where("user_id = ?", userID).
		Where("expires_at > ?", time.Now()).
		Order("created_at DESC").
		Find(&sessions).Error
	return sessions, err
}

// UpdateSession updates a session's expiry time
func (db *GormDB) UpdateSession(token string, expiresAt time.Time) error {
	return db.Model(&Session{}).
		Where("token = ?", token).
		Update("expires_at", expiresAt).Error
}

// DeleteSession deletes a session by token
func (db *GormDB) DeleteSession(token string) error {
	return db.Where("token = ?", token).Delete(&Session{}).Error
}

// DeleteUserSessions deletes all sessions for a user
func (db *GormDB) DeleteUserSessions(userID uint) error {
	return db.Where("user_id = ?", userID).Delete(&Session{}).Error
}

// CleanExpiredSessions deletes all expired sessions
func (db *GormDB) CleanExpiredSessions() error {
	return db.Where("expires_at < ?", time.Now()).Delete(&Session{}).Error
}

// CountActiveSessions counts active sessions for a user
func (db *GormDB) CountActiveSessions(userID uint) (int64, error) {
	var count int64
	err := db.Model(&Session{}).
		Where("user_id = ?", userID).
		Where("expires_at > ?", time.Now()).
		Count(&count).Error
	return count, err
}

// =============================================================================
// UserSession CRUD Operations (Preferences)
// =============================================================================

// GetUserSession retrieves user preferences
func (db *GormDB) GetUserSession(userID uint) (*UserSession, error) {
	var userSession UserSession
	err := db.Where("user_id = ?", userID).First(&userSession).Error
	if err == gorm.ErrRecordNotFound {
		// Create default session if not exists
		userSession = UserSession{
			UserID:            userID,
			SelectedTheme:     "dark", // Default to dark theme
			SelectedCluster:   "",
			SelectedNamespace: "",
		}
		if err := db.Create(&userSession).Error; err != nil {
			return nil, err
		}
	}
	return &userSession, nil
}

// UpsertUserSession creates or updates user preferences
func (db *GormDB) UpsertUserSession(userSession *UserSession) error {
	var existing UserSession
	result := db.Where("user_id = ?", userSession.UserID).First(&existing)
	
	if result.Error == gorm.ErrRecordNotFound {
		// Create new
		return db.Create(userSession).Error
	}
	
	// Update existing
	userSession.ID = existing.ID
	userSession.CreatedAt = existing.CreatedAt
	return db.Save(userSession).Error
}

// UpdateUserSelectedCluster updates the selected cluster for a user
func (db *GormDB) UpdateUserSelectedCluster(userID uint, cluster string) error {
	return db.Model(&UserSession{}).
		Where("user_id = ?", userID).
		Update("selected_cluster", cluster).Error
}

// UpdateUserSelectedNamespace updates the selected namespace for a user
func (db *GormDB) UpdateUserSelectedNamespace(userID uint, namespace string) error {
	return db.Model(&UserSession{}).
		Where("user_id = ?", userID).
		Update("selected_namespace", namespace).Error
}

// UpdateUserSelectedTheme updates the selected theme for a user
func (db *GormDB) UpdateUserSelectedTheme(userID uint, theme string) error {
	return db.Model(&UserSession{}).
		Where("user_id = ?", userID).
		Update("selected_theme", theme).Error
}

// UpdateUserSession updates all user session fields
func (db *GormDB) UpdateUserSession(session *UserSession) error {
	return db.Model(&UserSession{}).
		Where("user_id = ?", session.UserID).
		Updates(map[string]interface{}{
			"selected_cluster":   session.SelectedCluster,
			"selected_namespace": session.SelectedNamespace,
			"selected_theme":     session.SelectedTheme,
		}).Error
}

// DeleteUserSession deletes user preferences
func (db *GormDB) DeleteUserSession(userID uint) error {
	return db.Where("user_id = ?", userID).Delete(&UserSession{}).Error
}

