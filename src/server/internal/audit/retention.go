package audit

import (
	"time"

	"github.com/sonnguyen/kubelens/internal/db"

	log "github.com/sirupsen/logrus"
)

// RetentionManager handles log retention and archiving
type RetentionManager struct {
	db     *db.DB
	policy RetentionPolicy
	ticker *time.Ticker
	done   chan bool
}

// NewRetentionManager creates a new retention manager
func NewRetentionManager(database *db.DB, policy RetentionPolicy) *RetentionManager {
	return &RetentionManager{
		db:     database,
		policy: policy,
		done:   make(chan bool),
	}
}

// Start starts the retention manager (runs daily at 2 AM)
func (rm *RetentionManager) Start() {
	// Run immediately on startup
	go rm.runRetentionCycle()

	// Calculate time until next 2 AM
	now := time.Now()
	next2AM := time.Date(now.Year(), now.Month(), now.Day(), 2, 0, 0, 0, now.Location())
	if now.After(next2AM) {
		next2AM = next2AM.Add(24 * time.Hour)
	}
	durationUntil2AM := next2AM.Sub(now)

	// Wait until 2 AM, then run daily
	go func() {
		// Wait until 2 AM
		time.Sleep(durationUntil2AM)

		// Run immediately at 2 AM
		rm.runRetentionCycle()

		// Then run every 24 hours
		rm.ticker = time.NewTicker(24 * time.Hour)
		for {
			select {
			case <-rm.ticker.C:
				rm.runRetentionCycle()
			case <-rm.done:
				return
			}
		}
	}()

	log.Info("✅ Audit log retention manager started (runs daily at 2 AM)")
}

// Stop stops the retention manager
func (rm *RetentionManager) Stop() {
	if rm.ticker != nil {
		rm.ticker.Stop()
	}
	close(rm.done)
	log.Info("Audit log retention manager stopped")
}

// runRetentionCycle runs the full retention cycle
func (rm *RetentionManager) runRetentionCycle() {
	log.Info("🔄 Starting audit log retention cycle...")

	// 1. Archive old logs (hot → warm)
	archived, err := rm.archiveOldLogs()
	if err != nil {
		log.Errorf("❌ Failed to archive logs: %v", err)
	} else {
		log.Infof("✅ Archived %d audit logs", archived)
	}

	// 2. Delete very old logs (cold deletion)
	deleted, err := rm.deleteVeryOldLogs()
	if err != nil {
		log.Errorf("❌ Failed to delete old logs: %v", err)
	} else {
		log.Infof("✅ Deleted %d old audit logs", deleted)
	}

	// 3. Vacuum database to reclaim space
	if err := rm.db.VacuumDatabase(); err != nil {
		log.Errorf("❌ Failed to vacuum database: %v", err)
	} else {
		log.Info("✅ Database vacuumed successfully")
	}

	log.Info("✅ Audit log retention cycle completed")
}

// archiveOldLogs moves old logs from main table to archive table
func (rm *RetentionManager) archiveOldLogs() (int, error) {
	cutoffDate := time.Now().AddDate(0, 0, -rm.policy.HotRetentionDays)
	return rm.db.ArchiveAuditLogs(cutoffDate)
}

// deleteVeryOldLogs deletes very old logs from archive table
func (rm *RetentionManager) deleteVeryOldLogs() (int, error) {
	totalDeleted := 0

	// Delete non-critical logs older than cold retention
	coldCutoff := time.Now().AddDate(0, 0, -rm.policy.ColdRetentionDays)
	deleted1, err := rm.db.DeleteOldAuditLogs(coldCutoff)
	if err != nil {
		return 0, err
	}
	totalDeleted += deleted1

	// Delete critical logs older than critical retention  
	criticalCutoff := time.Now().AddDate(0, 0, -rm.policy.CriticalRetentionDays)
	deleted2, err := rm.db.DeleteOldAuditLogs(criticalCutoff)
	if err != nil {
		return totalDeleted, err
	}
	totalDeleted += deleted2

	return totalDeleted, nil
}

// RunNow runs the retention cycle immediately (for manual triggering)
func (rm *RetentionManager) RunNow() {
	go rm.runRetentionCycle()
}

// GetPolicy returns the current retention policy
func (rm *RetentionManager) GetPolicy() RetentionPolicy {
	return rm.policy
}

// UpdatePolicy updates the retention policy
func (rm *RetentionManager) UpdatePolicy(policy RetentionPolicy) {
	rm.policy = policy
	log.Info("Retention policy updated")
}
