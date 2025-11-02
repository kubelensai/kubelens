package db

import (
	"crypto/rand"
	"encoding/base32"
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/pquerna/otp/totp"
	"github.com/skip2/go-qrcode"
	log "github.com/sirupsen/logrus"
)

// =============================================================================
// MFA Helper Functions
// =============================================================================

// GenerateMFASecret generates a new TOTP secret for MFA
func GenerateMFASecret(userEmail string) (string, error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      "Kubelens",
		AccountName: userEmail,
	})
	if err != nil {
		return "", fmt.Errorf("failed to generate TOTP key: %w", err)
	}
	
	return key.Secret(), nil
}

// GenerateBackupCodes generates MFA backup codes
func GenerateBackupCodes(count int) ([]string, error) {
	codes := make([]string, count)
	
	for i := 0; i < count; i++ {
		// Generate 8 random bytes
		b := make([]byte, 8)
		if _, err := rand.Read(b); err != nil {
			return nil, fmt.Errorf("failed to generate random bytes: %w", err)
		}
		
		// Convert to base32 and trim padding
		code := base32.StdEncoding.EncodeToString(b)
		code = code[:13] // Trim to 13 characters
		codes[i] = code
	}
	
	return codes, nil
}

// SerializeBackupCodes converts backup codes to JSON string
func SerializeBackupCodes(codes []string) (string, error) {
	bytes, err := json.Marshal(codes)
	if err != nil {
		return "", fmt.Errorf("failed to serialize backup codes: %w", err)
	}
	return string(bytes), nil
}

// DeserializeBackupCodes parses backup codes from JSON string
func DeserializeBackupCodes(codesJSON string) ([]string, error) {
	var codes []string
	if err := json.Unmarshal([]byte(codesJSON), &codes); err != nil {
		return nil, fmt.Errorf("failed to deserialize backup codes: %w", err)
	}
	return codes, nil
}

// VerifyTOTP verifies a TOTP code against a secret
func VerifyTOTP(secret, code string) bool {
	// Validate with 0 time skew (30 second window only)
	return totp.Validate(code, secret)
}

// VerifyBackupCode verifies a backup code
func VerifyBackupCode(codesJSON, code string) (bool, []string, error) {
	codes, err := DeserializeBackupCodes(codesJSON)
	if err != nil {
		return false, nil, err
	}
	
	// Find and remove the used code
	for i, c := range codes {
		if c == code {
			// Remove used code
			codes = append(codes[:i], codes[i+1:]...)
			return true, codes, nil
		}
	}
	
	return false, codes, nil
}

// GenerateQRCodeURL generates a QR code as a base64-encoded PNG image for TOTP setup
func GenerateQRCodeURL(secret, userEmail string) string {
	// Generate the otpauth URL
	otpauthURL := fmt.Sprintf("otpauth://totp/Kubelens:%s?secret=%s&issuer=Kubelens", userEmail, secret)
	
	// Generate QR code as PNG
	qrCode, err := qrcode.Encode(otpauthURL, qrcode.Medium, 256)
	if err != nil {
		log.Errorf("Failed to generate QR code: %v", err)
		return ""
	}
	
	// Encode as base64 data URL
	base64QR := base64.StdEncoding.EncodeToString(qrCode)
	return fmt.Sprintf("data:image/png;base64,%s", base64QR)
}

