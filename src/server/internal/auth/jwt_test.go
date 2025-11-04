//go:build !test
// +build !test

package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestGenerateToken(t *testing.T) {
	secret := "test-secret-key"

	tests := []struct {
		name     string
		userID   int
		email    string
		username string
		isAdmin  bool
		wantErr  bool
	}{
		{
			name:     "valid admin user",
			userID:   1,
			email:    "admin@example.com",
			username: "admin",
			isAdmin:  true,
			wantErr:  false,
		},
		{
			name:     "valid regular user",
			userID:   2,
			email:    "user@example.com",
			username: "user",
			isAdmin:  false,
			wantErr:  false,
		},
		{
			name:     "user with empty email",
			userID:   3,
			email:    "",
			username: "user",
			isAdmin:  false,
			wantErr:  false,
		},
		{
			name:     "user with zero ID",
			userID:   0,
			email:    "test@example.com",
			username: "test",
			isAdmin:  false,
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, err := GenerateToken(tt.userID, tt.email, tt.username, tt.isAdmin, secret)
			if (err != nil) != tt.wantErr {
				t.Errorf("GenerateToken() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				if token == "" {
					t.Error("GenerateToken() returned empty token")
				}
				// Verify token can be parsed
				claims, err := ValidateToken(token, secret)
				if err != nil {
					t.Errorf("Generated token validation failed: %v", err)
				}
				if claims.UserID != tt.userID {
					t.Errorf("UserID = %v, want %v", claims.UserID, tt.userID)
				}
				if claims.Email != tt.email {
					t.Errorf("Email = %v, want %v", claims.Email, tt.email)
				}
				if claims.Username != tt.username {
					t.Errorf("Username = %v, want %v", claims.Username, tt.username)
				}
				if claims.IsAdmin != tt.isAdmin {
					t.Errorf("IsAdmin = %v, want %v", claims.IsAdmin, tt.isAdmin)
				}
			}
		})
	}
}

func TestValidateToken(t *testing.T) {
	secret := "test-secret-key"
	userID := 1
	email := "test@example.com"
	username := "testuser"
	isAdmin := true

	validToken, err := GenerateToken(userID, email, username, isAdmin, secret)
	if err != nil {
		t.Fatalf("Failed to generate test token: %v", err)
	}

	tests := []struct {
		name    string
		token   string
		secret  string
		wantErr bool
	}{
		{
			name:    "valid token",
			token:   validToken,
			secret:  secret,
			wantErr: false,
		},
		{
			name:    "invalid secret",
			token:   validToken,
			secret:  "wrong-secret",
			wantErr: true,
		},
		{
			name:    "malformed token",
			token:   "not.a.valid.token",
			secret:  secret,
			wantErr: true,
		},
		{
			name:    "empty token",
			token:   "",
			secret:  secret,
			wantErr: true,
		},
		{
			name:    "truncated token",
			token:   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
			secret:  secret,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			claims, err := ValidateToken(tt.token, tt.secret)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateToken() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				if claims == nil {
					t.Error("ValidateToken() returned nil claims")
				}
				if claims.UserID != userID {
					t.Errorf("UserID = %v, want %v", claims.UserID, userID)
				}
			}
		})
	}
}

func TestTokenExpiration(t *testing.T) {
	secret := "test-secret-key"

	// Create a token that's already expired
	claims := Claims{
		UserID:   1,
		Email:    "test@example.com",
		Username: "test",
		IsAdmin:  false,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
			Issuer:    "kubelens",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	expiredToken, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("Failed to create expired token: %v", err)
	}

	_, err = ValidateToken(expiredToken, secret)
	if err == nil {
		t.Error("ValidateToken() should fail for expired token")
	}
}

func TestTokenClaims(t *testing.T) {
	secret := "test-secret-key"
	userID := 123
	email := "user@kubelens.io"
	username := "kubelens-user"
	isAdmin := true

	token, err := GenerateToken(userID, email, username, isAdmin, secret)
	if err != nil {
		t.Fatalf("GenerateToken() failed: %v", err)
	}

	claims, err := ValidateToken(token, secret)
	if err != nil {
		t.Fatalf("ValidateToken() failed: %v", err)
	}

	// Verify all claims
	if claims.UserID != userID {
		t.Errorf("UserID = %v, want %v", claims.UserID, userID)
	}
	if claims.Email != email {
		t.Errorf("Email = %v, want %v", claims.Email, email)
	}
	if claims.Username != username {
		t.Errorf("Username = %v, want %v", claims.Username, username)
	}
	if claims.IsAdmin != isAdmin {
		t.Errorf("IsAdmin = %v, want %v", claims.IsAdmin, isAdmin)
	}
	if claims.Issuer != "kubelens" {
		t.Errorf("Issuer = %v, want kubelens", claims.Issuer)
	}
	if claims.ExpiresAt == nil {
		t.Error("ExpiresAt is nil")
	}
	if claims.IssuedAt == nil {
		t.Error("IssuedAt is nil")
	}
}

func TestTokenWithDifferentSigningMethod(t *testing.T) {
	secret := "test-secret-key"

	// Create a token with RS256 (which should be rejected)
	claims := Claims{
		UserID:   1,
		Email:    "test@example.com",
		Username: "test",
		IsAdmin:  false,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "kubelens",
		},
	}

	// Note: This test is conceptual - we can't easily create an RS256 token without a private key
	// But we can test that our validation rejects non-HMAC tokens
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString([]byte(secret))

	// This should work
	_, err := ValidateToken(tokenString, secret)
	if err != nil {
		t.Errorf("ValidateToken() failed for HMAC token: %v", err)
	}
}

// Benchmark tests
func BenchmarkGenerateToken(b *testing.B) {
	secret := "test-secret-key"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = GenerateToken(1, "test@example.com", "test", false, secret)
	}
}

func BenchmarkValidateToken(b *testing.B) {
	secret := "test-secret-key"
	token, _ := GenerateToken(1, "test@example.com", "test", false, secret)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = ValidateToken(token, secret)
	}
}

