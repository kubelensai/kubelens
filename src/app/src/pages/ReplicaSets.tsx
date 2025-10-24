import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getReplicaSets } from '@/services/api'
import { useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import { ArrowsUpDownIcon, PencilSquareIcon, TrashIcon, InformationCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ReplicaSetDetailsModal from '@/components/ReplicaSets/ReplicaSetDetailsModal'
import ReplicaSetPodsModal from '@/components/ReplicaSets/ReplicaSetPodsModal'
import ScaleReplicaSetModal from '@/components/ReplicaSets/ScaleReplicaSetModal'
import EditReplicaSetModal from '@/components/ReplicaSets/EditReplicaSetModal'
import DeleteReplicaSetModal from '@/components/ReplicaSets/DeleteReplicaSetModal'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'

import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

export default function ReplicaSets() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()

  const queryClient = useQueryClient()
  const [selectedReplicaSet, setSelectedReplicaSet] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isPodsModalOpen, setIsPodsModalOpen] = useState(false)
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [filterText, setFilterText] = useState('')

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    namespace: 150,
    desired: 100,
    current: 100,
    ready: 100,
    owner: 200,
    age: 120,
    actions: 180,
  }, 'replicasets-column-widths')

  // Reset state when cluster or namespace changes
  useEffect(() => {
    setSelectedReplicaSet(null)
    setIsDetailsModalOpen(false)
    setIsPodsModalOpen(false)
    setIsScaleModalOpen(false)
    setIsEditModalOpen(false)
    setIsDeleteModalOpen(false)
  }, [cluster, namespace])
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch replicasets from all clusters or specific cluster/namespace
  const replicasetQueries = useQuery({
    queryKey: namespace 
      ? ['replicasets', cluster, namespace]
      : cluster 
        ? ['replicasets', cluster] 
        : ['all-replicasets', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const replicasets = await getReplicaSets(cluster, namespace)
        return replicasets.map((replicaset: any) => ({ ...replicaset, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const replicasets = await getReplicaSets(cluster)
        return replicasets.map((replicaset: any) => ({ ...replicaset, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allReplicaSets = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const replicasets = await getReplicaSets(cluster.name)
            return replicasets.map((replicaset: any) => ({ ...replicaset, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching replicasets from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allReplicaSets.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchOnMount: true,
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchInterval: 5000, // Auto-refresh every 5 seconds to show live status updates
    staleTime: 0, // Data is immediately stale, always fetch fresh
  })

  const isLoading = replicasetQueries.isLoading
  const allReplicaSets = replicasetQueries.data || []

  // Filter replicasets by name
  const filteredReplicaSets = useMemo(() => {
    if (!filterText) return allReplicaSets
    const lowerFilter = filterText.toLowerCase()
    return allReplicaSets.filter((replicaset: any) =>
      replicaset.metadata?.name?.toLowerCase().includes(lowerFilter)
    )
  }, [allReplicaSets, filterText])

  // Apply sorting
  const { sortedData: sortedReplicaSets, sortConfig, requestSort } = useTableSort(filteredReplicaSets, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: replicasets,
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
  } = usePagination(sortedReplicaSets, 10, 'replicasets')

  // Helper function to determine replicaset status
  const getReplicaSetStatus = (replicaset: any) => {
    const desired = replicaset.spec.replicas || 0
    const current = replicaset.status.replicas || 0
    const ready = replicaset.status.readyReplicas || 0
    const available = replicaset.status.availableReplicas || 0

    // Running: all replicas are ready and available
    if (ready === desired && available === desired && current === desired) {
      return { status: 'ready', color: 'badge-success' }
    }

    // Unavailable: No ready pods when replicas are desired
    if (ready === 0 && desired > 0) {
      return { status: 'not ready', color: 'badge-error' }
    }

    // Scaling: current replicas doesn't match desired
    if (current !== desired) {
      return { status: 'scaling', color: 'badge-warning' }
    }

    // Partially ready: has desired replicas but not all ready yet
    if (current === desired && ready < desired) {
      return { status: 'partial', color: 'badge-warning' }
    }

    return { status: 'scaling', color: 'badge-warning' }
  }


  const handleReplicaSetClick = (replicaset: any) => {
    setSelectedReplicaSet(replicaset)
    setIsPodsModalOpen(true)
  }

  const handleScaleClick = (replicaset: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedReplicaSet(replicaset)
    setIsScaleModalOpen(true)
  }

  const handleEditClick = (replicaset: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedReplicaSet(replicaset)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (replicaset: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedReplicaSet(replicaset)
    setIsDeleteModalOpen(true)
  }

  const handleViewDetailsClick = (replicaset: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedReplicaSet(replicaset)
    setIsDetailsModalOpen(true)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Breadcrumb 
              items={
                cluster
                  ? [
                      { name: cluster, href: "/dashboard" },
                      { name: 'ReplicaSets' }
                    ]
                  : [{ name: 'ReplicaSets' }]
              }
        />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">ReplicaSets</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            {namespace 
              ? `ReplicaSets in ${cluster} / ${namespace}`
              : cluster 
                ? `All replicasets in ${cluster}`
                : `All replicasets across ${clusters?.length || 0} cluster(s)`
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
                  sortKey="spec.replicas"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.desired}
                />
                <ResizableTableHeader
                  label="Current"
                  columnKey="current"
                  sortKey="status.replicas"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.current}
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
                  label="Owner"
                  columnKey="owner"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.owner}
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
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading replica sets...</span>
                    </div>
                  </td>
                </tr>
              ) : replicasets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No replica sets found</p>
                  </td>
                </tr>
              ) : (
                replicasets.map((replicaset) => {
                  const replicasetKey = `${replicaset.clusterName}-${replicaset.metadata.namespace}-${replicaset.metadata.name}`
                  const replicasetStatus = getReplicaSetStatus(replicaset)
                  
                  return (
                    <tr 
                      key={replicasetKey} 
                      onClick={() => handleReplicaSetClick(replicaset)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    >
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        <div className="truncate max-w-[150px] sm:max-w-none">
                          {replicaset.metadata.name}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {replicaset.metadata.namespace}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                        <span className={clsx('badge text-xs capitalize', replicasetStatus.color)}>
                          {replicasetStatus.status}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {replicaset.spec.replicas || 0}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {replicaset.status.replicas || 0}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {replicaset.status.readyReplicas || 0}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {replicaset.metadata.ownerReferences?.[0]?.kind || '-'} / {replicaset.metadata.ownerReferences?.[0]?.name || '-'}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {formatAge(replicaset.metadata.creationTimestamp)}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleScaleClick(replicaset, e)}
                            className="p-1.5 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Scale replicaset"
                          >
                            <ArrowsUpDownIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleViewDetailsClick(replicaset, e)}
                            className="p-1.5 text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                            title="View details"
                          >
                            <InformationCircleIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleEditClick(replicaset, e)}
                            className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                            title="Edit replicaset"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(replicaset, e)}
                            className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete replicaset"
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
      {selectedReplicaSet && (
        <>
          <ReplicaSetDetailsModal
            replicaset={selectedReplicaSet}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedReplicaSet(null)
            }}
          />
          <ReplicaSetPodsModal
            replicaset={selectedReplicaSet}
            isOpen={isPodsModalOpen}
            onClose={() => {
              setIsPodsModalOpen(false)
              setSelectedReplicaSet(null)
            }}
          />
          <ScaleReplicaSetModal
            replicaset={selectedReplicaSet}
            isOpen={isScaleModalOpen}
            onClose={() => {
              setIsScaleModalOpen(false)
              setSelectedReplicaSet(null)
            }}
            onSuccess={async () => {
              // Invalidate and immediately refetch all replicaset queries
              await queryClient.invalidateQueries({ queryKey: ['replicasets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-replicasets'] })
              await queryClient.refetchQueries({ queryKey: ['replicasets'] })
              await queryClient.refetchQueries({ queryKey: ['all-replicasets'] })
              setIsScaleModalOpen(false)
              setSelectedReplicaSet(null)
            }}
          />
          <EditReplicaSetModal
            replicaset={selectedReplicaSet}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedReplicaSet(null)
            }}
            onSuccess={async () => {
              // Invalidate and immediately refetch all replicaset queries
              await queryClient.invalidateQueries({ queryKey: ['replicasets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-replicasets'] })
              await queryClient.refetchQueries({ queryKey: ['replicasets'] })
              await queryClient.refetchQueries({ queryKey: ['all-replicasets'] })
              setIsEditModalOpen(false)
              setSelectedReplicaSet(null)
            }}
          />
          <DeleteReplicaSetModal
            replicaset={selectedReplicaSet}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedReplicaSet(null)
            }}
            onSuccess={async () => {
              console.log('Delete onSuccess called, refetching replicasets...')
              // Invalidate and immediately refetch all replicaset queries
              await queryClient.invalidateQueries({ queryKey: ['replicasets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-replicasets'] })
              await queryClient.refetchQueries({ queryKey: ['replicasets'] })
              await queryClient.refetchQueries({ queryKey: ['all-replicasets'] })
              console.log('ReplicaSets refetched successfully')
              setIsDeleteModalOpen(false)
              setSelectedReplicaSet(null)
            }}
          />
        </>
      )}
    </div>
  )
}

