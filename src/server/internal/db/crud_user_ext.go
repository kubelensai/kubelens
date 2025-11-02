package db

// Additional user-related helper methods

// VerifyMFAToken verifies an MFA token for a user
func (db *GormDB) VerifyMFAToken(userID uint, token string) (bool, error) {
	mfaSecret, err := db.GetMFASecret(userID)
	if err != nil || mfaSecret == nil {
		return false, err
	}
	return VerifyTOTP(mfaSecret.Secret, token), nil
}

