package dex

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"
)

// ProcessState represents the state of the Dex process
type ProcessState int

const (
	StateStopped ProcessState = iota
	StateStarting
	StateRunning
	StateStopping
	StateError
)

func (s ProcessState) String() string {
	switch s {
	case StateStopped:
		return "stopped"
	case StateStarting:
		return "starting"
	case StateRunning:
		return "running"
	case StateStopping:
		return "stopping"
	case StateError:
		return "error"
	default:
		return "unknown"
	}
}

// LogLevel represents log level
type LogLevel int

const (
	LogDebug LogLevel = iota
	LogInfo
	LogWarn
	LogError
)

// LogEntry represents a log entry from Dex
type LogEntry struct {
	Level     LogLevel
	Message   string
	Timestamp time.Time
	Source    string // "stdout" or "stderr"
}

// LogHandler is a function that handles log entries
type LogHandler func(entry LogEntry)

// ProcessManager manages the Dex subprocess
type ProcessManager struct {
	binaryPath string
	configPath string
	dataDir    string

	cmd       *exec.Cmd
	ctx       context.Context
	cancel    context.CancelFunc
	state     ProcessState
	stateMu   sync.RWMutex
	lastError error

	logHandler LogHandler
	logBuffer  []LogEntry
	logMu      sync.RWMutex
	maxLogSize int

	// Process supervision
	restartCount   int
	maxRestarts    int
	restartDelay   time.Duration
	lastStartTime  time.Time

	// Signals
	doneChan chan struct{}
}

// ProcessConfig holds configuration for the process manager
type ProcessConfig struct {
	BinaryPath   string
	ConfigPath   string
	DataDir      string
	MaxRestarts  int
	RestartDelay time.Duration
	MaxLogSize   int
	LogHandler   LogHandler
}

// NewProcessManager creates a new Dex process manager
func NewProcessManager(cfg ProcessConfig) *ProcessManager {
	if cfg.MaxRestarts == 0 {
		cfg.MaxRestarts = 5
	}
	if cfg.RestartDelay == 0 {
		cfg.RestartDelay = 5 * time.Second
	}
	if cfg.MaxLogSize == 0 {
		cfg.MaxLogSize = 1000
	}

	return &ProcessManager{
		binaryPath:   cfg.BinaryPath,
		configPath:   cfg.ConfigPath,
		dataDir:      cfg.DataDir,
		state:        StateStopped,
		logHandler:   cfg.LogHandler,
		logBuffer:    make([]LogEntry, 0, cfg.MaxLogSize),
		maxLogSize:   cfg.MaxLogSize,
		maxRestarts:  cfg.MaxRestarts,
		restartDelay: cfg.RestartDelay,
		doneChan:     make(chan struct{}),
	}
}

// Start starts the Dex process
func (pm *ProcessManager) Start() error {
	pm.stateMu.Lock()
	if pm.state == StateRunning || pm.state == StateStarting {
		pm.stateMu.Unlock()
		return nil // Already running
	}
	pm.state = StateStarting
	pm.stateMu.Unlock()

	pm.ctx, pm.cancel = context.WithCancel(context.Background())
	pm.doneChan = make(chan struct{})
	pm.restartCount = 0

	go pm.runLoop()

	return nil
}

// runLoop manages the process lifecycle with supervision
func (pm *ProcessManager) runLoop() {
	defer close(pm.doneChan)

	for {
		select {
		case <-pm.ctx.Done():
			pm.setState(StateStopped)
			return
		default:
		}

		// Start the process
		err := pm.startProcess()
		if err != nil {
			pm.logEntry(LogError, fmt.Sprintf("Failed to start Dex: %v", err))
			pm.setError(err)

			// Check if we should restart
			if !pm.shouldRestart() {
				pm.setState(StateError)
				return
			}

			pm.logEntry(LogInfo, fmt.Sprintf("Restarting Dex in %v (attempt %d/%d)",
				pm.restartDelay, pm.restartCount+1, pm.maxRestarts))

			select {
			case <-pm.ctx.Done():
				return
			case <-time.After(pm.restartDelay):
				pm.restartCount++
				continue
			}
		}

		pm.setState(StateRunning)
		pm.lastStartTime = time.Now()

		// Wait for process to exit
		err = pm.cmd.Wait()

		if pm.ctx.Err() != nil {
			// Context cancelled, normal shutdown
			return
		}

		if err != nil {
			pm.logEntry(LogError, fmt.Sprintf("Dex exited with error: %v", err))
			pm.setError(err)
		} else {
			pm.logEntry(LogWarn, "Dex exited unexpectedly")
		}

		// Check if we should restart
		if !pm.shouldRestart() {
			pm.setState(StateError)
			return
		}

		// Reset restart count if process ran for a while
		if time.Since(pm.lastStartTime) > 5*time.Minute {
			pm.restartCount = 0
		}

		pm.logEntry(LogInfo, fmt.Sprintf("Restarting Dex in %v (attempt %d/%d)",
			pm.restartDelay, pm.restartCount+1, pm.maxRestarts))

		select {
		case <-pm.ctx.Done():
			return
		case <-time.After(pm.restartDelay):
			pm.restartCount++
		}
	}
}

// startProcess starts the actual Dex process
func (pm *ProcessManager) startProcess() error {
	// Build command arguments
	args := []string{
		"serve",
		pm.configPath,
	}

	pm.cmd = exec.CommandContext(pm.ctx, pm.binaryPath, args...)
	pm.cmd.Dir = pm.dataDir
	pm.cmd.Env = append(os.Environ(),
		"DEX_CONFIG="+pm.configPath,
	)

	// Set up pipes for stdout/stderr
	stdout, err := pm.cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	stderr, err := pm.cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	// Start the process
	if err := pm.cmd.Start(); err != nil {
		return fmt.Errorf("failed to start process: %w", err)
	}

	pm.logEntry(LogInfo, fmt.Sprintf("Dex started with PID %d", pm.cmd.Process.Pid))

	// Start log forwarders
	go pm.forwardLogs(stdout, "stdout")
	go pm.forwardLogs(stderr, "stderr")

	return nil
}

// Stop stops the Dex process gracefully
func (pm *ProcessManager) Stop() error {
	pm.stateMu.Lock()
	if pm.state == StateStopped || pm.state == StateStopping {
		pm.stateMu.Unlock()
		return nil
	}
	pm.state = StateStopping
	pm.stateMu.Unlock()

	pm.logEntry(LogInfo, "Stopping Dex...")

	// Cancel context to stop runLoop
	if pm.cancel != nil {
		pm.cancel()
	}

	// Send SIGTERM to process
	if pm.cmd != nil && pm.cmd.Process != nil {
		pm.cmd.Process.Signal(syscall.SIGTERM)

		// Wait for graceful shutdown
		done := make(chan struct{})
		go func() {
			pm.cmd.Wait()
			close(done)
		}()

		select {
		case <-done:
			pm.logEntry(LogInfo, "Dex stopped gracefully")
		case <-time.After(10 * time.Second):
			pm.logEntry(LogWarn, "Dex did not stop gracefully, sending SIGKILL")
			pm.cmd.Process.Kill()
		}
	}

	// Wait for runLoop to finish
	select {
	case <-pm.doneChan:
	case <-time.After(15 * time.Second):
		pm.logEntry(LogError, "Timeout waiting for runLoop to finish")
	}

	pm.setState(StateStopped)
	return nil
}

// Restart restarts the Dex process
func (pm *ProcessManager) Restart() error {
	pm.logEntry(LogInfo, "Restarting Dex...")
	if err := pm.Stop(); err != nil {
		return err
	}
	return pm.Start()
}

// GetState returns the current process state
func (pm *ProcessManager) GetState() ProcessState {
	pm.stateMu.RLock()
	defer pm.stateMu.RUnlock()
	return pm.state
}

// GetLastError returns the last error
func (pm *ProcessManager) GetLastError() error {
	pm.stateMu.RLock()
	defer pm.stateMu.RUnlock()
	return pm.lastError
}

// GetLogs returns the log buffer
func (pm *ProcessManager) GetLogs(count int) []LogEntry {
	pm.logMu.RLock()
	defer pm.logMu.RUnlock()

	if count <= 0 || count > len(pm.logBuffer) {
		count = len(pm.logBuffer)
	}

	start := len(pm.logBuffer) - count
	result := make([]LogEntry, count)
	copy(result, pm.logBuffer[start:])
	return result
}

// GetPID returns the process ID if running
func (pm *ProcessManager) GetPID() int {
	if pm.cmd != nil && pm.cmd.Process != nil {
		return pm.cmd.Process.Pid
	}
	return 0
}

// IsHealthy checks if the process is healthy
func (pm *ProcessManager) IsHealthy() bool {
	state := pm.GetState()
	return state == StateRunning
}

// Internal helpers

func (pm *ProcessManager) setState(state ProcessState) {
	pm.stateMu.Lock()
	pm.state = state
	pm.stateMu.Unlock()
}

func (pm *ProcessManager) setError(err error) {
	pm.stateMu.Lock()
	pm.lastError = err
	pm.stateMu.Unlock()
}

func (pm *ProcessManager) shouldRestart() bool {
	return pm.restartCount < pm.maxRestarts
}

func (pm *ProcessManager) forwardLogs(reader io.Reader, source string) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := scanner.Text()
		level := pm.detectLogLevel(line)
		pm.logEntry(level, line)
	}
}

func (pm *ProcessManager) detectLogLevel(line string) LogLevel {
	// Simple heuristic for log level detection
	switch {
	case contains(line, "error", "ERROR", "fatal", "FATAL"):
		return LogError
	case contains(line, "warn", "WARN"):
		return LogWarn
	case contains(line, "debug", "DEBUG"):
		return LogDebug
	default:
		return LogInfo
	}
}

func (pm *ProcessManager) logEntry(level LogLevel, message string) {
	entry := LogEntry{
		Level:     level,
		Message:   message,
		Timestamp: time.Now(),
	}

	pm.logMu.Lock()
	pm.logBuffer = append(pm.logBuffer, entry)
	if len(pm.logBuffer) > pm.maxLogSize {
		pm.logBuffer = pm.logBuffer[len(pm.logBuffer)-pm.maxLogSize:]
	}
	pm.logMu.Unlock()

	if pm.logHandler != nil {
		pm.logHandler(entry)
	}
}

func contains(s string, substrs ...string) bool {
	for _, sub := range substrs {
		if len(s) >= len(sub) {
			for i := 0; i <= len(s)-len(sub); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
		}
	}
	return false
}
