package db

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"fmt"
	"math/big"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	log "github.com/sirupsen/logrus"
	
	// Import pure Go SQLite driver
	_ "modernc.org/sqlite"
)

// GormDB wraps gorm.DB for Kubelens
type GormDB struct {
	*gorm.DB
	dialect string
}

// GetConn returns the underlying database/sql connection
// This is needed for legacy code and modules that need direct SQL access
func (db *GormDB) GetConn() *sql.DB {
	sqlDB, err := db.DB.DB()
	if err != nil {
		log.Errorf("Failed to get database connection: %v", err)
		return nil
	}
	return sqlDB
}

// NewGorm creates a new GORM database connection with auto-detection and migrations
func NewGorm(connectionString string) (*GormDB, error) {
	dialect := detectDialect(connectionString)
	
	log.Infof("🔍 Detected database dialect: %s", dialect)
	
	var gormDB *gorm.DB
	var err error
	
	// Configure GORM
	config := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent), // Use logrus instead
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	}
	
	// Connect based on dialect
	switch dialect {
	case "sqlite":
		log.Info("🗄️  Connecting to SQLite database...")
		// Use pure Go SQLite driver (modernc.org/sqlite)
		sqlDB, err := sql.Open("sqlite", connectionString)
		if err != nil {
			return nil, fmt.Errorf("failed to open sqlite connection: %w", err)
		}
		gormDB, err = gorm.Open(sqlite.Dialector{Conn: sqlDB}, config)
		
	case "postgres":
		log.Info("🐘 Connecting to PostgreSQL database...")
		gormDB, err = gorm.Open(postgres.Open(connectionString), config)
		
	case "mysql":
		log.Info("🐬 Connecting to MySQL database...")
		// Ensure parseTime=true for MySQL
		if !strings.Contains(connectionString, "parseTime=") {
			if strings.Contains(connectionString, "?") {
				connectionString += "&parseTime=true"
			} else {
				connectionString += "?parseTime=true"
			}
		}
		gormDB, err = gorm.Open(mysql.Open(connectionString), config)
		
	default:
		return nil, fmt.Errorf("unsupported database dialect: %s", dialect)
	}
	
	if err != nil {
		return nil, fmt.Errorf("failed to connect to %s database: %w", dialect, err)
	}
	
	// Configure connection pool
	sqlDB, err := gormDB.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}
	
	if dialect == "sqlite" {
		// SQLite: single writer
		sqlDB.SetMaxOpenConns(1)
		sqlDB.SetMaxIdleConns(1)
		sqlDB.SetConnMaxLifetime(0)
	} else {
		// PostgreSQL/MySQL: connection pool
		sqlDB.SetMaxOpenConns(25)
		sqlDB.SetMaxIdleConns(5)
		sqlDB.SetConnMaxLifetime(5 * time.Minute)
	}
	
	db := &GormDB{
		DB:      gormDB,
		dialect: dialect,
	}
	
	// Run auto-migrations
	if err := db.autoMigrate(); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}
	
	log.Infof("✅ Database initialized successfully (dialect: %s)", dialect)
	
	return db, nil
}

// detectDialect detects database type from connection string
func detectDialect(connectionString string) string {
	switch {
	case strings.HasPrefix(connectionString, "postgres://"),
		strings.HasPrefix(connectionString, "postgresql://"):
		return "postgres"
	case strings.Contains(connectionString, "@tcp("):
		return "mysql"
	default:
		return "sqlite"
	}
}

// autoMigrate runs GORM auto-migrations for all models
func (db *GormDB) autoMigrate() error {
	log.Info("📦 Running database migrations...")
	
	err := db.AutoMigrate(
		&Cluster{},
		&User{},
		&Group{},
		&UserGroup{},
		&Session{},
		&UserSession{},
		&Notification{},
		&AuditLog{},
		&AuditSettings{},
		&MFASecret{},
		&ClusterMetadata{},
		&ExtensionConfig{},
		&SystemConfig{},
	)
	
	if err != nil {
		return err
	}
	
	// Seed default data
	if err := db.seedDefaultData(); err != nil {
		return fmt.Errorf("failed to seed default data: %w", err)
	}
	
	log.Info("✅ Database migrations completed successfully")
	
	return nil
}

// seedDefaultData creates default audit settings and groups
func (db *GormDB) seedDefaultData() error {
	// Create default audit settings if they don't exist
	var auditSettings AuditSettings
	result := db.First(&auditSettings)
	
	if result.Error == gorm.ErrRecordNotFound {
		log.Info("🌱 Seeding default audit settings...")
		auditSettings = AuditSettings{
			AuthEventsEnabled:     true,
			SecurityEventsEnabled: true,
			K8sEventsEnabled:      false,
			RetentionDays:         90,
		}
		if err := db.Create(&auditSettings).Error; err != nil {
			return fmt.Errorf("failed to create audit settings: %w", err)
		}
	}
	
	// Create default groups if they don't exist
	var adminGroup Group
	result = db.Where("name = ?", "admin").First(&adminGroup)
	
	if result.Error == gorm.ErrRecordNotFound {
		log.Info("🌱 Seeding default groups with RBAC permissions...")
		
		// Admin group has full access to all resources
		adminPermissions := `[{"resource": "*", "actions": ["*"], "clusters": ["*"], "namespaces": ["*"]}]`
		
		// Editor group has read-write access to k8s resources but no admin access
		editorPermissions := `[
			{"resource": "clusters", "actions": ["read"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "namespaces", "actions": ["read"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "nodes", "actions": ["read"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "pods", "actions": ["read", "create", "update", "delete"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "deployments", "actions": ["read", "create", "update", "delete"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "services", "actions": ["read", "create", "update", "delete"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "configmaps", "actions": ["read", "create", "update", "delete"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "secrets", "actions": ["read", "create", "update", "delete"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "ingresses", "actions": ["read", "create", "update", "delete"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "statefulsets", "actions": ["read", "create", "update", "delete"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "daemonsets", "actions": ["read", "create", "update", "delete"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "jobs", "actions": ["read", "create", "update", "delete"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "cronjobs", "actions": ["read", "create", "update", "delete"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "events", "actions": ["read"], "clusters": ["*"], "namespaces": ["*"]}
		]`
		
		// Viewer group has read-only access to k8s resources
		viewerPermissions := `[
			{"resource": "clusters", "actions": ["read"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "namespaces", "actions": ["read"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "nodes", "actions": ["read"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "pods", "actions": ["read"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "deployments", "actions": ["read"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "services", "actions": ["read"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "configmaps", "actions": ["read"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "secrets", "actions": ["read"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "ingresses", "actions": ["read"], "clusters": ["*"], "namespaces": ["*"]},
			{"resource": "events", "actions": ["read"], "clusters": ["*"], "namespaces": ["*"]}
		]`
		
		groups := []Group{
			{
				Name:        "admin",
				Description: "Administrators with full access to all resources",
				Permissions: JSON(adminPermissions),
				IsSystem:    true,
			},
			{
				Name:        "editor",
				Description: "Editors with read-write access to Kubernetes resources",
				Permissions: JSON(editorPermissions),
				IsSystem:    true,
			},
			{
				Name:        "viewer",
				Description: "Viewers with read-only access to Kubernetes resources",
				Permissions: JSON(viewerPermissions),
				IsSystem:    true,
			},
		}
		
		if err := db.Create(&groups).Error; err != nil {
			return fmt.Errorf("failed to create groups: %w", err)
		}
		
		log.Info("✅ Default groups with RBAC permissions created successfully")
	}
	
	return nil
}

// InitializeDefaultData creates default admin user with provided password
// This is called from main.go after database initialization
func (db *GormDB) InitializeDefaultData(adminPassword string) error {
	// Check if admin user already exists
	var adminUser User
	result := db.Where("username = ?", "admin").First(&adminUser)
	
	if result.Error != gorm.ErrRecordNotFound {
		// Admin user already exists
		return nil
	}
	
	log.Info("🌱 Creating default admin user...")
	
	// Use provided password or generate random one
	if adminPassword == "" {
		adminPassword = os.Getenv("KUBELENS_ADMIN_PASSWORD")
	}
	
	if adminPassword == "" {
		// Generate random password
		adminPassword = generateRandomPassword(10)
		log.Warnf("⚠️  Default admin password: %s", adminPassword)
		log.Warn("⚠️  Please change this password after first login!")
	} else {
		log.Info("✅ Using provided admin password")
	}
	
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}
	
	adminUser = User{
		Email:        "admin@kubelens.local",
		Username:     "admin",
		PasswordHash: string(hashedPassword),
		FullName:     "Administrator",
		AuthProvider: "local",
		IsActive:     true,
		IsAdmin:      true,
		MFAEnabled:   false,
	}
	
	if err := db.Create(&adminUser).Error; err != nil {
		return fmt.Errorf("failed to create admin user: %w", err)
	}
	
	// Get admin group and assign user to it
	var adminGroup Group
	if err := db.Where("name = ?", "admin").First(&adminGroup).Error; err != nil {
		return fmt.Errorf("failed to find admin group: %w", err)
	}
	
	if err := db.Model(&adminUser).Association("Groups").Append(&adminGroup); err != nil {
		return fmt.Errorf("failed to assign admin to admin group: %w", err)
	}
	
	log.Info("✅ Default admin user created successfully")
	
	return nil
}

// generateRandomPassword generates a random alphanumeric password
func generateRandomPassword(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	password := make([]byte, length)
	for i := range password {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		password[i] = charset[n.Int64()]
	}
	return string(password)
}

// GetDialect returns the database dialect
func (db *GormDB) GetDialect() string {
	return db.dialect
}

// Close closes the database connection
func (db *GormDB) Close() error {
	sqlDB, err := db.DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// =============================================================================
// Extension Configuration Methods
// =============================================================================

// SaveExtensionConfig saves or updates encrypted extension config
func (db *GormDB) SaveExtensionConfig(extensionName string, encryptedConfig string) error {
	config := ExtensionConfig{
		ExtensionName: extensionName,
		ConfigData:    encryptedConfig,
	}
	
	// Upsert: update if exists, create if not
	return db.Where("extension_name = ?", extensionName).
		Assign(ExtensionConfig{ConfigData: encryptedConfig}).
		FirstOrCreate(&config).Error
}

// GetExtensionConfig retrieves encrypted config for an extension
func (db *GormDB) GetExtensionConfig(extensionName string) (string, error) {
	var config ExtensionConfig
	err := db.Where("extension_name = ?", extensionName).First(&config).Error
	if err != nil {
		return "", err
	}
	return config.ConfigData, nil
}

// DeleteExtensionConfig removes config for an extension
func (db *GormDB) DeleteExtensionConfig(extensionName string) error {
	return db.Where("extension_name = ?", extensionName).Delete(&ExtensionConfig{}).Error
}

// GetAllExtensionConfigs retrieves all extension configs
func (db *GormDB) GetAllExtensionConfigs() ([]ExtensionConfig, error) {
	var configs []ExtensionConfig
	err := db.Find(&configs).Error
	return configs, err
}

// =============================================================================
// System Configuration Methods
// =============================================================================

// GetSystemConfig retrieves a system config value by key
func (db *GormDB) GetSystemConfig(key string) (string, error) {
	var config SystemConfig
	err := db.Where("key = ?", key).First(&config).Error
	if err != nil {
		return "", err
	}
	return config.Value, nil
}

// SetSystemConfig creates or updates a system config value
func (db *GormDB) SetSystemConfig(key, value string) error {
	config := SystemConfig{Key: key, Value: value}
	return db.Where("key = ?", key).
		Assign(SystemConfig{Value: value}).
		FirstOrCreate(&config).Error
}

// GetOrCreateEncryptionKey retrieves existing key or auto-generates a new one on first install
func (db *GormDB) GetOrCreateEncryptionKey() ([]byte, error) {
	const keyName = "encryption_key"
	
	// Try to get existing key
	keyB64, err := db.GetSystemConfig(keyName)
	if err == nil && keyB64 != "" {
		// Decode existing key
		key, decodeErr := base64.StdEncoding.DecodeString(keyB64)
		if decodeErr == nil && len(key) == 32 {
			log.Info("🔑 Using existing encryption key from database")
			return key, nil
		}
	}
	
	// Generate new 32-byte key (first install)
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return nil, fmt.Errorf("failed to generate encryption key: %w", err)
	}
	
	// Save to database (base64 encoded)
	keyB64 = base64.StdEncoding.EncodeToString(key)
	if err := db.SetSystemConfig(keyName, keyB64); err != nil {
		return nil, fmt.Errorf("failed to save encryption key: %w", err)
	}
	
	log.Info("🔑 Generated and saved new encryption key to database (first install)")
	return key, nil
}
