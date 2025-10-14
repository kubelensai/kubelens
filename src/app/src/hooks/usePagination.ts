import { useState, useMemo, useEffect } from 'react'

const PAGE_SIZE_PREFIX = 'kubelens-page-size-'

export function usePagination<T>(data: T[], defaultPageSize: number = 10, pageKey?: string) {
  // Create a unique storage key for this page
  const storageKey = pageKey ? `${PAGE_SIZE_PREFIX}${pageKey}` : `${PAGE_SIZE_PREFIX}global`
  
  // Load page size from localStorage, fallback to default
  const [pageSize, setPageSize] = useState<number>(() => {
    const stored = localStorage.getItem(storageKey)
    return stored ? parseInt(stored, 10) : defaultPageSize
  })
  
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Save page size to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(storageKey, pageSize.toString())
  }, [pageSize, storageKey])

  // Reset to page 1 when data changes significantly
  useEffect(() => {
    if (currentPage > 1 && data.length <= pageSize) {
      setCurrentPage(1)
    }
  }, [data.length, pageSize, currentPage])

  const totalPages = useMemo(() => {
    return Math.ceil(data.length / pageSize)
  }, [data.length, pageSize])

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return data.slice(startIndex, endIndex)
  }, [data, currentPage, pageSize])

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages))
    setCurrentPage(validPage)
  }

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const changePageSize = (newSize: number) => {
    setPageSize(newSize)
    setCurrentPage(1) // Reset to first page when changing page size
  }

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems: data.length,
    paginatedData,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    changePageSize,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  }
}

