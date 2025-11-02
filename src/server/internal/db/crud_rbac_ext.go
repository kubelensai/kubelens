package db

import "encoding/json"

// GetUserPermissions returns all permissions for a user (from all their groups)
func (db *GormDB) GetUserPermissions(userID uint) ([]Permission, error) {
	var user User
	if err := db.Preload("Groups").First(&user, userID).Error; err != nil {
		return nil, err
	}

	// Collect all permissions from all groups
	allPermissions := []Permission{}
	for _, group := range user.Groups {
		var permissions []Permission
		// Parse JSON permissions
		if err := json.Unmarshal([]byte(group.Permissions), &permissions); err == nil {
			allPermissions = append(allPermissions, permissions...)
		}
	}

	return allPermissions, nil
}

