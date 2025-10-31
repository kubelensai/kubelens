package middleware

import (
	"sync"
	"time"

	log "github.com/sirupsen/logrus"
)

// AccountLockout manages failed login attempts and account lockouts
type AccountLockout struct {
	attempts map[string]*loginAttempts
	mu       sync.RWMutex
	
	maxAttempts    int
	lockoutTime    time.Duration
	attemptWindow  time.Duration
}

type loginAttempts struct {
	count      int
	lockedUntil time.Time
	attempts   []time.Time
}

// NewAccountLockout creates a new account lockout manager
func NewAccountLockout(maxAttempts int, lockoutTime, attemptWindow time.Duration) *AccountLockout {
	al := &AccountLockout{
		attempts:      make(map[string]*loginAttempts),
		maxAttempts:   maxAttempts,
		lockoutTime:   lockoutTime,
		attemptWindow: attemptWindow,
	}

	// Start cleanup goroutine
	go al.cleanupAttempts()

	return al
}

// RecordFailedAttempt records a failed login attempt
func (al *AccountLockout) RecordFailedAttempt(identifier string) {
	al.mu.Lock()
	defer al.mu.Unlock()

	now := time.Now()
	
	if _, exists := al.attempts[identifier]; !exists {
		al.attempts[identifier] = &loginAttempts{
			attempts: []time.Time{},
		}
	}

	attempt := al.attempts[identifier]
	
	// Add current attempt
	attempt.attempts = append(attempt.attempts, now)
	
	// Remove attempts outside the window
	validAttempts := []time.Time{}
	for _, t := range attempt.attempts {
		if now.Sub(t) <= al.attemptWindow {
			validAttempts = append(validAttempts, t)
		}
	}
	attempt.attempts = validAttempts
	attempt.count = len(validAttempts)

	// Check if we should lock the account
	if attempt.count >= al.maxAttempts {
		attempt.lockedUntil = now.Add(al.lockoutTime)
		log.Warnf("Account locked due to too many failed attempts: %s, locked until: %s", 
			identifier, attempt.lockedUntil.Format(time.RFC3339))
	}
}

// ResetAttempts resets failed login attempts (call on successful login)
func (al *AccountLockout) ResetAttempts(identifier string) {
	al.mu.Lock()
	defer al.mu.Unlock()

	delete(al.attempts, identifier)
}

// IsLocked checks if an account is currently locked
func (al *AccountLockout) IsLocked(identifier string) (bool, time.Time) {
	al.mu.RLock()
	defer al.mu.RUnlock()

	attempt, exists := al.attempts[identifier]
	if !exists {
		return false, time.Time{}
	}

	now := time.Now()
	
	// Check if lockout has expired
	if !attempt.lockedUntil.IsZero() && now.Before(attempt.lockedUntil) {
		return true, attempt.lockedUntil
	}

	// Lockout expired, reset
	if !attempt.lockedUntil.IsZero() && now.After(attempt.lockedUntil) {
		go al.ResetAttempts(identifier)
		return false, time.Time{}
	}

	return false, time.Time{}
}

// GetAttemptCount returns the number of failed attempts
func (al *AccountLockout) GetAttemptCount(identifier string) int {
	al.mu.RLock()
	defer al.mu.RUnlock()

	if attempt, exists := al.attempts[identifier]; exists {
		return attempt.count
	}
	return 0
}

// cleanupAttempts removes old attempts to prevent memory leaks
func (al *AccountLockout) cleanupAttempts() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		al.mu.Lock()
		now := time.Now()
		for identifier, attempt := range al.attempts {
			// Remove if no lockout and no recent attempts
			if attempt.lockedUntil.IsZero() && len(attempt.attempts) == 0 {
				delete(al.attempts, identifier)
				continue
			}
			
			// Remove if lockout expired and no recent attempts
			if !attempt.lockedUntil.IsZero() && now.After(attempt.lockedUntil) && len(attempt.attempts) == 0 {
				delete(al.attempts, identifier)
			}
		}
		al.mu.Unlock()
	}
}

