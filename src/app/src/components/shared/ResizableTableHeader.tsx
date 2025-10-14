import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface ResizableTableHeaderProps {
  label: string
  columnKey: string
  sortKey?: string
  currentSortKey?: string | null
  currentSortDirection?: 'asc' | 'desc' | null
  onSort?: (key: string) => void
  onResizeStart: (columnKey: string, e: React.MouseEvent) => void
  width?: number
  className?: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
}

export default function ResizableTableHeader({
  label,
  columnKey,
  sortKey,
  currentSortKey,
  currentSortDirection,
  onSort,
  onResizeStart,
  width,
  className = '',
  align = 'left',
  sortable = true,
}: ResizableTableHeaderProps) {
  const isActive = sortKey && currentSortKey === sortKey
  const textAlign = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
  const isSortable = sortable && sortKey && onSort

  const handleHeaderClick = () => {
    if (isSortable) {
      onSort!(sortKey!)
    }
  }

  return (
    <th
      className={clsx(
        'relative px-2 sm:px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider',
        isSortable && 'cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700/50',
        'transition-colors',
        textAlign,
        className
      )}
      style={{ width: width ? `${width}px` : undefined, minWidth: '50px' }}
      onClick={handleHeaderClick}
    >
      <div className={clsx('flex items-center gap-1', {
        'justify-start': align === 'left',
        'justify-center': align === 'center',
        'justify-end': align === 'right',
      })}>
        <span>{label}</span>
        {isSortable && (
          <div className="flex flex-col">
            <ChevronUpIcon
              className={clsx(
                'h-3 w-3 -mb-1',
                isActive && currentSortDirection === 'desc'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-300 dark:text-gray-600'
              )}
            />
            <ChevronDownIcon
              className={clsx(
                'h-3 w-3 -mt-1',
                isActive && currentSortDirection === 'asc'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-300 dark:text-gray-600'
              )}
            />
          </div>
        )}
      </div>
      
      {/* Resize Handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500 dark:hover:bg-primary-400 transition-colors group"
        onMouseDown={(e) => {
          e.stopPropagation()
          onResizeStart(columnKey, e)
        }}
      >
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-gray-300 dark:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </th>
  )
}

