package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

// RateLimiter implements a token bucket rate limiter
type RateLimiter struct {
	visitors map[string]*visitor
	mu       sync.RWMutex
	rate     time.Duration
	burst    int
}

type visitor struct {
	limiter  *tokenBucket
	lastSeen time.Time
}

type tokenBucket struct {
	tokens     int
	maxTokens  int
	refillRate time.Duration
	lastRefill time.Time
	mu         sync.Mutex
}

// NewRateLimiter creates a new rate limiter
// rate: time between requests (e.g., 1*time.Second means 1 request per second)
// burst: maximum number of requests allowed in a burst
func NewRateLimiter(rate time.Duration, burst int) *RateLimiter {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		rate:     rate,
		burst:    burst,
	}

	// Start cleanup goroutine
	go rl.cleanupVisitors()

	return rl
}

// Middleware returns a Gin middleware function
func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		
		if !rl.allow(ip) {
			log.Warnf("Rate limit exceeded for IP: %s, Path: %s", ip, c.Request.URL.Path)
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "too many requests, please try again later",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// allow checks if a request from the given IP should be allowed
func (rl *RateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	v, exists := rl.visitors[ip]
	if !exists {
		v = &visitor{
			limiter: &tokenBucket{
				tokens:     rl.burst,
				maxTokens:  rl.burst,
				refillRate: rl.rate,
				lastRefill: time.Now(),
			},
			lastSeen: time.Now(),
		}
		rl.visitors[ip] = v
	}
	v.lastSeen = time.Now()
	rl.mu.Unlock()

	return v.limiter.allow()
}

// allow checks if a token is available
func (tb *tokenBucket) allow() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	// Refill tokens based on time passed
	now := time.Now()
	elapsed := now.Sub(tb.lastRefill)
	tokensToAdd := int(elapsed / tb.refillRate)

	if tokensToAdd > 0 {
		tb.tokens = min(tb.tokens+tokensToAdd, tb.maxTokens)
		tb.lastRefill = now
	}

	// Check if we have tokens available
	if tb.tokens > 0 {
		tb.tokens--
		return true
	}

	return false
}

// cleanupVisitors removes old visitors to prevent memory leaks
func (rl *RateLimiter) cleanupVisitors() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		for ip, v := range rl.visitors {
			if time.Since(v.lastSeen) > 10*time.Minute {
				delete(rl.visitors, ip)
			}
		}
		rl.mu.Unlock()
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

