import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getStatefulSets } from '@/services/api'
import { useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import { ArrowsUpDownIcon, PencilSquareIcon, TrashIcon, ArrowPathIcon, InformationCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import StatefulSetDetailsModal from '@/components/StatefulSets/StatefulSetDetailsModal'
import StatefulSetPodsModal from '@/components/StatefulSets/StatefulSetPodsModal'
import ScaleStatefulSetModal from '@/components/StatefulSets/ScaleStatefulSetModal'
import EditStatefulSetModal from '@/components/StatefulSets/EditStatefulSetModal'
import RestartStatefulSetModal from '@/components/StatefulSets/RestartStatefulSetModal'
import DeleteStatefulSetModal from '@/components/StatefulSets/DeleteStatefulSetModal'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

export default function StatefulSets() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const queryClient = useQueryClient()
  const [selectedStatefulSet, setSelectedStatefulSet] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isPodsModalOpen, setIsPodsModalOpen] = useState(false)
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isRestartModalOpen, setIsRestartModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [filterText, setFilterText] = useState('')

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    namespace: 150,
    status: 100,
    replicas: 100,
    ready: 100,
    updateStrategy: 150,
    age: 120,
    actions: 220,
  }, 'statefulsets-column-widths')

  // Reset state when cluster or namespace changes
  useEffect(() => {
    setSelectedStatefulSet(null)
    setIsDetailsModalOpen(false)
    setIsPodsModalOpen(false)
    setIsScaleModalOpen(false)
    setIsEditModalOpen(false)
    setIsRestartModalOpen(false)
    setIsDeleteModalOpen(false)
  }, [cluster, namespace])
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch statefulsets from all clusters or specific cluster/namespace
  const statefulsetQueries = useQuery({
    queryKey: namespace 
      ? ['statefulsets', cluster, namespace]
      : cluster 
        ? ['statefulsets', cluster] 
        : ['all-statefulsets', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const statefulsets = await getStatefulSets(cluster, namespace)
        return statefulsets.map((statefulset: any) => ({ ...statefulset, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const statefulsets = await getStatefulSets(cluster)
        return statefulsets.map((statefulset: any) => ({ ...statefulset, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allStatefulSets = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const statefulsets = await getStatefulSets(cluster.name)
            return statefulsets.map((statefulset: any) => ({ ...statefulset, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching statefulsets from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allStatefulSets.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
    staleTime: 0,
  })

  const isLoading = statefulsetQueries.isLoading
  const allStatefulSets = statefulsetQueries.data || []

  // Filter statefulsets by name
  const filteredStatefulSets = useMemo(() => {
    if (!filterText) return allStatefulSets
    const lowerFilter = filterText.toLowerCase()
    return allStatefulSets.filter((statefulset: any) =>
      statefulset.metadata?.name?.toLowerCase().includes(lowerFilter)
    )
  }, [allStatefulSets, filterText])

  // Apply sorting
  const { sortedData: sortedStatefulSets, sortConfig, requestSort } = useTableSort(filteredStatefulSets, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: statefulsets,
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
  } = usePagination(sortedStatefulSets, 10, 'statefulsets')

  // Helper function to determine statefulset status
  const getStatefulSetStatus = (statefulset: any) => {
    const desired = statefulset.spec.replicas || 0
    const current = statefulset.status.currentReplicas || 0
    const ready = statefulset.status.readyReplicas || 0
    const updated = statefulset.status.updatedReplicas || 0

    // Running: all replicas are ready and updated
    if (ready === desired && updated === desired && current === desired) {
      return { status: 'running', color: 'badge-success' }
    }

    // Unavailable: No ready pods when replicas are desired
    if (ready === 0 && desired > 0) {
      return { status: 'unavailable', color: 'badge-error' }
    }

    // Scaling: current replicas doesn't match desired
    if (current !== desired) {
      return { status: 'scaling', color: 'badge-warning' }
    }

    // Updating: not all replicas are updated yet
    if (updated < desired) {
      return { status: 'updating', color: 'badge-warning' }
    }

    // Degraded: has desired replicas but not all ready yet
    if (current === desired && ready < desired) {
      return { status: 'degraded', color: 'badge-error' }
    }

    return { status: 'updating', color: 'badge-warning' }
  }

  const handleStatefulSetClick = (statefulset: any) => {
    setSelectedStatefulSet(statefulset)
    setIsPodsModalOpen(true)
  }

  const handleScaleClick = (statefulset: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedStatefulSet(statefulset)
    setIsScaleModalOpen(true)
  }

  const handleEditClick = (statefulset: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedStatefulSet(statefulset)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (statefulset: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedStatefulSet(statefulset)
    setIsDeleteModalOpen(true)
  }

  const handleViewDetailsClick = (statefulset: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedStatefulSet(statefulset)
    setIsDetailsModalOpen(true)
  }

  const handleRestartClick = (statefulset: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedStatefulSet(statefulset)
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
                      { name: 'StatefulSets' }
                    ]
                  : [{ name: 'StatefulSets' }]
              }
        />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">StatefulSets</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            {namespace 
              ? `StatefulSets in ${cluster} / ${namespace}`
              : cluster 
                ? `All statefulsets in ${cluster}`
                : `All statefulsets across ${clusters?.length || 0} cluster(s)`
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
                  label="Replicas"
                  columnKey="replicas"
                  sortKey="status.currentReplicas"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.replicas}
                />
                <ResizableTableHeader
                  label="Ready"
                  columnKey="ready"
                  sortKey="status.readyReplicas"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.ready}
                />
                <ResizableTableHeader
                  label="Update Strategy"
                  columnKey="updateStrategy"
                  sortKey="spec.updateStrategy.type"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.updateStrategy}
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
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading stateful sets...</span>
                    </div>
                  </td>
                </tr>
              ) : statefulsets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No stateful sets found</p>
                  </td>
                </tr>
              ) : (
                statefulsets.map((statefulset) => {
                  const statefulsetKey = `${statefulset.clusterName}-${statefulset.metadata.namespace}-${statefulset.metadata.name}`
                  const statefulsetStatus = getStatefulSetStatus(statefulset)
                  
                  return (
                    <tr 
                      key={statefulsetKey} 
                      onClick={() => handleStatefulSetClick(statefulset)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    >
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        <div className="truncate max-w-[150px] sm:max-w-none">
                          {statefulset.metadata.name}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {statefulset.metadata.namespace}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                        <span className={clsx('badge text-xs capitalize', statefulsetStatus.color)}>
                          {statefulsetStatus.status}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {statefulset.status.currentReplicas || 0}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {statefulset.status.readyReplicas || 0}/{statefulset.spec.replicas || 0}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {statefulset.spec.updateStrategy?.type || 'RollingUpdate'}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {formatAge(statefulset.metadata.creationTimestamp)}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleScaleClick(statefulset, e)}
                            className="p-1.5 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Scale statefulset"
                          >
                            <ArrowsUpDownIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleRestartClick(statefulset, e)}
                            className="p-1.5 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                            title="Restart statefulset"
                          >
                            <ArrowPathIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleViewDetailsClick(statefulset, e)}
                            className="p-1.5 text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                            title="View details"
                          >
                            <InformationCircleIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleEditClick(statefulset, e)}
                            className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                            title="Edit statefulset"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(statefulset, e)}
                            className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete statefulset"
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
      {selectedStatefulSet && (
        <>
          <StatefulSetDetailsModal
            statefulset={selectedStatefulSet}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedStatefulSet(null)
            }}
          />
          <StatefulSetPodsModal
            statefulset={selectedStatefulSet}
            isOpen={isPodsModalOpen}
            onClose={() => {
              setIsPodsModalOpen(false)
              setSelectedStatefulSet(null)
            }}
          />
          <ScaleStatefulSetModal
            statefulset={selectedStatefulSet}
            isOpen={isScaleModalOpen}
            onClose={() => {
              setIsScaleModalOpen(false)
              setSelectedStatefulSet(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['statefulsets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-statefulsets'] })
              await queryClient.refetchQueries({ queryKey: ['statefulsets'] })
              await queryClient.refetchQueries({ queryKey: ['all-statefulsets'] })
              setIsScaleModalOpen(false)
              setSelectedStatefulSet(null)
            }}
          />
          <EditStatefulSetModal
            statefulset={selectedStatefulSet}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedStatefulSet(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['statefulsets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-statefulsets'] })
              await queryClient.refetchQueries({ queryKey: ['statefulsets'] })
              await queryClient.refetchQueries({ queryKey: ['all-statefulsets'] })
              setIsEditModalOpen(false)
              setSelectedStatefulSet(null)
            }}
          />
          <RestartStatefulSetModal
            statefulset={selectedStatefulSet}
            isOpen={isRestartModalOpen}
            onClose={() => {
              setIsRestartModalOpen(false)
              setSelectedStatefulSet(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['statefulsets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-statefulsets'] })
              await queryClient.refetchQueries({ queryKey: ['statefulsets'] })
              await queryClient.refetchQueries({ queryKey: ['all-statefulsets'] })
              setIsRestartModalOpen(false)
              setSelectedStatefulSet(null)
            }}
          />
          <DeleteStatefulSetModal
            statefulset={selectedStatefulSet}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedStatefulSet(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['statefulsets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-statefulsets'] })
              await queryClient.refetchQueries({ queryKey: ['statefulsets'] })
              await queryClient.refetchQueries({ queryKey: ['all-statefulsets'] })
              setIsDeleteModalOpen(false)
              setSelectedStatefulSet(null)
            }}
          />
        </>
      )}
    </div>
  )
}
