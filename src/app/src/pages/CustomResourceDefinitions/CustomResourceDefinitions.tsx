import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getCustomResourceDefinitions } from '@/services/api'
import { useMemo, useState, useEffect } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import CRDDetailsModal from '@/components/CustomResourceDefinitions/CRDDetailsModal'
import EditCRDYAMLModal from '@/components/CustomResourceDefinitions/EditCRDYAMLModal'
import DeleteCRDModal from '@/components/CustomResourceDefinitions/DeleteCRDModal'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'
import { useClusterStore } from '@/stores/clusterStore'

export default function CustomResourceDefinitions() {
  const { cluster: clusterParam } = useParams<{ cluster?: string }>()
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')
  
  // Modal states
  const [selectedCRD, setSelectedCRD] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Global stores
  const { selectedCluster } = useClusterStore()

  // Reset modal states when cluster changes
  useEffect(() => {
    setIsDetailsModalOpen(false)
    setIsEditModalOpen(false)
    setIsDeleteModalOpen(false)
    setSelectedCRD(null)
  }, [clusterParam, selectedCluster])

  // Fetch clusters
  const { data: clusters = [] } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Determine active cluster
  const activeCluster = clusterParam || selectedCluster || clusters[0]?.name || 'default'

  // Fetch CRDs for all clusters
  const crdQueries = clusters.map((cluster: any) => ({
    queryKey: ['customresourcedefinitions', cluster.name],
    queryFn: () => getCustomResourceDefinitions(cluster.name),
    enabled: clusters.length > 0,
    refetchInterval: 5000,
  }))

  const crdResults = useQueries({ queries: crdQueries })

  // Flatten and combine all CRDs
  const allCRDs = useMemo(() => {
    return crdResults.flatMap(result => result.data || [])
  }, [crdResults])

  // Filter CRDs by active cluster and filter text
  const filteredCRDs = useMemo(() => {
    return allCRDs.filter((crd: any) => {
      const cluster = crd.ClusterName || crd.metadata?.clusterName || ''
      const resource = crd.resource || crd.spec?.names?.plural || ''
      const group = crd.group || crd.spec?.group || ''
      const version = crd.version || ''
      const scope = crd.scope || crd.spec?.scope || ''
      const name = crd.metadata?.name || ''
      
      // Apply cluster filter
      if (!clusterParam && cluster !== activeCluster) return false
      if (clusterParam && cluster !== clusterParam) return false
      
      // Apply search filter
      if (!filterText) return true
      
      const searchText = filterText.toLowerCase()
      
      // Search in labels
      const labelsMatch = crd.metadata?.labels 
        ? Object.entries(crd.metadata.labels).some(([key, value]) => 
            key.toLowerCase().includes(searchText) || 
            String(value).toLowerCase().includes(searchText)
          )
        : false
      
      return (
        name.toLowerCase().includes(searchText) ||
        resource.toLowerCase().includes(searchText) ||
        group.toLowerCase().includes(searchText) ||
        version.toLowerCase().includes(searchText) ||
        scope.toLowerCase().includes(searchText) ||
        cluster.toLowerCase().includes(searchText) ||
        labelsMatch
      )
    })
  }, [allCRDs, activeCluster, filterText, clusterParam])

  const isLoading = crdResults.some(result => result.isLoading)

  // Sorting
  const { sortedData, sortConfig, requestSort } = useTableSort(filteredCRDs, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Pagination
  const { currentPage, pageSize, paginatedData, totalPages, goToPage, changePageSize, goToNextPage, goToPreviousPage, hasNextPage, hasPreviousPage, totalItems } = usePagination(
    sortedData,
    10,
    'customresourcedefinitions'
  )

  // Resizable columns
  const { columnWidths, handleMouseDown } = useResizableColumns({
    resource: 20,
    group: 20,
    version: 15,
    scope: 12,
    cluster: 15,
    age: 10,
    actions: 10,
  }, 'crds-column-widths')

  const handleRowClick = (crd: any) => {
    setSelectedCRD(crd)
    setIsDetailsModalOpen(true)
  }

  const handleEdit = (e: React.MouseEvent, crd: any) => {
    e.stopPropagation()
    setSelectedCRD(crd)
    setIsEditModalOpen(true)
  }

  const handleDelete = (e: React.MouseEvent, crd: any) => {
    e.stopPropagation()
    setSelectedCRD(crd)
    setIsDeleteModalOpen(true)
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['customresourcedefinitions'] })
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={clusterParam ? [
          { name: clusterParam, href: `/clusters/${clusterParam}` },
          { name: 'Custom Resource Definitions' }
        ] : [
          { name: 'Custom Resource Definitions' }
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Custom Resource Definitions</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage custom resource definitions across your Kubernetes clusters
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by resource, group, version..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-11 pr-4 py-2 text-sm focus:border-primary-500 focus:ring-primary-500 dark:text-white"
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
                  label="Resource"
                  sortKey="resource"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.resource}
                  columnKey="resource"
                  onResizeStart={handleMouseDown}
                />
                <ResizableTableHeader
                  label="Group"
                  sortKey="group"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.group}
                  columnKey="group"
                  onResizeStart={handleMouseDown}
                />
                <ResizableTableHeader
                  label="Version"
                  sortKey="version"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.version}
                  columnKey="version"
                  onResizeStart={handleMouseDown}
                />
                <ResizableTableHeader
                  label="Scope"
                  sortKey="scope"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.scope}
                  columnKey="scope"
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
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading CRDs...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No custom resource definitions found</p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((crd: any) => (
                  <tr
                    key={`${crd.ClusterName}-${crd.metadata?.name}`}
                    onClick={() => handleRowClick(crd)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  >
                    <td
                      className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{ maxWidth: `${columnWidths.resource}%` }}
                    >
                      {crd.resource || crd.spec?.names?.plural || '-'}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{ maxWidth: `${columnWidths.group}%` }}
                    >
                      {crd.group || crd.spec?.group || '-'}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{ maxWidth: `${columnWidths.version}%` }}
                    >
                      {crd.version || '-'}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap"
                      style={{ maxWidth: `${columnWidths.scope}%` }}
                    >
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        (crd.scope || crd.spec?.scope) === 'Namespaced' 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}>
                        {crd.scope || crd.spec?.scope || '-'}
                      </span>
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis"
                      style={{ maxWidth: `${columnWidths.cluster}%` }}
                    >
                      {crd.ClusterName}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap"
                      style={{ maxWidth: `${columnWidths.age}%` }}
                    >
                      {formatAge(crd.metadata?.creationTimestamp)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleEdit(e, crd)}
                          className="p-2 text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-all"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, crd)}
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
      {selectedCRD && (
        <>
          <CRDDetailsModal
            crd={selectedCRD}
            isOpen={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
          />
          <EditCRDYAMLModal
            crd={selectedCRD}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={handleRefresh}
          />
          <DeleteCRDModal
            crd={selectedCRD}
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onSuccess={handleRefresh}
          />
        </>
      )}
    </div>
  )
}

