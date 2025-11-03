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
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const location = useLocation();
  const { isDark, toggleTheme } = useThemeStore();
  const { selectedCluster } = useClusterStore();
  const { selectedNamespace } = useNamespaceStore();
  const { initializeAuth } = useAuthStore();
  const fetchSession = useSessionStore((state) => state.fetchSession);
  const session = useSessionStore((state) => state.session);
  const isSessionInitialized = useSessionStore((state) => state.isInitialized);
  const { isExpanded, isHovered, isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  
  const toggleApplicationMenu = () => {
    setApplicationMenuOpen(!isApplicationMenuOpen);
  };

  // Initialize auth state and fetch session on mount
  useEffect(() => {
    const initialize = async () => {
      // Initialize auth state from localStorage
      await initializeAuth();
      // Fetch session data
      await fetchSession();
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
        { name: "Dashboard", href: "/dashboard", icon: HomeIcon },
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
        { name: "Logging", href: "/logging", icon: DocumentTextIcon },
        { name: "Audit Settings", href: "/audit-settings", icon: AdjustmentsHorizontalIcon },
      ],
    },
  ];

  // Filter navigation by enabled clusters and search query
  const filterNavigation = (items: any[], query: string): any[] => {
    // First, filter by enabled clusters
    let filteredItems = items;

    if (!hasEnabledClusters) {
      // When no enabled clusters, only show Dashboard, Clusters, Integrations, Users, Groups, Logging, and Audit Settings
      filteredItems = items.filter((item) => item.name === "Dashboard" || item.name === "Clusters" || item.name === "Integrations" || item.name === "Users" || item.name === "Groups" || item.name === "Logging" || item.name === "Audit Settings");
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
        {/* Top bar - TailAdmin Style */}
        <header className="sticky top-0 z-30 w-full bg-white border-gray-200 dark:border-gray-800 dark:bg-gray-900 lg:border-b">
          <div className="flex items-center w-full px-4 py-3 border-b border-gray-200 dark:border-gray-800 lg:border-b-0 lg:px-6 lg:py-4">
            {/* Left: Hamburger button */}
            <button
              type="button"
              className="flex items-center justify-center w-10 h-10 text-gray-700 rounded-lg dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 lg:border lg:border-gray-200 dark:lg:border-gray-800"
              onClick={() => {
                if (window.innerWidth < 1024) {
                  toggleMobileSidebar();
                } else {
                  toggleSidebar();
                }
              }}
              aria-label="Toggle sidebar">
              {isMobileOpen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z" fill="currentColor" />
                </svg>
              ) : (
                <svg width="16" height="12" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M0.583252 1C0.583252 0.585788 0.919038 0.25 1.33325 0.25H14.6666C15.0808 0.25 15.4166 0.585786 15.4166 1C15.4166 1.41421 15.0808 1.75 14.6666 1.75L1.33325 1.75C0.919038 1.75 0.583252 1.41422 0.583252 1ZM0.583252 11C0.583252 10.5858 0.919038 10.25 1.33325 10.25L14.6666 10.25C15.0808 10.25 15.4166 10.5858 15.4166 11C15.4166 11.4142 15.0808 11.75 14.6666 11.75L1.33325 11.75C0.919038 11.75 0.583252 11.4142 0.583252 11ZM1.33325 5.25C0.919038 5.25 0.583252 5.58579 0.583252 6C0.583252 6.41421 0.919038 6.75 1.33325 6.75L7.99992 6.75C8.41413 6.75 8.74992 6.41421 8.74992 6C8.74992 5.58579 8.41413 5.25 7.99992 5.25L1.33325 5.25Z" fill="currentColor" />
                </svg>
              )}
            </button>

            {/* Center: Logo - Mobile only, absolutely centered */}
            <div className="flex-1 flex items-center justify-center lg:hidden">
              <Link to="/" className="flex items-center gap-2 transition-transform hover:scale-105 group">
                <div className="p-1 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 shadow-sm group-hover:shadow-md transition-all">
                  <CubeIcon className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent cursor-pointer">
                  Kubelens
                </h1>
              </Link>
            </div>

            {/* Right: Three dots button - Mobile only */}
            <button
              onClick={toggleApplicationMenu}
              className="flex items-center justify-center w-10 h-10 text-gray-700 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
              aria-label="Toggle application menu">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M5.99902 10.4951C6.82745 10.4951 7.49902 11.1667 7.49902 11.9951V12.0051C7.49902 12.8335 6.82745 13.5051 5.99902 13.5051C5.1706 13.5051 4.49902 12.8335 4.49902 12.0051V11.9951C4.49902 11.1667 5.1706 10.4951 5.99902 10.4951ZM17.999 10.4951C18.8275 10.4951 19.499 11.1667 19.499 11.9951V12.0051C19.499 12.8335 18.8275 13.5051 17.999 13.5051C17.1706 13.5051 16.499 12.8335 16.499 12.0051V11.9951C16.499 11.1667 17.1706 10.4951 17.999 10.4951ZM13.499 11.9951C13.499 11.1667 12.8275 10.4951 11.999 10.4951C11.1706 10.4951 10.499 11.1667 10.499 11.9951V12.0051C10.499 12.8335 11.1706 13.5051 11.999 13.5051C12.8275 13.5051 13.499 12.8335 13.499 12.0051V11.9951Z" fill="currentColor" />
              </svg>
            </button>

            {/* Desktop: Search Bar + Actions */}
            <div className="hidden lg:flex items-center justify-between flex-1 ml-6">
              {/* Search Bar */}
              <div className="flex-1 max-w-xl">
                <SearchBar />
              </div>

              {/* Actions - Right aligned */}
              <div className="flex items-center gap-2 ml-6">
                <ClusterSelector />
                <NamespaceSelector />
                <button
                  onClick={toggleTheme}
                  className="flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full h-11 w-11 hover:text-gray-700 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                  aria-label="Toggle theme">
                  {isDark ? (
                    <SunIcon className="h-5 w-5" />
                  ) : (
                    <MoonIcon className="h-5 w-5" />
                  )}
                </button>
                <NotificationCenter />
                <UserProfileDropdown />
              </div>
            </div>
          </div>

          {/* Second Row - Mobile actions (shown when three dots clicked) */}
          {isApplicationMenuOpen && (
            <div className="flex items-center justify-between w-full gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800 lg:hidden bg-white dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <ClusterSelector />
                <NamespaceSelector />
                <button
                  onClick={toggleTheme}
                  className="flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full h-11 w-11 hover:text-gray-700 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white flex-shrink-0"
                  aria-label="Toggle theme">
                  {isDark ? (
                    <SunIcon className="h-5 w-5" />
                  ) : (
                    <MoonIcon className="h-5 w-5" />
                  )}
                </button>
                <NotificationCenter />
              </div>
              <UserProfileDropdown />
            </div>
          )}
        </header>

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
