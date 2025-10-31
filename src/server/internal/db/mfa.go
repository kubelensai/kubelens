package db

import (
	"bytes"
	"crypto/rand"
	"database/sql"
	"encoding/base32"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image/png"
	"time"

	"github.com/boombuler/barcode"
	"github.com/boombuler/barcode/qr"
	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
	log "github.com/sirupsen/logrus"
)

// MFASetupResponse contains the data needed to set up MFA
type MFASetupResponse struct {
	Secret      string   `json:"secret"`
	QRCodeURL   string   `json:"qr_code_url"`
	BackupCodes []string `json:"backup_codes"`
}

// GenerateMFASecret generates a new TOTP secret for a user
func (db *DB) GenerateMFASecret(userID int, username string) (*MFASetupResponse, error) {
	// Generate TOTP key
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Kubelens",
		AccountName: username,
		SecretSize:  32,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to generate TOTP key: %w", err)
	}

	// Generate backup codes (10 codes, 8 characters each)
	backupCodes := make([]string, 10)
	for i := range backupCodes {
		code, err := generateBackupCode()
		if err != nil {
			return nil, fmt.Errorf("failed to generate backup code: %w", err)
		}
		backupCodes[i] = code
	}

	// Store backup codes as JSON
	backupCodesJSON, err := json.Marshal(backupCodes)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal backup codes: %w", err)
	}

	// Check if MFA secret already exists
	var existingID int
	err = db.conn.QueryRow("SELECT id FROM mfa_secrets WHERE user_id = ?", userID).Scan(&existingID)
	
	if err == sql.ErrNoRows {
		// Insert new MFA secret
		_, err = db.conn.Exec(`
			INSERT INTO mfa_secrets (user_id, secret, backup_codes, created_at, updated_at)
			VALUES (?, ?, ?, datetime('now'), datetime('now'))
		`, userID, key.Secret(), string(backupCodesJSON))
	} else if err == nil {
		// Update existing MFA secret
		_, err = db.conn.Exec(`
			UPDATE mfa_secrets 
			SET secret = ?, backup_codes = ?, updated_at = datetime('now')
			WHERE user_id = ?
		`, key.Secret(), string(backupCodesJSON), userID)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to store MFA secret: %w", err)
	}

	// Generate QR code image
	qrCode, err := qr.Encode(key.URL(), qr.M, qr.Auto)
	if err != nil {
		return nil, fmt.Errorf("failed to generate QR code: %w", err)
	}

	// Scale QR code to 256x256 pixels
	qrCode, err = barcode.Scale(qrCode, 256, 256)
	if err != nil {
		return nil, fmt.Errorf("failed to scale QR code: %w", err)
	}

	// Encode QR code to PNG
	var buf bytes.Buffer
	if err := png.Encode(&buf, qrCode); err != nil {
		return nil, fmt.Errorf("failed to encode QR code: %w", err)
	}

	// Convert to base64 data URL
	qrCodeDataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())

	return &MFASetupResponse{
		Secret:      key.Secret(),
		QRCodeURL:   qrCodeDataURL,
		BackupCodes: backupCodes,
	}, nil
}

// VerifyMFAToken verifies a TOTP token for a user
func (db *DB) VerifyMFAToken(userID int, token string) (bool, error) {
	var secret string
	var backupCodesJSON string
	var lastUsedCode sql.NullString
	var lastUsedAt sql.NullString
	
	err := db.conn.QueryRow(`
		SELECT secret, backup_codes, last_used_code, last_used_at FROM mfa_secrets WHERE user_id = ?
	`, userID).Scan(&secret, &backupCodesJSON, &lastUsedCode, &lastUsedAt)
	
	if err == sql.ErrNoRows {
		return false, fmt.Errorf("MFA not set up for user")
	}
	if err != nil {
		return false, fmt.Errorf("failed to get MFA secret: %w", err)
	}

	// Check if this code was already used recently (within the last 30 seconds)
	if lastUsedCode.Valid && lastUsedCode.String == token && lastUsedAt.Valid {
		lastUsed, err := time.Parse(time.RFC3339, lastUsedAt.String)
		if err == nil && time.Since(lastUsed) < 30*time.Second {
			log.Warnf("Attempted reuse of MFA code for user %d", userID)
			return false, fmt.Errorf("code already used")
		}
	}

	// Try TOTP verification with strict validation
	// Skew=0 means only accept codes from the current 30-second window
	// Codes expire after 30 seconds
	valid, err := totp.ValidateCustom(token, secret, time.Now(), totp.ValidateOpts{
		Period:    30,
		Skew:      0,
		Digits:    otp.DigitsSix,
		Algorithm: otp.AlgorithmSHA1,
	})
	if err != nil {
		log.Warnf("TOTP validation error: %v", err)
		return false, fmt.Errorf("failed to validate TOTP: %w", err)
	}
	if valid {
		// Store the used code and timestamp to prevent reuse
		_, err = db.conn.Exec(`
			UPDATE mfa_secrets 
			SET last_used_code = ?, last_used_at = ?, updated_at = datetime('now')
			WHERE user_id = ?
		`, token, time.Now().Format(time.RFC3339), userID)
		if err != nil {
			log.Warnf("Failed to update last used code: %v", err)
		}
		return true, nil
	}

	// Try backup codes
	var backupCodes []string
	if err := json.Unmarshal([]byte(backupCodesJSON), &backupCodes); err != nil {
		return false, fmt.Errorf("failed to unmarshal backup codes: %w", err)
	}

	// Check if token matches any backup code
	for i, code := range backupCodes {
		if code == token {
			// Remove used backup code
			backupCodes = append(backupCodes[:i], backupCodes[i+1:]...)
			newBackupCodesJSON, err := json.Marshal(backupCodes)
			if err != nil {
				return false, fmt.Errorf("failed to marshal backup codes: %w", err)
			}

			// Update backup codes in database
			_, err = db.conn.Exec(`
				UPDATE mfa_secrets 
				SET backup_codes = ?, updated_at = datetime('now')
				WHERE user_id = ?
			`, string(newBackupCodesJSON), userID)
			if err != nil {
				log.Warnf("Failed to update backup codes after use: %v", err)
			}

			return true, nil
		}
	}

	return false, nil
}

// EnableMFA enables MFA for a user after successful verification
func (db *DB) EnableMFA(userID int) error {
	_, err := db.conn.Exec(`
		UPDATE users 
		SET mfa_enabled = 1, mfa_enforced_at = datetime('now'), updated_at = datetime('now')
		WHERE id = ?
	`, userID)
	
	if err != nil {
		return fmt.Errorf("failed to enable MFA: %w", err)
	}

	log.Infof("MFA enabled for user ID: %d", userID)
	return nil
}

// DisableMFA disables MFA for a user (admin action or self-reset)
func (db *DB) DisableMFA(userID int) error {
	// Delete MFA secret
	_, err := db.conn.Exec("DELETE FROM mfa_secrets WHERE user_id = ?", userID)
	if err != nil {
		return fmt.Errorf("failed to delete MFA secret: %w", err)
	}

	// Update user record
	_, err = db.conn.Exec(`
		UPDATE users 
		SET mfa_enabled = 0, mfa_enforced_at = NULL, updated_at = datetime('now')
		WHERE id = ?
	`, userID)
	
	if err != nil {
		return fmt.Errorf("failed to disable MFA: %w", err)
	}

	log.Infof("MFA disabled for user ID: %d", userID)
	return nil
}

// GetMFAStatus checks if MFA is enabled for a user
func (db *DB) GetMFAStatus(userID int) (bool, error) {
	var mfaEnabled bool
	err := db.conn.QueryRow("SELECT mfa_enabled FROM users WHERE id = ?", userID).Scan(&mfaEnabled)
	if err != nil {
		return false, fmt.Errorf("failed to get MFA status: %w", err)
	}
	return mfaEnabled, nil
}

// generateBackupCode generates a random 8-character backup code
func generateBackupCode() (string, error) {
	// Generate 5 random bytes (40 bits) which will give us 8 base32 characters
	bytes := make([]byte, 5)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	
	// Encode to base32 and take first 8 characters
	code := base32.StdEncoding.EncodeToString(bytes)
	return code[:8], nil
}

// RegenerateMFABackupCodes generates new backup codes for a user
func (db *DB) RegenerateMFABackupCodes(userID int) ([]string, error) {
	// Check if MFA is enabled
	mfaEnabled, err := db.GetMFAStatus(userID)
	if err != nil {
		return nil, err
	}
	if !mfaEnabled {
		return nil, fmt.Errorf("MFA not enabled for user")
	}

	// Generate new backup codes
	backupCodes := make([]string, 10)
	for i := range backupCodes {
		code, err := generateBackupCode()
		if err != nil {
			return nil, fmt.Errorf("failed to generate backup code: %w", err)
		}
		backupCodes[i] = code
	}

	// Store backup codes as JSON
	backupCodesJSON, err := json.Marshal(backupCodes)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal backup codes: %w", err)
	}

	// Update backup codes in database
	_, err = db.conn.Exec(`
		UPDATE mfa_secrets 
		SET backup_codes = ?, updated_at = datetime('now')
		WHERE user_id = ?
	`, string(backupCodesJSON), userID)
	
	if err != nil {
		return nil, fmt.Errorf("failed to update backup codes: %w", err)
	}

	log.Infof("Backup codes regenerated for user ID: %d", userID)
	return backupCodes, nil
}

