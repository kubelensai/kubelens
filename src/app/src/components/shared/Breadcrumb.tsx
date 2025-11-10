import { ArrowLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useNavigate, useLocation } from 'react-router-dom'
import { lightTap } from '@/utils/haptics'

interface BreadcrumbItem {
  name: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  showBackButton?: boolean
  onBack?: () => void
}

/**
 * Breadcrumb Component with Integrated Back Button
 * 
 * Features:
 * - Back button integrated with breadcrumb on same line
 * - Smart breadcrumb truncation (shows only previous page when too long)
 * - Auto-hides back button on dashboard/root pages
 * - Responsive design (mobile and desktop)
 * - Capacitor-compatible with haptic feedback
 * - Dark mode support
 * 
 * @param items - Array of breadcrumb items to display
 * @param showBackButton - Whether to show the back button (default: auto-detect)
 * @param onBack - Optional custom back handler (overrides default behavior)
 */
export default function Breadcrumb({ items, showBackButton, onBack }: BreadcrumbProps) {
  const navigate = useNavigate()
  const location = useLocation()

  // Auto-detect if we should show back button
  // Hide on dashboard/root pages, show on detail pages
  const isDashboard = location.pathname === '/' || location.pathname === '/dashboard'
  const shouldShowBackButton = showBackButton !== undefined ? showBackButton : !isDashboard

  const handleBack = async () => {
    // Haptic feedback for mobile
    await lightTap()

    // Custom back handler if provided
    if (onBack) {
      onBack()
      return
    }

    // Default back navigation logic
    if (window.history.state && window.history.state.idx > 0) {
      // Go back to the previous page if history exists
      navigate(-1)
    } else {
      // Fallback to dashboard if no history
      navigate('/dashboard')
    }
  }

  // Smart breadcrumb: show only previous page when on DETAIL pages (>3 items = detail page)
  // For list pages (≤3 items), show all
  const isDetailPage = items.length > 3
  const displayItems = isDetailPage ? [items[items.length - 2]] : items

  // Format display name
  const formatName = (name: string) => {
    if (!name || typeof name !== 'string') return ''
    return name.toLowerCase().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  return (
    <nav className="flex items-center gap-2 mb-4 sm:mb-6" aria-label="Breadcrumb">
      {/* Back Button */}
      {shouldShowBackButton && (
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200 group flex-shrink-0"
          aria-label="Go back"
          title="Go back"
        >
          <ArrowLeftIcon className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        </button>
      )}

      {/* Breadcrumb Trail */}
      <ol className="inline-flex items-center space-x-1 md:space-x-2 flex-wrap min-w-0">
        {displayItems.map((item, index) => {
          const displayName = formatName(item.name)
          const isLast = index === displayItems.length - 1
          
          return (
            <li key={index} className="inline-flex items-center min-w-0">
              {index > 0 && (
                <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0 mr-1 md:mr-2" />
              )}
              <span 
                className={`text-sm font-medium md:ml-0 truncate ${
                  isLast 
                    ? 'text-gray-900 dark:text-white max-w-[200px] sm:max-w-[300px] md:max-w-none' 
                    : 'text-gray-500 dark:text-gray-400 max-w-[100px] sm:max-w-[150px]'
                }`}
                title={displayName}
              >
                {displayName}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

