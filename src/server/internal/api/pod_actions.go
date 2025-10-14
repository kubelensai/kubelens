package api

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	log "github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

// UpdatePod updates a pod
func (h *Handler) UpdatePod(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var pod corev1.Pod
	if err := c.ShouldBindJSON(&pod); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := context.Background()
	updatedPod, err := client.CoreV1().Pods(namespace).Update(ctx, &pod, metav1.UpdateOptions{})
	if err != nil {
		log.Errorf("Failed to update pod: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updatedPod)
}

// PodShell handles WebSocket connection for pod shell access
func (h *Handler) PodShell(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	podName := c.Param("pod")
	container := c.DefaultQuery("container", "")
	shellPath := c.DefaultQuery("shell", "/bin/sh") // Get requested shell from query param

	log.Infof("Shell request: cluster=%s, namespace=%s, pod=%s, container=%s, shell=%s", clusterName, namespace, podName, container, shellPath)

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

	// Get pod to determine container
	pod, err := client.CoreV1().Pods(namespace).Get(ctx, podName, metav1.GetOptions{})
	if err != nil {
		log.Errorf("Failed to get pod: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Pod not found"})
		return
	}

	// If no container specified, use first container
	if container == "" && len(pod.Spec.Containers) > 0 {
		container = pod.Spec.Containers[0].Name
	}

	log.Infof("Using container: %s", container)

	// Upgrade HTTP connection to WebSocket
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Errorf("Failed to upgrade WebSocket: %v", err)
		return
	}
	defer ws.Close()

	log.Infof("WebSocket upgraded successfully")

	// Use ONLY the requested shell - no fallback
	log.Infof("Creating executor with requested shell: %s", shellPath)

	// Create exec request with requested shell
	req := client.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(namespace).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: container,
			Command:   []string{shellPath},
			Stdin:     true,
			Stdout:    true,
			Stderr:    true,
			TTY:       true,
		}, scheme.ParameterCodec)

	executor, execErr := remotecommand.NewSPDYExecutor(restConfig, "POST", req.URL())
	if execErr != nil {
		log.Errorf("Failed to create executor: %v", execErr)
		ws.Close()
		return
	}

	log.Infof("Executor created successfully with shell: %s", shellPath)

	// Create pipes for stdin/stdout/stderr
	stdin := &wsReader{conn: ws}
	stdout := &wsWriter{conn: ws}
	stderr := &wsWriter{conn: ws}

	log.Infof("Starting shell execution...")

	// Execute shell
	err = executor.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdin:  stdin,
		Stdout: stdout,
		Stderr: stderr,
		Tty:    true,
	})

	if err != nil {
		log.Errorf("Shell execution error: %v", err)
		
		// Check if error is "no such file or directory" - shell not found
		errorStr := err.Error()
		if strings.Contains(errorStr, "no such file or directory") || strings.Contains(errorStr, "executable file not found") {
			errorMsg := "\r\n\x1b[31m╔════════════════════════════════════════════════════════════╗\x1b[0m\r\n"
			errorMsg += fmt.Sprintf("\x1b[31m║  ✗ ERROR: Shell '%s' not found in container               ║\x1b[0m\r\n", shellPath)
			errorMsg += "\x1b[31m╚════════════════════════════════════════════════════════════╝\x1b[0m\r\n\r\n"
			errorMsg += fmt.Sprintf("Container: \x1b[36m%s\x1b[0m\r\n", container)
			errorMsg += fmt.Sprintf("Pod: \x1b[36m%s\x1b[0m\r\n", podName)
			errorMsg += fmt.Sprintf("Namespace: \x1b[36m%s\x1b[0m\r\n", namespace)
			errorMsg += fmt.Sprintf("Requested shell: \x1b[36m%s\x1b[0m\r\n\r\n", shellPath)
			errorMsg += "\x1b[33mSuggestions:\x1b[0m\r\n"
			errorMsg += "  • Try a different shell from the dropdown (sh, bash, ash, zsh, dash)\r\n"
			errorMsg += "  • Select a different container in this pod\r\n"
			errorMsg += "  • Use kubectl debug to attach an ephemeral container:\r\n"
			errorMsg += fmt.Sprintf("    \x1b[90mkubectl debug -n %s %s -it --image=busybox\x1b[0m\r\n", namespace, podName)
			ws.WriteMessage(websocket.TextMessage, []byte(errorMsg))
		} else {
			// Generic error
			errorMsg := "\r\n\x1b[31m╔════════════════════════════════════════════════════════════╗\x1b[0m\r\n"
			errorMsg += "\x1b[31m║  ✗ Shell execution error                                   ║\x1b[0m\r\n"
			errorMsg += "\x1b[31m╚════════════════════════════════════════════════════════════╝\x1b[0m\r\n\r\n"
			errorMsg += fmt.Sprintf("\x1b[33mError:\x1b[0m %v\r\n\r\n", err)
			errorMsg += "The shell connection was interrupted or failed.\r\n"
			errorMsg += "Please check the pod status and try again.\r\n"
			ws.WriteMessage(websocket.TextMessage, []byte(errorMsg))
		}
	} else {
		log.Infof("Shell execution completed successfully")
	}
}

// wsReader implements io.Reader for WebSocket
type wsReader struct {
	conn *websocket.Conn
}

func (r *wsReader) Read(p []byte) (int, error) {
	_, message, err := r.conn.ReadMessage()
	if err != nil {
		log.Errorf("wsReader error: %v", err)
		return 0, err
	}
	log.Debugf("📥 Received from client: %q (len=%d)", string(message), len(message))
	n := copy(p, message)
	log.Debugf("📤 Copied to buffer: %d bytes", n)
	return n, nil
}

// wsWriter implements io.Writer for WebSocket
type wsWriter struct {
	conn *websocket.Conn
}

func (w *wsWriter) Write(p []byte) (int, error) {
	log.Debugf("📤 Sending to client: %q (len=%d)", string(p), len(p))
	err := w.conn.WriteMessage(websocket.TextMessage, p)
	if err != nil {
		log.Errorf("wsWriter error: %v", err)
		return 0, err
	}
	log.Debugf("✅ Sent successfully: %d bytes", len(p))
	return len(p), nil
}

var _ io.Reader = &wsReader{}
var _ io.Writer = &wsWriter{}

