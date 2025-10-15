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

// API Proxy Configuration - prepend /api back to the path
const proxyOptions = {
  target: API_SERVER,
  changeOrigin: true,
  ws: true,
  pathRewrite: (path, req) => {
    // When mounted at /api, express strips it, so we need to add it back
    return `/api${path}`
  },
  on: {
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
app.use('/api', createProxyMiddleware(proxyOptions))

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
