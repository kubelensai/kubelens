package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	"github.com/sonnguyen/kubelens/internal/db"
)

// PermissionChecker is a middleware that checks if the user has the required permission
func (h *Handler) PermissionChecker(resource string, action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get user ID from context (set by AuthMiddleware)
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			c.Abort()
			return
		}

		// Check if user is admin (admins bypass all permission checks)
		isAdmin, _ := c.Get("is_admin")
		if isAdmin.(bool) {
			c.Next()
			return
		}

		// Get user permissions
		permissions, err := h.db.GetUserPermissions(uint(uint(userID.(int))))
		if err != nil {
			log.Errorf("Failed to get user permissions: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check permissions"})
			c.Abort()
			return
		}

		// Check if user has the required permission
		if !hasPermission(permissions, resource, action) {
			log.Warnf("User %d denied access to %s:%s", uint(userID.(int)), resource, action)
			c.JSON(http.StatusForbidden, gin.H{
				"error": "insufficient permissions",
				"required": gin.H{
					"resource": resource,
					"action":   action,
				},
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// hasPermission checks if the user has the required permission
func hasPermission(permissions []db.Permission, resource string, action string) bool {
	for _, perm := range permissions {
		// Check for wildcard resource or exact match
		if perm.Resource == "*" || perm.Resource == resource {
			// Check for wildcard action or exact match
			for _, a := range perm.Actions {
				if a == "*" || a == action {
					return true
				}
			}
		}
	}
	return false
}

// ClusterScopeChecker is a middleware that checks if the user has access to the specified cluster
func (h *Handler) ClusterScopeChecker() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get cluster from URL parameter or query
		cluster := c.Param("cluster")
		if cluster == "" {
			cluster = c.Query("cluster")
		}

		// If no cluster specified, allow (will be handled by permission checker)
		if cluster == "" {
			c.Next()
			return
		}

		// Get user ID from context
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			c.Abort()
			return
		}

		// Check if user is admin (admins have access to all clusters)
		isAdmin, _ := c.Get("is_admin")
		if isAdmin.(bool) {
			c.Next()
			return
		}

		// Get user permissions
		permissions, err := h.db.GetUserPermissions(uint(uint(userID.(int))))
		if err != nil {
			log.Errorf("Failed to get user permissions: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check permissions"})
			c.Abort()
			return
		}

		// Check if user has access to this cluster
		if !hasClusterAccess(permissions, cluster) {
			log.Warnf("User %d denied access to cluster %s", uint(userID.(int)), cluster)
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "no access to this cluster",
				"cluster": cluster,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// hasClusterAccess checks if the user has access to the specified cluster
func hasClusterAccess(permissions []db.Permission, cluster string) bool {
	for _, perm := range permissions {
		// Check if permission has cluster scope
		if len(perm.Clusters) == 0 {
			// No cluster restriction means access to all clusters
			return true
		}

		// Check for wildcard or exact match
		for _, c := range perm.Clusters {
			if c == "*" || c == cluster {
				return true
			}
		}
	}
	return false
}

// NamespaceScopeChecker is a middleware that checks if the user has access to the specified namespace
func (h *Handler) NamespaceScopeChecker() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get namespace from URL parameter or query
		namespace := c.Param("namespace")
		if namespace == "" {
			namespace = c.Query("namespace")
		}

		// If no namespace specified, allow (will be handled by permission checker)
		if namespace == "" {
			c.Next()
			return
		}

		// Get user ID from context
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
			c.Abort()
			return
		}

		// Check if user is admin (admins have access to all namespaces)
		isAdmin, _ := c.Get("is_admin")
		if isAdmin.(bool) {
			c.Next()
			return
		}

		// Get user permissions
		permissions, err := h.db.GetUserPermissions(uint(uint(userID.(int))))
		if err != nil {
			log.Errorf("Failed to get user permissions: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check permissions"})
			c.Abort()
			return
		}

		// Check if user has access to this namespace
		if !hasNamespaceAccess(permissions, namespace) {
			log.Warnf("User %d denied access to namespace %s", uint(userID.(int)), namespace)
			c.JSON(http.StatusForbidden, gin.H{
				"error":     "no access to this namespace",
				"namespace": namespace,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// hasNamespaceAccess checks if the user has access to the specified namespace
func hasNamespaceAccess(permissions []db.Permission, namespace string) bool {
	for _, perm := range permissions {
		// Check if permission has namespace scope
		if len(perm.Namespaces) == 0 {
			// No namespace restriction means access to all namespaces
			return true
		}

		// Check for wildcard or exact match
		for _, ns := range perm.Namespaces {
			if ns == "*" || ns == namespace {
				return true
			}
		}
	}
	return false
}

// GetUserPermissionsHandler returns the current user's permissions
func (h *Handler) GetUserPermissionsHandler(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	// Get user permissions
	permissions, err := h.db.GetUserPermissions(uint(userID.(int)))
	if err != nil {
		log.Errorf("Failed to get user permissions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get permissions"})
		return
	}

	// Get user groups for additional context
		groups, err := h.db.GetUserGroups(uint(uint(userID.(int))))
	if err != nil {
		log.Errorf("Failed to get user groups: %v", err)
		// Don't fail, just return permissions without groups
		groups = []db.Group{}
	}

	// Build response
	response := gin.H{
		"permissions": permissions,
		"groups":      groups,
	}

	// Add accessible resources summary
	accessibleResources := make(map[string][]string)
	for _, perm := range permissions {
		resource := perm.Resource
		if resource == "*" {
			accessibleResources["*"] = []string{"*"}
			break
		}
		if _, exists := accessibleResources[resource]; !exists {
			accessibleResources[resource] = []string{}
		}
		accessibleResources[resource] = append(accessibleResources[resource], perm.Actions...)
	}
	response["accessible_resources"] = accessibleResources

	c.JSON(http.StatusOK, response)
}

// Helper function to check if user can perform action on resource
func (h *Handler) CanUserAccess(userID int, resource string, action string) (bool, error) {
	// Get user
	user, err := h.db.GetUserByID(uint(userID))
	if err != nil {
		return false, err
	}

	// Admins can access everything
	if user.IsAdmin {
		return true, nil
	}

	// Get user permissions
	permissions, err := h.db.GetUserPermissions(uint(userID))
	if err != nil {
		return false, err
	}

	return hasPermission(permissions, resource, action), nil
}

// Helper function to get allowed clusters for a user
func (h *Handler) GetUserAllowedClusters(userID int) ([]string, error) {
	// Get user
	user, err := h.db.GetUserByID(uint(userID))
	if err != nil {
		return nil, err
	}

	// Admins can access all clusters
	if user.IsAdmin {
		return []string{"*"}, nil
	}

	// Get user permissions
	permissions, err := h.db.GetUserPermissions(uint(userID))
	if err != nil {
		return nil, err
	}

	// Collect unique clusters
	clusterMap := make(map[string]bool)
	for _, perm := range permissions {
		if len(perm.Clusters) == 0 {
			// No restriction means all clusters
			return []string{"*"}, nil
		}
		for _, cluster := range perm.Clusters {
			clusterMap[cluster] = true
		}
	}

	// Convert map to slice
	clusters := make([]string, 0, len(clusterMap))
	for cluster := range clusterMap {
		clusters = append(clusters, cluster)
	}

	return clusters, nil
}

// Helper function to get allowed namespaces for a user in a specific cluster
func (h *Handler) GetUserAllowedNamespaces(userID int, cluster string) ([]string, error) {
	// Get user
	user, err := h.db.GetUserByID(uint(userID))
	if err != nil {
		return nil, err
	}

	// Admins can access all namespaces
	if user.IsAdmin {
		return []string{"*"}, nil
	}

	// Get user permissions
	permissions, err := h.db.GetUserPermissions(uint(userID))
	if err != nil {
		return nil, err
	}

	// Collect unique namespaces for the specified cluster
	namespaceMap := make(map[string]bool)
	for _, perm := range permissions {
		// Check if permission applies to this cluster
		hasClusterAccess := len(perm.Clusters) == 0 // No restriction
		if !hasClusterAccess {
			for _, c := range perm.Clusters {
				if c == "*" || c == cluster {
					hasClusterAccess = true
					break
				}
			}
		}

		if hasClusterAccess {
			if len(perm.Namespaces) == 0 {
				// No restriction means all namespaces
				return []string{"*"}, nil
			}
			for _, ns := range perm.Namespaces {
				namespaceMap[ns] = true
			}
		}
	}

	// Convert map to slice
	namespaces := make([]string, 0, len(namespaceMap))
	for ns := range namespaceMap {
		namespaces = append(namespaces, ns)
	}

	return namespaces, nil
}

