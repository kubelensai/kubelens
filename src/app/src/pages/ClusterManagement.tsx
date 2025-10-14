import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getClusters, removeCluster } from '@/services/api'
import {
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import { Switch } from '@headlessui/react'
import clsx from 'clsx'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'
import api from '@/services/api'
import ImportClusterModal from '@/components/ClusterManagement/ImportClusterModal'
import EditClusterModal from '@/components/ClusterManagement/EditClusterModal'

interface ClusterMetrics {
  [clusterName: string]: {
    cpu: {
      usage: number
      capacity: number
    }
    memory: {
      usage: number
      capacity: number
    }
  }
}

export default function ClusterManagement() {
  const queryClient = useQueryClient()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')
  const [clusterMetrics, setClusterMetrics] = useState<ClusterMetrics>({})
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedCluster, setSelectedCluster] = useState<any>(null)

  // Resizable columns
  const { columnWidths, handleMouseDown } = useResizableColumns({
    cluster: 200,
    status: 100,
    condition: 120,
    nodes: 100,
    cpu: 180,
    memory: 180,
    version: 120,
    provider: 140,
    actions: 120,
  }, 'cluster-management-column-widths')

  const { data: clusters, isLoading } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  const deleteMutation = useMutation({
    mutationFn: removeCluster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      setDeleteConfirm(null)
    },
  })

  const toggleClusterMutation = useMutation({
    mutationFn: async ({ name, enabled }: { name: string; enabled: boolean }) => {
      await api.patch(`/clusters/${name}/enabled`, { enabled })
    },
    onSuccess: async () => {
      // Invalidate ALL cluster-related queries (including 'enabled' filter)
      // Use 'exact: false' to match all queries starting with ['clusters']
      await queryClient.invalidateQueries({ queryKey: ['clusters'], exact: false })
      await queryClient.refetchQueries({ queryKey: ['clusters'], exact: false })
    }
  })

  const toggleCluster = (clusterName: string, currentEnabled: boolean) => {
    toggleClusterMutation.mutate({ name: clusterName, enabled: !currentEnabled })
  }

  const handleEdit = (cluster: any) => {
    setSelectedCluster(cluster)
    setIsEditModalOpen(true)
  }

  // Filtering
  const filteredClusters = useMemo(() => {
    if (!clusters) return []
    if (!filterText) return clusters
    const lowerFilter = filterText.toLowerCase()
    return clusters.filter(cluster =>
      cluster.name.toLowerCase().includes(lowerFilter) ||
      cluster.version?.toLowerCase().includes(lowerFilter) ||
      (cluster.metadata as any)?.provider?.toLowerCase().includes(lowerFilter)
    )
  }, [clusters, filterText])

  // Sorting
  const { sortedData, sortConfig, requestSort } = useTableSort(filteredClusters, {
    key: 'name',
    direction: 'asc'
  })

  // Pagination
  const {
    paginatedData: paginatedClusters,
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    changePageSize,
    hasNextPage,
    hasPreviousPage,
  } = usePagination(sortedData, 10, 'cluster-management')

  // Fetch metrics for all clusters from metric-server
  useEffect(() => {
    if (paginatedClusters.length > 0) {
      fetchAllClusterMetrics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginatedClusters])

  const fetchAllClusterMetrics = async () => {
    const metricsMap: ClusterMetrics = {}
    
    await Promise.all(
      paginatedClusters.map(async (cluster: any) => {
        try {
          // Fetch cluster metrics from backend API
          const response = await api.get(`/clusters/${cluster.name}/metrics`)
          const data = response.data
          
          console.log(`Cluster ${cluster.name} metrics:`, data)
          
          if (data) {
            metricsMap[cluster.name] = {
              cpu: {
                usage: data.cpu?.usage || 0,
                capacity: data.cpu?.capacity || 0
              },
              memory: {
                usage: data.memory?.usage || 0,
                capacity: data.memory?.capacity || 0
              }
            }
          }
        } catch (error) {
          console.error(`Failed to fetch metrics for cluster ${cluster.name}:`, error)
        }
      })
    )
    
    console.log('All cluster metrics:', metricsMap)
    setClusterMetrics(metricsMap)
  }

  const getClusterCondition = (cluster: any) => {
    // Use status from API response
    const status = cluster.status || 'unknown'
    
    switch (status.toLowerCase()) {
      case 'connected':
        return { status: 'Connected', color: 'success' }
      case 'disconnected':
        return { status: 'Disconnected', color: 'error' }
      case 'error':
        return { status: 'Error', color: 'error' }
      default:
        return { status: 'Unknown', color: 'warning' }
    }
  }

  const getProviderBadge = (provider?: string) => {
    const providerLower = provider?.toLowerCase() || 'self-hosted'
    const colors: Record<string, string> = {
      eks: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      gke: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      aks: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
      'self-hosted': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    }
    return colors[providerLower] || colors['self-hosted']
  }

  const formatCPU = (millicores: number) => {
    if (!millicores) return 'N/A'
    const cores = millicores / 1000
    if (cores < 1) {
      return `${millicores}m`
    }
    return `${cores.toFixed(1)}`
  }

  const formatBytes = (bytes: number) => {
    if (!bytes) return 'N/A'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)}${sizes[i]}`
  }

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500 dark:bg-red-600'
    if (percentage >= 75) return 'bg-yellow-500 dark:bg-yellow-600'
    return 'bg-green-500 dark:bg-green-600'
  }

  const renderResourceBar = (usage: number, capacity: number, formatFn: (val: number) => string) => {
    if (!capacity || capacity === 0) {
      return <span className="text-xs text-gray-400">N/A</span>
    }

    if (!usage) {
      return (
        <div className="flex flex-col gap-1 w-full min-w-[100px]">
          <span className="text-xs text-gray-500 dark:text-gray-400">No metrics</span>
          <div className="text-[10px] text-gray-400 dark:text-gray-500">
            Capacity: {formatFn(capacity)}
          </div>
        </div>
      )
    }

    const percentage = Math.min((usage / capacity) * 100, 100)
    const colorClass = getProgressBarColor(percentage)

    return (
      <div className="flex flex-col gap-1 w-full min-w-[100px]">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-gray-900 dark:text-white">{formatFn(usage)}</span>
          <span className="text-gray-500 dark:text-gray-400">
            {percentage.toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${colorClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          Cap: {formatFn(capacity)}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <div>
        <Breadcrumb items={[{ name: 'Cluster Management', href: '/clusters' }]} />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Cluster Management</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage and monitor your Kubernetes clusters
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:w-64">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-11 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="btn-primary flex items-center gap-2 justify-center whitespace-nowrap"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            <span>Import Cluster</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <ResizableTableHeader 
                  label="Cluster"
                  columnKey="cluster"
                  sortKey="name"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.cluster}
                />
                <ResizableTableHeader 
                  label="Status"
                  columnKey="status"
                  sortKey="status"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.status}
                />
                <ResizableTableHeader 
                  label="Condition"
                  columnKey="condition"
                  width={columnWidths.condition}
                  onResizeStart={handleMouseDown}
                />
                <ResizableTableHeader 
                  label="Nodes"
                  columnKey="nodes"
                  sortKey="metadata.nodes_count"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.nodes}
                />
                <ResizableTableHeader 
                  label="CPU"
                  columnKey="cpu"
                  sortKey="metadata.cpu_used"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.cpu}
                />
                <ResizableTableHeader 
                  label="Memory"
                  columnKey="memory"
                  sortKey="metadata.memory_used"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.memory}
                />
                <ResizableTableHeader 
                  label="Version"
                  columnKey="version"
                  sortKey="version"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.version}
                />
                <ResizableTableHeader 
                  label="Provider"
                  columnKey="provider"
                  sortKey="metadata.provider"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.provider}
                />
                <ResizableTableHeader 
                  label="Actions"
                  columnKey="actions"
                  width={columnWidths.actions}
                  onResizeStart={handleMouseDown}
                />
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  </td>
                </tr>
              ) : paginatedClusters.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                      {filterText ? 'No clusters found matching your search.' : 'No clusters configured yet.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedClusters.map((cluster: any) => {
                  // Get metrics from backend API
                  const metrics = clusterMetrics[cluster.name]
                  const cpuUsed = metrics?.cpu?.usage || 0
                  const cpuTotal = metrics?.cpu?.capacity || 0
                  
                  const memoryUsed = metrics?.memory?.usage || 0
                  const memoryTotal = metrics?.memory?.capacity || 0

                  const condition = getClusterCondition(cluster)

                  return (
                    <tr key={cluster.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      {/* Cluster Name */}
                      <td className="px-6 py-4 whitespace-nowrap" style={{ width: columnWidths.cluster }}>
                        <Link
                          to={`/clusters/${cluster.name}/overview`}
                          className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                        >
                          {cluster.name}
                        </Link>
                      </td>

                      {/* Status Switch */}
                      <td className="px-6 py-4 whitespace-nowrap" style={{ width: columnWidths.status }}>
                        <Switch
                          checked={cluster.enabled ?? false}
                          onChange={() => toggleCluster(cluster.name, cluster.enabled)}
                          className={clsx(
                            cluster.enabled ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700',
                            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900'
                          )}
                        >
                          <span
                            className={clsx(
                              cluster.enabled ? 'translate-x-6' : 'translate-x-1',
                              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform'
                            )}
                          />
                        </Switch>
                      </td>

                      {/* Condition */}
                      <td className="px-6 py-4 whitespace-nowrap" style={{ width: columnWidths.condition }}>
                        <span className={clsx(
                          'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold',
                          condition.color === 'success' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                          condition.color === 'warning' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                          condition.color === 'error' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        )}>
                          {condition.status}
                        </span>
                      </td>

                      {/* Nodes */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white" style={{ width: columnWidths.nodes }}>
                        {cluster.metadata?.nodes_count || 0}
                      </td>

                      {/* CPU Usage - From Metric Server */}
                      <td className="px-6 py-4" style={{ width: columnWidths.cpu }}>
                        {renderResourceBar(cpuUsed, cpuTotal, formatCPU)}
                      </td>

                      {/* Memory Usage - From Metric Server */}
                      <td className="px-6 py-4" style={{ width: columnWidths.memory }}>
                        {renderResourceBar(memoryUsed, memoryTotal, formatBytes)}
                      </td>

                      {/* Version */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-mono" style={{ width: columnWidths.version }}>
                        {cluster.version}
                      </td>

                      {/* Provider */}
                      <td className="px-6 py-4 whitespace-nowrap" style={{ width: columnWidths.provider }}>
                        <span className={clsx(
                          'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold',
                          getProviderBadge(cluster.metadata?.provider)
                        )}>
                          {cluster.metadata?.provider || 'Self-hosted'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" style={{ width: columnWidths.actions }}>
                        {deleteConfirm === cluster.name ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => deleteMutation.mutate(cluster.name)}
                              className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                              title="Confirm"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => handleEdit(cluster)}
                              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                              title="Edit"
                            >
                              <PencilSquareIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(cluster.name)}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              title="Delete"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && paginatedClusters.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={goToPage}
            onNextPage={goToNextPage}
            onPreviousPage={goToPreviousPage}
            onPageSizeChange={changePageSize}
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
          />
        )}
      </div>

      {/* Modals */}
      <ImportClusterModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
      <EditClusterModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        cluster={selectedCluster}
      />
    </div>
  )
}
