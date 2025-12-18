package extension

import (
	"archive/tar"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"

	log "github.com/sirupsen/logrus"
	"github.com/sonnguyen/kubelens/pkg/plugin"
)

// Store manages extension files on disk
type Store struct {
	rootDir string
}

// NewStore creates a new extension store
func NewStore(rootDir string) (*Store, error) {
	if err := os.MkdirAll(rootDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create extension root directory: %w", err)
	}
	return &Store{rootDir: rootDir}, nil
}

// ExtensionManifest represents the manifest.json file
type ExtensionManifest struct {
	plugin.Metadata
}

// InstalledExtension represents an installed extension on disk
type InstalledExtension struct {
	Manifest ExtensionManifest
	Dir      string
	BinPath  string
	UIPath   string
}

// List returns all installed extensions
func (s *Store) List() ([]InstalledExtension, error) {
	entries, err := os.ReadDir(s.rootDir)
	if err != nil {
		return nil, err
	}

	var extensions []InstalledExtension
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		dir := filepath.Join(s.rootDir, entry.Name())
		manifestPath := filepath.Join(dir, "manifest.json")
		
		manifestFile, err := os.Open(manifestPath)
		if err != nil {
			continue // Skip invalid extensions
		}
		defer manifestFile.Close()

		var manifest ExtensionManifest
		if err := json.NewDecoder(manifestFile).Decode(&manifest); err != nil {
			continue
		}

		// Determine binary path based on OS/Arch
		binName := fmt.Sprintf("%s-%s-%s", manifest.Name, runtime.GOOS, runtime.GOARCH)
		if runtime.GOOS == "windows" {
			binName += ".exe"
		}
		binPath := filepath.Join(dir, "bin", binName)
		
		// If specific binary not found, fallback to generic name (for single-platform dists)
		if _, statErr := os.Stat(binPath); statErr != nil {
			log.Debugf("Binary not found at %s: %v, trying fallback", binPath, statErr)
			binPath = filepath.Join(dir, "bin", manifest.Name)
			if runtime.GOOS == "windows" {
				binPath += ".exe"
			}
		}

		uiPath := filepath.Join(dir, "ui")

		extensions = append(extensions, InstalledExtension{
			Manifest: manifest,
			Dir:      dir,
			BinPath:  binPath,
			UIPath:   uiPath,
		})
	}

	return extensions, nil
}

// Install installs an extension from a .tar.gz package
func (s *Store) Install(packagePath string) (*InstalledExtension, error) {
	// Open package
	f, err := os.Open(packagePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open package: %w", err)
	}
	defer f.Close()

	// Decompress
	gzr, err := gzip.NewReader(f)
	if err != nil {
		return nil, fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer gzr.Close()

	tr := tar.NewReader(gzr)

	// Temporary directory for extraction
	tempDir, err := os.MkdirTemp(s.rootDir, ".install-")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tempDir) // Clean up if installation fails (moved later on success)

	// Extract files
	var manifest *ExtensionManifest
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}

		target := filepath.Join(tempDir, header.Name)
		
		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0755); err != nil {
				return nil, err
			}
		case tar.TypeReg:
			dir := filepath.Dir(target)
			if err := os.MkdirAll(dir, 0755); err != nil {
				return nil, err
			}
			
			outFile, err := os.OpenFile(target, os.O_CREATE|os.O_RDWR, os.FileMode(header.Mode))
			if err != nil {
				return nil, err
			}
			if _, err := io.Copy(outFile, tr); err != nil {
				outFile.Close()
				return nil, err
			}
			outFile.Close()

			if filepath.Base(target) == "manifest.json" {
				mFile, _ := os.Open(target)
				var m ExtensionManifest
				if err := json.NewDecoder(mFile).Decode(&m); err == nil {
					manifest = &m
				}
				mFile.Close()
			}
		}
	}

	if manifest == nil {
		return nil, fmt.Errorf("manifest.json not found in package")
	}

	// Move to final location
	finalDir := filepath.Join(s.rootDir, manifest.Name)
	if err := os.RemoveAll(finalDir); err != nil {
		return nil, fmt.Errorf("failed to remove existing installation: %w", err)
	}

	if err := os.Rename(tempDir, finalDir); err != nil {
		// Fallback to copy if rename fails (e.g. cross-device)
		return nil, fmt.Errorf("failed to move extracted files: %w", err)
	}

	// Make binary executable
	// (Re-scanning to find correct binary path logic duplicplication - simplify later)
	return &InstalledExtension{
		Manifest: *manifest,
		Dir:      finalDir,
	}, nil
}

// Uninstall removes an extension
func (s *Store) Uninstall(name string) error {
	path := filepath.Join(s.rootDir, name)
	return os.RemoveAll(path)
}
