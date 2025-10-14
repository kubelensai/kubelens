package db

import (
	"database/sql"
	"encoding/json"
	"fmt"

	_ "modernc.org/sqlite"
	log "github.com/sirupsen/logrus"
)

// DB wraps the database connection
type DB struct {
	conn *sql.DB
}

// Cluster represents a stored cluster configuration
type Cluster struct {
	ID         int    `json:"id"`
	Name       string `json:"name"`
	Server     string `json:"server"`      // Kubernetes API server address
	CA         string `json:"ca"`          // Certificate Authority data (base64)
	Token      string `json:"token"`       // Service account token or bearer token
	IsDefault  bool   `json:"is_default"`
	Enabled    bool   `json:"enabled"`
	Status     string `json:"status"`      // connected, disconnected, error
	CreatedAt  string `json:"created_at"`
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
	schema := `
	CREATE TABLE IF NOT EXISTS clusters (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT UNIQUE NOT NULL,
		server TEXT NOT NULL,
		ca TEXT NOT NULL,
		token TEXT NOT NULL,
		is_default BOOLEAN DEFAULT 0,
		enabled BOOLEAN DEFAULT 1,
		status TEXT DEFAULT 'unknown',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
	`

	_, err := db.conn.Exec(schema)
	if err != nil {
		return err
	}

	// Check if old schema exists (has kubeconfig column)
	var hasKubeconfig bool
	err = db.conn.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('clusters') WHERE name='kubeconfig'`).Scan(&hasKubeconfig)
	if err == nil && hasKubeconfig {
		log.Println("Detected old schema with kubeconfig column. Migrating to new schema...")
		
		// Backup old data
		_, err = db.conn.Exec(`
			CREATE TABLE IF NOT EXISTS clusters_backup AS SELECT * FROM clusters;
		`)
		if err != nil {
			log.Warnf("Failed to backup clusters: %v", err)
		}
		
		// Drop old table
		_, err = db.conn.Exec(`DROP TABLE IF EXISTS clusters`)
		if err != nil {
			return fmt.Errorf("failed to drop old clusters table: %w", err)
		}
		
		// Recreate with new schema
		_, err = db.conn.Exec(schema)
		if err != nil {
			return fmt.Errorf("failed to recreate clusters table: %w", err)
		}
		
		log.Println("Successfully migrated to new schema. Old data backed up in clusters_backup table.")
		log.Println("Please re-import your clusters using the new Import UI.")
	}

	// Migrations for adding new columns if they don't exist
	migrations := []string{
		`ALTER TABLE clusters ADD COLUMN enabled BOOLEAN DEFAULT 1`,
		`ALTER TABLE clusters ADD COLUMN status TEXT DEFAULT 'unknown'`,
		`ALTER TABLE clusters ADD COLUMN server TEXT`,
		`ALTER TABLE clusters ADD COLUMN ca TEXT`,
		`ALTER TABLE clusters ADD COLUMN token TEXT`,
	}

	for _, migration := range migrations {
		_, err = db.conn.Exec(migration)
		if err != nil && err.Error() != "duplicate column name: enabled" && 
		   err.Error() != "duplicate column name: status" &&
		   err.Error() != "duplicate column name: server" &&
		   err.Error() != "duplicate column name: ca" &&
		   err.Error() != "duplicate column name: token" {
			// Ignore duplicate column errors
		}
	}

	return nil
}

// SaveCluster saves a cluster configuration
func (db *DB) SaveCluster(cluster *Cluster) error {
	query := `
		INSERT INTO clusters (name, server, ca, token, is_default, enabled, status)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(name) DO UPDATE SET
			server = excluded.server,
			ca = excluded.ca,
			token = excluded.token,
			is_default = excluded.is_default,
			enabled = excluded.enabled,
			status = excluded.status
	`

	result, err := db.conn.Exec(query, cluster.Name, cluster.Server, cluster.CA, cluster.Token, cluster.IsDefault, cluster.Enabled, cluster.Status)
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
	query := `SELECT id, name, server, ca, token, is_default, enabled, status, created_at FROM clusters WHERE name = ?`

	var cluster Cluster
	err := db.conn.QueryRow(query, name).Scan(
		&cluster.ID,
		&cluster.Name,
		&cluster.Server,
		&cluster.CA,
		&cluster.Token,
		&cluster.IsDefault,
		&cluster.Enabled,
		&cluster.Status,
		&cluster.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &cluster, nil
}

// ListClusters retrieves all clusters
func (db *DB) ListClusters() ([]*Cluster, error) {
	query := `SELECT id, name, server, ca, token, is_default, enabled, status, created_at FROM clusters ORDER BY is_default DESC, name ASC`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clusters []*Cluster
	for rows.Next() {
		var cluster Cluster
		if err := rows.Scan(
			&cluster.ID,
			&cluster.Name,
			&cluster.Server,
			&cluster.CA,
			&cluster.Token,
			&cluster.IsDefault,
			&cluster.Enabled,
			&cluster.Status,
			&cluster.CreatedAt,
		); err != nil {
			return nil, err
		}
		clusters = append(clusters, &cluster)
	}

	return clusters, nil
}

// ListEnabledClusters retrieves only enabled clusters
func (db *DB) ListEnabledClusters() ([]*Cluster, error) {
	query := `SELECT id, name, server, ca, token, is_default, enabled, status, created_at FROM clusters WHERE enabled = 1 ORDER BY is_default DESC, name ASC`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var clusters []*Cluster
	for rows.Next() {
		var cluster Cluster
		if err := rows.Scan(
			&cluster.ID,
			&cluster.Name,
			&cluster.Server,
			&cluster.CA,
			&cluster.Token,
			&cluster.IsDefault,
			&cluster.Enabled,
			&cluster.Status,
			&cluster.CreatedAt,
		); err != nil {
			return nil, err
		}
		clusters = append(clusters, &cluster)
	}

	return clusters, nil
}

// UpdateClusterEnabled updates the enabled status of a cluster
func (db *DB) UpdateClusterEnabled(name string, enabled bool) error {
	query := `UPDATE clusters SET enabled = ? WHERE name = ?`
	_, err := db.conn.Exec(query, enabled, name)
	return err
}

// UpdateClusterStatus updates the status of a cluster
func (db *DB) UpdateClusterStatus(name string, status string) error {
	query := `UPDATE clusters SET status = ? WHERE name = ?`
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

