import { ForwardRefExoticComponent, SVGProps } from 'react';

export interface NavigationItem {
  name: string;
  href?: string;
  icon: ForwardRefExoticComponent<SVGProps<SVGSVGElement>>;
  isGroup?: boolean;
  children?: NavigationItem[];
  hasRefresh?: boolean;
  onRefresh?: (e: React.MouseEvent) => void;
  isLoading?: boolean;
}

export interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

export interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarWidth: number;
  navigationSections: NavigationSection[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredNavigationSections: NavigationSection[];
  isResizing: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
}

export interface SidebarItemProps {
  item: NavigationItem;
  level?: number;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export interface SidebarGroupProps {
  item: NavigationItem;
  level?: number;
  isExpanded: boolean;
  onToggle: () => void;
}

