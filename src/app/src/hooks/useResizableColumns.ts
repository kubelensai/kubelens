import { useState, useCallback, useEffect, useRef } from 'react'

interface ColumnWidths {
  [key: string]: number
}

export function useResizableColumns(initialWidths: ColumnWidths, storageKey?: string) {
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => {
    // Try to load saved widths from localStorage
    if (storageKey) {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          return initialWidths
        }
      }
    }
    return initialWidths
  })

  const [activeColumn, setActiveColumn] = useState<string | null>(null)
  const startXRef = useRef<number>(0)
  const startWidthRef = useRef<number>(0)

  // Save to localStorage when widths change
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(columnWidths))
    }
  }, [columnWidths, storageKey])

  const handleMouseDown = useCallback((columnKey: string, e: React.MouseEvent) => {
    e.preventDefault()
    setActiveColumn(columnKey)
    startXRef.current = e.clientX
    startWidthRef.current = columnWidths[columnKey] || 150
  }, [columnWidths])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!activeColumn) return

    const diff = e.clientX - startXRef.current
    const newWidth = Math.max(50, startWidthRef.current + diff) // Minimum width of 50px

    setColumnWidths(prev => ({
      ...prev,
      [activeColumn]: newWidth
    }))
  }, [activeColumn])

  const handleMouseUp = useCallback(() => {
    setActiveColumn(null)
  }, [])

  useEffect(() => {
    if (activeColumn) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [activeColumn, handleMouseMove, handleMouseUp])

  const resetWidths = useCallback(() => {
    setColumnWidths(initialWidths)
    if (storageKey) {
      localStorage.removeItem(storageKey)
    }
  }, [initialWidths, storageKey])

  return {
    columnWidths,
    handleMouseDown,
    resetWidths,
    isResizing: activeColumn !== null
  }
}

