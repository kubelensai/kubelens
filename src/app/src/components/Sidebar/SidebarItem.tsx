import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { lightTap } from '@/utils/haptics';
import type { NavigationItem } from '@/types/navigation';

interface SidebarItemProps {
  item: NavigationItem;
}

export const SidebarItem = ({ item }: SidebarItemProps) => {
  const location = useLocation();
  
  // Precise matching logic for sidebar items
  const isActive = (() => {
    if (!item.href) return false;
    
    const currentPath = location.pathname;
    const itemPath = item.href;
    
    // Exact match
    if (currentPath === itemPath) return true;
    
    // For root paths (/, /dashboard, /clusters, etc.), only exact match
    if (itemPath === '/' || itemPath === '/dashboard' || itemPath === '/clusters' || 
        itemPath === '/integrations' || itemPath === '/users' || itemPath === '/groups') {
      return false;
    }
    
    // For resource paths, extract the resource type from the item href
    // Example: /clusters/my-cluster/nodes -> "nodes"
    // Example: /clusters/my-cluster/namespaces/my-ns/services -> "services"
    const itemSegments = itemPath.split('/').filter(Boolean);
    const currentSegments = currentPath.split('/').filter(Boolean);
    
    // Find the resource type (last segment of item path)
    const resourceType = itemSegments[itemSegments.length - 1];
    
    // Check if current path contains the resource type at the correct position
    const resourceIndex = currentSegments.indexOf(resourceType);
    
    if (resourceIndex !== -1) {
      // Only match if:
      // 1. It's the last segment (list page): /clusters/staging/pods
      // 2. It's followed by exactly one more segment (detail page): /clusters/staging/pods/my-pod
      // This prevents matching when the resource is in the middle of the path
      const isLastSegment = resourceIndex === currentSegments.length - 1;
      const isDetailPage = resourceIndex === currentSegments.length - 2;
      
      return isLastSegment || isDetailPage;
    }
    
    return false;
  })();

  if (!item.href) {
    return null;
  }

  return (
    <li>
      <Link
        to={item.href}
        onClick={() => lightTap()}
        className={clsx(
          'menu-item group',
          isActive ? 'menu-item-active' : 'menu-item-inactive'
        )}
        aria-current={isActive ? 'page' : undefined}
      >
        {/* Active indicator */}
        {isActive && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary-600 dark:bg-primary-400 rounded-r-full"
            aria-hidden="true"
          />
        )}

        <span
          className={clsx(
            'menu-item-icon-size',
            isActive ? 'menu-item-icon-active' : 'menu-item-icon-inactive'
          )}
        >
          <item.icon aria-hidden="true" />
        </span>

        <span className="menu-item-text">{item.name}</span>
      </Link>
    </li>
  );
};
