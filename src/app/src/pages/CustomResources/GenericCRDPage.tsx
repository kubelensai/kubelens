import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getCustomResources, getClusters } from '@/services/api'
import { useMemo, useState, useEffect } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'
import { useClusterStore } from '@/stores/clusterStore'
import { useNamespaceStore } from '@/stores/namespaceStore'
import CustomResourceDetailsModal from '@/components/CustomResources/CustomResourceDetailsModal'
import EditCustomResourceModal from '@/components/CustomResources/EditCustomResourceModal'
import DeleteCustomResourceModal from '@/components/CustomResources/DeleteCustomResourceModal'

export default function GenericCRDPage() {
  const { cluster: clusterParam, namespace: namespaceParam, group, version, resource } = useParams<{
    cluster?: string
    namespace?: string
    group: string
    version: string
    resource: string
  }>()

  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')
  
  // Modal states
  const [selectedResource, setSelectedResource] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Global stores
  const { selectedCluster } = useClusterStore()
  const { selectedNamespace } = useNamespaceStore()

  // Fetch enabled clusters
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Reset modal states when cluster/namespace changes
  useEffect(() => {
    setIsDetailsModalOpen(false)
    setIsEditModalOpen(false)
    setIsDeleteModalOpen(false)
    setSelectedResource(null)
  }, [clusterParam, namespaceParam, selectedCluster, selectedNamespace])

  // Determine active cluster: URL param > store > first enabled cluster
  const activeCluster = clusterParam || selectedCluster || (clusters && clusters.length > 0 ? clusters[0].name : null)
  const rawNamespace = namespaceParam || selectedNamespace
  // If namespace is 'all' or null, treat it as undefined to fetch all namespaces
  const activeNamespace = rawNamespace === 'all' || !rawNamespace ? undefined : rawNamespace

  // Fetch resources
  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['customresources', activeCluster, group, version, resource, activeNamespace],
    queryFn: () => getCustomResources(activeCluster!, group!, version!, resource!, activeNamespace),
    enabled: !!activeCluster && !!group && !!version && !!resource,
    refetchInterval: 5000,
  })

  // Filter resources
  const filteredResources = useMemo(() => {
    if (!filterText) return resources

    const searchText = filterText.toLowerCase()
    return resources.filter((r: any) => {
      const name = r.metadata?.name || ''
      const namespace = r.metadata?.namespace || ''
      const labelsMatch = r.metadata?.labels
        ? Object.entries(r.metadata.labels).some(([key, value]) =>
            key.toLowerCase().includes(searchText) ||
            String(value).toLowerCase().includes(searchText)
          )
        : false

      return (
        name.toLowerCase().includes(searchText) ||
        namespace.toLowerCase().includes(searchText) ||
        labelsMatch
      )
    })
  }, [resources, filterText])

  // Sorting
  const { sortedData, sortConfig, requestSort } = useTableSort(filteredResources, {
    key: 'metadata.name',
    direction: 'asc',
  })

  // Pagination
  const { currentPage, pageSize, paginatedData, totalPages, goToPage, changePageSize, goToNextPage, goToPreviousPage, hasNextPage, hasPreviousPage, totalItems } = usePagination(
    sortedData,
    10,
    `customresource-${group}-${resource}`
  )

  // Resizable columns
  const { columnWidths, handleMouseDown } = useResizableColumns({
    name: 30,
    namespace: 20,
    age: 15,
    status: 20,
    actions: 15,
  }, `cr-${resource}-column-widths`)

  const handleRowClick = (resource: any) => {
    setSelectedResource(resource)
    setIsDetailsModalOpen(true)
  }

  const handleEdit = (e: React.MouseEvent, resource: any) => {
    e.stopPropagation()
    setSelectedResource(resource)
    setIsEditModalOpen(true)
  }

  const handleDelete = (e: React.MouseEvent, resource: any) => {
    e.stopPropagation()
    setSelectedResource(resource)
    setIsDeleteModalOpen(true)
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['customresources'] })
  }

  // Get resource kind for display (capitalize first letter of singular form)
  const resourceKind = resource ? resource.charAt(0).toUpperCase() + resource.slice(1, -1) : 'Resource'

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={
          clusterParam
            ? namespaceParam
              ? [
                  { name: clusterParam, href: `/clusters/${clusterParam}` },
                  { name: namespaceParam, href: `/clusters/${clusterParam}/namespaces/${namespaceParam}` },
                  { name: resourceKind },
                ]
              : [{ name: clusterParam, href: `/clusters/${clusterParam}` }, { name: resourceKind }]
            : [{ name: resourceKind }]
        }
      />

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{resourceKind}s</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Custom resources from {group}/{version}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by name, namespace..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-11 pr-4 py-2 text-sm focus:border-primary-500 focus:ring-primary-500 dark:text-white"
              />
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap self-end sm:self-center">
              {filteredResources.length} {filteredResources.length === 1 ? 'resource' : 'resources'}
            </div>
          </div>
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
                {activeNamespace === undefined && (
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
                )}
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
                <ResizableTableHeader
                  label="Status"
                  sortKey="status.phase"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.status}
                  columnKey="status"
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
                  <td colSpan={activeNamespace === undefined ? 5 : 4} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading resources...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={activeNamespace === undefined ? 5 : 4} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No resources found</p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((r: any) => (
                  <tr
                    key={`${r.metadata?.namespace || 'cluster'}-${r.metadata?.name}`}
                    onClick={() => handleRowClick(r)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  >
                    <td
                      className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{ maxWidth: `${columnWidths.name}%` }}
                    >
                      {r.metadata?.name || '-'}
                    </td>
                    {activeNamespace === undefined && (
                      <td
                        className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{ maxWidth: `${columnWidths.namespace}%` }}
                      >
                        {r.metadata?.namespace || '-'}
                      </td>
                    )}
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap"
                      style={{ maxWidth: `${columnWidths.age}%` }}
                    >
                      {formatAge(r.metadata?.creationTimestamp)}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{ maxWidth: `${columnWidths.status}%` }}
                    >
                      {r.status?.phase || r.status?.state || r.status?.conditions?.[0]?.type || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleEdit(e, r)}
                          className="p-2 text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-all"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, r)}
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
      {selectedResource && (
        <>
          <CustomResourceDetailsModal
            resource={selectedResource}
            group={group!}
            version={version!}
            resourceType={resource!}
            isOpen={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
          />
          <EditCustomResourceModal
            resource={selectedResource}
            group={group!}
            version={version!}
            resourceType={resource!}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={handleRefresh}
          />
          <DeleteCustomResourceModal
            resource={selectedResource}
            group={group!}
            version={version!}
            resourceType={resource!}
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onSuccess={handleRefresh}
          />
        </>
      )}
    </div>
  )
}

