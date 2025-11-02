package db

import (
	"fmt"

	"gorm.io/gorm"
)

// =============================================================================
// Group CRUD Operations
// =============================================================================

// CreateGroup creates a new group
func (db *GormDB) CreateGroup(group *Group) error {
	return db.Create(group).Error
}

// GetGroup retrieves a group by name
func (db *GormDB) GetGroup(name string) (*Group, error) {
	var group Group
	err := db.Where("name = ?", name).First(&group).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("group not found: %s", name)
	}
	return &group, err
}

// GetGroupByID retrieves a group by ID
func (db *GormDB) GetGroupByID(id uint) (*Group, error) {
	var group Group
	err := db.First(&group, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("group not found with ID: %d", id)
	}
	return &group, err
}

// GetGroupWithUsers retrieves a group with its users
func (db *GormDB) GetGroupWithUsers(name string) (*Group, error) {
	var group Group
	err := db.Preload("Users").Where("name = ?", name).First(&group).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("group not found: %s", name)
	}
	return &group, err
}

// GetGroupByIDWithUsers retrieves a group by ID with its users
func (db *GormDB) GetGroupByIDWithUsers(id uint) (*Group, error) {
	var group Group
	err := db.Preload("Users").First(&group, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("group not found with ID: %d", id)
	}
	return &group, err
}

// ListGroups retrieves all groups with pagination
func (db *GormDB) ListGroups(page, pageSize int) ([]*Group, int64, error) {
	var groups []*Group
	var total int64
	
	// Count total
	db.Model(&Group{}).Count(&total)
	
	// Get page
	offset := (page - 1) * pageSize
	err := db.Offset(offset).
		Limit(pageSize).
		Order("name ASC").
		Find(&groups).Error
	
	return groups, total, err
}

// ListAllGroups retrieves all groups without pagination
func (db *GormDB) ListAllGroups() ([]*Group, error) {
	var groups []*Group
	err := db.Order("name ASC").Find(&groups).Error
	return groups, err
}

// ListSystemGroups retrieves only system groups
func (db *GormDB) ListSystemGroups() ([]*Group, error) {
	var groups []*Group
	err := db.Where("is_system = ?", true).Order("name ASC").Find(&groups).Error
	return groups, err
}

// ListNonSystemGroups retrieves only non-system groups
func (db *GormDB) ListNonSystemGroups() ([]*Group, error) {
	var groups []*Group
	err := db.Where("is_system = ?", false).Order("name ASC").Find(&groups).Error
	return groups, err
}

// UpdateGroup updates an existing group
func (db *GormDB) UpdateGroup(group *Group) error {
	return db.Save(group).Error
}

// UpdateGroupPermissions updates group permissions
func (db *GormDB) UpdateGroupPermissions(groupID uint, permissions JSON) error {
	return db.Model(&Group{}).
		Where("id = ?", groupID).
		Update("permissions", permissions).Error
}

// DeleteGroup deletes a group if it's not a system group and has no users
func (db *GormDB) DeleteGroup(groupID uint) error {
	var group Group
	if err := db.Preload("Users").First(&group, groupID).Error; err != nil {
		return err
	}
	
	if group.IsSystem {
		return fmt.Errorf("cannot delete system group: %s", group.Name)
	}
	
	if len(group.Users) > 0 {
		return fmt.Errorf("cannot delete group with %d assigned users", len(group.Users))
	}
	
	return db.Delete(&group).Error
}

// GroupExists checks if a group exists by name
func (db *GormDB) GroupExists(name string) (bool, error) {
	var count int64
	err := db.Model(&Group{}).Where("name = ?", name).Count(&count).Error
	return count > 0, err
}

// GetGroupUsers retrieves all users in a group with pagination
func (db *GormDB) GetGroupUsers(groupID uint, page, pageSize int) ([]*User, int64, error) {
	var group Group
	if err := db.First(&group, groupID).Error; err != nil {
		return nil, 0, err
	}
	
	var users []*User
	var total int64
	
	// Count total users in group
	total = db.Model(&group).Association("Users").Count()
	
	// Get paginated users
	offset := (page - 1) * pageSize
	err := db.Model(&group).
		Offset(offset).
		Limit(pageSize).
		Association("Users").
		Find(&users)
	
	return users, total, err
}

