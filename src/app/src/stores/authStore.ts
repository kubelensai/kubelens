import { create } from 'zustand'
import api from '@/services/api'
import { createRedirectUrl } from '@/utils/navigation'

interface User {
  id: number
  email: string
  username: string
  full_name: string
  avatar_url?: string
  auth_provider: string
  is_admin: boolean
}

interface ValidationResult {
  authenticated: boolean
  expired: boolean
  error?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: User) => void
  logout: (currentPath?: string) => Promise<void>
  updateUser: (user: User) => void
  initializeAuth: () => void
  validateSession: () => Promise<ValidationResult>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  // Initialize auth from localStorage
  initializeAuth: () => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        set({ token, user, isAuthenticated: true })
      } catch (error) {
        console.error('Failed to parse user from localStorage:', error)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
  },

  // Login
  login: (token: string, user: User) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ token, user, isAuthenticated: true })
  },

  // Logout
  logout: async (currentPath?: string) => {
    try {
      // Call logout API
      await api.post('/auth/logout')
    } catch (error) {
      console.error('Logout API error:', error)
      // Continue with logout even if API call fails
    } finally {
      // Clear localStorage
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      
      // Clear state
      set({ token: null, user: null, isAuthenticated: false })
      
      // Redirect to login with current path (if meaningful)
      if (currentPath && currentPath !== '/' && currentPath !== '/login' && currentPath !== '/logout') {
        const loginUrl = createRedirectUrl('/login', currentPath)
        console.log('[AuthStore] Logout - redirecting to:', loginUrl)
        window.location.href = loginUrl
      } else {
        console.log('[AuthStore] Logout - redirecting to: /login')
        window.location.href = '/login'
      }
    }
  },

  // Update user info
  updateUser: (user: User) => {
    localStorage.setItem('user', JSON.stringify(user))
    set({ user })
  },

  // Validate session with backend
  validateSession: async (): Promise<ValidationResult> => {
    console.log('[AuthStore] Validating session...')
    
    // Check if token exists in localStorage
    const token = localStorage.getItem('token')
    
    if (!token) {
      console.log('[AuthStore] No token found')
      set({ isAuthenticated: false, user: null, token: null })
      return { authenticated: false, expired: false }
    }

    // Check token expiry (JWT decode - client-side)
    try {
      const tokenParts = token.split('.')
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]))
        const now = Math.floor(Date.now() / 1000)
        
        if (payload.exp && payload.exp < now) {
          console.log('[AuthStore] Token expired (client-side check)')
          // Clear storage
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          set({ isAuthenticated: false, user: null, token: null })
          return { authenticated: false, expired: true }
        }
      }
    } catch (error) {
      console.error('[AuthStore] Error decoding token:', error)
      // Continue to API validation
    }

    // Validate with backend API
    try {
      console.log('[AuthStore] Validating token with API...')
      const response = await api.get('/auth/me')
      const user = response.data

      console.log('[AuthStore] ✅ Session valid, user:', user.email)
      
      // Update state with fresh user data
      set({ 
        isAuthenticated: true, 
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          auth_provider: user.auth_provider,
          is_admin: user.is_admin,
        }, 
        token 
      })
      
      // Update localStorage with fresh user data
      localStorage.setItem('user', JSON.stringify(user))
      
      return { authenticated: true, expired: false }
    } catch (error: any) {
      console.error('[AuthStore] Session validation failed:', error)

      // Check if it's a 401 (unauthorized/expired)
      if (error.response?.status === 401) {
        console.log('[AuthStore] ⚠️  Session expired (401 from API)')
        // Clear storage
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        set({ isAuthenticated: false, user: null, token: null })
        return { authenticated: false, expired: true }
      }

      // Other errors (network, 500, etc.)
      console.log('[AuthStore] ❌ Validation error (not expired, just error)')
      return { 
        authenticated: false, 
        expired: false, 
        error: error.message || 'Validation failed' 
      }
    }
  },
}))

