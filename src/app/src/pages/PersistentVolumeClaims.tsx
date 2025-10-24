import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getPersistentVolumeClaims } from '@/services/api'
import { useMemo, useState, useEffect } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import PVCDetailsModal from '@/components/PersistentVolumeClaims/PVCDetailsModal'
import EditPVCYAMLModal from '@/components/PersistentVolumeClaims/EditPVCYAMLModal'
import DeletePVCModal from '@/components/PersistentVolumeClaims/DeletePVCModal'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'
import { useNamespaceStore } from '@/stores/namespaceStore'

interface PersistentVolumeClaim {
  clusterName: string
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
    uid: string
  }
  spec: {
    accessModes: string[]
    resources: {
      requests: {
        storage: string
      }
    }
    storageClassName?: string
    volumeName?: string
  }
  status: {
    phase: string
    capacity?: {
      storage: string
    }
  }
}

export default function PersistentVolumeClaims() {
  // Get current cluster from params
  const { clusterName: currentCluster, namespace } = useParams<{ clusterName?: string; namespace?: string }>()
  const queryClient = useQueryClient()
  const { selectedNamespace } = useNamespaceStore()
  const [filterText, setFilterText] = useState('')
  const [selectedPVC, setSelectedPVC] = useState<PersistentVolumeClaim | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditYAMLModalOpen, setIsEditYAMLModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const currentNamespace = namespace || selectedNamespace

  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    namespace: 150,
    status: 100,
    volume: 150,
    capacity: 120,
    storageClass: 150,
    age: 120,
    actions: 150,
  }, 'persistentvolumeclaims-column-widths')

  // Reset state when cluster or namespace changes
  useEffect(() => {
    setSelectedPVC(null)
    setIsDetailsModalOpen(false)
    setIsEditYAMLModalOpen(false)
    setIsDeleteModalOpen(false)
  }, [currentCluster, currentNamespace])
  
  // Fetch clusters first
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Build queries array
  const pvcQueries = useMemo(() => {
    if (!clusters) return []

    if (currentCluster) {
      return [
        {
          queryKey: ['persistentvolumeclaims', currentCluster, currentNamespace || 'all'],
          queryFn: () => getPersistentVolumeClaims(currentCluster, currentNamespace || 'all'),
          refetchInterval: 5000,
        },
      ]
    }

    return (clusters || []).map((c: any) => ({
      queryKey: ['persistentvolumeclaims', c.name, currentNamespace || 'all'],
      queryFn: () => getPersistentVolumeClaims(c.name, currentNamespace || 'all'),
      refetchInterval: 5000,
    }))
  }, [clusters, currentCluster, currentNamespace])

  // Use useQueries (NOT .map with useQuery!)
  const pvcResults = useQueries({ queries: pvcQueries })
  const isLoading = pvcResults.some((result) => result.isLoading)

  // Flatten results from all clusters
  const allPVCs: any[] = useMemo(() => {
    return pvcResults.flatMap((result: any) => result.data || [])
  }, [pvcResults])

  // Filter PVCs
  const filteredPVCs = useMemo(() => {
    return allPVCs.filter((pvc: PersistentVolumeClaim) => {
      const searchText = filterText.toLowerCase()
      const name = pvc.metadata?.name?.toLowerCase() || ''
      const ns = pvc.metadata?.namespace?.toLowerCase() || ''
      const status = pvc.status?.phase?.toLowerCase() || ''
      const storageClass = pvc.spec?.storageClassName?.toLowerCase() || ''

      return name.includes(searchText) || ns.includes(searchText) || status.includes(searchText) || storageClass.includes(searchText)
    })
  }, [allPVCs, filterText])

  // Apply sorting
  const { sortedData: sortedPVCs, sortConfig, requestSort } = useTableSort(filteredPVCs, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: pvcs,
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
  } = usePagination(sortedPVCs, 10, 'persistentvolumeclaims')

  // Helper functions
  const getStatusBadge = (phase: string) => {
    const statusColors: Record<string, string> = {
      'Bound': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'Pending': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      'Lost': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    }
    return statusColors[phase] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  }

  // Action handlers
  const handleRowClick = (pvc: PersistentVolumeClaim) => {
    setSelectedPVC(pvc)
    setIsDetailsModalOpen(true)
  }

  const handleEditYAMLClick = (pvc: PersistentVolumeClaim, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPVC(pvc)
    setIsEditYAMLModalOpen(true)
  }

  const handleDeleteClick = (pvc: PersistentVolumeClaim, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPVC(pvc)
    setIsDeleteModalOpen(true)
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
                  { name: 'Persistent Volume Claims' }
                ]
              : [{ name: 'Persistent Volume Claims' }]
          }
        />
      </div>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Persistent Volume Claims</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            All persistent volume claims across {clusters?.length || 0} cluster(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name, namespace..."
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
                  label="Status"
                  columnKey="status"
                  sortKey="status.phase"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.status}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Volume"
                  columnKey="volume"
                  sortKey="spec.volumeName"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.volume}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Capacity"
                  columnKey="capacity"
                  sortKey="status.capacity.storage"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.capacity}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Storage Class"
                  columnKey="storageClass"
                  sortKey="spec.storageClassName"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.storageClass}
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
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading persistent volume claims...</span>
                    </div>
                  </td>
                </tr>
              ) : pvcs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                      {filterText ? 'No persistent volume claims found matching your filter' : 'No persistent volume claims found'}
                    </p>
                  </td>
                </tr>
              ) : (
                pvcs.map((pvc: PersistentVolumeClaim) => (
                  <tr
                    key={`${pvc.clusterName}-${pvc.metadata?.namespace}-${pvc.metadata?.name}`}
                    onClick={() => handleRowClick(pvc)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  >
                    <td
                      className="px-2 sm:px-4 py-3 text-sm font-medium text-gray-900 dark:text-white truncate"
                      style={{ width: columnWidths.name, maxWidth: columnWidths.name }}
                    >
                      {pvc.metadata?.name}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.namespace, maxWidth: columnWidths.namespace }}
                    >
                      {pvc.metadata?.namespace}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm"
                      style={{ width: columnWidths.status, maxWidth: columnWidths.status }}
                    >
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(pvc.status?.phase)}`}>
                        {pvc.status?.phase || 'Unknown'}
                      </span>
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.volume, maxWidth: columnWidths.volume }}
                    >
                      {pvc.spec?.volumeName || '-'}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.capacity, maxWidth: columnWidths.capacity }}
                    >
                      {pvc.status?.capacity?.storage || pvc.spec?.resources?.requests?.storage || '-'}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.storageClass, maxWidth: columnWidths.storageClass }}
                    >
                      {pvc.spec?.storageClassName || '-'}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.age, maxWidth: columnWidths.age }}
                    >
                      {formatAge(pvc.metadata?.creationTimestamp)}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-right text-sm font-medium"
                      style={{ width: columnWidths.actions, maxWidth: columnWidths.actions }}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleEditYAMLClick(pvc, e)}
                          className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(pvc, e)}
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
      {selectedPVC && (
        <>
          <PVCDetailsModal
            pvc={selectedPVC}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedPVC(null)
            }}
          />
          <EditPVCYAMLModal
            pvc={selectedPVC}
            isOpen={isEditYAMLModalOpen}
            onClose={() => {
              setIsEditYAMLModalOpen(false)
              setSelectedPVC(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['persistentvolumeclaims'] })
              await queryClient.refetchQueries({ queryKey: ['persistentvolumeclaims'] })
              setIsEditYAMLModalOpen(false)
              setSelectedPVC(null)
            }}
          />
          <DeletePVCModal
            pvc={selectedPVC}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedPVC(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['persistentvolumeclaims'] })
              await queryClient.refetchQueries({ queryKey: ['persistentvolumeclaims'] })
              setIsDeleteModalOpen(false)
              setSelectedPVC(null)
            }}
          />
        </>
      )}
    </div>
  )
}

