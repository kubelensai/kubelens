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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
)

// NodeShell handles WebSocket connection for node shell access via a debug pod
func (h *Handler) NodeShell(c *gin.Context) {
	clusterName := c.Param("name")
	nodeName := c.Param("node")
	shellPath := c.DefaultQuery("shell", "/bin/sh")

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

	// Create a unique debug pod name per session to avoid conflicts
	// Format: node-shell-<nodename>-<random-suffix>
	randomSuffix := fmt.Sprintf("%d", rand.Intn(100000))
	debugPodName := fmt.Sprintf("node-shell-%s-%s", nodeName, randomSuffix)
	debugNamespace := "default" // Use default namespace for debug pods
	
	log.Infof("Creating unique debug pod: %s", debugPodName)
	
	// Clean up old debug pods for this node (best effort, don't fail if cleanup fails)
	go func() {
		labelSelector := fmt.Sprintf("kubelens.io/debug-pod=true,kubelens.io/node=%s", nodeName)
		oldPods, err := client.CoreV1().Pods(debugNamespace).List(context.Background(), metav1.ListOptions{
			LabelSelector: labelSelector,
		})
		if err == nil && len(oldPods.Items) > 0 {
			log.Infof("Found %d old debug pods for node %s, cleaning up...", len(oldPods.Items), nodeName)
			for _, pod := range oldPods.Items {
				// Delete pods that are older than 5 minutes or already terminating
				age := time.Since(pod.CreationTimestamp.Time)
				if age > 5*time.Minute || pod.DeletionTimestamp != nil {
					log.Infof("Deleting old debug pod: %s (age: %v)", pod.Name, age)
					client.CoreV1().Pods(debugNamespace).Delete(context.Background(), pod.Name, metav1.DeleteOptions{})
				}
			}
		}
	}()

	// Define the debug pod
	// Use nicolaka/netshoot which has all debugging tools including nsenter
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
			NodeName:      nodeName,
			HostPID:       hostPID,
			HostNetwork:   hostNetwork,
			HostIPC:       hostIPC,
			RestartPolicy: corev1.RestartPolicyNever,
			Containers: []corev1.Container{
				{
					Name:    "shell",
					Image:   "nicolaka/netshoot:latest", // Debug image with nsenter and other tools
					Command: []string{"/bin/bash"},
					Args:    []string{"-c", "sleep 3600"}, // Keep container running
					SecurityContext: &corev1.SecurityContext{
						Privileged: &privileged,
					},
					VolumeMounts: []corev1.VolumeMount{
						{
							Name:      "host-root",
							MountPath: "/host",
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
			},
			Tolerations: []corev1.Toleration{
				{
					Operator: corev1.TolerationOpExists, // Tolerate all taints
				},
			},
		},
	}

	// Create the debug pod
	log.Infof("Creating debug pod: %s on node: %s", debugPodName, nodeName)
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
	ws.WriteMessage(1, []byte("\r\n\x1b[33m⏳ Creating debug pod on node...\x1b[0m\r\n"))

	// Poll for pod status
	maxAttempts := 60 // Increased timeout for image pull
	podReady := false
	for i := 0; i < maxAttempts; i++ {
		pod, err := client.CoreV1().Pods(debugNamespace).Get(ctx, debugPodName, metav1.GetOptions{})
		if err != nil {
			log.Errorf("Failed to get pod status: %v", err)
			break
		}

		// Check if all containers are ready
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
				break
			}
		}

		if pod.Status.Phase == corev1.PodFailed {
			log.Errorf("Debug pod failed: %v", pod.Status.Reason)
			errorMsg := fmt.Sprintf("\r\n\x1b[31m✗ Debug pod failed: %s\x1b[0m\r\n", pod.Status.Reason)
			ws.WriteMessage(1, []byte(errorMsg))
			// Clean up
			client.CoreV1().Pods(debugNamespace).Delete(ctx, debugPodName, metav1.DeleteOptions{})
			return
		}

		// Show progress
		if i%5 == 0 && i > 0 {
			ws.WriteMessage(1, []byte("."))
		}

		// Wait before next check
		time.Sleep(1 * time.Second)
	}

	if !podReady {
		log.Errorf("Debug pod did not become ready in time")
		errorMsg := "\r\n\x1b[31m✗ Timeout waiting for debug pod to be ready\x1b[0m\r\n"
		ws.WriteMessage(1, []byte(errorMsg))
		// Clean up
		client.CoreV1().Pods(debugNamespace).Delete(ctx, debugPodName, metav1.DeleteOptions{})
		return
	}

	// Execute shell in the debug pod with chroot to access node filesystem
	// Use nsenter to enter node's namespaces
	command := []string{
		"nsenter",
		"--target", "1",
		"--mount",
		"--uts",
		"--ipc",
		"--net",
		"--pid",
		"--",
		shellPath,
	}

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
		// Clean up
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

	// Clean up debug pod after shell exits
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

