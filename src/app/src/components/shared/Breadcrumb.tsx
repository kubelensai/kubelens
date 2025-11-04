import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline'

interface BreadcrumbItem {
  name: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex mb-4 sm:mb-6" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-2 flex-wrap">
        <li className="inline-flex items-center">
          <div className="inline-flex items-center text-sm font-medium text-gray-700 dark:text-gray-400">
            <HomeIcon className="w-4 h-4 mr-2" />
            <span>Home</span>
          </div>
        </li>
        {items.map((item, index) => {
          // Convert to proper case: lowercase first, then capitalize
          const displayName = item.name && typeof item.name === 'string'
            ? item.name.toLowerCase().split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' ')
            : ''
          
          return (
            <li key={index}>
              <div className="flex items-center">
                <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                <span className="ml-1 text-sm font-medium text-gray-500 dark:text-gray-400 md:ml-2 truncate max-w-[150px] sm:max-w-none">
                  {displayName}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

