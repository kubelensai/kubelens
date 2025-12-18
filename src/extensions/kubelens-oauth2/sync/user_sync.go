package sync

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// UserInfo represents OIDC user information
type UserInfo struct {
	Subject       string   `json:"sub"`
	Email         string   `json:"email"`
	EmailVerified bool     `json:"email_verified"`
	Name          string   `json:"name"`
	GivenName     string   `json:"given_name"`
	FamilyName    string   `json:"family_name"`
	Picture       string   `json:"picture"`
	Groups        []string `json:"groups"`
	Locale        string   `json:"locale"`
}

// SyncRequest represents a request to sync user from OIDC
type SyncRequest struct {
	UserInfo     UserInfo `json:"user_info"`
	Provider     string   `json:"provider"`      // e.g., "github", "google"
	ProviderID   string   `json:"provider_id"`   // Provider's user ID
	AccessToken  string   `json:"access_token"`  // For API calls to provider
	RefreshToken string   `json:"refresh_token"` // For token refresh
	ExpiresAt    int64    `json:"expires_at"`    // Token expiry timestamp
}

// SyncResponse represents the response from user sync
type SyncResponse struct {
	UserID       uint     `json:"user_id"`
	Email        string   `json:"email"`
	Username     string   `json:"username"`
	IsNewUser    bool     `json:"is_new_user"`
	Groups       []string `json:"groups"`
	SessionToken string   `json:"session_token"`
	ExpiresAt    int64    `json:"expires_at"`
}

// UserSyncService handles user synchronization with Kubelens
type UserSyncService struct {
	kubelensURL string
	apiKey      string
	client      *http.Client
}

// NewUserSyncService creates a new user sync service
func NewUserSyncService(kubelensURL, apiKey string) *UserSyncService {
	return &UserSyncService{
		kubelensURL: kubelensURL,
		apiKey:      apiKey,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SyncUser synchronizes user information from OIDC to Kubelens
func (s *UserSyncService) SyncUser(req SyncRequest) (*SyncResponse, error) {
	// Call Kubelens API to sync user
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/api/auth/oidc/sync", s.kubelensURL)
	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if s.apiKey != "" {
		httpReq.Header.Set("X-Extension-Key", s.apiKey)
	}

	resp, err := s.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to sync user: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResp struct {
			Error string `json:"error"`
		}
		json.NewDecoder(resp.Body).Decode(&errResp)
		return nil, fmt.Errorf("sync failed: %s", errResp.Error)
	}

	var syncResp SyncResponse
	if err := json.NewDecoder(resp.Body).Decode(&syncResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &syncResp, nil
}

// GenerateUsername generates a username from UserInfo
func GenerateUsername(info UserInfo) string {
	// Priority: email prefix > name > subject
	if info.Email != "" {
		// Extract username from email
		for i, c := range info.Email {
			if c == '@' {
				return info.Email[:i]
			}
		}
		return info.Email
	}
	if info.Name != "" {
		// Convert name to username (lowercase, replace spaces)
		username := ""
		for _, c := range info.Name {
			if c == ' ' {
				username += "_"
			} else if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_' || c == '-' {
				username += string(c)
			} else if c >= 'A' && c <= 'Z' {
				username += string(c + 32) // lowercase
			}
		}
		return username
	}
	return info.Subject
}

// NormalizeGroups normalizes group names
func NormalizeGroups(groups []string) []string {
	normalized := make([]string, 0, len(groups))
	seen := make(map[string]bool)
	
	for _, g := range groups {
		// Lowercase and trim
		norm := ""
		for _, c := range g {
			if c == ' ' {
				norm += "_"
			} else if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_' || c == '-' {
				norm += string(c)
			} else if c >= 'A' && c <= 'Z' {
				norm += string(c + 32) // lowercase
			}
		}
		
		if norm != "" && !seen[norm] {
			normalized = append(normalized, norm)
			seen[norm] = true
		}
	}
	
	return normalized
}
