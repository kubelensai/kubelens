import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDownIcon, CheckIcon, Square3Stack3DIcon, GlobeAltIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { getNamespaces } from '@/services/api'
import { useClusterStore } from '@/stores/clusterStore'
import { useNamespaceStore } from '@/stores/namespaceStore'
import { useClusters } from '@/hooks/useClusters'
import clsx from 'clsx'

export default function NamespaceSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { cluster: clusterParam, namespace: namespaceParam } = useParams()
  
  const { selectedCluster, setSelectedCluster } = useClusterStore()
  const { selectedNamespace, setSelectedNamespace } = useNamespaceStore()
  
  // Check if there are any enabled clusters
  const { data: enabledClusters, isLoading: isLoadingClusters } = useClusters(true)
  const hasEnabledClusters = enabledClusters && enabledClusters.length > 0
  
  // Auto-select first enabled cluster if none selected
  useEffect(() => {
    if (!isLoadingClusters && enabledClusters && enabledClusters.length > 0) {
      // If no cluster is selected (neither in URL nor in store)
      if (!clusterParam && !selectedCluster) {
        const firstCluster = enabledClusters[0]
        console.log('[NamespaceSelector] Auto-selecting first cluster:', firstCluster.name)
        setSelectedCluster(firstCluster.name)
      }
    }
  }, [isLoadingClusters, enabledClusters, clusterParam, selectedCluster, setSelectedCluster])
  
  // Determine which cluster to use (URL param or store) - MUST be after auto-select
  const effectiveCluster = clusterParam || selectedCluster
  
  // Check if the effective cluster exists in enabled clusters
  const clusterExists = enabledClusters?.some((c: any) => c.name === effectiveCluster)
  
  // Debug logging
  useEffect(() => {
    console.log('[NamespaceSelector] Debug:', {
      enabledClusters,
      hasEnabledClusters,
      isLoadingClusters,
      effectiveCluster,
      selectedCluster,
      clusterParam,
      clusterExists
    })
  }, [enabledClusters, hasEnabledClusters, isLoadingClusters, effectiveCluster, selectedCluster, clusterParam, clusterExists])

  // Fetch namespaces for the selected cluster
  const { data: namespaces, isLoading } = useQuery({
    queryKey: ['namespaces', effectiveCluster],
    queryFn: () => effectiveCluster ? getNamespaces(effectiveCluster) : Promise.resolve([]),
    enabled: !!effectiveCluster && clusterExists,
  })

  // Sync URL param with store (URL is source of truth when present)
  // But also sync session data when URL param is not present
  useEffect(() => {
    const urlNamespace = namespaceParam || null
    
    // If URL has namespace, use it (URL is source of truth)
    if (urlNamespace !== null && urlNamespace !== selectedNamespace) {
      setSelectedNamespace(urlNamespace)
    }
    // If URL doesn't have namespace but session has one, the UI should still show it
    // (This happens when user navigates to a page without namespace in URL)
    // The selectedNamespace will be from session via the store
  }, [namespaceParam, selectedNamespace, setSelectedNamespace])

  // Clear namespace when cluster changes
  useEffect(() => {
    if (!effectiveCluster) {
      setSelectedNamespace(null)
    }
  }, [effectiveCluster, setSelectedNamespace])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    } else {
      setSearchQuery('')
    }
  }, [isOpen])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Filter namespaces based on search query
  const filteredNamespaces = namespaces?.filter((ns: any) => {
    const name = ns.metadata?.name || ns.name || ''
    const query = searchQuery.toLowerCase()
    
    return name.toLowerCase().includes(query)
  })

  const handleSelectNamespace = (namespaceName: string | null) => {
    setSelectedNamespace(namespaceName)
    setIsOpen(false)
    
    // Navigate to appropriate route
    if (effectiveCluster) {
      const currentPath = window.location.pathname
      
      // Check if we're on a custom resource page
      const customResourceMatch = currentPath.match(/\/customresources\/([^/]+)\/([^/]+)\/([^/]+)/)
      if (customResourceMatch) {
        const [, group, version, resource] = customResourceMatch
        if (namespaceName) {
          navigate(`/clusters/${effectiveCluster}/namespaces/${namespaceName}/customresources/${group}/${version}/${resource}`)
        } else {
          navigate(`/clusters/${effectiveCluster}/customresources/${group}/${version}/${resource}`)
        }
        return
      }
      
      // Define route mappings for all resource pages
      const routeMap: Record<string, string> = {
        '/pods': 'pods',
        '/deployments': 'deployments',
        '/daemonsets': 'daemonsets',
        '/statefulsets': 'statefulsets',
        '/replicasets': 'replicasets',
        '/jobs': 'jobs',
        '/cronjobs': 'cronjobs',
        '/services': 'services',
        '/endpoints': 'endpoints',
        '/ingresses': 'ingresses',
        '/networkpolicies': 'networkpolicies',
    '/persistentvolumeclaims': 'persistentvolumeclaims',
    '/configmaps': 'configmaps',
    '/secrets': 'secrets',
    '/serviceaccounts': 'serviceaccounts',
    '/roles': 'roles',
    '/rolebindings': 'rolebindings',
    '/hpas': 'hpas',
        '/pdbs': 'pdbs',
        '/leases': 'leases',
        '/events': 'events',
      }
      
      // Find which resource type we're on
      const resourceType = Object.entries(routeMap).find(([path]) => 
        currentPath.includes(path)
      )?.[1]
      
      if (resourceType) {
        if (namespaceName) {
          // Navigate to namespace-specific route
          navigate(`/clusters/${effectiveCluster}/namespaces/${namespaceName}/${resourceType}`)
        } else {
          // All namespaces - go back to cluster level
          navigate(`/clusters/${effectiveCluster}/${resourceType}`)
        }
      }
    }
  }

  // Don't show if no cluster is selected
  if (!effectiveCluster) {
    return null
  }

  const displayName = selectedNamespace || 'All Namespaces'

  // Show loading state while fetching clusters or namespaces
  if (isLoadingClusters || isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        <span className="hidden sm:inline">Loading...</span>
      </div>
    )
  }

  // Don't render if no enabled clusters (after loading is complete)
  if (!hasEnabledClusters) {
    console.log('[NamespaceSelector] Hiding because no enabled clusters')
    return null
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={!effectiveCluster}
        className={clsx(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
          "bg-gray-50 dark:bg-gray-800/50",
          "border border-gray-200 dark:border-gray-700",
          "text-gray-700 dark:text-gray-300",
          effectiveCluster 
            ? "hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer" 
            : "opacity-50 cursor-not-allowed",
          isOpen && effectiveCluster && "ring-2 ring-primary-500 border-primary-500"
        )}
      >
        {selectedNamespace ? (
          <Square3Stack3DIcon className="h-4 w-4 text-primary-600 dark:text-primary-400" />
        ) : (
          <GlobeAltIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        )}
        <span className="hidden sm:inline truncate max-w-32">{displayName}</span>
        <ChevronDownIcon className={clsx(
          "h-4 w-4 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={clsx(
          "absolute top-full right-0 mt-2 w-64 z-50",
          "bg-white dark:bg-[#1a1f2e]",
          "border border-gray-200 dark:border-gray-700",
          "rounded-lg shadow-xl",
          "animate-in fade-in-0 zoom-in-95"
        )}>
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search namespaces..."
                className={clsx(
                  "w-full pl-9 pr-3 py-2 text-sm",
                  "bg-gray-50 dark:bg-gray-800/50",
                  "border border-gray-200 dark:border-gray-700",
                  "rounded-lg",
                  "text-gray-900 dark:text-gray-100",
                  "placeholder-gray-500 dark:placeholder-gray-400",
                  "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                )}
              />
            </div>
          </div>

          <div className="py-2 max-h-80 overflow-y-auto">
            {/* All Namespaces Option */}
            <button
              onClick={() => handleSelectNamespace(null)}
              className={clsx(
                "w-full px-4 py-2.5 text-left flex items-center gap-3 transition-colors",
                !selectedNamespace
                  ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300"
              )}
            >
              <GlobeAltIcon className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">All Namespaces</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  View all resources
                </div>
              </div>
              {!selectedNamespace && (
                <CheckIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              )}
            </button>

            {/* Divider */}
            {namespaces && namespaces.length > 0 && (
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
            )}

            {/* Namespace Options */}
            {filteredNamespaces && filteredNamespaces.length > 0 ? (
              filteredNamespaces.map((namespace: any) => {
                const nsName = namespace.metadata?.name || namespace.name
                const isSelected = selectedNamespace === nsName

                return (
                  <button
                    key={nsName}
                    onClick={() => handleSelectNamespace(nsName)}
                    className={clsx(
                      "w-full px-4 py-2.5 text-left flex items-center gap-3 transition-colors",
                      isSelected
                        ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300"
                    )}
                  >
                    <Square3Stack3DIcon className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{nsName}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {namespace.status?.phase || 'Active'}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    )}
                  </button>
                )
              })
            ) : searchQuery ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                No namespaces found matching "{searchQuery}"
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                No namespaces available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

