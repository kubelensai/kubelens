package db

import (
	"fmt"

	"gorm.io/gorm"
)

// =============================================================================
// Cluster CRUD Operations
// =============================================================================

// CreateCluster creates a new cluster
func (db *GormDB) CreateCluster(cluster *Cluster) error {
	return db.Create(cluster).Error
}

// GetCluster retrieves a cluster by name
func (db *GormDB) GetCluster(name string) (*Cluster, error) {
	var cluster Cluster
	err := db.Where("name = ?", name).First(&cluster).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("cluster not found: %s", name)
	}
	return &cluster, err
}

// GetClusterByID retrieves a cluster by ID
func (db *GormDB) GetClusterByID(id uint) (*Cluster, error) {
	var cluster Cluster
	err := db.First(&cluster, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("cluster not found with ID: %d", id)
	}
	return &cluster, err
}

// ListClusters retrieves all clusters
func (db *GormDB) ListClusters() ([]*Cluster, error) {
	var clusters []*Cluster
	err := db.Order("name ASC").Find(&clusters).Error
	return clusters, err
}

// ListEnabledClusters retrieves only enabled clusters
func (db *GormDB) ListEnabledClusters() ([]*Cluster, error) {
	var clusters []*Cluster
	err := db.Where("enabled = ?", true).Order("name ASC").Find(&clusters).Error
	return clusters, err
}

// UpdateCluster updates an existing cluster
func (db *GormDB) UpdateCluster(cluster *Cluster) error {
	return db.Save(cluster).Error
}

// UpdateClusterStatus updates the status of a cluster
func (db *GormDB) UpdateClusterStatus(name, status string) error {
	return db.Model(&Cluster{}).
		Where("name = ?", name).
		Update("status", status).Error
}

// EnableCluster enables a cluster
func (db *GormDB) EnableCluster(name string) error {
	return db.Model(&Cluster{}).
		Where("name = ?", name).
		Update("enabled", true).Error
}

// DisableCluster disables a cluster
func (db *GormDB) DisableCluster(name string) error {
	return db.Model(&Cluster{}).
		Where("name = ?", name).
		Update("enabled", false).Error
}

// DeleteCluster deletes a cluster by name
func (db *GormDB) DeleteCluster(name string) error {
	return db.Where("name = ?", name).Delete(&Cluster{}).Error
}

// SetDefaultCluster sets a cluster as default (unsets others)
func (db *GormDB) SetDefaultCluster(name string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// Unset all defaults
		if err := tx.Model(&Cluster{}).Update("is_default", false).Error; err != nil {
			return err
		}
		// Set new default
		return tx.Model(&Cluster{}).
			Where("name = ?", name).
			Update("is_default", true).Error
	})
}

// GetDefaultCluster retrieves the default cluster
func (db *GormDB) GetDefaultCluster() (*Cluster, error) {
	var cluster Cluster
	err := db.Where("is_default = ?", true).First(&cluster).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil // No default cluster is not an error
	}
	return &cluster, err
}

// ClusterExists checks if a cluster exists by name
func (db *GormDB) ClusterExists(name string) (bool, error) {
	var count int64
	err := db.Model(&Cluster{}).Where("name = ?", name).Count(&count).Error
	return count > 0, err
}

// SaveCluster is an alias for Save (for backward compatibility)
func (db *GormDB) SaveCluster(cluster *Cluster) error {
	return db.Save(cluster).Error
}

// UpdateClusterEnabled updates the enabled status of a cluster
func (db *GormDB) UpdateClusterEnabled(id uint, enabled bool) error {
	return db.Model(&Cluster{}).Where("id = ?", id).Update("enabled", enabled).Error
}

// GetClusterMetadata retrieves cluster metadata
func (db *GormDB) GetClusterMetadata(clusterName string) (*ClusterMetadata, error) {
	var metadata ClusterMetadata
	err := db.Where("cluster_name = ?", clusterName).First(&metadata).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil // No metadata is not an error
	}
	return &metadata, err
}

// UpsertClusterMetadata creates or updates cluster metadata
func (db *GormDB) UpsertClusterMetadata(metadata *ClusterMetadata) error {
	var existing ClusterMetadata
	result := db.Where("cluster_name = ?", metadata.ClusterName).First(&existing)
	
	if result.Error == gorm.ErrRecordNotFound {
		// Create new
		return db.Create(metadata).Error
	}
	
	// Update existing
	metadata.ID = existing.ID
	return db.Save(metadata).Error
}

// DeleteClusterMetadata deletes cluster metadata
func (db *GormDB) DeleteClusterMetadata(clusterName string) error {
	return db.Where("cluster_name = ?", clusterName).Delete(&ClusterMetadata{}).Error
}

