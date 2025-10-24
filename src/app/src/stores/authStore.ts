import { create } from 'zustand'
import api from '@/services/api'

interface User {
  id: number
  email: string
  username: string
  full_name: string
  avatar_url?: string
  auth_provider: string
  is_admin: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: User) => void
  logout: () => Promise<void>
  updateUser: (user: User) => void
  initializeAuth: () => void
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
  logout: async () => {
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
      
      // Redirect to login
      window.location.href = '/login'
    }
  },

  // Update user info
  updateUser: (user: User) => {
    localStorage.setItem('user', JSON.stringify(user))
    set({ user })
  },
}))

