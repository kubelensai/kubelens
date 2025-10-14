import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getServiceAccounts } from '@/services/api'
import { useMemo, useState, useEffect } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import ServiceAccountDetailsModal from '@/components/ServiceAccounts/ServiceAccountDetailsModal'
import EditServiceAccountYAMLModal from '@/components/ServiceAccounts/EditServiceAccountYAMLModal'
import DeleteServiceAccountModal from '@/components/ServiceAccounts/DeleteServiceAccountModal'
import CreateServiceAccountModal from '@/components/ServiceAccounts/CreateServiceAccountModal'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'
import { useClusterStore } from '@/stores/clusterStore'
import { useNamespaceStore } from '@/stores/namespaceStore'

export default function ServiceAccounts() {
  const { cluster: clusterParam, namespace: namespaceParam } = useParams<{ cluster?: string; namespace?: string }>()
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')
  
  // Modal states
  const [selectedServiceAccount, setSelectedServiceAccount] = useState<any>(null)
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
    setSelectedServiceAccount(null)
  }, [clusterParam, namespaceParam, selectedCluster, selectedNamespace])

  // Fetch clusters
  const { data: clusters = [] } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Determine active cluster and namespace
  const activeCluster = clusterParam || selectedCluster || clusters[0]?.name || 'default'
  const activeNamespace = namespaceParam || selectedNamespace || 'all'

  // Fetch service accounts for all clusters
  const serviceAccountQueries = clusters.map((cluster: any) => ({
    queryKey: ['serviceAccounts', cluster.name, activeNamespace],
    queryFn: () => getServiceAccounts(cluster.name, activeNamespace),
    enabled: clusters.length > 0,
    refetchInterval: 5000,
  }))

  const serviceAccountResults = useQueries({ queries: serviceAccountQueries })

  // Check if any query is loading
  const isLoading = serviceAccountResults.some(result => result.isLoading)

  // Flatten and combine all service accounts
  const allServiceAccounts = useMemo(() => {
    return serviceAccountResults.flatMap(result => result.data || [])
  }, [serviceAccountResults])

  // Filter service accounts by active cluster, namespace, and filter text
  const filteredServiceAccounts = useMemo(() => {
    return allServiceAccounts.filter((sa: any) => {
      const cluster = sa.ClusterName || sa.metadata?.clusterName || ''
      const namespace = sa.metadata?.namespace || ''
      const name = sa.metadata?.name || ''
      
      // Apply cluster filter
      if (!clusterParam && cluster !== activeCluster) return false
      if (clusterParam && cluster !== clusterParam) return false
      
      // Apply namespace filter
      if (activeNamespace !== 'all' && namespace !== activeNamespace) return false
      
      // Apply search filter
      if (!filterText) return true
      
      const searchText = filterText.toLowerCase()
      const secretsCount = (sa.secrets || []).length.toString()
      
      // Search in labels
      const labelsMatch = sa.metadata?.labels 
        ? Object.entries(sa.metadata.labels).some(([key, value]) => 
            key.toLowerCase().includes(searchText) || 
            String(value).toLowerCase().includes(searchText)
          )
        : false
      
      // Search in annotations
      const annotationsMatch = sa.metadata?.annotations
        ? Object.entries(sa.metadata.annotations).some(([key, value]) =>
            key.toLowerCase().includes(searchText) ||
            String(value).toLowerCase().includes(searchText)
          )
        : false
      
      return (
        name.toLowerCase().includes(searchText) ||
        namespace.toLowerCase().includes(searchText) ||
        cluster.toLowerCase().includes(searchText) ||
        secretsCount.includes(searchText) ||
        labelsMatch ||
        annotationsMatch
      )
    })
  }, [allServiceAccounts, activeCluster, activeNamespace, filterText, clusterParam])

  // Apply sorting
  const { sortedData: sortedServiceAccounts, sortConfig, requestSort } = useTableSort(filteredServiceAccounts, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: serviceAccounts,
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
  } = usePagination(sortedServiceAccounts, 10, 'serviceaccounts')

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    namespace: 150,
    cluster: 150,
    secrets: 120,
    autoMount: 120,
    age: 120,
    actions: 150,
  }, 'serviceaccounts-column-widths')

  // Handlers
  const handleRowClick = (sa: any) => {
    setSelectedServiceAccount(sa)
    setIsDetailsModalOpen(true)
  }

  const handleEdit = (e: React.MouseEvent, sa: any) => {
    e.stopPropagation()
    setSelectedServiceAccount(sa)
    setIsEditModalOpen(true)
  }

  const handleDelete = (e: React.MouseEvent, sa: any) => {
    e.stopPropagation()
    setSelectedServiceAccount(sa)
    setIsDeleteModalOpen(true)
  }

  const handleCreate = () => {
    setIsCreateModalOpen(true)
  }

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['serviceAccounts'] })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Breadcrumb 
          items={
            clusterParam
              ? [
                  { name: clusterParam, href: `/clusters/${clusterParam}/overview` },
                  { name: 'ServiceAccounts' }
                ]
              : [{ name: 'ServiceAccounts' }]
          }
        />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Service Accounts</h1>
            <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
              All service accounts across {clusters?.length || 0} cluster(s)
            </p>
          </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
                  placeholder="Filter by name, namespace, labels, annotations..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-11 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          {activeCluster && (
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <PlusIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Create</span>
            </button>
          )}
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
                  label="Cluster"
                  columnKey="cluster"
                  sortKey="ClusterName"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.cluster}
                />
                <ResizableTableHeader
                  label="Secrets"
                  columnKey="secrets"
                  sortKey="secrets.length"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.secrets}
                />
                <ResizableTableHeader
                  label="Auto Mount"
                  columnKey="autoMount"
                  sortKey="automountServiceAccountToken"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.autoMount}
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
                <th
                  style={{ width: `${columnWidths.actions}px` }}
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
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
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading service accounts...</span>
                    </div>
                  </td>
                </tr>
              ) : serviceAccounts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    {filterText ? 'No service accounts match your search' : 'No service accounts found'}
                  </td>
                </tr>
              ) : (
                serviceAccounts.map((sa: any) => (
                  <tr
                    key={`${sa.ClusterName}-${sa.metadata?.namespace}-${sa.metadata?.name}`}
                    onClick={() => handleRowClick(sa)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  >
                    <td style={{ width: `${columnWidths.name}px` }} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {sa.metadata?.name}
                    </td>
                    <td style={{ width: `${columnWidths.namespace}px` }} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {sa.metadata?.namespace}
                    </td>
                    <td style={{ width: `${columnWidths.cluster}px` }} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {sa.ClusterName}
                    </td>
                    <td style={{ width: `${columnWidths.secrets}px` }} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {(sa.secrets || []).length}
                    </td>
                    <td style={{ width: `${columnWidths.autoMount}px` }} className="px-6 py-4 whitespace-nowrap">
                      <span className={clsx(
                        'inline-flex px-2 py-1 text-xs font-medium rounded-full',
                        sa.automountServiceAccountToken === false
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : sa.automountServiceAccountToken === true
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      )}>
                        {sa.automountServiceAccountToken === false 
                          ? 'Disabled' 
                          : sa.automountServiceAccountToken === true 
                          ? 'Enabled' 
                          : 'Default'}
                      </span>
                    </td>
                    <td style={{ width: `${columnWidths.age}px` }} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {formatAge(sa.metadata?.creationTimestamp)}
                    </td>
                    <td style={{ width: `${columnWidths.actions}px` }} className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleEdit(e, sa)}
                          className="p-1.5 text-yellow-600 hover:text-yellow-700 dark:text-yellow-500 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, sa)}
                          className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
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
      {selectedServiceAccount && (
        <>
          <ServiceAccountDetailsModal
            serviceAccount={selectedServiceAccount}
            isOpen={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
          />
          <EditServiceAccountYAMLModal
            serviceAccount={selectedServiceAccount}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={refreshData}
          />
          <DeleteServiceAccountModal
            serviceAccount={selectedServiceAccount}
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onSuccess={refreshData}
          />
        </>
      )}
      
      <CreateServiceAccountModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={refreshData}
        cluster={activeCluster}
        namespace={activeNamespace !== 'all' ? activeNamespace : 'default'}
      />
    </div>
  )
}

