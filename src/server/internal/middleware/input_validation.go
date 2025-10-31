package middleware

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

var (
	// SQL injection patterns
	sqlInjectionPatterns = []string{
		`(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)`,
		`(--|\#|\/\*|\*\/)`,
		`('|")\s*(OR|AND)\s*('|")?`,
		`(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+`,
	}

	// XSS patterns
	xssPatterns = []string{
		`<script[^>]*>.*?</script>`,
		`javascript:`,
		`on\w+\s*=`,
		`<iframe`,
		`<object`,
		`<embed`,
	}

	// Command injection patterns
	commandInjectionPatterns = []string{
		`[;&|]\s*(cat|ls|rm|wget|curl|nc|bash|sh|python|perl|ruby|php)`,
		`\$\(.*\)`,
		`` + "`" + `.*` + "`" + ``,
	}

	// Path traversal patterns
	pathTraversalPatterns = []string{
		`\.\.\/`,
		`\.\.\\`,
		`%2e%2e%2f`,
		`%2e%2e\\`,
	}
)

// InputValidation validates and sanitizes user input
func InputValidation() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check query parameters
		for key, values := range c.Request.URL.Query() {
			for _, value := range values {
				if isSuspicious(value) {
					log.Warnf("Suspicious input detected in query parameter '%s': %s from IP: %s", 
						key, value, c.ClientIP())
					c.JSON(http.StatusBadRequest, gin.H{
						"error": "invalid input detected",
					})
					c.Abort()
					return
				}
			}
		}

		// Check form data
		if c.Request.Method == "POST" || c.Request.Method == "PUT" {
			c.Request.ParseForm()
			for key, values := range c.Request.PostForm {
				for _, value := range values {
					if isSuspicious(value) {
						log.Warnf("Suspicious input detected in form parameter '%s': %s from IP: %s", 
							key, value, c.ClientIP())
						c.JSON(http.StatusBadRequest, gin.H{
							"error": "invalid input detected",
						})
						c.Abort()
						return
					}
				}
			}
		}

		c.Next()
	}
}

// isSuspicious checks if input contains suspicious patterns
func isSuspicious(input string) bool {
	input = strings.ToLower(input)

	// Check SQL injection
	for _, pattern := range sqlInjectionPatterns {
		if matched, _ := regexp.MatchString(pattern, input); matched {
			return true
		}
	}

	// Check XSS
	for _, pattern := range xssPatterns {
		if matched, _ := regexp.MatchString(pattern, input); matched {
			return true
		}
	}

	// Check command injection
	for _, pattern := range commandInjectionPatterns {
		if matched, _ := regexp.MatchString(pattern, input); matched {
			return true
		}
	}

	// Check path traversal
	for _, pattern := range pathTraversalPatterns {
		if matched, _ := regexp.MatchString(pattern, input); matched {
			return true
		}
	}

	return false
}

// SanitizeString removes potentially dangerous characters
func SanitizeString(input string) string {
	// Remove null bytes
	input = strings.ReplaceAll(input, "\x00", "")
	
	// Remove control characters
	re := regexp.MustCompile(`[\x00-\x1F\x7F]`)
	input = re.ReplaceAllString(input, "")
	
	return strings.TrimSpace(input)
}

// ValidateEmail checks if email format is valid
func ValidateEmail(email string) bool {
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(email)
}

// ValidatePassword checks password strength
func ValidatePassword(password string) (bool, string) {
	if len(password) < 8 {
		return false, "password must be at least 8 characters long"
	}

	if len(password) > 128 {
		return false, "password must not exceed 128 characters"
	}

	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(password)
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(password)
	hasNumber := regexp.MustCompile(`[0-9]`).MatchString(password)
	hasSpecial := regexp.MustCompile(`[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]`).MatchString(password)

	if !hasUpper || !hasLower || !hasNumber || !hasSpecial {
		return false, "password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
	}

	return true, ""
}

