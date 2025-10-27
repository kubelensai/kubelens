package db

import (
	"database/sql"
	"encoding/json"

	_ "modernc.org/sqlite"
	log "github.com/sirupsen/logrus"
)

// DB wraps the database connection
type DB struct {
	conn *sql.DB
}

// GetConn returns the underlying *sql.DB connection (for modules)
func (db *DB) GetConn() *sql.DB {
	return db.conn
}

// AuthType represents the authentication method
type AuthType string

const (
	AuthTypeToken      AuthType = "token"
	AuthTypeKubeconfig AuthType = "kubeconfig"
	// Future: gcp, aws, azure, etc.
)

// Cluster represents a stored cluster configuration
type Cluster struct {
	ID         int    `json:"id"`
	Name       string `json:"name"`
	
	// Authentication
	AuthType   string `json:"auth_type"`   // "token", "kubeconfig", etc.
	AuthConfig string `json:"auth_config"` // JSON blob with auth-specific data
	
	// Extracted/computed fields (for display and direct use by cluster manager)
	Server     string `json:"server,omitempty"` // K8s API server (extracted from auth_config)
	CA         string `json:"ca,omitempty"`     // Certificate Authority (extracted, only for "token" type)
	Token      string `json:"token,omitempty"`  // Bearer token (extracted, only for "token" type)
	
	// Metadata
	IsDefault  bool   `json:"is_default"`
	Enabled    bool   `json:"enabled"`
	Status     string `json:"status"` // connected, disconnected, error
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
}

// TokenAuthConfig for token-based authentication
type TokenAuthConfig struct {
	Server string `json:"server"`
	CA     string `json:"ca"`
	Token  string `json:"token"`
}

// KubeconfigAuthConfig for kubeconfig-based authentication
type KubeconfigAuthConfig struct {
	Kubeconfig string `json:"kubeconfig"`
	Context    string `json:"context,omitempty"`
}

// Integration represents a cloud provider integration
type Integration struct {
	ID            int    `json:"id"`
	Name          string `json:"name"`
	Type          string `json:"type"`          // "gcp", "aws", "azure", "prometheus", "datadog"
	Config        string `json:"config"`        // JSON blob for credentials
	AuthMethod    string `json:"auth_method"`   // "oauth2", "service_account", "api_key"
	IsConfigured  bool   `json:"is_configured"` // Whether OAuth2 is set up
	Enabled       bool   `json:"enabled"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`
}

// IntegrationCluster represents a cluster discovered from an integration
type IntegrationCluster struct {
	ID            int    `json:"id"`
	IntegrationID int    `json:"integration_id"`
	ClusterName   string `json:"cluster_name"`
	Kubeconfig    string `json:"kubeconfig"`
	Context       string `json:"context,omitempty"`
	Status        string `json:"status"` // "discovered", "imported", "error"
	LastSynced    string `json:"last_synced"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`
}

// OAuth2Token represents stored OAuth2 tokens for an integration
type OAuth2Token struct {
	ID            int    `json:"id"`
	IntegrationID int    `json:"integration_id"`
	Provider      string `json:"provider"`       // "google", "microsoft", "github"
	AccessToken   string `json:"access_token"`
	RefreshToken  string `json:"refresh_token,omitempty"`
	TokenType     string `json:"token_type"`     // "Bearer"
	Expiry        string `json:"expiry,omitempty"` // ISO 8601 datetime
	IDToken       string `json:"id_token,omitempty"`
	Scopes        string `json:"scopes,omitempty"` // Comma-separated list
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`
}

// User represents a user account
type User struct {
	ID             int    `json:"id"`
	Email          string `json:"email"`
	Username       string `json:"username"`
	PasswordHash   string `json:"-"` // Never expose in JSON
	FullName       string `json:"full_name,omitempty"`
	AvatarURL      string `json:"avatar_url,omitempty"`
	AuthProvider   string `json:"auth_provider"`    // "local", "google"
	ProviderUserID string `json:"provider_user_id,omitempty"` // External user ID
	IsActive       bool   `json:"is_active"`
	IsAdmin        bool   `json:"is_admin"`
	LastLogin      string `json:"last_login,omitempty"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}

// Group represents a user group with RBAC permissions
type Group struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	IsSystem    bool   `json:"is_system"` // System groups (admin, users, etc.)
	Permissions string `json:"-"` // JSON array of permissions (stored as string in DB)
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

// MarshalJSON customizes JSON marshalling for Group to parse permissions
func (g Group) MarshalJSON() ([]byte, error) {
	type Alias Group
	var permissions []Permission
	if g.Permissions != "" {
		if err := json.Unmarshal([]byte(g.Permissions), &permissions); err != nil {
			permissions = []Permission{} // Return empty array on error
		}
	} else {
		permissions = []Permission{}
	}
	
	return json.Marshal(&struct {
		Permissions []Permission `json:"permissions"`
		*Alias
	}{
		Permissions: permissions,
		Alias:       (*Alias)(&g),
	})
}

// Permission represents a single permission entry
type Permission struct {
	Resource   string   `json:"resource"`   // "clusters", "pods", "deployments", etc.
	Actions    []string `json:"actions"`    // ["read", "create", "update", "delete"]
	Clusters   []string `json:"clusters"`   // ["*"] for all or specific cluster names
	Namespaces []string `json:"namespaces"` // ["*"] for all or specific namespace names
}

// UserSession represents user's current session state
type UserSession struct {
	ID                int    `json:"id"`
	UserID            int    `json:"user_id"`
	SelectedCluster   string `json:"selected_cluster,omitempty"`
	SelectedNamespace string `json:"selected_namespace,omitempty"`
	SelectedTheme     string `json:"selected_theme,omitempty"` // "light" or "dark"
	UpdatedAt         string `json:"updated_at"`
}

// Notification represents a user notification
type Notification struct {
	ID        int    `json:"id"`
	UserID    int    `json:"user_id"`
	Type      string `json:"type"` // success, error, warning, info
	Title     string `json:"title"`
	Message   string `json:"message"`
	Read      bool   `json:"read"`
	CreatedAt string `json:"created_at"`
}

// UserGroup represents the many-to-many relationship between users and groups
type UserGroup struct {
	ID        int    `json:"id"`
	UserID    int    `json:"user_id"`
	GroupID   int    `json:"group_id"`
	CreatedAt string `json:"created_at"`
}

// Session represents a user session (for refresh tokens)
type Session struct {
	ID           int    `json:"id"`
	UserID       int    `json:"user_id"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    string `json:"expires_at"`
	CreatedAt    string `json:"created_at"`
}

// New creates a new database connection and initializes tables
func New(path string) (*DB, error) {
	conn, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}

	db := &DB{conn: conn}

	if err := db.init(); err != nil {
		return nil, err
	}

	return db, nil
}

// Close closes the database connection
func (db *DB) Close() error {
	return db.conn.Close()
}

// init creates the necessary tables
func (db *DB) init() error {
	// New schema with extensible auth support
	schema := `
	CREATE TABLE IF NOT EXISTS clusters (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT UNIQUE NOT NULL,
		
		-- Authentication (extensible)
		auth_type TEXT NOT NULL DEFAULT 'token',
		auth_config TEXT NOT NULL,
		
		-- Extracted/computed fields (for display and direct use)
		server TEXT,
		ca TEXT,
		token TEXT,
		
		-- Metadata
		is_default BOOLEAN DEFAULT 0,
		enabled BOOLEAN DEFAULT 1,
		status TEXT DEFAULT 'unknown',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS cluster_metadata (
		cluster_id INTEGER PRIMARY KEY,
		version TEXT,
		nodes_count INTEGER,
		namespaces_count INTEGER,
		last_synced DATETIME,
		metadata TEXT,
		FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS integrations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT UNIQUE NOT NULL,
		type TEXT NOT NULL,
		config TEXT NOT NULL,
		auth_method TEXT DEFAULT 'oauth2',
		is_configured BOOLEAN DEFAULT 0,
		enabled BOOLEAN DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS integration_clusters (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		integration_id INTEGER NOT NULL,
		cluster_name TEXT NOT NULL,
		kubeconfig TEXT NOT NULL,
		context TEXT,
		status TEXT DEFAULT 'discovered',
		last_synced DATETIME DEFAULT CURRENT_TIMESTAMP,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(integration_id, cluster_name),
		FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS oauth2_tokens (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		integration_id INTEGER NOT NULL,
		provider TEXT NOT NULL,
		access_token TEXT NOT NULL,
		refresh_token TEXT,
		token_type TEXT DEFAULT 'Bearer',
		expiry DATETIME,
		id_token TEXT,
		scopes TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(integration_id, provider),
		FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT UNIQUE NOT NULL,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT,
		full_name TEXT,
		avatar_url TEXT,
		auth_provider TEXT DEFAULT 'local',
		provider_user_id TEXT,
		is_active BOOLEAN DEFAULT 1,
		is_admin BOOLEAN DEFAULT 0,
		last_login DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(auth_provider, provider_user_id)
	);

	CREATE TABLE IF NOT EXISTS groups (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT UNIQUE NOT NULL,
		description TEXT,
		is_system BOOLEAN DEFAULT 0,
		permissions TEXT DEFAULT '[]',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS user_groups (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		group_id INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(user_id, group_id),
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS sessions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		refresh_token TEXT UNIQUE NOT NULL,
		expires_at DATETIME NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS user_sessions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER UNIQUE NOT NULL,
		selected_cluster TEXT,
		selected_namespace TEXT,
		selected_theme TEXT DEFAULT 'dark',
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS notifications (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		type TEXT NOT NULL CHECK(type IN ('success', 'error', 'warning', 'info')),
		title TEXT NOT NULL,
		message TEXT NOT NULL,
		read BOOLEAN NOT NULL DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_clusters_auth_type ON clusters(auth_type);
	CREATE INDEX IF NOT EXISTS idx_clusters_enabled ON clusters(enabled);
	CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type);
	CREATE INDEX IF NOT EXISTS idx_integrations_configured ON integrations(is_configured);
	CREATE INDEX IF NOT EXISTS idx_integration_clusters_integration_id ON integration_clusters(integration_id);
	CREATE INDEX IF NOT EXISTS idx_oauth2_tokens_integration_id ON oauth2_tokens(integration_id);
	CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
	CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
	CREATE INDEX IF NOT EXISTS idx_oauth2_tokens_provider ON oauth2_tokens(provider);
	CREATE INDEX IF NOT EXISTS idx_oauth2_tokens_expiry ON oauth2_tokens(expiry);
	CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
	CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
	CREATE INDEX IF NOT EXISTS idx_users_provider ON users(auth_provider, provider_user_id);
	CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON user_groups(user_id);
	CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON user_groups(group_id);
	CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
	CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
	CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
	`

	// Check if table exists with old schema
	var tableExists bool
	err := db.conn.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='clusters'`).Scan(&tableExists)
	if err != nil {
		return err
	}

	if tableExists {
		// Check if it's old schema (has ca, token columns but no auth_type)
		var hasAuthType bool
		err = db.conn.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('clusters') WHERE name='auth_type'`).Scan(&hasAuthType)
		if err == nil && !hasAuthType {
			log.Info("Detected old schema. Migrating to new extensible schema...")
			
			if err := db.migrateFromOldSchema(); err != nil {
				log.Errorf("Migration failed: %v", err)
				return err
			}
			
			log.Info("✅ Successfully migrated to new schema!")
			return nil
		}
	}

	// Create tables if they don't exist
	_, err = db.conn.Exec(schema)
	if err != nil {
		return err
	}

	// Add columns if they don't exist (for partial migrations)
	migrations := []string{
		`ALTER TABLE clusters ADD COLUMN auth_type TEXT DEFAULT 'token'`,
		`ALTER TABLE clusters ADD COLUMN auth_config TEXT`,
		`ALTER TABLE clusters ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
	}

	for _, migration := range migrations {
		_, err = db.conn.Exec(migration)
		// Ignore duplicate column errors
		if err != nil && err.Error() != "duplicate column name: auth_type" &&
			err.Error() != "duplicate column name: auth_config" &&
			err.Error() != "duplicate column name: updated_at" {
			log.Warnf("Migration warning: %v", err)
		}
	}

	return nil
}

// migrateFromOldSchema migrates data from old schema (server, ca, token) to new schema (auth_type, auth_config)
func (db *DB) migrateFromOldSchema() error {
	// Step 1: Get all existing clusters
	query := `SELECT id, name, server, ca, token, is_default, enabled, status, created_at FROM clusters`
	rows, err := db.conn.Query(query)
	if err != nil {
		return err
	}
	defer rows.Close()

	type oldCluster struct {
		ID        int
		Name      string
		Server    string
		CA        string
		Token     string
		IsDefault bool
		Enabled   bool
		Status    string
		CreatedAt string
	}

	var oldClusters []oldCluster
	for rows.Next() {
		var c oldCluster
		if err := rows.Scan(&c.ID, &c.Name, &c.Server, &c.CA, &c.Token, &c.IsDefault, &c.Enabled, &c.Status, &c.CreatedAt); err != nil {
			return err
		}
		oldClusters = append(oldClusters, c)
	}

	log.Infof("Found %d clusters to migrate", len(oldClusters))

	// Step 2: Backup old table
	_, err = db.conn.Exec(`CREATE TABLE IF NOT EXISTS clusters_backup_` + db.getTimestamp() + ` AS SELECT * FROM clusters`)
	if err != nil {
		log.Warnf("Failed to backup: %v", err)
	}

	// Step 3: Drop old table
	_, err = db.conn.Exec(`DROP TABLE clusters`)
	if err != nil {
		return err
	}

	// Step 4: Create new schema
	schema := `
	CREATE TABLE clusters (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT UNIQUE NOT NULL,
		auth_type TEXT NOT NULL DEFAULT 'token',
		auth_config TEXT NOT NULL,
		server TEXT,
		is_default BOOLEAN DEFAULT 0,
		enabled BOOLEAN DEFAULT 1,
		status TEXT DEFAULT 'unknown',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE INDEX idx_clusters_auth_type ON clusters(auth_type);
	CREATE INDEX idx_clusters_enabled ON clusters(enabled);
	`
	_, err = db.conn.Exec(schema)
	if err != nil {
		return err
	}

	// Step 5: Migrate data to new schema
	for _, old := range oldClusters {
		// Convert old format to new format
		authConfig := TokenAuthConfig{
			Server: old.Server,
			CA:     old.CA,
			Token:  old.Token,
		}
		
		authConfigJSON, err := json.Marshal(authConfig)
		if err != nil {
			log.Warnf("Failed to marshal auth config for cluster %s: %v", old.Name, err)
			continue
		}

		insertQuery := `
			INSERT INTO clusters (name, auth_type, auth_config, server, is_default, enabled, status, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`
		_, err = db.conn.Exec(insertQuery, old.Name, "token", string(authConfigJSON), old.Server, old.IsDefault, old.Enabled, old.Status, old.CreatedAt, old.CreatedAt)
		if err != nil {
			log.Errorf("Failed to migrate cluster %s: %v", old.Name, err)
		} else {
			log.Infof("✅ Migrated cluster: %s", old.Name)
		}
	}

	return nil
}

// getTimestamp returns current timestamp for backup naming
func (db *DB) getTimestamp() string {
	var timestamp string
	db.conn.QueryRow(`SELECT strftime('%Y%m%d%H%M%S', 'now')`).Scan(&timestamp)
	return timestamp
}

// SaveCluster saves a cluster configuration
func (db *DB) SaveCluster(cluster *Cluster) error {
	query := `
		INSERT INTO clusters (name, auth_type, auth_config, server, ca, token, is_default, enabled, status, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(name) DO UPDATE SET
			auth_type = excluded.auth_type,
			auth_config = excluded.auth_config,
			server = excluded.server,
			ca = excluded.ca,
			token = excluded.token,
			is_default = excluded.is_default,
			enabled = excluded.enabled,
			status = excluded.status,
			updated_at = datetime('now')
	`

	result, err := db.conn.Exec(query, cluster.Name, cluster.AuthType, cluster.AuthConfig, cluster.Server, cluster.CA, cluster.Token, cluster.IsDefault, cluster.Enabled, cluster.Status)
	if err != nil {
		return err
	}

	id, err := result.LastInsertId()
	if err == nil {
		cluster.ID = int(id)
	}

	return nil
}

// GetCluster retrieves a cluster by name
func (db *DB) GetCluster(name string) (*Cluster, error) {
	query := `SELECT id, name, auth_type, auth_config, server, ca, token, is_default, enabled, status, created_at, updated_at FROM clusters WHERE name = ?`

	var cluster Cluster
	var authConfigSQL, serverSQL, caSQL, tokenSQL sql.NullString
	err := db.conn.QueryRow(query, name).Scan(
		&cluster.ID,
		&cluster.Name,
		&cluster.AuthType,
		&authConfigSQL,
		&serverSQL,
		&caSQL,
		&tokenSQL,
		&cluster.IsDefault,
		&cluster.Enabled,
		&cluster.Status,
		&cluster.CreatedAt,
		&cluster.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	cluster.AuthConfig = authConfigSQL.String
	cluster.Server = serverSQL.String
	cluster.CA = caSQL.String
	cluster.Token = tokenSQL.String

	return &cluster, nil
}

// ListClusters retrieves all clusters
func (db *DB) ListClusters() ([]*Cluster, error) {
	query := `SELECT id, name, auth_type, auth_config, server, ca, token, is_default, enabled, status, created_at, updated_at FROM clusters ORDER BY is_default DESC, name ASC`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clusters []*Cluster
	for rows.Next() {
		var cluster Cluster
		var authConfigSQL, serverSQL, caSQL, tokenSQL sql.NullString
		if err := rows.Scan(
			&cluster.ID,
			&cluster.Name,
			&cluster.AuthType,
			&authConfigSQL,
			&serverSQL,
			&caSQL,
			&tokenSQL,
			&cluster.IsDefault,
			&cluster.Enabled,
			&cluster.Status,
			&cluster.CreatedAt,
			&cluster.UpdatedAt,
		); err != nil {
			return nil, err
		}
		cluster.AuthConfig = authConfigSQL.String
		cluster.Server = serverSQL.String
		cluster.CA = caSQL.String
		cluster.Token = tokenSQL.String
		clusters = append(clusters, &cluster)
	}

	return clusters, nil
}

// ListEnabledClusters retrieves only enabled clusters
func (db *DB) ListEnabledClusters() ([]*Cluster, error) {
	query := `SELECT id, name, auth_type, auth_config, server, ca, token, is_default, enabled, status, created_at, updated_at FROM clusters WHERE enabled = 1 ORDER BY is_default DESC, name ASC`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clusters []*Cluster
	for rows.Next() {
		var cluster Cluster
		var authConfigSQL, serverSQL, caSQL, tokenSQL sql.NullString
		if err := rows.Scan(
			&cluster.ID,
			&cluster.Name,
			&cluster.AuthType,
			&authConfigSQL,
			&serverSQL,
			&caSQL,
			&tokenSQL,
			&cluster.IsDefault,
			&cluster.Enabled,
			&cluster.Status,
			&cluster.CreatedAt,
			&cluster.UpdatedAt,
		); err != nil {
			return nil, err
		}
		cluster.AuthConfig = authConfigSQL.String
		cluster.Server = serverSQL.String
		cluster.CA = caSQL.String
		cluster.Token = tokenSQL.String
		clusters = append(clusters, &cluster)
	}

	return clusters, nil
}

// UpdateClusterEnabled updates the enabled status of a cluster
func (db *DB) UpdateClusterEnabled(name string, enabled bool) error {
	query := `UPDATE clusters SET enabled = ?, updated_at = datetime('now') WHERE name = ?`
	_, err := db.conn.Exec(query, enabled, name)
	return err
}

// UpdateClusterStatus updates the status of a cluster
func (db *DB) UpdateClusterStatus(name string, status string) error {
	query := `UPDATE clusters SET status = ?, updated_at = datetime('now') WHERE name = ?`
	_, err := db.conn.Exec(query, status, name)
	return err
}

// DeleteCluster removes a cluster by name
func (db *DB) DeleteCluster(name string) error {
	query := `DELETE FROM clusters WHERE name = ?`
	_, err := db.conn.Exec(query, name)
	return err
}

// UpdateClusterMetadata updates cluster metadata
func (db *DB) UpdateClusterMetadata(clusterID int, metadata map[string]interface{}) error {
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO cluster_metadata (cluster_id, version, nodes_count, namespaces_count, metadata, last_synced)
		VALUES (?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(cluster_id) DO UPDATE SET
			version = excluded.version,
			nodes_count = excluded.nodes_count,
			namespaces_count = excluded.namespaces_count,
			metadata = excluded.metadata,
			last_synced = excluded.last_synced
	`

	_, err = db.conn.Exec(query,
		clusterID,
		metadata["version"],
		metadata["nodes_count"],
		metadata["namespaces_count"],
		string(metadataJSON),
	)

	return err
}

// ============================================================================
// Integration Management Methods
// ============================================================================

// SaveIntegration saves an integration configuration
func (db *DB) SaveIntegration(integration *Integration) error {
	query := `
		INSERT INTO integrations (name, type, config, enabled, updated_at)
		VALUES (?, ?, ?, ?, datetime('now'))
		ON CONFLICT(name) DO UPDATE SET
			type = excluded.type,
			config = excluded.config,
			enabled = excluded.enabled,
			updated_at = datetime('now')
	`
	result, err := db.conn.Exec(query, integration.Name, integration.Type, integration.Config, integration.Enabled)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err == nil {
		integration.ID = int(id)
	}
	return nil
}

// GetIntegration retrieves an integration by name
func (db *DB) GetIntegration(name string) (*Integration, error) {
	query := `SELECT id, name, type, config, enabled, created_at, updated_at FROM integrations WHERE name = ?`
	var integration Integration
	var configSQL sql.NullString
	err := db.conn.QueryRow(query, name).Scan(
		&integration.ID,
		&integration.Name,
		&integration.Type,
		&configSQL,
		&integration.Enabled,
		&integration.CreatedAt,
		&integration.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	integration.Config = configSQL.String
	return &integration, nil
}

// GetIntegrationByID retrieves an integration by ID
func (db *DB) GetIntegrationByID(id int) (*Integration, error) {
	query := `SELECT id, name, type, config, enabled, created_at, updated_at FROM integrations WHERE id = ?`
	var integration Integration
	var configSQL sql.NullString
	err := db.conn.QueryRow(query, id).Scan(
		&integration.ID,
		&integration.Name,
		&integration.Type,
		&configSQL,
		&integration.Enabled,
		&integration.CreatedAt,
		&integration.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	integration.Config = configSQL.String
	return &integration, nil
}

// GetIntegrationByType retrieves an integration by type
func (db *DB) GetIntegrationByType(integrationType string) (*Integration, error) {
	query := `SELECT id, name, type, config, enabled, auth_method, is_configured, created_at, updated_at FROM integrations WHERE type = ?`
	var integration Integration
	var configSQL sql.NullString
	var authMethodSQL sql.NullString
	err := db.conn.QueryRow(query, integrationType).Scan(
		&integration.ID,
		&integration.Name,
		&integration.Type,
		&configSQL,
		&integration.Enabled,
		&authMethodSQL,
		&integration.IsConfigured,
		&integration.CreatedAt,
		&integration.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	integration.Config = configSQL.String
	integration.AuthMethod = authMethodSQL.String
	return &integration, nil
}

// ListIntegrations retrieves all integrations
func (db *DB) ListIntegrations() ([]*Integration, error) {
	query := `SELECT id, name, type, config, enabled, auth_method, is_configured, created_at, updated_at FROM integrations ORDER BY name ASC`
	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var integrations []*Integration
	for rows.Next() {
		var integration Integration
		var configSQL sql.NullString
		var authMethodSQL sql.NullString
		if err := rows.Scan(
			&integration.ID,
			&integration.Name,
			&integration.Type,
			&configSQL,
			&integration.Enabled,
			&authMethodSQL,
			&integration.IsConfigured,
			&integration.CreatedAt,
			&integration.UpdatedAt,
		); err != nil {
			return nil, err
		}
		integration.Config = configSQL.String
		integration.AuthMethod = authMethodSQL.String
		integrations = append(integrations, &integration)
	}
	return integrations, nil
}

// DeleteIntegration removes an integration by name
func (db *DB) DeleteIntegration(name string) error {
	query := `DELETE FROM integrations WHERE name = ?`
	_, err := db.conn.Exec(query, name)
	return err
}

// SaveIntegrationCluster saves a discovered cluster from an integration
func (db *DB) SaveIntegrationCluster(integrationCluster *IntegrationCluster) error {
	query := `
		INSERT INTO integration_clusters (integration_id, cluster_name, kubeconfig, context, status, last_synced, updated_at)
		VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
		ON CONFLICT(integration_id, cluster_name) DO UPDATE SET
			kubeconfig = excluded.kubeconfig,
			context = excluded.context,
			status = excluded.status,
			last_synced = excluded.last_synced,
			updated_at = datetime('now')
	`
	result, err := db.conn.Exec(query,
		integrationCluster.IntegrationID,
		integrationCluster.ClusterName,
		integrationCluster.Kubeconfig,
		integrationCluster.Context,
		integrationCluster.Status,
	)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err == nil {
		integrationCluster.ID = int(id)
	}
	return nil
}

// ListIntegrationClusters retrieves all discovered clusters for a given integration
func (db *DB) ListIntegrationClusters(integrationID int) ([]*IntegrationCluster, error) {
	query := `SELECT id, integration_id, cluster_name, kubeconfig, context, status, last_synced, created_at, updated_at FROM integration_clusters WHERE integration_id = ? ORDER BY cluster_name ASC`
	rows, err := db.conn.Query(query, integrationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var integrationClusters []*IntegrationCluster
	for rows.Next() {
		var integrationCluster IntegrationCluster
		var kubeconfigSQL, contextSQL sql.NullString
		if err := rows.Scan(
			&integrationCluster.ID,
			&integrationCluster.IntegrationID,
			&integrationCluster.ClusterName,
			&kubeconfigSQL,
			&contextSQL,
			&integrationCluster.Status,
			&integrationCluster.LastSynced,
			&integrationCluster.CreatedAt,
			&integrationCluster.UpdatedAt,
		); err != nil {
			return nil, err
		}
		integrationCluster.Kubeconfig = kubeconfigSQL.String
		integrationCluster.Context = contextSQL.String
		integrationClusters = append(integrationClusters, &integrationCluster)
	}
	return integrationClusters, nil
}

// GetIntegrationCluster retrieves a specific discovered cluster
func (db *DB) GetIntegrationCluster(integrationID int, clusterName string) (*IntegrationCluster, error) {
	query := `SELECT id, integration_id, cluster_name, kubeconfig, context, status, last_synced, created_at, updated_at FROM integration_clusters WHERE integration_id = ? AND cluster_name = ?`
	var integrationCluster IntegrationCluster
	var kubeconfigSQL, contextSQL sql.NullString
	err := db.conn.QueryRow(query, integrationID, clusterName).Scan(
		&integrationCluster.ID,
		&integrationCluster.IntegrationID,
		&integrationCluster.ClusterName,
		&kubeconfigSQL,
		&contextSQL,
		&integrationCluster.Status,
		&integrationCluster.LastSynced,
		&integrationCluster.CreatedAt,
		&integrationCluster.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	integrationCluster.Kubeconfig = kubeconfigSQL.String
	integrationCluster.Context = contextSQL.String
	return &integrationCluster, nil
}

// SaveOAuth2Token saves or updates OAuth2 tokens for an integration
func (db *DB) SaveOAuth2Token(token *OAuth2Token) error {
	query := `
	INSERT INTO oauth2_tokens (integration_id, provider, access_token, refresh_token, token_type, expiry, id_token, scopes, updated_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
	ON CONFLICT(integration_id, provider) DO UPDATE SET
		access_token = excluded.access_token,
		refresh_token = excluded.refresh_token,
		token_type = excluded.token_type,
		expiry = excluded.expiry,
		id_token = excluded.id_token,
		scopes = excluded.scopes,
		updated_at = CURRENT_TIMESTAMP
	`

	result, err := db.conn.Exec(query,
		token.IntegrationID,
		token.Provider,
		token.AccessToken,
		sql.NullString{String: token.RefreshToken, Valid: token.RefreshToken != ""},
		token.TokenType,
		sql.NullString{String: token.Expiry, Valid: token.Expiry != ""},
		sql.NullString{String: token.IDToken, Valid: token.IDToken != ""},
		sql.NullString{String: token.Scopes, Valid: token.Scopes != ""},
	)
	if err != nil {
		return err
	}

	if token.ID == 0 {
		id, err := result.LastInsertId()
		if err == nil {
			token.ID = int(id)
		}
	}

	return nil
}

// GetOAuth2Token retrieves OAuth2 tokens for an integration
func (db *DB) GetOAuth2Token(integrationID int, provider string) (*OAuth2Token, error) {
	var token OAuth2Token
	var refreshTokenSQL, expirySQL, idTokenSQL, scopesSQL sql.NullString

	query := `
	SELECT id, integration_id, provider, access_token, refresh_token, token_type, expiry, id_token, scopes, created_at, updated_at
	FROM oauth2_tokens
	WHERE integration_id = ? AND provider = ?
	`

	err := db.conn.QueryRow(query, integrationID, provider).Scan(
		&token.ID,
		&token.IntegrationID,
		&token.Provider,
		&token.AccessToken,
		&refreshTokenSQL,
		&token.TokenType,
		&expirySQL,
		&idTokenSQL,
		&scopesSQL,
		&token.CreatedAt,
		&token.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	token.RefreshToken = refreshTokenSQL.String
	token.Expiry = expirySQL.String
	token.IDToken = idTokenSQL.String
	token.Scopes = scopesSQL.String

	return &token, nil
}

// DeleteOAuth2Token deletes OAuth2 tokens for an integration
func (db *DB) DeleteOAuth2Token(integrationID int, provider string) error {
	query := `DELETE FROM oauth2_tokens WHERE integration_id = ? AND provider = ?`
	_, err := db.conn.Exec(query, integrationID, provider)
	return err
}

// ListOAuth2Tokens lists all OAuth2 tokens for an integration
func (db *DB) ListOAuth2Tokens(integrationID int) ([]*OAuth2Token, error) {
	query := `
	SELECT id, integration_id, provider, access_token, refresh_token, token_type, expiry, id_token, scopes, created_at, updated_at
	FROM oauth2_tokens
	WHERE integration_id = ?
	`

	rows, err := db.conn.Query(query, integrationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tokens []*OAuth2Token
	for rows.Next() {
		var token OAuth2Token
		var refreshTokenSQL, expirySQL, idTokenSQL, scopesSQL sql.NullString

		err := rows.Scan(
			&token.ID,
			&token.IntegrationID,
			&token.Provider,
			&token.AccessToken,
			&refreshTokenSQL,
			&token.TokenType,
			&expirySQL,
			&idTokenSQL,
			&scopesSQL,
			&token.CreatedAt,
			&token.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		token.RefreshToken = refreshTokenSQL.String
		token.Expiry = expirySQL.String
		token.IDToken = idTokenSQL.String
		token.Scopes = scopesSQL.String

		tokens = append(tokens, &token)
	}

	return tokens, rows.Err()
}

// UpdateIntegrationConfigured updates the is_configured status of an integration
func (db *DB) UpdateIntegrationConfigured(id int, isConfigured bool) error {
	query := `UPDATE integrations SET is_configured = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
	_, err := db.conn.Exec(query, isConfigured, id)
	return err
}

// ========== User Management ==========

// CreateUser creates a new user
func (db *DB) CreateUser(user *User) error {
	query := `
	INSERT INTO users (email, username, password_hash, full_name, avatar_url, auth_provider, provider_user_id, is_active, is_admin)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	result, err := db.conn.Exec(query,
		user.Email,
		user.Username,
		user.PasswordHash,
		sql.NullString{String: user.FullName, Valid: user.FullName != ""},
		sql.NullString{String: user.AvatarURL, Valid: user.AvatarURL != ""},
		user.AuthProvider,
		sql.NullString{String: user.ProviderUserID, Valid: user.ProviderUserID != ""},
		user.IsActive,
		user.IsAdmin,
	)
	if err != nil {
		return err
	}

	id, err := result.LastInsertId()
	if err == nil {
		user.ID = int(id)
	}

	return nil
}

// GetUserByID retrieves a user by ID
func (db *DB) GetUserByID(id int) (*User, error) {
	var user User
	var fullNameSQL, avatarURLSQL, providerUserIDSQL, lastLoginSQL sql.NullString

	query := `
	SELECT id, email, username, password_hash, full_name, avatar_url, auth_provider, provider_user_id, is_active, is_admin, last_login, created_at, updated_at
	FROM users
	WHERE id = ?
	`

	err := db.conn.QueryRow(query, id).Scan(
		&user.ID,
		&user.Email,
		&user.Username,
		&user.PasswordHash,
		&fullNameSQL,
		&avatarURLSQL,
		&user.AuthProvider,
		&providerUserIDSQL,
		&user.IsActive,
		&user.IsAdmin,
		&lastLoginSQL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	user.FullName = fullNameSQL.String
	user.AvatarURL = avatarURLSQL.String
	user.ProviderUserID = providerUserIDSQL.String
	user.LastLogin = lastLoginSQL.String

	return &user, nil
}

// GetUserByEmail retrieves a user by email
func (db *DB) GetUserByEmail(email string) (*User, error) {
	var user User
	var fullNameSQL, avatarURLSQL, providerUserIDSQL, lastLoginSQL sql.NullString

	query := `
	SELECT id, email, username, password_hash, full_name, avatar_url, auth_provider, provider_user_id, is_active, is_admin, last_login, created_at, updated_at
	FROM users
	WHERE email = ?
	`

	err := db.conn.QueryRow(query, email).Scan(
		&user.ID,
		&user.Email,
		&user.Username,
		&user.PasswordHash,
		&fullNameSQL,
		&avatarURLSQL,
		&user.AuthProvider,
		&providerUserIDSQL,
		&user.IsActive,
		&user.IsAdmin,
		&lastLoginSQL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	user.FullName = fullNameSQL.String
	user.AvatarURL = avatarURLSQL.String
	user.ProviderUserID = providerUserIDSQL.String
	user.LastLogin = lastLoginSQL.String

	return &user, nil
}

// GetUserByProvider retrieves a user by auth provider and provider user ID
func (db *DB) GetUserByProvider(provider, providerUserID string) (*User, error) {
	var user User
	var fullNameSQL, avatarURLSQL, lastLoginSQL sql.NullString

	query := `
	SELECT id, email, username, password_hash, full_name, avatar_url, auth_provider, provider_user_id, is_active, is_admin, last_login, created_at, updated_at
	FROM users
	WHERE auth_provider = ? AND provider_user_id = ?
	`

	err := db.conn.QueryRow(query, provider, providerUserID).Scan(
		&user.ID,
		&user.Email,
		&user.Username,
		&user.PasswordHash,
		&fullNameSQL,
		&avatarURLSQL,
		&user.AuthProvider,
		&user.ProviderUserID,
		&user.IsActive,
		&user.IsAdmin,
		&lastLoginSQL,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	user.FullName = fullNameSQL.String
	user.AvatarURL = avatarURLSQL.String
	user.LastLogin = lastLoginSQL.String

	return &user, nil
}

// ListUsers retrieves all users
func (db *DB) ListUsers() ([]*User, error) {
	query := `
	SELECT id, email, username, full_name, avatar_url, auth_provider, provider_user_id, is_active, is_admin, last_login, created_at, updated_at
	FROM users
	ORDER BY created_at DESC
	`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*User
	for rows.Next() {
		var user User
		var fullNameSQL, avatarURLSQL, providerUserIDSQL, lastLoginSQL sql.NullString

		if err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.Username,
			&fullNameSQL,
			&avatarURLSQL,
			&user.AuthProvider,
			&providerUserIDSQL,
			&user.IsActive,
			&user.IsAdmin,
			&lastLoginSQL,
			&user.CreatedAt,
			&user.UpdatedAt,
		); err != nil {
			return nil, err
		}

		user.FullName = fullNameSQL.String
		user.AvatarURL = avatarURLSQL.String
		user.ProviderUserID = providerUserIDSQL.String
		user.LastLogin = lastLoginSQL.String

		users = append(users, &user)
	}

	return users, rows.Err()
}

// UpdateUser updates a user
func (db *DB) UpdateUser(user *User) error {
	query := `
	UPDATE users
	SET email = ?, username = ?, full_name = ?, avatar_url = ?, is_active = ?, is_admin = ?, updated_at = CURRENT_TIMESTAMP
	WHERE id = ?
	`
	_, err := db.conn.Exec(query,
		user.Email,
		user.Username,
		sql.NullString{String: user.FullName, Valid: user.FullName != ""},
		sql.NullString{String: user.AvatarURL, Valid: user.AvatarURL != ""},
		user.IsActive,
		user.IsAdmin,
		user.ID,
	)
	return err
}

// UpdateUserLastLogin updates the last login timestamp
func (db *DB) UpdateUserLastLogin(userID int) error {
	query := `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`
	_, err := db.conn.Exec(query, userID)
	return err
}

// DeleteUser deletes a user
func (db *DB) DeleteUser(id int) error {
	query := `DELETE FROM users WHERE id = ?`
	_, err := db.conn.Exec(query, id)
	return err
}

// ========== Group Management ==========

// CreateGroup creates a new group
func (db *DB) CreateGroup(group *Group) error {
	query := `
	INSERT INTO groups (name, description, is_system, permissions)
	VALUES (?, ?, ?, ?)
	`
	
	// Ensure permissions is valid JSON
	if group.Permissions == "" {
		group.Permissions = "[]"
	}
	
	result, err := db.conn.Exec(query,
		group.Name,
		sql.NullString{String: group.Description, Valid: group.Description != ""},
		group.IsSystem,
		group.Permissions,
	)
	if err != nil {
		return err
	}

	id, err := result.LastInsertId()
	if err == nil {
		group.ID = int(id)
	}

	return nil
}

// GetGroupByID retrieves a group by ID
func (db *DB) GetGroupByID(id int) (*Group, error) {
	var group Group
	var descriptionSQL sql.NullString

	query := `SELECT id, name, description, is_system, permissions, created_at, updated_at FROM groups WHERE id = ?`

	err := db.conn.QueryRow(query, id).Scan(
		&group.ID,
		&group.Name,
		&descriptionSQL,
		&group.IsSystem,
		&group.Permissions,
		&group.CreatedAt,
		&group.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	group.Description = descriptionSQL.String

	return &group, nil
}

// ListGroups retrieves all groups
func (db *DB) ListGroups() ([]*Group, error) {
	query := `SELECT id, name, description, is_system, permissions, created_at, updated_at FROM groups ORDER BY name ASC`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	groups := make([]*Group, 0) // Initialize with empty slice instead of nil
	for rows.Next() {
		var group Group
		var descriptionSQL sql.NullString

		if err := rows.Scan(
			&group.ID,
			&group.Name,
			&descriptionSQL,
			&group.IsSystem,
			&group.Permissions,
			&group.CreatedAt,
			&group.UpdatedAt,
		); err != nil {
			return nil, err
		}

		group.Description = descriptionSQL.String
		groups = append(groups, &group)
	}

	return groups, rows.Err()
}

// UpdateGroup updates a group's information
func (db *DB) UpdateGroup(group *Group) error {
	query := `
	UPDATE groups 
	SET name = ?, description = ?, permissions = ?, updated_at = CURRENT_TIMESTAMP
	WHERE id = ?
	`
	
	// Ensure permissions is valid JSON
	if group.Permissions == "" {
		group.Permissions = "[]"
	}
	
	_, err := db.conn.Exec(query,
		group.Name,
		sql.NullString{String: group.Description, Valid: group.Description != ""},
		group.Permissions,
		group.ID,
	)
	return err
}

// DeleteGroup deletes a group (only non-system groups)
func (db *DB) DeleteGroup(id int) error {
	query := `DELETE FROM groups WHERE id = ? AND is_system = 0`
	_, err := db.conn.Exec(query, id)
	return err
}

// AddUserToGroup adds a user to a group
func (db *DB) AddUserToGroup(userID, groupID int) error {
	query := `INSERT INTO user_groups (user_id, group_id) VALUES (?, ?)`
	_, err := db.conn.Exec(query, userID, groupID)
	return err
}

// RemoveUserFromGroup removes a user from a group
func (db *DB) RemoveUserFromGroup(userID, groupID int) error {
	query := `DELETE FROM user_groups WHERE user_id = ? AND group_id = ?`
	_, err := db.conn.Exec(query, userID, groupID)
	return err
}

// GetUserGroups retrieves all groups for a user
func (db *DB) GetUserGroups(userID int) ([]*Group, error) {
	query := `
	SELECT g.id, g.name, g.description, g.is_system, g.created_at, g.updated_at
	FROM groups g
	INNER JOIN user_groups ug ON g.id = ug.group_id
	WHERE ug.user_id = ?
	ORDER BY g.name ASC
	`

	rows, err := db.conn.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []*Group
	for rows.Next() {
		var group Group
		var descriptionSQL sql.NullString

		if err := rows.Scan(
			&group.ID,
			&group.Name,
			&descriptionSQL,
			&group.IsSystem,
			&group.CreatedAt,
			&group.UpdatedAt,
		); err != nil {
			return nil, err
		}

		group.Description = descriptionSQL.String
		groups = append(groups, &group)
	}

	return groups, rows.Err()
}

// InitializeDefaultData creates default admin user and groups
func (db *DB) InitializeDefaultData() error {
	// Check if admin user already exists
	_, err := db.GetUserByEmail("admin@kubelens.local")
	if err == nil {
		// Admin already exists
		return nil
	}

	log.Info("🔐 Initializing default admin user and groups...")

	// Create admin group with full permissions
	adminPermissions := []Permission{
		{
			Resource:   "*",
			Actions:    []string{"*"},
			Clusters:   []string{"*"},
			Namespaces: []string{"*"},
		},
	}
	adminPermissionsJSON, _ := json.Marshal(adminPermissions)
	
	adminGroup := &Group{
		Name:        "admin",
		Description: "Administrator group with full access",
		IsSystem:    true,
		Permissions: string(adminPermissionsJSON),
	}
	if err := db.CreateGroup(adminGroup); err != nil {
		// Group might already exist
		log.Warnf("Admin group creation: %v", err)
	}

	// Create editor group with view and edit permissions
	editorPermissions := []Permission{
		{
			Resource:   "*",
			Actions:    []string{"read", "create", "update"},
			Clusters:   []string{"*"},
			Namespaces: []string{"*"},
		},
	}
	editorPermissionsJSON, _ := json.Marshal(editorPermissions)
	
	editorGroup := &Group{
		Name:        "editor",
		Description: "Editor group with view and edit access (no delete)",
		IsSystem:    true,
		Permissions: string(editorPermissionsJSON),
	}
	if err := db.CreateGroup(editorGroup); err != nil {
		log.Warnf("Editor group creation: %v", err)
	}

	// Create viewer group with read-only permissions
	viewerPermissions := []Permission{
		{
			Resource:   "*",
			Actions:    []string{"read"},
			Clusters:   []string{"*"},
			Namespaces: []string{"*"},
		},
	}
	viewerPermissionsJSON, _ := json.Marshal(viewerPermissions)
	
	viewerGroup := &Group{
		Name:        "viewer",
		Description: "Viewer group with read-only access",
		IsSystem:    true,
		Permissions: string(viewerPermissionsJSON),
	}
	if err := db.CreateGroup(viewerGroup); err != nil {
		log.Warnf("Viewer group creation: %v", err)
	}

	// Create admin user with bcrypt hash of "admin123"
	adminUser := &User{
		Email:        "admin@kubelens.local",
		Username:     "admin",
		PasswordHash: "$2a$10$YXBj80kAZccjNsMNjD31R.EyWqTYow5yH6mxbasV9wWvtOBCPqjJO", // bcrypt hash of "admin123"
		FullName:     "Administrator",
		AuthProvider: "local",
		IsActive:     true,
		IsAdmin:      true,
	}

	if err := db.CreateUser(adminUser); err != nil {
		return err
	}

	// Add admin to admin group
	if err := db.AddUserToGroup(adminUser.ID, adminGroup.ID); err != nil {
		log.Warnf("Failed to add admin to admin group: %v", err)
	}

	log.Info("✅ Default admin user created:")
	log.Info("   Email: admin@kubelens.local")
	log.Info("   Password: admin123")
	log.Info("   ⚠️  Please change the password after first login!")

	return nil
}

// ========== User Session Management ==========

// GetUserSession retrieves a user's session
func (db *DB) GetUserSession(userID int) (*UserSession, error) {
	var session UserSession
	query := `SELECT id, user_id, selected_cluster, selected_namespace, selected_theme, updated_at FROM user_sessions WHERE user_id = ?`
	
	var selectedClusterSQL, selectedNamespaceSQL, selectedThemeSQL sql.NullString
	err := db.conn.QueryRow(query, userID).Scan(
		&session.ID,
		&session.UserID,
		&selectedClusterSQL,
		&selectedNamespaceSQL,
		&selectedThemeSQL,
		&session.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			// Create default session if not exists
			return db.CreateUserSession(userID)
		}
		return nil, err
	}
	
	session.SelectedCluster = selectedClusterSQL.String
	session.SelectedNamespace = selectedNamespaceSQL.String
	session.SelectedTheme = selectedThemeSQL.String
	if session.SelectedTheme == "" {
		session.SelectedTheme = "dark" // Default theme
	}
	
	return &session, nil
}

// CreateUserSession creates a new user session
func (db *DB) CreateUserSession(userID int) (*UserSession, error) {
	query := `INSERT INTO user_sessions (user_id, selected_theme) VALUES (?, ?)`
	result, err := db.conn.Exec(query, userID, "dark") // Default to dark theme
	if err != nil {
		return nil, err
	}
	
	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	
	return &UserSession{
		ID:            int(id),
		UserID:        userID,
		SelectedTheme: "dark",
	}, nil
}

// UpdateUserSession updates a user's session
func (db *DB) UpdateUserSession(session *UserSession) error {
	query := `
	UPDATE user_sessions 
	SET selected_cluster = ?, selected_namespace = ?, selected_theme = ?, updated_at = CURRENT_TIMESTAMP
	WHERE user_id = ?
	`
	
	// Default theme if not provided
	theme := session.SelectedTheme
	if theme == "" {
		theme = "dark"
	}
	
	_, err := db.conn.Exec(query,
		sql.NullString{String: session.SelectedCluster, Valid: session.SelectedCluster != ""},
		sql.NullString{String: session.SelectedNamespace, Valid: session.SelectedNamespace != ""},
		theme,
		session.UserID,
	)
	return err
}

// GetUserPermissions retrieves all permissions for a user from their groups
func (db *DB) GetUserPermissions(userID int) ([]Permission, error) {
	query := `
	SELECT DISTINCT g.permissions
	FROM groups g
	INNER JOIN user_groups ug ON g.id = ug.group_id
	WHERE ug.user_id = ?
	`
	
	rows, err := db.conn.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var allPermissions []Permission
	for rows.Next() {
		var permissionsJSON string
		if err := rows.Scan(&permissionsJSON); err != nil {
			return nil, err
		}
		
		var perms []Permission
		if err := json.Unmarshal([]byte(permissionsJSON), &perms); err != nil {
			log.Warnf("Failed to unmarshal permissions: %v", err)
			continue
		}
		
		allPermissions = append(allPermissions, perms...)
	}
	
	return allPermissions, rows.Err()
}

// ============================================================================
// Notification Methods
// ============================================================================

// CreateNotification creates a new notification for a user
func (db *DB) CreateNotification(notification *Notification) error {
	result, err := db.conn.Exec(`
		INSERT INTO notifications (user_id, type, title, message, read)
		VALUES (?, ?, ?, ?, ?)
	`, notification.UserID, notification.Type, notification.Title, notification.Message, notification.Read)
	
	if err != nil {
		return err
	}
	
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	
	notification.ID = int(id)
	return nil
}

// GetNotifications retrieves all notifications for a user (most recent first)
func (db *DB) GetNotifications(userID int, limit int) ([]*Notification, error) {
	if limit <= 0 {
		limit = 100 // Default limit
	}
	
	rows, err := db.conn.Query(`
		SELECT id, user_id, type, title, message, read, created_at
		FROM notifications
		WHERE user_id = ?
		ORDER BY created_at DESC
		LIMIT ?
	`, userID, limit)
	
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	notifications := make([]*Notification, 0)
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Message, &n.Read, &n.CreatedAt); err != nil {
			return nil, err
		}
		notifications = append(notifications, &n)
	}
	
	return notifications, rows.Err()
}

// GetUnreadNotifications retrieves unread notifications for a user
func (db *DB) GetUnreadNotifications(userID int) ([]*Notification, error) {
	rows, err := db.conn.Query(`
		SELECT id, user_id, type, title, message, read, created_at
		FROM notifications
		WHERE user_id = ? AND read = 0
		ORDER BY created_at DESC
	`, userID)
	
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	notifications := make([]*Notification, 0)
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Message, &n.Read, &n.CreatedAt); err != nil {
			return nil, err
		}
		notifications = append(notifications, &n)
	}
	
	return notifications, rows.Err()
}

// GetUnreadCount returns the count of unread notifications for a user
func (db *DB) GetUnreadCount(userID int) (int, error) {
	var count int
	err := db.conn.QueryRow(`
		SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read = 0
	`, userID).Scan(&count)
	
	return count, err
}

// MarkNotificationAsRead marks a specific notification as read
func (db *DB) MarkNotificationAsRead(notificationID int, userID int) error {
	_, err := db.conn.Exec(`
		UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?
	`, notificationID, userID)
	
	return err
}

// MarkAllNotificationsAsRead marks all notifications as read for a user
func (db *DB) MarkAllNotificationsAsRead(userID int) error {
	_, err := db.conn.Exec(`
		UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0
	`, userID)
	
	return err
}

// DeleteNotification deletes a specific notification
func (db *DB) DeleteNotification(notificationID int, userID int) error {
	_, err := db.conn.Exec(`
		DELETE FROM notifications WHERE id = ? AND user_id = ?
	`, notificationID, userID)
	
	return err
}

// ClearAllNotifications deletes all notifications for a user
func (db *DB) ClearAllNotifications(userID int) error {
	_, err := db.conn.Exec(`
		DELETE FROM notifications WHERE user_id = ?
	`, userID)
	
	return err
}

// CleanupOldNotifications removes notifications older than the specified days
func (db *DB) CleanupOldNotifications(days int) error {
	_, err := db.conn.Exec(`
		DELETE FROM notifications 
		WHERE created_at < datetime('now', '-' || ? || ' days')
	`, days)
	
	return err
}
