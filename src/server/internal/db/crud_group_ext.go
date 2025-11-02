package db

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

