import clsx from 'clsx'

interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  subtitle?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  isLoading?: boolean
}

export default function MetricCard({
  title,
  value,
  unit,
  subtitle,
  icon,
  trend,
  trendValue,
  color = 'primary',
  isLoading = false,
}: MetricCardProps) {
  const colorClasses = {
    primary: 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400',
    success: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    danger: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  }

  return (
    <div className="card p-4 sm:p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className={clsx(
        'absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 opacity-50',
        colorClasses[color]
      )} />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              {title}
            </p>
            
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {value}
                  </span>
                  {unit && (
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {unit}
                    </span>
                  )}
                </div>
                
                {subtitle && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {subtitle}
                  </p>
                )}
                
                {trend && trendValue && (
                  <div className={clsx(
                    'inline-flex items-center gap-1 mt-2 text-xs font-medium',
                    trend === 'up' && 'text-green-600 dark:text-green-400',
                    trend === 'down' && 'text-red-600 dark:text-red-400',
                    trend === 'neutral' && 'text-gray-600 dark:text-gray-400'
                  )}>
                    {trend === 'up' && '↑'}
                    {trend === 'down' && '↓'}
                    {trend === 'neutral' && '→'}
                    <span>{trendValue}</span>
                  </div>
                )}
              </>
            )}
          </div>
          
          {icon && (
            <div className={clsx(
              'p-3 rounded-lg',
              colorClasses[color]
            )}>
              {icon}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

