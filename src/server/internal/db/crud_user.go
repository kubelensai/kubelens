package db

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// =============================================================================
// User CRUD Operations
// =============================================================================

// CreateUser creates a new user
func (db *GormDB) CreateUser(user *User) error {
	return db.Create(user).Error
}

// CreateUserWithGroups creates a new user and assigns them to groups
func (db *GormDB) CreateUserWithGroups(user *User, groupIDs []uint) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// Create user
		if err := tx.Create(user).Error; err != nil {
			return err
		}
		
		// Assign groups
		if len(groupIDs) > 0 {
			var groups []Group
			if err := tx.Find(&groups, groupIDs).Error; err != nil {
				return err
			}
			return tx.Model(user).Association("Groups").Append(groups)
		}
		
		return nil
	})
}

// GetUser retrieves a user by username
func (db *GormDB) GetUser(username string) (*User, error) {
	var user User
	err := db.Where("username = ?", username).First(&user).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("user not found: %s", username)
	}
	return &user, err
}

// GetUserByID retrieves a user by ID
func (db *GormDB) GetUserByID(id uint) (*User, error) {
	var user User
	err := db.First(&user, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("user not found with ID: %d", id)
	}
	return &user, err
}

// GetUserByEmail retrieves a user by email
func (db *GormDB) GetUserByEmail(email string) (*User, error) {
	var user User
	err := db.Where("email = ?", email).First(&user).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("user not found with email: %s", email)
	}
	return &user, err
}

// GetUserByProvider retrieves a user by provider and provider user ID
func (db *GormDB) GetUserByProvider(provider, providerUserID string) (*User, error) {
	var user User
	err := db.Where("auth_provider = ? AND provider_user_id = ?", provider, providerUserID).First(&user).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("user not found with provider: %s, id: %s", provider, providerUserID)
	}
	return &user, err
}

// GetUserWithGroups retrieves a user with their groups (eager loading)
func (db *GormDB) GetUserWithGroups(username string) (*User, error) {
	var user User
	err := db.Preload("Groups").Where("username = ?", username).First(&user).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("user not found: %s", username)
	}
	return &user, err
}

// GetUserByIDWithGroups retrieves a user by ID with their groups
func (db *GormDB) GetUserByIDWithGroups(id uint) (*User, error) {
	var user User
	err := db.Preload("Groups").First(&user, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("user not found with ID: %d", id)
	}
	return &user, err
}

// ListUsers retrieves all users with pagination
// ListAllUsers returns all users without pagination
func (db *GormDB) ListAllUsers() ([]*User, error) {
	var users []*User
	err := db.Find(&users).Error
	return users, err
}

func (db *GormDB) ListUsers(page, pageSize int) ([]*User, int64, error) {
	var users []*User
	var total int64
	
	// Count total
	db.Model(&User{}).Count(&total)
	
	// Get page with groups
	offset := (page - 1) * pageSize
	err := db.Preload("Groups").
		Offset(offset).
		Limit(pageSize).
		Order("created_at DESC").
		Find(&users).Error
	
	return users, total, err
}

// SearchUsers searches users by query with filters and pagination
func (db *GormDB) SearchUsers(query string, isActive *bool, page, pageSize int) ([]*User, int64, error) {
	var users []*User
	var total int64
	
	tx := db.Model(&User{})
	
	// Add search filter
	if query != "" {
		searchPattern := "%" + query + "%"
		tx = tx.Where("username LIKE ? OR email LIKE ? OR full_name LIKE ?",
			searchPattern, searchPattern, searchPattern)
	}
	
	// Add active filter
	if isActive != nil {
		tx = tx.Where("is_active = ?", *isActive)
	}
	
	// Count total
	tx.Count(&total)
	
	// Get page with groups
	offset := (page - 1) * pageSize
	err := tx.Preload("Groups").
		Offset(offset).
		Limit(pageSize).
		Order("created_at DESC").
		Find(&users).Error
	
	return users, total, err
}

// UpdateUser updates an existing user
func (db *GormDB) UpdateUser(user *User) error {
	return db.Save(user).Error
}

// UpdateUserPassword updates a user's password
func (db *GormDB) UpdateUserPassword(userID uint, passwordHash string) error {
	return db.Model(&User{}).
		Where("id = ?", userID).
		Update("password_hash", passwordHash).Error
}

// UpdateUserMFAStatus updates a user's MFA status
func (db *GormDB) UpdateUserMFAStatus(userID uint, enabled bool) error {
	updates := map[string]interface{}{
		"mfa_enabled": enabled,
	}
	
	if enabled {
		now := time.Now()
		updates["mfa_enforced_at"] = &now
	} else {
		updates["mfa_enforced_at"] = nil
	}
	
	return db.Model(&User{}).Where("id = ?", userID).Updates(updates).Error
}

// UpdateUserLastLogin updates a user's last login timestamp
func (db *GormDB) UpdateUserLastLogin(userID uint) error {
	now := time.Now()
	return db.Model(&User{}).
		Where("id = ?", userID).
		Update("last_login", &now).Error
}

// ActivateUser activates a user
func (db *GormDB) ActivateUser(userID uint) error {
	return db.Model(&User{}).
		Where("id = ?", userID).
		Update("is_active", true).Error
}

// DeactivateUser deactivates a user
func (db *GormDB) DeactivateUser(userID uint) error {
	return db.Model(&User{}).
		Where("id = ?", userID).
		Update("is_active", false).Error
}

// DeleteUser deletes a user (soft delete if GORM soft delete is enabled)
func (db *GormDB) DeleteUser(userID uint) error {
	return db.Delete(&User{}, userID).Error
}

// UpdateUserGroups replaces a user's groups
func (db *GormDB) UpdateUserGroups(userID uint, groupIDs []uint) error {
	var user User
	if err := db.First(&user, userID).Error; err != nil {
		return err
	}
	
	var groups []Group
	if err := db.Find(&groups, groupIDs).Error; err != nil {
		return err
	}
	
	// Replace associations
	return db.Model(&user).Association("Groups").Replace(groups)
}

// AddUserToGroups adds a user to multiple groups
func (db *GormDB) AddUserToGroups(userID uint, groupIDs []uint) error {
	var user User
	if err := db.First(&user, userID).Error; err != nil {
		return err
	}
	
	var groups []Group
	if err := db.Find(&groups, groupIDs).Error; err != nil {
		return err
	}
	
	return db.Model(&user).Association("Groups").Append(groups)
}

// RemoveUserFromGroups removes a user from multiple groups
func (db *GormDB) RemoveUserFromGroups(userID uint, groupIDs []uint) error {
	var user User
	if err := db.First(&user, userID).Error; err != nil {
		return err
	}
	
	var groups []Group
	if err := db.Find(&groups, groupIDs).Error; err != nil {
		return err
	}
	
	return db.Model(&user).Association("Groups").Delete(groups)
}

// GetUserGroups retrieves all groups for a user
func (db *GormDB) GetUserGroups(userID uint) ([]Group, error) {
	var user User
	if err := db.Preload("Groups").First(&user, userID).Error; err != nil {
		return nil, err
	}
	return user.Groups, nil
}

// UserExists checks if a user exists by username
func (db *GormDB) UserExists(username string) (bool, error) {
	var count int64
	err := db.Model(&User{}).Where("username = ?", username).Count(&count).Error
	return count > 0, err
}

// EmailExists checks if an email exists
func (db *GormDB) EmailExists(email string) (bool, error) {
	var count int64
	err := db.Model(&User{}).Where("email = ?", email).Count(&count).Error
	return count > 0, err
}

