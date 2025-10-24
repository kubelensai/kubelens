import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getClusters, getPersistentVolumes } from '@/services/api'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'
import { useClusterStore } from '@/stores/clusterStore'
import PVDetailsModal from '@/components/PersistentVolumes/PVDetailsModal'
import EditPVYAMLModal from '@/components/PersistentVolumes/EditPVYAMLModal'
import DeletePVModal from '@/components/PersistentVolumes/DeletePVModal'

interface PersistentVolume {
  clusterName: string
  metadata: {
    name: string
    creationTimestamp: string
    labels?: Record<string, string>
  }
  spec: {
    capacity?: {
      storage?: string
    }
    accessModes?: string[]
    persistentVolumeReclaimPolicy?: string
    storageClassName?: string
    claimRef?: {
      namespace?: string
      name?: string
    }
  }
  status: {
    phase?: string
  }
}

export default function PersistentVolumes() {
  const { cluster } = useParams<{ cluster?: string }>()
  const { selectedCluster } = useClusterStore()
  const queryClient = useQueryClient()

  const [filterText, setFilterText] = useState('')
  const [selectedPV, setSelectedPV] = useState<PersistentVolume | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  
  // Fetch clusters first
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Determine current cluster: URL param > store > first enabled cluster
  const currentCluster = cluster || selectedCluster || (clusters && clusters.length > 0 ? clusters[0].name : null)

  // Reset modal states when cluster changes
  useEffect(() => {
    setSelectedPV(null)
    setIsDetailsOpen(false)
    setIsEditOpen(false)
    setIsDeleteOpen(false)
  }, [currentCluster])

  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    capacity: 120,
    accessModes: 180,
    reclaimPolicy: 140,
    status: 120,
    claim: 200,
    storageClass: 150,
    age: 120,
    actions: 120,
  }, 'persistentvolumes-column-widths')

  // Fetch PVs for the selected cluster
  const { data: pvs = [], isLoading } = useQuery({
    queryKey: ['persistentvolumes', currentCluster],
    queryFn: () => getPersistentVolumes(currentCluster || 'default'),
    refetchInterval: 5000,
    enabled: !!currentCluster,
  })

  // Filter PVs based on search term
  const filteredPVs = useMemo(() => {
    if (!pvs) return []
    
    return pvs.filter((pv: PersistentVolume) => {
      const searchLower = filterText.toLowerCase()
      const name = pv.metadata.name.toLowerCase()
      const status = (pv.status?.phase || '').toLowerCase()
      const storageClass = (pv.spec?.storageClassName || '').toLowerCase()
      const claim = pv.spec?.claimRef?.name?.toLowerCase() || ''
      const capacity = pv.spec?.capacity?.storage?.toLowerCase() || ''

      return (
        name.includes(searchLower) ||
        status.includes(searchLower) ||
        storageClass.includes(searchLower) ||
        claim.includes(searchLower) ||
        capacity.includes(searchLower)
      )
    })
  }, [pvs, filterText])

  // Sort and pagination
  const { sortedData: sortedPVs, sortConfig, requestSort } = useTableSort<PersistentVolume>(
    filteredPVs,
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
  } = usePagination(sortedPVs, 10, 'persistentvolumes')

  // Handlers
  const handleRowClick = (pv: PersistentVolume) => {
    setSelectedPV(pv)
    setIsDetailsOpen(true)
  }

  const handleEditYAML = (e: React.MouseEvent, pv: PersistentVolume) => {
    e.stopPropagation()
    setSelectedPV(pv)
    setIsEditOpen(true)
  }

  const handleDelete = (e: React.MouseEvent, pv: PersistentVolume) => {
    e.stopPropagation()
    setSelectedPV(pv)
    setIsDeleteOpen(true)
  }

  const handleModalSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['persistentvolumes', currentCluster] })
    queryClient.refetchQueries({ queryKey: ['persistentvolumes', currentCluster] })
    setIsDetailsOpen(false)
    setIsEditOpen(false)
    setIsDeleteOpen(false)
    setSelectedPV(null)
  }

  const getStatusBadge = (phase: string) => {
    const statusColors: Record<string, string> = {
      'Available': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'Bound': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'Released': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      'Failed': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    }
    return statusColors[phase] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
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
                  { name: 'Persistent Volumes' }
                ]
              : [{ name: 'Persistent Volumes' }]
          }
        />
      </div>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Persistent Volumes</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            All persistent volumes across {clusters?.length || 0} cluster(s)
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
                    label="Capacity"
                    columnKey="capacity"
                    sortKey="spec.capacity.storage"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction || null}
                    onSort={requestSort}
                    onResizeStart={handleResizeStart}
                    width={columnWidths.capacity}
                  />
                  <ResizableTableHeader
                    label="Access Modes"
                    columnKey="accessModes"
                    sortKey="spec.accessModes"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction || null}
                    onSort={requestSort}
                    onResizeStart={handleResizeStart}
                    width={columnWidths.accessModes}
                  />
                  <ResizableTableHeader
                    label="Reclaim Policy"
                    columnKey="reclaimPolicy"
                    sortKey="spec.persistentVolumeReclaimPolicy"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction || null}
                    onSort={requestSort}
                    onResizeStart={handleResizeStart}
                    width={columnWidths.reclaimPolicy}
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
                    label="Claim"
                    columnKey="claim"
                    sortKey="spec.claimRef.name"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction || null}
                    onSort={requestSort}
                    onResizeStart={handleResizeStart}
                    width={columnWidths.claim}
                  />
                  <ResizableTableHeader
                    label="Storage Class"
                    columnKey="storageClass"
                    sortKey="spec.storageClassName"
                    currentSortKey={sortConfig?.key as string}
                    currentSortDirection={sortConfig?.direction || null}
                    onSort={requestSort}
                    onResizeStart={handleResizeStart}
                    width={columnWidths.storageClass}
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
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading persistent volumes...</span>
                    </div>
                  </td>
                </tr>
              ) : resources.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <p className="text-gray-500 dark:text-gray-400">
                        {filterText ? 'No persistent volumes found matching your filter.' : 'No persistent volumes found.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  resources.map((pv: PersistentVolume) => (
                  <tr
                    key={`${pv.clusterName}-${pv.metadata.name}`}
                    onClick={() => handleRowClick(pv)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td
                      className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white truncate"
                      style={{ width: columnWidths.name }}
                    >
                      {pv.metadata.name}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.capacity }}
                    >
                      {pv.spec?.capacity?.storage || '-'}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.accessModes }}
                    >
                      {pv.spec?.accessModes?.join(', ') || '-'}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.reclaimPolicy }}
                    >
                      {pv.spec?.persistentVolumeReclaimPolicy || '-'}
                    </td>
                    <td
                      className="px-6 py-4 text-sm truncate"
                      style={{ width: columnWidths.status }}
                    >
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(pv.status?.phase || 'Unknown')}`}>
                        {pv.status?.phase || 'Unknown'}
                      </span>
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.claim }}
                    >
                      {pv.spec?.claimRef
                        ? `${pv.spec.claimRef.namespace}/${pv.spec.claimRef.name}`
                        : '-'}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.storageClass }}
                    >
                      {pv.spec?.storageClassName || '-'}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.age }}
                    >
                      {formatAge(pv.metadata.creationTimestamp)}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.actions }}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleEditYAML(e, pv)}
                          className="p-1 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded transition-colors"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, pv)}
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
      {selectedPV && (
        <>
          <PVDetailsModal
            pv={selectedPV}
            isOpen={isDetailsOpen}
            onClose={() => setIsDetailsOpen(false)}
          />
          <EditPVYAMLModal
            pv={selectedPV}
            isOpen={isEditOpen}
            onClose={() => setIsEditOpen(false)}
            onSuccess={handleModalSuccess}
          />
          <DeletePVModal
            pv={selectedPV}
            isOpen={isDeleteOpen}
            onClose={() => setIsDeleteOpen(false)}
            onSuccess={handleModalSuccess}
          />
        </>
      )}
    </div>
  )
}

