import { useState, useEffect } from 'react'
import { getNextExecution, getCountdown, getTimezoneDisplay } from '@/utils/cron'
import { ClockIcon } from '@heroicons/react/24/outline'

interface NextExecutionCountdownProps {
  schedule: string
  timezone?: string
  suspended?: boolean
  compact?: boolean
}

export default function NextExecutionCountdown({ 
  schedule, 
  timezone, 
  suspended = false,
  compact = false 
}: NextExecutionCountdownProps) {
  const [nextExec, setNextExec] = useState<ReturnType<typeof getNextExecution>>(null)
  const [countdown, setCountdown] = useState<string>('')

  useEffect(() => {
    if (suspended) return

    // Initial calculation
    const exec = getNextExecution(schedule, timezone)
    setNextExec(exec)
    if (exec) {
      setCountdown(getCountdown(exec.date))
    }

    // Update countdown every second
    const interval = setInterval(() => {
      const exec = getNextExecution(schedule, timezone)
      setNextExec(exec)
      if (exec) {
        setCountdown(getCountdown(exec.date))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [schedule, timezone, suspended])

  if (suspended) {
    return (
      <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
        <ClockIcon className="w-4 h-4" />
        <span className="text-sm font-medium">Suspended</span>
      </div>
    )
  }

  if (!nextExec) {
    return (
      <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
        <ClockIcon className="w-4 h-4" />
        <span className="text-sm">Invalid schedule</span>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <ClockIcon className="w-4 h-4 text-blue-500 dark:text-blue-400" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {countdown}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {nextExec.formatted}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
      <ClockIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
          {countdown}
        </p>
        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
          {nextExec.formatted}
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
          {getTimezoneDisplay(nextExec.timezone)}
        </p>
      </div>
    </div>
  )
}

