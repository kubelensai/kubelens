import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getDaemonSets } from '@/services/api'
import { useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import { PencilSquareIcon, TrashIcon, ArrowPathIcon, InformationCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import DaemonSetDetailsModal from '@/components/DaemonSets/DaemonSetDetailsModal'
import DaemonSetPodsModal from '@/components/DaemonSets/DaemonSetPodsModal'
import EditDaemonSetModal from '@/components/DaemonSets/EditDaemonSetModal'
import RestartDaemonSetModal from '@/components/DaemonSets/RestartDaemonSetModal'
import DeleteDaemonSetModal from '@/components/DaemonSets/DeleteDaemonSetModal'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

export default function DaemonSets() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()

  const queryClient = useQueryClient()
  const [selectedDaemonSet, setSelectedDaemonSet] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isPodsModalOpen, setIsPodsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isRestartModalOpen, setIsRestartModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [filterText, setFilterText] = useState('')

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    namespace: 150,
    status: 100,
    desired: 100,
    current: 100,
    ready: 100,
    strategy: 150,
    age: 120,
    actions: 180,
  }, 'daemonsets-column-widths')

  // Reset state when cluster or namespace changes
  useEffect(() => {
    setSelectedDaemonSet(null)
    setIsDetailsModalOpen(false)
    setIsPodsModalOpen(false)
    setIsEditModalOpen(false)
    setIsRestartModalOpen(false)
    setIsDeleteModalOpen(false)
  }, [cluster, namespace])
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch daemonsets from all clusters or specific cluster/namespace
  const daemonsetQueries = useQuery({
    queryKey: namespace 
      ? ['daemonsets', cluster, namespace]
      : cluster 
        ? ['daemonsets', cluster] 
        : ['all-daemonsets', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const daemonsets = await getDaemonSets(cluster, namespace)
        return daemonsets.map((daemonset: any) => ({ ...daemonset, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const daemonsets = await getDaemonSets(cluster)
        return daemonsets.map((daemonset: any) => ({ ...daemonset, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allDaemonSets = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const daemonsets = await getDaemonSets(cluster.name)
            return daemonsets.map((daemonset: any) => ({ ...daemonset, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching daemonsets from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allDaemonSets.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchOnMount: true,
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchInterval: 5000, // Auto-refresh every 5 seconds to show live status updates
    staleTime: 0, // Data is immediately stale, always fetch fresh
  })

  const isLoading = daemonsetQueries.isLoading
  const allDaemonSets = daemonsetQueries.data || []

  // Filter daemonsets by name
  const filteredDaemonSets = useMemo(() => {
    if (!filterText) return allDaemonSets
    const lowerFilter = filterText.toLowerCase()
    return allDaemonSets.filter((daemonset: any) =>
      daemonset.metadata?.name?.toLowerCase().includes(lowerFilter)
    )
  }, [allDaemonSets, filterText])

  // Apply sorting
  const { sortedData: sortedDaemonSets, sortConfig, requestSort } = useTableSort(filteredDaemonSets, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: daemonsets,
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
  } = usePagination(sortedDaemonSets, 10, 'daemonsets')

  // Helper function to determine daemonset status
  const getDaemonSetStatus = (daemonset: any) => {
    const desired = daemonset.status.desiredNumberScheduled || 0
    const current = daemonset.status.currentNumberScheduled || 0
    const ready = daemonset.status.numberReady || 0
    const available = daemonset.status.numberAvailable || 0
    const updated = daemonset.status.updatedNumberScheduled || 0

    // Unavailable: No ready pods when nodes exist
    if (ready === 0 && desired > 0) {
      return { status: 'unavailable', color: 'badge-error' }
    }

    // Updating: not all nodes have updated pods
    if (updated < desired) {
      return { status: 'updating', color: 'badge-warning' }
    }

    // Running: all scheduled pods are ready and available
    if (ready === desired && available === desired && current === desired) {
      return { status: 'running', color: 'badge-success' }
    }

    // Pending: has desired schedule but not all current or ready
    if (current < desired || ready < desired) {
      return { status: 'pending', color: 'badge-warning' }
    }

    return { status: 'pending', color: 'badge-warning' }
  }

  const handleDaemonSetClick = (daemonset: any) => {
    setSelectedDaemonSet(daemonset)
    setIsPodsModalOpen(true)
  }

  const handleEditClick = (daemonset: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDaemonSet(daemonset)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (daemonset: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDaemonSet(daemonset)
    setIsDeleteModalOpen(true)
  }

  const handleViewDetailsClick = (daemonset: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDaemonSet(daemonset)
    setIsDetailsModalOpen(true)
  }

  const handleRestartClick = (daemonset: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDaemonSet(daemonset)
    setIsRestartModalOpen(true)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Breadcrumb 
              items={
                cluster
                  ? [
                      { name: cluster, href: `/clusters/${cluster}/overview` },
                      { name: 'DaemonSets' }
                    ]
                  : [{ name: 'DaemonSets' }]
              }
        />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">DaemonSets</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            {namespace 
              ? `DaemonSets in ${cluster} / ${namespace}`
              : cluster 
                ? `All daemonsets in ${cluster}`
                : `All daemonsets across ${clusters?.length || 0} cluster(s)`
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
                  label="Status"
                  columnKey="status"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.status}
                />
                <ResizableTableHeader
                  label="Desired"
                  columnKey="desired"
                  sortKey="status.desiredNumberScheduled"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.desired}
                />
                <ResizableTableHeader
                  label="Current"
                  columnKey="current"
                  sortKey="status.currentNumberScheduled"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.current}
                />
                <ResizableTableHeader
                  label="Ready"
                  columnKey="ready"
                  sortKey="status.numberReady"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.ready}
                />
                <ResizableTableHeader
                  label="Strategy"
                  columnKey="strategy"
                  sortKey="spec.updateStrategy.type"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.strategy}
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
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading daemonsets...</span>
                    </div>
                  </td>
                </tr>
              ) : daemonsets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No daemonsets found</p>
                  </td>
                </tr>
              ) : (
                daemonsets.map((daemonset) => {
                  const daemonsetKey = `${daemonset.clusterName}-${daemonset.metadata.namespace}-${daemonset.metadata.name}`
                  const daemonsetStatus = getDaemonSetStatus(daemonset)
                  
                  return (
                    <tr 
                      key={daemonsetKey} 
                      onClick={() => handleDaemonSetClick(daemonset)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    >
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        <div className="truncate max-w-[150px] sm:max-w-none">
                          {daemonset.metadata.name}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {daemonset.metadata.namespace}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                        <span className={clsx('badge text-xs capitalize', daemonsetStatus.color)}>
                          {daemonsetStatus.status}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {daemonset.status.desiredNumberScheduled || 0}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {daemonset.status.currentNumberScheduled || 0}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {daemonset.status.numberReady || 0}/{daemonset.status.desiredNumberScheduled || 0}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {daemonset.spec.updateStrategy?.type || 'RollingUpdate'}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {formatAge(daemonset.metadata.creationTimestamp)}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleRestartClick(daemonset, e)}
                            className="p-1.5 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                            title="Restart daemonset"
                          >
                            <ArrowPathIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleViewDetailsClick(daemonset, e)}
                            className="p-1.5 text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                            title="View details"
                          >
                            <InformationCircleIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleEditClick(daemonset, e)}
                            className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                            title="Edit daemonset"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(daemonset, e)}
                            className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete daemonset"
                          >
                            <TrashIcon className="h-4 w-4" />
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

      {/* Modals */}
      {selectedDaemonSet && (
        <>
          <DaemonSetDetailsModal
            daemonset={selectedDaemonSet}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedDaemonSet(null)
            }}
          />
          <DaemonSetPodsModal
            daemonset={selectedDaemonSet}
            isOpen={isPodsModalOpen}
            onClose={() => {
              setIsPodsModalOpen(false)
              setSelectedDaemonSet(null)
            }}
          />
          <EditDaemonSetModal
            daemonset={selectedDaemonSet}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedDaemonSet(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['daemonsets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-daemonsets'] })
              await queryClient.refetchQueries({ queryKey: ['daemonsets'] })
              await queryClient.refetchQueries({ queryKey: ['all-daemonsets'] })
              setIsEditModalOpen(false)
              setSelectedDaemonSet(null)
            }}
          />
          <RestartDaemonSetModal
            daemonset={selectedDaemonSet}
            isOpen={isRestartModalOpen}
            onClose={() => {
              setIsRestartModalOpen(false)
              setSelectedDaemonSet(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['daemonsets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-daemonsets'] })
              await queryClient.refetchQueries({ queryKey: ['daemonsets'] })
              await queryClient.refetchQueries({ queryKey: ['all-daemonsets'] })
              setIsRestartModalOpen(false)
              setSelectedDaemonSet(null)
            }}
          />
          <DeleteDaemonSetModal
            daemonset={selectedDaemonSet}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedDaemonSet(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['daemonsets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-daemonsets'] })
              await queryClient.refetchQueries({ queryKey: ['daemonsets'] })
              await queryClient.refetchQueries({ queryKey: ['all-daemonsets'] })
              setIsDeleteModalOpen(false)
              setSelectedDaemonSet(null)
            }}
          />
        </>
      )}
    </div>
  )
}

