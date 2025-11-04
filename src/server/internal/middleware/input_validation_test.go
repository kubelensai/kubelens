package middleware

import (
	"regexp"
	"testing"
)

// Helper functions for testing
func IsValidEmail(email string) bool {
	return ValidateEmail(email)
}

func IsValidUsername(username string) bool {
	if len(username) < 3 || len(username) > 70 {
		return false
	}
	// Username should start with letter and contain only alphanumeric, dash, underscore, or dot
	usernameRegex := regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9._-]*$`)
	return usernameRegex.MatchString(username)
}

func IsValidPassword(password string) bool {
	valid, _ := ValidatePassword(password)
	return valid
}

func IsValidClusterName(clusterName string) bool {
	if len(clusterName) < 1 || len(clusterName) > 253 {
		return false
	}
	// Cluster name should be lowercase alphanumeric with dashes, not starting or ending with dash
	clusterRegex := regexp.MustCompile(`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`)
	return clusterRegex.MatchString(clusterName)
}

func IsValidNamespace(namespace string) bool {
	if len(namespace) < 1 || len(namespace) > 63 {
		return false
	}
	// Namespace should be lowercase alphanumeric with dashes, not starting or ending with dash
	namespaceRegex := regexp.MustCompile(`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`)
	return namespaceRegex.MatchString(namespace)
}

func TestIsValidEmail(t *testing.T) {
	tests := []struct {
		name  string
		email string
		want  bool
	}{
		{
			name:  "valid email",
			email: "user@example.com",
			want:  true,
		},
		{
			name:  "valid email with subdomain",
			email: "user@subdomain.example.com",
			want:  true,
		},
		{
			name:  "valid email with plus",
			email: "user+tag@example.com",
			want:  true,
		},
		{
			name:  "valid email with dash",
			email: "user-name@example.com",
			want:  true,
		},
		{
			name:  "valid email with numbers",
			email: "user123@example.com",
			want:  true,
		},
		{
			name:  "invalid email - no @ symbol",
			email: "userexample.com",
			want:  false,
		},
		{
			name:  "invalid email - no domain",
			email: "user@",
			want:  false,
		},
		{
			name:  "invalid email - no username",
			email: "@example.com",
			want:  false,
		},
		{
			name:  "invalid email - no TLD",
			email: "user@example",
			want:  false,
		},
		{
			name:  "invalid email - spaces",
			email: "user name@example.com",
			want:  false,
		},
		{
			name:  "invalid email - multiple @",
			email: "user@@example.com",
			want:  false,
		},
		{
			name:  "empty email",
			email: "",
			want:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsValidEmail(tt.email); got != tt.want {
				t.Errorf("IsValidEmail(%q) = %v, want %v", tt.email, got, tt.want)
			}
		})
	}
}

func TestIsValidUsername(t *testing.T) {
	tests := []struct {
		name     string
		username string
		want     bool
	}{
		{
			name:     "valid username - alphanumeric",
			username: "user123",
			want:     true,
		},
		{
			name:     "valid username - with underscore",
			username: "user_name",
			want:     true,
		},
		{
			name:     "valid username - with dash",
			username: "user-name",
			want:     true,
		},
		{
			name:     "valid username - with dot",
			username: "user.name",
			want:     true,
		},
		{
			name:     "valid username - minimum length",
			username: "usr",
			want:     true,
		},
		{
			name:     "valid username - maximum length",
			username: "user1234567890123456789012345678901234567890123456789012345678901234", // 70 chars
			want:     true,
		},
		{
			name:     "invalid username - too short",
			username: "us",
			want:     false,
		},
		{
			name:     "invalid username - spaces",
			username: "user name",
			want:     false,
		},
		{
			name:     "invalid username - special characters",
			username: "user@name",
			want:     false,
		},
		{
			name:     "invalid username - starts with number",
			username: "123user",
			want:     false,
		},
		{
			name:     "empty username",
			username: "",
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsValidUsername(tt.username); got != tt.want {
				t.Errorf("IsValidUsername(%q) = %v, want %v", tt.username, got, tt.want)
			}
		})
	}
}

func TestIsValidPassword(t *testing.T) {
	tests := []struct {
		name     string
		password string
		want     bool
	}{
		{
			name:     "valid password - strong",
			password: "StrongP@ssw0rd!",
			want:     true,
		},
		{
			name:     "valid password - minimum length",
			password: "Pass123!",
			want:     true,
		},
		{
			name:     "valid password - with symbols",
			password: "P@ssw0rd#2024",
			want:     true,
		},
		{
			name:     "invalid password - too short",
			password: "Pass1!",
			want:     false,
		},
		{
			name:     "invalid password - no uppercase",
			password: "password123!",
			want:     false,
		},
		{
			name:     "invalid password - no lowercase",
			password: "PASSWORD123!",
			want:     false,
		},
		{
			name:     "invalid password - no number",
			password: "Password!",
			want:     false,
		},
		{
			name:     "invalid password - no special character",
			password: "Password123",
			want:     false,
		},
		{
			name:     "empty password",
			password: "",
			want:     false,
		},
		{
			name:     "invalid password - only spaces",
			password: "        ",
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsValidPassword(tt.password); got != tt.want {
				t.Errorf("IsValidPassword(%q) = %v, want %v", tt.password, got, tt.want)
			}
		})
	}
}

func TestIsValidClusterName(t *testing.T) {
	tests := []struct {
		name        string
		clusterName string
		want        bool
	}{
		{
			name:        "valid cluster name - alphanumeric",
			clusterName: "production-cluster",
			want:        true,
		},
		{
			name:        "valid cluster name - with numbers",
			clusterName: "cluster-123",
			want:        true,
		},
		{
			name:        "valid cluster name - with dash",
			clusterName: "my-k8s-cluster",
			want:        true,
		},
		{
			name:        "valid cluster name - short",
			clusterName: "dev",
			want:        true,
		},
		{
			name:        "invalid cluster name - special characters",
			clusterName: "cluster@name",
			want:        false,
		},
		{
			name:        "invalid cluster name - spaces",
			clusterName: "my cluster",
			want:        false,
		},
		{
			name:        "invalid cluster name - uppercase",
			clusterName: "MyCluster",
			want:        false,
		},
		{
			name:        "invalid cluster name - starts with dash",
			clusterName: "-cluster",
			want:        false,
		},
		{
			name:        "invalid cluster name - ends with dash",
			clusterName: "cluster-",
			want:        false,
		},
		{
			name:        "empty cluster name",
			clusterName: "",
			want:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsValidClusterName(tt.clusterName); got != tt.want {
				t.Errorf("IsValidClusterName(%q) = %v, want %v", tt.clusterName, got, tt.want)
			}
		})
	}
}

func TestIsValidNamespace(t *testing.T) {
	tests := []struct {
		name      string
		namespace string
		want      bool
	}{
		{
			name:      "valid namespace - alphanumeric",
			namespace: "default",
			want:      true,
		},
		{
			name:      "valid namespace - with dash",
			namespace: "kube-system",
			want:      true,
		},
		{
			name:      "valid namespace - with numbers",
			namespace: "namespace-123",
			want:      true,
		},
		{
			name:      "invalid namespace - uppercase",
			namespace: "Default",
			want:      false,
		},
		{
			name:      "invalid namespace - special characters",
			namespace: "namespace_name",
			want:      false,
		},
		{
			name:      "invalid namespace - spaces",
			namespace: "my namespace",
			want:      false,
		},
		{
			name:      "invalid namespace - starts with dash",
			namespace: "-namespace",
			want:      false,
		},
		{
			name:      "invalid namespace - too long",
			namespace: "namespace-with-a-very-long-name-that-exceeds-the-maximum-allowed-length-for-kubernetes-namespaces-which-is-253-characters",
			want:      false,
		},
		{
			name:      "empty namespace",
			namespace: "",
			want:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsValidNamespace(tt.namespace); got != tt.want {
				t.Errorf("IsValidNamespace(%q) = %v, want %v", tt.namespace, got, tt.want)
			}
		})
	}
}

func TestSanitizeString(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "clean string",
			input: "hello-world",
			want:  "hello-world",
		},
		{
			name:  "string with null bytes",
			input: "hello\x00world",
			want:  "helloworld",
		},
		{
			name:  "string with control characters",
			input: "hello\x01\x02world",
			want:  "helloworld",
		},
		{
			name:  "string with tab and newline",
			input: "hello\tworld\n",
			want:  "helloworld",
		},
		{
			name:  "empty string",
			input: "",
			want:  "",
		},
		{
			name:  "string with only whitespace and control chars",
			input: "   \t\n\x00   ",
			want:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := SanitizeString(tt.input); got != tt.want {
				t.Errorf("SanitizeString(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

// Benchmark tests
func BenchmarkIsValidEmail(b *testing.B) {
	email := "user@example.com"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		IsValidEmail(email)
	}
}

func BenchmarkIsValidPassword(b *testing.B) {
	password := "StrongP@ssw0rd123!"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		IsValidPassword(password)
	}
}

func BenchmarkSanitizeString(b *testing.B) {
	input := "<script>alert('xss')</script>Hello World"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		SanitizeString(input)
	}
}

