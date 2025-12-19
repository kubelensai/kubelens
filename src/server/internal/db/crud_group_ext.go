package db

import (
	"fmt"

	"gorm.io/gorm"
)

// Additional group-related helper methods

// AddUserToGroup adds a user to a group
func (db *GormDB) AddUserToGroup(userID, groupID uint) error {
	var user User
	if err := db.First(&user, userID).Error; err != nil {
		return err
	}

	var group Group
	if err := db.First(&group, groupID).Error; err != nil {
		return err
	}

	return db.Model(&user).Association("Groups").Append(&group)
}

// RemoveUserFromGroup removes a user from a group
func (db *GormDB) RemoveUserFromGroup(userID, groupID uint) error {
	var user User
	if err := db.First(&user, userID).Error; err != nil {
		return err
	}

	var group Group
	if err := db.First(&group, groupID).Error; err != nil {
		return err
	}

	return db.Model(&user).Association("Groups").Delete(&group)
}

// GetGroupByName retrieves a group by name (alias for GetGroup)
func (db *GormDB) GetGroupByName(name string) (*Group, error) {
	var group Group
	err := db.Where("name = ?", name).First(&group).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("group not found: %s", name)
	}
	return &group, err
}

// NOTE: GetUserGroups is defined in crud_user.go

// SetUserGroups replaces all user groups with the provided list
func (db *GormDB) SetUserGroups(userID uint, groupIDs []uint) error {
	var user User
	if err := db.First(&user, userID).Error; err != nil {
		return err
	}

	var groups []Group
	if len(groupIDs) > 0 {
		if err := db.Find(&groups, groupIDs).Error; err != nil {
			return err
		}
	}

	return db.Model(&user).Association("Groups").Replace(groups)
}

// GetUserByUsername retrieves a user by username
func (db *GormDB) GetUserByUsername(username string) (*User, error) {
	var user User
	err := db.Where("username = ?", username).First(&user).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("user not found: %s", username)
	}
	return &user, err
}

// IsUserInGroup checks if a user is in a specific group
func (db *GormDB) IsUserInGroup(userID, groupID uint) (bool, error) {
	var count int64
	err := db.Table("user_groups").
		Where("user_id = ? AND group_id = ?", userID, groupID).
		Count(&count).Error
	return count > 0, err
}

// GetOrCreateGroup gets an existing group or creates a new one
func (db *GormDB) GetOrCreateGroup(name, description string) (*Group, bool, error) {
	var group Group
	err := db.Where("name = ?", name).First(&group).Error
	if err == nil {
		return &group, false, nil // Group exists
	}
	if err != gorm.ErrRecordNotFound {
		return nil, false, err
	}

	// Create new group
	group = Group{
		Name:        name,
		Description: description,
		IsSystem:    false,
	}
	if err := db.Create(&group).Error; err != nil {
		return nil, false, err
	}
	return &group, true, nil // New group created
}

