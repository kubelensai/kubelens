package config

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/viper"
)

// Config holds the application configuration
type Config struct {
	Port                    int      `mapstructure:"port"`
	DatabasePath            string   `mapstructure:"database_path"`
	DatabaseDSN             string   `mapstructure:"database_dsn"` // Full DSN connection string (overrides database_path)
	KubeConfig              string   `mapstructure:"kubeconfig"`
	LogLevel                string   `mapstructure:"log_level"`
	CORSOrigins             []string `mapstructure:"cors_origins"`
	ReleaseMode             bool     `mapstructure:"release_mode"`
	AdminPassword           string   `mapstructure:"admin_password"`
	GlobalRateLimitPerMin   int      `mapstructure:"global_rate_limit_per_min"`
	LoginRateLimitPerMin    int      `mapstructure:"login_rate_limit_per_min"`
	Clusters                []ClusterConfig `mapstructure:"clusters"`
}

// ClusterConfig holds cluster-specific configuration
type ClusterConfig struct {
	Name       string `mapstructure:"name"`
	KubeConfig string `mapstructure:"kubeconfig"`
	Context    string `mapstructure:"context"`
	Default    bool   `mapstructure:"default"`
}

// Load reads configuration from file and environment variables
func Load() (*Config, error) {
	v := viper.New()

	// Set defaults
	v.SetDefault("port", 8080)
	v.SetDefault("database_path", "./data/kubelens.db")
	v.SetDefault("log_level", "info")
	v.SetDefault("cors_origins", []string{"http://localhost:5173"})
	v.SetDefault("release_mode", false)
	v.SetDefault("global_rate_limit_per_min", 1000)  // Default: 1000 requests per minute
	v.SetDefault("login_rate_limit_per_min", 5)      // Default: 5 requests per minute
	// admin_password is optional - will be auto-generated if not set

	// Get kubeconfig from environment or default location
	kubeconfig := os.Getenv("KUBECONFIG")
	if kubeconfig == "" {
		home, err := os.UserHomeDir()
		if err == nil {
			kubeconfig = filepath.Join(home, ".kube", "config")
		}
	}
	v.SetDefault("kubeconfig", kubeconfig)

	// Read from config file
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath("./config")
	v.AddConfigPath(".")

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
	}

	// Read from environment variables
	v.SetEnvPrefix("kubelens")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()
	
	// Explicitly bind environment variables
	v.BindEnv("admin_password")
	v.BindEnv("global_rate_limit_per_min")
	v.BindEnv("login_rate_limit_per_min")
	v.BindEnv("database_path")
	v.BindEnv("database_dsn")

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	// Ensure database directory exists (only for file-based databases)
	if cfg.DatabaseDSN == "" {
		dbDir := filepath.Dir(cfg.DatabasePath)
		if err := os.MkdirAll(dbDir, 0755); err != nil {
			return nil, err
		}
	}

	return &cfg, nil
}

// GetDatabaseConnectionString returns the database connection string
// Priority: DATABASE_DSN > DATABASE_PATH (with SQLite parameters)
func (c *Config) GetDatabaseConnectionString() string {
	// If DATABASE_DSN is set, use it directly (for PostgreSQL, MySQL, etc.)
	if c.DatabaseDSN != "" {
		return c.DatabaseDSN
	}
	
	// Otherwise, use DATABASE_PATH with SQLite optimizations
	// Enable WAL mode and other pragmas for better concurrency
	return c.DatabasePath + "?_journal_mode=WAL&_busy_timeout=5000&_synchronous=NORMAL&_cache_size=1000"
}

