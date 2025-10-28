package api

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"

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
	EnableCompression: false, // Disable compression to avoid reserved bits error with long log lines
	ReadBufferSize:    1024 * 64, // 64KB read buffer
	WriteBufferSize:   1024 * 64, // 64KB write buffer
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

// PodLogsStream handles WebSocket connection for real-time log streaming
func (h *Handler) PodLogsStream(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	podName := c.Param("pod")
	container := c.Query("container")
	tailLines := c.DefaultQuery("tailLines", "100")
	follow := c.DefaultQuery("follow", "true")

	log.Infof("Log stream request: cluster=%s, namespace=%s, pod=%s, container=%s", clusterName, namespace, podName, container)

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		log.Errorf("Failed to get client: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Upgrade HTTP connection to WebSocket
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Errorf("Failed to upgrade WebSocket: %v", err)
		return
	}
	defer ws.Close()

	log.Infof("WebSocket upgraded successfully for log streaming")

	// Build log options
	logOptions := &corev1.PodLogOptions{
		Follow: follow == "true",
	}
	
	if container != "" {
		logOptions.Container = container
	}
	
	if tailLines != "" {
		if lines, err := strconv.ParseInt(tailLines, 10, 64); err == nil {
			logOptions.TailLines = &lines
		}
	}

	ctx := context.Background()

	// Get logs stream
	req := client.CoreV1().Pods(namespace).GetLogs(podName, logOptions)
	stream, err := req.Stream(ctx)
	if err != nil {
		log.Errorf("Failed to get log stream: %v", err)
		ws.WriteJSON(map[string]string{"error": err.Error()})
		return
	}
	defer stream.Close()

	log.Infof("Log stream started successfully")

	// Stream logs to WebSocket
	buf := make([]byte, 4096)
	for {
		n, err := stream.Read(buf)
		if n > 0 {
			// Send log chunk to WebSocket
			if err := ws.WriteMessage(websocket.TextMessage, buf[:n]); err != nil {
				log.Errorf("Failed to write to WebSocket: %v", err)
				return
			}
		}
		
		if err != nil {
			if err == io.EOF {
				log.Infof("Log stream ended (EOF)")
				return
			}
			log.Errorf("Error reading log stream: %v", err)
			return
		}
	}
}

// MultiPodLogsStream handles WebSocket connection for real-time log streaming from multiple pods
func (h *Handler) MultiPodLogsStream(c *gin.Context) {
	clusterName := c.Param("name")
	namespace := c.Param("namespace")
	pods := c.QueryArray("pods")
	container := c.Query("container")
	tailLines := c.DefaultQuery("tailLines", "100")
	timestamps := c.Query("timestamps") == "true"

	log.Infof("Multi-pod log stream request: cluster=%s, namespace=%s, pods=%v, timestamps=%v", clusterName, namespace, pods, timestamps)

	if len(pods) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No pods specified"})
		return
	}

	client, err := h.clusterManager.GetClient(clusterName)
	if err != nil {
		log.Errorf("Failed to get client: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Upgrade HTTP connection to WebSocket
	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Errorf("Failed to upgrade WebSocket: %v", err)
		return
	}
	defer ws.Close()

	log.Infof("WebSocket upgraded successfully for multi-pod log streaming")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Mutex to synchronize WebSocket writes from multiple goroutines
	var wsMutex sync.Mutex

	// Stream logs from all pods concurrently
	for _, podName := range pods {
		go func(pod string) {
			// Build log options
			logOptions := &corev1.PodLogOptions{
				Follow:     true,
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

			// Get logs stream
			req := client.CoreV1().Pods(namespace).GetLogs(pod, logOptions)
			stream, err := req.Stream(ctx)
			if err != nil {
				log.Errorf("Failed to get log stream for pod %s: %v", pod, err)
				wsMutex.Lock()
				ws.WriteJSON(map[string]string{
					"podName": pod,
					"error":   err.Error(),
				})
				wsMutex.Unlock()
				return
			}
			defer stream.Close()

		log.Infof("Log stream started for pod: %s", pod)

		// Stream logs to WebSocket with pod name prefix
		// Use bufio.Scanner to read line by line
		scanner := bufio.NewScanner(stream)
		for {
			select {
			case <-ctx.Done():
				return
			default:
				if scanner.Scan() {
					logLine := scanner.Text()
					// Prefix each log line with pod name
					prefixedLog := fmt.Sprintf("[%s] %s\n", pod, logLine)
					
					// Send log line to WebSocket with mutex protection
					wsMutex.Lock()
					err := ws.WriteMessage(websocket.TextMessage, []byte(prefixedLog))
					wsMutex.Unlock()
					
					if err != nil {
						log.Errorf("Failed to write to WebSocket: %v", err)
						return
					}
				} else {
					// Check for errors
					if err := scanner.Err(); err != nil {
						log.Errorf("Error reading log stream for pod %s: %v", pod, err)
					} else {
						log.Infof("Log stream ended for pod %s (EOF)", pod)
					}
					return
				}
			}
		}
		}(podName)
	}

	// Keep connection alive until client disconnects
	for {
		_, _, err := ws.ReadMessage()
		if err != nil {
			log.Infof("WebSocket closed: %v", err)
			cancel()
			return
		}
	}
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

