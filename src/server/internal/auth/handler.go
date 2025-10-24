package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/sonnguyen/kubelens/internal/db"
	log "github.com/sirupsen/logrus"
)

// Handler handles authentication requests
type Handler struct {
	db     *db.DB
	secret string
}

// NewHandler creates a new auth handler
func NewHandler(database *db.DB, secret string) *Handler {
	return &Handler{
		db:     database,
		secret: secret,
	}
}

// Signup handles user registration
func (h *Handler) Signup(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Username string `json:"username" binding:"required,min=3"`
		Password string `json:"password" binding:"required,min=8"`
		FullName string `json:"full_name"`
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
	existingUsers, _ := h.db.ListUsers()
	for _, u := range existingUsers {
		if u.Username == req.Username {
			c.JSON(http.StatusConflict, gin.H{"error": "username already taken"})
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
		IsAdmin:      false, // New users are not admins by default
	}

	if err := h.db.CreateUser(user); err != nil {
		log.Errorf("Failed to create user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
		return
	}

	// Generate token
	token, err := GenerateToken(user.ID, user.Email, user.Username, user.IsAdmin, h.secret)
	if err != nil {
		log.Errorf("Failed to generate token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	log.Infof("New user registered: %s (%s)", user.Email, user.Username)

	c.JSON(http.StatusCreated, gin.H{
		"token": token,
		"user": gin.H{
			"id":            user.ID,
			"email":         user.Email,
			"username":      user.Username,
			"full_name":     user.FullName,
			"auth_provider": user.AuthProvider,
			"is_admin":      user.IsAdmin,
		},
	})
}

// Signin handles user login
func (h *Handler) Signin(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user
	user, err := h.db.GetUserByEmail(req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// Check if user is local auth
	if user.AuthProvider != "local" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "this account uses " + user.AuthProvider + " authentication",
		})
		return
	}

	// Check password
	if !CheckPassword(req.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	// Check if active
	if !user.IsActive {
		c.JSON(http.StatusForbidden, gin.H{"error": "account is disabled"})
		return
	}

	// Update last login
	if err := h.db.UpdateUserLastLogin(user.ID); err != nil {
		log.Warnf("Failed to update last login for user %d: %v", user.ID, err)
	}

	// Generate token
	token, err := GenerateToken(user.ID, user.Email, user.Username, user.IsAdmin, h.secret)
	if err != nil {
		log.Errorf("Failed to generate token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	log.Infof("User signed in: %s (%s)", user.Email, user.Username)

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":            user.ID,
			"email":         user.Email,
			"username":      user.Username,
			"full_name":     user.FullName,
			"avatar_url":    user.AvatarURL,
			"auth_provider": user.AuthProvider,
			"is_admin":      user.IsAdmin,
		},
	})
}

// GetCurrentUser returns the currently authenticated user
func (h *Handler) GetCurrentUser(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	user, err := h.db.GetUserByID(userID.(int))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":            user.ID,
		"email":         user.Email,
		"username":      user.Username,
		"full_name":     user.FullName,
		"avatar_url":    user.AvatarURL,
		"auth_provider": user.AuthProvider,
		"is_admin":      user.IsAdmin,
		"last_login":    user.LastLogin,
		"created_at":    user.CreatedAt,
	})
}

// ChangePassword allows users to change their password
func (h *Handler) ChangePassword(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req struct {
		CurrentPassword string `json:"current_password" binding:"required"`
		NewPassword     string `json:"new_password" binding:"required,min=8"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.db.GetUserByID(userID.(int))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// Verify current password
	if !CheckPassword(req.CurrentPassword, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "current password is incorrect"})
		return
	}

	// Hash new password
	newPasswordHash, err := HashPassword(req.NewPassword)
	if err != nil {
		log.Errorf("Failed to hash new password: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update password"})
		return
	}

	// Update password
	user.PasswordHash = newPasswordHash
	if err := h.db.UpdateUser(user); err != nil {
		log.Errorf("Failed to update user password: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update password"})
		return
	}

	log.Infof("User %s changed password", user.Email)

	c.JSON(http.StatusOK, gin.H{"message": "password updated successfully"})
}

// UpdateProfile allows users to update their own profile
func (h *Handler) UpdateProfile(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	var req struct {
		Username string `json:"username" binding:"required,min=3,max=30"`
		FullName string `json:"full_name"`
		AvatarURL string `json:"avatar_url"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.db.GetUserByID(userID.(int))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	// Check if username is already taken by another user
	users, _ := h.db.ListUsers()
	for _, u := range users {
		if u.Username == req.Username && u.ID != user.ID {
			c.JSON(http.StatusConflict, gin.H{"error": "username already taken"})
			return
		}
	}

	// Update user profile
	user.Username = req.Username
	user.FullName = req.FullName
	user.AvatarURL = req.AvatarURL

	if err := h.db.UpdateUser(user); err != nil {
		log.Errorf("Failed to update user profile: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update profile"})
		return
	}

	log.Infof("User %s updated their profile", user.Email)

	c.JSON(http.StatusOK, gin.H{
		"message": "profile updated successfully",
		"user": gin.H{
			"id":            user.ID,
			"email":         user.Email,
			"username":      user.Username,
			"full_name":     user.FullName,
			"avatar_url":    user.AvatarURL,
			"auth_provider": user.AuthProvider,
			"is_admin":      user.IsAdmin,
		},
	})
}

// Logout handles user logout
func (h *Handler) Logout(c *gin.Context) {
	// Get user info from context (set by AuthMiddleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not authenticated"})
		return
	}

	email, _ := c.Get("email")
	
	log.Infof("User %s (ID: %d) logged out", email, userID)

	// In a JWT-based system, logout is primarily handled client-side by removing the token
	// However, we can log the event and potentially invalidate refresh tokens if implemented
	c.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
}

