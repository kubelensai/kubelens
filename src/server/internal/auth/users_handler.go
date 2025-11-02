package auth

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sonnguyen/kubelens/internal/audit"
	"github.com/sonnguyen/kubelens/internal/db"
	log "github.com/sirupsen/logrus"
)

// CreateUser creates a new user (admin only)
func (h *Handler) CreateUser(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Username string `json:"username" binding:"required,min=3"`
		Password string `json:"password" binding:"required,min=8"`
		FullName string `json:"full_name"`
		IsAdmin  bool   `json:"is_admin"`
		GroupIDs []int  `json:"group_ids" binding:"required,min=1"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if user already exists
	existingUser, _ := h.db.GetUserByEmail(req.Email)
	if existingUser != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}

	// Check username
	existingUsers, _ := h.db.ListAllUsers()
	for _, u := range existingUsers {
		if u.Username == req.Username {
			c.JSON(http.StatusConflict, gin.H{"error": "username already taken"})
			return
		}
	}

	// Validate all groups exist
	for _, groupID := range req.GroupIDs {
		if _, err := h.db.GetGroupByID(uint(groupID)); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("group %d not found", groupID)})
			return
		}
	}

	// Hash password
	passwordHash, err := HashPassword(req.Password)
	if err != nil {
		log.Errorf("Failed to hash password: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
		return
	}

	// Create user
	user := &db.User{
		Email:        req.Email,
		Username:     req.Username,
		PasswordHash: passwordHash,
		FullName:     req.FullName,
		AuthProvider: "local",
		IsActive:     true,
		IsAdmin:      req.IsAdmin,
	}

	if err := h.db.CreateUser(user); err != nil {
		log.Errorf("Failed to create user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
		return
	}

	// Add user to groups
	for _, groupID := range req.GroupIDs {
		if err := h.db.AddUserToGroup(user.ID, uint(groupID)); err != nil {
			log.Errorf("Failed to add user to group: %v", err)
			// Continue with other groups even if one fails
		}
	}

	log.Infof("User created by admin: %s (%s)", user.Email, user.Username)

	// Audit log
	if adminUser, exists := c.Get("user"); exists {
		if admin, ok := adminUser.(*db.User); ok {
			audit.Log(c, audit.EventUserCreated, int(admin.ID), admin.Username, admin.Email,
				fmt.Sprintf("Created user: %s (%s)", user.Username, user.Email),
				map[string]interface{}{
					"target_user_id": user.ID,
					"target_username": user.Username,
					"target_email": user.Email,
					"is_admin": req.IsAdmin,
				})
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "user created successfully",
		"user":    user,
	})
}

// ListUsers returns all users (admin only)
func (h *Handler) ListUsers(c *gin.Context) {
	users, err := h.db.ListAllUsers()
	if err != nil {
		log.Errorf("Failed to list users: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list users"})
		return
	}

	c.JSON(http.StatusOK, users)
}

// GetUser returns a specific user (admin only)
func (h *Handler) GetUser(c *gin.Context) {
	userID := c.Param("id")
	
	var id int
	if _, err := fmt.Sscanf(userID, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	user, err := h.db.GetUserByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// UpdateUser updates a user (admin only)
func (h *Handler) UpdateUser(c *gin.Context) {
	userID := c.Param("id")
	
	var id int
	if _, err := fmt.Sscanf(userID, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	user, err := h.db.GetUserByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	var req struct {
		Email    string `json:"email"`
		Username string `json:"username"`
		FullName string `json:"full_name"`
		IsActive *bool  `json:"is_active"` // Pointer to distinguish between false and not provided
		IsAdmin  *bool  `json:"is_admin"`
		GroupIDs *[]int `json:"group_ids"` // Pointer to distinguish between empty array and not provided
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update fields if provided
	if req.Email != "" {
		user.Email = req.Email
	}
	if req.Username != "" {
		user.Username = req.Username
	}
	if req.FullName != "" {
		user.FullName = req.FullName
	}
	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}
	if req.IsAdmin != nil {
		user.IsAdmin = *req.IsAdmin
	}

	// Update groups if provided
	if req.GroupIDs != nil {
		groupIDs := *req.GroupIDs
		
		// Validate user must have at least one group
		if len(groupIDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "user must have at least one group"})
			return
		}

		// Validate all groups exist
		for _, groupID := range groupIDs {
			if _, err := h.db.GetGroupByID(uint(groupID)); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("group %d not found", groupID)})
				return
			}
		}

		// Get current groups
		currentGroups, err := h.db.GetUserGroups(uint(id))
		if err != nil {
			log.Errorf("Failed to get current user groups: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get current groups"})
			return
		}

		// Remove all current groups
		for _, group := range currentGroups {
			if err := h.db.RemoveUserFromGroup(uint(id), group.ID); err != nil{
				log.Errorf("Failed to remove user from group: %v", err)
			}
		}

		// Add new groups
		for _, groupID := range groupIDs {
			if err := h.db.AddUserToGroup(uint(id), uint(groupID)); err != nil {
				log.Errorf("Failed to add user to group: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add user to group"})
				return
			}
		}
	}

	if err := h.db.UpdateUser(user); err != nil {
		log.Errorf("Failed to update user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user"})
		return
	}

	log.Infof("User updated: %s (%s)", user.Email, user.Username)

	// Audit log
	if adminUser, exists := c.Get("user"); exists {
		if admin, ok := adminUser.(*db.User); ok {
			audit.Log(c, audit.EventUserUpdated, int(admin.ID), admin.Username, admin.Email,
				fmt.Sprintf("Updated user: %s (%s)", user.Username, user.Email),
				map[string]interface{}{
					"target_user_id": user.ID,
					"target_username": user.Username,
					"target_email": user.Email,
					"is_active": user.IsActive,
					"is_admin": user.IsAdmin,
				})
		}
	}

	c.JSON(http.StatusOK, user)
}

// DeleteUser deletes a user (admin only)
func (h *Handler) DeleteUser(c *gin.Context) {
	userID := c.Param("id")
	
	var id int
	if _, err := fmt.Sscanf(userID, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	// Prevent deleting yourself
	currentUserID, _ := c.Get("user_id")
	if currentUserID.(int) == id {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete your own account"})
		return
	}

	// Get user info before deletion for audit log
	targetUser, err := h.db.GetUserByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if err := h.db.DeleteUser(uint(id)); err != nil {
		log.Errorf("Failed to delete user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete user"})
		return
	}

	log.Infof("User deleted: ID %d", id)

	// Audit log
	if adminUser, exists := c.Get("user"); exists {
		if admin, ok := adminUser.(*db.User); ok {
			audit.Log(c, audit.EventUserDeleted, int(admin.ID), admin.Username, admin.Email,
				fmt.Sprintf("Deleted user: %s (%s)", targetUser.Username, targetUser.Email),
				map[string]interface{}{
					"target_user_id": targetUser.ID,
					"target_username": targetUser.Username,
					"target_email": targetUser.Email,
				})
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "user deleted successfully"})
}

// GetUserGroups returns all groups for a user (admin only)
func (h *Handler) GetUserGroups(c *gin.Context) {
	userID := c.Param("id")
	
	var id int
	if _, err := fmt.Sscanf(userID, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	groups, err := h.db.GetUserGroups(uint(id))
	if err != nil {
		log.Errorf("Failed to get user groups: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user groups"})
		return
	}

	c.JSON(http.StatusOK, groups)
}

// UpdateUserGroups updates all groups for a user (admin only)
func (h *Handler) UpdateUserGroups(c *gin.Context) {
	userID := c.Param("id")
	
	var id int
	if _, err := fmt.Sscanf(userID, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	var req struct {
		GroupIDs []int `json:"group_ids" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user must have at least one group"})
		return
	}

	// Check if user exists
	if _, err := h.db.GetUserByID(uint(id)); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// Validate all groups exist
	for _, groupID := range req.GroupIDs {
		if _, err := h.db.GetGroupByID(uint(groupID)); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("group %d not found", groupID)})
			return
		}
	}

	// Get current groups
	currentGroups, err := h.db.GetUserGroups(uint(id))
	if err != nil {
		log.Errorf("Failed to get current user groups: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get current groups"})
		return
	}

	// Remove all current groups
	for _, group := range currentGroups {
		if err := h.db.RemoveUserFromGroup(uint(id), group.ID); err != nil {
			log.Errorf("Failed to remove user from group: %v", err)
		}
	}

	// Add new groups
	for _, groupID := range req.GroupIDs {
		if err := h.db.AddUserToGroup(uint(id), uint(groupID)); err != nil {
			log.Errorf("Failed to add user to group: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add user to group"})
			return
		}
	}

	log.Infof("User %d groups updated", id)

	c.JSON(http.StatusOK, gin.H{"message": "user groups updated successfully"})
}

// ResetUserPassword resets a user's password (admin only)
func (h *Handler) ResetUserPassword(c *gin.Context) {
	userID := c.Param("id")
	
	var id int
	if _, err := fmt.Sscanf(userID, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	var req struct {
		NewPassword string `json:"new_password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password must be at least 8 characters"})
		return
	}

	// Check if user exists
	user, err := h.db.GetUserByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// Only allow reset for local auth users
	if user.AuthProvider != "local" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "can only reset password for local authentication users"})
		return
	}

	// Hash new password
	passwordHash, err := HashPassword(req.NewPassword)
	if err != nil {
		log.Errorf("Failed to hash password: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reset password"})
		return
	}

	// Update password
	user.PasswordHash = passwordHash
	if err := h.db.UpdateUser(user); err != nil {
		log.Errorf("Failed to update user password: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reset password"})
		return
	}

	log.Infof("Password reset for user %d by admin", id)

	c.JSON(http.StatusOK, gin.H{"message": "password reset successfully"})
}

