import { create } from 'zustand'
import api from '@/services/api'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: number
  type: NotificationType
  title: string
  message: string
  created_at: string
  read: boolean
  action?: {
    label: string
    onClick: () => void
  }
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  
  // Actions
  fetchNotifications: () => Promise<void>
  fetchUnreadCount: () => Promise<void>
  addNotification: (notification: Omit<Notification, 'id' | 'created_at' | 'read'>) => Promise<void>
  removeNotification: (id: number) => Promise<void>
  markAsRead: (id: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  clearAll: () => Promise<void>
  getUnreadCount: () => number
  
  // Local state setters
  setNotifications: (notifications: Notification[]) => void
  setUnreadCount: (count: number) => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  
  // Fetch all notifications from backend
  fetchNotifications: async () => {
    try {
      set({ isLoading: true })
      const response = await api.get('/notifications?limit=100')
      set({ 
        notifications: response.data,
        isLoading: false
      })
      // Also update unread count
      await get().fetchUnreadCount()
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
      set({ isLoading: false })
    }
  },
  
  // Fetch unread count from backend
  fetchUnreadCount: async () => {
    try {
      const response = await api.get('/notifications/unread/count')
      set({ unreadCount: response.data.count })
    } catch (error) {
      console.error('Failed to fetch unread count:', error)
    }
  },
  
  // Add notification (creates in backend)
  addNotification: async (notification) => {
    try {
      // For now, we'll add it locally and let the backend sync happen
      // In a real-world scenario, you might want to create it via API
      const newNotification: Notification = {
        ...notification,
        id: Date.now(), // Temporary ID
        created_at: new Date().toISOString(),
        read: false,
      }
      
      set((state) => ({
        notifications: [newNotification, ...state.notifications].slice(0, 100),
        unreadCount: state.unreadCount + 1
      }))
      
      // Optionally sync with backend in background
      // This would require a backend endpoint to create notifications
    } catch (error) {
      console.error('Failed to add notification:', error)
    }
  },
  
  // Remove notification (deletes from backend)
  removeNotification: async (id) => {
    try {
      await api.delete(`/notifications/${id}`)
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }))
      await get().fetchUnreadCount()
    } catch (error) {
      console.error('Failed to remove notification:', error)
    }
  },
  
  // Mark notification as read (updates backend)
  markAsRead: async (id) => {
    try {
      await api.put(`/notifications/${id}/read`)
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      }))
      await get().fetchUnreadCount()
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  },
  
  // Mark all notifications as read (updates backend)
  markAllAsRead: async () => {
    try {
      await api.put('/notifications/read-all')
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0
      }))
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error)
    }
  },
  
  // Clear all notifications (deletes from backend)
  clearAll: async () => {
    try {
      await api.delete('/notifications')
      set({ notifications: [], unreadCount: 0 })
    } catch (error) {
      console.error('Failed to clear all notifications:', error)
    }
  },
  
  // Get unread count (from local state)
  getUnreadCount: () => {
    return get().unreadCount
  },
  
  // Local state setters (for external updates)
  setNotifications: (notifications) => {
    set({ notifications })
  },
  
  setUnreadCount: (count) => {
    set({ unreadCount: count })
  },
}))

