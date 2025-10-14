/**
 * Format a date to a short age string
 * @param date - The date to format
 * @returns Short age string (e.g., "34m", "1d", "365d")
 */
export function formatAge(date: Date | string): string {
  const now = Date.now()
  const timestamp = typeof date === 'string' ? new Date(date).getTime() : date.getTime()
  const diffInSeconds = Math.floor((now - timestamp) / 1000)

  if (diffInSeconds < 0) {
    return '0s'
  }

  const units = [
    { label: 'y', seconds: 365 * 24 * 60 * 60 },
    { label: 'd', seconds: 24 * 60 * 60 },
    { label: 'h', seconds: 60 * 60 },
    { label: 'm', seconds: 60 },
    { label: 's', seconds: 1 },
  ]

  for (const unit of units) {
    const value = Math.floor(diffInSeconds / unit.seconds)
    if (value >= 1) {
      return `${value}${unit.label}`
    }
  }

  return '0s'
}

/**
 * Format bytes to human-readable string
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * Format CPU usage to cores
 * @param millicores - CPU in millicores
 * @returns Formatted string (e.g., "0.5 cores")
 */
export function formatCPU(millicores: number): string {
  const cores = millicores / 1000
  return `${cores.toFixed(3)} cores`
}

