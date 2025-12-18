/**
 * Environment Configuration
 * 
 * Handles different API base URLs for different platforms:
 * - Local Development: Uses relative path /api/v1 (Vite proxy)
 * - Production Browser: Uses relative path /api/v1 (served by app container with proxy)
 * - Production Mobile: Uses runtime configured API server URL (e.g., https://api.kubelens.app/api/v1)
 */

import { getApiServerUrl } from './runtime'

// Check if running in Capacitor (mobile app)
export const isCapacitor = () => {
  return (window as any).Capacitor !== undefined
}

// Get API base URL based on environment
export const getApiBaseUrl = (): string => {
  // Mobile app - use runtime configured API server URL with /api/v1 path
  if (isCapacitor()) {
    const baseUrl = getApiServerUrl()
    return baseUrl + '/api/v1'
  }
  
  // Web app (dev or production) - always use relative path
  // In development: Vite proxy handles /api/* -> localhost:8080/api/*
  // In production: App container proxy handles /api/* -> server:8080/api/*
  return '/api/v1'
}

// Get WebSocket base URL
export const getWsBaseUrl = (): string => {
  if (isCapacitor()) {
    const apiUrl = getApiServerUrl()
    // Convert http(s) to ws(s)
    return apiUrl.replace(/^http/, 'ws') + '/api/v1/ws'
  }
  
  // Web app - use relative path (will be handled by proxy)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/v1/ws`
}

/**
 * Get backend server URL for OAuth redirects
 * 
 * Unlike API calls which use Vite proxy, OAuth redirects need the actual backend URL
 * because browser navigation (window.location.href) doesn't go through the proxy.
 * 
 * @returns The backend server URL (e.g., "http://localhost:9090")
 */
export const getBackendUrl = (): string => {
  // Mobile app - use runtime configured API server URL
  if (isCapacitor()) {
    return getApiServerUrl()
  }
  
  // Web app - check for runtime config first, then env variable
  // In production, this comes from window.env.API_SERVER
  // In development, this comes from VITE_API_SERVER_URL or defaults to localhost:8080
  return getApiServerUrl()
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
  backendUrl: getBackendUrl(),
  platform: platform,
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  buildMode: import.meta.env.MODE,
}

export default appConfig

