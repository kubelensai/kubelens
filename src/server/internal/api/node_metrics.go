package api

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

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

