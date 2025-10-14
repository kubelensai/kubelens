import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useLocation } from 'react-router-dom'
import { getClusters, getPods } from '@/services/api'
import { useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import { CommandLineIcon, PencilSquareIcon, TrashIcon, DocumentTextIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import PodDetailsModal from '@/components/Pods/PodDetailsModal'
import PodShellModal from '@/components/Pods/PodShellModal'
import PodLogsModal from '@/components/Pods/PodLogsModal'
import EditPodModal from '@/components/Pods/EditPodModal'
import DeletePodModal from '@/components/Pods/DeletePodModal'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import api from '@/services/api'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

interface PodMetrics {
  [podKey: string]: {
    cpuUsage: number
    memoryUsage: number
  }
}

export default function Pods() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [selectedPod, setSelectedPod] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isShellModalOpen, setIsShellModalOpen] = useState(false)
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [podMetrics, setPodMetrics] = useState<PodMetrics>({})
  const [filterText, setFilterText] = useState('')

  // Auto-fill filter from navigation state (from NodePodsModal)
  useEffect(() => {
    const state = location.state as any
    if (state?.filterPodName) {
      setFilterText(state.filterPodName)
      // Clear the state after using it
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    namespace: 150,
    containers: 120,
    status: 100,
    qos: 100,
    restarts: 100,
    cpu: 120,
    memory: 120,
    node: 150,
    age: 120,
    actions: 180,
  }, 'pods-column-widths')
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch pods from all clusters or specific cluster/namespace
  const podQueries = useQuery({
    queryKey: namespace 
      ? ['pods', cluster, namespace]
      : cluster 
        ? ['pods', cluster] 
        : ['all-pods', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const pods = await getPods(cluster, namespace)
        return pods.map((pod: any) => ({ ...pod, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const pods = await getPods(cluster)
        return pods.map((pod: any) => ({ ...pod, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allPods = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const pods = await getPods(cluster.name)
            return pods.map((pod: any) => ({ ...pod, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching pods from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allPods.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
    staleTime: 0,
  })

  const isLoading = podQueries.isLoading
  const isError = podQueries.isError
  const error = podQueries.error
  const allPods = podQueries.data || []

  // Filter pods by name
  const filteredPods = useMemo(() => {
    if (!filterText) return allPods
    const lowerFilter = filterText.toLowerCase()
    return allPods.filter((pod: any) =>
      pod.metadata?.name?.toLowerCase().includes(lowerFilter)
    )
  }, [allPods, filterText])

  // Apply sorting
  const { sortedData: sortedPods, sortConfig, requestSort } = useTableSort(filteredPods, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: pods,
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
  } = usePagination(sortedPods, 10, 'pods')

  // Fetch metrics for all pods
  useEffect(() => {
    if (pods.length > 0) {
      fetchAllPodMetrics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pods])

  const fetchAllPodMetrics = async () => {
    const metricsMap: PodMetrics = {}
    
    await Promise.all(
      pods.map(async (pod: any) => {
        try {
          const response = await api.get(
            `/clusters/${pod.clusterName}/namespaces/${pod.metadata.namespace}/pods/${pod.metadata.name}/metrics`
          )
          const data = response.data
          
          if (data?.containers) {
            // Sum up all container metrics
            let totalCpu = 0
            let totalMemory = 0
            
            data.containers.forEach((container: any) => {
              if (container.usage) {
                totalCpu += parseCPUToMillicores(container.usage.cpu)
                totalMemory += parseMemoryToBytes(container.usage.memory)
              }
            })
            
            metricsMap[`${pod.clusterName}-${pod.metadata.namespace}-${pod.metadata.name}`] = {
              cpuUsage: totalCpu,
              memoryUsage: totalMemory
            }
          }
        } catch (error) {
          // Ignore errors, metrics not available
        }
      })
    )
    
    setPodMetrics(metricsMap)
  }

  const parseCPUToMillicores = (cpu: string): number => {
    if (!cpu) return 0
    if (cpu.endsWith('m')) {
      return parseInt(cpu.replace('m', ''))
    } else if (cpu.endsWith('n')) {
      return parseInt(cpu.replace('n', '')) / 1000000
    } else {
      return parseFloat(cpu) * 1000
    }
  }

  const parseMemoryToBytes = (memory: string): number => {
    if (!memory) return 0
    if (memory.endsWith('Ki')) {
      return parseInt(memory.replace('Ki', '')) * 1024
    } else if (memory.endsWith('Mi')) {
      return parseInt(memory.replace('Mi', '')) * 1024 * 1024
    } else if (memory.endsWith('Gi')) {
      return parseInt(memory.replace('Gi', '')) * 1024 * 1024 * 1024
    } else {
      return parseInt(memory)
    }
  }

  const formatBytes = (bytes: number) => {
    if (!bytes) return 'N/A'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)}${sizes[i]}`
  }

  const formatCPU = (millicores: number) => {
    if (!millicores) return 'N/A'
    const cores = millicores / 1000
    if (cores < 0.01) {
      return `${millicores.toFixed(0)}m` // Show millicores for very small values
    }
    if (cores < 1) {
      return `${cores.toFixed(3)} cores`
    }
    return `${cores.toFixed(2)} cores`
  }

  const getTotalRestarts = (pod: any) => {
    if (!pod.status?.containerStatuses) return 0
    return pod.status.containerStatuses.reduce((sum: number, container: any) => sum + (container.restartCount || 0), 0)
  }

  const getContainerStatusSummary = (pod: any) => {
    if (!pod.status?.containerStatuses) return { ready: 0, total: 0, waiting: 0, error: 0 }
    
    const total = pod.status.containerStatuses.length
    const ready = pod.status.containerStatuses.filter((c: any) => c.ready).length
    const waiting = pod.status.containerStatuses.filter((c: any) => c.state?.waiting).length
    const error = pod.status.containerStatuses.filter((c: any) => c.state?.terminated?.reason === 'Error').length
    
    return { ready, total, waiting, error }
  }

  const handlePodClick = (pod: any) => {
    setSelectedPod(pod)
    setIsDetailsModalOpen(true)
  }

  const handleShellClick = (pod: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPod(pod)
    setIsShellModalOpen(true)
  }

  const handleLogsClick = (pod: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPod(pod)
    setIsLogsModalOpen(true)
  }

  const handleEditClick = (pod: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPod(pod)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (pod: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPod(pod)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ['pods'] })
    await queryClient.invalidateQueries({ queryKey: ['all-pods'] })
    await queryClient.refetchQueries({ queryKey: ['pods'] })
    await queryClient.refetchQueries({ queryKey: ['all-pods'] })
    setIsDeleteModalOpen(false)
    setSelectedPod(null)
  }

  if (isError) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">
            Error loading pods
          </div>
          <div className="text-gray-600 dark:text-gray-400 text-sm">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </div>
          <button
            onClick={() => podQueries.refetch()}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
           <Breadcrumb
              items={
                cluster
                  ? [
                      { name: cluster, href: `/clusters/${cluster}/overview` },
                      { name: 'Pods' }
                    ]
                  : [{ name: 'Pods' }]
              }
            />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Pods</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            {cluster && namespace
              ? `Pods in namespace "${namespace}" of cluster "${cluster}"`
              : cluster 
                ? `Pods in cluster: ${cluster}`
                : `All pods across ${clusters?.length || 0} cluster(s)`
            }
          </p>
        </div>
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
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <ResizableTableHeader
                  label="Name"
                  columnKey="name"
                  sortKey="metadata.name"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.name}
                />
                <ResizableTableHeader
                  label="Namespace"
                  columnKey="namespace"
                  sortKey="metadata.namespace"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.namespace}
                />
                <ResizableTableHeader
                  label="Containers"
                  columnKey="containers"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.containers}
                  align="center"
                />
                <ResizableTableHeader
                  label="Status"
                  columnKey="status"
                  sortKey="status.phase"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.status}
                />
                <ResizableTableHeader
                  label="QoS"
                  columnKey="qos"
                  sortKey="status.qosClass"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.qos}
                  align="center"
                />
                <ResizableTableHeader
                  label="Restarts"
                  columnKey="restarts"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.restarts}
                  align="center"
                />
                <ResizableTableHeader
                  label="CPU"
                  columnKey="cpu"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.cpu}
                />
                <ResizableTableHeader
                  label="Memory"
                  columnKey="memory"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.memory}
                />
                <ResizableTableHeader
                  label="Node"
                  columnKey="node"
                  sortKey="spec.nodeName"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.node}
                />
                <ResizableTableHeader
                  label="Age"
                  columnKey="age"
                  sortKey="metadata.creationTimestamp"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.age}
                />
                <ResizableTableHeader
                  label="Actions"
                  columnKey="actions"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.actions}
                  align="right"
                />
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading pods...</span>
                    </div>
                  </td>
                </tr>
              ) : pods.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No pods found</p>
                  </td>
                </tr>
              ) : (
                pods.map((pod) => {
                  const containerStatus = getContainerStatusSummary(pod)
                  const podKey = `${pod.clusterName}-${pod.metadata.namespace}-${pod.metadata.name}`
                  const metrics = podMetrics[podKey]
                  const restarts = getTotalRestarts(pod)
                  
                  return (
                    <tr 
                      key={podKey} 
                      onClick={() => handlePodClick(pod)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    >
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        <div className="truncate max-w-[150px] sm:max-w-none">
                          {pod.metadata.name}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {pod.metadata.namespace}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          {containerStatus.ready > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              {containerStatus.ready}
                            </span>
                          )}
                          {containerStatus.waiting > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                              {containerStatus.waiting}
                            </span>
                          )}
                          {containerStatus.error > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              {containerStatus.error}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">/{containerStatus.total}</span>
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                        <span
                          className={clsx(
                            'badge text-xs',
                            pod.metadata.deletionTimestamp ? 'badge-error' : '',
                            !pod.metadata.deletionTimestamp && pod.status.phase === 'Running' && 'badge-success',
                            !pod.metadata.deletionTimestamp && pod.status.phase === 'Pending' && 'badge-warning',
                            !pod.metadata.deletionTimestamp && pod.status.phase === 'Failed' && 'badge-error',
                            !pod.metadata.deletionTimestamp && pod.status.phase === 'Succeeded' && 'badge-info'
                          )}
                        >
                          {pod.metadata.deletionTimestamp ? 'Terminating' : pod.status.phase}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-center">
                        <span className={clsx(
                          'text-xs px-2 py-0.5 rounded font-medium',
                          pod.status?.qosClass === 'Guaranteed' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                          pod.status?.qosClass === 'Burstable' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                          pod.status?.qosClass === 'BestEffort' && 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                        )}>
                          {pod.status?.qosClass || 'N/A'}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-center">
                        <span className={clsx(
                          'text-xs sm:text-sm font-medium',
                          restarts > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'
                        )}>
                          {restarts}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {metrics ? formatCPU(metrics.cpuUsage) : '-'}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {metrics ? formatBytes(metrics.memoryUsage) : '-'}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {pod.spec.nodeName || 'N/A'}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {formatAge(pod.metadata.creationTimestamp)}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleShellClick(pod, e)}
                            className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="Open Shell"
                          >
                            <CommandLineIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </button>
                          <button
                            onClick={(e) => handleLogsClick(pod, e)}
                            className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                            title="View Logs"
                          >
                            <DocumentTextIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </button>
                          <button
                            onClick={(e) => handleEditClick(pod, e)}
                            className="p-1.5 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded transition-colors"
                            title="Edit Pod"
                          >
                            <PencilSquareIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(pod, e)}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Delete Pod"
                          >
                            <TrashIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={goToPage}
          onPageSizeChange={changePageSize}
          onNextPage={goToNextPage}
          onPreviousPage={goToPreviousPage}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
        />
      </div>

      {/* Pod Details Modal */}
      <PodDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false)
          setSelectedPod(null)
        }}
        pod={selectedPod}
        clusterName={selectedPod?.clusterName || ''}
      />

      {/* Pod Shell Modal */}
      <PodShellModal
        isOpen={isShellModalOpen}
        onClose={() => {
          setIsShellModalOpen(false)
          setSelectedPod(null)
        }}
        pod={selectedPod}
        clusterName={selectedPod?.clusterName || ''}
      />

      {/* Pod Logs Modal */}
      <PodLogsModal
        isOpen={isLogsModalOpen}
        onClose={() => {
          setIsLogsModalOpen(false)
          setSelectedPod(null)
        }}
        pod={selectedPod}
        clusterName={selectedPod?.clusterName || ''}
      />

      {/* Edit Pod Modal */}
      <EditPodModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedPod(null)
        }}
        pod={selectedPod}
        clusterName={selectedPod?.clusterName || ''}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['pods'] })
          queryClient.invalidateQueries({ queryKey: ['all-pods'] })
        }}
      />

      {/* Delete Pod Modal */}
      <DeletePodModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setSelectedPod(null)
        }}
        pod={selectedPod}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  )
}

