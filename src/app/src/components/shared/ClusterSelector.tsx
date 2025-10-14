import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDownIcon, ServerIcon, CheckIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import { useClusters } from '@/hooks/useClusters'
import { useClusterStore } from '@/stores/clusterStore'
import clsx from 'clsx'

export default function ClusterSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { cluster: clusterParam } = useParams()
  
  // Only show enabled clusters in selector
  const { data: clusters, isLoading } = useClusters(true)
  const { selectedCluster, setSelectedCluster } = useClusterStore()

  // Auto-select first enabled cluster if none selected
  useEffect(() => {
    if (!isLoading && clusters && clusters.length > 0) {
      // If no cluster is selected (neither in URL nor in store)
      if (!clusterParam && !selectedCluster) {
        const firstCluster = clusters[0]
        console.log('[ClusterSelector] Auto-selecting first cluster:', firstCluster.name)
        setSelectedCluster(firstCluster.name)
      }
    }
  }, [isLoading, clusters, clusterParam, selectedCluster, setSelectedCluster])

  // Sync URL param with store
  useEffect(() => {
    if (clusterParam && clusterParam !== selectedCluster) {
      setSelectedCluster(clusterParam)
    }
  }, [clusterParam, selectedCluster, setSelectedCluster])

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

  const handleSelectCluster = (clusterName: string | null) => {
    setSelectedCluster(clusterName)
    setIsOpen(false)
    
    // Navigate to appropriate route
    if (clusterName) {
      // If we're on a resource page, update the cluster in the URL
      const currentPath = window.location.pathname
      
      // Check if we're on a custom resource page
      const customResourceMatch = currentPath.match(/\/customresources\/([^/]+)\/([^/]+)\/([^/]+)/)
      if (customResourceMatch) {
        const [, group, version, resource] = customResourceMatch
        navigate(`/clusters/${clusterName}/customresources/${group}/${version}/${resource}`)
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
        '/ingressclasses': 'ingressclasses',
        '/networkpolicies': 'networkpolicies',
        '/namespaces': 'namespaces',
        '/storageclasses': 'storageclasses',
        '/persistentvolumes': 'persistentvolumes',
        '/persistentvolumeclaims': 'persistentvolumeclaims',
        '/configmaps': 'configmaps',
        '/secrets': 'secrets',
      '/serviceaccounts': 'serviceaccounts',
      '/clusterroles': 'clusterroles',
      '/roles': 'roles',
      '/clusterrolebindings': 'clusterrolebindings',
      '/rolebindings': 'rolebindings',
        '/hpas': 'hpas',
        '/pdbs': 'pdbs',
        '/leases': 'leases',
        '/priorityclasses': 'priorityclasses',
        '/runtimeclasses': 'runtimeclasses',
        '/mutatingwebhookconfigurations': 'mutatingwebhookconfigurations',
        '/validatingwebhookconfigurations': 'validatingwebhookconfigurations',
        '/customresourcedefinitions': 'customresourcedefinitions',
        '/nodes': 'nodes',
        '/events': 'events',
      }
      
      // Find which resource type we're on
      const resourceType = Object.entries(routeMap).find(([path]) => 
        currentPath.includes(path)
      )?.[1]
      
      if (resourceType) {
        navigate(`/clusters/${clusterName}/${resourceType}`)
      } else {
        navigate('/clusters')
      }
    } else {
      // All clusters - go to overview
      navigate('/')
    }
  }

  const selectedClusterData = clusters?.find((c: any) => c.name === selectedCluster)
  const displayName = selectedClusterData?.name || 'All Clusters'

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        <span className="hidden sm:inline">Loading...</span>
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
          "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50",
          "border border-gray-200 dark:border-gray-700",
          "text-gray-700 dark:text-gray-300",
          isOpen && "ring-2 ring-primary-500 border-primary-500"
        )}
      >
        {selectedCluster ? (
          <ServerIcon className="h-4 w-4 text-primary-600 dark:text-primary-400" />
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
          "max-h-96 overflow-y-auto",
          "animate-in fade-in-0 zoom-in-95"
        )}>
          <div className="py-2">
            {/* All Clusters Option */}
            <button
              onClick={() => handleSelectCluster(null)}
              className={clsx(
                "w-full px-4 py-2.5 text-left flex items-center gap-3 transition-colors",
                !selectedCluster
                  ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300"
              )}
            >
              <GlobeAltIcon className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">All Clusters</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  View all resources
                </div>
              </div>
              {!selectedCluster && (
                <CheckIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              )}
            </button>

            {/* Divider */}
            {clusters && clusters.length > 0 && (
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
            )}

            {/* Cluster Options */}
            {clusters && clusters.length > 0 ? (
              clusters.map((cluster: any) => {
                const isSelected = selectedCluster === cluster.name
                const statusColor = cluster.status === 'healthy' || cluster.status === 'connected'
                  ? 'text-green-500'
                  : cluster.status === 'error' || cluster.status === 'disconnected'
                  ? 'text-red-500'
                  : 'text-yellow-500'

                return (
                  <button
                    key={cluster.name}
                    onClick={() => handleSelectCluster(cluster.name)}
                    className={clsx(
                      "w-full px-4 py-2.5 text-left flex items-center gap-3 transition-colors",
                      isSelected
                        ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300"
                    )}
                  >
                    <ServerIcon className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{cluster.name}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={statusColor}>●</span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {cluster.version || 'Unknown version'}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    )}
                  </button>
                )
              })
            ) : (
              <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                No clusters available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

