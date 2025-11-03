/**
 * Utility functions for consistent date/time formatting across the application
 * All functions convert UTC timestamps to user's local timezone with explicit timezone display
 */

/**
 * Format a date string or Date object to local time with timezone
 * @param dateInput - ISO date string or Date object
 * @returns Formatted date string with timezone (e.g., "2025/01/01, 14:30:00 GMT+7")
 */
export const formatDateTime = (dateInput: string | Date): string => {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short' // Shows timezone like "GMT+7"
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};

/**
 * Format a date string or Date object to local date only (no time)
 * @param dateInput - ISO date string or Date object
 * @returns Formatted date string (e.g., "2025/01/01")
 */
export const formatDate = (dateInput: string | Date): string => {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};

/**
 * Format a date string or Date object to relative time (e.g., "2 hours ago")
 * @param dateInput - ISO date string or Date object
 * @returns Relative time string
 */
export const formatRelativeTime = (dateInput: string | Date): string => {
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    return formatDate(date);
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return 'Invalid Date';
  }
};

/**
 * Format a duration in milliseconds to human-readable string
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string (e.g., "2h 30m")
 */
export const formatDuration = (ms: number): string => {
  if (ms < 0) return '0s';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

/**
 * Get local timezone offset string (e.g., "GMT+7")
 * @returns Timezone offset string
 */
export const getTimezoneOffset = (): string => {
  const date = new Date();
  const offset = -date.getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const sign = offset >= 0 ? '+' : '-';
  
  if (minutes === 0) {
    return `GMT${sign}${hours}`;
  }
  return `GMT${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
};

/**
 * Convert local datetime-local input value to ISO string (UTC)
 * @param localDateTime - Value from datetime-local input (e.g., "2025-01-01T14:30")
 * @returns ISO string in UTC
 */
export const localDateTimeToISO = (localDateTime: string): string => {
  try {
    // datetime-local input gives us local time without timezone
    // We need to convert it to a Date object and then to ISO (UTC)
    const date = new Date(localDateTime);
    return date.toISOString();
  } catch (error) {
    console.error('Error converting local datetime to ISO:', error);
    return new Date().toISOString();
  }
};

/**
 * Get current date/time formatted for datetime-local input
 * @param offsetDays - Number of days to offset (negative for past, positive for future)
 * @returns Formatted string for datetime-local input (e.g., "2025-01-01T14:30")
 */
export const getLocalDateTimeInputValue = (offsetDays: number = 0): string => {
  const date = new Date();
  
  if (offsetDays !== 0) {
    date.setDate(date.getDate() + offsetDays);
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

