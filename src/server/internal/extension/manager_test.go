package extension

import (
	"os"
	"testing"

	"github.com/sonnguyen/kubelens/internal/audit"
)

func TestManager_Lifecycle(t *testing.T) {
	// Setup temp dir
	tempDir, err := os.MkdirTemp("", "manager-test")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	// Pass nil for database since we don't have a real DB connection
	// NewManager handles nil database gracefully by skipping encryption key initialization
	auditLogger := &audit.Logger{}

	manager, err := NewManager(tempDir, nil, auditLogger)
	if err != nil {
		t.Fatalf("Failed to create manager: %v", err)
	}

	if manager == nil {
		t.Fatal("Manager is nil")
	}

	// Test listing empty extensions
	exts := manager.ListExtensions()
	if len(exts) != 0 {
		t.Errorf("Expected 0 extensions, got %d", len(exts))
	}
}
