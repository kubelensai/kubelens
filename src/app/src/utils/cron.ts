import CronExpressionParser from 'cron-parser'

export interface NextExecution {
  date: Date
  countdown: string
  formatted: string
  timezone: string
  timezoneOffset: string
}

/**
 * Calculate the next execution time for a cron schedule
 * @param schedule - Cron schedule string (e.g., "0 * * * *")
 * @param timezone - Timezone (default: local timezone)
 * @returns NextExecution object with date, countdown, and formatted string
 */
export function getNextExecution(schedule: string, timezone?: string): NextExecution | null {
  try {
    // Normalize the schedule: Kubernetes uses 5-field format (minute hour day month weekday)
    // but cron-parser expects 6-field format (second minute hour day month weekday)
    // If we have 5 fields, prepend '0' for seconds
    const fields = schedule.trim().split(/\s+/)
    let normalizedSchedule = schedule
    
    if (fields.length === 5) {
      // Standard Kubernetes cron format (5 fields)
      normalizedSchedule = `0 ${schedule}`
    }
    
    // Validate the schedule before parsing
    // Check for impossible dates like Feb 31, Apr 31, etc.
    const scheduleFields = normalizedSchedule.split(/\s+/)
    if (scheduleFields.length >= 4) {
      const day = scheduleFields[3] // day of month
      const month = scheduleFields[4] // month
      
      // Check for specific impossible date combinations
      if (day && month && !day.includes('*') && !day.includes('/') && !month.includes('*') && !month.includes('/')) {
        const dayNum = parseInt(day)
        const monthNum = parseInt(month)
        
        // February 29-31
        if (monthNum === 2 && dayNum > 29) {
          return null
        }
        // April, June, September, November (30 days)
        if ([4, 6, 9, 11].includes(monthNum) && dayNum > 30) {
          return null
        }
        // Any month with day > 31
        if (dayNum > 31) {
          return null
        }
      }
    }
    
    const options = timezone ? { tz: timezone } : { currentDate: new Date() }
    const interval = CronExpressionParser.parse(normalizedSchedule, options)
    const nextDate = interval.next().toDate()
    
    // Get timezone info
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    const tzOffset = new Date().toLocaleString('en-US', { 
      timeZone: tz, 
      timeZoneName: 'longOffset' 
    }).split(' ').pop() || ''
    
    return {
      date: nextDate,
      countdown: getCountdown(nextDate),
      formatted: formatNextExecution(nextDate, tz),
      timezone: tz,
      timezoneOffset: tzOffset,
    }
  } catch (error) {
    // Silently handle invalid schedules - don't log to console to avoid cluttering
    // Invalid schedules will show as "-" in the UI
    return null
  }
}

/**
 * Get countdown string (e.g., "In 4 minutes 12 seconds")
 */
export function getCountdown(targetDate: Date): string {
  const now = new Date()
  const diff = targetDate.getTime() - now.getTime()
  
  if (diff <= 0) {
    return 'Now'
  }
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) {
    const remainingHours = hours % 24
    if (remainingHours > 0) {
      return `In ${days} day${days > 1 ? 's' : ''} ${remainingHours} hour${remainingHours > 1 ? 's' : ''}`
    }
    return `In ${days} day${days > 1 ? 's' : ''}`
  }
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60
    if (remainingMinutes > 0) {
      return `In ${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`
    }
    return `In ${hours} hour${hours > 1 ? 's' : ''}`
  }
  
  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    if (remainingSeconds > 0) {
      return `In ${minutes} minute${minutes > 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''}`
    }
    return `In ${minutes} minute${minutes > 1 ? 's' : ''}`
  }
  
  return `In ${seconds} second${seconds > 1 ? 's' : ''}`
}

/**
 * Format next execution time (e.g., "Today at 6:50 AM")
 */
export function formatNextExecution(date: Date, timezone: string): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  
  let dayPrefix = ''
  if (targetDay.getTime() === today.getTime()) {
    dayPrefix = 'Today'
  } else if (targetDay.getTime() === tomorrow.getTime()) {
    dayPrefix = 'Tomorrow'
  } else {
    dayPrefix = date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric',
      timeZone: timezone 
    })
  }
  
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true,
    timeZone: timezone 
  })
  
  return `${dayPrefix} at ${timeStr}`
}

/**
 * Get timezone display string (e.g., "Asia/Saigon, UTC+07:00")
 */
export function getTimezoneDisplay(timezone: string): string {
  try {
    const now = new Date()
    const offset = now.toLocaleString('en-US', { 
      timeZone: timezone, 
      timeZoneName: 'longOffset' 
    }).split(' ').pop() || ''
    
    return `${timezone.replace('_', ' ')}, ${offset}`
  } catch (error) {
    return timezone
  }
}

