package extension

import (
	"archive/tar"
	"compress/gzip"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/sonnguyen/kubelens/pkg/plugin"
)

func TestStore_Install(t *testing.T) {
	// Setup temp dir
	tempDir, err := os.MkdirTemp("", "store-test")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	store, err := NewStore(tempDir)
	if err != nil {
		t.Fatal(err)
	}

	// Create a dummy package
	pkgPath := filepath.Join(tempDir, "test-ext.tar.gz")
	createTestPackage(t, pkgPath, "test-ext")

	// Install
	ext, err := store.Install(pkgPath)
	if err != nil {
		t.Fatalf("Install failed: %v", err)
	}

	if ext.Manifest.Name != "test-ext" {
		t.Errorf("Expected name test-ext, got %s", ext.Manifest.Name)
	}

	// List
	list, err := store.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 {
		t.Errorf("Expected 1 extension, got %d", len(list))
	}

	// Uninstall
	if err := store.Uninstall("test-ext"); err != nil {
		t.Fatal(err)
	}

	list, err = store.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 0 {
		t.Errorf("Expected 0 extensions, got %d", len(list))
	}
}

func createTestPackage(t *testing.T, path string, name string) {
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	gz := gzip.NewWriter(f)
	defer gz.Close()

	tw := tar.NewWriter(gz)
	defer tw.Close()

	// manifest.json
	manifest := ExtensionManifest{
		Metadata: plugin.Metadata{
			Name:    name,
			Version: "1.0.0",
		},
	}
	manifestBytes, _ := json.Marshal(manifest)
	
	header := &tar.Header{
		Name: "manifest.json",
		Mode: 0644,
		Size: int64(len(manifestBytes)),
	}
	if err := tw.WriteHeader(header); err != nil {
		t.Fatal(err)
	}
	tw.Write(manifestBytes)

	// bin/ (dummy binary)
	binHeader := &tar.Header{
		Name:     "bin/",
		Typeflag: tar.TypeDir,
		Mode:     0755,
	}
	tw.WriteHeader(binHeader)
	
	// Create dummy binary file
	binData := []byte("#!/bin/sh\necho hello")
	fileHeader := &tar.Header{
		Name: "bin/" + name,
		Mode: 0755,
		Size: int64(len(binData)),
	}
	tw.WriteHeader(fileHeader)
	tw.Write(binData)
}
