package db

import (
	"crypto/rand"
	"database/sql"
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
		&Integration{},
		&IntegrationCluster{},
		&OAuth2Token{},
		&ClusterMetadata{},
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
		log.Info("🌱 Seeding default groups...")
		
		groups := []Group{
			{
				Name:        "admin",
				Description: "Administrators with full access",
				Permissions: JSON(`["*"]`),
				IsSystem:    true,
			},
			{
				Name:        "editor",
				Description: "Editors with read-write access",
				Permissions: JSON(`["read","write"]`),
				IsSystem:    true,
			},
			{
				Name:        "viewer",
				Description: "Viewers with read-only access",
				Permissions: JSON(`["read"]`),
				IsSystem:    true,
			},
		}
		
		if err := db.Create(&groups).Error; err != nil {
			return fmt.Errorf("failed to create groups: %w", err)
		}
		
		log.Info("✅ Default groups created successfully")
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
