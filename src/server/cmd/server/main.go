package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"

	"github.com/sonnguyen/kubelens/internal/api"
	"github.com/sonnguyen/kubelens/internal/audit"
	"github.com/sonnguyen/kubelens/internal/auth"
	"github.com/sonnguyen/kubelens/internal/cluster"
	"github.com/sonnguyen/kubelens/internal/middleware"
	"github.com/sonnguyen/kubelens/internal/config"
	"github.com/sonnguyen/kubelens/internal/db"
	"github.com/sonnguyen/kubelens/internal/extension"
	"github.com/sonnguyen/kubelens/internal/ws"

	// Import all client-go auth plugins
	_ "k8s.io/client-go/plugin/pkg/client/auth"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Setup logging
	setupLogging(cfg.LogLevel)

	log.Info("Starting kubelens server...")

	// Initialize database
	dbConnectionString := cfg.GetDatabaseConnectionString()
	dbType := cfg.DatabaseType
	if dbType == "" {
		dbType = "sqlite"
	}
	
	switch dbType {
	case "postgres", "postgresql":
		log.Infof("💾 Connecting to PostgreSQL database at %s:%d", cfg.DatabaseHost, cfg.DatabasePort)
	case "mysql":
		log.Infof("💾 Connecting to MySQL database at %s:%d", cfg.DatabaseHost, cfg.DatabasePort)
	default:
		dbPath := cfg.DatabasePath
		if dbPath == "" {
			dbPath = "./data/kubelens.db"
		}
		log.Infof("💾 Using SQLite database: %s", dbPath)
	}
	
	database, err := db.New(dbConnectionString)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	// Initialize default admin user and groups
	if err := database.InitializeDefaultData(cfg.AdminPassword); err != nil {
		log.Warnf("Failed to initialize default data: %v", err)
	}

	// Initialize cluster manager
	clusterManager := cluster.NewManager(database)

	// Load clusters from configuration
	if err := clusterManager.LoadFromConfig(cfg); err != nil {
		log.Warnf("Failed to load clusters from config: %v", err)
	}

	// Initialize WebSocket hub
	wsHub := ws.NewHub()
	go wsHub.Run()

	// Initialize audit logger and retention manager
	auditLogger := audit.NewLogger(database)
	audit.InitGlobalLogger(database) // Initialize global logger for package-level Log() function
	retentionPolicy := audit.DefaultRetentionPolicy()
	retentionManager := audit.NewRetentionManager(database, retentionPolicy)
	retentionManager.Start()
	defer retentionManager.Stop()

	// Setup Gin router
	if cfg.ReleaseMode {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// Security headers middleware
	router.Use(middleware.SecurityHeaders())

	// CORS middleware - Allow all origins in development (easier for testing)
	// For production, set specific origins via CORS_ORIGINS env var
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true // Simple and works for all scenarios
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{
		"Origin", "Content-Type", "Accept", "Authorization",
		"User-Agent", "Referer", "Accept-Language", "Accept-Encoding",
		"Connection", "Upgrade-Insecure-Requests",
		"Sec-Fetch-Dest", "Sec-Fetch-Mode", "Sec-Fetch-Site",
		"sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform",
		"X-Requested-With", "Cache-Control", "Pragma",
	}
	corsConfig.ExposeHeaders = []string{"Content-Length"}
	corsConfig.MaxAge = 12 * time.Hour
	
	router.Use(cors.New(corsConfig))

	// Global rate limiting (configurable via KUBELENS_GLOBAL_RATE_LIMIT_PER_MIN, default: 1000 req/min)
	globalRequestsPerMin := cfg.GlobalRateLimitPerMin
	if globalRequestsPerMin <= 0 {
		globalRequestsPerMin = 1000 // Fallback to default
	}
	globalRateInterval := time.Duration(60000/globalRequestsPerMin) * time.Millisecond
	globalBurst := globalRequestsPerMin // Burst size = requests per minute
	log.Infof("🛡️  Global rate limit: %d requests/min (1 request per %v, burst: %d)", 
		globalRequestsPerMin, globalRateInterval, globalBurst)
	
	globalRateLimiter := middleware.NewRateLimiter(globalRateInterval, globalBurst)
	router.Use(globalRateLimiter.Middleware())

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"version": "1.0.0",
		})
	})

	// Initialize extension manager
	// Use KUBELENS_EXTENSIONS_DIR or default to /app/extensions (bundled extensions)
	extensionDir := os.Getenv("KUBELENS_EXTENSIONS_DIR")
	if extensionDir == "" {
		extensionDir = "/app/extensions"
	}
	extensionManager, err := extension.NewManager(extensionDir, database, auditLogger, cfg.PublicURL)
	if err != nil {
		log.Warnf("Failed to initialize extension manager: %v", err)
	} else {
		// Load extensions
		if err := extensionManager.LoadExtensions(); err != nil {
			log.Warnf("Failed to load extensions: %v", err)
		} else {
			log.Infof("🧩 Extension manager initialized")
		}

		// Register extension HTTP proxies (e.g., /api/v1/auth/oauth for OAuth2)
		extensionManager.RegisterHTTPProxies(router)
	}

	// Initialize auth handler
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "kubelens-secret-change-in-production" // Default for development
		log.Warn("⚠️  JWT_SECRET not set, using default (not secure for production!)")
	}
	authHandler := auth.NewHandler(database, jwtSecret, auditLogger)
	
	// Set database for auth middleware (for user status checking)
	auth.SetMiddlewareDB(database)

	// API routes
	apiHandler := api.NewHandler(clusterManager, database, wsHub)
	v1 := router.Group("/api/v1")
	{
		// Login rate limiter (configurable via KUBELENS_LOGIN_RATE_LIMIT_PER_MIN, default: 5 req/min)
		loginRequestsPerMin := cfg.LoginRateLimitPerMin
		if loginRequestsPerMin <= 0 {
			loginRequestsPerMin = 5 // Fallback to default
		}
		loginRateInterval := time.Duration(60000/loginRequestsPerMin) * time.Millisecond
		loginBurst := loginRequestsPerMin // Burst size = requests per minute
		log.Infof("🔐 Login rate limit: %d requests/min (1 request per %v, burst: %d)", 
			loginRequestsPerMin, loginRateInterval, loginBurst)
		
		loginRateLimiter := middleware.NewRateLimiter(loginRateInterval, loginBurst)
		
		// Authentication routes (public)
		authRoutes := v1.Group("/auth")
		{
			// Signup disabled
			// authRoutes.POST("/signup", authHandler.Signup)
			authRoutes.POST("/signin", loginRateLimiter.Middleware(), authHandler.Signin)
			
			// SSO providers endpoint (public - no auth required for login page)
			if extensionManager != nil {
				extensionManager.RegisterPublicRoutes(v1)
			}
			authRoutes.GET("/me", auth.AuthMiddleware(jwtSecret), authHandler.GetCurrentUser)
			authRoutes.GET("/me/avatar", auth.AuthMiddleware(jwtSecret), authHandler.GetCurrentUserAvatar)
			authRoutes.PATCH("/profile", auth.AuthMiddleware(jwtSecret), authHandler.UpdateProfile)
			authRoutes.POST("/change-password", auth.AuthMiddleware(jwtSecret), authHandler.ChangePassword)
			authRoutes.POST("/logout", auth.AuthMiddleware(jwtSecret), authHandler.Logout)

			// MFA routes
			mfaHandler := auth.NewMFAHandler(database)
			mfaRoutes := authRoutes.Group("/mfa")
			mfaRoutes.Use(auth.AuthMiddleware(jwtSecret))
			{
				mfaRoutes.POST("/setup", mfaHandler.SetupMFA)
				mfaRoutes.POST("/enable", mfaHandler.VerifyAndEnableMFA)
				mfaRoutes.POST("/disable", mfaHandler.DisableMFA)
				mfaRoutes.GET("/status", mfaHandler.GetMFAStatus)
				mfaRoutes.POST("/regenerate-codes", mfaHandler.RegenerateBackupCodes)
			}
		}
		
		// Public avatar endpoint (no auth required - avatars are not sensitive)
		v1.GET("/avatars/:id", authHandler.GetUserAvatar)

		// User management routes - requires "users" permission
		userRoutes := v1.Group("/users")
		userRoutes.Use(auth.AuthMiddleware(jwtSecret), authHandler.PermissionChecker("users", "read"))
		{
			userRoutes.GET("", authHandler.ListUsers)
			userRoutes.GET("/:id", authHandler.GetUser)
			userRoutes.GET("/:id/avatar", authHandler.GetUserAvatar) // Serve cached avatar
			userRoutes.GET("/:id/groups", authHandler.GetUserGroups)
			
			// Write operations require specific permissions
			userRoutes.POST("", authHandler.PermissionChecker("users", "create"), authHandler.CreateUser)
			userRoutes.PATCH("/:id", authHandler.PermissionChecker("users", "update"), authHandler.UpdateUser)
			userRoutes.DELETE("/:id", authHandler.PermissionChecker("users", "delete"), authHandler.DeleteUser)
			userRoutes.PUT("/:id/groups", authHandler.PermissionChecker("users", "update"), authHandler.UpdateUserGroups)
			userRoutes.POST("/:id/reset-password", authHandler.PermissionChecker("users", "update"), authHandler.ResetUserPassword)
			
			// MFA admin routes - manage permission
			mfaHandler := auth.NewMFAHandler(database)
			userRoutes.POST("/:id/reset-mfa", authHandler.PermissionChecker("users", "manage"), mfaHandler.AdminResetMFA)
		}

		// Permission options route - requires settings permission
		v1.GET("/permissions/options", auth.AuthMiddleware(jwtSecret), authHandler.PermissionChecker("settings", "read"), authHandler.GetPermissionOptions)

		// Group management routes - requires "groups" permission
		groupRoutes := v1.Group("/groups")
		groupRoutes.Use(auth.AuthMiddleware(jwtSecret), authHandler.PermissionChecker("groups", "read"))
		{
			groupRoutes.GET("", authHandler.ListGroups)
			groupRoutes.GET("/:id", authHandler.GetGroup)
			groupRoutes.GET("/:id/users", authHandler.ListGroupUsers)
			
			// Write operations require specific permissions
			groupRoutes.POST("", authHandler.PermissionChecker("groups", "create"), authHandler.CreateGroup)
			groupRoutes.PUT("/:id", authHandler.PermissionChecker("groups", "update"), authHandler.UpdateGroupHandler)
			groupRoutes.DELETE("/:id", authHandler.PermissionChecker("groups", "delete"), authHandler.DeleteGroup)
			groupRoutes.POST("/:id/users", authHandler.PermissionChecker("groups", "update"), authHandler.AddUserToGroupHandler)
			groupRoutes.DELETE("/:id/users/:user_id", authHandler.PermissionChecker("groups", "update"), authHandler.RemoveUserFromGroupHandler)
		}

		// User session routes (authenticated users)
		sessionRoutes := v1.Group("/session")
		sessionRoutes.Use(auth.AuthMiddleware(jwtSecret))
		{
			sessionRoutes.GET("", authHandler.GetSession)
			sessionRoutes.PUT("", authHandler.UpdateSession)
		}

		// Notification routes (authenticated users)
		notificationRoutes := v1.Group("/notifications")
		notificationRoutes.Use(auth.AuthMiddleware(jwtSecret))
		{
			notificationRoutes.GET("", authHandler.GetNotifications)
			notificationRoutes.GET("/unread", authHandler.GetUnreadNotifications)
			notificationRoutes.GET("/unread/count", authHandler.GetUnreadCount)
			notificationRoutes.POST("", authHandler.CreateNotification) // Admin or internal use
			notificationRoutes.PUT("/:id/read", authHandler.MarkNotificationAsRead)
			notificationRoutes.PUT("/read-all", authHandler.MarkAllNotificationsAsRead)
			notificationRoutes.DELETE("/:id", authHandler.DeleteNotification)
			notificationRoutes.DELETE("", authHandler.ClearAllNotifications)
		}

		// User permissions route (authenticated users)
		v1.GET("/permissions", auth.AuthMiddleware(jwtSecret), authHandler.GetUserPermissionsHandler)

		// Audit routes - requires "audit" permission
		auditHandler := audit.NewHandler(database, auditLogger, retentionManager)
		auditRoutes := v1.Group("/audit")
		auditRoutes.Use(auth.AuthMiddleware(jwtSecret), authHandler.PermissionChecker("audit", "read"))
		{
			// Audit logs - read operations
			auditRoutes.GET("/logs", auditHandler.ListAuditLogs)
			auditRoutes.GET("/logs/:id", auditHandler.GetAuditLog)
			auditRoutes.GET("/logs/stats", auditHandler.GetAuditStats)
			auditRoutes.POST("/export", auditHandler.ExportAuditLogs)

			// Audit settings - read operations
			auditRoutes.GET("/settings", auditHandler.GetAuditSettings)
			auditRoutes.GET("/settings/presets", auditHandler.GetAuditPresets)
			auditRoutes.GET("/settings/impact", auditHandler.GetStorageImpact)
			
			// Audit settings - write operations require update permission
			auditRoutes.PUT("/settings", authHandler.PermissionChecker("audit", "update"), auditHandler.UpdateAuditSettings)
			auditRoutes.POST("/settings/preset/:name", authHandler.PermissionChecker("audit", "update"), auditHandler.ApplyAuditPreset)

			// Retention management - read operations
			auditRoutes.GET("/retention/stats", auditHandler.GetRetentionStats)
			auditRoutes.GET("/retention/policy", auditHandler.GetRetentionPolicy)
			
			// Retention management - write operations require manage permission
			auditRoutes.POST("/retention/archive", authHandler.PermissionChecker("audit", "manage"), auditHandler.TriggerArchive)
			auditRoutes.POST("/retention/cleanup", authHandler.PermissionChecker("audit", "manage"), auditHandler.TriggerCleanup)
			auditRoutes.PUT("/retention/policy", authHandler.PermissionChecker("audit", "update"), auditHandler.UpdateRetentionPolicy)
		}

	// Protected routes - require authentication
	protected := v1.Group("")
	protected.Use(auth.AuthMiddleware(jwtSecret))
	{
		// Extension management routes with RBAC
		if extensionManager != nil {
			extensionManager.RegisterRoutesWithRBAC(protected, authHandler.PermissionChecker)
		}

		// Global search across all resources
		protected.GET("/search", apiHandler.Search)

		// Cluster management - read operations available to all authenticated users
		protected.GET("/clusters", apiHandler.ListClusters)
		protected.GET("/clusters/:name/status", apiHandler.GetClusterStatus)
		protected.GET("/clusters/:name/metrics", apiHandler.GetClusterMetrics)
		protected.GET("/clusters/:name/resources-summary", apiHandler.GetClusterResourcesSummary)
		
		// Cluster management - write operations require clusters permission
		protected.POST("/clusters", authHandler.PermissionChecker("clusters", "create"), apiHandler.AddCluster)
		protected.PUT("/clusters/:name", authHandler.PermissionChecker("clusters", "update"), apiHandler.UpdateCluster)
		protected.PATCH("/clusters/:name/enabled", authHandler.PermissionChecker("clusters", "update"), apiHandler.UpdateClusterEnabled)
		protected.DELETE("/clusters/:name", authHandler.PermissionChecker("clusters", "delete"), apiHandler.RemoveCluster)

		// Namespaces (cluster-scoped)
		protected.GET("/clusters/:name/namespaces", apiHandler.ListNamespaces)
		protected.GET("/clusters/:name/namespaces/:namespace", apiHandler.GetNamespace)
		protected.GET("/clusters/:name/namespaces/:namespace/metrics", apiHandler.GetNamespaceMetrics)
		protected.PUT("/clusters/:name/namespaces/:namespace", apiHandler.UpdateNamespace)
		protected.DELETE("/clusters/:name/namespaces/:namespace", apiHandler.DeleteNamespace)

		// Pods
		protected.GET("/clusters/:name/pods", apiHandler.ListPods)
		protected.GET("/clusters/:name/namespaces/:namespace/pods/:pod", apiHandler.GetPod)
		protected.GET("/clusters/:name/namespaces/:namespace/pods/:pod/metrics", apiHandler.GetPodMetrics)
		protected.PUT("/clusters/:name/namespaces/:namespace/pods/:pod", apiHandler.UpdatePod)
		protected.DELETE("/clusters/:name/namespaces/:namespace/pods/:pod", apiHandler.DeletePod)
		protected.POST("/clusters/:name/namespaces/:namespace/pods/:pod/evict", apiHandler.EvictPod)
		protected.GET("/clusters/:name/namespaces/:namespace/pods/:pod/logs", apiHandler.GetPodLogs)
		protected.GET("/clusters/:name/namespaces/:namespace/pods/logs", apiHandler.GetMultiPodLogs)
		protected.GET("/clusters/:name/namespaces/:namespace/pods/:pod/logs/stream", apiHandler.PodLogsStream)
		protected.GET("/clusters/:name/namespaces/:namespace/pods/logs/stream", apiHandler.MultiPodLogsStream)
		protected.GET("/clusters/:name/namespaces/:namespace/pods/:pod/shell", apiHandler.PodShell)

		// Deployments
		protected.GET("/clusters/:name/deployments", apiHandler.ListDeployments)
		protected.GET("/clusters/:name/namespaces/:namespace/deployments/:deployment", apiHandler.GetDeployment)
		protected.PUT("/clusters/:name/namespaces/:namespace/deployments/:deployment", apiHandler.UpdateDeployment)
		protected.DELETE("/clusters/:name/namespaces/:namespace/deployments/:deployment", apiHandler.DeleteDeployment)
		protected.PATCH("/clusters/:name/namespaces/:namespace/deployments/:deployment/scale", apiHandler.ScaleDeployment)
		protected.POST("/clusters/:name/namespaces/:namespace/deployments/:deployment/restart", apiHandler.RestartDeployment)

		// DaemonSets
		protected.GET("/clusters/:name/daemonsets", apiHandler.ListDaemonSets)
		protected.GET("/clusters/:name/namespaces/:namespace/daemonsets/:daemonset", apiHandler.GetDaemonSet)
		protected.PUT("/clusters/:name/namespaces/:namespace/daemonsets/:daemonset", apiHandler.UpdateDaemonSet)
		protected.DELETE("/clusters/:name/namespaces/:namespace/daemonsets/:daemonset", apiHandler.DeleteDaemonSet)
		protected.POST("/clusters/:name/namespaces/:namespace/daemonsets/:daemonset/restart", apiHandler.RestartDaemonSet)

		// StatefulSets
		protected.GET("/clusters/:name/statefulsets", apiHandler.ListStatefulSets)
		protected.GET("/clusters/:name/namespaces/:namespace/statefulsets/:statefulset", apiHandler.GetStatefulSet)
		protected.PUT("/clusters/:name/namespaces/:namespace/statefulsets/:statefulset", apiHandler.UpdateStatefulSet)
		protected.DELETE("/clusters/:name/namespaces/:namespace/statefulsets/:statefulset", apiHandler.DeleteStatefulSet)
		protected.PATCH("/clusters/:name/namespaces/:namespace/statefulsets/:statefulset/scale", apiHandler.ScaleStatefulSet)
		protected.POST("/clusters/:name/namespaces/:namespace/statefulsets/:statefulset/restart", apiHandler.RestartStatefulSet)

		// ReplicaSets
		protected.GET("/clusters/:name/replicasets", apiHandler.ListReplicaSets)
		protected.GET("/clusters/:name/namespaces/:namespace/replicasets/:replicaset", apiHandler.GetReplicaSet)
		protected.PUT("/clusters/:name/namespaces/:namespace/replicasets/:replicaset", apiHandler.UpdateReplicaSet)
		protected.DELETE("/clusters/:name/namespaces/:namespace/replicasets/:replicaset", apiHandler.DeleteReplicaSet)
		protected.PATCH("/clusters/:name/namespaces/:namespace/replicasets/:replicaset/scale", apiHandler.ScaleReplicaSet)

		// Jobs
		protected.GET("/clusters/:name/jobs", apiHandler.ListJobs)
		protected.GET("/clusters/:name/namespaces/:namespace/jobs/:job", apiHandler.GetJob)
		protected.PUT("/clusters/:name/namespaces/:namespace/jobs/:job", apiHandler.UpdateJob)
		protected.DELETE("/clusters/:name/namespaces/:namespace/jobs/:job", apiHandler.DeleteJob)

		// CronJobs
		protected.GET("/clusters/:name/cronjobs", apiHandler.ListCronJobs)
		protected.GET("/clusters/:name/namespaces/:namespace/cronjobs/:cronjob", apiHandler.GetCronJob)
		protected.PUT("/clusters/:name/namespaces/:namespace/cronjobs/:cronjob", apiHandler.UpdateCronJob)
		protected.DELETE("/clusters/:name/namespaces/:namespace/cronjobs/:cronjob", apiHandler.DeleteCronJob)

		// Services
		protected.GET("/clusters/:name/services", apiHandler.ListServices)
		protected.GET("/clusters/:name/namespaces/:namespace/services/:service", apiHandler.GetService)
		protected.PUT("/clusters/:name/namespaces/:namespace/services/:service", apiHandler.UpdateService)

		// Endpoints
		protected.GET("/clusters/:name/endpoints", apiHandler.ListEndpoints)
		protected.GET("/clusters/:name/namespaces/:namespace/endpoints/:endpoint", apiHandler.GetEndpoint)

		// Ingresses (namespaced)
		protected.GET("/clusters/:name/namespaces/:namespace/ingresses", apiHandler.ListIngresses)
		protected.GET("/clusters/:name/ingresses", apiHandler.ListIngresses)
		protected.GET("/clusters/:name/namespaces/:namespace/ingresses/:ingress", apiHandler.GetIngress)
		protected.POST("/clusters/:name/namespaces/:namespace/ingresses", apiHandler.CreateIngress)
		protected.PUT("/clusters/:name/namespaces/:namespace/ingresses/:ingress", apiHandler.UpdateIngress)
		protected.DELETE("/clusters/:name/namespaces/:namespace/ingresses/:ingress", apiHandler.DeleteIngress)

		// Ingress Classes (cluster-scoped)
		protected.GET("/clusters/:name/ingressclasses", apiHandler.ListIngressClasses)
		protected.GET("/clusters/:name/ingressclasses/:ingressclass", apiHandler.GetIngressClass)
		protected.POST("/clusters/:name/ingressclasses", apiHandler.CreateIngressClass)
		protected.PUT("/clusters/:name/ingressclasses/:ingressclass", apiHandler.UpdateIngressClass)
		protected.DELETE("/clusters/:name/ingressclasses/:ingressclass", apiHandler.DeleteIngressClass)

		// Network Policies (namespaced)
		protected.GET("/clusters/:name/networkpolicies", apiHandler.ListNetworkPolicies)
		protected.GET("/clusters/:name/namespaces/:namespace/networkpolicies", apiHandler.ListNetworkPolicies)
		protected.GET("/clusters/:name/namespaces/:namespace/networkpolicies/:networkpolicy", apiHandler.GetNetworkPolicy)
		protected.PUT("/clusters/:name/namespaces/:namespace/networkpolicies/:networkpolicy", apiHandler.UpdateNetworkPolicy)
		protected.DELETE("/clusters/:name/namespaces/:namespace/networkpolicies/:networkpolicy", apiHandler.DeleteNetworkPolicy)

		// ConfigMaps
		protected.GET("/clusters/:name/configmaps", apiHandler.ListConfigMaps)
		protected.POST("/clusters/:name/namespaces/:namespace/configmaps", apiHandler.CreateConfigMap)
		protected.GET("/clusters/:name/namespaces/:namespace/configmaps/:configmap", apiHandler.GetConfigMap)
		protected.PUT("/clusters/:name/namespaces/:namespace/configmaps/:configmap", apiHandler.UpdateConfigMap)
		protected.DELETE("/clusters/:name/namespaces/:namespace/configmaps/:configmap", apiHandler.DeleteConfigMap)

		// Secrets
		protected.GET("/clusters/:name/secrets", apiHandler.ListSecrets)
		protected.POST("/clusters/:name/namespaces/:namespace/secrets", apiHandler.CreateSecret)
		protected.GET("/clusters/:name/namespaces/:namespace/secrets/:secret", apiHandler.GetSecret)
		protected.PUT("/clusters/:name/namespaces/:namespace/secrets/:secret", apiHandler.UpdateSecret)
		protected.DELETE("/clusters/:name/namespaces/:namespace/secrets/:secret", apiHandler.DeleteSecret)

		// Storage Classes (cluster-scoped)
		protected.GET("/clusters/:name/storageclasses", apiHandler.ListStorageClasses)
		protected.POST("/clusters/:name/storageclasses", apiHandler.CreateStorageClass)
		protected.GET("/clusters/:name/storageclasses/:storageclass", apiHandler.GetStorageClass)
		protected.PUT("/clusters/:name/storageclasses/:storageclass", apiHandler.UpdateStorageClass)
		protected.DELETE("/clusters/:name/storageclasses/:storageclass", apiHandler.DeleteStorageClass)

		// Persistent Volumes (cluster-scoped)
		protected.GET("/clusters/:name/persistentvolumes", apiHandler.ListPersistentVolumes)
		protected.GET("/clusters/:name/persistentvolumes/:pv", apiHandler.GetPersistentVolume)
		protected.PUT("/clusters/:name/persistentvolumes/:pv", apiHandler.UpdatePersistentVolume)
		protected.DELETE("/clusters/:name/persistentvolumes/:pv", apiHandler.DeletePersistentVolume)

		// Persistent Volume Claims (namespaced)
		protected.GET("/clusters/:name/persistentvolumeclaims", apiHandler.ListPersistentVolumeClaims)
		protected.GET("/clusters/:name/namespaces/:namespace/persistentvolumeclaims", apiHandler.ListPersistentVolumeClaims)
		protected.GET("/clusters/:name/namespaces/:namespace/persistentvolumeclaims/:pvc", apiHandler.GetPersistentVolumeClaim)
		protected.PUT("/clusters/:name/namespaces/:namespace/persistentvolumeclaims/:pvc", apiHandler.UpdatePersistentVolumeClaim)
		protected.DELETE("/clusters/:name/namespaces/:namespace/persistentvolumeclaims/:pvc", apiHandler.DeletePersistentVolumeClaim)

		// ServiceAccounts (namespaced)
		protected.GET("/clusters/:name/serviceaccounts", apiHandler.ListServiceAccounts)
		protected.GET("/clusters/:name/namespaces/:namespace/serviceaccounts", apiHandler.ListServiceAccountsByNamespace)
		protected.GET("/clusters/:name/namespaces/:namespace/serviceaccounts/:serviceaccount", apiHandler.GetServiceAccount)
		protected.PUT("/clusters/:name/namespaces/:namespace/serviceaccounts/:serviceaccount", apiHandler.UpdateServiceAccount)
		protected.DELETE("/clusters/:name/namespaces/:namespace/serviceaccounts/:serviceaccount", apiHandler.DeleteServiceAccount)
		protected.POST("/clusters/:name/namespaces/:namespace/serviceaccounts", apiHandler.CreateServiceAccount)

		// ClusterRoles (cluster-scoped)
		protected.GET("/clusters/:name/clusterroles", apiHandler.ListClusterRoles)
		protected.GET("/clusters/:name/clusterroles/:clusterrole", apiHandler.GetClusterRole)
		protected.PUT("/clusters/:name/clusterroles/:clusterrole", apiHandler.UpdateClusterRole)
		protected.DELETE("/clusters/:name/clusterroles/:clusterrole", apiHandler.DeleteClusterRole)
		protected.POST("/clusters/:name/clusterroles", apiHandler.CreateClusterRole)

		// Roles (namespaced)
		protected.GET("/clusters/:name/roles", apiHandler.ListRoles)
		protected.GET("/clusters/:name/namespaces/:namespace/roles", apiHandler.ListRolesByNamespace)
		protected.GET("/clusters/:name/namespaces/:namespace/roles/:role", apiHandler.GetRole)
		protected.PUT("/clusters/:name/namespaces/:namespace/roles/:role", apiHandler.UpdateRole)
		protected.DELETE("/clusters/:name/namespaces/:namespace/roles/:role", apiHandler.DeleteRole)
		protected.POST("/clusters/:name/namespaces/:namespace/roles", apiHandler.CreateRole)

		// ClusterRoleBindings (cluster-scoped)
		protected.GET("/clusters/:name/clusterrolebindings", apiHandler.ListClusterRoleBindings)
		protected.GET("/clusters/:name/clusterrolebindings/:clusterrolebinding", apiHandler.GetClusterRoleBinding)
		protected.PUT("/clusters/:name/clusterrolebindings/:clusterrolebinding", apiHandler.UpdateClusterRoleBinding)
		protected.DELETE("/clusters/:name/clusterrolebindings/:clusterrolebinding", apiHandler.DeleteClusterRoleBinding)
		protected.POST("/clusters/:name/clusterrolebindings", apiHandler.CreateClusterRoleBinding)

		// RoleBindings (namespaced)
		protected.GET("/clusters/:name/rolebindings", apiHandler.ListRoleBindings)
		protected.GET("/clusters/:name/namespaces/:namespace/rolebindings", apiHandler.ListRoleBindingsByNamespace)
		protected.GET("/clusters/:name/namespaces/:namespace/rolebindings/:rolebinding", apiHandler.GetRoleBinding)
		protected.PUT("/clusters/:name/namespaces/:namespace/rolebindings/:rolebinding", apiHandler.UpdateRoleBinding)
		protected.DELETE("/clusters/:name/namespaces/:namespace/rolebindings/:rolebinding", apiHandler.DeleteRoleBinding)
		protected.POST("/clusters/:name/namespaces/:namespace/rolebindings", apiHandler.CreateRoleBinding)

		// Nodes
		protected.GET("/clusters/:name/nodes", apiHandler.ListNodes)
		protected.GET("/clusters/:name/nodes/:node", apiHandler.GetNode)
		protected.GET("/clusters/:name/nodes/:node/metrics", apiHandler.GetNodeMetrics)
		protected.GET("/clusters/:name/nodes/:node/shell", apiHandler.NodeShell)
		protected.GET("/clusters/:name/nodes/:node/drain", apiHandler.NodeDrainInteractive)
		protected.POST("/clusters/:name/nodes/:node/cordon", apiHandler.CordonNode)
		protected.POST("/clusters/:name/nodes/:node/uncordon", apiHandler.UncordonNode)
		protected.POST("/clusters/:name/nodes/:node/drain", apiHandler.DrainNode)
		protected.DELETE("/clusters/:name/nodes/:node", apiHandler.DeleteNode)

		// Events
		protected.GET("/clusters/:name/events", apiHandler.ListEvents)

		// Horizontal Pod Autoscalers
		protected.GET("/clusters/:name/hpas", apiHandler.ListHPAs)
		protected.GET("/clusters/:name/namespaces/:namespace/hpas/:hpa", apiHandler.GetHPA)
		protected.POST("/clusters/:name/namespaces/:namespace/hpas", apiHandler.CreateHPA)
		protected.PUT("/clusters/:name/namespaces/:namespace/hpas/:hpa", apiHandler.UpdateHPA)
		protected.DELETE("/clusters/:name/namespaces/:namespace/hpas/:hpa", apiHandler.DeleteHPA)

		// Pod Disruption Budgets
		protected.GET("/clusters/:name/pdbs", apiHandler.ListPDBs)
		protected.GET("/clusters/:name/namespaces/:namespace/pdbs/:pdb", apiHandler.GetPDB)
		protected.POST("/clusters/:name/namespaces/:namespace/pdbs", apiHandler.CreatePDB)
		protected.PUT("/clusters/:name/namespaces/:namespace/pdbs/:pdb", apiHandler.UpdatePDB)
		protected.DELETE("/clusters/:name/namespaces/:namespace/pdbs/:pdb", apiHandler.DeletePDB)

		// Priority Classes (cluster-scoped)
		protected.GET("/clusters/:name/priorityclasses", apiHandler.ListPriorityClasses)
		protected.GET("/clusters/:name/priorityclasses/:priorityclass", apiHandler.GetPriorityClass)
		protected.POST("/clusters/:name/priorityclasses", apiHandler.CreatePriorityClass)
		protected.PUT("/clusters/:name/priorityclasses/:priorityclass", apiHandler.UpdatePriorityClass)
		protected.DELETE("/clusters/:name/priorityclasses/:priorityclass", apiHandler.DeletePriorityClass)

		// Runtime Classes (cluster-scoped)
		protected.GET("/clusters/:name/runtimeclasses", apiHandler.ListRuntimeClasses)
		protected.GET("/clusters/:name/runtimeclasses/:runtimeclass", apiHandler.GetRuntimeClass)
		protected.POST("/clusters/:name/runtimeclasses", apiHandler.CreateRuntimeClass)
		protected.PUT("/clusters/:name/runtimeclasses/:runtimeclass", apiHandler.UpdateRuntimeClass)
		protected.DELETE("/clusters/:name/runtimeclasses/:runtimeclass", apiHandler.DeleteRuntimeClass)

		// Leases (namespaced)
		protected.GET("/clusters/:name/namespaces/:namespace/leases", apiHandler.ListLeases)
		protected.GET("/clusters/:name/namespaces/:namespace/leases/:lease", apiHandler.GetLease)
		protected.POST("/clusters/:name/namespaces/:namespace/leases", apiHandler.CreateLease)
		protected.PUT("/clusters/:name/namespaces/:namespace/leases/:lease", apiHandler.UpdateLease)
		protected.DELETE("/clusters/:name/namespaces/:namespace/leases/:lease", apiHandler.DeleteLease)

		// Mutating Webhook Configurations (cluster-scoped)
		protected.GET("/clusters/:name/mutatingwebhookconfigurations", apiHandler.ListMutatingWebhookConfigurations)
		protected.GET("/clusters/:name/mutatingwebhookconfigurations/:webhook", apiHandler.GetMutatingWebhookConfiguration)
		protected.POST("/clusters/:name/mutatingwebhookconfigurations", apiHandler.CreateMutatingWebhookConfiguration)
		protected.PUT("/clusters/:name/mutatingwebhookconfigurations/:webhook", apiHandler.UpdateMutatingWebhookConfiguration)
		protected.DELETE("/clusters/:name/mutatingwebhookconfigurations/:webhook", apiHandler.DeleteMutatingWebhookConfiguration)

		// Validating Webhook Configurations (cluster-scoped)
		protected.GET("/clusters/:name/validatingwebhookconfigurations", apiHandler.ListValidatingWebhookConfigurations)
		protected.GET("/clusters/:name/validatingwebhookconfigurations/:webhook", apiHandler.GetValidatingWebhookConfiguration)
		protected.POST("/clusters/:name/validatingwebhookconfigurations", apiHandler.CreateValidatingWebhookConfiguration)
		protected.PUT("/clusters/:name/validatingwebhookconfigurations/:webhook", apiHandler.UpdateValidatingWebhookConfiguration)
		protected.DELETE("/clusters/:name/validatingwebhookconfigurations/:webhook", apiHandler.DeleteValidatingWebhookConfiguration)

		// Custom Resource Definitions (cluster-scoped)
		protected.GET("/clusters/:name/customresourcedefinitions", apiHandler.ListCustomResourceDefinitions)
		protected.GET("/clusters/:name/customresourcedefinitions/:crd", apiHandler.GetCustomResourceDefinition)
		protected.PUT("/clusters/:name/customresourcedefinitions/:crd", apiHandler.UpdateCustomResourceDefinition)
		protected.DELETE("/clusters/:name/customresourcedefinitions/:crd", apiHandler.DeleteCustomResourceDefinition)

		// Custom Resources (Dynamic) - cluster-scoped
		protected.GET("/clusters/:name/customresources", apiHandler.ListCustomResources)
		protected.GET("/clusters/:name/customresources/:resourcename", apiHandler.GetCustomResource)
		protected.PUT("/clusters/:name/customresources/:resourcename", apiHandler.UpdateCustomResource)
		protected.DELETE("/clusters/:name/customresources/:resourcename", apiHandler.DeleteCustomResource)

		// Custom Resources (Dynamic) - namespaced
		protected.GET("/clusters/:name/namespaces/:namespace/customresources", apiHandler.ListCustomResources)
		protected.GET("/clusters/:name/namespaces/:namespace/customresources/:resourcename", apiHandler.GetCustomResource)
		protected.PUT("/clusters/:name/namespaces/:namespace/customresources/:resourcename", apiHandler.UpdateCustomResource)
		protected.DELETE("/clusters/:name/namespaces/:namespace/customresources/:resourcename", apiHandler.DeleteCustomResource)

		// WebSocket endpoint for real-time updates
		protected.GET("/ws", func(c *gin.Context) {
			ws.ServeWs(wsHub, c.Writer, c.Request)
		})
	}
	}

	// OIDC sync endpoint (for OAuth2 extension - internal use)
	router.POST("/api/auth/oidc/sync", authHandler.HandleOIDCSync)

	// OAuth2 PKCE exchange endpoint
	// Note: This is registered BEFORE extension proxies to avoid conflict with wildcard routes
	// The extension proxy mounts at /api/v1/auth/oauth/* but we need this specific endpoint
	// handled by the main server for token exchange
	v1.POST("/auth/exchange", authHandler.HandleOAuthExchange)

	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.Infof("Server listening on port %d", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Shutdown extensions
	if extensionManager != nil {
		log.Info("Shutting down extensions...")
		extensionManager.Shutdown()
	}

	if err := srv.Shutdown(ctx); err != nil {
		log.Errorf("Server forced to shutdown: %v", err)
	}

	log.Info("Server exited")
}

func setupLogging(level string) {
	log.SetFormatter(&log.TextFormatter{
		FullTimestamp: true,
	})

	switch level {
	case "debug":
		log.SetLevel(log.DebugLevel)
	case "info":
		log.SetLevel(log.InfoLevel)
	case "warn":
		log.SetLevel(log.WarnLevel)
	case "error":
		log.SetLevel(log.ErrorLevel)
	default:
		log.SetLevel(log.InfoLevel)
	}
}

