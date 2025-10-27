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
    
    // For resource paths, check if current path contains the resource type
    // Example: /clusters/my-cluster/nodes/node-1 should match /nodes
    // But NOT match /clusters or /dashboard
    const resourceName = itemPath.split('/').filter(Boolean).pop(); // Get last segment
    if (resourceName) {
      // Split current path and check if resource name is in the path
      const pathSegments = currentPath.split('/').filter(Boolean);
      return pathSegments.includes(resourceName);
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
