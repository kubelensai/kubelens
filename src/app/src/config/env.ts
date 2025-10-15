/**
 * Environment Configuration
 * 
 * Handles different API base URLs for different platforms:
 * - Web (dev): Uses Vite proxy -> /api/v1
 * - Web (production with Node.js server): Uses proxy server -> /api/v1
 * - Mobile (Capacitor): Direct API calls -> configured server URL
 */

// Check if running in Capacitor (mobile app)
export const isCapacitor = () => {
  return (window as any).Capacitor !== undefined
}

// Get API base URL based on environment
export const getApiBaseUrl = (): string => {
  // Mobile app - use configured API server URL
  if (isCapacitor()) {
    // Can be set via Capacitor config or environment variable at build time
    return import.meta.env.VITE_API_SERVER_URL || 'https://api.kubelens.app'
  }
  
  // Web app (dev or production with proxy) - use relative path
  return '/api/v1'
}

// Get WebSocket base URL
export const getWsBaseUrl = (): string => {
  if (isCapacitor()) {
    const apiUrl = import.meta.env.VITE_API_SERVER_URL || 'https://api.kubelens.app'
    // Convert http(s) to ws(s)
    return apiUrl.replace(/^http/, 'ws') + '/api/v1/ws'
  }
  
  // Web app - use relative path (will be handled by proxy)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/v1/ws`
}

// Platform detection
export const platform = {
  isWeb: () => !isCapacitor(),
  isMobile: () => isCapacitor(),
  isIOS: () => isCapacitor() && (window as any).Capacitor.getPlatform() === 'ios',
  isAndroid: () => isCapacitor() && (window as any).Capacitor.getPlatform() === 'android',
}

// App config
export const appConfig = {
  apiBaseUrl: getApiBaseUrl(),
  wsBaseUrl: getWsBaseUrl(),
  platform: platform,
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  buildMode: import.meta.env.MODE,
}

export default appConfig

