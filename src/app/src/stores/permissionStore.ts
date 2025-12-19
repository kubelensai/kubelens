import { create } from 'zustand'

export interface Permission {
  resource: string
  actions: string[]
  clusters: string[]
  namespaces: string[]
}

interface PermissionState {
  permissions: Permission[]
  isLoading: boolean
  error: string | null
  
  // Actions
  setPermissions: (permissions: Permission[]) => void
  clearPermissions: () => void
  
  // Permission checks
  hasPermission: (resource: string, action: string) => boolean
  hasAnyPermission: (resource: string) => boolean
  canAccess: (resource: string, action?: string) => boolean
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissions: [],
  isLoading: false,
  error: null,

  setPermissions: (permissions) => set({ permissions }),

  clearPermissions: () => set({ permissions: [], error: null }),

  hasPermission: (resource, action) => {
    const { permissions } = get()
    return permissions.some(perm => {
      // Check resource match (wildcard or exact)
      const resourceMatch = perm.resource === '*' || perm.resource === resource
      if (!resourceMatch) return false
      
      // Check action match (wildcard or exact)
      return perm.actions.some(a => a === '*' || a === action)
    })
  },

  hasAnyPermission: (resource) => {
    const { permissions } = get()
    return permissions.some(perm => 
      perm.resource === '*' || perm.resource === resource
    )
  },

  canAccess: (resource, action = 'read') => {
    return get().hasPermission(resource, action)
  },
}))
