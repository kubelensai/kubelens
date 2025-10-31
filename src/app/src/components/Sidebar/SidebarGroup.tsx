import { ChevronDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useSidebar } from '@/context/SidebarContext';
import { SidebarItem } from './SidebarItem';
import type { NavigationItem } from '@/types/navigation';

interface SidebarGroupProps {
  item: NavigationItem;
  isExpanded: boolean;
  onToggle: () => void;
  level?: number;
  expandedGroups?: Set<string>;
  toggleGroup?: (groupName: string) => void;
}

export const SidebarGroup = ({ 
  item, 
  isExpanded, 
  onToggle, 
  level = 0,
  expandedGroups = new Set(),
  toggleGroup 
}: SidebarGroupProps) => {
  const { isExpanded: sidebarExpanded, isMobileOpen, isHovered } = useSidebar();
  const isCollapsed = !sidebarExpanded && !isHovered && !isMobileOpen;

  return (
    <div>
      <button
        onClick={onToggle}
        className={clsx(
          'menu-item group cursor-pointer',
          isExpanded ? 'menu-item-active' : 'menu-item-inactive',
          {
            'justify-center': isCollapsed,
          }
        )}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${item.name} menu`}
      >
        <span
          className={clsx(
            'menu-item-icon-size',
            isExpanded ? 'menu-item-icon-active' : 'menu-item-icon-inactive'
          )}
        >
          <item.icon aria-hidden="true" />
        </span>

        {!isCollapsed && <span className="menu-item-text flex-1 text-left">{item.name}</span>}

        {!isCollapsed && <div className="flex items-center gap-1 flex-shrink-0">
          {/* Refresh button for CRD groups */}
          {item.hasRefresh && isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                item.onRefresh?.(e);
              }}
              className={clsx(
                'p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-primary-500'
              )}
              title="Refresh CRD groups"
              disabled={item.isLoading}
              aria-label="Refresh custom resource definitions"
            >
              <ArrowPathIcon
                className={clsx('h-3.5 w-3.5', item.isLoading && 'animate-spin')}
                aria-hidden="true"
              />
            </button>
          )}

          {/* Chevron icon */}
          <ChevronDownIcon
            className={clsx(
              'h-5 w-5 transition-transform duration-200',
              isExpanded ? 'rotate-180 text-primary-500 dark:text-primary-400' : ''
            )}
            aria-hidden="true"
          />
        </div>}
      </button>

      {/* Dropdown content with smooth animation - only show when sidebar is expanded */}
      {!isCollapsed && (
        <div
          className={clsx(
            'overflow-hidden transition-all duration-300 ease-in-out',
            isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
          )}
          aria-hidden={!isExpanded}
        >
          <ul className="mt-2 space-y-1 ml-9" role="menu">
            {item.children?.map((child) => {
              if (child.isGroup) {
                // Support nested groups (e.g., CRD groups inside Custom Resources)
                const childExpanded = expandedGroups.has(child.name.toLowerCase());
                return (
                  <SidebarGroup
                    key={child.name}
                    item={child}
                    isExpanded={childExpanded}
                    onToggle={() => toggleGroup?.(child.name.toLowerCase())}
                    level={level + 1}
                    expandedGroups={expandedGroups}
                    toggleGroup={toggleGroup}
                  />
                );
              }
              return <SidebarItem key={child.name} item={child} />;
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
