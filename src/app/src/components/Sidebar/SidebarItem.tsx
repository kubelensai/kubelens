import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { lightTap } from '@/utils/haptics';
import type { NavigationItem } from '@/types/navigation';

interface SidebarItemProps {
  item: NavigationItem;
}

export const SidebarItem = ({ item }: SidebarItemProps) => {
  const location = useLocation();
  const isActive = location.pathname === item.href;

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
