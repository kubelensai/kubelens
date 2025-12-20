package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/viper"
)

// Config holds the application configuration
type Config struct {
	Port                    int      `mapstructure:"port"`
	// Database connection parameters
	DatabaseType            string   `mapstructure:"database_type"`     // mysql, postgres, sqlite (default: sqlite)
	DatabaseHost            string   `mapstructure:"database_host"`     // Database host
	DatabasePort            int      `mapstructure:"database_port"`     // Database port
	DatabaseName            string   `mapstructure:"database_name"`     // Database name
	DatabaseUser            string   `mapstructure:"database_user"`     // Database user
	DatabasePassword        string   `mapstructure:"database_password"` // Database password
	DatabaseSSLMode         string   `mapstructure:"database_sslmode"`  // SSL mode for PostgreSQL (default: disable)
	DatabasePath            string   `mapstructure:"database_path"`     // Path for SQLite database file
	KubeConfig              string   `mapstructure:"kubeconfig"`
	LogLevel                string   `mapstructure:"log_level"`
	CORSOrigins             []string `mapstructure:"cors_origins"`
	ReleaseMode             bool     `mapstructure:"release_mode"`
	AdminPassword           string   `mapstructure:"admin_password"`
	GlobalRateLimitPerMin   int      `mapstructure:"global_rate_limit_per_min"`
	LoginRateLimitPerMin    int      `mapstructure:"login_rate_limit_per_min"`
	PublicURL               string   `mapstructure:"public_url"`        // Public URL for OAuth2 callbacks (e.g., https://api.kubelens.example.com)
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
	v.SetDefault("public_url", "http://localhost:8080") // Default for local development
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
	v.BindEnv("database_type")
	v.BindEnv("database_host")
	v.BindEnv("database_port")
	v.BindEnv("database_name")
	v.BindEnv("database_user")
	v.BindEnv("database_password")
	v.BindEnv("database_sslmode")
	v.BindEnv("database_path")
	v.BindEnv("public_url")

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	// Ensure database directory exists (only for SQLite)
	if cfg.DatabaseType == "" || cfg.DatabaseType == "sqlite" {
		dbPath := cfg.DatabasePath
		if dbPath == "" {
			dbPath = "./data/kubelens.db"
		}
		dbDir := filepath.Dir(dbPath)
		if err := os.MkdirAll(dbDir, 0755); err != nil {
			return nil, err
		}
	}

	return &cfg, nil
}

// GetDatabaseConnectionString returns the database connection string built from individual parameters
func (c *Config) GetDatabaseConnectionString() string {
	return c.buildDSNFromComponents()
}

// buildDSNFromComponents constructs a DSN from individual connection parameters
func (c *Config) buildDSNFromComponents() string {
	dbType := c.DatabaseType
	if dbType == "" {
		dbType = "sqlite" // Default to SQLite
	}
	
	switch dbType {
	case "postgres", "postgresql":
		// PostgreSQL: postgres://user:password@host:port/database?sslmode=disable
		host := c.DatabaseHost
		if host == "" {
			host = "localhost"
		}
		port := c.DatabasePort
		if port == 0 {
			port = 5432
		}
		dbname := c.DatabaseName
		if dbname == "" {
			dbname = "kubelens"
		}
		user := c.DatabaseUser
		if user == "" {
			user = "kubelens"
		}
		password := c.DatabasePassword
		sslmode := c.DatabaseSSLMode
		if sslmode == "" {
			sslmode = "disable"
		}
		
		// URL-encode username and password to handle special characters
		encodedUser := url.QueryEscape(user)
		encodedPassword := url.QueryEscape(password)
		
		return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
			encodedUser, encodedPassword, host, port, dbname, sslmode)
	
	case "mysql":
		// MySQL: user:password@tcp(host:port)/database?charset=utf8mb4&parseTime=True&loc=Local
		host := c.DatabaseHost
		if host == "" {
			host = "localhost"
		}
		port := c.DatabasePort
		if port == 0 {
			port = 3306
		}
		dbname := c.DatabaseName
		if dbname == "" {
			dbname = "kubelens"
		}
		user := c.DatabaseUser
		if user == "" {
			user = "kubelens"
		}
		password := c.DatabasePassword
		
		// URL-encode username and password
		encodedUser := url.QueryEscape(user)
		encodedPassword := url.QueryEscape(password)
		
		return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			encodedUser, encodedPassword, host, port, dbname)
	
	default: // sqlite
		// SQLite: /path/to/db?params
		dbPath := c.DatabasePath
		if dbPath == "" {
			dbPath = "./data/kubelens.db"
		}
		return dbPath + "?cache=shared&mode=rwc&_journal_mode=WAL"
	}
}

