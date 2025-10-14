import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getLeases } from '@/services/api'
import { useMemo, useState, useEffect } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import LeaseDetailsModal from '@/components/Leases/LeaseDetailsModal'
import EditLeaseYAMLModal from '@/components/Leases/EditLeaseYAMLModal'
import DeleteLeaseModal from '@/components/Leases/DeleteLeaseModal'
import CreateLeaseModal from '@/components/Leases/CreateLeaseModal'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'
import { format } from 'date-fns'

export default function Leases() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')
  const [selectedLease, setSelectedLease] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditYAMLModalOpen, setIsEditYAMLModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createNamespace, setCreateNamespace] = useState(namespace || 'default')

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    namespace: 150,
    holder: 200,
    duration: 120,
    renewTime: 180,
    age: 120,
    actions: 150,
  }, 'leases-column-widths')

  // Reset state when cluster or namespace changes
  useEffect(() => {
    setSelectedLease(null)
    setIsDetailsModalOpen(false)
    setIsEditYAMLModalOpen(false)
    setIsDeleteModalOpen(false)
    setIsCreateModalOpen(false)
    setCreateNamespace(namespace || 'default')
  }, [cluster, namespace])
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch leases from all clusters or specific cluster/namespace
  const leaseQueries = useMemo(() => {
    if (!clusters) return []

    if (cluster) {
      return [
        {
          queryKey: ['leases', cluster, namespace || 'all'],
          queryFn: () => getLeases(cluster, namespace || 'all'),
          refetchInterval: 5000,
        },
      ]
    }

    return clusters.map((c: any) => ({
      queryKey: ['leases', c.name, namespace || 'all'],
      queryFn: () => getLeases(c.name, namespace || 'all'),
      refetchInterval: 5000,
    }))
  }, [clusters, cluster, namespace])

  const leaseResults = useQueries({ queries: leaseQueries })
  const isLoading = leaseResults.some((result) => result.isLoading)

  const allLeases = useMemo(() => {
    return leaseResults.flatMap((result) => result.data || [])
  }, [leaseResults])

  // Filter leases
  const filteredLeases = useMemo(() => {
    return allLeases.filter((lease: any) => {
      const searchText = filterText.toLowerCase()
      const name = lease.metadata?.name?.toLowerCase() || ''
      const ns = lease.metadata?.namespace?.toLowerCase() || ''
      const holder = lease.spec?.holderIdentity?.toLowerCase() || ''

      return name.includes(searchText) || ns.includes(searchText) || holder.includes(searchText)
    })
  }, [allLeases, filterText])

  // Apply sorting
  const { sortedData: sortedLeases, sortConfig, requestSort } = useTableSort(filteredLeases, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: leases,
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
  } = usePagination(sortedLeases, 10, 'leases')

  // Helper functions
  const formatRenewTime = (renewTime: string | null | undefined) => {
    if (!renewTime) return 'Never'
    try {
      const date = new Date(renewTime)
      return format(date, 'MMM dd, HH:mm:ss')
    } catch {
      return 'Invalid'
    }
  }

  // Action handlers
  const handleRowClick = (lease: any) => {
    setSelectedLease(lease)
    setIsDetailsModalOpen(true)
  }

  const handleEditYAMLClick = (lease: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedLease(lease)
    setIsEditYAMLModalOpen(true)
  }

  const handleDeleteClick = (lease: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedLease(lease)
    setIsDeleteModalOpen(true)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <div>
        <Breadcrumb 
          items={
            cluster && namespace
              ? [
                  { name: cluster, href: `/clusters/${cluster}/overview` },
                  { name: namespace, href: `/clusters/${cluster}/namespaces/${namespace}/pods` },
                  { name: 'Leases' }
                ]
              : cluster
              ? [
                  { name: cluster, href: `/clusters/${cluster}/overview` },
                  { name: 'Leases' }
                ]
              : [{ name: 'Leases' }]
          }
        />
      </div>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Leases</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            Distributed coordination locks across {clusters?.length || 0} cluster(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name, namespace, or holder..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-11 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          {cluster && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              <PlusIcon className="h-5 w-5" />
              Create
            </button>
          )}
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
                  width={columnWidths.name}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Namespace"
                  columnKey="namespace"
                  sortKey="metadata.namespace"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.namespace}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Holder Identity"
                  columnKey="holder"
                  sortKey="spec.holderIdentity"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.holder}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Duration (s)"
                  columnKey="duration"
                  sortKey="spec.leaseDurationSeconds"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.duration}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Renew Time"
                  columnKey="renewTime"
                  sortKey="spec.renewTime"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.renewTime}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Age"
                  columnKey="age"
                  sortKey="metadata.creationTimestamp"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.age}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Actions"
                  columnKey="actions"
                  sortKey=""
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.actions}
                  onResizeStart={handleResizeStart}
                  align="right"
                />
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading leases...</span>
                    </div>
                  </td>
                </tr>
              ) : leases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    {filterText ? 'No leases found matching your filter' : 'No leases found'}
                  </td>
                </tr>
              ) : (
                leases.map((lease: any) => (
                  <tr
                    key={`${lease.clusterName}-${lease.metadata?.namespace}-${lease.metadata?.name}`}
                    onClick={() => handleRowClick(lease)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  >
                    <td
                      className="px-2 sm:px-4 py-3 text-sm font-medium text-gray-900 dark:text-white truncate"
                      style={{ width: columnWidths.name, maxWidth: columnWidths.name }}
                    >
                      {lease.metadata?.name}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.namespace, maxWidth: columnWidths.namespace }}
                    >
                      {lease.metadata?.namespace}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono truncate"
                      style={{ width: columnWidths.holder, maxWidth: columnWidths.holder }}
                      title={lease.spec?.holderIdentity}
                    >
                      {lease.spec?.holderIdentity || '-'}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.duration, maxWidth: columnWidths.duration }}
                    >
                      {lease.spec?.leaseDurationSeconds || '-'}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.renewTime, maxWidth: columnWidths.renewTime }}
                    >
                      {formatRenewTime(lease.spec?.renewTime)}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.age, maxWidth: columnWidths.age }}
                    >
                      {formatAge(lease.metadata?.creationTimestamp)}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-right text-sm font-medium"
                      style={{ width: columnWidths.actions, maxWidth: columnWidths.actions }}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleEditYAMLClick(lease, e)}
                          className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(lease, e)}
                          className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="h-4 w-4" />
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
      {selectedLease && (
        <>
          <LeaseDetailsModal
            lease={selectedLease}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedLease(null)
            }}
          />
          <EditLeaseYAMLModal
            lease={selectedLease}
            isOpen={isEditYAMLModalOpen}
            onClose={() => {
              setIsEditYAMLModalOpen(false)
              setSelectedLease(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['leases'] })
            }}
          />
          <DeleteLeaseModal
            lease={selectedLease}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedLease(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['leases'] })
            }}
          />
        </>
      )}
      
      {/* Create Modal - outside selectedLease block */}
      {cluster && (
        <CreateLeaseModal
          clusterName={cluster}
          namespace={createNamespace}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['leases'] })
            setIsCreateModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
