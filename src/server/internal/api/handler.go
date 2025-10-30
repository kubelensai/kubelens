package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	admissionregistrationv1 "k8s.io/api/admissionregistration/v1"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	appsv1 "k8s.io/api/apps/v1"
	autoscalingv2 "k8s.io/api/autoscaling/v2"
	batchv1 "k8s.io/api/batch/v1"
	coordinationv1 "k8s.io/api/coordination/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	nodev1 "k8s.io/api/node/v1"
	policyv1 "k8s.io/api/policy/v1"
	rbacv1 "k8s.io/api/rbac/v1"
	schedulingv1 "k8s.io/api/scheduling/v1"
	storagev1 "k8s.io/api/storage/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/yaml"

	"github.com/sonnguyen/kubelens/internal/cluster"
	"github.com/sonnguyen/kubelens/internal/db"
	"github.com/sonnguyen/kubelens/internal/ws"
)

// Handler handles API requests
type Handler struct {
	clusterManager *cluster.Manager
	db             *db.DB
	wsHub          *ws.Hub
}

// NewHandler creates a new API handler
func NewHandler(clusterManager *cluster.Manager, database *db.DB, wsHub *ws.Hub) *Handler {
	return &Handler{
		clusterManager: clusterManager,
		db:             database,
		wsHub:          wsHub,
	}
}

// ListClusters returns a list of all clusters
func (h *Handler) ListClusters(c *gin.Context) {
	// Check if we should filter by enabled status
	enabledOnly := c.Query("enabled") == "true"

	// Initialize as empty slice (not nil) to avoid "null" in JSON response
	clusters := make([]cluster.ClusterInfo, 0)

	// Always get clusters from database (source of truth)
	var dbClusters []*db.Cluster
	var err error
	
	if enabledOnly {
		dbClusters, err = h.db.ListEnabledClusters()
	} else {
		dbClusters, err = h.db.ListClusters()
	}
	
	if err != nil {
		log.Errorf("Failed to list clusters from database: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Convert DB clusters to ClusterInfo with additional metadata from manager
	for _, dbCluster := range dbClusters {
		info := cluster.ClusterInfo{
			Name:      dbCluster.Name,
			Status:    dbCluster.Status,
			IsDefault: dbCluster.IsDefault,
			Enabled:   dbCluster.Enabled,
			Metadata:  make(map[string]interface{}),
		}
		
		// Try to get version from manager if cluster is loaded
		clusterInfo, err := h.clusterManager.GetClusterInfo(dbCluster.Name)
		if err == nil {
			info.Version = clusterInfo.Version
			info.Metadata = clusterInfo.Metadata
		}
		
		clusters = append(clusters, info)
	}

	c.JSON(http.StatusOK, gin.H{"clusters": clusters})
}

// getMapKeys returns the keys of a map for debugging
func getMapKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// AddCluster adds a new cluster with support for multiple auth types
func (h *Handler) AddCluster(c *gin.Context) {
	var req struct {
		Name       string                 `json:"name" binding:"required"`
		AuthType   string                 `json:"auth_type"` // "token", "kubeconfig"
		AuthConfig map[string]interface{} `json:"auth_config" binding:"required"`
		IsDefault  bool                   `json:"is_default"`
		Enabled    bool                   `json:"enabled"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Default values
	if req.AuthType == "" {
		req.AuthType = "token"
	}
	if !req.Enabled {
		req.Enabled = true
	}

	// Debug logging
	log.Infof("Received AddCluster request: name=%s, auth_type=%s, auth_config keys=%v", 
		req.Name, req.AuthType, getMapKeys(req.AuthConfig))

	// Marshal auth_config to JSON string for storage
	authConfigJSON, err := json.Marshal(req.AuthConfig)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid auth_config format"})
		return
	}

	var serverURL string
	var addErr error

	// Handle different auth types
	switch req.AuthType {
	case "kubeconfig":
		// Extract kubeconfig and context from auth_config
		kubeconfigStr, ok := req.AuthConfig["kubeconfig"].(string)
		if !ok {
			log.Errorf("kubeconfig type assertion failed. Type: %T, Value: %v", req.AuthConfig["kubeconfig"], req.AuthConfig["kubeconfig"])
			c.JSON(http.StatusBadRequest, gin.H{"error": "kubeconfig is required for kubeconfig auth type"})
			return
		}
		if kubeconfigStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "kubeconfig content is empty"})
			return
		}
		
		context, _ := req.AuthConfig["context"].(string)
		
		// Add cluster using kubeconfig
		addErr = h.clusterManager.AddClusterFromKubeconfigContent(req.Name, kubeconfigStr, context)
		
		// Extract server URL from kubeconfig for display
		serverURL, _ = extractServerFromKubeconfig(kubeconfigStr, context)

	case "token":
		// Extract server, CA, token from auth_config
		server, ok1 := req.AuthConfig["server"].(string)
		ca, ok2 := req.AuthConfig["ca"].(string)
		token, ok3 := req.AuthConfig["token"].(string)
		
		if !ok1 || !ok2 || !ok3 || server == "" || ca == "" || token == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "server, ca, and token are required for token auth type"})
			return
		}
		
		// Add cluster using token
		addErr = h.clusterManager.AddClusterFromConfig(req.Name, server, ca, token)
		serverURL = server

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("unsupported auth_type: %s", req.AuthType)})
		return
	}

	// Handle connection error
	status := "connected"
	if addErr != nil {
		log.Errorf("Failed to add cluster %s: %v", req.Name, addErr)
		status = "error"
	}

	// Prepare cluster struct with extracted fields
	dbCluster := &db.Cluster{
		Name:       req.Name,
		AuthType:   req.AuthType,
		AuthConfig: string(authConfigJSON),
		Server:     serverURL,
		IsDefault:  req.IsDefault,
		Enabled:    req.Enabled,
		Status:     status,
	}

	// For "token" auth, extract and store CA/Token for direct cluster manager use
	if req.AuthType == "token" {
		if ca, ok := req.AuthConfig["ca"].(string); ok {
			dbCluster.CA = ca
		}
		if token, ok := req.AuthConfig["token"].(string); ok {
			dbCluster.Token = token
		}
	}

	if err := h.db.SaveCluster(dbCluster); err != nil {
		log.Errorf("Failed to save cluster to database: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save cluster"})
		return
	}

	// Return error if connection failed
	if addErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": addErr.Error()})
		return
	}

	// Setup kubelens ServiceAccount in kube-system namespace
	if err := h.setupKubelensServiceAccount(req.Name); err != nil {
		log.Warnf("Failed to setup kubelens ServiceAccount for cluster %s: %v", req.Name, err)
		// Don't fail the cluster import if SA setup fails
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":   "Cluster added successfully",
		"name":      req.Name,
		"auth_type": req.AuthType,
	})
}

// extractServerFromKubeconfig extracts the server URL from kubeconfig YAML
func extractServerFromKubeconfig(kubeconfigContent, contextName string) (string, error) {
	var kubeconfig map[string]interface{}
	if err := yaml.Unmarshal([]byte(kubeconfigContent), &kubeconfig); err != nil {
		return "", err
	}

	// Get current context if not specified
	if contextName == "" {
		if currentContext, ok := kubeconfig["current-context"].(string); ok {
			contextName = currentContext
		}
	}

	// Find the context
	contexts, ok := kubeconfig["contexts"].([]interface{})
	if !ok {
		return "", fmt.Errorf("invalid kubeconfig: no contexts")
	}

	var clusterName string
	for _, ctx := range contexts {
		ctxMap, ok := ctx.(map[string]interface{})
		if !ok {
			continue
		}
		if ctxMap["name"] == contextName {
			if context, ok := ctxMap["context"].(map[string]interface{}); ok {
				if cluster, ok := context["cluster"].(string); ok {
					clusterName = cluster
					break
				}
			}
		}
	}

	if clusterName == "" {
		return "", fmt.Errorf("context not found in kubeconfig")
	}

	// Find the cluster
	clusters, ok := kubeconfig["clusters"].([]interface{})
	if !ok {
		return "", fmt.Errorf("invalid kubeconfig: no clusters")
	}

	for _, cls := range clusters {
		clsMap, ok := cls.(map[string]interface{})
		if !ok {
			continue
		}
		if clsMap["name"] == clusterName {
			if cluster, ok := clsMap["cluster"].(map[string]interface{}); ok {
				if server, ok := cluster["server"].(string); ok {
					return server, nil
				}
			}
		}
	}

	return "", fmt.Errorf("cluster not found in kubeconfig")
}

// UpdateCluster updates an existing cluster
func (h *Handler) UpdateCluster(c *gin.Context) {
	name := c.Param("name")

	var req struct {
		Server    string `json:"server"`
		CA        string `json:"ca"`
		Token     string `json:"token"`
		IsDefault bool   `json:"is_default"`
		Enabled   bool   `json:"enabled"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get existing cluster from database
	existingCluster, err := h.db.GetCluster(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cluster not found"})
		return
	}

	// Update server, CA, token if provided
	if req.Server != "" || req.CA != "" || req.Token != "" {
		// Remove old cluster from manager
		h.clusterManager.RemoveCluster(name)

		// Use new values or keep existing
		server := req.Server
		if server == "" {
			server = existingCluster.Server
		}
		ca := req.CA
		if ca == "" {
			ca = existingCluster.CA
		}
		token := req.Token
		if token == "" {
			token = existingCluster.Token
		}

		// Add updated cluster to manager
		if err := h.clusterManager.AddClusterFromConfig(name, server, ca, token); err != nil {
			log.Errorf("Failed to update cluster: %v", err)
			existingCluster.Status = "error"
			h.db.SaveCluster(existingCluster)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		existingCluster.Server = server
		existingCluster.CA = ca
		existingCluster.Token = token
		existingCluster.Status = "connected"
	}

	// Update other fields
	existingCluster.IsDefault = req.IsDefault
	existingCluster.Enabled = req.Enabled

	// Save to database
	if err := h.db.SaveCluster(existingCluster); err != nil {
		log.Errorf("Failed to update cluster in database: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Cluster updated successfully"})
}

// UpdateClusterEnabled toggles cluster enabled status
func (h *Handler) UpdateClusterEnabled(c *gin.Context) {
	name := c.Param("name")

	var req struct {
		Enabled bool `json:"enabled"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get cluster from database
	cluster, err := h.db.GetCluster(name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Cluster not found"})
		return
	}

	// Update in database
	if err := h.db.UpdateClusterEnabled(name, req.Enabled); err != nil {
		log.Errorf("Failed to update cluster enabled status: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update cluster manager based on enabled status
	if req.Enabled {
		// Re-add cluster to manager based on auth type
		var addErr error
		
		switch cluster.AuthType {
		case "kubeconfig":
			// Parse auth_config to get kubeconfig and context
			var authConfig map[string]interface{}
			if err := json.Unmarshal([]byte(cluster.AuthConfig), &authConfig); err != nil {
				log.Errorf("Failed to parse auth_config: %v", err)
				h.db.UpdateClusterStatus(name, "error")
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse cluster configuration"})
				return
			}
			
			kubeconfigStr, ok := authConfig["kubeconfig"].(string)
			if !ok || kubeconfigStr == "" {
				log.Errorf("Invalid kubeconfig in auth_config")
				h.db.UpdateClusterStatus(name, "error")
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid cluster configuration"})
				return
			}
			
			context, _ := authConfig["context"].(string)
			addErr = h.clusterManager.AddClusterFromKubeconfigContent(name, kubeconfigStr, context)
			
		case "token":
			// Use server, CA, token from database
			if cluster.Server != "" && cluster.CA != "" && cluster.Token != "" {
				addErr = h.clusterManager.AddClusterFromConfig(name, cluster.Server, cluster.CA, cluster.Token)
			} else {
				log.Errorf("Missing server, CA, or token for cluster %s", name)
				h.db.UpdateClusterStatus(name, "error")
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Incomplete cluster configuration"})
				return
			}
			
		default:
			log.Errorf("Unsupported auth type: %s", cluster.AuthType)
			h.db.UpdateClusterStatus(name, "error")
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Unsupported auth type: %s", cluster.AuthType)})
			return
		}
		
		// Update status based on connection result
		if addErr != nil {
			log.Warnf("Failed to add cluster to manager: %v", addErr)
			h.db.UpdateClusterStatus(name, "error")
		} else {
			log.Infof("Successfully re-enabled cluster: %s", name)
			h.db.UpdateClusterStatus(name, "connected")
		}
	} else {
		// Remove cluster from manager if disabling
		h.clusterManager.RemoveCluster(name)
		h.db.UpdateClusterStatus(name, "disconnected")
		log.Infof("Successfully disabled cluster: %s", name)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Cluster status updated successfully"})
}

// RemoveCluster removes a cluster (deletes from both manager and database)
func (h *Handler) RemoveCluster(c *gin.Context) {
	name := c.Param("name")

	// Remove from in-memory manager
	if err := h.clusterManager.RemoveCluster(name); err != nil {
		log.Errorf("Failed to remove cluster from manager: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Delete from database
	if err := h.db.DeleteCluster(name); err != nil {
		log.Errorf("Failed to delete cluster from database: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Infof("Deleted cluster: %s", name)
	c.JSON(http.StatusOK, gin.H{"message": "Cluster removed successfully"})
}

// GetClusterStatus returns the status of a cluster
func (h *Handler) GetClusterStatus(c *gin.Context) {
	name := c.Param("name")

	info, err := h.clusterManager.GetClusterInfo(name)
	if err != nil {
		log.Errorf("Failed to get cluster info: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, info)
}

// ListNamespaces returns a list of namespaces in a cluster
func (h *Handler) ListNamespaces(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	namespaces, err := client.CoreV1().Namespaces().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list namespaces: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add clusterName to each namespace
	result := make([]map[string]interface{}, 0, len(namespaces.Items))
	for _, ns := range namespaces.Items {
		nsMap := map[string]interface{}{
			"clusterName": clusterName,
			"metadata":    ns.ObjectMeta,
			"spec":        ns.Spec,
			"status":      ns.Status,
		}
		result = append(result, nsMap)
	}

	c.JSON(http.StatusOK, result)
}

// GetNamespace gets a specific namespace (cluster-scoped)
func (h *Handler) GetNamespace(c *gin.Context) {
	clusterName := c.Param("name")
	namespaceName := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ns, err := client.CoreV1().Namespaces().Get(context.Background(), namespaceName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get namespace: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Set TypeMeta for proper YAML serialization
	ns.TypeMeta = metav1.TypeMeta{
		APIVersion: "v1",
		Kind:       "Namespace",
	}

	// Wrap in map with clusterName
	result := map[string]interface{}{
		"clusterName": clusterName,
		"apiVersion":  ns.APIVersion,
		"kind":        ns.Kind,
		"metadata":    ns.ObjectMeta,
		"spec":        ns.Spec,
		"status":      ns.Status,
	}

	c.JSON(http.StatusOK, result)
}

// UpdateNamespace updates a namespace (cluster-scoped)
func (h *Handler) UpdateNamespace(c *gin.Context) {
	clusterName := c.Param("name")
	namespaceName := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var ns corev1.Namespace
	if err := c.ShouldBindJSON(&ns); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure the name is set
	if ns.ObjectMeta.Name == "" {
		ns.ObjectMeta.Name = namespaceName
	}

	updatedNS, err := client.CoreV1().Namespaces().Update(context.Background(), &ns, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update namespace: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedNS)
}

// DeleteNamespace deletes a namespace (cluster-scoped)
func (h *Handler) DeleteNamespace(c *gin.Context) {
	clusterName := c.Param("name")
	namespaceName := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.CoreV1().Namespaces().Delete(context.Background(), namespaceName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete namespace: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Namespace deleted successfully"})
}

// ListPods returns a list of pods in a cluster
func (h *Handler) ListPods(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Query("namespace")
	deployment := c.Query("deployment")
	job := c.Query("job")

	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	listOptions := metav1.ListOptions{}
	
	// If deployment is specified, filter pods by deployment
	if deployment != "" {
		// Get the deployment to find its selector
		dep, err := client.AppsV1().Deployments(namespace).Get(context.Background(), deployment, metav1.GetOptions{})
		if err != nil {
			log.Errorf("Failed to get deployment: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		
		// Convert label selector to string
		if dep.Spec.Selector != nil && dep.Spec.Selector.MatchLabels != nil {
			var labels []string
			for k, v := range dep.Spec.Selector.MatchLabels {
				labels = append(labels, fmt.Sprintf("%s=%s", k, v))
			}
			listOptions.LabelSelector = strings.Join(labels, ",")
		}
	}
	
	// If job is specified, filter pods by job
	if job != "" {
		// Get the job to find its selector
		jobObj, err := client.BatchV1().Jobs(namespace).Get(context.Background(), job, metav1.GetOptions{})
		if err != nil {
			log.Errorf("Failed to get job: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		
		// Convert label selector to string
		if jobObj.Spec.Selector != nil && jobObj.Spec.Selector.MatchLabels != nil {
			var labels []string
			for k, v := range jobObj.Spec.Selector.MatchLabels {
				labels = append(labels, fmt.Sprintf("%s=%s", k, v))
			}
			listOptions.LabelSelector = strings.Join(labels, ",")
		}
	}

	pods, err := client.CoreV1().Pods(namespace).List(context.Background(), listOptions)
	if err != nil {
		log.Errorf("Failed to list pods: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pods.Items)
}

// GetPod returns details of a specific pod
func (h *Handler) GetPod(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	podName := c.Param("pod")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	pod, err := client.CoreV1().Pods(namespace).Get(context.Background(), podName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get pod: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pod)
}

// DeletePod deletes a pod
func (h *Handler) DeletePod(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	podName := c.Param("pod")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.CoreV1().Pods(namespace).Delete(context.Background(), podName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete pod: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Pod deleted successfully"})
}

// EvictPod evicts a pod (graceful removal with PodDisruptionBudget respect)
func (h *Handler) EvictPod(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	podName := c.Param("pod")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Get pod first to ensure it exists
	pod, err := client.CoreV1().Pods(namespace).Get(context.Background(), podName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get pod: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Create eviction object
	eviction := &policyv1.Eviction{
		ObjectMeta: metav1.ObjectMeta{
			Name:      podName,
			Namespace: namespace,
		},
		DeleteOptions: &metav1.DeleteOptions{
			GracePeriodSeconds: pod.Spec.TerminationGracePeriodSeconds,
		},
	}

	// Evict the pod
	err = client.CoreV1().Pods(namespace).EvictV1(context.Background(), eviction)
	if err != nil {
		log.Errorf("Failed to evict pod: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Infof("Successfully evicted pod %s in namespace %s", podName, namespace)
	c.JSON(http.StatusOK, gin.H{"message": "Pod evicted successfully"})
}

// GetPodLogs returns logs from a pod
func (h *Handler) GetPodLogs(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	podName := c.Param("pod")
	container := c.Query("container")
	tailLines := c.Query("tailLines")
	previous := c.Query("previous")
	sinceTime := c.Query("sinceTime")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Build log options
	logOptions := &corev1.PodLogOptions{}
	if container != "" {
		logOptions.Container = container
	}
	if tailLines != "" {
		if lines, err := strconv.ParseInt(tailLines, 10, 64); err == nil {
			logOptions.TailLines = &lines
		}
	}
	if previous == "true" {
		logOptions.Previous = true
	}
	if sinceTime != "" {
		// Parse RFC3339 timestamp
		if t, err := time.Parse(time.RFC3339, sinceTime); err == nil {
			metaTime := metav1.NewTime(t)
			logOptions.SinceTime = &metaTime
		}
	}

	// Get logs
	req := client.CoreV1().Pods(namespace).GetLogs(podName, logOptions)
	logs, err := req.Stream(context.Background())
	if err != nil {
		log.Errorf("Failed to get pod logs: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer logs.Close()

	// Read logs
	logData, err := io.ReadAll(logs)
	if err != nil {
		log.Errorf("Failed to read pod logs: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"logs": string(logData)})
}

// GetMultiPodLogs returns logs from multiple pods
func (h *Handler) GetMultiPodLogs(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	
	// Get query parameters
	pods := c.QueryArray("pods")
	container := c.Query("container")
	tailLines := c.Query("tailLines")
	previous := c.Query("previous")
	sinceTime := c.Query("sinceTime")
	timestamps := c.Query("timestamps") == "true"

	if len(pods) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No pods specified"})
		return
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Build log options
	logOptions := &corev1.PodLogOptions{
		Timestamps: timestamps,
	}
	if container != "" {
		logOptions.Container = container
	}
	if tailLines != "" {
		if lines, err := strconv.ParseInt(tailLines, 10, 64); err == nil {
			logOptions.TailLines = &lines
		}
	}
	if previous == "true" {
		logOptions.Previous = true
	}
	if sinceTime != "" {
		// Parse RFC3339 timestamp
		if t, err := time.Parse(time.RFC3339, sinceTime); err == nil {
			metaTime := metav1.NewTime(t)
			logOptions.SinceTime = &metaTime
		}
	}

	// Collect logs from all pods
	type PodLogs struct {
		PodName string `json:"podName"`
		Logs    string `json:"logs"`
		Error   string `json:"error,omitempty"`
	}

	results := make([]PodLogs, 0, len(pods))
	
	for _, podName := range pods {
		podLog := PodLogs{PodName: podName}
		
		// Get logs for this pod
		req := client.CoreV1().Pods(namespace).GetLogs(podName, logOptions)
		logs, err := req.Stream(context.Background())
		if err != nil {
			log.Warnf("Failed to get logs for pod %s: %v", podName, err)
			podLog.Error = err.Error()
			results = append(results, podLog)
			continue
		}
		
		// Read logs
		logData, err := io.ReadAll(logs)
		logs.Close()
		
		if err != nil {
			log.Warnf("Failed to read logs for pod %s: %v", podName, err)
			podLog.Error = err.Error()
		} else {
			// Format logs with pod name prefix
			logLines := strings.Split(string(logData), "\n")
			formattedLines := make([]string, 0, len(logLines))
			for _, line := range logLines {
				if line != "" {
					formattedLines = append(formattedLines, fmt.Sprintf("[%s] %s", podName, line))
				}
			}
			podLog.Logs = strings.Join(formattedLines, "\n")
		}
		
		results = append(results, podLog)
	}

	c.JSON(http.StatusOK, results)
}

// ListDeployments returns a list of deployments
func (h *Handler) ListDeployments(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	deployments, err := client.AppsV1().Deployments(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list deployments: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"deployments": deployments.Items})
}

// GetDeployment returns details of a specific deployment
func (h *Handler) GetDeployment(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	deploymentName := c.Param("deployment")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	deployment, err := client.AppsV1().Deployments(namespace).Get(context.Background(), deploymentName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get deployment: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, deployment)
}

// UpdateDeployment updates a deployment
func (h *Handler) UpdateDeployment(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	deploymentName := c.Param("deployment")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var deployment appsv1.Deployment
	if err := c.ShouldBindJSON(&deployment); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure the name and namespace match the URL parameters
	deployment.Name = deploymentName
	deployment.Namespace = namespace

	updatedDeployment, err := client.AppsV1().Deployments(namespace).Update(context.Background(), &deployment, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update deployment: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedDeployment)
}

// DeleteDeployment deletes a deployment
func (h *Handler) DeleteDeployment(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	deploymentName := c.Param("deployment")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.AppsV1().Deployments(namespace).Delete(context.Background(), deploymentName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete deployment: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deployment deleted successfully"})
}

// ScaleDeployment scales a deployment
func (h *Handler) ScaleDeployment(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	deploymentName := c.Param("deployment")

	var req struct {
		Replicas int32 `json:"replicas" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Get deployment
	deployment, err := client.AppsV1().Deployments(namespace).Get(context.Background(), deploymentName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get deployment: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Update replicas
	deployment.Spec.Replicas = &req.Replicas
	_, err = client.AppsV1().Deployments(namespace).Update(context.Background(), deployment, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to scale deployment: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deployment scaled successfully"})
}

// RestartDeployment restarts a deployment by patching it with a restart annotation
func (h *Handler) RestartDeployment(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	deploymentName := c.Param("deployment")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Get deployment
	deployment, err := client.AppsV1().Deployments(namespace).Get(context.Background(), deploymentName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get deployment: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Add restart annotation to pod template
	if deployment.Spec.Template.Annotations == nil {
		deployment.Spec.Template.Annotations = make(map[string]string)
	}
	deployment.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = metav1.Now().Format("2006-01-02T15:04:05Z07:00")

	// Update deployment
	_, err = client.AppsV1().Deployments(namespace).Update(context.Background(), deployment, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to restart deployment: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deployment restart initiated successfully"})
}

// ListDaemonSets returns a list of daemonsets
func (h *Handler) ListDaemonSets(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	daemonsets, err := client.AppsV1().DaemonSets(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list daemonsets: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"daemonsets": daemonsets.Items})
}

// GetDaemonSet returns details of a specific daemonset
func (h *Handler) GetDaemonSet(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	daemonsetName := c.Param("daemonset")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	daemonset, err := client.AppsV1().DaemonSets(namespace).Get(context.Background(), daemonsetName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get daemonset: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, daemonset)
}

// UpdateDaemonSet updates a daemonset
func (h *Handler) UpdateDaemonSet(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	daemonsetName := c.Param("daemonset")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var daemonset appsv1.DaemonSet
	if err := c.ShouldBindJSON(&daemonset); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure the daemonset name and namespace match the URL params
	daemonset.Name = daemonsetName
	daemonset.Namespace = namespace

	updatedDaemonSet, err := client.AppsV1().DaemonSets(namespace).Update(context.Background(), &daemonset, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update daemonset: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedDaemonSet)
}

// DeleteDaemonSet deletes a daemonset
func (h *Handler) DeleteDaemonSet(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	daemonsetName := c.Param("daemonset")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.AppsV1().DaemonSets(namespace).Delete(context.Background(), daemonsetName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete daemonset: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "DaemonSet deleted successfully"})
}

// RestartDaemonSet restarts a daemonset by adding a restart annotation
func (h *Handler) RestartDaemonSet(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	daemonsetName := c.Param("daemonset")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Get daemonset
	daemonset, err := client.AppsV1().DaemonSets(namespace).Get(context.Background(), daemonsetName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get daemonset: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Add restart annotation to pod template
	if daemonset.Spec.Template.Annotations == nil {
		daemonset.Spec.Template.Annotations = make(map[string]string)
	}
	daemonset.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = metav1.Now().Format("2006-01-02T15:04:05Z07:00")

	// Update daemonset
	_, err = client.AppsV1().DaemonSets(namespace).Update(context.Background(), daemonset, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to restart daemonset: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "DaemonSet restart initiated successfully"})
}

// ListStatefulSets returns a list of statefulsets
func (h *Handler) ListStatefulSets(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	statefulsets, err := client.AppsV1().StatefulSets(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list statefulsets: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"statefulsets": statefulsets.Items})
}

// GetStatefulSet returns details of a specific statefulset
func (h *Handler) GetStatefulSet(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	statefulsetName := c.Param("statefulset")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	statefulset, err := client.AppsV1().StatefulSets(namespace).Get(context.Background(), statefulsetName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get statefulset: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, statefulset)
}

// UpdateStatefulSet updates a statefulset
func (h *Handler) UpdateStatefulSet(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	statefulsetName := c.Param("statefulset")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var statefulset appsv1.StatefulSet
	if err := c.ShouldBindJSON(&statefulset); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure the statefulset name and namespace match the URL params
	statefulset.Name = statefulsetName
	statefulset.Namespace = namespace

	updatedStatefulSet, err := client.AppsV1().StatefulSets(namespace).Update(context.Background(), &statefulset, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update statefulset: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedStatefulSet)
}

// DeleteStatefulSet deletes a statefulset
func (h *Handler) DeleteStatefulSet(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	statefulsetName := c.Param("statefulset")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.AppsV1().StatefulSets(namespace).Delete(context.Background(), statefulsetName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete statefulset: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "StatefulSet deleted successfully"})
}

// ScaleStatefulSet scales a statefulset
func (h *Handler) ScaleStatefulSet(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	statefulsetName := c.Param("statefulset")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var scaleRequest struct {
		Replicas int32 `json:"replicas"`
	}
	if err := c.ShouldBindJSON(&scaleRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current statefulset
	statefulset, err := client.AppsV1().StatefulSets(namespace).Get(context.Background(), statefulsetName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get statefulset: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Update replicas
	statefulset.Spec.Replicas = &scaleRequest.Replicas
	_, err = client.AppsV1().StatefulSets(namespace).Update(context.Background(), statefulset, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to scale statefulset: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "StatefulSet scaled successfully"})
}

// RestartStatefulSet restarts a statefulset by adding a restart annotation
func (h *Handler) RestartStatefulSet(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	statefulsetName := c.Param("statefulset")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Get statefulset
	statefulset, err := client.AppsV1().StatefulSets(namespace).Get(context.Background(), statefulsetName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get statefulset: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Add restart annotation to pod template
	if statefulset.Spec.Template.Annotations == nil {
		statefulset.Spec.Template.Annotations = make(map[string]string)
	}
	statefulset.Spec.Template.Annotations["kubectl.kubernetes.io/restartedAt"] = metav1.Now().Format("2006-01-02T15:04:05Z07:00")

	// Update statefulset
	_, err = client.AppsV1().StatefulSets(namespace).Update(context.Background(), statefulset, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to restart statefulset: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "StatefulSet restart initiated successfully"})
}

// ListReplicaSets returns a list of replicasets
func (h *Handler) ListReplicaSets(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	replicasets, err := client.AppsV1().ReplicaSets(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list replicasets: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"replicasets": replicasets.Items})
}

// GetReplicaSet returns details of a specific replicaset
func (h *Handler) GetReplicaSet(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	replicasetName := c.Param("replicaset")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	replicaset, err := client.AppsV1().ReplicaSets(namespace).Get(context.Background(), replicasetName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get replicaset: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, replicaset)
}

// UpdateReplicaSet updates a replicaset
func (h *Handler) UpdateReplicaSet(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	replicasetName := c.Param("replicaset")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var replicaset appsv1.ReplicaSet
	if err := c.ShouldBindJSON(&replicaset); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure the replicaset name and namespace match the URL params
	replicaset.Name = replicasetName
	replicaset.Namespace = namespace

	updatedReplicaSet, err := client.AppsV1().ReplicaSets(namespace).Update(context.Background(), &replicaset, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update replicaset: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedReplicaSet)
}

// DeleteReplicaSet deletes a replicaset
func (h *Handler) DeleteReplicaSet(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	replicasetName := c.Param("replicaset")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.AppsV1().ReplicaSets(namespace).Delete(context.Background(), replicasetName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete replicaset: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ReplicaSet deleted successfully"})
}

// ScaleReplicaSet scales a replicaset
func (h *Handler) ScaleReplicaSet(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	replicasetName := c.Param("replicaset")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var scaleRequest struct {
		Replicas int32 `json:"replicas"`
	}
	if err := c.ShouldBindJSON(&scaleRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get current replicaset
	replicaset, err := client.AppsV1().ReplicaSets(namespace).Get(context.Background(), replicasetName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get replicaset: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Update replicas
	replicaset.Spec.Replicas = &scaleRequest.Replicas
	_, err = client.AppsV1().ReplicaSets(namespace).Update(context.Background(), replicaset, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to scale replicaset: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ReplicaSet scaled successfully"})
}

// ListJobs returns a list of jobs
func (h *Handler) ListJobs(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Query("namespace")
	cronjob := c.Query("cronjob")

	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	jobs, err := client.BatchV1().Jobs(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list jobs: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Filter by cronjob if specified
	filteredJobs := jobs.Items
	if cronjob != "" {
		filteredJobs = []batchv1.Job{}
		for _, job := range jobs.Items {
			// Check if job is owned by the specified cronjob
			for _, owner := range job.OwnerReferences {
				if owner.Kind == "CronJob" && owner.Name == cronjob {
					filteredJobs = append(filteredJobs, job)
					break
				}
			}
		}
	}

	c.JSON(http.StatusOK, filteredJobs)
}

// GetJob returns details of a specific job
func (h *Handler) GetJob(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	jobName := c.Param("job")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	job, err := client.BatchV1().Jobs(namespace).Get(context.Background(), jobName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get job: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, job)
}

// UpdateJob updates a job
func (h *Handler) UpdateJob(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	jobName := c.Param("job")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var job batchv1.Job
	if err := c.ShouldBindJSON(&job); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure the job name and namespace match the URL params
	job.Name = jobName
	job.Namespace = namespace

	updatedJob, err := client.BatchV1().Jobs(namespace).Update(context.Background(), &job, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update job: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedJob)
}

// DeleteJob deletes a job
func (h *Handler) DeleteJob(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	jobName := c.Param("job")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	propagationPolicy := metav1.DeletePropagationBackground
	err = client.BatchV1().Jobs(namespace).Delete(context.Background(), jobName, metav1.DeleteOptions{
		PropagationPolicy: &propagationPolicy,
	})
	if err != nil {
		log.Errorf("Failed to delete job: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Job deleted successfully"})
}

// ListCronJobs returns a list of cronjobs
func (h *Handler) ListCronJobs(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	cronjobs, err := client.BatchV1().CronJobs(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list cronjobs: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"cronjobs": cronjobs.Items})
}

// GetCronJob returns details of a specific cronjob
func (h *Handler) GetCronJob(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	cronjobName := c.Param("cronjob")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	cronjob, err := client.BatchV1().CronJobs(namespace).Get(context.Background(), cronjobName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get cronjob: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cronjob)
}

// UpdateCronJob updates a cronjob
func (h *Handler) UpdateCronJob(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	cronjobName := c.Param("cronjob")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var cronjob batchv1.CronJob
	if err := c.ShouldBindJSON(&cronjob); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure the cronjob name and namespace match the URL params
	cronjob.Name = cronjobName
	cronjob.Namespace = namespace

	updatedCronJob, err := client.BatchV1().CronJobs(namespace).Update(context.Background(), &cronjob, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update cronjob: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedCronJob)
}

// DeleteCronJob deletes a cronjob
func (h *Handler) DeleteCronJob(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	cronjobName := c.Param("cronjob")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	propagationPolicy := metav1.DeletePropagationBackground
	err = client.BatchV1().CronJobs(namespace).Delete(context.Background(), cronjobName, metav1.DeleteOptions{
		PropagationPolicy: &propagationPolicy,
	})
	if err != nil {
		log.Errorf("Failed to delete cronjob: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "CronJob deleted successfully"})
}

// ListServices returns a list of services
func (h *Handler) ListServices(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	services, err := client.CoreV1().Services(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list services: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"services": services.Items})
}

// GetService returns details of a specific service
func (h *Handler) GetService(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	serviceName := c.Param("service")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	service, err := client.CoreV1().Services(namespace).Get(context.Background(), serviceName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get service: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, service)
}

// DeleteService deletes a service
func (h *Handler) DeleteService(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	serviceName := c.Param("service")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.CoreV1().Services(namespace).Delete(context.Background(), serviceName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete service: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Service deleted successfully"})
}

// UpdateService updates a service
func (h *Handler) UpdateService(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	serviceName := c.Param("service")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var service corev1.Service
	if err := c.ShouldBindJSON(&service); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure the service name and namespace match the URL params
	service.Name = serviceName
	service.Namespace = namespace

	updatedService, err := client.CoreV1().Services(namespace).Update(context.Background(), &service, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update service: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedService)
}

// ListConfigMaps returns a list of configmaps from a cluster
func (h *Handler) ListConfigMaps(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	configMaps, err := client.CoreV1().ConfigMaps(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list configmaps: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"configMaps": configMaps.Items})
}

// CreateConfigMap creates a new configmap
func (h *Handler) CreateConfigMap(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var configMap corev1.ConfigMap
	if err := c.ShouldBindJSON(&configMap); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure namespace matches URL parameter
	configMap.Namespace = namespace

	createdConfigMap, err := client.CoreV1().ConfigMaps(namespace).Create(context.Background(), &configMap, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create configmap: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, createdConfigMap)
}

// GetConfigMap returns details of a specific configmap
func (h *Handler) GetConfigMap(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	configMapName := c.Param("configmap")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	configMap, err := client.CoreV1().ConfigMaps(namespace).Get(context.Background(), configMapName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get configmap: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, configMap)
}

// UpdateConfigMap updates a configmap
func (h *Handler) UpdateConfigMap(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	configMapName := c.Param("configmap")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var configMap corev1.ConfigMap
	if err := c.ShouldBindJSON(&configMap); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure the configmap name and namespace match the URL params
	configMap.Name = configMapName
	configMap.Namespace = namespace

	updatedConfigMap, err := client.CoreV1().ConfigMaps(namespace).Update(context.Background(), &configMap, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update configmap: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedConfigMap)
}

// DeleteConfigMap deletes a configmap
func (h *Handler) DeleteConfigMap(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	configMapName := c.Param("configmap")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.CoreV1().ConfigMaps(namespace).Delete(context.Background(), configMapName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete configmap: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ConfigMap deleted successfully"})
}

// ListSecrets returns a list of secrets from a cluster
func (h *Handler) ListSecrets(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	secrets, err := client.CoreV1().Secrets(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list secrets: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"secrets": secrets.Items})
}

// GetSecret returns details of a specific secret
func (h *Handler) GetSecret(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	secretName := c.Param("secret")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	secret, err := client.CoreV1().Secrets(namespace).Get(context.Background(), secretName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get secret: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, secret)
}

// UpdateSecret updates a secret
func (h *Handler) UpdateSecret(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	secretName := c.Param("secret")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var secret corev1.Secret
	if err := c.ShouldBindJSON(&secret); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure the secret name and namespace match the URL params
	secret.Name = secretName
	secret.Namespace = namespace

	updatedSecret, err := client.CoreV1().Secrets(namespace).Update(context.Background(), &secret, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update secret: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedSecret)
}

// DeleteSecret deletes a secret
func (h *Handler) DeleteSecret(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	secretName := c.Param("secret")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.CoreV1().Secrets(namespace).Delete(context.Background(), secretName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete secret: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Secret deleted successfully"})
}

// CreateSecret creates a new secret
func (h *Handler) CreateSecret(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var secret corev1.Secret
	if err := c.ShouldBindJSON(&secret); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure namespace matches URL parameter
	secret.Namespace = namespace

	createdSecret, err := client.CoreV1().Secrets(namespace).Create(context.Background(), &secret, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create secret: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, createdSecret)
}

// ListEndpoints returns a list of endpoints from a cluster
func (h *Handler) ListEndpoints(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	endpoints, err := client.CoreV1().Endpoints(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list endpoints: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"endpoints": endpoints.Items})
}

// GetEndpoint returns details of a specific endpoint
func (h *Handler) GetEndpoint(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	endpointName := c.Param("endpoint")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	endpoint, err := client.CoreV1().Endpoints(namespace).Get(context.Background(), endpointName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get endpoint: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, endpoint)
}

// ListEvents returns a list of events
func (h *Handler) ListEvents(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	events, err := client.CoreV1().Events(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list events: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"events": events.Items})
}

// SearchResult represents a search result item
type SearchResult struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	Name        string `json:"name"`
	Cluster     string `json:"cluster,omitempty"`
	Namespace   string `json:"namespace,omitempty"`
	Status      string `json:"status,omitempty"`
	Description string `json:"description,omitempty"`
}

// Search searches across all resources in all clusters
func (h *Handler) Search(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter 'q' is required"})
		return
	}

	query = strings.ToLower(query)
	results := []SearchResult{}
	
	// Get all clusters
	clusters, err := h.clusterManager.ListClusters()
	if err != nil {
		log.Errorf("Failed to list clusters: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Search clusters themselves
	for _, cluster := range clusters {
		if strings.Contains(strings.ToLower(cluster.Name), query) ||
			strings.Contains(strings.ToLower(cluster.Version), query) {
			results = append(results, SearchResult{
				ID:          fmt.Sprintf("cluster-%s", cluster.Name),
				Type:        "cluster",
				Name:        cluster.Name,
				Status:      cluster.Status,
				Description: cluster.Version,
			})
		}
	}

	// Search resources in each cluster
	for _, cluster := range clusters {
		client, err := h.clusterManager.GetClient(cluster.Name)
		if err != nil {
			log.Warnf("Failed to get client for cluster %s: %v", cluster.Name, err)
			continue
		}

		ctx := context.Background()

		// Search Pods
		pods, err := client.CoreV1().Pods(metav1.NamespaceAll).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, pod := range pods.Items {
				if strings.Contains(strings.ToLower(pod.Name), query) ||
					strings.Contains(strings.ToLower(pod.Namespace), query) {
					status := "Unknown"
					if pod.Status.Phase != "" {
						status = string(pod.Status.Phase)
					}
					results = append(results, SearchResult{
						ID:        fmt.Sprintf("pod-%s-%s-%s", cluster.Name, pod.Namespace, pod.Name),
						Type:      "pod",
						Name:      pod.Name,
						Cluster:   cluster.Name,
						Namespace: pod.Namespace,
						Status:    status,
					})
				}
			}
		}

		// Search Deployments
		deployments, err := client.AppsV1().Deployments(metav1.NamespaceAll).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, deployment := range deployments.Items {
				if strings.Contains(strings.ToLower(deployment.Name), query) ||
					strings.Contains(strings.ToLower(deployment.Namespace), query) {
					status := "Unknown"
					if deployment.Status.AvailableReplicas > 0 {
						status = "Available"
					} else {
						status = "Unavailable"
					}
					results = append(results, SearchResult{
						ID:        fmt.Sprintf("deployment-%s-%s-%s", cluster.Name, deployment.Namespace, deployment.Name),
						Type:      "deployment",
						Name:      deployment.Name,
						Cluster:   cluster.Name,
						Namespace: deployment.Namespace,
						Status:    status,
					})
				}
			}
		}

		// Search Services
		services, err := client.CoreV1().Services(metav1.NamespaceAll).List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, service := range services.Items {
				if strings.Contains(strings.ToLower(service.Name), query) ||
					strings.Contains(strings.ToLower(service.Namespace), query) {
					results = append(results, SearchResult{
						ID:        fmt.Sprintf("service-%s-%s-%s", cluster.Name, service.Namespace, service.Name),
						Type:      "service",
						Name:      service.Name,
						Cluster:   cluster.Name,
						Namespace: service.Namespace,
						Status:    "Active",
					})
				}
			}
		}

		// Search Nodes
		nodes, err := client.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, node := range nodes.Items {
				if strings.Contains(strings.ToLower(node.Name), query) {
					status := "Unknown"
					for _, condition := range node.Status.Conditions {
						if condition.Type == corev1.NodeReady {
							if condition.Status == corev1.ConditionTrue {
								status = "Ready"
							} else {
								status = "NotReady"
							}
							break
						}
					}
					results = append(results, SearchResult{
						ID:      fmt.Sprintf("node-%s-%s", cluster.Name, node.Name),
						Type:    "node",
						Name:    node.Name,
						Cluster: cluster.Name,
						Status:  status,
					})
				}
			}
		}

		// Limit results to prevent overwhelming response
		if len(results) >= 50 {
			break
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"query":   query,
		"results": results,
		"count":   len(results),
	})
}

// ListHPAs lists all horizontal pod autoscalers in a cluster or namespace
func (h *Handler) ListHPAs(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Query("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var hpas []autoscalingv2.HorizontalPodAutoscaler
	if namespace != "" && namespace != "all" {
		hpaList, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).List(context.Background(), metav1.ListOptions{})
		if err != nil {
			log.Errorf("Failed to list HPAs in namespace %s: %v", namespace, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		hpas = hpaList.Items
	} else {
		hpaList, err := client.AutoscalingV2().HorizontalPodAutoscalers(metav1.NamespaceAll).List(context.Background(), metav1.ListOptions{})
		if err != nil {
			log.Errorf("Failed to list all HPAs: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		hpas = hpaList.Items
	}

	// Enrich with cluster name
	enrichedHPAs := make([]map[string]interface{}, 0, len(hpas))
	for _, hpa := range hpas {
		enrichedHPA := map[string]interface{}{
			"metadata":          hpa.ObjectMeta,
			"spec":              hpa.Spec,
			"status":            hpa.Status,
			"clusterName":       clusterName,
		}
		enrichedHPAs = append(enrichedHPAs, enrichedHPA)
	}

	c.JSON(http.StatusOK, enrichedHPAs)
}

// GetHPA retrieves a specific horizontal pod autoscaler
func (h *Handler) GetHPA(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	hpaName := c.Param("hpa")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	hpa, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).Get(context.Background(), hpaName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get HPA: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Enrich with cluster name
	enrichedHPA := map[string]interface{}{
		"metadata":    hpa.ObjectMeta,
		"spec":        hpa.Spec,
		"status":      hpa.Status,
		"clusterName": clusterName,
	}

	c.JSON(http.StatusOK, enrichedHPA)
}

// UpdateHPA updates a horizontal pod autoscaler
func (h *Handler) UpdateHPA(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	var hpa autoscalingv2.HorizontalPodAutoscaler
	if err := c.ShouldBindJSON(&hpa); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	updatedHPA, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).Update(context.Background(), &hpa, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update HPA: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedHPA)
}

// DeleteHPA deletes a horizontal pod autoscaler
func (h *Handler) DeleteHPA(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	hpaName := c.Param("hpa")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.AutoscalingV2().HorizontalPodAutoscalers(namespace).Delete(context.Background(), hpaName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete HPA: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "HPA deleted successfully"})
}

// CreateHPA creates a new horizontal pod autoscaler
func (h *Handler) CreateHPA(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var hpa autoscalingv2.HorizontalPodAutoscaler
	if err := c.ShouldBindJSON(&hpa); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure namespace matches URL parameter
	hpa.Namespace = namespace

	createdHPA, err := client.AutoscalingV2().HorizontalPodAutoscalers(namespace).Create(context.Background(), &hpa, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create HPA: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, createdHPA)
}

// ListPDBs returns a list of pod disruption budgets from a cluster
func (h *Handler) ListPDBs(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Query("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var pdbList []policyv1.PodDisruptionBudget

	if namespace != "" && namespace != "all" {
		pdbs, err := client.PolicyV1().PodDisruptionBudgets(namespace).List(context.Background(), metav1.ListOptions{})
		if err != nil {
			log.Errorf("Failed to list PDBs: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		pdbList = pdbs.Items
	} else {
		pdbs, err := client.PolicyV1().PodDisruptionBudgets("").List(context.Background(), metav1.ListOptions{})
		if err != nil {
			log.Errorf("Failed to list PDBs: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		pdbList = pdbs.Items
	}

	// Add cluster name to each PDB using a wrapper
	result := make([]map[string]interface{}, len(pdbList))
	for i, pdb := range pdbList {
		pdbMap := map[string]interface{}{
			"metadata": pdb.ObjectMeta,
			"spec":     pdb.Spec,
			"status":   pdb.Status,
			"clusterName": clusterName,
		}
		result[i] = pdbMap
	}

	c.JSON(http.StatusOK, result)
}

// GetPDB returns details about a specific pod disruption budget
func (h *Handler) GetPDB(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	pdbName := c.Param("pdb")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	pdb, err := client.PolicyV1().PodDisruptionBudgets(namespace).Get(context.Background(), pdbName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get PDB: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := map[string]interface{}{
		"metadata": pdb.ObjectMeta,
		"spec":     pdb.Spec,
		"status":   pdb.Status,
		"clusterName": clusterName,
	}
	c.JSON(http.StatusOK, result)
}

// UpdatePDB updates a pod disruption budget
func (h *Handler) UpdatePDB(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	pdbName := c.Param("pdb")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var pdb policyv1.PodDisruptionBudget
	if err := c.ShouldBindJSON(&pdb); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure names match
	pdb.Name = pdbName
	pdb.Namespace = namespace

	updatedPDB, err := client.PolicyV1().PodDisruptionBudgets(namespace).Update(context.Background(), &pdb, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update PDB: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedPDB)
}

// DeletePDB deletes a pod disruption budget
func (h *Handler) DeletePDB(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	pdbName := c.Param("pdb")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.PolicyV1().PodDisruptionBudgets(namespace).Delete(context.Background(), pdbName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete PDB: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "PDB deleted successfully"})
}

// CreatePDB creates a new pod disruption budget
func (h *Handler) CreatePDB(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var pdb policyv1.PodDisruptionBudget
	if err := c.ShouldBindJSON(&pdb); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure namespace matches URL parameter
	pdb.Namespace = namespace

	createdPDB, err := client.PolicyV1().PodDisruptionBudgets(namespace).Create(context.Background(), &pdb, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create PDB: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, createdPDB)
}

// ListPriorityClasses returns a list of priority classes from a cluster
func (h *Handler) ListPriorityClasses(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	priorityClasses, err := client.SchedulingV1().PriorityClasses().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list priority classes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add cluster name to each priority class using a wrapper
	result := make([]map[string]interface{}, len(priorityClasses.Items))
	for i, pc := range priorityClasses.Items {
		pcMap := map[string]interface{}{
			"metadata":        pc.ObjectMeta,
			"value":           pc.Value,
			"globalDefault":   pc.GlobalDefault,
			"preemptionPolicy": pc.PreemptionPolicy,
			"description":     pc.Description,
			"clusterName":     clusterName,
		}
		result[i] = pcMap
	}

	c.JSON(http.StatusOK, result)
}

// GetPriorityClass returns details about a specific priority class
func (h *Handler) GetPriorityClass(c *gin.Context) {
	clusterName := c.Param("name")
	pcName := c.Param("priorityclass")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	pc, err := client.SchedulingV1().PriorityClasses().Get(context.Background(), pcName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get priority class: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := map[string]interface{}{
		"metadata":        pc.ObjectMeta,
		"value":           pc.Value,
		"globalDefault":   pc.GlobalDefault,
		"preemptionPolicy": pc.PreemptionPolicy,
		"description":     pc.Description,
		"clusterName":     clusterName,
	}
	c.JSON(http.StatusOK, result)
}

// UpdatePriorityClass updates a priority class
func (h *Handler) UpdatePriorityClass(c *gin.Context) {
	clusterName := c.Param("name")
	pcName := c.Param("priorityclass")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var pc schedulingv1.PriorityClass
	if err := c.ShouldBindJSON(&pc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure name matches
	pc.Name = pcName

	updatedPC, err := client.SchedulingV1().PriorityClasses().Update(context.Background(), &pc, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update priority class: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedPC)
}

// DeletePriorityClass deletes a priority class
func (h *Handler) DeletePriorityClass(c *gin.Context) {
	clusterName := c.Param("name")
	pcName := c.Param("priorityclass")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.SchedulingV1().PriorityClasses().Delete(context.Background(), pcName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete priority class: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Priority class deleted successfully"})
}

// CreatePriorityClass creates a new priority class
func (h *Handler) CreatePriorityClass(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var pc schedulingv1.PriorityClass
	if err := c.ShouldBindJSON(&pc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	createdPC, err := client.SchedulingV1().PriorityClasses().Create(context.Background(), &pc, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create priority class: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, createdPC)
}

// ListRuntimeClasses returns a list of runtime classes from a cluster
func (h *Handler) ListRuntimeClasses(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	runtimeClasses, err := client.NodeV1().RuntimeClasses().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list runtime classes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add cluster name to each runtime class using a wrapper
	result := make([]map[string]interface{}, len(runtimeClasses.Items))
	for i, rc := range runtimeClasses.Items {
		rcMap := map[string]interface{}{
			"metadata":    rc.ObjectMeta,
			"handler":     rc.Handler,
			"overhead":    rc.Overhead,
			"scheduling":  rc.Scheduling,
			"clusterName": clusterName,
		}
		result[i] = rcMap
	}

	c.JSON(http.StatusOK, result)
}

// GetRuntimeClass returns details about a specific runtime class
func (h *Handler) GetRuntimeClass(c *gin.Context) {
	clusterName := c.Param("name")
	rcName := c.Param("runtimeclass")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	rc, err := client.NodeV1().RuntimeClasses().Get(context.Background(), rcName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get runtime class: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := map[string]interface{}{
		"metadata":    rc.ObjectMeta,
		"handler":     rc.Handler,
		"overhead":    rc.Overhead,
		"scheduling":  rc.Scheduling,
		"clusterName": clusterName,
	}
	c.JSON(http.StatusOK, result)
}

// UpdateRuntimeClass updates a runtime class
func (h *Handler) UpdateRuntimeClass(c *gin.Context) {
	clusterName := c.Param("name")
	rcName := c.Param("runtimeclass")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var rc nodev1.RuntimeClass
	if err := c.ShouldBindJSON(&rc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure name matches
	rc.Name = rcName

	updatedRC, err := client.NodeV1().RuntimeClasses().Update(context.Background(), &rc, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update runtime class: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedRC)
}

// DeleteRuntimeClass deletes a runtime class
func (h *Handler) DeleteRuntimeClass(c *gin.Context) {
	clusterName := c.Param("name")
	rcName := c.Param("runtimeclass")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.NodeV1().RuntimeClasses().Delete(context.Background(), rcName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete runtime class: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Runtime class deleted successfully"})
}

// CreateRuntimeClass creates a new runtime class
func (h *Handler) CreateRuntimeClass(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var rc nodev1.RuntimeClass
	if err := c.ShouldBindJSON(&rc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	createdRC, err := client.NodeV1().RuntimeClasses().Create(context.Background(), &rc, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create runtime class: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, createdRC)
}

// ListLeases returns a list of leases from a cluster namespace
func (h *Handler) ListLeases(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var leases *coordinationv1.LeaseList
	if namespace == "all" {
		leases, err = client.CoordinationV1().Leases("").List(context.Background(), metav1.ListOptions{})
	} else {
		leases, err = client.CoordinationV1().Leases(namespace).List(context.Background(), metav1.ListOptions{})
	}

	if err != nil {
		log.Errorf("Failed to list leases: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add cluster name to each lease using a wrapper
	result := make([]map[string]interface{}, len(leases.Items))
	for i, lease := range leases.Items {
		leaseMap := map[string]interface{}{
			"metadata":    lease.ObjectMeta,
			"spec":        lease.Spec,
			"clusterName": clusterName,
		}
		result[i] = leaseMap
	}

	c.JSON(http.StatusOK, result)
}

// GetLease returns details about a specific lease
func (h *Handler) GetLease(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	leaseName := c.Param("lease")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	lease, err := client.CoordinationV1().Leases(namespace).Get(context.Background(), leaseName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get lease: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := map[string]interface{}{
		"metadata":    lease.ObjectMeta,
		"spec":        lease.Spec,
		"clusterName": clusterName,
	}
	c.JSON(http.StatusOK, result)
}

// UpdateLease updates a lease
func (h *Handler) UpdateLease(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	leaseName := c.Param("lease")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var lease coordinationv1.Lease
	if err := c.ShouldBindJSON(&lease); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure namespace and name match
	lease.Namespace = namespace
	lease.Name = leaseName

	updatedLease, err := client.CoordinationV1().Leases(namespace).Update(context.Background(), &lease, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update lease: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedLease)
}

// DeleteLease deletes a lease
func (h *Handler) DeleteLease(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	leaseName := c.Param("lease")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.CoordinationV1().Leases(namespace).Delete(context.Background(), leaseName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete lease: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Lease deleted successfully"})
}

// CreateLease creates a new lease
func (h *Handler) CreateLease(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var lease coordinationv1.Lease
	if err := c.ShouldBindJSON(&lease); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure namespace matches
	lease.Namespace = namespace

	createdLease, err := client.CoordinationV1().Leases(namespace).Create(context.Background(), &lease, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create lease: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, createdLease)
}

// ListMutatingWebhookConfigurations returns a list of mutating webhook configurations from a cluster
func (h *Handler) ListMutatingWebhookConfigurations(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	webhooks, err := client.AdmissionregistrationV1().MutatingWebhookConfigurations().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list mutating webhook configurations: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add cluster name to each webhook using a wrapper
	result := make([]map[string]interface{}, len(webhooks.Items))
	for i, wh := range webhooks.Items {
		whMap := map[string]interface{}{
			"metadata":    wh.ObjectMeta,
			"webhooks":    wh.Webhooks,
			"clusterName": clusterName,
		}
		result[i] = whMap
	}

	c.JSON(http.StatusOK, result)
}

// GetMutatingWebhookConfiguration returns details about a specific mutating webhook configuration
func (h *Handler) GetMutatingWebhookConfiguration(c *gin.Context) {
	clusterName := c.Param("name")
	webhookName := c.Param("webhook")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	webhook, err := client.AdmissionregistrationV1().MutatingWebhookConfigurations().Get(context.Background(), webhookName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get mutating webhook configuration: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := map[string]interface{}{
		"metadata":    webhook.ObjectMeta,
		"webhooks":    webhook.Webhooks,
		"clusterName": clusterName,
	}
	c.JSON(http.StatusOK, result)
}

// UpdateMutatingWebhookConfiguration updates a mutating webhook configuration
func (h *Handler) UpdateMutatingWebhookConfiguration(c *gin.Context) {
	clusterName := c.Param("name")
	webhookName := c.Param("webhook")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var webhook admissionregistrationv1.MutatingWebhookConfiguration
	if err := c.ShouldBindJSON(&webhook); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure name matches
	webhook.Name = webhookName

	updatedWebhook, err := client.AdmissionregistrationV1().MutatingWebhookConfigurations().Update(context.Background(), &webhook, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update mutating webhook configuration: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedWebhook)
}

// DeleteMutatingWebhookConfiguration deletes a mutating webhook configuration
func (h *Handler) DeleteMutatingWebhookConfiguration(c *gin.Context) {
	clusterName := c.Param("name")
	webhookName := c.Param("webhook")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.AdmissionregistrationV1().MutatingWebhookConfigurations().Delete(context.Background(), webhookName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete mutating webhook configuration: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Mutating webhook configuration deleted successfully"})
}

// CreateMutatingWebhookConfiguration creates a new mutating webhook configuration
func (h *Handler) CreateMutatingWebhookConfiguration(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var webhook admissionregistrationv1.MutatingWebhookConfiguration
	if err := c.ShouldBindJSON(&webhook); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	createdWebhook, err := client.AdmissionregistrationV1().MutatingWebhookConfigurations().Create(context.Background(), &webhook, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create mutating webhook configuration: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, createdWebhook)
}

// ListValidatingWebhookConfigurations returns a list of validating webhook configurations from a cluster
func (h *Handler) ListValidatingWebhookConfigurations(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	webhooks, err := client.AdmissionregistrationV1().ValidatingWebhookConfigurations().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list validating webhook configurations: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add cluster name to each webhook using a wrapper
	result := make([]map[string]interface{}, len(webhooks.Items))
	for i, wh := range webhooks.Items {
		whMap := map[string]interface{}{
			"metadata":    wh.ObjectMeta,
			"webhooks":    wh.Webhooks,
			"clusterName": clusterName,
		}
		result[i] = whMap
	}

	c.JSON(http.StatusOK, result)
}

// GetValidatingWebhookConfiguration returns details about a specific validating webhook configuration
func (h *Handler) GetValidatingWebhookConfiguration(c *gin.Context) {
	clusterName := c.Param("name")
	webhookName := c.Param("webhook")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	webhook, err := client.AdmissionregistrationV1().ValidatingWebhookConfigurations().Get(context.Background(), webhookName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get validating webhook configuration: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := map[string]interface{}{
		"metadata":    webhook.ObjectMeta,
		"webhooks":    webhook.Webhooks,
		"clusterName": clusterName,
	}
	c.JSON(http.StatusOK, result)
}

// UpdateValidatingWebhookConfiguration updates a validating webhook configuration
func (h *Handler) UpdateValidatingWebhookConfiguration(c *gin.Context) {
	clusterName := c.Param("name")
	webhookName := c.Param("webhook")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var webhook admissionregistrationv1.ValidatingWebhookConfiguration
	if err := c.ShouldBindJSON(&webhook); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure name matches
	webhook.Name = webhookName

	updatedWebhook, err := client.AdmissionregistrationV1().ValidatingWebhookConfigurations().Update(context.Background(), &webhook, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update validating webhook configuration: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedWebhook)
}

// DeleteValidatingWebhookConfiguration deletes a validating webhook configuration
func (h *Handler) DeleteValidatingWebhookConfiguration(c *gin.Context) {
	clusterName := c.Param("name")
	webhookName := c.Param("webhook")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.AdmissionregistrationV1().ValidatingWebhookConfigurations().Delete(context.Background(), webhookName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete validating webhook configuration: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Validating webhook configuration deleted successfully"})
}

// CreateValidatingWebhookConfiguration creates a new validating webhook configuration
func (h *Handler) CreateValidatingWebhookConfiguration(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var webhook admissionregistrationv1.ValidatingWebhookConfiguration
	if err := c.ShouldBindJSON(&webhook); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	createdWebhook, err := client.AdmissionregistrationV1().ValidatingWebhookConfigurations().Create(context.Background(), &webhook, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create validating webhook configuration: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, createdWebhook)
}

// ListIngresses returns a list of ingresses from a cluster
func (h *Handler) ListIngresses(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var ingresses *networkingv1.IngressList
	if namespace != "" {
		ingresses, err = client.NetworkingV1().Ingresses(namespace).List(context.Background(), metav1.ListOptions{})
	} else {
		ingresses, err = client.NetworkingV1().Ingresses("").List(context.Background(), metav1.ListOptions{})
	}

	if err != nil {
		log.Errorf("Failed to list ingresses: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add cluster name to each ingress using a wrapper
	result := make([]map[string]interface{}, len(ingresses.Items))
	for i, ing := range ingresses.Items {
		ingMap := map[string]interface{}{
			"metadata":    ing.ObjectMeta,
			"spec":        ing.Spec,
			"status":      ing.Status,
			"clusterName": clusterName,
		}
		result[i] = ingMap
	}

	c.JSON(http.StatusOK, result)
}

// GetIngress returns details about a specific ingress
func (h *Handler) GetIngress(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	ingressName := c.Param("ingress")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ingress, err := client.NetworkingV1().Ingresses(namespace).Get(context.Background(), ingressName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get ingress: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := map[string]interface{}{
		"metadata":    ingress.ObjectMeta,
		"spec":        ingress.Spec,
		"status":      ingress.Status,
		"clusterName": clusterName,
	}
	c.JSON(http.StatusOK, result)
}

// UpdateIngress updates an ingress
func (h *Handler) UpdateIngress(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	ingressName := c.Param("ingress")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var ingress networkingv1.Ingress
	if err := c.ShouldBindJSON(&ingress); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure name and namespace match
	ingress.Name = ingressName
	ingress.Namespace = namespace

	updatedIngress, err := client.NetworkingV1().Ingresses(namespace).Update(context.Background(), &ingress, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update ingress: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedIngress)
}

// DeleteIngress deletes an ingress
func (h *Handler) DeleteIngress(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	ingressName := c.Param("ingress")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.NetworkingV1().Ingresses(namespace).Delete(context.Background(), ingressName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete ingress: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Ingress deleted successfully"})
}

// CreateIngress creates a new ingress
func (h *Handler) CreateIngress(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var ingress networkingv1.Ingress
	if err := c.ShouldBindJSON(&ingress); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure namespace is set
	ingress.Namespace = namespace

	createdIngress, err := client.NetworkingV1().Ingresses(namespace).Create(context.Background(), &ingress, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create ingress: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, createdIngress)
}

// ListIngressClasses returns a list of ingress classes from a cluster
func (h *Handler) ListIngressClasses(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ingressClasses, err := client.NetworkingV1().IngressClasses().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list ingress classes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add cluster name to each ingress class using a wrapper
	result := make([]map[string]interface{}, len(ingressClasses.Items))
	for i, ic := range ingressClasses.Items {
		icMap := map[string]interface{}{
			"metadata":    ic.ObjectMeta,
			"spec":        ic.Spec,
			"clusterName": clusterName,
		}
		result[i] = icMap
	}

	c.JSON(http.StatusOK, result)
}

// GetIngressClass returns details about a specific ingress class
func (h *Handler) GetIngressClass(c *gin.Context) {
	clusterName := c.Param("name")
	ingressClassName := c.Param("ingressclass")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ingressClass, err := client.NetworkingV1().IngressClasses().Get(context.Background(), ingressClassName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get ingress class: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	result := map[string]interface{}{
		"metadata":    ingressClass.ObjectMeta,
		"spec":        ingressClass.Spec,
		"clusterName": clusterName,
	}
	c.JSON(http.StatusOK, result)
}

// UpdateIngressClass updates an ingress class
func (h *Handler) UpdateIngressClass(c *gin.Context) {
	clusterName := c.Param("name")
	ingressClassName := c.Param("ingressclass")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var ingressClass networkingv1.IngressClass
	if err := c.ShouldBindJSON(&ingressClass); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure name matches
	ingressClass.Name = ingressClassName

	updatedIngressClass, err := client.NetworkingV1().IngressClasses().Update(context.Background(), &ingressClass, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update ingress class: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedIngressClass)
}

// DeleteIngressClass deletes an ingress class
func (h *Handler) DeleteIngressClass(c *gin.Context) {
	clusterName := c.Param("name")
	ingressClassName := c.Param("ingressclass")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.NetworkingV1().IngressClasses().Delete(context.Background(), ingressClassName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete ingress class: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Ingress class deleted successfully"})
}

// CreateIngressClass creates a new ingress class
func (h *Handler) CreateIngressClass(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var ingressClass networkingv1.IngressClass
	if err := c.ShouldBindJSON(&ingressClass); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	createdIngressClass, err := client.NetworkingV1().IngressClasses().Create(context.Background(), &ingressClass, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create ingress class: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, createdIngressClass)
}

// ListNetworkPolicies lists all network policies in a namespace or all namespaces
func (h *Handler) ListNetworkPolicies(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	if namespace == "" || namespace == "all" {
		namespace = ""
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	networkPolicies, err := client.NetworkingV1().NetworkPolicies(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list network policies: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add clusterName to each network policy
	result := make([]map[string]interface{}, 0, len(networkPolicies.Items))
	for _, np := range networkPolicies.Items {
		npMap := map[string]interface{}{
			"clusterName": clusterName,
			"metadata":    np.ObjectMeta,
			"spec":        np.Spec,
		}
		result = append(result, npMap)
	}

	c.JSON(http.StatusOK, result)
}

// GetNetworkPolicy gets a specific network policy
func (h *Handler) GetNetworkPolicy(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	networkPolicyName := c.Param("networkpolicy")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	networkPolicy, err := client.NetworkingV1().NetworkPolicies(namespace).Get(context.Background(), networkPolicyName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get network policy: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Add clusterName to response
	result := map[string]interface{}{
		"clusterName": clusterName,
		"apiVersion":  "networking.k8s.io/v1",
		"kind":        "NetworkPolicy",
		"metadata":    networkPolicy.ObjectMeta,
		"spec":        networkPolicy.Spec,
	}

	c.JSON(http.StatusOK, result)
}

// UpdateNetworkPolicy updates a network policy
func (h *Handler) UpdateNetworkPolicy(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	networkPolicyName := c.Param("networkpolicy")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var networkPolicy networkingv1.NetworkPolicy
	if err := c.ShouldBindJSON(&networkPolicy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure metadata is set
	if networkPolicy.ObjectMeta.Name == "" {
		networkPolicy.ObjectMeta.Name = networkPolicyName
	}
	if networkPolicy.ObjectMeta.Namespace == "" {
		networkPolicy.ObjectMeta.Namespace = namespace
	}

	updatedNetworkPolicy, err := client.NetworkingV1().NetworkPolicies(namespace).Update(context.Background(), &networkPolicy, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update network policy: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedNetworkPolicy)
}

// DeleteNetworkPolicy deletes a network policy
func (h *Handler) DeleteNetworkPolicy(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	networkPolicyName := c.Param("networkpolicy")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.NetworkingV1().NetworkPolicies(namespace).Delete(context.Background(), networkPolicyName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete network policy: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Network policy deleted successfully"})
}

// ListStorageClasses lists all storage classes (cluster-scoped)
func (h *Handler) ListStorageClasses(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	storageClasses, err := client.StorageV1().StorageClasses().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list storage classes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add clusterName to each StorageClass
	result := make([]map[string]interface{}, 0, len(storageClasses.Items))
	for _, sc := range storageClasses.Items {
		scMap := map[string]interface{}{
			"clusterName": clusterName,
			"metadata":    sc.ObjectMeta,
			"provisioner": sc.Provisioner,
			"parameters":  sc.Parameters,
			"reclaimPolicy": sc.ReclaimPolicy,
			"volumeBindingMode": sc.VolumeBindingMode,
			"allowVolumeExpansion": sc.AllowVolumeExpansion,
			"mountOptions": sc.MountOptions,
		}
		result = append(result, scMap)
	}

	c.JSON(http.StatusOK, result)
}

// GetStorageClass gets a specific storage class (cluster-scoped)
func (h *Handler) GetStorageClass(c *gin.Context) {
	clusterName := c.Param("name")
	scName := c.Param("storageclass")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	sc, err := client.StorageV1().StorageClasses().Get(context.Background(), scName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get storage class: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Set TypeMeta for proper YAML serialization
	sc.TypeMeta = metav1.TypeMeta{
		APIVersion: "storage.k8s.io/v1",
		Kind:       "StorageClass",
	}

	// Wrap in map with clusterName and the full StorageClass
	result := map[string]interface{}{
		"clusterName":  clusterName,
		"apiVersion":   sc.APIVersion,
		"kind":         sc.Kind,
		"metadata":     sc.ObjectMeta,
		"provisioner":  sc.Provisioner,
		"parameters":   sc.Parameters,
		"reclaimPolicy": sc.ReclaimPolicy,
		"volumeBindingMode": sc.VolumeBindingMode,
		"allowVolumeExpansion": sc.AllowVolumeExpansion,
		"mountOptions": sc.MountOptions,
		"allowedTopologies": sc.AllowedTopologies,
	}

	c.JSON(http.StatusOK, result)
}

// CreateStorageClass creates a new storage class (cluster-scoped)
func (h *Handler) CreateStorageClass(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var sc storagev1.StorageClass
	if err := c.ShouldBindJSON(&sc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure TypeMeta is set
	sc.TypeMeta = metav1.TypeMeta{
		APIVersion: "storage.k8s.io/v1",
		Kind:       "StorageClass",
	}

	createdSC, err := client.StorageV1().StorageClasses().Create(context.Background(), &sc, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create storage class: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, createdSC)
}

// UpdateStorageClass updates a storage class (cluster-scoped)
func (h *Handler) UpdateStorageClass(c *gin.Context) {
	clusterName := c.Param("name")
	scName := c.Param("storageclass")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var sc storagev1.StorageClass
	if err := c.ShouldBindJSON(&sc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure the name is set
	if sc.ObjectMeta.Name == "" {
		sc.ObjectMeta.Name = scName
	}

	updatedSC, err := client.StorageV1().StorageClasses().Update(context.Background(), &sc, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update storage class: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedSC)
}

// DeleteStorageClass deletes a storage class (cluster-scoped)
func (h *Handler) DeleteStorageClass(c *gin.Context) {
	clusterName := c.Param("name")
	scName := c.Param("storageclass")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.StorageV1().StorageClasses().Delete(context.Background(), scName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete storage class: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Storage class deleted successfully"})
}

// ListPersistentVolumes lists all persistent volumes (cluster-scoped)
func (h *Handler) ListPersistentVolumes(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	pvs, err := client.CoreV1().PersistentVolumes().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list persistent volumes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add clusterName to each PV
	result := make([]map[string]interface{}, 0, len(pvs.Items))
	for _, pv := range pvs.Items {
		pvMap := map[string]interface{}{
			"clusterName": clusterName,
			"metadata":    pv.ObjectMeta,
			"spec":        pv.Spec,
			"status":      pv.Status,
		}
		result = append(result, pvMap)
	}

	c.JSON(http.StatusOK, result)
}

// GetPersistentVolume gets a specific persistent volume (cluster-scoped)
func (h *Handler) GetPersistentVolume(c *gin.Context) {
	clusterName := c.Param("name")
	pvName := c.Param("pv")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	pv, err := client.CoreV1().PersistentVolumes().Get(context.Background(), pvName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get persistent volume: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Wrap in map with clusterName
	result := map[string]interface{}{
		"clusterName": clusterName,
		"apiVersion":  "v1",
		"kind":        "PersistentVolume",
		"metadata":    pv.ObjectMeta,
		"spec":        pv.Spec,
		"status":      pv.Status,
	}

	c.JSON(http.StatusOK, result)
}

// UpdatePersistentVolume updates a persistent volume (cluster-scoped)
func (h *Handler) UpdatePersistentVolume(c *gin.Context) {
	clusterName := c.Param("name")
	pvName := c.Param("pv")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var pv corev1.PersistentVolume
	if err := c.ShouldBindJSON(&pv); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure the name is set
	if pv.ObjectMeta.Name == "" {
		pv.ObjectMeta.Name = pvName
	}

	updatedPV, err := client.CoreV1().PersistentVolumes().Update(context.Background(), &pv, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update persistent volume: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedPV)
}

// DeletePersistentVolume deletes a persistent volume (cluster-scoped)
func (h *Handler) DeletePersistentVolume(c *gin.Context) {
	clusterName := c.Param("name")
	pvName := c.Param("pv")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.CoreV1().PersistentVolumes().Delete(context.Background(), pvName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete persistent volume: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Persistent volume deleted successfully"})
}

// ListPersistentVolumeClaims lists all persistent volume claims in a namespace or all namespaces
func (h *Handler) ListPersistentVolumeClaims(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	if namespace == "" || namespace == "all" {
		namespace = ""
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	pvcs, err := client.CoreV1().PersistentVolumeClaims(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list persistent volume claims: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add clusterName to each PVC
	result := make([]map[string]interface{}, 0, len(pvcs.Items))
	for _, pvc := range pvcs.Items {
		pvcMap := map[string]interface{}{
			"clusterName": clusterName,
			"metadata":    pvc.ObjectMeta,
			"spec":        pvc.Spec,
			"status":      pvc.Status,
		}
		result = append(result, pvcMap)
	}

	c.JSON(http.StatusOK, result)
}

// GetPersistentVolumeClaim gets a specific persistent volume claim
func (h *Handler) GetPersistentVolumeClaim(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	pvcName := c.Param("pvc")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	pvc, err := client.CoreV1().PersistentVolumeClaims(namespace).Get(context.Background(), pvcName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get persistent volume claim: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Add clusterName to response
	result := map[string]interface{}{
		"clusterName": clusterName,
		"apiVersion":  "v1",
		"kind":        "PersistentVolumeClaim",
		"metadata":    pvc.ObjectMeta,
		"spec":        pvc.Spec,
		"status":      pvc.Status,
	}

	c.JSON(http.StatusOK, result)
}

// UpdatePersistentVolumeClaim updates a persistent volume claim
func (h *Handler) UpdatePersistentVolumeClaim(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	pvcName := c.Param("pvc")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var pvc corev1.PersistentVolumeClaim
	if err := c.ShouldBindJSON(&pvc); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure metadata is set
	if pvc.ObjectMeta.Name == "" {
		pvc.ObjectMeta.Name = pvcName
	}
	if pvc.ObjectMeta.Namespace == "" {
		pvc.ObjectMeta.Namespace = namespace
	}

	updatedPVC, err := client.CoreV1().PersistentVolumeClaims(namespace).Update(context.Background(), &pvc, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update persistent volume claim: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedPVC)
}

// DeletePersistentVolumeClaim deletes a persistent volume claim
func (h *Handler) DeletePersistentVolumeClaim(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	pvcName := c.Param("pvc")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.CoreV1().PersistentVolumeClaims(namespace).Delete(context.Background(), pvcName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete persistent volume claim: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Persistent volume claim deleted successfully"})
}

// ==================== ServiceAccount Handlers ====================

// ListServiceAccounts returns a list of ServiceAccounts in a cluster
func (h *Handler) ListServiceAccounts(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" || namespace == "all" {
		namespace = metav1.NamespaceAll
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	serviceAccounts, err := client.CoreV1().ServiceAccounts(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list service accounts: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Infof("Found %d service accounts in namespace %s for cluster %s", len(serviceAccounts.Items), namespace, clusterName)

	// Add cluster name to each service account
	result := make([]map[string]interface{}, len(serviceAccounts.Items))
	for i, sa := range serviceAccounts.Items {
		saMap := map[string]interface{}{
			"apiVersion":                   "v1",
			"kind":                         "ServiceAccount",
			"metadata":                     sa.ObjectMeta,
			"secrets":                      sa.Secrets,
			"imagePullSecrets":             sa.ImagePullSecrets,
			"automountServiceAccountToken": sa.AutomountServiceAccountToken,
			"ClusterName":                  clusterName,
		}
		result[i] = saMap
	}

	log.Infof("Returning %d service accounts", len(result))
	c.JSON(http.StatusOK, result)
}

// ListServiceAccountsByNamespace returns a list of ServiceAccounts in a specific namespace
func (h *Handler) ListServiceAccountsByNamespace(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	serviceAccounts, err := client.CoreV1().ServiceAccounts(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list service accounts: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Infof("Found %d service accounts in namespace %s for cluster %s", len(serviceAccounts.Items), namespace, clusterName)

	// Add cluster name to each service account
	result := make([]map[string]interface{}, len(serviceAccounts.Items))
	for i, sa := range serviceAccounts.Items {
		saMap := map[string]interface{}{
			"apiVersion":                   "v1",
			"kind":                         "ServiceAccount",
			"metadata":                     sa.ObjectMeta,
			"secrets":                      sa.Secrets,
			"imagePullSecrets":             sa.ImagePullSecrets,
			"automountServiceAccountToken": sa.AutomountServiceAccountToken,
			"ClusterName":                  clusterName,
		}
		result[i] = saMap
	}

	log.Infof("Returning %d service accounts", len(result))
	c.JSON(http.StatusOK, result)
}

// GetServiceAccount returns a specific ServiceAccount
func (h *Handler) GetServiceAccount(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	saName := c.Param("serviceaccount")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	sa, err := client.CoreV1().ServiceAccounts(namespace).Get(context.Background(), saName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get service account: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Return full ServiceAccount with all fields
	result := map[string]interface{}{
		"apiVersion":                   "v1",
		"kind":                         "ServiceAccount",
		"metadata":                     sa.ObjectMeta,
		"secrets":                      sa.Secrets,
		"imagePullSecrets":             sa.ImagePullSecrets,
		"automountServiceAccountToken": sa.AutomountServiceAccountToken,
	}

	c.JSON(http.StatusOK, result)
}

// UpdateServiceAccount updates a ServiceAccount
func (h *Handler) UpdateServiceAccount(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	saName := c.Param("serviceaccount")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Read the request body as YAML
	var sa corev1.ServiceAccount
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// Decode YAML to ServiceAccount
	if err := yaml.Unmarshal(bodyBytes, &sa); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to decode ServiceAccount: %v", err)})
		return
	}

	// Ensure namespace and name match
	sa.Namespace = namespace
	sa.Name = saName

	// Update the ServiceAccount
	updated, err := client.CoreV1().ServiceAccounts(namespace).Update(context.Background(), &sa, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update service account: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

// DeleteServiceAccount deletes a ServiceAccount
func (h *Handler) DeleteServiceAccount(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	saName := c.Param("serviceaccount")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.CoreV1().ServiceAccounts(namespace).Delete(context.Background(), saName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete service account: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ServiceAccount deleted successfully"})
}

// CreateServiceAccount creates a new ServiceAccount
func (h *Handler) CreateServiceAccount(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Read the request body as YAML
	var sa corev1.ServiceAccount
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// Decode YAML to ServiceAccount
	if err := yaml.Unmarshal(bodyBytes, &sa); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to decode ServiceAccount: %v", err)})
		return
	}

	// Ensure namespace matches
	sa.Namespace = namespace

	// Create the ServiceAccount
	created, err := client.CoreV1().ServiceAccounts(namespace).Create(context.Background(), &sa, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create service account: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ServiceAccount created successfully", "serviceAccount": created})
}

// ==================== ClusterRole Handlers ====================

// ListClusterRoles returns a list of ClusterRoles in a cluster
func (h *Handler) ListClusterRoles(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	clusterRoles, err := client.RbacV1().ClusterRoles().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list cluster roles: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Infof("Found %d cluster roles for cluster %s", len(clusterRoles.Items), clusterName)

	// Add cluster name to each cluster role
	result := make([]map[string]interface{}, len(clusterRoles.Items))
	for i, cr := range clusterRoles.Items {
		crMap := map[string]interface{}{
			"apiVersion":        "rbac.authorization.k8s.io/v1",
			"kind":              "ClusterRole",
			"metadata":          cr.ObjectMeta,
			"rules":             cr.Rules,
			"aggregationRule":   cr.AggregationRule,
			"ClusterName":       clusterName,
		}
		result[i] = crMap
	}

	log.Infof("Returning %d cluster roles", len(result))
	c.JSON(http.StatusOK, result)
}

// GetClusterRole returns a specific ClusterRole
func (h *Handler) GetClusterRole(c *gin.Context) {
	clusterName := c.Param("name")
	crName := c.Param("clusterrole")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	cr, err := client.RbacV1().ClusterRoles().Get(context.Background(), crName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get cluster role: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Return full ClusterRole with all fields
	result := map[string]interface{}{
		"apiVersion":      "rbac.authorization.k8s.io/v1",
		"kind":            "ClusterRole",
		"metadata":        cr.ObjectMeta,
		"rules":           cr.Rules,
		"aggregationRule": cr.AggregationRule,
	}

	c.JSON(http.StatusOK, result)
}

// UpdateClusterRole updates a ClusterRole
func (h *Handler) UpdateClusterRole(c *gin.Context) {
	clusterName := c.Param("name")
	crName := c.Param("clusterrole")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Read the request body as YAML
	var cr rbacv1.ClusterRole
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// Decode YAML to ClusterRole
	if err := yaml.Unmarshal(bodyBytes, &cr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to decode ClusterRole: %v", err)})
		return
	}

	// Ensure name matches
	cr.Name = crName

	// Update the ClusterRole
	updated, err := client.RbacV1().ClusterRoles().Update(context.Background(), &cr, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update cluster role: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

// DeleteClusterRole deletes a ClusterRole
func (h *Handler) DeleteClusterRole(c *gin.Context) {
	clusterName := c.Param("name")
	crName := c.Param("clusterrole")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.RbacV1().ClusterRoles().Delete(context.Background(), crName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete cluster role: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ClusterRole deleted successfully"})
}

// CreateClusterRole creates a new ClusterRole
func (h *Handler) CreateClusterRole(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Read the request body as YAML
	var cr rbacv1.ClusterRole
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// Decode YAML to ClusterRole
	if err := yaml.Unmarshal(bodyBytes, &cr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to decode ClusterRole: %v", err)})
		return
	}

	// Create the ClusterRole
	created, err := client.RbacV1().ClusterRoles().Create(context.Background(), &cr, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create cluster role: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ClusterRole created successfully", "clusterRole": created})
}

// ==================== Role Handlers ====================

// ListRoles returns a list of Roles in a cluster
func (h *Handler) ListRoles(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" || namespace == "all" {
		namespace = metav1.NamespaceAll
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	roles, err := client.RbacV1().Roles(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list roles: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Infof("Found %d roles in namespace %s for cluster %s", len(roles.Items), namespace, clusterName)

	// Add cluster name to each role
	result := make([]map[string]interface{}, len(roles.Items))
	for i, role := range roles.Items {
		roleMap := map[string]interface{}{
			"apiVersion":  "rbac.authorization.k8s.io/v1",
			"kind":        "Role",
			"metadata":    role.ObjectMeta,
			"rules":       role.Rules,
			"ClusterName": clusterName,
		}
		result[i] = roleMap
	}

	log.Infof("Returning %d roles", len(result))
	c.JSON(http.StatusOK, result)
}

// ListRolesByNamespace returns a list of Roles in a specific namespace
func (h *Handler) ListRolesByNamespace(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	roles, err := client.RbacV1().Roles(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list roles: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Infof("Found %d roles in namespace %s for cluster %s", len(roles.Items), namespace, clusterName)

	// Add cluster name to each role
	result := make([]map[string]interface{}, len(roles.Items))
	for i, role := range roles.Items {
		roleMap := map[string]interface{}{
			"apiVersion":  "rbac.authorization.k8s.io/v1",
			"kind":        "Role",
			"metadata":    role.ObjectMeta,
			"rules":       role.Rules,
			"ClusterName": clusterName,
		}
		result[i] = roleMap
	}

	log.Infof("Returning %d roles", len(result))
	c.JSON(http.StatusOK, result)
}

// GetRole returns a specific Role
func (h *Handler) GetRole(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	roleName := c.Param("role")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	role, err := client.RbacV1().Roles(namespace).Get(context.Background(), roleName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get role: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Return full Role with all fields
	result := map[string]interface{}{
		"apiVersion": "rbac.authorization.k8s.io/v1",
		"kind":       "Role",
		"metadata":   role.ObjectMeta,
		"rules":      role.Rules,
	}

	c.JSON(http.StatusOK, result)
}

// UpdateRole updates a Role
func (h *Handler) UpdateRole(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	roleName := c.Param("role")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Read the request body as YAML
	var role rbacv1.Role
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// Decode YAML to Role
	if err := yaml.Unmarshal(bodyBytes, &role); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to decode Role: %v", err)})
		return
	}

	// Ensure namespace and name match
	role.Namespace = namespace
	role.Name = roleName

	// Update the Role
	updated, err := client.RbacV1().Roles(namespace).Update(context.Background(), &role, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update role: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

// DeleteRole deletes a Role
func (h *Handler) DeleteRole(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	roleName := c.Param("role")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.RbacV1().Roles(namespace).Delete(context.Background(), roleName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete role: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Role deleted successfully"})
}

// CreateRole creates a new Role
func (h *Handler) CreateRole(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Read the request body as YAML
	var role rbacv1.Role
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// Decode YAML to Role
	if err := yaml.Unmarshal(bodyBytes, &role); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to decode Role: %v", err)})
		return
	}

	// Ensure namespace matches
	role.Namespace = namespace

	// Create the Role
	created, err := client.RbacV1().Roles(namespace).Create(context.Background(), &role, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create role: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Role created successfully", "role": created})
}

// ==================== ClusterRoleBinding Handlers ====================

// ListClusterRoleBindings returns a list of ClusterRoleBindings in a cluster
func (h *Handler) ListClusterRoleBindings(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	clusterRoleBindings, err := client.RbacV1().ClusterRoleBindings().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list cluster role bindings: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Infof("Found %d cluster role bindings for cluster %s", len(clusterRoleBindings.Items), clusterName)

	// Add cluster name to each cluster role binding
	result := make([]map[string]interface{}, len(clusterRoleBindings.Items))
	for i, crb := range clusterRoleBindings.Items {
		crbMap := map[string]interface{}{
			"apiVersion":  "rbac.authorization.k8s.io/v1",
			"kind":        "ClusterRoleBinding",
			"metadata":    crb.ObjectMeta,
			"roleRef":     crb.RoleRef,
			"subjects":    crb.Subjects,
			"ClusterName": clusterName,
		}
		result[i] = crbMap
	}

	log.Infof("Returning %d cluster role bindings", len(result))
	c.JSON(http.StatusOK, result)
}

// GetClusterRoleBinding returns a specific ClusterRoleBinding
func (h *Handler) GetClusterRoleBinding(c *gin.Context) {
	clusterName := c.Param("name")
	crbName := c.Param("clusterrolebinding")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	crb, err := client.RbacV1().ClusterRoleBindings().Get(context.Background(), crbName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get cluster role binding: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Return full ClusterRoleBinding with all fields
	result := map[string]interface{}{
		"apiVersion": "rbac.authorization.k8s.io/v1",
		"kind":       "ClusterRoleBinding",
		"metadata":   crb.ObjectMeta,
		"roleRef":    crb.RoleRef,
		"subjects":   crb.Subjects,
	}

	c.JSON(http.StatusOK, result)
}

// UpdateClusterRoleBinding updates a ClusterRoleBinding
func (h *Handler) UpdateClusterRoleBinding(c *gin.Context) {
	clusterName := c.Param("name")
	crbName := c.Param("clusterrolebinding")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Read the request body as YAML
	var crb rbacv1.ClusterRoleBinding
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// Decode YAML to ClusterRoleBinding
	if err := yaml.Unmarshal(bodyBytes, &crb); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to decode ClusterRoleBinding: %v", err)})
		return
	}

	// Ensure name matches
	crb.Name = crbName

	// Update the ClusterRoleBinding
	updated, err := client.RbacV1().ClusterRoleBindings().Update(context.Background(), &crb, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update cluster role binding: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

// DeleteClusterRoleBinding deletes a ClusterRoleBinding
func (h *Handler) DeleteClusterRoleBinding(c *gin.Context) {
	clusterName := c.Param("name")
	crbName := c.Param("clusterrolebinding")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.RbacV1().ClusterRoleBindings().Delete(context.Background(), crbName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete cluster role binding: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ClusterRoleBinding deleted successfully"})
}

// CreateClusterRoleBinding creates a new ClusterRoleBinding
func (h *Handler) CreateClusterRoleBinding(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Read the request body as YAML
	var crb rbacv1.ClusterRoleBinding
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// Decode YAML to ClusterRoleBinding
	if err := yaml.Unmarshal(bodyBytes, &crb); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to decode ClusterRoleBinding: %v", err)})
		return
	}

	// Create the ClusterRoleBinding
	created, err := client.RbacV1().ClusterRoleBindings().Create(context.Background(), &crb, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create cluster role binding: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ClusterRoleBinding created successfully", "clusterRoleBinding": created})
}

// ==================== RoleBinding Handlers ====================

// ListRoleBindings returns a list of RoleBindings in a cluster
func (h *Handler) ListRoleBindings(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Query("namespace")

	if namespace == "" || namespace == "all" {
		namespace = metav1.NamespaceAll
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	roleBindings, err := client.RbacV1().RoleBindings(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list role bindings: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Infof("Found %d role bindings in namespace %s for cluster %s", len(roleBindings.Items), namespace, clusterName)

	// Add cluster name to each role binding
	result := make([]map[string]interface{}, len(roleBindings.Items))
	for i, rb := range roleBindings.Items {
		rbMap := map[string]interface{}{
			"apiVersion":  "rbac.authorization.k8s.io/v1",
			"kind":        "RoleBinding",
			"metadata":    rb.ObjectMeta,
			"roleRef":     rb.RoleRef,
			"subjects":    rb.Subjects,
			"ClusterName": clusterName,
		}
		result[i] = rbMap
	}

	log.Infof("Returning %d role bindings", len(result))
	c.JSON(http.StatusOK, result)
}

// ListRoleBindingsByNamespace returns a list of RoleBindings in a specific namespace
func (h *Handler) ListRoleBindingsByNamespace(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	roleBindings, err := client.RbacV1().RoleBindings(namespace).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list role bindings: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Infof("Found %d role bindings in namespace %s for cluster %s", len(roleBindings.Items), namespace, clusterName)

	// Add cluster name to each role binding
	result := make([]map[string]interface{}, len(roleBindings.Items))
	for i, rb := range roleBindings.Items {
		rbMap := map[string]interface{}{
			"apiVersion":  "rbac.authorization.k8s.io/v1",
			"kind":        "RoleBinding",
			"metadata":    rb.ObjectMeta,
			"roleRef":     rb.RoleRef,
			"subjects":    rb.Subjects,
			"ClusterName": clusterName,
		}
		result[i] = rbMap
	}

	log.Infof("Returning %d role bindings", len(result))
	c.JSON(http.StatusOK, result)
}

// GetRoleBinding returns a specific RoleBinding
func (h *Handler) GetRoleBinding(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	rbName := c.Param("rolebinding")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	rb, err := client.RbacV1().RoleBindings(namespace).Get(context.Background(), rbName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get role binding: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Return full RoleBinding with all fields
	result := map[string]interface{}{
		"apiVersion": "rbac.authorization.k8s.io/v1",
		"kind":       "RoleBinding",
		"metadata":   rb.ObjectMeta,
		"roleRef":    rb.RoleRef,
		"subjects":   rb.Subjects,
	}

	c.JSON(http.StatusOK, result)
}

// UpdateRoleBinding updates a RoleBinding
func (h *Handler) UpdateRoleBinding(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	rbName := c.Param("rolebinding")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Read the request body as YAML
	var rb rbacv1.RoleBinding
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// Decode YAML to RoleBinding
	if err := yaml.Unmarshal(bodyBytes, &rb); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to decode RoleBinding: %v", err)})
		return
	}

	// Ensure namespace and name match
	rb.Namespace = namespace
	rb.Name = rbName

	// Update the RoleBinding
	updated, err := client.RbacV1().RoleBindings(namespace).Update(context.Background(), &rb, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update role binding: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

// DeleteRoleBinding deletes a RoleBinding
func (h *Handler) DeleteRoleBinding(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	rbName := c.Param("rolebinding")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.RbacV1().RoleBindings(namespace).Delete(context.Background(), rbName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete role binding: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "RoleBinding deleted successfully"})
}

// CreateRoleBinding creates a new RoleBinding
func (h *Handler) CreateRoleBinding(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Read the request body as YAML
	var rb rbacv1.RoleBinding
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// Decode YAML to RoleBinding
	if err := yaml.Unmarshal(bodyBytes, &rb); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to decode RoleBinding: %v", err)})
		return
	}

	// Ensure namespace matches
	rb.Namespace = namespace

	// Create the RoleBinding
	created, err := client.RbacV1().RoleBindings(namespace).Create(context.Background(), &rb, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create role binding: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "RoleBinding created successfully", "roleBinding": created})
}


// ==================== CustomResourceDefinition Handlers ====================

// ListCustomResourceDefinitions returns a list of CRDs in a cluster
func (h *Handler) ListCustomResourceDefinitions(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetApiExtensionsClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	crdClient := client.ApiextensionsV1().CustomResourceDefinitions()
	crds, err := crdClient.List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list custom resource definitions: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Infof("Found %d custom resource definitions for cluster %s", len(crds.Items), clusterName)

	// Add cluster name to each CRD
	result := make([]map[string]interface{}, len(crds.Items))
	for i, crd := range crds.Items {
		// Get the first version for display
		var version string
		var scope string
		if len(crd.Spec.Versions) > 0 {
			for _, v := range crd.Spec.Versions {
				if v.Served {
					version = v.Name
					break
				}
			}
			if version == "" {
				version = crd.Spec.Versions[0].Name
			}
		}
		scope = string(crd.Spec.Scope)

		crdMap := map[string]interface{}{
			"apiVersion":  "apiextensions.k8s.io/v1",
			"kind":        "CustomResourceDefinition",
			"metadata":    crd.ObjectMeta,
			"spec":        crd.Spec,
			"status":      crd.Status,
			"ClusterName": clusterName,
			// Additional fields for easy display
			"group":       crd.Spec.Group,
			"version":     version,
			"scope":       scope,
			"resource":    crd.Spec.Names.Plural,
		}
		result[i] = crdMap
	}

	log.Infof("Returning %d custom resource definitions", len(result))
	c.JSON(http.StatusOK, result)
}

// GetCustomResourceDefinition returns a specific CRD
func (h *Handler) GetCustomResourceDefinition(c *gin.Context) {
	clusterName := c.Param("name")
	crdName := c.Param("crd")

	client, err := h.clusterManager.GetApiExtensionsClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	crdClient := client.ApiextensionsV1().CustomResourceDefinitions()
	crd, err := crdClient.Get(context.Background(), crdName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get custom resource definition: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Return full CRD with all fields
	result := map[string]interface{}{
		"apiVersion": "apiextensions.k8s.io/v1",
		"kind":       "CustomResourceDefinition",
		"metadata":   crd.ObjectMeta,
		"spec":       crd.Spec,
		"status":     crd.Status,
	}

	c.JSON(http.StatusOK, result)
}

// UpdateCustomResourceDefinition updates a CRD
func (h *Handler) UpdateCustomResourceDefinition(c *gin.Context) {
	clusterName := c.Param("name")
	crdName := c.Param("crd")

	client, err := h.clusterManager.GetApiExtensionsClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Read the request body as YAML
	var crd apiextensionsv1.CustomResourceDefinition
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// Decode YAML to CRD
	if err := yaml.Unmarshal(bodyBytes, &crd); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to decode CustomResourceDefinition: %v", err)})
		return
	}

	// Ensure name matches
	crd.Name = crdName

	// Update the CRD
	crdClient := client.ApiextensionsV1().CustomResourceDefinitions()
	updated, err := crdClient.Update(context.Background(), &crd, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update custom resource definition: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

// DeleteCustomResourceDefinition deletes a CRD
func (h *Handler) DeleteCustomResourceDefinition(c *gin.Context) {
	clusterName := c.Param("name")
	crdName := c.Param("crd")

	client, err := h.clusterManager.GetApiExtensionsClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	crdClient := client.ApiextensionsV1().CustomResourceDefinitions()
	err = crdClient.Delete(context.Background(), crdName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete custom resource definition: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "CustomResourceDefinition deleted successfully"})
}

// ==================== Custom Resource Handlers (Dynamic) ====================

// ListCustomResources returns a list of custom resources for a given GVR
func (h *Handler) ListCustomResources(c *gin.Context) {
	clusterName := c.Param("name")
	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Param("namespace") // optional, "all" means cluster-wide

	if group == "" || version == "" || resource == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "group, version, and resource are required query parameters"})
		return
	}

	client, err := h.clusterManager.GetDynamicClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Create GVR
	gvr := schema.GroupVersionResource{
		Group:    group,
		Version:  version,
		Resource: resource,
	}

	var list *unstructured.UnstructuredList
	if namespace != "" && namespace != "all" {
		list, err = client.Resource(gvr).Namespace(namespace).List(context.Background(), metav1.ListOptions{})
	} else {
		list, err = client.Resource(gvr).List(context.Background(), metav1.ListOptions{})
	}

	if err != nil {
		log.Errorf("Failed to list custom resources: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Add cluster name to each item
	result := make([]map[string]interface{}, len(list.Items))
	for i, item := range list.Items {
		itemMap := item.Object
		itemMap["ClusterName"] = clusterName
		result[i] = itemMap
	}

	log.Infof("Found %d custom resources for %s/%s/%s in cluster %s", len(result), group, version, resource, clusterName)
	c.JSON(http.StatusOK, result)
}

// GetCustomResource returns a specific custom resource
func (h *Handler) GetCustomResource(c *gin.Context) {
	clusterName := c.Param("name")
	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Param("namespace")
	resourceName := c.Param("resourcename")

	if group == "" || version == "" || resource == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "group, version, and resource are required query parameters"})
		return
	}

	client, err := h.clusterManager.GetDynamicClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	gvr := schema.GroupVersionResource{
		Group:    group,
		Version:  version,
		Resource: resource,
	}

	var obj *unstructured.Unstructured
	if namespace != "" {
		obj, err = client.Resource(gvr).Namespace(namespace).Get(context.Background(), resourceName, metav1.GetOptions{})
	} else {
		obj, err = client.Resource(gvr).Get(context.Background(), resourceName, metav1.GetOptions{})
	}

	if err != nil {
		log.Errorf("Failed to get custom resource: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, obj.Object)
}

// UpdateCustomResource updates a custom resource
func (h *Handler) UpdateCustomResource(c *gin.Context) {
	clusterName := c.Param("name")
	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Param("namespace")
	resourceName := c.Param("resourcename")

	if group == "" || version == "" || resource == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "group, version, and resource are required query parameters"})
		return
	}

	client, err := h.clusterManager.GetDynamicClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Read YAML from request body
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read request body"})
		return
	}

	// Parse YAML to unstructured
	var obj unstructured.Unstructured
	if err := yaml.Unmarshal(bodyBytes, &obj.Object); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to decode YAML: %v", err)})
		return
	}

	gvr := schema.GroupVersionResource{
		Group:    group,
		Version:  version,
		Resource: resource,
	}

	// Ensure name matches
	obj.SetName(resourceName)
	if namespace != "" {
		obj.SetNamespace(namespace)
	}

	var updated *unstructured.Unstructured
	if namespace != "" {
		updated, err = client.Resource(gvr).Namespace(namespace).Update(context.Background(), &obj, metav1.UpdateOptions{})
	} else {
		updated, err = client.Resource(gvr).Update(context.Background(), &obj, metav1.UpdateOptions{})
	}

	if err != nil {
		log.Errorf("Failed to update custom resource: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated.Object)
}

// DeleteCustomResource deletes a custom resource
func (h *Handler) DeleteCustomResource(c *gin.Context) {
	clusterName := c.Param("name")
	group := c.Query("group")
	version := c.Query("version")
	resource := c.Query("resource")
	namespace := c.Param("namespace")
	resourceName := c.Param("resourcename")

	if group == "" || version == "" || resource == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "group, version, and resource are required query parameters"})
		return
	}

	client, err := h.clusterManager.GetDynamicClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	gvr := schema.GroupVersionResource{
		Group:    group,
		Version:  version,
		Resource: resource,
	}

	if namespace != "" {
		err = client.Resource(gvr).Namespace(namespace).Delete(context.Background(), resourceName, metav1.DeleteOptions{})
	} else {
		err = client.Resource(gvr).Delete(context.Background(), resourceName, metav1.DeleteOptions{})
	}

	if err != nil {
		log.Errorf("Failed to delete custom resource: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Custom resource deleted successfully"})
}

// ListIntegrations lists all integrations
func (h *Handler) ListIntegrations(c *gin.Context) {
	integrations, err := h.db.ListIntegrations()
	if err != nil {
		log.Errorf("Failed to list integrations: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, integrations)
}

// CreateIntegration creates a new integration
func (h *Handler) CreateIntegration(c *gin.Context) {
	var req struct {
		Name       string `json:"name" binding:"required"`
		Type       string `json:"type" binding:"required"`
		Config     string `json:"config"`
		Enabled    bool   `json:"enabled"`
		AuthMethod string `json:"auth_method"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	integration := &db.Integration{
		Name:       req.Name,
		Type:       req.Type,
		Config:     req.Config,
		Enabled:    req.Enabled,
		AuthMethod: req.AuthMethod,
	}

	if err := h.db.SaveIntegration(integration); err != nil {
		log.Errorf("Failed to create integration: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Reload to get the ID
	created, err := h.db.GetIntegrationByType(req.Type)
	if err != nil {
		log.Errorf("Failed to retrieve created integration: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, created)
}

// UpdateIntegration updates an integration
func (h *Handler) UpdateIntegration(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid integration ID"})
		return
	}

	var req struct {
		Enabled *bool `json:"enabled"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get existing integration
	integration, err := h.db.GetIntegrationByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "integration not found"})
		return
	}

	// Update fields
	if req.Enabled != nil {
		integration.Enabled = *req.Enabled
	}

	// Save
	if err := h.db.SaveIntegration(integration); err != nil {
		log.Errorf("Failed to update integration: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, integration)
}

// setupKubelensServiceAccount creates a ServiceAccount in kube-system namespace
// and binds it to cluster-admin ClusterRole for node operations
func (h *Handler) setupKubelensServiceAccount(clusterName string) error {
	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		return fmt.Errorf("failed to get client: %v", err)
	}

	ctx := context.Background()
	namespace := "kube-system"
	serviceAccountName := "kubelens"
	clusterRoleBindingName := "kubelens-cluster-admin"

	// 1. Create ServiceAccount if it doesn't exist
	_, err = client.CoreV1().ServiceAccounts(namespace).Get(ctx, serviceAccountName, metav1.GetOptions{})
	if err != nil {
		log.Infof("Creating ServiceAccount %s in namespace %s for cluster %s", serviceAccountName, namespace, clusterName)
		sa := &corev1.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{
				Name:      serviceAccountName,
				Namespace: namespace,
				Labels: map[string]string{
					"app.kubernetes.io/name":       "kubelens",
					"app.kubernetes.io/managed-by": "kubelens",
				},
			},
		}
		_, err = client.CoreV1().ServiceAccounts(namespace).Create(ctx, sa, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("failed to create ServiceAccount: %v", err)
		}
		log.Infof("ServiceAccount %s created successfully in cluster %s", serviceAccountName, clusterName)
	} else {
		log.Infof("ServiceAccount %s already exists in cluster %s", serviceAccountName, clusterName)
	}

	// 2. Find cluster-admin ClusterRole (or fallback to rbac-defaults)
	clusterRoleName := "cluster-admin"
	_, err = client.RbacV1().ClusterRoles().Get(ctx, clusterRoleName, metav1.GetOptions{})
	if err != nil {
		// Fallback: try to find a ClusterRole with label kubernetes.io/bootstrapping=rbac-defaults
		log.Warnf("cluster-admin ClusterRole not found, searching for rbac-defaults labeled roles")
		roles, err := client.RbacV1().ClusterRoles().List(ctx, metav1.ListOptions{
			LabelSelector: "kubernetes.io/bootstrapping=rbac-defaults",
		})
		if err != nil || len(roles.Items) == 0 {
			return fmt.Errorf("no suitable ClusterRole found")
		}
		// Use the first rbac-defaults role
		clusterRoleName = roles.Items[0].Name
		log.Infof("Using ClusterRole: %s", clusterRoleName)
	}

	// 3. Create ClusterRoleBinding if it doesn't exist
	_, err = client.RbacV1().ClusterRoleBindings().Get(ctx, clusterRoleBindingName, metav1.GetOptions{})
	if err != nil {
		log.Infof("Creating ClusterRoleBinding %s for cluster %s", clusterRoleBindingName, clusterName)
		crb := &rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name: clusterRoleBindingName,
				Labels: map[string]string{
					"app.kubernetes.io/name":       "kubelens",
					"app.kubernetes.io/managed-by": "kubelens",
				},
			},
			RoleRef: rbacv1.RoleRef{
				APIGroup: "rbac.authorization.k8s.io",
				Kind:     "ClusterRole",
				Name:     clusterRoleName,
			},
			Subjects: []rbacv1.Subject{
				{
					Kind:      "ServiceAccount",
					Name:      serviceAccountName,
					Namespace: namespace,
				},
			},
		}
		_, err = client.RbacV1().ClusterRoleBindings().Create(ctx, crb, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("failed to create ClusterRoleBinding: %v", err)
		}
		log.Infof("ClusterRoleBinding %s created successfully in cluster %s", clusterRoleBindingName, clusterName)
	} else {
		log.Infof("ClusterRoleBinding %s already exists in cluster %s", clusterRoleBindingName, clusterName)
	}

	log.Infof("Kubelens ServiceAccount setup completed for cluster %s", clusterName)
	return nil
}
