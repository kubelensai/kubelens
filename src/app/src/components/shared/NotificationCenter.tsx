import { Fragment, useEffect, useState, useRef } from 'react'
import { Menu, Transition } from '@headlessui/react'
import {
  BellIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { BellIcon as BellIconSolid } from '@heroicons/react/24/solid'
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
  success: 'text-green-500 bg-green-50 dark:bg-green-900/20',
  error: 'text-red-500 bg-red-50 dark:bg-red-900/20',
  warning: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
  info: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
}

export default function NotificationCenter() {
  const { notifications, removeNotification, markAsRead, markAllAsRead, clearAll, getUnreadCount } =
    useNotificationStore()
  
  const unreadCount = getUnreadCount()
  const [showPulse, setShowPulse] = useState(false)
  const prevCountRef = useRef(unreadCount)

  // Trigger pulse animation when new notification arrives
  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      setShowPulse(true)
      const timer = setTimeout(() => setShowPulse(false), 1000)
      return () => clearTimeout(timer)
    }
    prevCountRef.current = unreadCount
  }, [unreadCount])

  const handleNotificationClick = (id: string) => {
    markAsRead(id)
  }

  return (
    <Menu as="div" className="relative">
      {/* Notification Button */}
      <Menu.Button 
        className={clsx(
          "relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
          showPulse && "animate-bounce"
        )}
      >
        {unreadCount > 0 ? (
          <BellIconSolid 
            className={clsx(
              "h-5 w-5 text-primary-600 dark:text-primary-400 transition-all duration-300",
              showPulse && "scale-125"
            )} 
          />
        ) : (
          <BellIcon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        )}
        
        {/* Badge Counter */}
        {unreadCount > 0 && (
          <span 
            className={clsx(
              "absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-800",
              showPulse ? "animate-ping" : "animate-pulse"
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        
        {/* Ripple Effect on New Notification */}
        {showPulse && (
          <span className="absolute inset-0 rounded-lg bg-primary-400 dark:bg-primary-500 opacity-75 animate-ping" />
        )}
      </Menu.Button>

      {/* Notifications Panel */}
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-2 w-96 origin-top-right rounded-xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="Clear all"
                >
                  <TrashIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[32rem] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <BellIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  No notifications yet
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">
                  You'll see important updates here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {notifications.map((notification) => {
                  const Icon = notificationIcons[notification.type]
                  const colorClass = notificationColors[notification.type]

                  return (
                    <Menu.Item key={notification.id}>
                      {({ active }) => (
                        <div
                          className={clsx(
                            'relative px-4 py-3 transition-colors',
                            active && 'bg-gray-50 dark:bg-gray-700/50',
                            !notification.read && 'bg-primary-50/30 dark:bg-primary-900/10'
                          )}
                          onClick={() => handleNotificationClick(notification.id)}
                        >
                          {/* Unread indicator */}
                          {!notification.read && (
                            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary-600 dark:bg-primary-400" />
                          )}

                          <div className="flex gap-3">
                            {/* Icon */}
                            <div className={clsx('flex-shrink-0 rounded-lg p-2', colorClass)}>
                              <Icon className="h-5 w-5" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {notification.title}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                              </p>

                              {/* Action Button */}
                              {notification.action && (
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
                            </div>

                            {/* Delete Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                removeNotification(notification.id)
                              }}
                              className="flex-shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              title="Remove"
                            >
                              <XMarkIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                            </button>
                          </div>
                        </div>
                      )}
                    </Menu.Item>
                  )
                })}
              </div>
            )}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  )
}

