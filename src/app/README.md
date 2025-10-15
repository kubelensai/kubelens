# Kubelens App (Frontend)

Modern React-based frontend application for Kubelens with built-in Node.js proxy server.

## Architecture

The app uses a **Node.js Express server** in production instead of nginx. This provides:

- ✅ **Simpler deployment** - No nginx configuration needed
- ✅ **Built-in API proxy** - Automatic proxy to backend server
- ✅ **WebSocket support** - Real-time communication for terminal/logs
- ✅ **Dynamic configuration** - Configure API server via environment variables
- ✅ **SPA routing** - Proper handling of client-side routes

## Development

```bash
# Install dependencies
npm install

# Start dev server with hot reload (port 5173)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

### Dev Server Proxy

The Vite dev server automatically proxies `/api/*` requests to `http://localhost:8080` (configurable in `vite.config.ts`).

## Production Server

The production build includes a Node.js Express server (`server.js`) that:

1. **Proxies API requests** from `/api/*` to the backend server
2. **Serves static assets** from the `dist/` directory with aggressive caching
3. **Handles SPA routing** by serving `index.html` for all non-API routes
4. **Supports WebSocket** upgrades for real-time features

### Starting the Server

```bash
# Build the app first
npm run build

# Start the production server
npm start

# Or with custom configuration
PORT=3000 API_SERVER=http://backend:8080 npm start
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `80` | Port for the app server to listen on |
| `API_SERVER` | `http://localhost:8080` | Backend API server URL |
| `NODE_ENV` | `production` | Node environment |

## Docker

### Build

```bash
# From repository root
docker build -f docker/app/Dockerfile -t kubelens-app .
```

### Run

```bash
docker run -d \
  -p 80:80 \
  -e API_SERVER=http://server:8080 \
  --name kubelens-app \
  kubelens-app
```

## Platform Support

Kubelens supports **TWO deployment modes**:

### 1. Web (Docker/Kubernetes) - Current Setup
- ✅ Node.js Express server with proxy
- ✅ Browser → App (port 80) → Proxy → Server (port 8080)
- ✅ Runtime environment variables

### 2. Mobile (Capacitor) - Ready to Use
- ✅ Pure static files (no Node.js needed)
- ✅ Direct API calls to backend server
- ✅ Build-time configuration
- 📱 **See [MOBILE.md](./MOBILE.md) for mobile build guide**

## Dependencies

### Runtime (Web)
- `express` - Web server framework
- `http-proxy-middleware` - API proxy middleware
- `compression` - Response compression
- React, React Router, Tailwind CSS, etc.

### Development
- Vite - Build tool and dev server
- TypeScript - Type safety
- ESLint - Code linting
- **Capacitor** - Mobile app framework (optional)

## File Structure

```
src/app/
├── dist/                 # Built static assets (after npm run build)
├── src/                  # React application source code
│   ├── components/       # React components
│   ├── pages/            # Page components
│   ├── services/         # API service layer
│   ├── types/            # TypeScript types
│   └── utils/            # Utility functions
├── server.js             # Production Express server with proxy
├── vite.config.ts        # Vite configuration
├── package.json          # Dependencies and scripts
└── README.md             # This file
```

## API Proxy Configuration

The proxy middleware configuration in `server.js`:

```javascript
const proxyOptions = {
  target: API_SERVER,              // Backend server URL
  changeOrigin: true,              // Update Host header
  ws: true,                        // Enable WebSocket proxying
  pathRewrite: (path) => `/api${path}`, // Prepend /api prefix
}

app.use('/api', createProxyMiddleware(proxyOptions))
```

This ensures that:
- Browser request: `GET /api/v1/clusters`
- Proxied to backend: `GET http://server:8080/api/v1/clusters`

## Health Check

The Docker image includes a health check that verifies the server is responding:

```bash
curl http://localhost:80
# Should return the app's index.html
```

## Troubleshooting

### Proxy not working

Check the logs for proxy errors:
```bash
docker logs kubelens-app
```

Verify the backend server is accessible:
```bash
curl http://server:8080/api/v1/clusters
```

### SPA routes returning 404

This shouldn't happen - all non-API routes should serve `index.html`. If it does, check:
1. The fallback middleware is the last middleware
2. No other middleware is sending responses before it

### Static assets not loading

Check the browser console and network tab. Verify:
1. Assets are present in `/app/dist/assets/`
2. Paths in `index.html` are correct
3. Cache headers are being set properly

