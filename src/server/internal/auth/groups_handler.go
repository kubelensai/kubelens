package auth

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	"github.com/sonnguyen/kubelens/internal/db"
)

// CreateGroupRequest represents the request to create a group
type CreateGroupRequest struct {
	Name        string          `json:"name" binding:"required,min=3,max=50"`
	Description string          `json:"description"`
	Permissions []db.Permission `json:"permissions" binding:"required"`
}

// UpdateGroupRequest represents the request to update a group
type UpdateGroupRequest struct {
	Name        string          `json:"name" binding:"required,min=3,max=50"`
	Description string          `json:"description"`
	Permissions []db.Permission `json:"permissions" binding:"required"`
}

// GetPermissionOptions returns available permission options (admin only)
func (h *Handler) GetPermissionOptions(c *gin.Context) {
	options, err := h.db.GetPermissionOptions()
	if err != nil {
		log.Errorf("Failed to get permission options: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get permission options"})
		return
	}

	c.JSON(http.StatusOK, options)
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
	var req CreateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate permissions structure
	if err := validatePermissions(req.Permissions); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Marshal permissions to JSON
	permissionsJSON, err := json.Marshal(req.Permissions)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal permissions"})
		return
	}

	group := &db.Group{
		Name:        req.Name,
		Description: req.Description,
		IsSystem:    false, // User-created groups are not system groups
		Permissions: string(permissionsJSON),
	}

	if err := h.db.CreateGroup(group); err != nil {
		log.Errorf("Failed to create group: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create group"})
		return
	}

	log.Infof("Group created: %s (ID: %d)", group.Name, group.ID)

	c.JSON(http.StatusCreated, gin.H{
		"message": "group created successfully",
		"group":   group,
	})
}

// GetGroup retrieves a group by ID (admin only)
func (h *Handler) GetGroup(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group ID"})
		return
	}

	group, err := h.db.GetGroupByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
		return
	}

	c.JSON(http.StatusOK, group)
}

// UpdateGroupHandler updates a group (admin only)
func (h *Handler) UpdateGroupHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group ID"})
		return
	}

	// Check if group exists
	group, err := h.db.GetGroupByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
		return
	}

	// Prevent modification of system groups
	if group.IsSystem {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot modify system groups"})
		return
	}

	var req UpdateGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate permissions structure
	if err := validatePermissions(req.Permissions); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Marshal permissions to JSON
	permissionsJSON, err := json.Marshal(req.Permissions)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to marshal permissions"})
		return
	}

	group.Name = req.Name
	group.Description = req.Description
	group.Permissions = string(permissionsJSON)

	if err := h.db.UpdateGroup(group); err != nil {
		log.Errorf("Failed to update group: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update group"})
		return
	}

	log.Infof("Group updated: %s (ID: %d)", group.Name, group.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "group updated successfully",
		"group":   group,
	})
}

// DeleteGroup deletes a group (admin only)
func (h *Handler) DeleteGroup(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group ID"})
		return
	}

	// Check if group exists and is not a system group
	group, err := h.db.GetGroupByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
		return
	}

	if group.IsSystem {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot delete system groups"})
		return
	}

	if err := h.db.DeleteGroup(id); err != nil {
		log.Errorf("Failed to delete group: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete group"})
		return
	}

	log.Infof("Group deleted: %s (ID: %d)", group.Name, id)

	c.JSON(http.StatusOK, gin.H{"message": "group deleted successfully"})
}

// ListGroupUsers lists all users in a group (admin only)
func (h *Handler) ListGroupUsers(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group ID"})
		return
	}

	// Check if group exists
	if _, err := h.db.GetGroupByID(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
		return
	}

	// Get all users
	users, err := h.db.ListUsers()
	if err != nil {
		log.Errorf("Failed to list users: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list users"})
		return
	}

	// Filter users by group
	var groupUsers []*db.User
	for _, user := range users {
		groups, err := h.db.GetUserGroups(user.ID)
		if err != nil {
			continue
		}
		for _, g := range groups {
			if g.ID == id {
				groupUsers = append(groupUsers, user)
				break
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"users": groupUsers,
		"count": len(groupUsers),
	})
}

// AddUserToGroupHandler adds a user to a group (admin only)
func (h *Handler) AddUserToGroupHandler(c *gin.Context) {
	groupIDStr := c.Param("id")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group ID"})
		return
	}

	var req struct {
		UserID int `json:"user_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if group exists
	if _, err := h.db.GetGroupByID(groupID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
		return
	}

	// Check if user exists
	if _, err := h.db.GetUserByID(req.UserID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	if err := h.db.AddUserToGroup(req.UserID, groupID); err != nil {
		log.Errorf("Failed to add user to group: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add user to group"})
		return
	}

	log.Infof("User %d added to group %d", req.UserID, groupID)

	c.JSON(http.StatusOK, gin.H{"message": "user added to group successfully"})
}

// RemoveUserFromGroupHandler removes a user from a group (admin only)
func (h *Handler) RemoveUserFromGroupHandler(c *gin.Context) {
	groupIDStr := c.Param("id")
	groupID, err := strconv.Atoi(groupIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group ID"})
		return
	}

	userIDStr := c.Param("user_id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	if err := h.db.RemoveUserFromGroup(userID, groupID); err != nil {
		log.Errorf("Failed to remove user from group: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove user from group"})
		return
	}

	log.Infof("User %d removed from group %d", userID, groupID)

	c.JSON(http.StatusOK, gin.H{"message": "user removed from group successfully"})
}

// validatePermissions validates the structure of permissions
func validatePermissions(permissions []db.Permission) error {
	if len(permissions) == 0 {
		return nil // Empty permissions are valid
	}

	validResources := map[string]bool{
		"*": true, "clusters": true, "nodes": true, "namespaces": true,
		"pods": true, "deployments": true, "services": true, "configmaps": true,
		"secrets": true, "ingresses": true, "daemonsets": true, "statefulsets": true,
		"replicasets": true, "jobs": true, "cronjobs": true, "endpoints": true,
		"persistentvolumes": true, "persistentvolumeclaims": true, "storageclasses": true,
		"serviceaccounts": true, "roles": true, "rolebindings": true,
		"clusterroles": true, "clusterrolebindings": true, "networkpolicies": true,
		"ingressclasses": true, "priorityclasses": true, "runtimeclasses": true,
		"leases": true, "hpas": true, "pdbs": true, "events": true,
		"customresourcedefinitions": true, "customresources": true,
		"mutatingwebhookconfigurations": true, "validatingwebhookconfigurations": true,
	}

	validActions := map[string]bool{
		"*": true, "read": true, "create": true, "update": true, "delete": true,
	}

	for _, perm := range permissions {
		// Validate resource
		if !validResources[perm.Resource] {
			return gin.Error{Err: nil, Type: gin.ErrorTypeBind, Meta: "invalid resource: " + perm.Resource}
		}

		// Validate actions
		if len(perm.Actions) == 0 {
			return gin.Error{Err: nil, Type: gin.ErrorTypeBind, Meta: "actions cannot be empty"}
		}
		for _, action := range perm.Actions {
			if !validActions[action] {
				return gin.Error{Err: nil, Type: gin.ErrorTypeBind, Meta: "invalid action: " + action}
			}
		}

		// Validate clusters (at least one)
		if len(perm.Clusters) == 0 {
			return gin.Error{Err: nil, Type: gin.ErrorTypeBind, Meta: "clusters cannot be empty"}
		}

		// Validate namespaces (at least one)
		if len(perm.Namespaces) == 0 {
			return gin.Error{Err: nil, Type: gin.ErrorTypeBind, Meta: "namespaces cannot be empty"}
		}
	}

	return nil
}

