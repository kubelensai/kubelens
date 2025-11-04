package config

import (
	"os"
	"testing"
)

func TestLoad(t *testing.T) {
	// Save original env vars
	origPort := os.Getenv("KUBELENS_PORT")
	origLogLevel := os.Getenv("KUBELENS_LOG_LEVEL")
	
	defer func() {
		// Restore original env vars
		os.Setenv("KUBELENS_PORT", origPort)
		os.Setenv("KUBELENS_LOG_LEVEL", origLogLevel)
	}()

	tests := []struct {
		name    string
		setup   func()
		wantErr bool
		checks  func(*testing.T, *Config)
	}{
		{
			name: "default configuration",
			setup: func() {
				os.Unsetenv("KUBELENS_PORT")
				os.Unsetenv("KUBELENS_LOG_LEVEL")
			},
			wantErr: false,
			checks: func(t *testing.T, cfg *Config) {
				if cfg.Port != 8080 {
					t.Errorf("Port = %v, want 8080", cfg.Port)
				}
				if cfg.LogLevel != "info" {
					t.Errorf("LogLevel = %v, want info", cfg.LogLevel)
				}
				if cfg.GlobalRateLimitPerMin != 1000 {
					t.Errorf("GlobalRateLimitPerMin = %v, want 1000", cfg.GlobalRateLimitPerMin)
				}
				if cfg.LoginRateLimitPerMin != 5 {
					t.Errorf("LoginRateLimitPerMin = %v, want 5", cfg.LoginRateLimitPerMin)
				}
			},
		},
		{
			name: "with environment variables",
			setup: func() {
				os.Setenv("KUBELENS_PORT", "9090")
				os.Setenv("KUBELENS_LOG_LEVEL", "debug")
			},
			wantErr: false,
			checks: func(t *testing.T, cfg *Config) {
				if cfg.Port != 9090 {
					t.Errorf("Port = %v, want 9090", cfg.Port)
				}
				if cfg.LogLevel != "debug" {
					t.Errorf("LogLevel = %v, want debug", cfg.LogLevel)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup()
			cfg, err := Load()
			if (err != nil) != tt.wantErr {
				t.Errorf("Load() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && tt.checks != nil {
				tt.checks(t, cfg)
			}
		})
	}
}

func TestConfigDefaults(t *testing.T) {
	// Clear relevant env vars
	os.Unsetenv("KUBELENS_PORT")
	os.Unsetenv("KUBELENS_LOG_LEVEL")
	os.Unsetenv("KUBELENS_DATABASE_PATH")
	os.Unsetenv("KUBELENS_RELEASE_MODE")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() failed: %v", err)
	}

	tests := []struct {
		name string
		got  interface{}
		want interface{}
	}{
		{"Port", cfg.Port, 8080},
		{"LogLevel", cfg.LogLevel, "info"},
		{"DatabasePath", cfg.DatabasePath, "./data/kubelens.db"},
		{"ReleaseMode", cfg.ReleaseMode, false},
		{"GlobalRateLimitPerMin", cfg.GlobalRateLimitPerMin, 1000},
		{"LoginRateLimitPerMin", cfg.LoginRateLimitPerMin, 5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.got != tt.want {
				t.Errorf("%s = %v, want %v", tt.name, tt.got, tt.want)
			}
		})
	}
}

func TestDatabaseConfiguration(t *testing.T) {
	tests := []struct {
		name   string
		setup  func()
		checks func(*testing.T, *Config)
	}{
		{
			name: "sqlite configuration",
			setup: func() {
				os.Setenv("KUBELENS_DATABASE_TYPE", "sqlite")
				os.Setenv("KUBELENS_DATABASE_PATH", "./test-data/db.sqlite")
			},
			checks: func(t *testing.T, cfg *Config) {
				if cfg.DatabaseType != "sqlite" {
					t.Errorf("DatabaseType = %v, want sqlite", cfg.DatabaseType)
				}
				if cfg.DatabasePath != "./test-data/db.sqlite" {
					t.Errorf("DatabasePath = %v, want ./test-data/db.sqlite", cfg.DatabasePath)
				}
			},
		},
		{
			name: "postgres configuration",
			setup: func() {
				os.Setenv("KUBELENS_DATABASE_TYPE", "postgres")
				os.Setenv("KUBELENS_DATABASE_HOST", "localhost")
				os.Setenv("KUBELENS_DATABASE_PORT", "5432")
				os.Setenv("KUBELENS_DATABASE_NAME", "kubelens")
				os.Setenv("KUBELENS_DATABASE_USER", "postgres")
				os.Setenv("KUBELENS_DATABASE_PASSWORD", "secret")
				os.Setenv("KUBELENS_DATABASE_SSLMODE", "disable")
			},
			checks: func(t *testing.T, cfg *Config) {
				if cfg.DatabaseType != "postgres" {
					t.Errorf("DatabaseType = %v, want postgres", cfg.DatabaseType)
				}
				if cfg.DatabaseHost != "localhost" {
					t.Errorf("DatabaseHost = %v, want localhost", cfg.DatabaseHost)
				}
				if cfg.DatabasePort != 5432 {
					t.Errorf("DatabasePort = %v, want 5432", cfg.DatabasePort)
				}
				if cfg.DatabaseName != "kubelens" {
					t.Errorf("DatabaseName = %v, want kubelens", cfg.DatabaseName)
				}
			},
		},
		{
			name: "mysql configuration",
			setup: func() {
				os.Setenv("KUBELENS_DATABASE_TYPE", "mysql")
				os.Setenv("KUBELENS_DATABASE_HOST", "mysql-host")
				os.Setenv("KUBELENS_DATABASE_PORT", "3306")
				os.Setenv("KUBELENS_DATABASE_NAME", "kubelens_db")
			},
			checks: func(t *testing.T, cfg *Config) {
				if cfg.DatabaseType != "mysql" {
					t.Errorf("DatabaseType = %v, want mysql", cfg.DatabaseType)
				}
				if cfg.DatabaseHost != "mysql-host" {
					t.Errorf("DatabaseHost = %v, want mysql-host", cfg.DatabaseHost)
				}
				if cfg.DatabasePort != 3306 {
					t.Errorf("DatabasePort = %v, want 3306", cfg.DatabasePort)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clean env
			os.Unsetenv("KUBELENS_DATABASE_TYPE")
			os.Unsetenv("KUBELENS_DATABASE_HOST")
			os.Unsetenv("KUBELENS_DATABASE_PORT")
			os.Unsetenv("KUBELENS_DATABASE_NAME")
			os.Unsetenv("KUBELENS_DATABASE_USER")
			os.Unsetenv("KUBELENS_DATABASE_PASSWORD")
			os.Unsetenv("KUBELENS_DATABASE_SSLMODE")
			os.Unsetenv("KUBELENS_DATABASE_PATH")

			tt.setup()
			cfg, err := Load()
			if err != nil {
				t.Fatalf("Load() failed: %v", err)
			}
			tt.checks(t, cfg)
		})
	}
}

func TestRateLimitConfiguration(t *testing.T) {
	tests := []struct {
		name              string
		globalRateLimit   string
		loginRateLimit    string
		expectedGlobal    int
		expectedLogin     int
	}{
		{
			name:            "default rate limits",
			globalRateLimit: "",
			loginRateLimit:  "",
			expectedGlobal:  1000,
			expectedLogin:   5,
		},
		{
			name:            "custom rate limits",
			globalRateLimit: "5000",
			loginRateLimit:  "10",
			expectedGlobal:  5000,
			expectedLogin:   10,
		},
		{
			name:            "only global limit set",
			globalRateLimit: "2000",
			loginRateLimit:  "",
			expectedGlobal:  2000,
			expectedLogin:   5,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Unsetenv("KUBELENS_GLOBAL_RATE_LIMIT_PER_MIN")
			os.Unsetenv("KUBELENS_LOGIN_RATE_LIMIT_PER_MIN")

			if tt.globalRateLimit != "" {
				os.Setenv("KUBELENS_GLOBAL_RATE_LIMIT_PER_MIN", tt.globalRateLimit)
			}
			if tt.loginRateLimit != "" {
				os.Setenv("KUBELENS_LOGIN_RATE_LIMIT_PER_MIN", tt.loginRateLimit)
			}

			cfg, err := Load()
			if err != nil {
				t.Fatalf("Load() failed: %v", err)
			}

			if cfg.GlobalRateLimitPerMin != tt.expectedGlobal {
				t.Errorf("GlobalRateLimitPerMin = %v, want %v", cfg.GlobalRateLimitPerMin, tt.expectedGlobal)
			}
			if cfg.LoginRateLimitPerMin != tt.expectedLogin {
				t.Errorf("LoginRateLimitPerMin = %v, want %v", cfg.LoginRateLimitPerMin, tt.expectedLogin)
			}
		})
	}
}

func TestCORSOrigins(t *testing.T) {
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() failed: %v", err)
	}

	if len(cfg.CORSOrigins) == 0 {
		t.Error("CORSOrigins should not be empty")
	}

	// Check default CORS origin
	found := false
	for _, origin := range cfg.CORSOrigins {
		if origin == "http://localhost:5173" {
			found = true
			break
		}
	}
	if !found {
		t.Error("Default CORS origin 'http://localhost:5173' not found")
	}
}

