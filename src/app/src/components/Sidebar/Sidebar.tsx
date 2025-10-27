import { Link } from 'react-router-dom';
import { XMarkIcon, MagnifyingGlassIcon, CubeIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useSidebar } from '@/context/SidebarContext';
import { SidebarSection } from './SidebarSection';
import { SidebarItem } from './SidebarItem';
import { SidebarGroup } from './SidebarGroup';
import type { NavigationSection, NavigationItem } from '@/types/navigation';

interface SidebarProps {
  navigationSections: NavigationSection[];
  expandedGroups: Set<string>;
  toggleGroup: (groupName: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const Sidebar = ({
  navigationSections,
  expandedGroups,
  toggleGroup,
  searchQuery,
  setSearchQuery,
}: SidebarProps) => {
  const { isExpanded, isMobileOpen, isHovered, toggleMobileSidebar, setIsHovered } = useSidebar();

  const renderNavItem = (item: NavigationItem) => {
    if (item.isGroup) {
      const isGroupExpanded = expandedGroups.has(item.name.toLowerCase());
      return (
        <SidebarGroup
          key={item.name}
          item={item}
          isExpanded={isGroupExpanded}
          onToggle={() => toggleGroup(item.name.toLowerCase())}
          expandedGroups={expandedGroups}
          toggleGroup={toggleGroup}
        />
      );
    }
    return <SidebarItem key={item.name} item={item} />;
  };

  return (
    <aside
      className={clsx(
        'fixed flex flex-col px-5 left-0 bg-white dark:bg-[#0f1828] text-gray-900 transition-all duration-300 ease-in-out z-50 border-r border-gray-200 dark:border-gray-700',
        // Width
        {
          'w-[290px]': isExpanded || isMobileOpen || isHovered,
          'w-[90px]': !isExpanded && !isHovered && !isMobileOpen,
        },
        // Mobile translation (< 1024px)
        {
          'translate-x-0': isMobileOpen,
          '-translate-x-full': !isMobileOpen,
        },
        // Desktop always visible (>= 1024px)
        'lg:translate-x-0',
        // Mobile: position below header with calculated height
        'top-16 h-[calc(100vh-4rem)] lg:top-0 lg:h-screen'
      )}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <div
        className={clsx('py-8 flex justify-start', {
          'lg:justify-center': !isExpanded && !isHovered && !isMobileOpen,
        })}
      >
        <Link to="/" className="flex items-center gap-3 transition-transform hover:scale-105 group">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg group-hover:shadow-xl transition-all">
                <CubeIcon className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent cursor-pointer">
                Kubelens
              </h1>
            </>
          ) : (
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg group-hover:shadow-xl transition-all">
              <CubeIcon className="h-8 w-8 text-white" />
            </div>
          )}
        </Link>

        {/* Mobile close button */}
        {isMobileOpen && (
          <button
            onClick={toggleMobileSidebar}
            className="ml-auto p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close menu"
          >
            <XMarkIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
          </button>
        )}
      </div>

      {/* Search bar - only show when expanded */}
      {(isExpanded || isHovered || isMobileOpen) && (
        <div className="px-0 pb-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={clsx(
                'w-full pl-10 pr-4 py-2 text-sm',
                'bg-gray-50 dark:bg-gray-800/50',
                'border border-gray-200 dark:border-gray-700',
                'rounded-lg',
                'text-gray-900 dark:text-gray-100',
                'placeholder:text-gray-400 dark:placeholder:text-gray-500',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                'transition-colors'
              )}
              aria-label="Search navigation menu"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Clear search query"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto no-scrollbar" aria-label="Main navigation">
        <div className="flex flex-col gap-4 py-4 pb-16">
          {navigationSections.map((section) => (
            <div
              key={section.label}
              role="region"
              aria-labelledby={`sidebar-section-${section.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <SidebarSection
                label={section.label}
                isCollapsed={!isExpanded && !isHovered && !isMobileOpen}
              />
              <ul className="flex flex-col gap-1" role="menu">
                {section.items.map((item) => renderNavItem(item))}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </aside>
  );
};
