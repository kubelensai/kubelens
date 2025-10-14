import { useNotificationStore } from '@/stores/notificationStore'

/**
 * Notification utility functions
 * Use these to trigger notifications from anywhere in the app
 */

interface NotificationOptions {
  title: string
  message: string
  action?: {
    label: string
    onClick: () => void
  }
}

export const notify = {
  success: (options: NotificationOptions) => {
    useNotificationStore.getState().addNotification({
      type: 'success',
      ...options,
    })
  },

  error: (options: NotificationOptions) => {
    useNotificationStore.getState().addNotification({
      type: 'error',
      ...options,
    })
  },

  warning: (options: NotificationOptions) => {
    useNotificationStore.getState().addNotification({
      type: 'warning',
      ...options,
    })
  },

  info: (options: NotificationOptions) => {
    useNotificationStore.getState().addNotification({
      type: 'info',
      ...options,
    })
  },
}

// Quick notification shortcuts
export const notifySuccess = (title: string, message: string) => {
  notify.success({ title, message })
}

export const notifyError = (title: string, message: string) => {
  notify.error({ title, message })
}

export const notifyWarning = (title: string, message: string) => {
  notify.warning({ title, message })
}

export const notifyInfo = (title: string, message: string) => {
  notify.info({ title, message })
}

// Resource-specific notification helpers
export const notifyResourceAction = {
  created: (resourceType: string, name: string) => {
    notify.success({
      title: `${resourceType} Created`,
      message: `Successfully created ${resourceType.toLowerCase()} "${name}"`,
    })
  },

  updated: (resourceType: string, name: string) => {
    notify.success({
      title: `${resourceType} Updated`,
      message: `Successfully updated ${resourceType.toLowerCase()} "${name}"`,
    })
  },

  deleted: (resourceType: string, name: string) => {
    notify.success({
      title: `${resourceType} Deleted`,
      message: `Successfully deleted ${resourceType.toLowerCase()} "${name}"`,
    })
  },

  scaled: (resourceType: string, name: string, replicas: number) => {
    notify.success({
      title: `${resourceType} Scaled`,
      message: `Scaled ${resourceType.toLowerCase()} "${name}" to ${replicas} replicas`,
    })
  },

  restarted: (resourceType: string, name: string) => {
    notify.success({
      title: `${resourceType} Restarted`,
      message: `Successfully restarted ${resourceType.toLowerCase()} "${name}"`,
    })
  },

  failed: (action: string, resourceType: string, name: string, error?: string) => {
    notify.error({
      title: `Failed to ${action} ${resourceType}`,
      message: error || `Could not ${action} ${resourceType.toLowerCase()} "${name}"`,
    })
  },

  drained: (resourceType: string, name: string, stats: { evicted: number, failed: number, skipped: number }) => {
    notify.success({
      title: `${resourceType} Drained`,
      message: `Successfully drained ${resourceType.toLowerCase()} "${name}"\n• Evicted: ${stats.evicted}\n• Failed: ${stats.failed}\n• Skipped: ${stats.skipped} (DaemonSets)`,
    })
  },
}

