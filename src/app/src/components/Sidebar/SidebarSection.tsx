import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';

interface SidebarSectionProps {
  label: string;
  isCollapsed?: boolean;
}

export const SidebarSection = ({ label, isCollapsed = false }: SidebarSectionProps) => {
  return (
    <div>
      <h2
        className="mb-4 text-xs uppercase leading-[20px] text-gray-400 dark:text-gray-500 flex items-center justify-start"
        id={`sidebar-section-${label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        {isCollapsed ? (
          <EllipsisHorizontalIcon className="h-6 w-6 mx-auto" aria-label={label} />
        ) : (
          label
        )}
      </h2>
    </div>
  );
};
