/**
 * ProtectedRoute Component
 * 
 * Route guard that protects authenticated-only routes.
 * Redirects unauthenticated users to loading screen with redirect parameter.
 * 
 * Usage:
 * ```tsx
 * <Route element={<ProtectedRoute />}>
 *   <Route path="/dashboard" element={<Dashboard />} />
 * </Route>
 * ```
 * 
 * @module components/auth/ProtectedRoute
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { createRedirectUrl, getFullPath, shouldPreserveIntent } from '@/utils/navigation'

/**
 * ProtectedRoute Component
 * 
 * Checks authentication status and redirects to loading screen if not authenticated.
 * Preserves the intended destination via query parameter for post-login redirect.
 */
export default function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore()
  const location = useLocation()

  // If user is not authenticated, redirect to loading screen
  if (!isAuthenticated) {
    // Get full path including query params and hash
    const intendedPath = getFullPath(location)

    console.log('[ProtectedRoute] 🔒 Not authenticated')
    console.log('[ProtectedRoute] 📍 Current path:', intendedPath)
    console.log('[ProtectedRoute] 📍 Should preserve?', shouldPreserveIntent(intendedPath))

    // Only preserve intent if it's a meaningful route
    if (shouldPreserveIntent(intendedPath)) {
      // Create redirect URL with query parameter
      const redirectUrl = createRedirectUrl('/', intendedPath)

      console.log('[ProtectedRoute] ✅ Redirecting to:', redirectUrl)

      // Use Navigate with pathname and search separately for better React Router compatibility
      return <Navigate to={`/?redirect=${encodeURIComponent(intendedPath)}`} replace />
    }

    // For non-preserved paths (/, /login, /logout), just redirect to /
    console.log('[ProtectedRoute] ➡️  Redirecting to: / (no redirect param)')
    return <Navigate to="/" replace />
  }

  // User is authenticated, render child routes
  console.log('[ProtectedRoute] ✅ Authenticated, rendering route:', location.pathname)
  return <Outlet />
}

