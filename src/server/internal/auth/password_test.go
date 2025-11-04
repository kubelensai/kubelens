package auth

import (
	"testing"
)

func TestHashPassword(t *testing.T) {
	tests := []struct {
		name     string
		password string
		wantErr  bool
	}{
		{
			name:     "valid password",
			password: "SecurePassword123!",
			wantErr:  false,
		},
		{
			name:     "short password",
			password: "pass",
			wantErr:  false,
		},
		{
			name:     "long password",
			password: "This1sAVeryL0ngP@ssw0rdTh@tSh0uldStillW0rkF1ne!",
			wantErr:  false,
		},
		{
			name:     "password with special characters",
			password: "P@ssw0rd!#$%^&*()",
			wantErr:  false,
		},
		{
			name:     "empty password",
			password: "",
			wantErr:  false, // bcrypt allows empty passwords
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hash, err := HashPassword(tt.password)
			if (err != nil) != tt.wantErr {
				t.Errorf("HashPassword() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && hash == "" {
				t.Error("HashPassword() returned empty hash")
			}
			if !tt.wantErr && hash == tt.password {
				t.Error("HashPassword() returned password in plain text")
			}
		})
	}
}

func TestCheckPassword(t *testing.T) {
	// Create a known hash for testing
	password := "TestPassword123!"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("Failed to create test hash: %v", err)
	}

	tests := []struct {
		name     string
		password string
		hash     string
		want     bool
	}{
		{
			name:     "correct password",
			password: password,
			hash:     hash,
			want:     true,
		},
		{
			name:     "incorrect password",
			password: "WrongPassword",
			hash:     hash,
			want:     false,
		},
		{
			name:     "empty password",
			password: "",
			hash:     hash,
			want:     false,
		},
		{
			name:     "case sensitive password",
			password: "testpassword123!",
			hash:     hash,
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CheckPassword(tt.password, tt.hash); got != tt.want {
				t.Errorf("CheckPassword() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestHashPasswordDeterminism(t *testing.T) {
	password := "TestPassword123"

	hash1, err1 := HashPassword(password)
	if err1 != nil {
		t.Fatalf("First hash failed: %v", err1)
	}

	hash2, err2 := HashPassword(password)
	if err2 != nil {
		t.Fatalf("Second hash failed: %v", err2)
	}

	// Hashes should be different due to salt
	if hash1 == hash2 {
		t.Error("HashPassword() should generate different hashes for the same password (salt)")
	}

	// But both should validate correctly
	if !CheckPassword(password, hash1) {
		t.Error("First hash doesn't validate")
	}
	if !CheckPassword(password, hash2) {
		t.Error("Second hash doesn't validate")
	}
}

func TestCheckPasswordWithInvalidHash(t *testing.T) {
	tests := []struct {
		name     string
		password string
		hash     string
		want     bool
	}{
		{
			name:     "invalid hash format",
			password: "password",
			hash:     "not-a-valid-hash",
			want:     false,
		},
		{
			name:     "empty hash",
			password: "password",
			hash:     "",
			want:     false,
		},
		{
			name:     "truncated hash",
			password: "password",
			hash:     "$2a$10$abc",
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CheckPassword(tt.password, tt.hash); got != tt.want {
				t.Errorf("CheckPassword() = %v, want %v", got, tt.want)
			}
		})
	}
}

// Benchmark tests
func BenchmarkHashPassword(b *testing.B) {
	password := "BenchmarkPassword123!"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = HashPassword(password)
	}
}

func BenchmarkCheckPassword(b *testing.B) {
	password := "BenchmarkPassword123!"
	hash, _ := HashPassword(password)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = CheckPassword(password, hash)
	}
}

