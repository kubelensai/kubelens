import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import path from 'path'
import { fileURLToPath } from 'url'
import compression from 'compression'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 80
const API_SERVER = process.env.API_SERVER || 'http://localhost:8080'

console.log('🚀 Starting Kubelens App Server...')
console.log(`📡 API Server: ${API_SERVER}`)
console.log(`🌐 Port: ${PORT}`)

// Compression middleware
app.use(compression())

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  next()
})

// API Proxy Configuration
const proxyOptions = {
  target: API_SERVER,
  changeOrigin: true,
  ws: true,
  // Important: Do NOT parse body before proxying
  // The proxy will forward the raw request stream
  pathRewrite: (path, req) => {
    // Express strips /api, add it back for the backend
    const rewritten = `/api${path}`
    console.log(`🔀 Proxy: ${req.method} ${path} → ${rewritten}`)
    return rewritten
  },
  on: {
    proxyReq: (proxyReq, req, res) => {
      // Explicitly forward Origin header for CORS
      if (req.headers.origin) {
        proxyReq.setHeader('Origin', req.headers.origin)
      }
      // Log request details for debugging
      console.log(`📤 Forwarding: ${req.method} ${proxyReq.path} (Origin: ${req.headers.origin || 'none'})`)
    },
    proxyRes: (proxyRes, req, res) => {
      console.log(`📥 Response: ${proxyRes.statusCode} from ${req.method} ${req.url}`)
    },
    error: (err, req, res) => {
      console.error(`❌ Proxy Error: ${err.message}`)
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Bad Gateway',
          message: 'Unable to connect to API server'
        })
      }
    }
  }
}

// Create and use proxy middleware for /api/** paths
// IMPORTANT: This must come BEFORE express.json() to avoid consuming the request stream
app.use('/api', createProxyMiddleware(proxyOptions))

// Body parsing middleware - AFTER proxy to avoid consuming request stream
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve static files from dist directory
const distPath = path.join(__dirname, 'dist')
app.use(express.static(distPath, {
  etag: true,
  lastModified: true,
  index: false,
  setHeaders: (res, filepath) => {
    if (filepath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }
  }
}))

// SPA fallback - MUST be last!
app.use('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Kubelens App Server running on http://0.0.0.0:${PORT}`)
  console.log(`✅ API proxying to: ${API_SERVER}`)
})

// Graceful shutdown
const shutdown = () => {
  console.log('📴 Shutting down gracefully...')
  server.close(() => {
    console.log('👋 Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
