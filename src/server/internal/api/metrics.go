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
}

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

	c.JSON(http.StatusOK, summary)
}

// Helper function to parse resource quantities
func parseQuantity(q resource.Quantity) int64 {
	return q.Value()
}

