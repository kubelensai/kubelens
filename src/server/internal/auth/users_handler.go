package auth

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sonnguyen/kubelens/internal/db"
	log "github.com/sirupsen/logrus"
)

// ListUsers returns all users (admin only)
func (h *Handler) ListUsers(c *gin.Context) {
	users, err := h.db.ListUsers()
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

	user, err := h.db.GetUserByID(id)
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

	user, err := h.db.GetUserByID(id)
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

	if err := h.db.UpdateUser(user); err != nil {
		log.Errorf("Failed to update user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user"})
		return
	}

	log.Infof("User updated: %s (%s)", user.Email, user.Username)

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

	if err := h.db.DeleteUser(id); err != nil {
		log.Errorf("Failed to delete user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete user"})
		return
	}

	log.Infof("User deleted: ID %d", id)

	c.JSON(http.StatusOK, gin.H{"message": "user deleted successfully"})
}

// ListGroups returns all groups (admin only)
func (h *Handler) ListGroups(c *gin.Context) {
	groups, err := h.db.ListGroups()
	if err != nil {
		log.Errorf("Failed to list groups: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list groups"})
		return
	}

	c.JSON(http.StatusOK, groups)
}

// CreateGroup creates a new group (admin only)
func (h *Handler) CreateGroup(c *gin.Context) {
	var req struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	group := &db.Group{
		Name:        req.Name,
		Description: req.Description,
		IsSystem:    false,
	}

	if err := h.db.CreateGroup(group); err != nil {
		log.Errorf("Failed to create group: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create group"})
		return
	}

	log.Infof("Group created: %s", group.Name)

	c.JSON(http.StatusCreated, group)
}

// GetUserGroups returns groups for a user
func (h *Handler) GetUserGroups(c *gin.Context) {
	userID := c.Param("id")
	
	var id int
	if _, err := fmt.Sscanf(userID, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	groups, err := h.db.GetUserGroups(id)
	if err != nil {
		log.Errorf("Failed to get user groups: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user groups"})
		return
	}

	c.JSON(http.StatusOK, groups)
}

// AddUserToGroup adds a user to a group (admin only)
func (h *Handler) AddUserToGroup(c *gin.Context) {
	userID := c.Param("id")
	
	var id int
	if _, err := fmt.Sscanf(userID, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	var req struct {
		GroupID int `json:"group_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.AddUserToGroup(id, req.GroupID); err != nil {
		log.Errorf("Failed to add user to group: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add user to group"})
		return
	}

	log.Infof("User %d added to group %d", id, req.GroupID)

	c.JSON(http.StatusOK, gin.H{"message": "user added to group successfully"})
}

// RemoveUserFromGroup removes a user from a group (admin only)
func (h *Handler) RemoveUserFromGroup(c *gin.Context) {
	userID := c.Param("id")
	groupID := c.Param("group_id")
	
	var uid, gid int
	if _, err := fmt.Sscanf(userID, "%d", &uid); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}
	if _, err := fmt.Sscanf(groupID, "%d", &gid); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group ID"})
		return
	}

	if err := h.db.RemoveUserFromGroup(uid, gid); err != nil {
		log.Errorf("Failed to remove user from group: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove user from group"})
		return
	}

	log.Infof("User %d removed from group %d", uid, gid)

	c.JSON(http.StatusOK, gin.H{"message": "user removed from group successfully"})
}

