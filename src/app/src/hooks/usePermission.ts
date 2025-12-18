import { usePermissionStore } from '@/stores/permissionStore'
import { useAuthStore } from '@/stores/authStore'

/**
 * Hook to check user permissions
 * Admin users bypass all permission checks
 */
export function usePermission() {
  const { user } = useAuthStore()
  const { hasPermission, hasAnyPermission, canAccess } = usePermissionStore()

  // Admin users have all permissions
  const isAdmin = user?.is_admin ?? false

  return {
    isAdmin,
    
    /**
     * Check specific permission (resource + action)
     */
    can: (resource: string, action: string) => {
      if (isAdmin) return true
      return hasPermission(resource, action)
    },
    
    /**
     * Check if user can view resource (any permission on resource)
     */
    canView: (resource: string) => {
      if (isAdmin) return true
      return hasAnyPermission(resource)
    },
    
    /**
     * Check read access
     */
    canRead: (resource: string) => {
      if (isAdmin) return true
      return canAccess(resource, 'read')
    },
    
    /**
     * Check write access (create, update, or delete)
     */
    canWrite: (resource: string) => {
      if (isAdmin) return true
      return hasPermission(resource, 'create') || 
             hasPermission(resource, 'update') || 
             hasPermission(resource, 'delete')
    },
    
    /**
     * Check manage access (for extensions and admin operations)
     */
    canManage: (resource: string) => {
      if (isAdmin) return true
      return hasPermission(resource, 'manage')
    },
    
    /**
     * Check create permission
     */
    canCreate: (resource: string) => {
      if (isAdmin) return true
      return hasPermission(resource, 'create')
    },
    
    /**
     * Check update permission
     */
    canUpdate: (resource: string) => {
      if (isAdmin) return true
      return hasPermission(resource, 'update')
    },
    
    /**
     * Check delete permission
     */
    canDelete: (resource: string) => {
      if (isAdmin) return true
      return hasPermission(resource, 'delete')
    },
  }
}
