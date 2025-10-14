import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getClusterRoles } from '@/services/api'
import { useMemo, useState, useEffect } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'

import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import ClusterRoleDetailsModal from '@/components/ClusterRoles/ClusterRoleDetailsModal'
import EditClusterRoleYAMLModal from '@/components/ClusterRoles/EditClusterRoleYAMLModal'
import DeleteClusterRoleModal from '@/components/ClusterRoles/DeleteClusterRoleModal'
import CreateClusterRoleModal from '@/components/ClusterRoles/CreateClusterRoleModal'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'
import { useClusterStore } from '@/stores/clusterStore'

export default function ClusterRoles() {
  const { cluster: clusterParam } = useParams<{ cluster?: string }>()
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')
  
  // Modal states
  const [selectedClusterRole, setSelectedClusterRole] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Global stores
  const { selectedCluster } = useClusterStore()

  // Reset modal states when cluster changes
  useEffect(() => {
    setIsDetailsModalOpen(false)
    setIsEditModalOpen(false)
    setIsDeleteModalOpen(false)
    setIsCreateModalOpen(false)
    setSelectedClusterRole(null)
  }, [clusterParam, selectedCluster])

  // Fetch clusters
  const { data: clusters = [] } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Determine active cluster
  const activeCluster = clusterParam || selectedCluster || clusters[0]?.name || 'default'

  // Fetch cluster roles for all clusters
  const clusterRoleQueries = clusters.map((cluster: any) => ({
    queryKey: ['clusterRoles', cluster.name],
    queryFn: () => getClusterRoles(cluster.name),
    enabled: clusters.length > 0,
    refetchInterval: 5000,
  }))

  const clusterRoleResults = useQueries({ queries: clusterRoleQueries })

  // Flatten and combine all cluster roles
  const allClusterRoles = useMemo(() => {
    return clusterRoleResults.flatMap(result => result.data || [])
  }, [clusterRoleResults])

  // Filter cluster roles by active cluster and filter text
  const filteredClusterRoles = useMemo(() => {
    return allClusterRoles.filter((cr: any) => {
      const cluster = cr.ClusterName || cr.metadata?.clusterName || ''
      const name = cr.metadata?.name || ''
      
      // Apply cluster filter
      if (!clusterParam && cluster !== activeCluster) return false
      if (clusterParam && cluster !== clusterParam) return false
      
      // Apply search filter
      if (!filterText) return true
      
      const searchText = filterText.toLowerCase()
      const rulesCount = (cr.rules || []).length.toString()
      
      // Search in labels
      const labelsMatch = cr.metadata?.labels 
        ? Object.entries(cr.metadata.labels).some(([key, value]) => 
            key.toLowerCase().includes(searchText) || 
            String(value).toLowerCase().includes(searchText)
          )
        : false
      
      // Search in annotations
      const annotationsMatch = cr.metadata?.annotations
        ? Object.entries(cr.metadata.annotations).some(([key, value]) =>
            key.toLowerCase().includes(searchText) || 
            String(value).toLowerCase().includes(searchText)
          )
        : false
      
      return (
        name.toLowerCase().includes(searchText) ||
        cluster.toLowerCase().includes(searchText) ||
        rulesCount.includes(searchText) ||
        labelsMatch ||
        annotationsMatch
      )
    })
  }, [allClusterRoles, activeCluster, filterText, clusterParam])

  const isLoading = clusterRoleResults.some(result => result.isLoading)

  // Sorting
  const { sortedData, sortConfig, requestSort } = useTableSort(filteredClusterRoles, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Pagination
  const { currentPage, pageSize, paginatedData, totalPages, goToPage, changePageSize, goToNextPage, goToPreviousPage, hasNextPage, hasPreviousPage, totalItems } = usePagination(
    sortedData,
    10,
    'clusterroles'
  )

  // Resizable columns
  const { columnWidths, handleMouseDown } = useResizableColumns({
    name: 30,
    cluster: 15,
    rules: 10,
    aggregated: 10,
    labels: 15,
    age: 10,
    actions: 10,
  }, 'clusterroles-column-widths')

  const handleRowClick = (clusterRole: any) => {
    setSelectedClusterRole(clusterRole)
    setIsDetailsModalOpen(true)
  }

  const handleEdit = (e: React.MouseEvent, clusterRole: any) => {
    e.stopPropagation()
    setSelectedClusterRole(clusterRole)
    setIsEditModalOpen(true)
  }

  const handleDelete = (e: React.MouseEvent, clusterRole: any) => {
    e.stopPropagation()
    setSelectedClusterRole(clusterRole)
    setIsDeleteModalOpen(true)
  }

  const handleCreate = () => {
    setIsCreateModalOpen(true)
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['clusterRoles'] })
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={clusterParam ? [
          { name: clusterParam, href: `/clusters/${clusterParam}` },
          { name: 'Cluster Roles' }
        ] : [
          { name: 'Cluster Roles' }
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cluster Roles</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage RBAC cluster roles across your Kubernetes clusters
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name, labels, annotations..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-11 pr-4 py-2 text-sm focus:border-primary-500 focus:ring-primary-500 dark:text-white"
            />
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors whitespace-nowrap"
          >
            <PlusIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Create</span>
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
                  label="Name"
                  sortKey="metadata.name"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.name}
                  columnKey="name"
                  onResizeStart={handleMouseDown}
                />
                <ResizableTableHeader
                  label="Cluster"
                  sortKey="ClusterName"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.cluster}
                  columnKey="cluster"
                  onResizeStart={handleMouseDown}
                />
                <ResizableTableHeader
                  label="Rules"
                  sortKey="rules.length"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.rules}
                  columnKey="rules"
                  onResizeStart={handleMouseDown}
                />
                <ResizableTableHeader
                  label="Aggregated"
                  sortKey="aggregationRule"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.aggregated}
                  columnKey="aggregated"
                  onResizeStart={handleMouseDown}
                />
                <ResizableTableHeader
                  label="Labels"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.labels}
                  columnKey="labels"
                  onResizeStart={handleMouseDown}
                />
                <ResizableTableHeader
                  label="Age"
                  sortKey="metadata.creationTimestamp"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.age}
                  columnKey="age"
                  onResizeStart={handleMouseDown}
                />
                <th
                  className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  style={{ width: `${columnWidths.actions}%` }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading cluster roles...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No cluster roles found
                  </td>
                </tr>
              ) : (
                paginatedData.map((cr: any) => (
                  <tr
                    key={`${cr.ClusterName}-${cr.metadata?.name}`}
                    onClick={() => handleRowClick(cr)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  >
                    <td
                      className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{ maxWidth: `${columnWidths.name}%` }}
                    >
                      {cr.metadata?.name}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{ maxWidth: `${columnWidths.cluster}%` }}
                    >
                      {cr.ClusterName}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400"
                      style={{ maxWidth: `${columnWidths.rules}%` }}
                    >
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                        {(cr.rules || []).length}
                      </span>
                    </td>
                    <td
                      className="px-6 py-4 text-sm"
                      style={{ maxWidth: `${columnWidths.aggregated}%` }}
                    >
                      {cr.aggregationRule ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                          Yes
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">-</span>
                      )}
                    </td>
                    <td
                      className="px-6 py-4 text-sm"
                      style={{ maxWidth: `${columnWidths.labels}%` }}
                    >
                      <div className="flex flex-wrap gap-1">
                        {cr.metadata?.labels && Object.keys(cr.metadata.labels).length > 0 ? (
                          <>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                              {Object.keys(cr.metadata.labels)[0]}: {String(Object.values(cr.metadata.labels)[0])}
                            </span>
                            {Object.keys(cr.metadata.labels).length > 1 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                +{Object.keys(cr.metadata.labels).length - 1}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">-</span>
                        )}
                      </div>
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap"
                      style={{ maxWidth: `${columnWidths.age}%` }}
                    >
                      {formatAge(cr.metadata?.creationTimestamp)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleEdit(e, cr)}
                          className="p-2 text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-all"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, cr)}
                          className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                          title="Delete"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && paginatedData.length > 0 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={goToPage} onPageSizeChange={changePageSize} onNextPage={goToNextPage} onPreviousPage={goToPreviousPage} hasNextPage={hasNextPage} hasPreviousPage={hasPreviousPage} />
        )}
      </div>

      {/* Modals */}
      {selectedClusterRole && (
        <>
          <ClusterRoleDetailsModal
            clusterRole={selectedClusterRole}
            isOpen={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
          />
          <EditClusterRoleYAMLModal
            clusterRole={selectedClusterRole}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={handleRefresh}
          />
          <DeleteClusterRoleModal
            clusterRole={selectedClusterRole}
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onSuccess={handleRefresh}
          />
        </>
      )}
      <CreateClusterRoleModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleRefresh}
        cluster={activeCluster}
      />
    </div>
  )
}

