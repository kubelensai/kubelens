import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface SortableTableHeaderProps {
  label: string
  sortKey: string
  currentSortKey: string | null
  currentSortDirection: 'asc' | 'desc' | null
  onSort: (key: string) => void
  className?: string
  align?: 'left' | 'center' | 'right'
}

export default function SortableTableHeader({
  label,
  sortKey,
  currentSortKey,
  currentSortDirection,
  onSort,
  className = '',
  align = 'left',
}: SortableTableHeaderProps) {
  const isActive = currentSortKey === sortKey
  const textAlign = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'

  return (
    <th
      className={clsx(
        'px-2 sm:px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors',
        textAlign,
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <div className={clsx('flex items-center gap-1', {
        'justify-start': align === 'left',
        'justify-center': align === 'center',
        'justify-end': align === 'right',
      })}>
        <span>{label}</span>
        <div className="flex flex-col">
          <ChevronUpIcon
            className={clsx(
              'h-3 w-3 -mb-1',
              isActive && currentSortDirection === 'asc'
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-gray-300 dark:text-gray-600'
            )}
          />
          <ChevronDownIcon
            className={clsx(
              'h-3 w-3 -mt-1',
              isActive && currentSortDirection === 'desc'
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-gray-300 dark:text-gray-600'
            )}
          />
        </div>
      </div>
    </th>
  )
}

