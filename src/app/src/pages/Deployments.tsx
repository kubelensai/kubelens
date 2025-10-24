import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getDeployments } from '@/services/api'
import { useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import { ArrowsUpDownIcon, PencilSquareIcon, TrashIcon, ArrowPathIcon, InformationCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import DeploymentDetailsModal from '@/components/Deployments/DeploymentDetailsModal'
import DeploymentPodsModal from '@/components/Deployments/DeploymentPodsModal'
import ScaleDeploymentModal from '@/components/Deployments/ScaleDeploymentModal'
import EditDeploymentModal from '@/components/Deployments/EditDeploymentModal'
import RestartDeploymentModal from '@/components/Deployments/RestartDeploymentModal'
import DeleteDeploymentModal from '@/components/Deployments/DeleteDeploymentModal'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'

import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

export default function Deployments() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()

  const queryClient = useQueryClient()
  const [selectedDeployment, setSelectedDeployment] = useState<any>(null)
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
    pods: 100,
    strategy: 150,
    age: 120,
    actions: 220,
  }, 'deployments-column-widths')

  // Reset state when cluster or namespace changes
  useEffect(() => {
    setSelectedDeployment(null)
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

  // Fetch deployments from all clusters or specific cluster/namespace
  const deploymentQueries = useQuery({
    queryKey: namespace 
      ? ['deployments', cluster, namespace]
      : cluster 
        ? ['deployments', cluster] 
        : ['all-deployments', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const deployments = await getDeployments(cluster, namespace)
        return deployments.map((deployment: any) => ({ ...deployment, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const deployments = await getDeployments(cluster)
        return deployments.map((deployment: any) => ({ ...deployment, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allDeployments = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const deployments = await getDeployments(cluster.name)
            return deployments.map((deployment: any) => ({ ...deployment, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching deployments from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allDeployments.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchOnMount: true,
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchInterval: 5000, // Auto-refresh every 5 seconds to show live status updates
    staleTime: 0, // Data is immediately stale, always fetch fresh
  })

  const isLoading = deploymentQueries.isLoading
  const allDeployments = deploymentQueries.data || []

  // Filter deployments by name
  const filteredDeployments = useMemo(() => {
    if (!filterText) return allDeployments
    const lowerFilter = filterText.toLowerCase()
    return allDeployments.filter((deployment: any) =>
      deployment.metadata?.name?.toLowerCase().includes(lowerFilter)
    )
  }, [allDeployments, filterText])

  // Apply sorting
  const { sortedData: sortedDeployments, sortConfig, requestSort } = useTableSort(filteredDeployments, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: deployments,
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
  } = usePagination(sortedDeployments, 10, 'deployments')

  // Helper function to determine deployment status
  const getDeploymentStatus = (deployment: any) => {
    const desired = deployment.spec.replicas || 0
    const current = deployment.status.replicas || 0
    const ready = deployment.status.readyReplicas || 0
    const available = deployment.status.availableReplicas || 0
    const updated = deployment.status.updatedReplicas || 0

    // Check conditions
    const conditions = deployment.status.conditions || []
    const progressingCondition = conditions.find((c: any) => c.type === 'Progressing')
    
    // Stalled: Progress deadline exceeded
    if (progressingCondition && progressingCondition.status === 'False' && progressingCondition.reason === 'ProgressDeadlineExceeded') {
      return { status: 'stalled', color: 'badge-error' }
    }

    // Unavailable: No ready pods when replicas are desired
    if (ready === 0 && desired > 0) {
      return { status: 'unavailable', color: 'badge-error' }
    }

    // Scaling: current replicas doesn't match desired
    if (current !== desired) {
      return { status: 'scaling', color: 'badge-warning' }
    }

    // Scaling: actively progressing (e.g., during restart/rollout)
    // This happens when Progressing condition is True, meaning deployment is actively updating
    if (progressingCondition && progressingCondition.status === 'True' && progressingCondition.reason === 'ReplicaSetUpdated') {
      return { status: 'scaling', color: 'badge-warning' }
    }

    // Scaling: not all replicas are updated yet (during rollout)
    if (updated < desired) {
      return { status: 'scaling', color: 'badge-warning' }
    }

    // Running: all replicas are ready and available
    if (ready === desired && available === desired && updated === desired) {
      return { status: 'running', color: 'badge-success' }
    }

    // Scaling: has desired replicas but not all ready yet (could be progressing or waiting)
    // If we're here and still have pods not ready, check if actively progressing
    if (current === desired && ready < desired) {
      // If actively progressing, show as scaling
      if (progressingCondition && progressingCondition.status === 'True') {
        return { status: 'scaling', color: 'badge-warning' }
      }
      // Otherwise, it's stalled
      return { status: 'stalled', color: 'badge-error' }
    }

    return { status: 'scaling', color: 'badge-warning' }
  }


  const handleDeploymentClick = (deployment: any) => {
    setSelectedDeployment(deployment)
    setIsPodsModalOpen(true)
  }

  const handleScaleClick = (deployment: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDeployment(deployment)
    setIsScaleModalOpen(true)
  }

  const handleEditClick = (deployment: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDeployment(deployment)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (deployment: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDeployment(deployment)
    setIsDeleteModalOpen(true)
  }

  const handleViewDetailsClick = (deployment: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDeployment(deployment)
    setIsDetailsModalOpen(true)
  }

  const handleRestartClick = (deployment: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDeployment(deployment)
    setIsRestartModalOpen(true)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Breadcrumb 
              items={
                cluster
                  ? [
                      { name: cluster, href: "/dashboard" },
                      { name: 'Deployments' }
                    ]
                  : [{ name: 'Deployments' }]
              }
        />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Deployments</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            {namespace 
              ? `Deployments in ${cluster} / ${namespace}`
              : cluster 
                ? `All deployments in ${cluster}`
                : `All deployments across ${clusters?.length || 0} cluster(s)`
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
                  sortKey="status.replicas"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.replicas}
                />
                <ResizableTableHeader
                  label="Pods"
                  columnKey="pods"
                  sortKey="status.readyReplicas"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.pods}
                />
                <ResizableTableHeader
                  label="Strategy"
                  columnKey="strategy"
                  sortKey="spec.strategy.type"
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
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading deployments...</span>
                    </div>
                  </td>
                </tr>
              ) : deployments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No deployments found</p>
                  </td>
                </tr>
              ) : (
                deployments.map((deployment) => {
                  const deploymentKey = `${deployment.clusterName}-${deployment.metadata.namespace}-${deployment.metadata.name}`
                  const deploymentStatus = getDeploymentStatus(deployment)
                  
                  return (
                    <tr 
                      key={deploymentKey} 
                      onClick={() => handleDeploymentClick(deployment)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    >
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        <div className="truncate max-w-[150px] sm:max-w-none">
                          {deployment.metadata.name}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {deployment.metadata.namespace}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                        <span className={clsx('badge text-xs capitalize', deploymentStatus.color)}>
                          {deploymentStatus.status}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {deployment.status.replicas || 0}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {deployment.status.readyReplicas || 0}/{deployment.status.replicas || 0}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {deployment.spec.strategy?.type || 'RollingUpdate'}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {formatAge(deployment.metadata.creationTimestamp)}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleScaleClick(deployment, e)}
                            className="p-1.5 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Scale deployment"
                          >
                            <ArrowsUpDownIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleRestartClick(deployment, e)}
                            className="p-1.5 text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                            title="Restart deployment"
                          >
                            <ArrowPathIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleViewDetailsClick(deployment, e)}
                            className="p-1.5 text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                            title="View details"
                          >
                            <InformationCircleIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleEditClick(deployment, e)}
                            className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                            title="Edit deployment"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(deployment, e)}
                            className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete deployment"
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
      {selectedDeployment && (
        <>
          <DeploymentDetailsModal
            deployment={selectedDeployment}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedDeployment(null)
            }}
          />
          <DeploymentPodsModal
            deployment={selectedDeployment}
            isOpen={isPodsModalOpen}
            onClose={() => {
              setIsPodsModalOpen(false)
              setSelectedDeployment(null)
            }}
          />
          <ScaleDeploymentModal
            deployment={selectedDeployment}
            isOpen={isScaleModalOpen}
            onClose={() => {
              setIsScaleModalOpen(false)
              setSelectedDeployment(null)
            }}
            onSuccess={async () => {
              // Invalidate and immediately refetch all deployment queries
              await queryClient.invalidateQueries({ queryKey: ['deployments'] })
              await queryClient.invalidateQueries({ queryKey: ['all-deployments'] })
              await queryClient.refetchQueries({ queryKey: ['deployments'] })
              await queryClient.refetchQueries({ queryKey: ['all-deployments'] })
              setIsScaleModalOpen(false)
              setSelectedDeployment(null)
            }}
          />
          <EditDeploymentModal
            deployment={selectedDeployment}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedDeployment(null)
            }}
            onSuccess={async () => {
              // Invalidate and immediately refetch all deployment queries
              await queryClient.invalidateQueries({ queryKey: ['deployments'] })
              await queryClient.invalidateQueries({ queryKey: ['all-deployments'] })
              await queryClient.refetchQueries({ queryKey: ['deployments'] })
              await queryClient.refetchQueries({ queryKey: ['all-deployments'] })
              setIsEditModalOpen(false)
              setSelectedDeployment(null)
            }}
          />
          <RestartDeploymentModal
            deployment={selectedDeployment}
            isOpen={isRestartModalOpen}
            onClose={() => {
              setIsRestartModalOpen(false)
              setSelectedDeployment(null)
            }}
            onSuccess={async () => {
              // Invalidate and immediately refetch all deployment queries
              await queryClient.invalidateQueries({ queryKey: ['deployments'] })
              await queryClient.invalidateQueries({ queryKey: ['all-deployments'] })
              await queryClient.refetchQueries({ queryKey: ['deployments'] })
              await queryClient.refetchQueries({ queryKey: ['all-deployments'] })
              setIsRestartModalOpen(false)
              setSelectedDeployment(null)
            }}
          />
          <DeleteDeploymentModal
            deployment={selectedDeployment}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedDeployment(null)
            }}
            onSuccess={async () => {
              console.log('Delete onSuccess called, refetching deployments...')
              // Invalidate and immediately refetch all deployment queries
              await queryClient.invalidateQueries({ queryKey: ['deployments'] })
              await queryClient.invalidateQueries({ queryKey: ['all-deployments'] })
              await queryClient.refetchQueries({ queryKey: ['deployments'] })
              await queryClient.refetchQueries({ queryKey: ['all-deployments'] })
              console.log('Deployments refetched successfully')
              setIsDeleteModalOpen(false)
              setSelectedDeployment(null)
            }}
          />
        </>
      )}
    </div>
  )
}

