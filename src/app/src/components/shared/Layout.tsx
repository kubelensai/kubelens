import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  ServerIcon,
  SunIcon,
  MoonIcon,
  CubeIcon,
  RocketLaunchIcon,
  GlobeAltIcon,
  CircleStackIcon,
  BellAlertIcon,
  CommandLineIcon,
  QueueListIcon,
  RectangleGroupIcon,
  BriefcaseIcon,
  ClockIcon,
  BoltIcon,
  ShieldCheckIcon,
  LinkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  RectangleStackIcon,
  CloudIcon,
  Cog6ToothIcon,
  KeyIcon,
  PuzzlePieceIcon,
  DocumentTextIcon,
  AdjustmentsHorizontalIcon,
  IdentificationIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useThemeStore } from '@/stores/themeStore'
import { useClusterStore } from '@/stores/clusterStore'
import { useNamespaceStore } from '@/stores/namespaceStore'
import { useCRDGroups } from '@/hooks/useCRDGroups'
import { useClusters } from '@/hooks/useClusters'
import SearchBar from './SearchBar'
import ClusterSelector from './ClusterSelector'
import NamespaceSelector from './NamespaceSelector'
import NotificationCenter from './NotificationCenter'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set([]))
  const [loadCRDGroups, setLoadCRDGroups] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar-width')
    return saved ? parseInt(saved) : 256 // default 256px (16rem)
  })
  const [isResizing, setIsResizing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const location = useLocation()
  const { isDark, toggleTheme } = useThemeStore()
  const { selectedCluster } = useClusterStore()
  const { selectedNamespace } = useNamespaceStore()
  const { groups: crdGroups, isLoading: crdLoading, refetch: refetchCRDGroups } = useCRDGroups(selectedCluster || undefined, loadCRDGroups)
  
  // Check if there are any enabled clusters
  const { data: enabledClusters } = useClusters(true)
  const hasEnabledClusters = enabledClusters && enabledClusters.length > 0

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupName)) {
        newSet.delete(groupName)
      } else {
        newSet.add(groupName)
        // Lazy load CRD groups when "Custom Resources" group is expanded
        if (groupName.toLowerCase() === 'custom resources') {
          setLoadCRDGroups(true)
        }
      }
      return newSet
    })
  }

  const handleRefreshCRDGroups = (e: React.MouseEvent) => {
    e.stopPropagation()
    refetchCRDGroups()
  }

  // Resize sidebar
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true)
    e.preventDefault()
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      const newWidth = Math.min(Math.max(e.clientX, 200), 500) // min 200px, max 500px
      setSidebarWidth(newWidth)
      localStorage.setItem('sidebar-width', newWidth.toString())
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  // Render navigation item (supports nested groups)
  const renderNavItem = (item: any, level: number = 0): JSX.Element => {
    if (item.isGroup) {
      const isExpanded = expandedGroups.has(item.name.toLowerCase())
      return (
        <div key={item.name}>
          <div 
            onClick={() => toggleGroup(item.name.toLowerCase())}
            className="w-full flex items-center py-2.5 rounded-lg text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
          >
            <div className="flex items-center gap-3 flex-1">
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">{item.name}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {item.hasRefresh && isExpanded && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    item.onRefresh(e)
                  }}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title="Refresh CRD groups"
                  disabled={item.isLoading}
                >
                  <ArrowPathIcon className={clsx("h-3.5 w-3.5", item.isLoading && "animate-spin")} />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleGroup(item.name.toLowerCase())
                }}
                className="p-0.5"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          {isExpanded && (
            <div className="mt-1 space-y-1 ml-4">
              {item.children?.map((child: any) => renderNavItem(child, level + 1))}
            </div>
          )}
        </div>
      )
    }

    return (
      <Link
        key={item.name}
        to={item.href}
        className={clsx(
          'block w-full',
          location.pathname === item.href && 'bg-primary-50 dark:bg-primary-900/50 shadow-sm'
        )}
      >
        <div className="flex items-center gap-3 py-2 rounded-lg text-sm font-medium transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <item.icon 
            className={clsx(
              'h-4 w-4 flex-shrink-0',
              location.pathname === item.href
                ? 'text-primary-700 dark:text-primary-300'
                : level === 0
                  ? 'text-gray-700 dark:text-gray-300'
                  : 'text-gray-600 dark:text-gray-400'
            )} 
          />
          <span 
            className={clsx(
              'truncate',
              location.pathname === item.href
                ? 'text-primary-700 dark:text-primary-300'
                : level === 0
                  ? 'text-gray-700 dark:text-gray-300'
                  : 'text-gray-600 dark:text-gray-400'
            )}
          >
            {item.name}
          </span>
        </div>
      </Link>
    )
  }

  // Auto-expand group based on current URL
  useEffect(() => {
    const path = location.pathname.toLowerCase()
    
    // Check for custom resources - extract group name
    const customResourceMatch = path.match(/\/customresources\/([^/]+)/)
    if (customResourceMatch) {
      const [, group] = customResourceMatch
      setLoadCRDGroups(true)
      setExpandedGroups(prev => {
        const newSet = new Set([...prev, 'custom resources', group])
        return newSet
      })
      return
    }
    
    // Check which group the current page belongs to
    if (path.includes('/pods') || path.includes('/deployments') || path.includes('/daemonsets') || 
        path.includes('/statefulsets') || path.includes('/replicasets') || 
        path.includes('/jobs') || path.includes('/cronjobs')) {
      setExpandedGroups(prev => new Set([...prev, 'workloads']))
    } else if (path.includes('/services') || path.includes('/endpoints') || path.includes('/ingresses') || path.includes('/ingressclasses') || path.includes('/networkpolicies')) {
      setExpandedGroups(prev => new Set([...prev, 'network']))
    } else if (path.includes('/storageclasses') || path.includes('/persistentvolumes') || path.includes('/persistentvolumeclaims')) {
      setExpandedGroups(prev => new Set([...prev, 'storage']))
    } else if (path.includes('/configmaps') || path.includes('/secrets') || path.includes('/hpas') || path.includes('/pdbs') || path.includes('/priorityclasses') || path.includes('/runtimeclasses') || path.includes('/leases') || path.includes('/mutatingwebhookconfigurations') || path.includes('/validatingwebhookconfigurations')) {
      setExpandedGroups(prev => new Set([...prev, 'config']))
        } else if (path.includes('/serviceaccounts') || path.includes('/role') ||
                   path.includes('/clusterrole') || path.includes('/rolebindings') || 
                   path.includes('/clusterrolebindings')) {
      setExpandedGroups(prev => new Set([...prev, 'access control']))
    } else if (path.includes('/customresourcedefinition')) {
      setExpandedGroups(prev => new Set([...prev, 'custom resources']))
      setLoadCRDGroups(true)
    }
  }, [location.pathname])

  // Dynamic navigation based on selected cluster and namespace
  const navigation = [
    { name: 'Dashboard', href: '/', icon: HomeIcon },
    { name: 'Cluster Management', href: '/clusters', icon: ServerIcon },
    ...(selectedCluster ? [{
      name: 'Overview',
      href: `/clusters/${selectedCluster}/overview`,
      icon: ChartBarIcon
    }] : []),
    { 
      name: 'Nodes', 
      // Nodes are cluster-level resources, no namespace filtering
      href: selectedCluster ? `/clusters/${selectedCluster}/nodes` : '/nodes', 
      icon: CircleStackIcon 
    },
    { 
      name: 'Namespaces', 
      // Namespaces are cluster-level resources
      href: selectedCluster ? `/clusters/${selectedCluster}/namespaces` : '/namespaces', 
      icon: CubeIcon 
    },
    {
      name: 'Workloads',
      icon: RectangleStackIcon,
      isGroup: true,
      children: [
        { 
          name: 'Pods', 
          href: selectedCluster && selectedNamespace
            ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/pods`
            : selectedCluster
              ? `/clusters/${selectedCluster}/pods`
              : '/pods',
          icon: CubeIcon 
        },
        { 
          name: 'Deployments', 
          href: selectedCluster && selectedNamespace
            ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/deployments`
            : selectedCluster
              ? `/clusters/${selectedCluster}/deployments`
              : '/deployments',
          icon: RocketLaunchIcon 
        },
        { 
          name: 'DaemonSets', 
          href: selectedCluster && selectedNamespace
            ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/daemonsets`
            : selectedCluster
              ? `/clusters/${selectedCluster}/daemonsets`
              : '/daemonsets',
          icon: CommandLineIcon 
        },
        { 
          name: 'StatefulSets', 
          href: selectedCluster && selectedNamespace
            ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/statefulsets`
            : selectedCluster
              ? `/clusters/${selectedCluster}/statefulsets`
              : '/statefulsets',
          icon: QueueListIcon 
        },
        { 
          name: 'ReplicaSets', 
          href: selectedCluster && selectedNamespace
            ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/replicasets`
            : selectedCluster
              ? `/clusters/${selectedCluster}/replicasets`
              : '/replicasets',
          icon: RectangleGroupIcon 
        },
        { 
          name: 'Jobs', 
          href: selectedCluster && selectedNamespace
            ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/jobs`
            : selectedCluster
              ? `/clusters/${selectedCluster}/jobs`
              : '/jobs',
          icon: BriefcaseIcon 
        },
        { 
          name: 'CronJobs', 
          href: selectedCluster && selectedNamespace
            ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/cronjobs`
            : selectedCluster
              ? `/clusters/${selectedCluster}/cronjobs`
              : '/cronjobs',
          icon: ClockIcon 
        },
      ]
    },
    {
      name: 'Network',
      icon: CloudIcon,
      isGroup: true,
      children: [
        { 
          name: 'Services', 
          href: selectedCluster && selectedNamespace
            ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/services`
            : selectedCluster
              ? `/clusters/${selectedCluster}/services`
              : '/services',
          icon: GlobeAltIcon 
        },
        { 
          name: 'Endpoints', 
          href: selectedCluster && selectedNamespace
            ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/endpoints`
            : selectedCluster
              ? `/clusters/${selectedCluster}/endpoints`
              : '/endpoints',
          icon: LinkIcon 
        },
        { 
          name: 'Ingresses', 
          href: selectedCluster && selectedNamespace
            ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/ingresses`
            : selectedCluster
              ? `/clusters/${selectedCluster}/ingresses`
              : '/ingresses',
          icon: GlobeAltIcon 
        },
        { 
          name: 'Ingress Classes', 
          href: selectedCluster
            ? `/clusters/${selectedCluster}/ingressclasses`
            : '/ingressclasses',
          icon: RectangleGroupIcon 
        },
        { 
          name: 'Network Policies', 
          href: selectedCluster && selectedNamespace
            ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/networkpolicies`
            : selectedCluster
              ? `/clusters/${selectedCluster}/networkpolicies`
              : '/networkpolicies',
          icon: ShieldCheckIcon 
        },
      ]
    },
    {
      name: 'Config',
      icon: Cog6ToothIcon,
      isGroup: true,
      children: [
        { 
          name: 'ConfigMaps', 
          href: selectedCluster && selectedNamespace
            ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/configmaps`
            : selectedCluster
              ? `/clusters/${selectedCluster}/configmaps`
              : '/configmaps',
          icon: DocumentTextIcon 
        },
        { 
          name: 'Secrets', 
          href: selectedCluster && selectedNamespace
            ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/secrets`
            : selectedCluster
              ? `/clusters/${selectedCluster}/secrets`
              : '/secrets',
          icon: KeyIcon 
        },
        { 
          name: 'Horizontal Pod Autoscalers', 
          href: selectedCluster && selectedNamespace
            ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/hpas`
            : selectedCluster
              ? `/clusters/${selectedCluster}/hpas`
              : '/hpas',
          icon: AdjustmentsHorizontalIcon 
        },
        { 
          name: 'Pod Disruption Budgets', 
          href: selectedCluster && selectedNamespace
            ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/pdbs`
            : selectedCluster
              ? `/clusters/${selectedCluster}/pdbs`
              : '/pdbs',
          icon: AdjustmentsHorizontalIcon 
        },
        { 
          name: 'Priority Classes', 
          href: selectedCluster
            ? `/clusters/${selectedCluster}/priorityclasses`
            : '/priorityclasses',
          icon: ChevronUpIcon 
        },
        { 
          name: 'Runtime Classes', 
          href: selectedCluster
            ? `/clusters/${selectedCluster}/runtimeclasses`
            : '/runtimeclasses',
          icon: CommandLineIcon 
        },
        { 
          name: 'Leases', 
          href: selectedNamespace
            ? selectedCluster
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/leases`
              : `/leases`
            : selectedCluster
              ? `/clusters/${selectedCluster}/leases`
              : '/leases',
          icon: ClockIcon 
        },
        { 
          name: 'Mutating Webhooks', 
          href: selectedCluster
            ? `/clusters/${selectedCluster}/mutatingwebhookconfigurations`
            : '/mutatingwebhookconfigurations',
          icon: BoltIcon 
        },
        { 
          name: 'Validating Webhooks', 
          href: selectedCluster
            ? `/clusters/${selectedCluster}/validatingwebhookconfigurations`
            : '/validatingwebhookconfigurations',
          icon: ShieldCheckIcon 
        },
      ]
    },
    {
      name: 'Storage',
      icon: CircleStackIcon,
      isGroup: true,
      children: [
        { 
          name: 'Storage Classes', 
          href: selectedCluster
            ? `/clusters/${selectedCluster}/storageclasses`
            : '/storageclasses',
          icon: CircleStackIcon 
        },
        { 
          name: 'Persistent Volumes', 
          href: selectedCluster
            ? `/clusters/${selectedCluster}/persistentvolumes`
            : '/persistentvolumes',
          icon: CircleStackIcon 
        },
        { 
          name: 'Persistent Volume Claims', 
          href: selectedCluster && selectedNamespace
            ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/persistentvolumeclaims`
            : selectedCluster
              ? `/clusters/${selectedCluster}/persistentvolumeclaims`
              : '/persistentvolumeclaims',
          icon: CircleStackIcon 
        },
      ]
    },
    {
      name: 'Access Control',
      icon: KeyIcon,
      isGroup: true,
      children: [
        {
          name: 'Service Accounts',
          href: selectedCluster && selectedNamespace
            ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/serviceaccounts`
            : selectedCluster
            ? `/clusters/${selectedCluster}/serviceaccounts`
            : '/serviceaccounts',
          icon: IdentificationIcon,
        },
             {
               name: 'Cluster Roles',
               href: selectedCluster
                 ? `/clusters/${selectedCluster}/clusterroles`
                 : '/clusterroles',
               icon: ShieldCheckIcon,
             },
             {
               name: 'Roles',
               href: selectedCluster && selectedNamespace
                 ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/roles`
                 : selectedCluster
                 ? `/clusters/${selectedCluster}/roles`
                 : '/roles',
               icon: ShieldCheckIcon,
             },
             {
               name: 'Cluster Role Bindings',
               href: selectedCluster
                 ? `/clusters/${selectedCluster}/clusterrolebindings`
                 : '/clusterrolebindings',
               icon: ShieldCheckIcon,
             },
             {
               name: 'Role Bindings',
               href: selectedCluster && selectedNamespace
                 ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/rolebindings`
                 : selectedCluster
                 ? `/clusters/${selectedCluster}/rolebindings`
                 : '/rolebindings',
               icon: ShieldCheckIcon,
             },
      ],
    },
    {
      name: 'Custom Resources',
      icon: PuzzlePieceIcon,
      isGroup: true,
      hasRefresh: true,
      onRefresh: handleRefreshCRDGroups,
      isLoading: crdLoading,
      children: [
        {
          name: 'Definitions',
          href: selectedCluster
            ? `/clusters/${selectedCluster}/customresourcedefinitions`
            : '/customresourcedefinitions',
          icon: CubeIcon,
        },
        // Dynamic CRD groups (sorted A-Z)
        ...crdGroups.map((group) => ({
          name: group.name,
          icon: PuzzlePieceIcon,
          isGroup: true,
          children: group.resources.map((resource) => ({
            name: resource.kind,
            href: selectedCluster && selectedNamespace && resource.scope === 'Namespaced'
              ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/customresources/${resource.group}/${resource.version}/${resource.plural}`
              : selectedCluster
              ? `/clusters/${selectedCluster}/customresources/${resource.group}/${resource.version}/${resource.plural}`
              : `/customresources/${resource.group}/${resource.version}/${resource.plural}`,
            icon: DocumentTextIcon,
          })),
        })),
      ]
    },
    { 
      name: 'Events', 
      href: selectedCluster && selectedNamespace
        ? `/clusters/${selectedCluster}/namespaces/${selectedNamespace}/events`
        : selectedCluster
          ? `/clusters/${selectedCluster}/events`
          : '/events',
      icon: BellAlertIcon 
    },
  ]

  // Filter navigation by enabled clusters and search query
  const filterNavigation = (items: any[], query: string): any[] => {
    // First, filter by enabled clusters
    let filteredItems = items
    
    if (!hasEnabledClusters) {
      // When no enabled clusters, only show Dashboard and Cluster Management
      filteredItems = items.filter(item => 
        item.name === 'Dashboard' || item.name === 'Cluster Management'
      )
    }
    
    // Then filter by search query
    if (!query) return filteredItems

    const lowerQuery = query.toLowerCase()
    return filteredItems.reduce((acc: any[], item: any) => {
      if (item.isGroup) {
        const filteredChildren = filterNavigation(item.children || [], query)
        if (filteredChildren.length > 0) {
          acc.push({ ...item, children: filteredChildren })
        }
      } else {
        if (item.name.toLowerCase().includes(lowerQuery)) {
          acc.push(item)
        }
      }
      return acc
    }, [])
  }

  const filteredNavigation = filterNavigation(navigation, searchQuery)

  // Scroll to active item in sidebar
  useEffect(() => {
    // Use a slight delay to ensure DOM is updated after expansion
    const timer = setTimeout(() => {
      const activeLink = document.querySelector(`nav a[href="${location.pathname}"]`)
      if (activeLink) {
        activeLink.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [location.pathname, expandedGroups])

  // Initialize and sync theme
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  return (
    <div className="min-h-screen bg-[#f9fafb] dark:bg-[#0f1828] transition-colors">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/80 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 sm:w-72 bg-white dark:bg-[#0f1828] shadow-xl flex flex-col',
          'transform transition-transform duration-300 ease-in-out lg:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <Link to="/" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2.5 transition-transform hover:scale-105 group">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 shadow-md group-hover:shadow-lg transition-all">
              <CubeIcon className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent cursor-pointer">
              Kubelens
            </h1>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close menu"
          >
            <XMarkIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item: any) => renderNavItem(item))}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <div 
        className="hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col"
        style={{ width: `${sidebarWidth}px` }}
      >
        <div className="flex min-h-0 flex-1 flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f1828] relative">
          <div className="flex items-center h-16 px-4 border-b border-gray-200 dark:border-gray-700">
            <Link to="/" className="flex items-center gap-3 transition-transform hover:scale-105 group">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg group-hover:shadow-xl transition-all">
                <CubeIcon className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent cursor-pointer">
                Kubelens
              </h1>
            </Link>
          </div>
          
          {/* Sidebar Search */}
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 py-1.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:text-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3 pb-4 overflow-y-auto">
            {filteredNavigation.map((item: any) => renderNavItem(item))}
          </nav>

          {/* Resize Handle */}
          <div
            onMouseDown={handleMouseDown}
            className={clsx(
              'absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500 transition-colors',
              isResizing && 'bg-primary-500'
            )}
            title="Drag to resize sidebar"
          />
        </div>
      </div>

      {/* Main content */}
      <div className="w-full lg:w-auto" style={{ paddingLeft: `${sidebarWidth}px` }}>
        <style>{`
          @media (max-width: 1023px) {
            .w-full { padding-left: 0 !important; }
          }
        `}</style>
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex h-14 sm:h-16 shrink-0 items-center gap-x-2 sm:gap-x-4 border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-[#0f1828]/95 backdrop-blur-sm px-3 sm:px-4 shadow-sm">
          <button
            type="button"
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Bars3Icon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
          </button>

          <div className="flex flex-1 gap-x-2 sm:gap-x-4 items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Link to="/" className="flex lg:hidden items-center gap-2 transition-transform hover:scale-105 group">
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
                aria-label="Toggle theme"
              >
                {isDark ? (
                  <SunIcon className="h-5 w-5 text-yellow-500" />
                ) : (
                  <MoonIcon className="h-5 w-5 text-gray-700" />
                )}
              </button>
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
  )
}

