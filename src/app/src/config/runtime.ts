/**
 * Runtime Configuration
 * 
 * This module provides runtime configuration that can be changed without rebuilding the app.
 * The configuration is loaded from window.env which is set by config.js in the public folder.
 * 
 * Usage:
 * - Development: Uses localhost:8080
 * - Production (Browser): Uses the API_SERVER from Docker environment variable
 * - Production (Mobile): Uses the API_SERVER from Capacitor config or environment
 */

import { Capacitor } from '@capacitor/core';

interface RuntimeConfig {
  API_SERVER: string;
  MODE: 'development' | 'production';
}

/**
 * Get the runtime configuration
 * Priority:
 * 1. window.env (set by config.js)
 * 2. Fallback to environment variables from build time
 * 3. Fallback to localhost for development
 */
function getRuntimeConfig(): RuntimeConfig {
  // Check if window.env is available (runtime config)
  if (typeof window !== 'undefined' && window.env) {
    return window.env;
  }

  // Fallback to build-time environment variables (for development)
  return {
    API_SERVER: import.meta.env.VITE_API_SERVER_URL || 'http://localhost:8080',
    MODE: (import.meta.env.MODE as 'development' | 'production') || 'development',
  };
}

const config = getRuntimeConfig();

/**
 * Get the API server URL
 * For mobile apps running on native platforms, we always use the runtime configured URL
 */
export function getApiServerUrl(): string {
  const apiServer = config.API_SERVER;
  
  // For mobile apps, always use the configured API server
  if (Capacitor.isNativePlatform()) {
    return apiServer;
  }
  
  // For web browsers, use the configured API server
  return apiServer;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return config.MODE === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return config.MODE === 'production';
}

/**
 * Get the full runtime configuration
 */
export function getConfig(): Readonly<RuntimeConfig> {
  return Object.freeze({ ...config });
}

// Log configuration on load (only in development)
if (isDevelopment()) {
  console.log('[Runtime Config]', {
    API_SERVER: getApiServerUrl(),
    MODE: config.MODE,
    IS_NATIVE: Capacitor.isNativePlatform(),
    PLATFORM: Capacitor.getPlatform(),
  });
}

