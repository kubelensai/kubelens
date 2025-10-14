import { ReactNode } from 'react'
import clsx from 'clsx'

interface StatCardProps {
  title: string
  value: string | number
  icon: ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
  iconColor?: string
  className?: string
}

export default function StatCard({
  title,
  value,
  icon,
  trend,
  iconColor = 'text-primary-600',
  className,
}: StatCardProps) {
  return (
    <div className={clsx('card-stat group', className)}>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div
            className={clsx(
              'p-2 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 group-hover:scale-110 transition-transform',
              iconColor
            )}
          >
            <div className="w-5 h-5 sm:w-6 sm:h-6">{icon}</div>
          </div>
          {trend && (
            <div
              className={clsx(
                'flex items-center gap-1 text-xs sm:text-sm font-medium',
                trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              )}
            >
              <svg
                className={clsx('w-3 h-3 sm:w-4 sm:h-4', trend.isPositive ? '' : 'rotate-180')}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        
        <div>
          <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 sm:mb-2">
            {title}
          </h3>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
        </div>
      </div>
    </div>
  )
}

