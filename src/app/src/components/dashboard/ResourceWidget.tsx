import { ReactNode } from 'react'

interface ResourceWidgetProps {
  title: string
  icon: ReactNode
  value: number | string
  subtitle: string
  color?: 'blue' | 'green' | 'purple' | 'orange'
  isLoading?: boolean
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    icon: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  green: {
    bg: 'bg-green-500/10 dark:bg-green-500/20',
    icon: 'text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
  purple: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    icon: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
  },
  orange: {
    bg: 'bg-orange-500/10 dark:bg-orange-500/20',
    icon: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
  },
}

export default function ResourceWidget({
  title,
  icon,
  value,
  subtitle,
  color = 'blue',
  isLoading = false,
}: ResourceWidgetProps) {
  const colors = colorClasses[color]

  return (
    <div className={`card p-6 border ${colors.border}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors.bg}`}>
            <div className={colors.icon}>{icon}</div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </h3>
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
        </div>
      ) : (
        <>
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            {value}
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
              {subtitle}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

