import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getClusters, getNamespaces } from '@/services/api'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'
import { useClusterStore } from '@/stores/clusterStore'
import NamespaceDetailsModal from '@/components/Namespaces/NamespaceDetailsModal'
import EditNamespaceYAMLModal from '@/components/Namespaces/EditNamespaceYAMLModal'
import DeleteNamespaceModal from '@/components/Namespaces/DeleteNamespaceModal'

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

  const [filterText, setFilterText] = useState('')
  const [selectedNamespace, setSelectedNamespace] = useState<NamespaceResource | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  
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

  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 250,
    status: 120,
    age: 120,
    actions: 120,
  }, 'namespaces-column-widths')

  // Fetch Namespaces for the selected cluster
  const { data: namespaces = [], isLoading } = useQuery({
    queryKey: ['namespaces', currentCluster],
    queryFn: () => getNamespaces(currentCluster || 'default'),
    refetchInterval: 5000,
    enabled: !!currentCluster,
  })

  // Filter Namespaces based on search term
  const filteredNamespaces = useMemo(() => {
    if (!namespaces) return []
    
    return namespaces.filter((ns: NamespaceResource) => {
      const searchLower = filterText.toLowerCase()
      const name = ns.metadata.name.toLowerCase()
      const status = (ns.status?.phase || '').toLowerCase()

      return (
        name.includes(searchLower) ||
        status.includes(searchLower)
      )
    })
  }, [namespaces, filterText])

  // Sort
  const { sortedData: sortedNamespaces, sortConfig, requestSort } = useTableSort<NamespaceResource>(
    filteredNamespaces,
    { key: 'metadata.creationTimestamp', direction: 'desc' }
  )

  // Apply pagination
  const {
    paginatedData: resources,
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
  } = usePagination(sortedNamespaces, 10, 'namespaces')

  // Handlers
  const handleRowClick = (ns: NamespaceResource) => {
    setSelectedNamespace(ns)
    setIsDetailsOpen(true)
  }

  const handleEditYAML = (e: React.MouseEvent, ns: NamespaceResource) => {
    e.stopPropagation()
    setSelectedNamespace(ns)
    setIsEditOpen(true)
  }

  const handleDelete = (e: React.MouseEvent, ns: NamespaceResource) => {
    e.stopPropagation()
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
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Namespaces</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            All namespaces across {clusters?.length || 0} cluster(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name, status..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-11 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
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
                  columnKey="name"
                  sortKey="metadata.name"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.name}
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
                  sortKey=""
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.actions}
                />
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading namespaces...</span>
                    </div>
                  </td>
                </tr>
              ) : resources.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                      {filterText ? 'No namespaces found matching your filter.' : 'No namespaces found.'}
                    </p>
                  </td>
                </tr>
              ) : (
                resources.map((ns: NamespaceResource) => (
                  <tr
                    key={`${ns.clusterName}-${ns.metadata.name}`}
                    onClick={() => handleRowClick(ns)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td
                      className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white truncate"
                      style={{ width: columnWidths.name }}
                    >
                      {ns.metadata.name}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.status }}
                    >
                      {ns.status?.phase === 'Active' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          Active
                        </span>
                      ) : ns.status?.phase === 'Terminating' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                          Terminating
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400">
                          {ns.status?.phase || 'Unknown'}
                        </span>
                      )}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.age }}
                    >
                      {formatAge(ns.metadata.creationTimestamp)}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.actions }}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleEditYAML(e, ns)}
                          className="p-1 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded transition-colors"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, ns)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
      {selectedNamespace && (
        <>
          <NamespaceDetailsModal
            namespace={selectedNamespace}
            isOpen={isDetailsOpen}
            onClose={() => setIsDetailsOpen(false)}
          />
          <EditNamespaceYAMLModal
            namespace={selectedNamespace}
            isOpen={isEditOpen}
            onClose={() => setIsEditOpen(false)}
            onSuccess={handleModalSuccess}
          />
          <DeleteNamespaceModal
            namespace={selectedNamespace}
            isOpen={isDeleteOpen}
            onClose={() => setIsDeleteOpen(false)}
            onSuccess={handleModalSuccess}
          />
        </>
      )}
    </div>
  )
}

