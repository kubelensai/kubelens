import { ReactNode, useState, useMemo } from 'react'
import {
  MagnifyingGlassIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

export interface Column<T> {
  key: string
  header: string | ReactNode
  accessor: (item: T) => ReactNode
  sortable?: boolean
  sortValue?: (item: T) => string | number  // For custom sort logic
  searchValue?: (item: T) => string  // For custom search logic
  className?: string
  headerClassName?: string
}

export interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  searchPlaceholder?: string
  isLoading?: boolean
  emptyMessage?: string
  emptyIcon?: ReactNode
  showPagination?: boolean
  showSearch?: boolean
  pageSize?: number
  mobileCardRenderer?: (item: T, index: number) => ReactNode
  onRowClick?: (item: T) => void
  className?: string
  keyExtractor: (item: T) => string | number
}

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = 'Search...',
  isLoading = false,
  emptyMessage = 'No data available',
  emptyIcon,
  showPagination = true,
  showSearch = true,
  pageSize = 10,
  mobileCardRenderer,
  onRowClick,
  className,
  keyExtractor,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data

    const lowerSearch = searchTerm.toLowerCase()

    return data.filter((item) => {
      // Search across all columns that have searchValue defined
      return columns.some((column) => {
        if (column.searchValue) {
          const searchVal = column.searchValue(item)
          return searchVal?.toLowerCase().includes(lowerSearch)
        }
        return false
      })
    })
  }, [data, searchTerm, columns])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData

    const sorted = [...filteredData].sort((a, b) => {
      const column = columns.find((col) => col.key === sortConfig.key)
      if (!column) return 0

      // Use sortValue if provided, otherwise fall back to accessor
      const aValue = column.sortValue ? column.sortValue(a) : column.accessor(a)
      const bValue = column.sortValue ? column.sortValue(b) : column.accessor(b)

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return 1
      if (bValue == null) return -1

      // Handle numeric comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        const comparison = aValue - bValue
        return sortConfig.direction === 'asc' ? comparison : -comparison
      }

      // Convert to string for comparison
      const aStr = String(aValue)
      const bStr = String(bValue)

      const comparison = aStr.localeCompare(bStr, undefined, { numeric: true })
      return sortConfig.direction === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [filteredData, sortConfig, columns])

  // Paginate data
  const totalPages = Math.ceil(sortedData.length / pageSize)
  const paginatedData = useMemo(() => {
    if (!showPagination) return sortedData
    const start = (currentPage - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, currentPage, pageSize, showPagination])

  // Handle sorting
  const handleSort = (key: string) => {
    const column = columns.find((col) => col.key === key)
    if (!column?.sortable) return

    setSortConfig((current) => {
      if (current?.key === key) {
        return current.direction === 'asc'
          ? { key, direction: 'desc' }
          : null
      }
      return { key, direction: 'asc' }
    })
  }

  // Handle pagination
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  // Reset to page 1 when search changes
  useMemo(() => {
    setCurrentPage(1)
  }, [searchTerm])

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Search Bar */}
      {showSearch && (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchPlaceholder}
            className="block w-full pl-10 pr-3 py-2.5 text-sm text-gray-900 border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-700 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500 transition-colors"
          />
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] shadow-sm">
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-full">
            {/* Table Header */}
            <thead className="border-b border-gray-100 dark:border-white/[0.05]">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    onClick={() => handleSort(column.key)}
                    className={clsx(
                      'px-5 py-3 font-medium text-gray-500 text-start text-xs uppercase tracking-wider dark:text-gray-400',
                      column.headerClassName,
                      column.sortable && 'cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {column.header}
                      {column.sortable && (
                        <span className="flex flex-col">
                          {sortConfig?.key === column.key ? (
                            sortConfig.direction === 'asc' ? (
                              <ChevronUpIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                            ) : (
                              <ChevronDownIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                            )
                          ) : (
                            <div className="w-4 h-4 opacity-30">
                              <ChevronUpIcon className="w-4 h-4" />
                            </div>
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin dark:border-gray-700 dark:border-t-primary-500" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      {emptyIcon || (
                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <MagnifyingGlassIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                        </div>
                      )}
                      <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item) => (
                  <tr
                    key={keyExtractor(item)}
                    onClick={() => onRowClick?.(item)}
                    className={clsx(
                      'hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors',
                      onRowClick && 'cursor-pointer'
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={clsx(
                          'px-5 py-4 text-gray-900 text-sm dark:text-white',
                          column.className
                        )}
                      >
                        {column.accessor(item)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-white/[0.05]">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin dark:border-gray-700 dark:border-t-primary-500" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-white/[0.05]">
            {emptyIcon || (
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <MagnifyingGlassIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
              </div>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
          </div>
        ) : (
          paginatedData.map((item, index) => (
            <div
              key={keyExtractor(item)}
              onClick={() => onRowClick?.(item)}
              className={clsx(
                'bg-white dark:bg-white/[0.03] rounded-xl border border-gray-200 dark:border-white/[0.05] p-4 shadow-sm',
                onRowClick && 'cursor-pointer active:scale-[0.98] transition-transform'
              )}
            >
              {mobileCardRenderer ? (
                mobileCardRenderer(item, index)
              ) : (
                <div className="space-y-3">
                  {columns.map((column) => (
                    <div key={column.key} className="flex justify-between items-start gap-3">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase shrink-0">
                        {typeof column.header === 'string' ? column.header : column.key}
                      </span>
                      <span className="text-sm text-gray-900 dark:text-white text-right">
                        {column.accessor(item)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && !isLoading && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing{' '}
            <span className="font-medium">
              {(currentPage - 1) * pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-medium">
              {Math.min(currentPage * pageSize, sortedData.length)}
            </span>{' '}
            of{' '}
            <span className="font-medium">{sortedData.length}</span> results
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300"
              aria-label="First page"
            >
              <ChevronDoubleLeftIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300"
              aria-label="Previous page"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNumber: number

                if (totalPages <= 5) {
                  pageNumber = i + 1
                } else if (currentPage < 4) {
                  pageNumber = i + 1
                } else if (currentPage > totalPages - 3) {
                  pageNumber = totalPages - 4 + i
                } else {
                  pageNumber = currentPage - 2 + i
                }

                return (
                  <button
                    key={i}
                    onClick={() => goToPage(pageNumber)}
                    className={clsx(
                      'min-w-[2.5rem] h-10 px-3 rounded-lg font-medium text-sm transition-colors',
                      pageNumber === currentPage
                        ? 'bg-primary-600 text-white'
                        : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    )}
                  >
                    {pageNumber}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300"
              aria-label="Next page"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300"
              aria-label="Last page"
            >
              <ChevronDoubleRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

