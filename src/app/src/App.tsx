import { useCRDGroups } from "@/hooks/useCRDGroups";
import { useClusters } from "@/hooks/useClusters";
import { useClusterStore } from "@/stores/clusterStore";
import { useNamespaceStore } from "@/stores/namespaceStore";
import { useThemeStore } from "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";
import { useSessionStore } from "@/stores/sessionStore";
import { lightTap } from "@/utils/haptics";
import { Sidebar } from "@/components/Sidebar";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import clsx from "clsx";
import {
  AdjustmentsHorizontalIcon,
  Bars3Icon,
  BellAlertIcon,
  BoltIcon,
  BriefcaseIcon,
  ChevronUpIcon,
  CircleStackIcon,
  ClockIcon,
  CloudIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  CubeIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  HomeIcon,
  IdentificationIcon,
  KeyIcon,
  LinkIcon,
  MoonIcon,
  PuzzlePieceIcon,
  QueueListIcon,
  RectangleGroupIcon,
  RectangleStackIcon,
  RocketLaunchIcon,
  ServerIcon,
  ShieldCheckIcon,
  SunIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import ClusterSelector from "./components/shared/ClusterSelector";
import NamespaceSelector from "./components/shared/NamespaceSelector";
import NotificationCenter from "./components/shared/NotificationCenter";
import SearchBar from "./components/shared/SearchBar";
import UserProfileDropdown from "./components/shared/UserProfileDropdown";

function AppContent() {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set([]));
  const [loadCRDGroups, setLoadCRDGroups] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const location = useLocation();
  const { isDark, toggleTheme } = useThemeStore();
  const { selectedCluster } = useClusterStore();
  const { selectedNamespace } = useNamespaceStore();
  const { initializeAuth } = useAuthStore();
  const fetchSession = useSessionStore((state) => state.fetchSession);
  const session = useSessionStore((state) => state.session);
  const isSessionInitialized = useSessionStore((state) => state.isInitialized);
  const { isExpanded, isHovered, isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();

  // Initialize auth and session on mount
  useEffect(() => {
    const initialize = async () => {
      await initializeAuth();
      // Only fetch session if user is authenticated
      const token = localStorage.getItem('token');
      if (token) {
        await fetchSession();
      }
    };
    initialize();
  }, [initializeAuth, fetchSession]);

  // Sync session data with UI on every page load/navigation
  useEffect(() => {
    if (isSessionInitialized && session) {
      console.log('[App] Session loaded, syncing with UI:', session);
      // Session data is already synced through the stores (clusterStore and namespaceStore)
      // which are wrappers around sessionStore, so the UI will automatically update
      // when the session is loaded
    }
  }, [isSessionInitialized, session]);
  const {
    groups: crdGroups,
    isLoading: crdLoading,
    refetch: refetchCRDGroups,
  } = useCRDGroups(selectedCluster || undefined, loadCRDGroups);

  // Check if there are any enabled clusters
  const { data: enabledClusters } = useClusters(true);
  const hasEnabledClusters = enabledClusters && enabledClusters.length > 0;

  const toggleGroup = async (groupName: string) => {
    // Haptic feedback on expand/collapse
    await lightTap();

    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
        // Lazy load CRD groups when "Custom Resources" group is expanded
        if (groupName.toLowerCase() === "custom resources") {
          setLoadCRDGroups(true);
        }
      }
      return newSet;
    });
  };

  const handleRefreshCRDGroups = (e: React.MouseEvent) => {
    e.stopPropagation();
    refetchCRDGroups();
  };

  // Navigation rendering is now handled by Sidebar component

  // Auto-expand group based on current URL
  useEffect(() => {
    const path = location.pathname.toLowerCase();

    // Check for custom resources - extract group name
    const customResourceMatch = path.match(/\/customresources\/([^/]+)/);
    if (customResourceMatch) {
      const [, group] = customResourceMatch;
      setLoadCRDGroups(true);
      setExpandedGroups((prev) => {
        const newSet = new Set([...prev, "custom resources", group]);
        return newSet;
      });
      return;
    }

    // Check which group the current page belongs to
    if (
      path.includes("/pods") ||
      path.includes("/deployments") ||
      path.includes("/daemonsets") ||
      path.includes("/statefulsets") ||
      path.includes("/replicasets") ||
      path.includes("/jobs") ||
      path.includes("/cronjobs")
    ) {
      setExpandedGroups((prev) => new Set([...prev, "workloads"]));
    } else if (
      path.includes("/services") ||
      path.includes("/endpoints") ||
      path.includes("/ingresses") ||
      path.includes("/ingressclasses") ||
      path.includes("/networkpolicies")
    ) {
      setExpandedGroups((prev) => new Set([...prev, "network"]));
    } else if (
      path.includes("/storageclasses") ||
      path.includes("/persistentvolumes") ||
      path.includes("/persistentvolumeclaims")
    ) {
      setExpandedGroups((prev) => new Set([...prev, "storage"]));
        } else if (path.includes("/configmaps") || path.includes("/secrets")) {
          setExpandedGroups((prev) => new Set([...prev, "configuration"]));
        } else if (
          path.includes("/serviceaccounts") ||
          path.includes("/role") ||
          path.includes("/rolebindings")
        ) {
          setExpandedGroups((prev) => new Set([...prev, "security"]));
        } else if (path.includes("/customresourcedefinition")) {
          setExpandedGroups((prev) => new Set([...prev, "custom resources"]));
          setLoadCRDGroups(true);
        } else if (
          path.includes("/hpas") ||
          path.includes("/pdbs") ||
          path.includes("/priorityclasses") ||
          path.includes("/runtimeclasses") ||
          path.includes("/clusterrole") ||
          path.includes("/clusterrolebindings") ||
          path.includes("/leases") ||
          path.includes("/mutatingwebhookconfigurations") ||
          path.includes("/validatingwebhookconfigurations")
        ) {
          setExpandedGroups((prev) => new Set([...prev, "advanced"]));
        }
  }, [location.pathname]);

  // Dynamic navigation based on selected cluster and namespace
  // Organized into sections - simplified and tidied up
  const navigationSections = [
    {
      label: "MENU",
      items: [
        { name: "Dashboard", href: "/", icon: HomeIcon },
        {
          name: "Nodes",
          href: selectedCluster ? `/clusters/${selectedCluster}/nodes` : "/nodes",
          icon: CircleStackIcon,
        },
        {
          name: "Namespaces",
          href: selectedCluster ? `/clusters/${selectedCluster}/namespaces` : "/namespaces",
          icon: CubeIcon,
        },
    {
      name: "Workloads",
      icon: RectangleStackIcon,
      isGroup: true,
      children: [
        {
          name: "Pods",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/pods`
              : selectedCluster
              ? `/clusters/${selectedCluster}/pods`
              : "/pods",
          icon: CubeIcon,
        },
        {
          name: "Deployments",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/deployments`
              : selectedCluster
              ? `/clusters/${selectedCluster}/deployments`
              : "/deployments",
          icon: RocketLaunchIcon,
        },
        {
          name: "DaemonSets",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/daemonsets`
              : selectedCluster
              ? `/clusters/${selectedCluster}/daemonsets`
              : "/daemonsets",
          icon: CommandLineIcon,
        },
        {
          name: "StatefulSets",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/statefulsets`
              : selectedCluster
              ? `/clusters/${selectedCluster}/statefulsets`
              : "/statefulsets",
          icon: QueueListIcon,
        },
        {
          name: "ReplicaSets",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/replicasets`
              : selectedCluster
              ? `/clusters/${selectedCluster}/replicasets`
              : "/replicasets",
          icon: RectangleGroupIcon,
        },
        {
          name: "Jobs",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/jobs`
              : selectedCluster
              ? `/clusters/${selectedCluster}/jobs`
              : "/jobs",
          icon: BriefcaseIcon,
        },
        {
          name: "CronJobs",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/cronjobs`
              : selectedCluster
              ? `/clusters/${selectedCluster}/cronjobs`
              : "/cronjobs",
          icon: ClockIcon,
        },
      ],
    },
    {
      name: "Network",
      icon: CloudIcon,
      isGroup: true,
      children: [
        {
          name: "Services",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/services`
              : selectedCluster
              ? `/clusters/${selectedCluster}/services`
              : "/services",
          icon: GlobeAltIcon,
        },
        {
          name: "Endpoints",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/endpoints`
              : selectedCluster
              ? `/clusters/${selectedCluster}/endpoints`
              : "/endpoints",
          icon: LinkIcon,
        },
        {
          name: "Ingresses",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/ingresses`
              : selectedCluster
              ? `/clusters/${selectedCluster}/ingresses`
              : "/ingresses",
          icon: GlobeAltIcon,
        },
        {
          name: "Ingress Classes",
          href: selectedCluster ? `/clusters/${selectedCluster}/ingressclasses` : "/ingressclasses",
          icon: RectangleGroupIcon,
        },
        {
          name: "Network Policies",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/networkpolicies`
              : selectedCluster
              ? `/clusters/${selectedCluster}/networkpolicies`
              : "/networkpolicies",
          icon: ShieldCheckIcon,
        },
      ],
    },
    {
      name: "Configuration",
      icon: Cog6ToothIcon,
      isGroup: true,
      children: [
        {
          name: "ConfigMaps",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/configmaps`
              : selectedCluster
              ? `/clusters/${selectedCluster}/configmaps`
              : "/configmaps",
          icon: DocumentTextIcon,
        },
        {
          name: "Secrets",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/secrets`
              : selectedCluster
              ? `/clusters/${selectedCluster}/secrets`
              : "/secrets",
          icon: KeyIcon,
        },
      ],
    },
    {
      name: "Storage",
      icon: CircleStackIcon,
      isGroup: true,
      children: [
        {
          name: "Storage Classes",
          href: selectedCluster ? `/clusters/${selectedCluster}/storageclasses` : "/storageclasses",
          icon: CircleStackIcon,
        },
        {
          name: "Persistent Volumes",
          href: selectedCluster ? `/clusters/${selectedCluster}/persistentvolumes` : "/persistentvolumes",
          icon: CircleStackIcon,
        },
        {
          name: "Persistent Volume Claims",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/persistentvolumeclaims`
              : selectedCluster
              ? `/clusters/${selectedCluster}/persistentvolumeclaims`
              : "/persistentvolumeclaims",
          icon: CircleStackIcon,
        },
      ],
    },
    {
      name: "Security",
      icon: ShieldCheckIcon,
      isGroup: true,
      children: [
        {
          name: "Service Accounts",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/serviceaccounts`
              : selectedCluster
              ? `/clusters/${selectedCluster}/serviceaccounts`
              : "/serviceaccounts",
          icon: IdentificationIcon,
        },
        {
          name: "Roles",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/roles`
              : selectedCluster
              ? `/clusters/${selectedCluster}/roles`
              : "/roles",
          icon: KeyIcon,
        },
        {
          name: "Role Bindings",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/rolebindings`
              : selectedCluster
              ? `/clusters/${selectedCluster}/rolebindings`
              : "/rolebindings",
          icon: LinkIcon,
        },
        {
          name: "Cluster Roles",
          href: selectedCluster ? `/clusters/${selectedCluster}/clusterroles` : "/clusterroles",
          icon: ShieldCheckIcon,
        },
        {
          name: "Cluster Role Bindings",
          href: selectedCluster ? `/clusters/${selectedCluster}/clusterrolebindings` : "/clusterrolebindings",
          icon: LinkIcon,
        },
      ],
    },
    {
      name: "Events",
      href:
        selectedCluster && selectedNamespace
          ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/events`
          : selectedCluster
          ? `/clusters/${selectedCluster}/events`
          : "/events",
      icon: BellAlertIcon,
    },
    {
      name: "Custom Resources",
      icon: PuzzlePieceIcon,
      isGroup: true,
      hasRefresh: true,
      onRefresh: handleRefreshCRDGroups,
      isLoading: crdLoading,
      children: [
        {
          name: "Definitions",
          href: selectedCluster
            ? `/clusters/${selectedCluster}/customresourcedefinitions`
            : "/customresourcedefinitions",
          icon: DocumentTextIcon,
        },
        // Dynamic CRD groups (sorted A-Z)
        ...crdGroups.map((group) => ({
          name: group.name,
          icon: PuzzlePieceIcon,
          isGroup: true,
          children: group.resources.map((resource) => ({
            name: resource.kind,
            href:
              selectedCluster && selectedNamespace && resource.scope === "Namespaced"
                ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/customresources/${resource.group}/${resource.version}/${resource.plural}`
                : selectedCluster
                ? `/clusters/${selectedCluster}/customresources/${resource.group}/${resource.version}/${resource.plural}`
                : `/customresources/${resource.group}/${resource.version}/${resource.plural}`,
            icon: DocumentTextIcon,
          })),
        })),
      ],
    },
    {
      name: "Advanced",
      icon: Cog6ToothIcon,
      isGroup: true,
      children: [
        {
          name: "HPAs",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/hpas`
              : selectedCluster
              ? `/clusters/${selectedCluster}/hpas`
              : "/hpas",
          icon: AdjustmentsHorizontalIcon,
        },
        {
          name: "Pod Disruption Budgets",
          href:
            selectedCluster && selectedNamespace
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/pdbs`
              : selectedCluster
              ? `/clusters/${selectedCluster}/pdbs`
              : "/pdbs",
          icon: ShieldCheckIcon,
        },
        {
          name: "Priority Classes",
          href: selectedCluster ? `/clusters/${selectedCluster}/priorityclasses` : "/priorityclasses",
          icon: ChevronUpIcon,
        },
        {
          name: "Runtime Classes",
          href: selectedCluster ? `/clusters/${selectedCluster}/runtimeclasses` : "/runtimeclasses",
          icon: CommandLineIcon,
        },
        {
          name: "Leases",
          href: selectedNamespace
            ? selectedCluster
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/leases`
              : `/leases`
            : selectedCluster
            ? `/clusters/${selectedCluster}/leases`
            : "/leases",
          icon: ClockIcon,
        },
        {
          name: "Mutating Webhooks",
          href: selectedCluster
            ? `/clusters/${selectedCluster}/mutatingwebhookconfigurations`
            : "/mutatingwebhookconfigurations",
          icon: BoltIcon,
        },
        {
          name: "Validating Webhooks",
          href: selectedCluster
            ? `/clusters/${selectedCluster}/validatingwebhookconfigurations`
            : "/validatingwebhookconfigurations",
          icon: ShieldCheckIcon,
        },
      ],
    },
      ],
    },
    {
      label: "SETTINGS",
      items: [
        { name: "Clusters", href: "/clusters", icon: ServerIcon },
        { name: "Users", href: "/users", icon: IdentificationIcon },
        { name: "Groups", href: "/groups", icon: UserGroupIcon },
        { name: "Integrations", href: "/integrations", icon: PuzzlePieceIcon },
      ],
    },
  ];

  // Filter navigation by enabled clusters and search query
  const filterNavigation = (items: any[], query: string): any[] => {
    // First, filter by enabled clusters
    let filteredItems = items;

    if (!hasEnabledClusters) {
      // When no enabled clusters, only show Dashboard, Clusters, Integrations, Users, and Groups
      filteredItems = items.filter((item) => item.name === "Dashboard" || item.name === "Clusters" || item.name === "Integrations" || item.name === "Users" || item.name === "Groups");
    }

    // Then filter by search query
    if (!query) return filteredItems;

    const lowerQuery = query.toLowerCase();
    return filteredItems.reduce((acc: any[], item: any) => {
      if (item.isGroup) {
        const filteredChildren = filterNavigation(item.children || [], query);
        if (filteredChildren.length > 0) {
          acc.push({ ...item, children: filteredChildren });
        }
      } else {
        if (item.name.toLowerCase().includes(lowerQuery)) {
          acc.push(item);
        }
      }
      return acc;
    }, []);
  };

  // Filter sections for rendering
  const filteredNavigationSections = navigationSections.map(section => ({
    ...section,
    items: filterNavigation(section.items, searchQuery)
  })).filter(section => section.items.length > 0);

  // Scroll to active item in sidebar
  useEffect(() => {
    // Use a slight delay to ensure DOM is updated after expansion
    const timer = setTimeout(() => {
      const activeLink = document.querySelector(`nav a[href="${location.pathname}"]`);
      if (activeLink) {
        activeLink.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [location.pathname, expandedGroups]);

  // Initialize and sync theme
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  // Calculate sidebar width for main content padding
  const sidebarWidth = isExpanded || isHovered ? 290 : 90;

  return (
    <div className="min-h-screen xl:flex bg-[#f9fafb] dark:bg-[#0f1828] transition-colors">
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-900/80 lg:hidden" 
          onClick={toggleMobileSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <Sidebar
        navigationSections={filteredNavigationSections}
        expandedGroups={expandedGroups}
        toggleGroup={toggleGroup}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Main content */}
      <div
        className={clsx(
          'flex-1 transition-all duration-300 ease-in-out',
          `lg:ml-[${sidebarWidth}px]`,
          'ml-0'
        )}
        style={{ marginLeft: window.innerWidth >= 1024 ? `${sidebarWidth}px` : '0' }}
      >
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex h-14 sm:h-16 shrink-0 items-center gap-x-2 sm:gap-x-4 border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-[#0f1828]/95 backdrop-blur-sm px-3 sm:px-4 shadow-sm">
          <button
            type="button"
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => {
              if (window.innerWidth < 1024) {
                toggleMobileSidebar();
              } else {
                toggleSidebar();
              }
            }}
            aria-label="Toggle sidebar">
            <Bars3Icon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
          </button>

          <div className="flex flex-1 gap-x-2 sm:gap-x-4 items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Link
                to="/"
                className="flex lg:hidden items-center gap-2 transition-transform hover:scale-105 group">
                <div className="p-1 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 shadow-sm group-hover:shadow-md transition-all">
                  <CubeIcon className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent cursor-pointer truncate">
                  Kubelens
                </h1>
              </Link>
              {/* Search Bar - replaces subtitle text */}
              <div className="hidden lg:flex flex-1 max-w-xl">
                <SearchBar />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Cluster Selector */}
              <ClusterSelector />

              {/* Namespace Selector */}
              <NamespaceSelector />

              {/* Notification Center */}
              <NotificationCenter />

              {/* Dark Mode Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle theme">
                {isDark ? (
                  <SunIcon className="h-5 w-5 text-yellow-500" />
                ) : (
                  <MoonIcon className="h-5 w-5 text-gray-700" />
                )}
              </button>

              {/* User Profile Dropdown */}
              <UserProfileDropdown />
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-4 sm:py-6 lg:py-8 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SidebarProvider>
      <AppContent />
    </SidebarProvider>
  );
}
