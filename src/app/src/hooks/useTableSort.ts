import { useState, useMemo } from 'react'

type SortDirection = 'asc' | 'desc' | null

interface SortConfig<T> {
  key: keyof T | string
  direction: SortDirection
}

export function useTableSort<T>(data: T[], initialSort?: { key: keyof T | string; direction: SortDirection }) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(initialSort || null)

  const sortedData = useMemo(() => {
    if (!sortConfig || !sortConfig.direction) return data

    const sorted = [...data].sort((a, b) => {
      // Handle nested keys (e.g., "metadata.name")
      const getNestedValue = (obj: any, path: string) => {
        // Special handling for annotation keys with dots in their names
        // e.g., "metadata.annotations.storageclass.kubernetes.io/is-default-class"
        if (path.includes('metadata.annotations.')) {
          const parts = path.split('metadata.annotations.')
          if (parts.length === 2) {
            return obj?.metadata?.annotations?.[parts[1]]
          }
        }
        
        return path.split('.').reduce((current, key) => current?.[key], obj)
      }

      let aValue = getNestedValue(a, sortConfig.key as string)
      let bValue = getNestedValue(b, sortConfig.key as string)

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return 1
      if (bValue == null) return -1

      // Handle booleans
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        const aNum = aValue ? 1 : 0
        const bNum = bValue ? 1 : 0
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum
      }

      // Handle ISO date strings (e.g., "2024-01-01T00:00:00Z")
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const aDate = new Date(aValue)
        const bDate = new Date(bValue)
        
        // Check if both are valid dates
        if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
          return sortConfig.direction === 'asc'
            ? aDate.getTime() - bDate.getTime()
            : bDate.getTime() - aDate.getTime()
        }
        
        // Regular string comparison
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      // Handle dates
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortConfig.direction === 'asc'
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime()
      }

      // Convert to string as fallback
      const aStr = String(aValue)
      const bStr = String(bValue)
      return sortConfig.direction === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr)
    })

    return sorted
  }, [data, sortConfig])

  const requestSort = (key: keyof T | string) => {
    let direction: SortDirection = 'asc'

    if (sortConfig && sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc'
      } else if (sortConfig.direction === 'desc') {
        direction = null
      }
    }

    setSortConfig(direction ? { key, direction } : null)
  }

  return { sortedData, sortConfig, requestSort }
}

