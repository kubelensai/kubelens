package audit

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sonnguyen/kubelens/internal/db"
	log "github.com/sirupsen/logrus"
)

// Handler handles audit-related API requests
type Handler struct {
	db               *db.DB
	logger           *Logger
	retentionManager *RetentionManager
}

// NewHandler creates a new audit handler
func NewHandler(database *db.DB, logger *Logger, retentionManager *RetentionManager) *Handler {
	return &Handler{
		db:               database,
		logger:           logger,
		retentionManager: retentionManager,
	}
}

// ========== Audit Logs Endpoints ==========

// ListAuditLogs handles GET /api/v1/audit/logs
func (h *Handler) ListAuditLogs(c *gin.Context) {
	// Parse pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))
	if pageSize > 500 {
		pageSize = 500 // Max 500 per page
	}

	// Parse filters
	filters := make(map[string]interface{})
	
	if startDate := c.Query("start_date"); startDate != "" {
		if t, err := time.Parse(time.RFC3339, startDate); err == nil {
			filters["start_date"] = t
		}
	}
	if endDate := c.Query("end_date"); endDate != "" {
		if t, err := time.Parse(time.RFC3339, endDate); err == nil {
			filters["end_date"] = t
		}
	}
	if eventType := c.Query("event_type"); eventType != "" {
		filters["event_type"] = eventType
	}
	if eventCategory := c.Query("event_category"); eventCategory != "" {
		filters["event_category"] = eventCategory
	}
	if level := c.Query("level"); level != "" {
		filters["level"] = level
	}
	if userID := c.Query("user_id"); userID != "" {
		if id, err := strconv.Atoi(userID); err == nil {
			filters["user_id"] = id
		}
	}
	if sourceIP := c.Query("source_ip"); sourceIP != "" {
		filters["source_ip"] = sourceIP
	}
	if resourceType := c.Query("resource_type"); resourceType != "" {
		filters["resource_type"] = resourceType
	}
	if clusterName := c.Query("cluster_name"); clusterName != "" {
		filters["cluster_name"] = clusterName
	}
	if namespace := c.Query("namespace"); namespace != "" {
		filters["namespace"] = namespace
	}
	if success := c.Query("success"); success != "" {
		filters["success"] = success == "true"
	}
	if search := c.Query("search"); search != "" {
		filters["search"] = search
	}

	// Query logs
	logs, total, err := h.db.ListAuditLogs(page, pageSize, filters)
	if err != nil {
		log.Errorf("Failed to list audit logs: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve audit logs"})
		return
	}

	totalPages := (total + pageSize - 1) / pageSize

	c.JSON(http.StatusOK, gin.H{
		"logs":        logs,
		"total":       total,
		"page":        page,
		"page_size":   pageSize,
		"total_pages": totalPages,
	})
}

// GetAuditLog handles GET /api/v1/audit/logs/:id
func (h *Handler) GetAuditLog(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid log ID"})
		return
	}

	logEntry, err := h.db.GetAuditLogByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Audit log not found"})
		return
	}

	c.JSON(http.StatusOK, logEntry)
}

// GetAuditStats handles GET /api/v1/audit/logs/stats
func (h *Handler) GetAuditStats(c *gin.Context) {
	period := c.DefaultQuery("period", "24h")

	// Parse period to time duration
	duration, err := time.ParseDuration(period)
	if err != nil {
		duration = 24 * time.Hour // Default to 24 hours
	}

	endDate := time.Now()
	startDate := endDate.Add(-duration)

	stats, err := h.db.GetAuditLogStats(startDate, endDate)
	if err != nil {
		log.Errorf("Failed to get audit stats: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve statistics"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// ExportAuditLogs handles POST /api/v1/audit/export
func (h *Handler) ExportAuditLogs(c *gin.Context) {
	var req struct {
		StartDate string `json:"start_date"`
		EndDate   string `json:"end_date"`
		Format    string `json:"format"` // json, csv
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Parse dates
	startDate, err := time.Parse(time.RFC3339, req.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_date format"})
		return
	}
	endDate, err := time.Parse(time.RFC3339, req.EndDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end_date format"})
		return
	}

	// Query logs for export
	filters := map[string]interface{}{
		"start_date": startDate,
		"end_date":   endDate,
	}
	logs, _, err := h.db.ListAuditLogs(1, 100000, filters) // Large limit for export
	if err != nil {
		log.Errorf("Failed to export audit logs: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to export logs"})
		return
	}

	// Return as JSON (CSV export can be added later)
	c.Header("Content-Disposition", "attachment; filename=audit_logs.json")
	c.JSON(http.StatusOK, logs)
}

// ========== Audit Settings Endpoints ==========

// GetAuditSettings handles GET /api/v1/audit/settings
func (h *Handler) GetAuditSettings(c *gin.Context) {
	settings, err := h.db.GetAuditSettings()
	if err != nil {
		log.Errorf("Failed to get audit settings: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve settings"})
		return
	}

	c.JSON(http.StatusOK, settings)
}

// UpdateAuditSettings handles PUT /api/v1/audit/settings
func (h *Handler) UpdateAuditSettings(c *gin.Context) {
	var settings db.AuditSettings
	if err := c.ShouldBindJSON(&settings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Get current user ID from context
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Set updated by user ID
	if userID != nil {
		uid := uint(userID.(int))
		settings.UpdatedBy = &uid
	}

	// Update settings in database
	if err := h.db.UpdateAuditSettings(&settings); err != nil {
		log.Errorf("Failed to update audit settings: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update settings"})
		return
	}

	// Update logger's cached settings
	h.logger.UpdateSettings(&settings)

	c.JSON(http.StatusOK, gin.H{"message": "Settings updated successfully"})
}

// GetAuditPresets handles GET /api/v1/audit/settings/presets
func (h *Handler) GetAuditPresets(c *gin.Context) {
	presets := GetPresets()
	c.JSON(http.StatusOK, presets)
}

// ApplyAuditPreset handles POST /api/v1/audit/settings/preset/:name
func (h *Handler) ApplyAuditPreset(c *gin.Context) {
	presetName := c.Param("name")

	// Get current settings
	settings, err := h.db.GetAuditSettings()
	if err != nil {
		log.Errorf("Failed to get audit settings: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve settings"})
		return
	}

	// Apply preset (ApplyPreset doesn't return a value, it just modifies settings)
	settings.ApplyPreset(presetName)

	// Get current user ID
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Set updated by user ID
	if userID != nil {
		uid := uint(userID.(int))
		settings.UpdatedBy = &uid
	}

	// Update settings in database
	if err := h.db.UpdateAuditSettings(settings); err != nil {
		log.Errorf("Failed to apply preset: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to apply preset"})
		return
	}

	// Update logger's cached settings
	h.logger.UpdateSettings(settings)

	c.JSON(http.StatusOK, gin.H{"message": "Preset applied successfully"})
}

// GetStorageImpact handles GET /api/v1/audit/settings/impact
func (h *Handler) GetStorageImpact(c *gin.Context) {
	settings, err := h.db.GetAuditSettings()
	if err != nil {
		log.Errorf("Failed to get audit settings: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve settings"})
		return
	}

	reduction := settings.CalculateStorageImpact()

	c.JSON(http.StatusOK, gin.H{
		"reduction_percentage": reduction,
		"estimated_storage":    "Calculated based on current settings",
	})
}

// ========== Retention Management Endpoints ==========

// GetRetentionStats handles GET /api/v1/audit/retention/stats
func (h *Handler) GetRetentionStats(c *gin.Context) {
	stats, err := h.db.GetRetentionStats()
	if err != nil {
		log.Errorf("Failed to get retention stats: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve statistics"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// TriggerArchive handles POST /api/v1/audit/retention/archive
func (h *Handler) TriggerArchive(c *gin.Context) {
	// Trigger archiving manually
	go h.retentionManager.RunNow()

	c.JSON(http.StatusOK, gin.H{"message": "Archiving triggered successfully"})
}

// TriggerCleanup handles POST /api/v1/audit/retention/cleanup
func (h *Handler) TriggerCleanup(c *gin.Context) {
	// Trigger cleanup manually
	go h.retentionManager.RunNow()

	c.JSON(http.StatusOK, gin.H{"message": "Cleanup triggered successfully"})
}

// GetRetentionPolicy handles GET /api/v1/audit/retention/policy
func (h *Handler) GetRetentionPolicy(c *gin.Context) {
	policy := h.retentionManager.GetPolicy()
	c.JSON(http.StatusOK, policy)
}

// UpdateRetentionPolicy handles PUT /api/v1/audit/retention/policy
func (h *Handler) UpdateRetentionPolicy(c *gin.Context) {
	var policy RetentionPolicy
	if err := c.ShouldBindJSON(&policy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Validate policy
	if policy.HotRetentionDays < 1 || policy.WarmRetentionDays < 1 || 
	   policy.ColdRetentionDays < 1 || policy.CriticalRetentionDays < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Retention days must be at least 1"})
		return
	}

	h.retentionManager.UpdatePolicy(policy)

	c.JSON(http.StatusOK, gin.H{"message": "Retention policy updated successfully"})
}

