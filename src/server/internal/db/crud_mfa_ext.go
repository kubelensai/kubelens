package db

import (
	"strings"
)

// MFASetupResponse represents the response from generating an MFA secret
type MFASetupResponse struct {
	Secret      string   `json:"secret"`
	QRCode      string   `json:"qr_code"`
	BackupCodes []string `json:"backup_codes"`
}

// GenerateMFASecret generates a new MFA secret for a user
func (db *GormDB) GenerateMFASecret(userID uint, username string) (*MFASetupResponse, error) {
	// Generate the secret
	secret, err := GenerateMFASecret(username)
	if err != nil {
		return nil, err
	}

	// Generate backup codes
	backupCodes, err := GenerateBackupCodes(10)
	if err != nil {
		return nil, err
	}

	// Convert backup codes to comma-separated string
	backupCodesStr := strings.Join(backupCodes, ",")

	// Store in database
	mfaSecret := &MFASecret{
		UserID:      userID,
		Secret:      secret,
		BackupCodes: backupCodesStr,
	}

	// Check if already exists and delete if so (to start fresh)
	if exists, _ := db.MFASecretExists(userID); exists {
		if err := db.DeleteMFASecret(userID); err != nil {
			return nil, err
		}
	}
	
	// Create new MFA secret
	if err := db.CreateMFASecret(mfaSecret); err != nil {
		return nil, err
	}

	// Generate QR code URL
	qrCode := GenerateQRCodeURL(secret, username)

	return &MFASetupResponse{
		Secret:      secret,
		QRCode:      qrCode,
		BackupCodes: backupCodes,
	}, nil
}

// EnableMFA enables MFA for a user
func (db *GormDB) EnableMFA(userID uint) error {
	return db.UpdateUserMFAStatus(userID, true)
}

// DisableMFA disables MFA for a user
func (db *GormDB) DisableMFA(userID uint) error {
	if err := db.DeleteMFASecret(userID); err != nil {
		return err
	}
	return db.UpdateUserMFAStatus(userID, false)
}

// GetMFAStatus returns whether MFA is enabled for a user
func (db *GormDB) GetMFAStatus(userID uint) (bool, error) {
	var user User
	if err := db.First(&user, userID).Error; err != nil {
		return false, err
	}
	return user.MFAEnabled, nil
}

// RegenerateMFABackupCodes generates new backup codes for a user
func (db *GormDB) RegenerateMFABackupCodes(userID uint) ([]string, error) {
	backupCodes, err := GenerateBackupCodes(10)
	if err != nil {
		return nil, err
	}

	// Convert backup codes to comma-separated string
	backupCodesStr := strings.Join(backupCodes, ",")

	mfaSecret, err := db.GetMFASecret(userID)
	if err != nil {
		return nil, err
	}

	mfaSecret.BackupCodes = backupCodesStr
	if err := db.UpdateMFASecret(mfaSecret); err != nil {
		return nil, err
	}

	return backupCodes, nil
}

