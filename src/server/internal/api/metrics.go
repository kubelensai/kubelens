package api

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ============================================================================
// Metrics Types & Structures
// ============================================================================

// ClusterMetrics represents cluster-wide metrics
type ClusterMetrics struct {
	CPU    ResourceMetrics `json:"cpu"`
	Memory ResourceMetrics `json:"memory"`
}

// ResourceMetrics represents metrics for a single resource type
type ResourceMetrics struct {
	Capacity    int64 `json:"capacity"`
	Allocatable int64 `json:"allocatable"`
	Requests    int64 `json:"requests"`
	Limits      int64 `json:"limits"`
	Usage       int64 `json:"usage"`
}

// ClusterResourcesSummary represents a summary of cluster resources
type ClusterResourcesSummary struct {
	TotalNodes           int `json:"totalNodes"`
	ReadyNodes           int `json:"readyNodes"`
	TotalPods            int `json:"totalPods"`
	RunningPods          int `json:"runningPods"`
	TotalDeployments     int `json:"totalDeployments"`
	AvailableDeployments int `json:"availableDeployments"`
	TotalNamespaces      int `json:"totalNamespaces"`
	ActiveNamespaces     int `json:"activeNamespaces"`
	TotalServices        int `json:"totalServices"`
}

// NodeMetrics represents metrics for a single node
type NodeMetrics struct {
	Usage    NodeResourceUsage `json:"usage"`
	Capacity NodeResourceUsage `json:"capacity"`
}

// NodeResourceUsage represents resource usage for a node
type NodeResourceUsage struct {
	CPU    int64 `json:"cpu"`    // in millicores
	Memory int64 `json:"memory"` // in bytes
}

// PodMetrics represents CPU and Memory metrics for a pod
type PodMetrics struct {
	Containers []ContainerMetrics `json:"containers"`
}

// ContainerMetrics represents CPU and Memory metrics for a container
type ContainerMetrics struct {
	Name  string                 `json:"name"`
	Usage map[string]interface{} `json:"usage"`
}

// ============================================================================
// Cluster-Level Metrics
// ============================================================================

// GetClusterMetrics returns CPU and Memory metrics for a cluster
func (h *Handler) GetClusterMetrics(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	metrics := ClusterMetrics{
		CPU:    ResourceMetrics{},
		Memory: ResourceMetrics{},
	}

	// Get all nodes
	nodes, err := client.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list nodes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Calculate capacity and allocatable from nodes
	for _, node := range nodes.Items {
		// CPU
		cpuCapacity := node.Status.Capacity[corev1.ResourceCPU]
		cpuAllocatable := node.Status.Allocatable[corev1.ResourceCPU]
		metrics.CPU.Capacity += cpuCapacity.MilliValue()
		metrics.CPU.Allocatable += cpuAllocatable.MilliValue()

		// Memory
		memCapacity := node.Status.Capacity[corev1.ResourceMemory]
		memAllocatable := node.Status.Allocatable[corev1.ResourceMemory]
		metrics.Memory.Capacity += memCapacity.Value()
		metrics.Memory.Allocatable += memAllocatable.Value()
	}

	// Get all pods to calculate requests and limits
	pods, err := client.CoreV1().Pods(metav1.NamespaceAll).List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list pods: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Calculate requests and limits from all pod containers
	for _, pod := range pods.Items {
		// Skip terminated pods
		if pod.Status.Phase == corev1.PodSucceeded || pod.Status.Phase == corev1.PodFailed {
			continue
		}

		for _, container := range pod.Spec.Containers {
			// CPU requests and limits
			if cpuRequest, ok := container.Resources.Requests[corev1.ResourceCPU]; ok {
				metrics.CPU.Requests += cpuRequest.MilliValue()
			}
			if cpuLimit, ok := container.Resources.Limits[corev1.ResourceCPU]; ok {
				metrics.CPU.Limits += cpuLimit.MilliValue()
			}

			// Memory requests and limits
			if memRequest, ok := container.Resources.Requests[corev1.ResourceMemory]; ok {
				metrics.Memory.Requests += memRequest.Value()
			}
			if memLimit, ok := container.Resources.Limits[corev1.ResourceMemory]; ok {
				metrics.Memory.Limits += memLimit.Value()
			}
		}
	}

	// Try to get actual usage from metrics-server
	metricsClient, err := h.clusterManager.GetMetricsClient(clusterName)
	if err != nil {
		log.Warnf("Metrics server not available for cluster %s: %v", clusterName, err)
		// Continue without usage data
	} else {
		// Get node metrics using the typed client
		nodeMetricsList, err := metricsClient.MetricsV1beta1().NodeMetricses().List(ctx, metav1.ListOptions{})
		
		if err != nil {
			log.Warnf("Failed to get node metrics: %v", err)
		} else {
			for _, nodeMetrics := range nodeMetricsList.Items {
				// CPU usage
				cpuUsage := nodeMetrics.Usage[corev1.ResourceCPU]
				metrics.CPU.Usage += cpuUsage.MilliValue()

				// Memory usage
				memUsage := nodeMetrics.Usage[corev1.ResourceMemory]
				metrics.Memory.Usage += memUsage.Value()
			}
		}
	}

	// Convert milli-cores to cores for CPU capacity, allocatable, requests, limits
	// Usage is already in milli-cores from metrics server
	cpuMetrics := metrics.CPU
	metrics.CPU = ResourceMetrics{
		Capacity:    cpuMetrics.Capacity,
		Allocatable: cpuMetrics.Allocatable,
		Requests:    cpuMetrics.Requests,
		Limits:      cpuMetrics.Limits,
		Usage:       cpuMetrics.Usage,
	}

	c.JSON(http.StatusOK, metrics)
}

// GetClusterResourcesSummary returns a summary of cluster resources
func (h *Handler) GetClusterResourcesSummary(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	summary := ClusterResourcesSummary{}

	// Count nodes
	nodes, err := client.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list nodes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	summary.TotalNodes = len(nodes.Items)

	// Count ready nodes
	for _, node := range nodes.Items {
		for _, condition := range node.Status.Conditions {
			if condition.Type == corev1.NodeReady && condition.Status == corev1.ConditionTrue {
				summary.ReadyNodes++
				break
			}
		}
	}

	// Count pods
	pods, err := client.CoreV1().Pods(metav1.NamespaceAll).List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list pods: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	summary.TotalPods = len(pods.Items)

	// Count running pods
	for _, pod := range pods.Items {
		if pod.Status.Phase == corev1.PodRunning {
			summary.RunningPods++
		}
	}

	// Count deployments
	deployments, err := client.AppsV1().Deployments(metav1.NamespaceAll).List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list deployments: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	summary.TotalDeployments = len(deployments.Items)

	// Count available deployments
	for _, deployment := range deployments.Items {
		if deployment.Status.AvailableReplicas > 0 {
			summary.AvailableDeployments++
		}
	}

	// Count namespaces
	namespaces, err := client.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list namespaces: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	summary.TotalNamespaces = len(namespaces.Items)

	// Count active namespaces
	for _, ns := range namespaces.Items {
		if ns.Status.Phase == corev1.NamespaceActive {
			summary.ActiveNamespaces++
		}
	}

	// Count services
	services, err := client.CoreV1().Services(metav1.NamespaceAll).List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list services: %v", err)
		// Don't fail the entire request if services can't be listed
		summary.TotalServices = 0
	} else {
		summary.TotalServices = len(services.Items)
	}

	c.JSON(http.StatusOK, summary)
}

// ============================================================================
// Node-Level Metrics
// ============================================================================

// GetNodeMetrics returns metrics for a specific node
func (h *Handler) GetNodeMetrics(c *gin.Context) {
	clusterName := c.Param("name")
	nodeName := c.Param("node")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()

	// Get node info for capacity
	node, err := client.CoreV1().Nodes().Get(ctx, nodeName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get node: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	metrics := NodeMetrics{
		Usage:    NodeResourceUsage{},
		Capacity: NodeResourceUsage{},
	}

	// Get capacity from node status
	cpuCapacity := node.Status.Capacity[corev1.ResourceCPU]
	memCapacity := node.Status.Capacity[corev1.ResourceMemory]
	metrics.Capacity.CPU = cpuCapacity.MilliValue()
	metrics.Capacity.Memory = memCapacity.Value()

	// Try to get usage from metrics-server
	metricsClient, err := h.clusterManager.GetMetricsClient(clusterName)
	if err != nil {
		log.Warnf("Metrics server not available for cluster %s: %v", clusterName, err)
		// Return with only capacity data
		c.JSON(http.StatusOK, metrics)
		return
	}

	// Get node metrics using the typed client
	nodeMetrics, err := metricsClient.MetricsV1beta1().NodeMetricses().Get(ctx, nodeName, metav1.GetOptions{})
	if err != nil {
		log.Warnf("Failed to get node metrics: %v", err)
		// Return with only capacity data
		c.JSON(http.StatusOK, metrics)
		return
	}

	// Extract usage from metrics
	cpuUsage := nodeMetrics.Usage[corev1.ResourceCPU]
	memUsage := nodeMetrics.Usage[corev1.ResourceMemory]
	metrics.Usage.CPU = cpuUsage.MilliValue()
	metrics.Usage.Memory = memUsage.Value()

	c.JSON(http.StatusOK, metrics)
}

// ============================================================================
// Pod-Level Metrics
// ============================================================================

// GetPodMetrics returns CPU and Memory metrics for a specific pod
func (h *Handler) GetPodMetrics(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	podName := c.Param("pod")

	metricsClient, err := h.clusterManager.GetMetricsClient(clusterName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get metrics client"})
		return
	}

	// Get pod metrics from metrics-server
	podMetrics, err := metricsClient.MetricsV1beta1().PodMetricses(namespace).Get(context.Background(), podName, metav1.GetOptions{})
	if err != nil {
		// If metrics-server is not available or pod metrics not found, return empty metrics
		c.JSON(http.StatusOK, PodMetrics{Containers: []ContainerMetrics{}})
		return
	}

	// Build response
	containers := make([]ContainerMetrics, 0, len(podMetrics.Containers))
	for _, container := range podMetrics.Containers {
		containers = append(containers, ContainerMetrics{
			Name: container.Name,
			Usage: map[string]interface{}{
				"cpu":    container.Usage.Cpu().String(),
				"memory": container.Usage.Memory().String(),
			},
		})
	}

	c.JSON(http.StatusOK, PodMetrics{
		Containers: containers,
	})
}

// ============================================================================
// Namespace-Level Metrics
// ============================================================================

// NamespaceMetrics represents metrics for a single namespace
type NamespaceMetrics struct {
	Usage    NamespaceResourceUsage `json:"usage"`
	Requests NamespaceResourceUsage `json:"requests"`
	Limits   NamespaceResourceUsage `json:"limits"`
}

// NamespaceResourceUsage represents resource usage for a namespace
type NamespaceResourceUsage struct {
	CPU    int64 `json:"cpu"`    // in millicores
	Memory int64 `json:"memory"` // in bytes
}

// GetNamespaceMetrics returns metrics for a specific namespace by aggregating pod metrics
func (h *Handler) GetNamespaceMetrics(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	metrics := NamespaceMetrics{
		Usage:    NamespaceResourceUsage{},
		Requests: NamespaceResourceUsage{},
		Limits:   NamespaceResourceUsage{},
	}

	// Get all pods in the namespace to calculate requests and limits
	pods, err := client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list pods in namespace %s: %v", namespace, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Calculate requests and limits from all pod containers
	for _, pod := range pods.Items {
		// Skip terminated pods
		if pod.Status.Phase == corev1.PodSucceeded || pod.Status.Phase == corev1.PodFailed {
			continue
		}

		for _, container := range pod.Spec.Containers {
			// CPU requests and limits
			if cpuRequest, ok := container.Resources.Requests[corev1.ResourceCPU]; ok {
				metrics.Requests.CPU += cpuRequest.MilliValue()
			}
			if cpuLimit, ok := container.Resources.Limits[corev1.ResourceCPU]; ok {
				metrics.Limits.CPU += cpuLimit.MilliValue()
			}

			// Memory requests and limits
			if memRequest, ok := container.Resources.Requests[corev1.ResourceMemory]; ok {
				metrics.Requests.Memory += memRequest.Value()
			}
			if memLimit, ok := container.Resources.Limits[corev1.ResourceMemory]; ok {
				metrics.Limits.Memory += memLimit.Value()
			}
		}
	}

	// Try to get actual usage from metrics-server
	metricsClient, err := h.clusterManager.GetMetricsClient(clusterName)
	if err != nil {
		log.Warnf("Metrics server not available for cluster %s: %v", clusterName, err)
		// Return with only requests and limits
		c.JSON(http.StatusOK, metrics)
		return
	}

	// Get all pod metrics in the namespace
	podMetricsList, err := metricsClient.MetricsV1beta1().PodMetricses(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		log.Warnf("Failed to get pod metrics for namespace %s: %v", namespace, err)
		// Return with only requests and limits
		c.JSON(http.StatusOK, metrics)
		return
	}

	// Aggregate usage metrics from all pods
	for _, podMetrics := range podMetricsList.Items {
		for _, container := range podMetrics.Containers {
			// CPU usage
			cpuUsage := container.Usage[corev1.ResourceCPU]
			metrics.Usage.CPU += cpuUsage.MilliValue()

			// Memory usage
			memUsage := container.Usage[corev1.ResourceMemory]
			metrics.Usage.Memory += memUsage.Value()
		}
	}

	c.JSON(http.StatusOK, metrics)
}

// ============================================================================
// Helper Functions
// ============================================================================

// Helper function to parse resource quantities
func parseQuantity(q resource.Quantity) int64 {
	return q.Value()
}
