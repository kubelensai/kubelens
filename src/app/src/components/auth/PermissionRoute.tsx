/**
 * PermissionRoute Component
 * 
 * Route guard that checks user permissions before rendering.
 * Redirects to dashboard if user lacks required permission.
 * 
 * Usage:
 * ```tsx
 * <Route element={<PermissionRoute resource="extensions" action="read" />}>
 *   <Route path="/extensions" element={<Extensions />} />
 * </Route>
 * ```
 * 
 * @module components/auth/PermissionRoute
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { usePermission } from '@/hooks/usePermission'

interface PermissionRouteProps {
  /** Resource to check permission for (e.g., 'extensions', 'users', 'groups') */
  resource: string
  /** Action to check (default: 'read') */
  action?: string
  /** Redirect path when permission denied (default: '/dashboard') */
  redirectTo?: string
}

/**
 * PermissionRoute Component
 * 
 * Checks if user has required permission and redirects if not.
 * Admin users bypass all permission checks.
 */
export default function PermissionRoute({ 
  resource, 
  action = 'read',
  redirectTo = '/dashboard'
}: PermissionRouteProps) {
  const { isAuthenticated } = useAuthStore()
  const { can } = usePermission()
  const location = useLocation()

  // If not authenticated, redirect to loading screen
  if (!isAuthenticated) {
    console.log('[PermissionRoute] Not authenticated, redirecting to /')
    return <Navigate to="/" replace />
  }

  // Check permission
  if (!can(resource, action)) {
    console.log(`[PermissionRoute] No permission for ${resource}:${action}, redirecting to ${redirectTo}`)
    return <Navigate 
      to={redirectTo} 
      state={{ 
        permissionDenied: true, 
        resource,
        action,
        from: location.pathname 
      }} 
      replace 
    />
  }

  // User has permission, render child routes
  console.log(`[PermissionRoute] Permission granted for ${resource}:${action}`)
  return <Outlet />
}
