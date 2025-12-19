package extension

import (
	"crypto/ed25519"
	"fmt"
	"os"
)

// Verifier handles package verification
type Verifier struct {
	publicKey ed25519.PublicKey
}

// NewVerifier creates a new verifier with the trusted public key
func NewVerifier(publicKey []byte) *Verifier {
	return &Verifier{
		publicKey: publicKey,
	}
}

// VerifySignature verifies the signature of a package
func (v *Verifier) Verify(packagePath string, signaturePath string) error {
	if v.publicKey == nil {
		return fmt.Errorf("public key not configured")
	}

	// Read package content
	pkgBytes, err := os.ReadFile(packagePath)
	if err != nil {
		return fmt.Errorf("failed to read package: %w", err)
	}

	// Read signature
	sigBytes, err := os.ReadFile(signaturePath)
	if err != nil {
		return fmt.Errorf("failed to read signature: %w", err)
	}

	// Verify
	if !ed25519.Verify(v.publicKey, pkgBytes, sigBytes) {
		return fmt.Errorf("invalid signature")
	}

	return nil
}
