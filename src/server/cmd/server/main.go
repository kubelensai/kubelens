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
	"github.com/sonnguyen/kubelens/internal/cluster"
	"github.com/sonnguyen/kubelens/internal/config"
	"github.com/sonnguyen/kubelens/internal/db"
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
	database, err := db.New(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	// Initialize cluster manager
	clusterManager := cluster.NewManager(database)

	// Load clusters from configuration
	if err := clusterManager.LoadFromConfig(cfg); err != nil {
		log.Warnf("Failed to load clusters from config: %v", err)
	}

	// Initialize WebSocket hub
	wsHub := ws.NewHub()
	go wsHub.Run()

	// Setup Gin router
	if cfg.ReleaseMode {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// CORS middleware
	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"version": "1.0.0",
		})
	})

	// API routes
	apiHandler := api.NewHandler(clusterManager, database, wsHub)
	v1 := router.Group("/api/v1")
	{
		// Global search across all resources
		v1.GET("/search", apiHandler.Search)

		// Cluster management
		v1.GET("/clusters", apiHandler.ListClusters)
		v1.POST("/clusters", apiHandler.AddCluster)
		v1.PUT("/clusters/:name", apiHandler.UpdateCluster)
		v1.PATCH("/clusters/:name/enabled", apiHandler.UpdateClusterEnabled)
		v1.DELETE("/clusters/:name", apiHandler.RemoveCluster)
		v1.GET("/clusters/:name/status", apiHandler.GetClusterStatus)
		v1.GET("/clusters/:name/metrics", apiHandler.GetClusterMetrics)
		v1.GET("/clusters/:name/resources-summary", apiHandler.GetClusterResourcesSummary)

		// Namespaces (cluster-scoped)
		v1.GET("/clusters/:name/namespaces", apiHandler.ListNamespaces)
		v1.GET("/clusters/:name/namespaces/:namespace", apiHandler.GetNamespace)
		v1.PUT("/clusters/:name/namespaces/:namespace", apiHandler.UpdateNamespace)
		v1.DELETE("/clusters/:name/namespaces/:namespace", apiHandler.DeleteNamespace)

		// Pods
		v1.GET("/clusters/:name/pods", apiHandler.ListPods)
		v1.GET("/clusters/:name/namespaces/:namespace/pods/:pod", apiHandler.GetPod)
		v1.GET("/clusters/:name/namespaces/:namespace/pods/:pod/metrics", apiHandler.GetPodMetrics)
		v1.PUT("/clusters/:name/namespaces/:namespace/pods/:pod", apiHandler.UpdatePod)
		v1.DELETE("/clusters/:name/namespaces/:namespace/pods/:pod", apiHandler.DeletePod)
		v1.POST("/clusters/:name/namespaces/:namespace/pods/:pod/evict", apiHandler.EvictPod)
		v1.GET("/clusters/:name/namespaces/:namespace/pods/:pod/logs", apiHandler.GetPodLogs)
		v1.GET("/clusters/:name/namespaces/:namespace/pods/:pod/shell", apiHandler.PodShell)

		// Deployments
		v1.GET("/clusters/:name/deployments", apiHandler.ListDeployments)
		v1.GET("/clusters/:name/namespaces/:namespace/deployments/:deployment", apiHandler.GetDeployment)
		v1.PUT("/clusters/:name/namespaces/:namespace/deployments/:deployment", apiHandler.UpdateDeployment)
		v1.DELETE("/clusters/:name/namespaces/:namespace/deployments/:deployment", apiHandler.DeleteDeployment)
		v1.PATCH("/clusters/:name/namespaces/:namespace/deployments/:deployment/scale", apiHandler.ScaleDeployment)
		v1.POST("/clusters/:name/namespaces/:namespace/deployments/:deployment/restart", apiHandler.RestartDeployment)

		// DaemonSets
		v1.GET("/clusters/:name/daemonsets", apiHandler.ListDaemonSets)
		v1.GET("/clusters/:name/namespaces/:namespace/daemonsets/:daemonset", apiHandler.GetDaemonSet)
		v1.PUT("/clusters/:name/namespaces/:namespace/daemonsets/:daemonset", apiHandler.UpdateDaemonSet)
		v1.DELETE("/clusters/:name/namespaces/:namespace/daemonsets/:daemonset", apiHandler.DeleteDaemonSet)
		v1.POST("/clusters/:name/namespaces/:namespace/daemonsets/:daemonset/restart", apiHandler.RestartDaemonSet)

		// StatefulSets
		v1.GET("/clusters/:name/statefulsets", apiHandler.ListStatefulSets)
		v1.GET("/clusters/:name/namespaces/:namespace/statefulsets/:statefulset", apiHandler.GetStatefulSet)
		v1.PUT("/clusters/:name/namespaces/:namespace/statefulsets/:statefulset", apiHandler.UpdateStatefulSet)
		v1.DELETE("/clusters/:name/namespaces/:namespace/statefulsets/:statefulset", apiHandler.DeleteStatefulSet)
		v1.PATCH("/clusters/:name/namespaces/:namespace/statefulsets/:statefulset/scale", apiHandler.ScaleStatefulSet)
		v1.POST("/clusters/:name/namespaces/:namespace/statefulsets/:statefulset/restart", apiHandler.RestartStatefulSet)

		// ReplicaSets
		v1.GET("/clusters/:name/replicasets", apiHandler.ListReplicaSets)
		v1.GET("/clusters/:name/namespaces/:namespace/replicasets/:replicaset", apiHandler.GetReplicaSet)
		v1.PUT("/clusters/:name/namespaces/:namespace/replicasets/:replicaset", apiHandler.UpdateReplicaSet)
		v1.DELETE("/clusters/:name/namespaces/:namespace/replicasets/:replicaset", apiHandler.DeleteReplicaSet)
		v1.PATCH("/clusters/:name/namespaces/:namespace/replicasets/:replicaset/scale", apiHandler.ScaleReplicaSet)

		// Jobs
		v1.GET("/clusters/:name/jobs", apiHandler.ListJobs)
		v1.GET("/clusters/:name/namespaces/:namespace/jobs/:job", apiHandler.GetJob)
		v1.PUT("/clusters/:name/namespaces/:namespace/jobs/:job", apiHandler.UpdateJob)
		v1.DELETE("/clusters/:name/namespaces/:namespace/jobs/:job", apiHandler.DeleteJob)

		// CronJobs
		v1.GET("/clusters/:name/cronjobs", apiHandler.ListCronJobs)
		v1.GET("/clusters/:name/namespaces/:namespace/cronjobs/:cronjob", apiHandler.GetCronJob)
		v1.PUT("/clusters/:name/namespaces/:namespace/cronjobs/:cronjob", apiHandler.UpdateCronJob)
		v1.DELETE("/clusters/:name/namespaces/:namespace/cronjobs/:cronjob", apiHandler.DeleteCronJob)

		// Services
		v1.GET("/clusters/:name/services", apiHandler.ListServices)
		v1.GET("/clusters/:name/namespaces/:namespace/services/:service", apiHandler.GetService)
		v1.PUT("/clusters/:name/namespaces/:namespace/services/:service", apiHandler.UpdateService)

		// Endpoints
		v1.GET("/clusters/:name/endpoints", apiHandler.ListEndpoints)
		v1.GET("/clusters/:name/namespaces/:namespace/endpoints/:endpoint", apiHandler.GetEndpoint)

		// Ingresses (namespaced)
		v1.GET("/clusters/:name/namespaces/:namespace/ingresses", apiHandler.ListIngresses)
		v1.GET("/clusters/:name/ingresses", apiHandler.ListIngresses)
		v1.GET("/clusters/:name/namespaces/:namespace/ingresses/:ingress", apiHandler.GetIngress)
		v1.POST("/clusters/:name/namespaces/:namespace/ingresses", apiHandler.CreateIngress)
		v1.PUT("/clusters/:name/namespaces/:namespace/ingresses/:ingress", apiHandler.UpdateIngress)
		v1.DELETE("/clusters/:name/namespaces/:namespace/ingresses/:ingress", apiHandler.DeleteIngress)

		// Ingress Classes (cluster-scoped)
		v1.GET("/clusters/:name/ingressclasses", apiHandler.ListIngressClasses)
		v1.GET("/clusters/:name/ingressclasses/:ingressclass", apiHandler.GetIngressClass)
		v1.POST("/clusters/:name/ingressclasses", apiHandler.CreateIngressClass)
		v1.PUT("/clusters/:name/ingressclasses/:ingressclass", apiHandler.UpdateIngressClass)
		v1.DELETE("/clusters/:name/ingressclasses/:ingressclass", apiHandler.DeleteIngressClass)

		// Network Policies (namespaced)
		v1.GET("/clusters/:name/networkpolicies", apiHandler.ListNetworkPolicies)
		v1.GET("/clusters/:name/namespaces/:namespace/networkpolicies", apiHandler.ListNetworkPolicies)
		v1.GET("/clusters/:name/namespaces/:namespace/networkpolicies/:networkpolicy", apiHandler.GetNetworkPolicy)
		v1.PUT("/clusters/:name/namespaces/:namespace/networkpolicies/:networkpolicy", apiHandler.UpdateNetworkPolicy)
		v1.DELETE("/clusters/:name/namespaces/:namespace/networkpolicies/:networkpolicy", apiHandler.DeleteNetworkPolicy)

		// ConfigMaps
		v1.GET("/clusters/:name/configmaps", apiHandler.ListConfigMaps)
		v1.POST("/clusters/:name/namespaces/:namespace/configmaps", apiHandler.CreateConfigMap)
		v1.GET("/clusters/:name/namespaces/:namespace/configmaps/:configmap", apiHandler.GetConfigMap)
		v1.PUT("/clusters/:name/namespaces/:namespace/configmaps/:configmap", apiHandler.UpdateConfigMap)
		v1.DELETE("/clusters/:name/namespaces/:namespace/configmaps/:configmap", apiHandler.DeleteConfigMap)

		// Secrets
		v1.GET("/clusters/:name/secrets", apiHandler.ListSecrets)
		v1.POST("/clusters/:name/namespaces/:namespace/secrets", apiHandler.CreateSecret)
		v1.GET("/clusters/:name/namespaces/:namespace/secrets/:secret", apiHandler.GetSecret)
		v1.PUT("/clusters/:name/namespaces/:namespace/secrets/:secret", apiHandler.UpdateSecret)
		v1.DELETE("/clusters/:name/namespaces/:namespace/secrets/:secret", apiHandler.DeleteSecret)

		// Storage Classes (cluster-scoped)
		v1.GET("/clusters/:name/storageclasses", apiHandler.ListStorageClasses)
		v1.POST("/clusters/:name/storageclasses", apiHandler.CreateStorageClass)
		v1.GET("/clusters/:name/storageclasses/:storageclass", apiHandler.GetStorageClass)
		v1.PUT("/clusters/:name/storageclasses/:storageclass", apiHandler.UpdateStorageClass)
		v1.DELETE("/clusters/:name/storageclasses/:storageclass", apiHandler.DeleteStorageClass)

		// Persistent Volumes (cluster-scoped)
		v1.GET("/clusters/:name/persistentvolumes", apiHandler.ListPersistentVolumes)
		v1.GET("/clusters/:name/persistentvolumes/:pv", apiHandler.GetPersistentVolume)
		v1.PUT("/clusters/:name/persistentvolumes/:pv", apiHandler.UpdatePersistentVolume)
		v1.DELETE("/clusters/:name/persistentvolumes/:pv", apiHandler.DeletePersistentVolume)

		// Persistent Volume Claims (namespaced)
		v1.GET("/clusters/:name/persistentvolumeclaims", apiHandler.ListPersistentVolumeClaims)
		v1.GET("/clusters/:name/namespaces/:namespace/persistentvolumeclaims", apiHandler.ListPersistentVolumeClaims)
		v1.GET("/clusters/:name/namespaces/:namespace/persistentvolumeclaims/:pvc", apiHandler.GetPersistentVolumeClaim)
		v1.PUT("/clusters/:name/namespaces/:namespace/persistentvolumeclaims/:pvc", apiHandler.UpdatePersistentVolumeClaim)
		v1.DELETE("/clusters/:name/namespaces/:namespace/persistentvolumeclaims/:pvc", apiHandler.DeletePersistentVolumeClaim)

		// ServiceAccounts (namespaced)
		v1.GET("/clusters/:name/serviceaccounts", apiHandler.ListServiceAccounts)
		v1.GET("/clusters/:name/namespaces/:namespace/serviceaccounts", apiHandler.ListServiceAccountsByNamespace)
		v1.GET("/clusters/:name/namespaces/:namespace/serviceaccounts/:serviceaccount", apiHandler.GetServiceAccount)
		v1.PUT("/clusters/:name/namespaces/:namespace/serviceaccounts/:serviceaccount", apiHandler.UpdateServiceAccount)
		v1.DELETE("/clusters/:name/namespaces/:namespace/serviceaccounts/:serviceaccount", apiHandler.DeleteServiceAccount)
		v1.POST("/clusters/:name/namespaces/:namespace/serviceaccounts", apiHandler.CreateServiceAccount)

		// ClusterRoles (cluster-scoped)
		v1.GET("/clusters/:name/clusterroles", apiHandler.ListClusterRoles)
		v1.GET("/clusters/:name/clusterroles/:clusterrole", apiHandler.GetClusterRole)
		v1.PUT("/clusters/:name/clusterroles/:clusterrole", apiHandler.UpdateClusterRole)
		v1.DELETE("/clusters/:name/clusterroles/:clusterrole", apiHandler.DeleteClusterRole)
		v1.POST("/clusters/:name/clusterroles", apiHandler.CreateClusterRole)

		// Roles (namespaced)
		v1.GET("/clusters/:name/roles", apiHandler.ListRoles)
		v1.GET("/clusters/:name/namespaces/:namespace/roles", apiHandler.ListRolesByNamespace)
		v1.GET("/clusters/:name/namespaces/:namespace/roles/:role", apiHandler.GetRole)
		v1.PUT("/clusters/:name/namespaces/:namespace/roles/:role", apiHandler.UpdateRole)
		v1.DELETE("/clusters/:name/namespaces/:namespace/roles/:role", apiHandler.DeleteRole)
		v1.POST("/clusters/:name/namespaces/:namespace/roles", apiHandler.CreateRole)

		// ClusterRoleBindings (cluster-scoped)
		v1.GET("/clusters/:name/clusterrolebindings", apiHandler.ListClusterRoleBindings)
		v1.GET("/clusters/:name/clusterrolebindings/:clusterrolebinding", apiHandler.GetClusterRoleBinding)
		v1.PUT("/clusters/:name/clusterrolebindings/:clusterrolebinding", apiHandler.UpdateClusterRoleBinding)
		v1.DELETE("/clusters/:name/clusterrolebindings/:clusterrolebinding", apiHandler.DeleteClusterRoleBinding)
		v1.POST("/clusters/:name/clusterrolebindings", apiHandler.CreateClusterRoleBinding)

		// RoleBindings (namespaced)
		v1.GET("/clusters/:name/rolebindings", apiHandler.ListRoleBindings)
		v1.GET("/clusters/:name/namespaces/:namespace/rolebindings", apiHandler.ListRoleBindingsByNamespace)
		v1.GET("/clusters/:name/namespaces/:namespace/rolebindings/:rolebinding", apiHandler.GetRoleBinding)
		v1.PUT("/clusters/:name/namespaces/:namespace/rolebindings/:rolebinding", apiHandler.UpdateRoleBinding)
		v1.DELETE("/clusters/:name/namespaces/:namespace/rolebindings/:rolebinding", apiHandler.DeleteRoleBinding)
		v1.POST("/clusters/:name/namespaces/:namespace/rolebindings", apiHandler.CreateRoleBinding)

		// Nodes
		v1.GET("/clusters/:name/nodes", apiHandler.ListNodes)
		v1.GET("/clusters/:name/nodes/:node", apiHandler.GetNode)
		v1.GET("/clusters/:name/nodes/:node/metrics", apiHandler.GetNodeMetrics)
		v1.POST("/clusters/:name/nodes/:node/cordon", apiHandler.CordonNode)
		v1.POST("/clusters/:name/nodes/:node/uncordon", apiHandler.UncordonNode)
		v1.POST("/clusters/:name/nodes/:node/drain", apiHandler.DrainNode)
		v1.DELETE("/clusters/:name/nodes/:node", apiHandler.DeleteNode)

		// Events
		v1.GET("/clusters/:name/events", apiHandler.ListEvents)

		// Horizontal Pod Autoscalers
		v1.GET("/clusters/:name/hpas", apiHandler.ListHPAs)
		v1.GET("/clusters/:name/namespaces/:namespace/hpas/:hpa", apiHandler.GetHPA)
		v1.POST("/clusters/:name/namespaces/:namespace/hpas", apiHandler.CreateHPA)
		v1.PUT("/clusters/:name/namespaces/:namespace/hpas/:hpa", apiHandler.UpdateHPA)
		v1.DELETE("/clusters/:name/namespaces/:namespace/hpas/:hpa", apiHandler.DeleteHPA)

		// Pod Disruption Budgets
		v1.GET("/clusters/:name/pdbs", apiHandler.ListPDBs)
		v1.GET("/clusters/:name/namespaces/:namespace/pdbs/:pdb", apiHandler.GetPDB)
		v1.POST("/clusters/:name/namespaces/:namespace/pdbs", apiHandler.CreatePDB)
		v1.PUT("/clusters/:name/namespaces/:namespace/pdbs/:pdb", apiHandler.UpdatePDB)
		v1.DELETE("/clusters/:name/namespaces/:namespace/pdbs/:pdb", apiHandler.DeletePDB)

		// Priority Classes (cluster-scoped)
		v1.GET("/clusters/:name/priorityclasses", apiHandler.ListPriorityClasses)
		v1.GET("/clusters/:name/priorityclasses/:priorityclass", apiHandler.GetPriorityClass)
		v1.POST("/clusters/:name/priorityclasses", apiHandler.CreatePriorityClass)
		v1.PUT("/clusters/:name/priorityclasses/:priorityclass", apiHandler.UpdatePriorityClass)
		v1.DELETE("/clusters/:name/priorityclasses/:priorityclass", apiHandler.DeletePriorityClass)

		// Runtime Classes (cluster-scoped)
		v1.GET("/clusters/:name/runtimeclasses", apiHandler.ListRuntimeClasses)
		v1.GET("/clusters/:name/runtimeclasses/:runtimeclass", apiHandler.GetRuntimeClass)
		v1.POST("/clusters/:name/runtimeclasses", apiHandler.CreateRuntimeClass)
		v1.PUT("/clusters/:name/runtimeclasses/:runtimeclass", apiHandler.UpdateRuntimeClass)
		v1.DELETE("/clusters/:name/runtimeclasses/:runtimeclass", apiHandler.DeleteRuntimeClass)

		// Leases (namespaced)
		v1.GET("/clusters/:name/namespaces/:namespace/leases", apiHandler.ListLeases)
		v1.GET("/clusters/:name/namespaces/:namespace/leases/:lease", apiHandler.GetLease)
		v1.POST("/clusters/:name/namespaces/:namespace/leases", apiHandler.CreateLease)
		v1.PUT("/clusters/:name/namespaces/:namespace/leases/:lease", apiHandler.UpdateLease)
		v1.DELETE("/clusters/:name/namespaces/:namespace/leases/:lease", apiHandler.DeleteLease)

		// Mutating Webhook Configurations (cluster-scoped)
		v1.GET("/clusters/:name/mutatingwebhookconfigurations", apiHandler.ListMutatingWebhookConfigurations)
		v1.GET("/clusters/:name/mutatingwebhookconfigurations/:webhook", apiHandler.GetMutatingWebhookConfiguration)
		v1.POST("/clusters/:name/mutatingwebhookconfigurations", apiHandler.CreateMutatingWebhookConfiguration)
		v1.PUT("/clusters/:name/mutatingwebhookconfigurations/:webhook", apiHandler.UpdateMutatingWebhookConfiguration)
		v1.DELETE("/clusters/:name/mutatingwebhookconfigurations/:webhook", apiHandler.DeleteMutatingWebhookConfiguration)

		// Validating Webhook Configurations (cluster-scoped)
		v1.GET("/clusters/:name/validatingwebhookconfigurations", apiHandler.ListValidatingWebhookConfigurations)
		v1.GET("/clusters/:name/validatingwebhookconfigurations/:webhook", apiHandler.GetValidatingWebhookConfiguration)
		v1.POST("/clusters/:name/validatingwebhookconfigurations", apiHandler.CreateValidatingWebhookConfiguration)
		v1.PUT("/clusters/:name/validatingwebhookconfigurations/:webhook", apiHandler.UpdateValidatingWebhookConfiguration)
		v1.DELETE("/clusters/:name/validatingwebhookconfigurations/:webhook", apiHandler.DeleteValidatingWebhookConfiguration)

		// Custom Resource Definitions (cluster-scoped)
		v1.GET("/clusters/:name/customresourcedefinitions", apiHandler.ListCustomResourceDefinitions)
		v1.GET("/clusters/:name/customresourcedefinitions/:crd", apiHandler.GetCustomResourceDefinition)
		v1.PUT("/clusters/:name/customresourcedefinitions/:crd", apiHandler.UpdateCustomResourceDefinition)
		v1.DELETE("/clusters/:name/customresourcedefinitions/:crd", apiHandler.DeleteCustomResourceDefinition)

		// Custom Resources (Dynamic) - cluster-scoped
		v1.GET("/clusters/:name/customresources", apiHandler.ListCustomResources)
		v1.GET("/clusters/:name/customresources/:resourcename", apiHandler.GetCustomResource)
		v1.PUT("/clusters/:name/customresources/:resourcename", apiHandler.UpdateCustomResource)
		v1.DELETE("/clusters/:name/customresources/:resourcename", apiHandler.DeleteCustomResource)

		// Custom Resources (Dynamic) - namespaced
		v1.GET("/clusters/:name/namespaces/:namespace/customresources", apiHandler.ListCustomResources)
		v1.GET("/clusters/:name/namespaces/:namespace/customresources/:resourcename", apiHandler.GetCustomResource)
		v1.PUT("/clusters/:name/namespaces/:namespace/customresources/:resourcename", apiHandler.UpdateCustomResource)
		v1.DELETE("/clusters/:name/namespaces/:namespace/customresources/:resourcename", apiHandler.DeleteCustomResource)

		// WebSocket endpoint for real-time updates
		v1.GET("/ws", func(c *gin.Context) {
			ws.ServeWs(wsHub, c.Writer, c.Request)
		})
	}

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

