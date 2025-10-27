import { create } from 'zustand'
import api from '@/services/api'

interface UserSession {
  id?: number
  user_id?: number
  selected_cluster: string | null
  selected_namespace: string | null
  selected_theme: 'light' | 'dark'
  updated_at?: string
}

interface SessionState {
  session: UserSession | null
  isLoading: boolean
  isInitialized: boolean
  
  // Actions
  fetchSession: () => Promise<void>
  updateSession: (updates: Partial<UserSession>) => Promise<void>
  setSelectedCluster: (cluster: string | null) => Promise<void>
  setSelectedNamespace: (namespace: string | null) => Promise<void>
  setTheme: (theme: 'light' | 'dark') => Promise<void>
  clearSession: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  isLoading: false,
  isInitialized: false,

  fetchSession: async () => {
    try {
      set({ isLoading: true })
      const response = await api.get('/session')
      const session = response.data as UserSession
      
      // Apply theme from session
      const theme = session.selected_theme || 'dark'
      if (theme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      
      set({ 
        session, 
        isLoading: false,
        isInitialized: true 
      })
    } catch (error) {
      console.error('Failed to fetch session:', error)
      // Initialize with default values if fetch fails
      set({ 
        session: {
          selected_cluster: null,
          selected_namespace: null,
          selected_theme: 'dark'
        },
        isLoading: false,
        isInitialized: true
      })
    }
  },

  updateSession: async (updates: Partial<UserSession>) => {
    const currentSession = get().session
    if (!currentSession) return

    try {
      const updatedSession = { ...currentSession, ...updates }
      
      // Optimistically update local state
      set({ session: updatedSession })
      
      // Update backend
      await api.put('/session', {
        selected_cluster: updatedSession.selected_cluster,
        selected_namespace: updatedSession.selected_namespace,
        selected_theme: updatedSession.selected_theme,
      })
      
      // Apply theme if it was updated
      if (updates.selected_theme) {
        if (updates.selected_theme === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    } catch (error) {
      console.error('Failed to update session:', error)
      // Revert on error
      set({ session: currentSession })
    }
  },

  setSelectedCluster: async (cluster: string | null) => {
    await get().updateSession({ selected_cluster: cluster })
  },

  setSelectedNamespace: async (namespace: string | null) => {
    await get().updateSession({ selected_namespace: namespace })
  },

  setTheme: async (theme: 'light' | 'dark') => {
    await get().updateSession({ selected_theme: theme })
  },

  clearSession: () => {
    set({ 
      session: {
        selected_cluster: null,
        selected_namespace: null,
        selected_theme: 'dark'
      }
    })
  },
}))

