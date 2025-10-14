package api

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// PodMetrics represents CPU and Memory metrics for a pod
type PodMetrics struct {
	Containers []ContainerMetrics `json:"containers"`
}

// ContainerMetrics represents CPU and Memory metrics for a container
type ContainerMetrics struct {
	Name  string                 `json:"name"`
	Usage map[string]interface{} `json:"usage"`
}

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

