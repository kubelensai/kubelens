package auth

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/sonnguyen/kubelens/internal/db"
	log "github.com/sirupsen/logrus"
)

// GetNotifications retrieves all notifications for the authenticated user
func (h *Handler) GetNotifications(c *gin.Context) {
	userIDVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	
	userID, ok := userIDVal.(int)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user ID"})
		return
	}
	
	// Get limit from query param (default 100)
	limitStr := c.DefaultQuery("limit", "100")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 100
	}
	
	notifications, err := h.db.GetUserNotifications(uint(userID), limit)
	if err != nil {
		log.Errorf("Failed to get notifications: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get notifications"})
		return
	}
	
	c.JSON(http.StatusOK, notifications)
}

// GetUnreadNotifications retrieves unread notifications for the authenticated user
func (h *Handler) GetUnreadNotifications(c *gin.Context) {
	userIDVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	
	userID, ok := userIDVal.(int)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user ID"})
		return
	}
	
	notifications, err := h.db.GetUnreadNotifications(uint(userID))
	if err != nil {
		log.Errorf("Failed to get unread notifications: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get unread notifications"})
		return
	}
	
	c.JSON(http.StatusOK, notifications)
}

// GetUnreadCount retrieves the count of unread notifications
func (h *Handler) GetUnreadCount(c *gin.Context) {
	userIDVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	
	userID, ok := userIDVal.(int)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user ID"})
		return
	}
	
	count, err := h.db.CountUnreadNotifications(uint(userID))
	if err != nil {
		log.Errorf("Failed to get unread count: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get unread count"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"count": count})
}

// CreateNotification creates a new notification (internal use or admin)
func (h *Handler) CreateNotification(c *gin.Context) {
	var req struct {
		UserID  int    `json:"user_id" binding:"required"`
		Type    string `json:"type" binding:"required,oneof=success error warning info"`
		Title   string `json:"title" binding:"required"`
		Message string `json:"message" binding:"required"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	notification := &db.Notification{
		UserID:  uint(req.UserID),
		Type:    req.Type,
		Title:   req.Title,
		Message: req.Message,
	}
	
	if err := h.db.CreateNotification(notification); err != nil {
		log.Errorf("Failed to create notification: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create notification"})
		return
	}
	
	c.JSON(http.StatusCreated, notification)
}

// MarkNotificationAsRead marks a notification as read
func (h *Handler) MarkNotificationAsRead(c *gin.Context) {
	_, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	
	notificationIDStr := c.Param("id")
	notificationID, err := strconv.Atoi(notificationIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid notification ID"})
		return
	}
	
	if err := h.db.MarkNotificationAsRead(uint(notificationID)); err != nil {
		log.Errorf("Failed to mark notification as read: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark notification as read"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"message": "notification marked as read"})
}

// MarkAllNotificationsAsRead marks all notifications as read
func (h *Handler) MarkAllNotificationsAsRead(c *gin.Context) {
	userIDVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	
	userID, ok := userIDVal.(int)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user ID"})
		return
	}
	
	if err := h.db.MarkAllNotificationsAsRead(uint(userID)); err != nil {
		log.Errorf("Failed to mark all notifications as read: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark all notifications as read"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"message": "all notifications marked as read"})
}

// DeleteNotification deletes a notification
func (h *Handler) DeleteNotification(c *gin.Context) {
	_, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	
	notificationIDStr := c.Param("id")
	notificationID, err := strconv.Atoi(notificationIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid notification ID"})
		return
	}
	
	if err := h.db.DeleteNotification(uint(notificationID)); err != nil{
		log.Errorf("Failed to delete notification: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete notification"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"message": "notification deleted"})
}

// ClearAllNotifications deletes all notifications for the user
func (h *Handler) ClearAllNotifications(c *gin.Context) {
	userIDVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	
	userID, ok := userIDVal.(int)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user ID"})
		return
	}
	
	if err := h.db.DeleteUserNotifications(uint(userID)); err != nil {
		log.Errorf("Failed to clear all notifications: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to clear all notifications"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"message": "all notifications cleared"})
}

