import { useEffect, useState, useRef } from 'react'
import {
  BellIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useNotificationStore } from '@/stores/notificationStore'
import { formatDistanceToNow } from 'date-fns'

const notificationIcons = {
  success: CheckCircleIcon,
  error: ExclamationCircleIcon,
  warning: ExclamationTriangleIcon,
  info: InformationCircleIcon,
}

const notificationColors = {
  success: 'text-success-600 bg-success-50 dark:bg-success-500/15',
  error: 'text-error-600 bg-error-50 dark:bg-error-500/15',
  warning: 'text-warning-600 bg-warning-50 dark:bg-warning-500/15',
  info: 'text-primary-600 bg-primary-50 dark:bg-primary-500/15',
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { 
    notifications, 
    unreadCount,
    removeNotification, 
    markAsRead, 
    markAllAsRead, 
    clearAll,
    fetchNotifications,
    fetchUnreadCount
  } = useNotificationStore()
  
  const prevCountRef = useRef(unreadCount)

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications()
    fetchUnreadCount()
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [fetchNotifications, fetchUnreadCount])

  // Update ref when unreadCount changes
  useEffect(() => {
    prevCountRef.current = unreadCount
  }, [unreadCount])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('.notification-dropdown-toggle')
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleDropdown = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      fetchNotifications()
    }
  }

  const handleNotificationClick = (id: number) => {
    markAsRead(id)
  }

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="notification-dropdown-toggle relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full h-11 w-11 hover:text-gray-700 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
      >
        <span
          className={clsx(
            "absolute right-0 top-0.5 z-10 h-2 w-2 rounded-full bg-orange-400",
            unreadCount === 0 && "hidden"
          )}
        >
          <span className="absolute inline-flex w-full h-full bg-orange-400 rounded-full opacity-75 animate-ping"></span>
        </span>
        <BellIcon className="h-5 w-5" />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute -right-[120px] sm:right-0 z-40 mt-2 flex h-auto max-h-[480px] w-[320px] sm:w-[361px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-gray-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
            <h5 className="text-base font-semibold text-gray-800 dark:text-gray-200">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500">
                  {unreadCount}
                </span>
              )}
            </h5>
            <button
              onClick={toggleDropdown}
              className="text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Notifications List */}
          <ul className="flex-1 flex flex-col h-auto overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <li className="flex flex-col items-center justify-center py-12 px-4">
                <BellIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  No notifications yet
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">
                  You'll see important updates here
                </p>
              </li>
            ) : (
              notifications.map((notification) => {
                const Icon = notificationIcons[notification.type]
                const colorClass = notificationColors[notification.type]

                return (
                  <li key={notification.id}>
                    <div
                      onClick={() => handleNotificationClick(notification.id)}
                      className={clsx(
                        "relative flex gap-3 rounded-lg border-b border-gray-100 p-3 py-3 cursor-pointer transition-colors dark:border-gray-800",
                        notification.read 
                          ? 'hover:bg-gray-50 dark:hover:bg-gray-800/30 opacity-75' 
                          : 'bg-primary-50/40 hover:bg-primary-50/60 dark:bg-primary-900/10 dark:hover:bg-primary-900/15'
                      )}
                    >
                      {/* Unread indicator dot - only show when unread */}
                      {!notification.read && (
                        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary-600 dark:bg-primary-400" />
                      )}

                      {/* Icon */}
                      <span 
                        className={clsx(
                          'flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0',
                          notification.read 
                            ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600' 
                            : colorClass
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>

                      {/* Content */}
                      <span className="flex-1 min-w-0 block">
                        <span 
                          className={clsx(
                            "mb-1 block text-sm font-medium",
                            notification.read 
                              ? 'text-gray-600 dark:text-gray-400' 
                              : 'text-gray-900 dark:text-white'
                          )}
                        >
                          {notification.title}
                        </span>
                        <span 
                          className={clsx(
                            "block text-xs line-clamp-2",
                            notification.read 
                              ? 'text-gray-500 dark:text-gray-500' 
                              : 'text-gray-700 dark:text-gray-300'
                          )}
                        >
                          {notification.message}
                        </span>
                        <span className="flex items-center gap-2 mt-1 text-gray-400 text-xs dark:text-gray-500">
                          <span>{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}</span>
                        </span>

                        {/* Action Button */}
                        {notification.action && !notification.read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              notification.action?.onClick()
                            }}
                            className="mt-2 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                          >
                            {notification.action.label}
                          </button>
                        )}
                      </span>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeNotification(notification.id)
                        }}
                        className="flex-shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors self-start"
                        title="Remove"
                      >
                        <XMarkIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      </button>
                    </div>
                  </li>
                )
              })
            )}
          </ul>

          {/* Footer Actions */}
          {notifications.length > 0 && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  Mark All Read
                </button>
              )}
              <button
                onClick={clearAll}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
