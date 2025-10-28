import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getClusters, getNamespaces } from '@/services/api'
import { Square3Stack3DIcon, PencilSquareIcon, TrashIcon, EyeIcon, CpuChipIcon, CircleStackIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { formatAge } from '@/utils/format'
import { useClusterStore } from '@/stores/clusterStore'
import NamespaceDetailsModal from '@/components/Namespaces/NamespaceDetailsModal'
import EditNamespaceYAMLModal from '@/components/Namespaces/EditNamespaceYAMLModal'
import DeleteNamespaceModal from '@/components/Namespaces/DeleteNamespaceModal'
import { DataTable, Column } from '@/components/shared/DataTable'
import clsx from 'clsx'
import api from '@/services/api'

interface NamespaceMetrics {
  [namespaceKey: string]: {
    cpuUsage: number
    memoryUsage: number
    cpuRequests: number
    memoryRequests: number
    cpuLimits: number
    memoryLimits: number
  }
}

interface NamespaceResource {
  clusterName: string
  metadata: {
    name: string
    creationTimestamp: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec?: any
  status?: {
    phase?: string
  }
}

export default function Namespaces() {
  const { cluster } = useParams<{ cluster?: string }>()
  const { selectedCluster } = useClusterStore()
  const queryClient = useQueryClient()

  const [selectedNamespace, setSelectedNamespace] = useState<NamespaceResource | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [namespaceMetrics, setNamespaceMetrics] = useState<NamespaceMetrics>({})
  
  // Fetch enabled clusters first
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Determine current cluster: URL param > store > first enabled cluster
  const currentCluster = cluster || selectedCluster || (clusters && clusters.length > 0 ? clusters[0].name : null)

  // Reset modal states when cluster changes
  useEffect(() => {
    setSelectedNamespace(null)
    setIsDetailsOpen(false)
    setIsEditOpen(false)
    setIsDeleteOpen(false)
  }, [currentCluster])

  // Fetch Namespaces for the selected cluster
  const { data: namespaces = [], isLoading } = useQuery({
    queryKey: ['namespaces', currentCluster],
    queryFn: () => getNamespaces(currentCluster || 'default'),
    refetchInterval: 5000,
    enabled: !!currentCluster,
  })

  // Add clusterName to each namespace
  const namespacesWithCluster = useMemo(() => {
    return namespaces.map((ns: any) => ({
      ...ns,
      clusterName: currentCluster || ''
    }))
  }, [namespaces, currentCluster])

  // Fetch metrics for all namespaces
  useEffect(() => {
    if (namespacesWithCluster && namespacesWithCluster.length > 0) {
      fetchAllNamespaceMetrics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespacesWithCluster])

  const fetchAllNamespaceMetrics = async () => {
    if (!namespacesWithCluster) return
    const metricsMap: NamespaceMetrics = {}
    
    await Promise.all(
      namespacesWithCluster.map(async (ns: any) => {
        try {
          const response = await api.get(`/clusters/${ns.clusterName}/namespaces/${ns.metadata.name}/metrics`)
          const data = response.data
          
          if (data) {
            metricsMap[`${ns.clusterName}-${ns.metadata.name}`] = {
              cpuUsage: typeof data.usage?.cpu === 'number' ? data.usage.cpu : 0,
              memoryUsage: typeof data.usage?.memory === 'number' ? data.usage.memory : 0,
              cpuRequests: typeof data.requests?.cpu === 'number' ? data.requests.cpu : 0,
              memoryRequests: typeof data.requests?.memory === 'number' ? data.requests.memory : 0,
              cpuLimits: typeof data.limits?.cpu === 'number' ? data.limits.cpu : 0,
              memoryLimits: typeof data.limits?.memory === 'number' ? data.limits.memory : 0
            }
          }
        } catch (error) {
          // Silently fail for metrics
        }
      })
    )
    
    setNamespaceMetrics(metricsMap)
  }

  // Helper functions
  const formatCPU = (millicores: number) => {
    if (millicores < 1000) {
      return `${millicores}m`
    }
    return `${(millicores / 1000).toFixed(2)}`
  }

  const formatMemory = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024)
    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`
    }
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(0)} MB`
  }

  // Handlers
  const handleRowClick = (ns: NamespaceResource) => {
    setSelectedNamespace(ns)
    setIsDetailsOpen(true)
  }

  const handleEditYAML = (ns: NamespaceResource) => {
    setSelectedNamespace(ns)
    setIsEditOpen(true)
  }

  const handleDelete = (ns: NamespaceResource) => {
    setSelectedNamespace(ns)
    setIsDeleteOpen(true)
  }

  const handleModalSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['namespaces', currentCluster] })
    queryClient.refetchQueries({ queryKey: ['namespaces', currentCluster] })
    setIsDetailsOpen(false)
    setIsEditOpen(false)
    setIsDeleteOpen(false)
    setSelectedNamespace(null)
  }

  // Define columns
  const columns = useMemo<Column<NamespaceResource>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (ns) => (
        <div className="flex items-center gap-2">
          <Square3Stack3DIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-gray-900 dark:text-white truncate">
              {ns.metadata.name}
            </div>
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (ns) => ns.metadata.name,
      searchValue: (ns) => ns.metadata.name,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (ns) => {
        const phase = ns.status?.phase || 'Active'
        const isActive = phase === 'Active'
        
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
            isActive
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          )}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', isActive ? 'bg-green-600 dark:bg-green-400' : 'bg-red-600 dark:bg-red-400')} />
            {phase}
          </span>
        )
      },
      sortable: true,
      sortValue: (ns) => ns.status?.phase || 'Active',
      searchValue: (ns) => ns.status?.phase || 'Active',
      filterable: true,
      filterOptions: (data) => {
        const phases = new Set(data.map(ns => ns.status?.phase || 'Active'))
        return Array.from(phases).sort()
      },
      filterValue: (ns) => ns.status?.phase || 'Active',
    },
    {
      key: 'cpu',
      header: 'CPU Usage',
      accessor: (ns) => {
        const metrics = namespaceMetrics[`${ns.clusterName}-${ns.metadata.name}`]
        if (!metrics || (metrics.cpuUsage === 0 && metrics.cpuRequests === 0 && metrics.cpuLimits === 0)) {
          return <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
        }

        // Calculate percentages for usage/request and usage/limit
        const usageVsRequest = metrics.cpuRequests > 0 
          ? (metrics.cpuUsage / metrics.cpuRequests) * 100 
          : 0
        const usageVsLimit = metrics.cpuLimits > 0 
          ? (metrics.cpuUsage / metrics.cpuLimits) * 100 
          : 0

        // Determine which percentage to display (prefer limit, fallback to request)
        const displayPercentage = metrics.cpuLimits > 0 
          ? Math.min(usageVsLimit, 100)
          : metrics.cpuRequests > 0 
            ? Math.min(usageVsRequest, 100)
            : 0

        return (
          <div className="w-full min-w-[120px]">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <CpuChipIcon className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 font-mono">
                  {formatCPU(metrics.cpuUsage)}
                </span>
              </div>
              {displayPercentage > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {displayPercentage.toFixed(0)}%
                </span>
              )}
            </div>
            {displayPercentage > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 overflow-hidden">
                <div
                  className={clsx(
                    'h-1.5 rounded-full transition-all duration-300',
                    displayPercentage >= 90 ? 'bg-red-600 dark:bg-red-500' :
                    displayPercentage >= 75 ? 'bg-orange-600 dark:bg-orange-500' :
                    'bg-blue-600 dark:bg-blue-500'
                  )}
                  style={{ width: `${displayPercentage}%` }}
                />
              </div>
            )}
            {(metrics.cpuRequests > 0 || metrics.cpuLimits > 0) && (
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                {metrics.cpuRequests > 0 && (
                  <span>Req: {formatCPU(metrics.cpuRequests)}</span>
                )}
                {metrics.cpuLimits > 0 && (
                  <span>Lim: {formatCPU(metrics.cpuLimits)}</span>
                )}
              </div>
            )}
          </div>
        )
      },
      sortable: true,
      sortValue: (ns) => {
        const metrics = namespaceMetrics[`${ns.clusterName}-${ns.metadata.name}`]
        return metrics?.cpuUsage || 0
      },
      searchValue: (ns) => {
        const metrics = namespaceMetrics[`${ns.clusterName}-${ns.metadata.name}`]
        return metrics ? formatCPU(metrics.cpuUsage) : ''
      },
    },
    {
      key: 'memory',
      header: 'Memory Usage',
      accessor: (ns) => {
        const metrics = namespaceMetrics[`${ns.clusterName}-${ns.metadata.name}`]
        if (!metrics || (metrics.memoryUsage === 0 && metrics.memoryRequests === 0 && metrics.memoryLimits === 0)) {
          return <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
        }

        // Calculate percentages for usage/request and usage/limit
        const usageVsRequest = metrics.memoryRequests > 0 
          ? (metrics.memoryUsage / metrics.memoryRequests) * 100 
          : 0
        const usageVsLimit = metrics.memoryLimits > 0 
          ? (metrics.memoryUsage / metrics.memoryLimits) * 100 
          : 0

        // Determine which percentage to display (prefer limit, fallback to request)
        const displayPercentage = metrics.memoryLimits > 0 
          ? Math.min(usageVsLimit, 100)
          : metrics.memoryRequests > 0 
            ? Math.min(usageVsRequest, 100)
            : 0

        return (
          <div className="w-full min-w-[120px]">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <CircleStackIcon className="w-4 h-4 text-green-500 dark:text-green-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 font-mono">
                  {formatMemory(metrics.memoryUsage)}
                </span>
              </div>
              {displayPercentage > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {displayPercentage.toFixed(0)}%
                </span>
              )}
            </div>
            {displayPercentage > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 overflow-hidden">
                <div
                  className={clsx(
                    'h-1.5 rounded-full transition-all duration-300',
                    displayPercentage >= 90 ? 'bg-red-600 dark:bg-red-500' :
                    displayPercentage >= 75 ? 'bg-orange-600 dark:bg-orange-500' :
                    'bg-green-600 dark:bg-green-500'
                  )}
                  style={{ width: `${displayPercentage}%` }}
                />
              </div>
            )}
            {(metrics.memoryRequests > 0 || metrics.memoryLimits > 0) && (
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                {metrics.memoryRequests > 0 && (
                  <span>Req: {formatMemory(metrics.memoryRequests)}</span>
                )}
                {metrics.memoryLimits > 0 && (
                  <span>Lim: {formatMemory(metrics.memoryLimits)}</span>
                )}
              </div>
            )}
          </div>
        )
      },
      sortable: true,
      sortValue: (ns) => {
        const metrics = namespaceMetrics[`${ns.clusterName}-${ns.metadata.name}`]
        return metrics?.memoryUsage || 0
      },
      searchValue: (ns) => {
        const metrics = namespaceMetrics[`${ns.clusterName}-${ns.metadata.name}`]
        return metrics ? formatMemory(metrics.memoryUsage) : ''
      },
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (ns) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(ns.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (ns) => new Date(ns.metadata.creationTimestamp).getTime(),
      searchValue: (ns) => formatAge(ns.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (ns) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleRowClick(ns)
            }}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleEditYAML(ns)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(ns)
            }}
            className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
      sortable: false,
    },
  ], [namespaceMetrics])

  // Mobile card renderer
  const renderMobileCard = (ns: NamespaceResource) => {
    const phase = ns.status?.phase || 'Active'
    const isActive = phase === 'Active'
    const metrics = namespaceMetrics[`${ns.clusterName}-${ns.metadata.name}`]

    return (
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => handleRowClick(ns)}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Square3Stack3DIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium text-gray-900 dark:text-white truncate">
                {ns.metadata.name}
              </div>
            </div>
          </div>
        </div>

        {/* Status and Metrics */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className={clsx(
              'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
              isActive
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            )}>
              <span className={clsx('w-1.5 h-1.5 rounded-full', isActive ? 'bg-green-600 dark:bg-green-400' : 'bg-red-600 dark:bg-red-400')} />
              {phase}
            </span>
          </div>
          
          {metrics && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-500 dark:text-gray-400">CPU:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">
                  {formatCPU(metrics.cpuUsage)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Memory:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">
                  {formatMemory(metrics.memoryUsage)}
                </span>
              </div>
            </div>
          )}
          
          <div>
            <span className="text-gray-500 dark:text-gray-400">Age:</span>
            <span className="ml-1 text-gray-900 dark:text-white">
              {formatAge(ns.metadata.creationTimestamp)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleRowClick(ns)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            <EyeIcon className="w-4 h-4" />
            View
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleEditYAML(ns)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-md transition-colors"
          >
            <PencilSquareIcon className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(ns)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <div>
        <Breadcrumb 
          items={
            currentCluster
              ? [
                  { name: currentCluster, href: "/dashboard" },
                  { name: 'Namespaces' }
                ]
              : [{ name: 'Namespaces' }]
          }
        />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            Namespaces
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {currentCluster ? `Viewing namespaces in ${currentCluster}` : 'Select a cluster to view namespaces'}
          </p>
        </div>
      </div>

      {/* Data Table */}
      <DataTable<NamespaceResource>
        data={namespacesWithCluster}
        columns={columns}
        keyExtractor={(ns) => `${ns.clusterName}-${ns.metadata.name}`}
        isLoading={isLoading}
        onRowClick={handleRowClick}
        mobileCardRenderer={renderMobileCard}
        emptyMessage="No namespaces found"
        searchPlaceholder="Search namespaces..."
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <Square3Stack3DIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
      />

      {/* Modals */}
      {selectedNamespace && (
        <>
          <NamespaceDetailsModal
            namespace={selectedNamespace}
            isOpen={isDetailsOpen}
            onClose={() => {
              setIsDetailsOpen(false)
              setSelectedNamespace(null)
            }}
          />

          <EditNamespaceYAMLModal
            namespace={selectedNamespace}
            isOpen={isEditOpen}
            onClose={() => {
              setIsEditOpen(false)
              setSelectedNamespace(null)
            }}
            onSuccess={handleModalSuccess}
          />

          <DeleteNamespaceModal
            namespace={selectedNamespace}
            isOpen={isDeleteOpen}
            onClose={() => {
              setIsDeleteOpen(false)
              setSelectedNamespace(null)
            }}
            onSuccess={handleModalSuccess}
          />
        </>
      )}
    </div>
  )
}
