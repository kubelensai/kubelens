import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getRoleBindings } from '@/services/api'
import { useMemo, useState, useEffect } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'

import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import RoleBindingDetailsModal from '@/components/RoleBindings/RoleBindingDetailsModal'
import EditRoleBindingYAMLModal from '@/components/RoleBindings/EditRoleBindingYAMLModal'
import DeleteRoleBindingModal from '@/components/RoleBindings/DeleteRoleBindingModal'
import CreateRoleBindingModal from '@/components/RoleBindings/CreateRoleBindingModal'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'
import { useClusterStore } from '@/stores/clusterStore'
import { useNamespaceStore } from '@/stores/namespaceStore'

export default function RoleBindings() {
  const { cluster: clusterParam, namespace: namespaceParam } = useParams<{ cluster?: string; namespace?: string }>()
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')
  
  // Modal states
  const [selectedBinding, setSelectedBinding] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Global stores
  const { selectedCluster } = useClusterStore()
  const { selectedNamespace } = useNamespaceStore()

  // Reset modal states when cluster or namespace changes
  useEffect(() => {
    setIsDetailsModalOpen(false)
    setIsEditModalOpen(false)
    setIsDeleteModalOpen(false)
    setIsCreateModalOpen(false)
    setSelectedBinding(null)
  }, [clusterParam, namespaceParam, selectedCluster, selectedNamespace])

  // Fetch clusters
  const { data: clusters = [] } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Determine active cluster and namespace
  const activeCluster = clusterParam || selectedCluster || clusters[0]?.name || 'default'
  const activeNamespace = namespaceParam || selectedNamespace || 'all'

  // Fetch role bindings for all clusters
  const roleBindingQueries = clusters.map((cluster: any) => ({
    queryKey: ['rolebindings', cluster.name, activeNamespace],
    queryFn: () => getRoleBindings(cluster.name, activeNamespace),
    enabled: clusters.length > 0,
    refetchInterval: 5000,
  }))

  const roleBindingResults = useQueries({ queries: roleBindingQueries })

  // Flatten and combine all role bindings
  const allRoleBindings = useMemo(() => {
    return roleBindingResults.flatMap(result => result.data || [])
  }, [roleBindingResults])

  // Filter role bindings by active cluster, namespace, and filter text
  const filteredRoleBindings = useMemo(() => {
    return allRoleBindings.filter((rb: any) => {
      const cluster = rb.ClusterName || rb.metadata?.clusterName || ''
      const namespace = rb.metadata?.namespace || ''
      const name = rb.metadata?.name || ''
      
      // Apply cluster filter
      if (!clusterParam && cluster !== activeCluster) return false
      if (clusterParam && cluster !== clusterParam) return false
      
      // Apply namespace filter
      if (activeNamespace !== 'all' && namespace !== activeNamespace) return false
      
      // Apply search filter
      if (!filterText) return true
      
      const searchText = filterText.toLowerCase()
      const subjectsCount = (rb.subjects || []).length.toString()
      
      // Search in labels
      const labelsMatch = rb.metadata?.labels 
        ? Object.entries(rb.metadata.labels).some(([key, value]) => 
            key.toLowerCase().includes(searchText) || 
            String(value).toLowerCase().includes(searchText)
          )
        : false
      
      // Search in annotations
      const annotationsMatch = rb.metadata?.annotations
        ? Object.entries(rb.metadata.annotations).some(([key, value]) =>
            key.toLowerCase().includes(searchText) || 
            String(value).toLowerCase().includes(searchText)
          )
        : false
      
      return (
        name.toLowerCase().includes(searchText) ||
        namespace.toLowerCase().includes(searchText) ||
        cluster.toLowerCase().includes(searchText) ||
        subjectsCount.includes(searchText) ||
        labelsMatch ||
        annotationsMatch
      )
    })
  }, [allRoleBindings, activeCluster, activeNamespace, filterText, clusterParam])

  const isLoading = roleBindingResults.some(result => result.isLoading)

  // Sorting
  const { sortedData, sortConfig, requestSort } = useTableSort(filteredRoleBindings, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Pagination
  const { currentPage, pageSize, paginatedData, totalPages, goToPage, changePageSize, goToNextPage, goToPreviousPage, hasNextPage, hasPreviousPage, totalItems } = usePagination(
    sortedData,
    10,
    'rolebindings'
  )

  // Resizable columns
  const { columnWidths, handleMouseDown } = useResizableColumns({
    name: 20,
    namespace: 15,
    cluster: 15,
    role: 20,
    subjects: 15,
    labels: 10,
    age: 10,
    actions: 10,
  }, 'rolebindings-column-widths')

  const handleRowClick = (roleBinding: any) => {
    setSelectedBinding(roleBinding)
    setIsDetailsModalOpen(true)
  }

  const handleEdit = (e: React.MouseEvent, roleBinding: any) => {
    e.stopPropagation()
    setSelectedBinding(roleBinding)
    setIsEditModalOpen(true)
  }

  const handleDelete = (e: React.MouseEvent, roleBinding: any) => {
    e.stopPropagation()
    setSelectedBinding(roleBinding)
    setIsDeleteModalOpen(true)
  }

  const handleCreate = () => {
    setIsCreateModalOpen(true)
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['rolebindings'] })
  }

  const createNamespace = namespaceParam || selectedNamespace || 'default'

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={clusterParam ? [
          { name: clusterParam, href: `/clusters/${clusterParam}` },
          ...(namespaceParam ? [{ name: namespaceParam, href: `/clusters/${clusterParam}/namespaces/${namespaceParam}` }] : []),
          { name: 'Role Bindings' }
        ] : [
          { name: 'Role Bindings' }
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Role Bindings</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage role bindings to grant permissions within your Kubernetes namespaces
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name, namespace, labels, annotations..."
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
                  label="Namespace"
                  sortKey="metadata.namespace"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.namespace}
                  columnKey="namespace"
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
                  label="Role"
                  sortKey="roleRef.name"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.role}
                  columnKey="role"
                  onResizeStart={handleMouseDown}
                />
                <ResizableTableHeader
                  label="Bindings"
                  sortKey="subjects.length"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.subjects}
                  columnKey="subjects"
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
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading role bindings...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No role bindings found
                  </td>
                </tr>
              ) : (
                paginatedData.map((rb: any) => (
                  <tr
                    key={`${rb.ClusterName}-${rb.metadata?.namespace}-${rb.metadata?.name}`}
                    onClick={() => handleRowClick(rb)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  >
                    <td
                      className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{ maxWidth: `${columnWidths.name}%` }}
                    >
                      {rb.metadata?.name}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{ maxWidth: `${columnWidths.namespace}%` }}
                    >
                      {rb.metadata?.namespace}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{ maxWidth: `${columnWidths.cluster}%` }}
                    >
                      {rb.ClusterName}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{ maxWidth: `${columnWidths.role}%` }}
                    >
                      {rb.roleRef?.name || '-'}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400"
                      style={{ maxWidth: `${columnWidths.subjects}%` }}
                    >
                      <div className="flex flex-wrap gap-1">
                        {rb.subjects && rb.subjects.length > 0 ? (
                          <>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              {rb.subjects[0].name}
                            </span>
                            {rb.subjects.length > 1 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                +{rb.subjects.length - 1}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">-</span>
                        )}
                      </div>
                    </td>
                    <td
                      className="px-6 py-4 text-sm"
                      style={{ maxWidth: `${columnWidths.labels}%` }}
                    >
                      <div className="flex flex-wrap gap-1">
                        {rb.metadata?.labels && Object.keys(rb.metadata.labels).length > 0 ? (
                          <>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                              {Object.keys(rb.metadata.labels)[0]}: {String(Object.values(rb.metadata.labels)[0])}
                            </span>
                            {Object.keys(rb.metadata.labels).length > 1 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                +{Object.keys(rb.metadata.labels).length - 1}
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
                      {formatAge(rb.metadata?.creationTimestamp)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleEdit(e, rb)}
                          className="p-2 text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-all"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, rb)}
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
      {selectedBinding && (
        <>
          <RoleBindingDetailsModal
            roleBinding={selectedBinding}
            isOpen={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
          />
          <EditRoleBindingYAMLModal
            roleBinding={selectedBinding}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={handleRefresh}
          />
          <DeleteRoleBindingModal
            roleBinding={selectedBinding}
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onSuccess={handleRefresh}
          />
        </>
      )}
      <CreateRoleBindingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleRefresh}
        cluster={activeCluster}
        namespace={createNamespace}
      />
    </div>
  )
}

