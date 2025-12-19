package extension

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	log "github.com/sirupsen/logrus"
)

const (
	// DefaultRegistryOwner is the default GitHub organization/user for extensions
	DefaultRegistryOwner = "kubelensai"
	// DefaultRegistryRepo is the default repository name for extensions registry
	DefaultRegistryRepo = "kubelens-extensions"
	// CacheDuration is how long to cache the release list
	CacheDuration = 15 * time.Minute
)

// Discovery handles extension discovery from remote sources
type Discovery struct {
	client        *http.Client
	registryOwner string
	registryRepo  string
	cache         *discoveryCache
	mu            sync.RWMutex
}

// discoveryCache holds cached release information
type discoveryCache struct {
	releases  []ExtensionRelease
	updatedAt time.Time
}

// DiscoveryConfig holds configuration for the discovery service
type DiscoveryConfig struct {
	RegistryOwner string
	RegistryRepo  string
	GitHubToken   string // Optional: for higher rate limits
}

// NewDiscovery creates a new discovery service
func NewDiscovery() *Discovery {
	return NewDiscoveryWithConfig(DiscoveryConfig{})
}

// NewDiscoveryWithConfig creates a new discovery service with custom config
func NewDiscoveryWithConfig(cfg DiscoveryConfig) *Discovery {
	owner := cfg.RegistryOwner
	if owner == "" {
		owner = DefaultRegistryOwner
	}
	repo := cfg.RegistryRepo
	if repo == "" {
		repo = DefaultRegistryRepo
	}

	return &Discovery{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		registryOwner: owner,
		registryRepo:  repo,
	}
}

// ExtensionRelease represents a release from GitHub
type ExtensionRelease struct {
	Name         string            `json:"name"`
	Version      string            `json:"version"`
	Description  string            `json:"description"`
	DownloadURL  string            `json:"download_url"`
	PublishedAt  string            `json:"published_at"`
	Author       string            `json:"author,omitempty"`
	Size         int64             `json:"size,omitempty"`
	Downloads    int               `json:"downloads,omitempty"`
	Assets       []ExtensionAsset  `json:"assets,omitempty"`
	Prerelease   bool              `json:"prerelease,omitempty"`
	ReleaseNotes string            `json:"release_notes,omitempty"`
}

// ExtensionAsset represents a downloadable asset from a release
type ExtensionAsset struct {
	Name        string `json:"name"`
	DownloadURL string `json:"download_url"`
	Size        int64  `json:"size"`
	ContentType string `json:"content_type"`
}

// GitHubRelease represents the GitHub API response for a release
type GitHubRelease struct {
	TagName     string        `json:"tag_name"`
	Name        string        `json:"name"`
	Body        string        `json:"body"`
	Prerelease  bool          `json:"prerelease"`
	Draft       bool          `json:"draft"`
	PublishedAt string        `json:"published_at"`
	Author      GitHubAuthor  `json:"author"`
	Assets      []GitHubAsset `json:"assets"`
}

// GitHubAuthor represents the author in GitHub API response
type GitHubAuthor struct {
	Login     string `json:"login"`
	AvatarURL string `json:"avatar_url"`
}

// GitHubAsset represents an asset in GitHub API response
type GitHubAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
	Size               int64  `json:"size"`
	ContentType        string `json:"content_type"`
	DownloadCount      int    `json:"download_count"`
}

// ListAvailable returns list of available extensions from the registry
func (d *Discovery) ListAvailable() ([]ExtensionRelease, error) {
	// Check cache first
	d.mu.RLock()
	if d.cache != nil && time.Since(d.cache.updatedAt) < CacheDuration {
		releases := d.cache.releases
		d.mu.RUnlock()
		return releases, nil
	}
	d.mu.RUnlock()

	// Fetch from GitHub
	releases, err := d.fetchReleasesFromGitHub()
	if err != nil {
		return nil, err
	}

	// Update cache
	d.mu.Lock()
	d.cache = &discoveryCache{
		releases:  releases,
		updatedAt: time.Now(),
	}
	d.mu.Unlock()

	return releases, nil
}

// fetchReleasesFromGitHub fetches releases from GitHub API
func (d *Discovery) fetchReleasesFromGitHub() ([]ExtensionRelease, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases", d.registryOwner, d.registryRepo)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "Kubelens-Extension-Discovery")

	resp, err := d.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch releases: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		log.Warnf("Extension registry not found: %s/%s", d.registryOwner, d.registryRepo)
		return []ExtensionRelease{}, nil
	}

	if resp.StatusCode == http.StatusForbidden {
		// Rate limited
		return nil, fmt.Errorf("GitHub API rate limit exceeded, try again later")
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API error: %d - %s", resp.StatusCode, string(body))
	}

	var ghReleases []GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&ghReleases); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Convert to ExtensionRelease format
	releases := make([]ExtensionRelease, 0)
	for _, ghRelease := range ghReleases {
		// Skip drafts
		if ghRelease.Draft {
			continue
		}

		release := d.convertGitHubRelease(ghRelease)
		if release != nil {
			releases = append(releases, *release)
		}
	}

	return releases, nil
}

// convertGitHubRelease converts a GitHub release to ExtensionRelease
func (d *Discovery) convertGitHubRelease(gh GitHubRelease) *ExtensionRelease {
	// Parse extension name and version from tag
	// Expected format: extension-name-v1.0.0 or extension-name/v1.0.0
	name, version := parseTagName(gh.TagName)
	if name == "" {
		return nil
	}

	// Find the appropriate asset for current platform
	osArch := fmt.Sprintf("%s-%s", runtime.GOOS, runtime.GOARCH)
	var downloadURL string
	var size int64
	var downloads int
	var assets []ExtensionAsset

	for _, asset := range gh.Assets {
		assets = append(assets, ExtensionAsset{
			Name:        asset.Name,
			DownloadURL: asset.BrowserDownloadURL,
			Size:        asset.Size,
			ContentType: asset.ContentType,
		})

		// Check if this is the platform-specific asset
		if strings.Contains(asset.Name, osArch) && strings.HasSuffix(asset.Name, ".tar.gz") {
			downloadURL = asset.BrowserDownloadURL
			size = asset.Size
			downloads = asset.DownloadCount
		}
	}

	// Fallback to any .tar.gz if platform-specific not found
	if downloadURL == "" {
		for _, asset := range gh.Assets {
			if strings.HasSuffix(asset.Name, ".tar.gz") {
				downloadURL = asset.BrowserDownloadURL
				size = asset.Size
				downloads = asset.DownloadCount
				break
			}
		}
	}

	return &ExtensionRelease{
		Name:         name,
		Version:      version,
		Description:  extractDescription(gh.Body),
		DownloadURL:  downloadURL,
		PublishedAt:  gh.PublishedAt,
		Author:       gh.Author.Login,
		Size:         size,
		Downloads:    downloads,
		Assets:       assets,
		Prerelease:   gh.Prerelease,
		ReleaseNotes: gh.Body,
	}
}

// GetExtensionReleases returns all releases for a specific extension
func (d *Discovery) GetExtensionReleases(name string) ([]ExtensionRelease, error) {
	allReleases, err := d.ListAvailable()
	if err != nil {
		return nil, err
	}

	var releases []ExtensionRelease
	for _, r := range allReleases {
		if r.Name == name {
			releases = append(releases, r)
		}
	}
	return releases, nil
}

// GetLatestRelease returns the latest release for a specific extension
func (d *Discovery) GetLatestRelease(name string) (*ExtensionRelease, error) {
	releases, err := d.GetExtensionReleases(name)
	if err != nil {
		return nil, err
	}

	if len(releases) == 0 {
		return nil, fmt.Errorf("extension not found: %s", name)
	}

	// First non-prerelease, or first release if all are prereleases
	for _, r := range releases {
		if !r.Prerelease {
			return &r, nil
		}
	}
	return &releases[0], nil
}

// DownloadExtension downloads an extension to the specified directory
func (d *Discovery) DownloadExtension(release *ExtensionRelease, destDir string) (string, error) {
	if release.DownloadURL == "" {
		return "", fmt.Errorf("no download URL available for extension %s", release.Name)
	}

	// Create destination directory if needed
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create destination directory: %w", err)
	}

	// Download the file
	resp, err := d.client.Get(release.DownloadURL)
	if err != nil {
		return "", fmt.Errorf("failed to download: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download failed with status: %d", resp.StatusCode)
	}

	// Create the destination file
	filename := fmt.Sprintf("%s-%s.tar.gz", release.Name, release.Version)
	destPath := filepath.Join(destDir, filename)

	out, err := os.Create(destPath)
	if err != nil {
		return "", fmt.Errorf("failed to create file: %w", err)
	}
	defer out.Close()

	// Copy with progress tracking (simplified)
	written, err := io.Copy(out, resp.Body)
	if err != nil {
		os.Remove(destPath)
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	log.Infof("Downloaded %s (%d bytes) to %s", release.Name, written, destPath)
	return destPath, nil
}

// ClearCache clears the discovery cache
func (d *Discovery) ClearCache() {
	d.mu.Lock()
	d.cache = nil
	d.mu.Unlock()
}

// Helper functions

// parseTagName parses extension name and version from tag
// Supports formats: name-v1.0.0, name/v1.0.0, v1.0.0
func parseTagName(tag string) (name, version string) {
	// Handle name/vX.X.X format
	if idx := strings.LastIndex(tag, "/"); idx != -1 {
		name = tag[:idx]
		version = strings.TrimPrefix(tag[idx+1:], "v")
		return
	}

	// Handle name-vX.X.X format
	if idx := strings.LastIndex(tag, "-v"); idx != -1 {
		name = tag[:idx]
		version = tag[idx+2:] // skip "-v"
		return
	}

	// Handle plain vX.X.X format (use tag as version, no name)
	if strings.HasPrefix(tag, "v") {
		version = strings.TrimPrefix(tag, "v")
		// Try to extract name from repo or use default
		return
	}

	return tag, "0.0.0"
}

// extractDescription extracts a short description from release notes
func extractDescription(body string) string {
	if body == "" {
		return ""
	}

	// Take first paragraph or first 200 chars
	lines := strings.Split(body, "\n")
	var desc strings.Builder
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			if desc.Len() > 0 {
				break
			}
			continue
		}
		// Skip markdown headers
		if strings.HasPrefix(line, "#") {
			continue
		}
		if desc.Len() > 0 {
			desc.WriteString(" ")
		}
		desc.WriteString(line)
		if desc.Len() > 200 {
			break
		}
	}

	result := desc.String()
	if len(result) > 200 {
		result = result[:197] + "..."
	}
	return result
}
