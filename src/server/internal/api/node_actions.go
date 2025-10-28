package api

import (
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	policyv1 "k8s.io/api/policy/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
)

// ============================================================================
// Node CRUD Operations
// ============================================================================

// ListNodes returns a list of nodes
func (h *Handler) ListNodes(c *gin.Context) {
	clusterName := c.Param("name")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	nodes, err := client.CoreV1().Nodes().List(context.Background(), metav1.ListOptions{})
	if err != nil {
		log.Errorf("Failed to list nodes: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"nodes": nodes.Items})
}

// GetNode returns details of a specific node
func (h *Handler) GetNode(c *gin.Context) {
	clusterName := c.Param("name")
	nodeName := c.Param("node")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	node, err := client.CoreV1().Nodes().Get(context.Background(), nodeName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get node: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, node)
}

// DeleteNode deletes a node from the cluster
func (h *Handler) DeleteNode(c *gin.Context) {
	clusterName := c.Param("name")
	nodeName := c.Param("node")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	err = client.CoreV1().Nodes().Delete(context.Background(), nodeName, metav1.DeleteOptions{})
	if err != nil {
		log.Errorf("Failed to delete node: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Infof("Deleted node: %s from cluster: %s", nodeName, clusterName)
	c.JSON(http.StatusOK, gin.H{"message": "Node deleted successfully"})
}

// ============================================================================
// Node Scheduling Operations
// ============================================================================

// CordonNode marks a node as unschedulable
func (h *Handler) CordonNode(c *gin.Context) {
	clusterName := c.Param("name")
	nodeName := c.Param("node")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	node, err := client.CoreV1().Nodes().Get(context.Background(), nodeName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get node: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	if node.Spec.Unschedulable {
		c.JSON(http.StatusOK, gin.H{"message": "Node is already cordoned"})
		return
	}

	node.Spec.Unschedulable = true
	_, err = client.CoreV1().Nodes().Update(context.Background(), node, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to cordon node: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Infof("Cordoned node: %s in cluster: %s", nodeName, clusterName)
	c.JSON(http.StatusOK, gin.H{"message": "Node cordoned successfully"})
}

// UncordonNode marks a node as schedulable
func (h *Handler) UncordonNode(c *gin.Context) {
	clusterName := c.Param("name")
	nodeName := c.Param("node")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	node, err := client.CoreV1().Nodes().Get(context.Background(), nodeName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get node: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	if !node.Spec.Unschedulable {
		c.JSON(http.StatusOK, gin.H{"message": "Node is already uncordoned"})
		return
	}

	node.Spec.Unschedulable = false
	_, err = client.CoreV1().Nodes().Update(context.Background(), node, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to uncordon node: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Infof("Uncordoned node: %s in cluster: %s", nodeName, clusterName)
	c.JSON(http.StatusOK, gin.H{"message": "Node uncordoned successfully"})
}

// DrainNode evicts all pods from a node (API-based drain)
func (h *Handler) DrainNode(c *gin.Context) {
	clusterName := c.Param("name")
	nodeName := c.Param("node")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// First, cordon the node
	node, err := client.CoreV1().Nodes().Get(context.Background(), nodeName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get node: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	if !node.Spec.Unschedulable {
		node.Spec.Unschedulable = true
		_, err = client.CoreV1().Nodes().Update(context.Background(), node, metav1.UpdateOptions{})
		if err != nil {
			log.Errorf("Failed to cordon node before drain: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to cordon node: %v", err)})
			return
		}
	}

	// Get all pods on this node
	pods, err := client.CoreV1().Pods(metav1.NamespaceAll).List(context.Background(), metav1.ListOptions{
		FieldSelector: fmt.Sprintf("spec.nodeName=%s", nodeName),
	})
	if err != nil {
		log.Errorf("Failed to list pods on node: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	evictedCount := 0
	failedCount := 0
	skippedCount := 0

	// Evict each pod
	for _, pod := range pods.Items {
		// Skip DaemonSet pods (they can't be evicted)
		if pod.OwnerReferences != nil {
			isDaemonSet := false
			for _, owner := range pod.OwnerReferences {
				if owner.Kind == "DaemonSet" {
					isDaemonSet = true
					break
				}
			}
			if isDaemonSet {
				skippedCount++
				continue
			}
		}

		// Skip pods that are already terminating
		if pod.DeletionTimestamp != nil {
			skippedCount++
			continue
		}

		// Create eviction
		eviction := &policyv1.Eviction{
			ObjectMeta: metav1.ObjectMeta{
				Name:      pod.Name,
				Namespace: pod.Namespace,
			},
			DeleteOptions: &metav1.DeleteOptions{
				GracePeriodSeconds: pod.Spec.TerminationGracePeriodSeconds,
			},
		}

		err := client.CoreV1().Pods(pod.Namespace).EvictV1(context.Background(), eviction)
		if err != nil {
			log.Warnf("Failed to evict pod %s/%s: %v", pod.Namespace, pod.Name, err)
			failedCount++
		} else {
			evictedCount++
		}
	}

	log.Infof("Drained node %s: %d evicted, %d failed, %d skipped (DaemonSets)", nodeName, evictedCount, failedCount, skippedCount)
	c.JSON(http.StatusOK, gin.H{
		"message": "Node drain initiated",
		"evicted": evictedCount,
		"failed":  failedCount,
		"skipped": skippedCount,
	})
}

// ============================================================================
// Node Interactive Operations (WebSocket-based)
// ============================================================================

// NodeShell handles WebSocket connection for node shell access via a debug pod
func (h *Handler) NodeShell(c *gin.Context) {
	clusterName := c.Param("name")
	nodeName := c.Param("node")
	shellPath := c.DefaultQuery("shell", "/bin/zsh")

	log.Infof("Node shell request: cluster=%s, node=%s, shell=%s", clusterName, nodeName, shellPath)

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		log.Errorf("Failed to get client: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	restConfig, err := h.clusterManager.GetConfig(clusterName)
	if err != nil {
		log.Errorf("Failed to get config: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get cluster config"})
		return
	}


	ctx := context.Background()

	// Get node to verify it exists
	node, err := client.CoreV1().Nodes().Get(ctx, nodeName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get node: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
		return
	}

	log.Infof("Node found: %s", node.Name)

	// Upgrade HTTP connection to WebSocket
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Errorf("Failed to upgrade WebSocket: %v", err)
		return
	}
	defer ws.Close()

	log.Infof("WebSocket upgraded successfully")

	debugNamespace := "kube-system"  // Use kube-system namespace
	debugPodName := fmt.Sprintf("node-shell-%s", nodeName)
	
	log.Infof("Looking for existing debug pod: %s in namespace %s", debugPodName, debugNamespace)
	
	// Try to find existing pod for this node
	labelSelector := fmt.Sprintf("kubelens.io/debug-pod=true,kubelens.io/node=%s", nodeName)
	existingPods, err := client.CoreV1().Pods(debugNamespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelector,
		FieldSelector: "status.phase=Running",
	})
	
	var podToUse *corev1.Pod
	
	if err == nil && len(existingPods.Items) > 0 {
		// Found existing running pod, reuse it
		podToUse = &existingPods.Items[0]
		debugPodName = podToUse.Name
		log.Infof("Reusing existing debug pod: %s", debugPodName)
		
		// Send message to client
		ws.WriteMessage(1, []byte("\r\n\x1b[36m♻ Reusing existing debug pod...\x1b[0m\r\n"))
	} else {
		log.Infof("No existing pod found, will create new one: %s", debugPodName)
	}

	// Define the debug pod
	privileged := true
	hostPID := true
	hostNetwork := true
	hostIPC := true
	
	debugPod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      debugPodName,
			Namespace: debugNamespace,
			Labels: map[string]string{
				"app":                       "node-shell-debug",
				"kubelens.io/debug-pod":     "true",
				"kubelens.io/node":          nodeName,
			},
		},
		Spec: corev1.PodSpec{
			ServiceAccountName: "kubelens",  // Use kubelens ServiceAccount
			AutomountServiceAccountToken: func() *bool { b := false; return &b }(), // Disable auto-mount
			NodeName:           nodeName,
			HostPID:            hostPID,
			HostNetwork:        hostNetwork,
			HostIPC:            hostIPC,
			RestartPolicy:      corev1.RestartPolicyNever,
			Containers: []corev1.Container{
				{
					Name:    "shell",
					Image:   "kubelensai/kubelens-shell:latest",
					Command: []string{"/bin/zsh"},
					Args:    []string{"-c", "sleep 3600"},
					SecurityContext: &corev1.SecurityContext{
						Privileged: &privileged,
					},
					VolumeMounts: []corev1.VolumeMount{
						{
							Name:      "host-root",
							MountPath: "/host",
						},
						{
							Name:      "kube-api-access",
							MountPath: "/var/run/secrets/kubernetes.io/serviceaccount",
							ReadOnly:  true,
						},
					},
				},
			},
			Volumes: []corev1.Volume{
				{
					Name: "host-root",
					VolumeSource: corev1.VolumeSource{
						HostPath: &corev1.HostPathVolumeSource{
							Path: "/",
						},
					},
				},
				{
					Name: "kube-api-access",
					VolumeSource: corev1.VolumeSource{
						Projected: &corev1.ProjectedVolumeSource{
							DefaultMode: func() *int32 { mode := int32(0644); return &mode }(),
							Sources: []corev1.VolumeProjection{
								{
									ServiceAccountToken: &corev1.ServiceAccountTokenProjection{
										ExpirationSeconds: func() *int64 { exp := int64(3600); return &exp }(),
										Path:              "token",
									},
								},
								{
									ConfigMap: &corev1.ConfigMapProjection{
										LocalObjectReference: corev1.LocalObjectReference{
											Name: "kube-root-ca.crt",
										},
										Items: []corev1.KeyToPath{
											{
												Key:  "ca.crt",
												Path: "ca.crt",
											},
										},
									},
								},
								{
									DownwardAPI: &corev1.DownwardAPIProjection{
										Items: []corev1.DownwardAPIVolumeFile{
											{
												Path: "namespace",
												FieldRef: &corev1.ObjectFieldSelector{
													APIVersion: "v1",
													FieldPath:  "metadata.namespace",
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
			Tolerations: []corev1.Toleration{
				{
					Operator: corev1.TolerationOpExists,
				},
			},
		},
	}

	// Create the debug pod only if it doesn't exist
	if podToUse == nil {
		log.Infof("Creating debug pod: %s on node: %s", debugPodName, nodeName)
		ws.WriteMessage(1, []byte("\r\n\x1b[33m⏳ Creating debug pod on node...\x1b[0m\r\n"))
		
		createdPod, err := client.CoreV1().Pods(debugNamespace).Create(ctx, debugPod, metav1.CreateOptions{})
		if err != nil {
			log.Errorf("Failed to create debug pod: %v", err)
			errorMsg := fmt.Sprintf("\r\n\x1b[31m✗ Failed to create debug pod: %v\x1b[0m\r\n", err)
			ws.WriteMessage(1, []byte(errorMsg))
			return
		}

		log.Infof("Debug pod created: %s", createdPod.Name)
		podToUse = createdPod

		// Wait for pod to be running
		log.Infof("Waiting for debug pod to be ready...")

		podReady := false
		for i := 0; i < 60; i++ {
			pod, err := client.CoreV1().Pods(debugNamespace).Get(ctx, debugPodName, metav1.GetOptions{})
			if err != nil {
				log.Errorf("Failed to get pod status: %v", err)
				break
			}

			if pod.Status.Phase == corev1.PodRunning {
				allReady := true
				for _, containerStatus := range pod.Status.ContainerStatuses {
					if !containerStatus.Ready {
						allReady = false
						break
					}
				}
				if allReady {
					log.Infof("Debug pod is running and ready")
					ws.WriteMessage(1, []byte("\r\n\x1b[32m✓ Debug pod ready\x1b[0m\r\n"))
					podReady = true
					podToUse = pod
					break
				}
			}

			if pod.Status.Phase == corev1.PodFailed {
				log.Errorf("Debug pod failed: %v", pod.Status.Reason)
				errorMsg := fmt.Sprintf("\r\n\x1b[31m✗ Debug pod failed: %s\x1b[0m\r\n", pod.Status.Reason)
				ws.WriteMessage(1, []byte(errorMsg))
				client.CoreV1().Pods(debugNamespace).Delete(ctx, debugPodName, metav1.DeleteOptions{})
				return
			}

			if i%5 == 0 && i > 0 {
				ws.WriteMessage(1, []byte("."))
			}

			time.Sleep(1 * time.Second)
		}

		if !podReady {
			log.Errorf("Debug pod did not become ready in time")
			errorMsg := "\r\n\x1b[31m✗ Timeout waiting for debug pod to be ready\x1b[0m\r\n"
			ws.WriteMessage(1, []byte(errorMsg))
			client.CoreV1().Pods(debugNamespace).Delete(ctx, debugPodName, metav1.DeleteOptions{})
			return
		}
	}

	// Execute shell in the debug pod
	// Use -l flag for login shell to properly load shell configuration
	command := []string{shellPath, "-l"}

	log.Infof("Creating executor with command: %v", command)

	req := client.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(debugPodName).
		Namespace(debugNamespace).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: "shell",
			Command:   command,
			Stdin:     true,
			Stdout:    true,
			Stderr:    true,
			TTY:       true,
		}, scheme.ParameterCodec)

	executor, execErr := remotecommand.NewSPDYExecutor(restConfig, "POST", req.URL())
	if execErr != nil {
		log.Errorf("Failed to create executor: %v", execErr)
		errorMsg := fmt.Sprintf("\r\n\x1b[31m✗ Failed to create executor: %v\x1b[0m\r\n", execErr)
		ws.WriteMessage(1, []byte(errorMsg))
		client.CoreV1().Pods(debugNamespace).Delete(ctx, debugPodName, metav1.DeleteOptions{})
		return
	}

	log.Infof("Executor created successfully")

	// Create pipes for stdin/stdout/stderr
	stdin := &wsReader{conn: ws}
	stdout := &wsWriter{conn: ws}
	stderr := &wsWriter{conn: ws}

	log.Infof("Starting shell execution...")
	ws.WriteMessage(1, []byte("\r\n\x1b[32m✓ Connected to node shell\x1b[0m\r\n\r\n"))

	// Execute shell
	err = executor.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdin:  stdin,
		Stdout: stdout,
		Stderr: stderr,
		Tty:    true,
	})

	// Clean up debug pod after shell exits (always delete when connection closes)
	log.Infof("Shell session ended, cleaning up debug pod...")
	deleteErr := client.CoreV1().Pods(debugNamespace).Delete(ctx, debugPodName, metav1.DeleteOptions{})
	if deleteErr != nil {
		log.Warnf("Failed to delete debug pod: %v", deleteErr)
	} else {
		log.Infof("Debug pod deleted successfully")
	}

	if err != nil {
		log.Errorf("Shell execution error: %v", err)
	} else {
		log.Infof("Shell execution completed successfully")
	}
}

// NodeDrainInteractive handles WebSocket connection for interactive node drain via kubectl
func (h *Handler) NodeDrainInteractive(c *gin.Context) {
	clusterName := c.Param("name")
	nodeName := c.Param("node")
	
	// Get drain options from query parameters
	force := c.DefaultQuery("force", "true")
	gracePeriod := c.DefaultQuery("grace-period", "300")
	deleteLocalData := c.DefaultQuery("delete-local-data", "true")
	ignoreErrors := c.DefaultQuery("ignore-errors", "false")

	log.Infof("Node drain request: cluster=%s, node=%s, force=%s, gracePeriod=%s", clusterName, nodeName, force, gracePeriod)

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		log.Errorf("Failed to get client: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	restConfig, err := h.clusterManager.GetConfig(clusterName)
	if err != nil {
		log.Errorf("Failed to get config: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get cluster config"})
		return
	}


	ctx := context.Background()

	// Get node to verify it exists
	node, err := client.CoreV1().Nodes().Get(ctx, nodeName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get node: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
		return
	}

	log.Infof("Node found: %s", node.Name)

	// Upgrade HTTP connection to WebSocket
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Errorf("Failed to upgrade WebSocket: %v", err)
		return
	}
	defer ws.Close()

	log.Infof("WebSocket upgraded successfully")

	// Create a unique debug pod name per session
	randomSuffix := fmt.Sprintf("%d", rand.Intn(100000))
	debugPodName := fmt.Sprintf("node-drain-%s-%s", nodeName, randomSuffix)
	debugNamespace := "kube-system"  // Use kube-system namespace
	
	log.Infof("Creating unique debug pod for drain: %s in namespace %s", debugPodName, debugNamespace)
	
	// Clean up old drain pods for this node (background)
	go func() {
		labelSelector := fmt.Sprintf("kubelens.io/drain-pod=true,kubelens.io/target-node=%s", nodeName)
		oldPods, err := client.CoreV1().Pods(debugNamespace).List(context.Background(), metav1.ListOptions{
			LabelSelector: labelSelector,
		})
		if err == nil && len(oldPods.Items) > 0 {
			log.Infof("Found %d old drain pods for node %s, cleaning up...", len(oldPods.Items), nodeName)
			for _, pod := range oldPods.Items {
				age := time.Since(pod.CreationTimestamp.Time)
				if age > 5*time.Minute || pod.DeletionTimestamp != nil {
					log.Infof("Deleting old drain pod: %s (age: %v)", pod.Name, age)
					client.CoreV1().Pods(debugNamespace).Delete(context.Background(), pod.Name, metav1.DeleteOptions{})
				}
			}
		}
	}()

	// Define the debug pod with kubectl
	privileged := true
	
	debugPod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      debugPodName,
			Namespace: debugNamespace,
			Labels: map[string]string{
				"app":                       "node-drain-debug",
				"kubelens.io/drain-pod":     "true",
				"kubelens.io/target-node":   nodeName,
			},
		},
		Spec: corev1.PodSpec{
			ServiceAccountName: "kubelens",  // Use kubelens ServiceAccount
			AutomountServiceAccountToken: func() *bool { b := false; return &b }(), // Disable auto-mount
			RestartPolicy:      corev1.RestartPolicyNever,
			// Use anti-affinity to avoid scheduling on the node being drained
			Affinity: &corev1.Affinity{
				NodeAffinity: &corev1.NodeAffinity{
					RequiredDuringSchedulingIgnoredDuringExecution: &corev1.NodeSelector{
						NodeSelectorTerms: []corev1.NodeSelectorTerm{
							{
								MatchExpressions: []corev1.NodeSelectorRequirement{
									{
										Key:      "kubernetes.io/hostname",
										Operator: corev1.NodeSelectorOpNotIn,
										Values:   []string{nodeName},
									},
								},
							},
						},
					},
				},
			},
			Containers: []corev1.Container{
				{
					Name:    "kubectl",
					Image:   "kubelensai/kubelens-shell:latest",
					Command: []string{"/bin/zsh"},
					Args:    []string{"-c", "sleep 3600"},
					Resources: corev1.ResourceRequirements{
						Requests: corev1.ResourceList{
							corev1.ResourceCPU:    resource.MustParse("50m"),
							corev1.ResourceMemory: resource.MustParse("64Mi"),
						},
						Limits: corev1.ResourceList{
							corev1.ResourceCPU:    resource.MustParse("100m"),
							corev1.ResourceMemory: resource.MustParse("128Mi"),
						},
					},
					SecurityContext: &corev1.SecurityContext{
						Privileged: &privileged,
					},
					VolumeMounts: []corev1.VolumeMount{
						{
							Name:      "kube-api-access",
							MountPath: "/var/run/secrets/kubernetes.io/serviceaccount",
							ReadOnly:  true,
						},
					},
				},
			},
			Volumes: []corev1.Volume{
				{
					Name: "kube-api-access",
					VolumeSource: corev1.VolumeSource{
						Projected: &corev1.ProjectedVolumeSource{
							DefaultMode: func() *int32 { mode := int32(0644); return &mode }(),
							Sources: []corev1.VolumeProjection{
								{
									ServiceAccountToken: &corev1.ServiceAccountTokenProjection{
										ExpirationSeconds: func() *int64 { exp := int64(3600); return &exp }(),
										Path:              "token",
									},
								},
								{
									ConfigMap: &corev1.ConfigMapProjection{
										LocalObjectReference: corev1.LocalObjectReference{
											Name: "kube-root-ca.crt",
										},
										Items: []corev1.KeyToPath{
											{
												Key:  "ca.crt",
												Path: "ca.crt",
											},
										},
									},
								},
								{
									DownwardAPI: &corev1.DownwardAPIProjection{
										Items: []corev1.DownwardAPIVolumeFile{
											{
												Path: "namespace",
												FieldRef: &corev1.ObjectFieldSelector{
													APIVersion: "v1",
													FieldPath:  "metadata.namespace",
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
			Tolerations: []corev1.Toleration{
				{
					Operator: corev1.TolerationOpExists,
				},
			},
		},
	}

	// Create the debug pod (will be scheduled on a different node)
	log.Infof("Creating debug pod: %s to drain target node: %s", debugPodName, nodeName)
	createdPod, err := client.CoreV1().Pods(debugNamespace).Create(ctx, debugPod, metav1.CreateOptions{})
	if err != nil {
		log.Errorf("Failed to create debug pod: %v", err)
		errorMsg := fmt.Sprintf("\r\n\x1b[31m✗ Failed to create debug pod: %v\x1b[0m\r\n", err)
		ws.WriteMessage(1, []byte(errorMsg))
		return
	}

	log.Infof("Debug pod created: %s", createdPod.Name)

	// Wait for pod to be running
	log.Infof("Waiting for debug pod to be ready...")
	ws.WriteMessage(1, []byte("\r\n\x1b[33m⏳ Preparing drain environment...\x1b[0m\r\n"))

	podReady := false
	for i := 0; i < 60; i++ {
		pod, err := client.CoreV1().Pods(debugNamespace).Get(ctx, debugPodName, metav1.GetOptions{})
		if err != nil {
			log.Errorf("Failed to get pod status: %v", err)
			break
		}

		if pod.Status.Phase == corev1.PodRunning {
			allReady := true
			for _, containerStatus := range pod.Status.ContainerStatuses {
				if !containerStatus.Ready {
					allReady = false
					break
				}
			}
			if allReady {
				log.Infof("Debug pod is running and ready")
				ws.WriteMessage(1, []byte("\r\n\x1b[32m✓ Environment ready\x1b[0m\r\n"))
				podReady = true
				break
			}
		}

		if pod.Status.Phase == corev1.PodFailed {
			log.Errorf("Debug pod failed: %v", pod.Status.Reason)
			errorMsg := fmt.Sprintf("\r\n\x1b[31m✗ Debug pod failed: %s\x1b[0m\r\n", pod.Status.Reason)
			ws.WriteMessage(1, []byte(errorMsg))
			client.CoreV1().Pods(debugNamespace).Delete(ctx, debugPodName, metav1.DeleteOptions{})
			return
		}

		if i%5 == 0 && i > 0 {
			ws.WriteMessage(1, []byte("."))
		}

		time.Sleep(1 * time.Second)
	}

	if !podReady {
		log.Errorf("Debug pod did not become ready in time")
		errorMsg := "\r\n\x1b[31m✗ Timeout waiting for debug pod to be ready\x1b[0m\r\n"
		ws.WriteMessage(1, []byte(errorMsg))
		client.CoreV1().Pods(debugNamespace).Delete(ctx, debugPodName, metav1.DeleteOptions{})
		return
	}

	// Build kubectl drain command
	drainCmd := fmt.Sprintf("kubectl drain %s --force=%s --grace-period=%s --delete-emptydir-data=%s --ignore-daemonsets",
		nodeName, force, gracePeriod, deleteLocalData)
	
	if ignoreErrors == "true" {
		drainCmd += " --disable-eviction"
	}

	log.Infof("Executing drain command: %s", drainCmd)
	ws.WriteMessage(1, []byte(fmt.Sprintf("\r\n\x1b[1;36m🔧 Executing: %s\x1b[0m\r\n\r\n", drainCmd)))

	// Execute kubectl drain command
	command := []string{
		"/bin/zsh",
		"-c",
		drainCmd,
	}

	req := client.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(debugPodName).
		Namespace(debugNamespace).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: "kubectl",
			Command:   command,
			Stdin:     false,
			Stdout:    true,
			Stderr:    true,
			TTY:       true,
		}, scheme.ParameterCodec)

	executor, execErr := remotecommand.NewSPDYExecutor(restConfig, "POST", req.URL())
	if execErr != nil {
		log.Errorf("Failed to create executor: %v", execErr)
		errorMsg := fmt.Sprintf("\r\n\x1b[31m✗ Failed to create executor: %v\x1b[0m\r\n", execErr)
		ws.WriteMessage(1, []byte(errorMsg))
		client.CoreV1().Pods(debugNamespace).Delete(ctx, debugPodName, metav1.DeleteOptions{})
		return
	}

	log.Infof("Executor created successfully")

	// Create pipes for stdout/stderr
	stdout := &wsWriter{conn: ws}
	stderr := &wsWriter{conn: ws}

	log.Infof("Starting drain execution...")

	// Execute drain command
	err = executor.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdin:  nil,
		Stdout: stdout,
		Stderr: stderr,
		Tty:    true,
	})

	// Clean up debug pod after drain completes
	log.Infof("Drain session ended, cleaning up debug pod...")
	deleteErr := client.CoreV1().Pods(debugNamespace).Delete(ctx, debugPodName, metav1.DeleteOptions{})
	if deleteErr != nil {
		log.Warnf("Failed to delete debug pod: %v", deleteErr)
	} else {
		log.Infof("Debug pod deleted successfully")
	}

	if err != nil {
		log.Errorf("Drain execution error: %v", err)
		ws.WriteMessage(1, []byte(fmt.Sprintf("\r\n\r\n\x1b[31m✗ Drain failed: %v\x1b[0m\r\n", err)))
	} else {
		log.Infof("Drain execution completed successfully")
		ws.WriteMessage(1, []byte("\r\n\r\n\x1b[1;32m✓ Node drain completed successfully\x1b[0m\r\n"))
	}
}


