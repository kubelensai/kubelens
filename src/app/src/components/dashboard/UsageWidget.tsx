import { ReactNode } from 'react'

interface UsageWidgetProps {
  title: string
  icon: ReactNode
  requests: string
  limits: string
  total: string
  requestsPercent: string
  limitsPercent: string
  isLoading?: boolean
}

export default function UsageWidget({
  title,
  icon,
  requests,
  limits,
  total,
  requestsPercent,
  limitsPercent,
  isLoading = false,
}: UsageWidgetProps) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        <div className="text-gray-600 dark:text-gray-400">{icon}</div>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Requests */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                Requests
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {requests}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(parseFloat(requestsPercent), 100)}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {requestsPercent}% of capacity
            </div>
          </div>

          {/* Limits */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                Limits
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {limits}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(parseFloat(limitsPercent), 100)}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {limitsPercent}% of capacity
            </div>
          </div>

          {/* Available */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Available
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {total}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

