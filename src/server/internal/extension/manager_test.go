package extension

import (
	"os"
	"testing"

	"github.com/sonnguyen/kubelens/internal/audit"
	"github.com/sonnguyen/kubelens/internal/db"
)

func TestManager_Lifecycle(t *testing.T) {
	// Setup temp dir
	tempDir, err := os.MkdirTemp("", "manager-test")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	// Mock DB and Logger (simplified)
	// In a real test, we would need a proper DB connection or interface mock
	// Here we just test initialization
	
	// Create a dummy DB (not connected)
	// This might panic if Manager uses DB in NewManager without checking
	// But NewManager only stores the reference
	database := &db.DB{}
	auditLogger := &audit.Logger{}

	manager, err := NewManager(tempDir, database, auditLogger)
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
