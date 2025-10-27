package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

// UpdateSessionRequest represents the request to update user session
type UpdateSessionRequest struct {
	SelectedCluster   string `json:"selected_cluster"`
	SelectedNamespace string `json:"selected_namespace"`
	SelectedTheme     string `json:"selected_theme"`
}

// GetSession retrieves the current user's session
func (h *Handler) GetSession(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	session, err := h.db.GetUserSession(userID.(int))
	if err != nil {
		log.Errorf("Failed to get user session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get session"})
		return
	}

	c.JSON(http.StatusOK, session)
}

// UpdateSession updates the current user's session
func (h *Handler) UpdateSession(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req UpdateSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate theme if provided
	if req.SelectedTheme != "" && req.SelectedTheme != "light" && req.SelectedTheme != "dark" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid theme, must be 'light' or 'dark'"})
		return
	}

	// Get existing session or create if not exists
	session, err := h.db.GetUserSession(userID.(int))
	if err != nil {
		log.Errorf("Failed to get user session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get session"})
		return
	}

	// Update session fields
	session.SelectedCluster = req.SelectedCluster
	session.SelectedNamespace = req.SelectedNamespace
	if req.SelectedTheme != "" {
		session.SelectedTheme = req.SelectedTheme
	}

	if err := h.db.UpdateUserSession(session); err != nil {
		log.Errorf("Failed to update user session: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update session"})
		return
	}

	log.Infof("User %d session updated: cluster=%s, namespace=%s, theme=%s",
		userID, session.SelectedCluster, session.SelectedNamespace, session.SelectedTheme)

	c.JSON(http.StatusOK, gin.H{
		"message": "session updated successfully",
		"session": session,
	})
}

