package auth

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/sonnguyen/kubelens/internal/db"
	log "github.com/sirupsen/logrus"
)

// MFAHandler handles MFA-related requests
type MFAHandler struct {
	db *db.DB
}

// NewMFAHandler creates a new MFA handler
func NewMFAHandler(database *db.DB) *MFAHandler {
	return &MFAHandler{db: database}
}

// SetupMFARequest represents the request to set up MFA
type SetupMFARequest struct {
	// No fields needed - user ID comes from JWT
}

// SetupMFA generates a new MFA secret for the authenticated user
// POST /api/v1/auth/mfa/setup
func (h *MFAHandler) SetupMFA(c *gin.Context) {
	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Get user details
	user, err := h.db.GetUserByID(userID.(int))
	if err != nil {
		log.Errorf("Failed to get user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user"})
		return
	}

	// Generate MFA secret
	mfaSetup, err := h.db.GenerateMFASecret(user.ID, user.Username)
	if err != nil {
		log.Errorf("Failed to generate MFA secret: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate MFA secret"})
		return
	}

	log.Infof("MFA setup initiated for user: %s", user.Email)

	c.JSON(http.StatusOK, gin.H{
		"secret":       mfaSetup.Secret,
		"qr_code_url":  mfaSetup.QRCodeURL,
		"backup_codes": mfaSetup.BackupCodes,
	})
}

// VerifyMFARequest represents the request to verify MFA token
type VerifyMFARequest struct {
	Token string `json:"token" binding:"required"`
}

// VerifyAndEnableMFA verifies the MFA token and enables MFA for the user
// POST /api/v1/auth/mfa/enable
func (h *MFAHandler) VerifyAndEnableMFA(c *gin.Context) {
	var req VerifyMFARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Verify MFA token
	valid, err := h.db.VerifyMFAToken(userID.(int), req.Token)
	if err != nil {
		log.Errorf("Failed to verify MFA token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify token"})
		return
	}

	if !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	// Enable MFA
	if err := h.db.EnableMFA(userID.(int)); err != nil {
		log.Errorf("Failed to enable MFA: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enable MFA"})
		return
	}

	log.Infof("MFA enabled for user ID: %d", userID.(int))

	c.JSON(http.StatusOK, gin.H{
		"message": "MFA enabled successfully",
	})
}

// DisableMFA disables MFA for the authenticated user
// POST /api/v1/auth/mfa/disable
func (h *MFAHandler) DisableMFA(c *gin.Context) {
	var req VerifyMFARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Verify current MFA token before disabling
	valid, err := h.db.VerifyMFAToken(userID.(int), req.Token)
	if err != nil {
		log.Errorf("Failed to verify MFA token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify token"})
		return
	}

	if !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	// Disable MFA
	if err := h.db.DisableMFA(userID.(int)); err != nil {
		log.Errorf("Failed to disable MFA: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to disable MFA"})
		return
	}

	log.Infof("MFA disabled for user ID: %d", userID.(int))

	c.JSON(http.StatusOK, gin.H{
		"message": "MFA disabled successfully",
	})
}

// GetMFAStatus returns the MFA status for the authenticated user
// GET /api/v1/auth/mfa/status
func (h *MFAHandler) GetMFAStatus(c *gin.Context) {
	// Get user ID from context
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Get MFA status
	mfaEnabled, err := h.db.GetMFAStatus(userID.(int))
	if err != nil {
		log.Errorf("Failed to get MFA status: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get MFA status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"mfa_enabled": mfaEnabled,
	})
}

// RegenerateBackupCodes generates new backup codes for the authenticated user
// POST /api/v1/auth/mfa/regenerate-codes
func (h *MFAHandler) RegenerateBackupCodes(c *gin.Context) {
	var req VerifyMFARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Get user ID from context
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Verify current MFA token before regenerating codes
	valid, err := h.db.VerifyMFAToken(userID.(int), req.Token)
	if err != nil {
		log.Errorf("Failed to verify MFA token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify token"})
		return
	}

	if !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	// Regenerate backup codes
	backupCodes, err := h.db.RegenerateMFABackupCodes(userID.(int))
	if err != nil {
		log.Errorf("Failed to regenerate backup codes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to regenerate backup codes"})
		return
	}

	log.Infof("Backup codes regenerated for user ID: %d", userID.(int))

	c.JSON(http.StatusOK, gin.H{
		"backup_codes": backupCodes,
	})
}

// AdminResetMFA resets MFA for a specific user (admin only)
// POST /api/v1/users/:id/reset-mfa
func (h *MFAHandler) AdminResetMFA(c *gin.Context) {
	// Get target user ID from URL
	targetUserIDStr := c.Param("id")
	targetUserID, err := strconv.Atoi(targetUserIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user ID"})
		return
	}

	// Get admin user ID from context
	adminUserID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Check if user is admin
	adminUser, err := h.db.GetUserByID(adminUserID.(int))
	if err != nil {
		log.Errorf("Failed to get admin user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify admin"})
		return
	}

	if !adminUser.IsAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin access required"})
		return
	}

	// Disable MFA for target user
	if err := h.db.DisableMFA(targetUserID); err != nil {
		log.Errorf("Failed to reset MFA for user %d: %v", targetUserID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reset MFA"})
		return
	}

	log.Infof("Admin %s reset MFA for user ID: %d", adminUser.Email, targetUserID)

	c.JSON(http.StatusOK, gin.H{
		"message": "MFA reset successfully",
	})
}

