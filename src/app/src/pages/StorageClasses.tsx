import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getClusters, getStorageClasses } from '@/services/api'
import api from '@/services/api'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'
import { useClusterStore } from '@/stores/clusterStore'
import { useNotificationStore } from '@/stores/notificationStore'
import StorageClassDetailsModal from '@/components/StorageClasses/StorageClassDetailsModal'
import EditStorageClassYAMLModal from '@/components/StorageClasses/EditStorageClassYAMLModal'
import DeleteStorageClassModal from '@/components/StorageClasses/DeleteStorageClassModal'
import CreateStorageClassModal from '@/components/StorageClasses/CreateStorageClassModal'

interface StorageClass {
  clusterName: string
  metadata: {
    name: string
    annotations?: Record<string, string>
    creationTimestamp: string
    labels?: Record<string, string>
  }
  provisioner: string
  parameters?: Record<string, string>
  reclaimPolicy?: string
  volumeBindingMode?: string
  allowVolumeExpansion?: boolean
  mountOptions?: string[]
}

export default function StorageClasses() {
  const { cluster } = useParams<{ cluster?: string }>()
  const { selectedCluster } = useClusterStore()
  const { addNotification } = useNotificationStore()
  const queryClient = useQueryClient()

  const [filterText, setFilterText] = useState('')
  const [selectedSC, setSelectedSC] = useState<StorageClass | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  
  // Fetch clusters first
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Determine current cluster: URL param > store > first enabled cluster
  const currentCluster = cluster || selectedCluster || (clusters && clusters.length > 0 ? clusters[0].name : null)

  // Reset modal states when cluster changes
  useEffect(() => {
    setSelectedSC(null)
    setIsDetailsOpen(false)
    setIsEditOpen(false)
    setIsDeleteOpen(false)
    setIsCreateOpen(false)
  }, [currentCluster])

  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    provisioner: 250,
    reclaimPolicy: 140,
    volumeBindingMode: 160,
    allowVolumeExpansion: 180,
    default: 120,
    age: 120,
    actions: 120,
  }, 'storageclasses-column-widths')

  // Fetch Storage Classes for the selected cluster
  const { data: storageClasses = [], isLoading } = useQuery({
    queryKey: ['storageclasses', currentCluster],
    queryFn: () => getStorageClasses(currentCluster || 'default'),
    refetchInterval: 5000,
    enabled: !!currentCluster,
  })

  // Filter Storage Classes based on search term
  const filteredSCs = useMemo(() => {
    if (!storageClasses) return []
    
    return storageClasses.filter((sc: StorageClass) => {
      const searchLower = filterText.toLowerCase()
      const name = sc.metadata.name.toLowerCase()
      const provisioner = (sc.provisioner || '').toLowerCase()
      const reclaimPolicy = (sc.reclaimPolicy || '').toLowerCase()
      const volumeBindingMode = (sc.volumeBindingMode || '').toLowerCase()

      return (
        name.includes(searchLower) ||
        provisioner.includes(searchLower) ||
        reclaimPolicy.includes(searchLower) ||
        volumeBindingMode.includes(searchLower)
      )
    })
  }, [storageClasses, filterText])

  // Sort
  const { sortedData: sortedSCs, sortConfig, requestSort } = useTableSort<StorageClass>(
    filteredSCs,
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
  } = usePagination(sortedSCs, 10, 'storageclasses')

  // Handlers
  const handleRowClick = (sc: StorageClass) => {
    setSelectedSC(sc)
    setIsDetailsOpen(true)
  }

  const handleEditYAML = (e: React.MouseEvent, sc: StorageClass) => {
    e.stopPropagation()
    setSelectedSC(sc)
    setIsEditOpen(true)
  }

  const handleDelete = (e: React.MouseEvent, sc: StorageClass) => {
    e.stopPropagation()
    setSelectedSC(sc)
    setIsDeleteOpen(true)
  }

  const handleToggleDefault = async (e: React.MouseEvent, sc: StorageClass) => {
    e.stopPropagation()
    
    const isCurrentlyDefault = sc.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true'
    
    try {
      if (!isCurrentlyDefault) {
        // Setting as default: First, unset all other StorageClasses as default (Kubernetes best practice)
        const otherDefaults = storageClasses.filter(
          (s: StorageClass) => 
            s.metadata.name !== sc.metadata.name &&
            s.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true'
        )

        // Unset all other defaults
        for (const other of otherDefaults) {
          const unsetSC = {
            ...other,
            metadata: {
              ...other.metadata,
              annotations: {
                ...other.metadata.annotations,
                'storageclass.kubernetes.io/is-default-class': 'false',
              },
            },
          }
          await api.put(`/clusters/${currentCluster}/storageclasses/${other.metadata.name}`, unsetSC)
        }
      }

      // Now set/unset the clicked StorageClass
      const updatedSC = {
        ...sc,
        metadata: {
          ...sc.metadata,
          annotations: {
            ...sc.metadata.annotations,
            'storageclass.kubernetes.io/is-default-class': isCurrentlyDefault ? 'false' : 'true',
          },
        },
      }

      await api.put(`/clusters/${currentCluster}/storageclasses/${sc.metadata.name}`, updatedSC)
      
      // Add notification
      if (isCurrentlyDefault) {
        addNotification({
          type: 'info',
          title: 'Default StorageClass Unset',
          message: `"${sc.metadata.name}" is no longer the default StorageClass.`,
        })
      } else {
        addNotification({
          type: 'success',
          title: 'Default StorageClass Set',
          message: `"${sc.metadata.name}" is now the default StorageClass.`,
        })
      }
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['storageclasses', currentCluster] })
      queryClient.refetchQueries({ queryKey: ['storageclasses', currentCluster] })
    } catch (error) {
      console.error('Failed to toggle default storage class:', error)
      addNotification({
        type: 'error',
        title: 'Failed to Toggle Default',
        message: `Could not update "${sc.metadata.name}". ${(error as any)?.response?.data?.error || (error as Error).message}`,
      })
    }
  }

  const handleModalSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['storageclasses', currentCluster] })
    queryClient.refetchQueries({ queryKey: ['storageclasses', currentCluster] })
    setIsDetailsOpen(false)
    setIsEditOpen(false)
    setIsDeleteOpen(false)
    setSelectedSC(null)
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
                  { name: 'Storage Classes' }
                ]
              : [{ name: 'Storage Classes' }]
          }
        />
      </div>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Storage Classes</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            All storage classes across {clusters?.length || 0} cluster(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name, provisioner..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-11 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap"
          >
            <PlusIcon className="h-5 w-5" />
            <span>Create</span>
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
                  columnKey="name"
                  sortKey="metadata.name"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.name}
                />
                <ResizableTableHeader
                  label="Provisioner"
                  columnKey="provisioner"
                  sortKey="provisioner"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.provisioner}
                />
                <ResizableTableHeader
                  label="Reclaim Policy"
                  columnKey="reclaimPolicy"
                  sortKey="reclaimPolicy"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.reclaimPolicy}
                />
                <ResizableTableHeader
                  label="Volume Binding Mode"
                  columnKey="volumeBindingMode"
                  sortKey="volumeBindingMode"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.volumeBindingMode}
                />
                <ResizableTableHeader
                  label="Allow Volume Expansion"
                  columnKey="allowVolumeExpansion"
                  sortKey="allowVolumeExpansion"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.allowVolumeExpansion}
                />
                <ResizableTableHeader
                  label="Default"
                  columnKey="default"
                  sortKey="metadata.annotations.storageclass.kubernetes.io/is-default-class"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.default}
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
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading storage classes...</span>
                    </div>
                  </td>
                </tr>
              ) : resources.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                      {filterText ? 'No storage classes found matching your filter.' : 'No storage classes found.'}
                    </p>
                  </td>
                </tr>
              ) : (
                resources.map((sc: StorageClass) => (
                  <tr
                    key={`${sc.clusterName}-${sc.metadata.name}`}
                    onClick={() => handleRowClick(sc)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td
                      className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white truncate"
                      style={{ width: columnWidths.name }}
                    >
                      {sc.metadata.name}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.provisioner }}
                    >
                      {sc.provisioner}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.reclaimPolicy }}
                    >
                      {sc.reclaimPolicy || 'Delete'}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.volumeBindingMode }}
                    >
                      {sc.volumeBindingMode || 'Immediate'}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.allowVolumeExpansion }}
                    >
                      {sc.allowVolumeExpansion ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400">
                          No
                        </span>
                      )}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.default }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Toggle Switch for Default */}
                      <button
                        onClick={(e) => handleToggleDefault(e, sc)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          sc.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true'
                            ? 'bg-blue-600'
                            : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                        title={
                          sc.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true'
                            ? 'Unset as default'
                            : 'Set as default'
                        }
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            sc.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true'
                              ? 'translate-x-6'
                              : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.age }}
                    >
                      {formatAge(sc.metadata.creationTimestamp)}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.actions }}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleEditYAML(e, sc)}
                          className="p-1 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded transition-colors"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, sc)}
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
      {selectedSC && (
        <>
          <StorageClassDetailsModal
            storageClass={selectedSC}
            isOpen={isDetailsOpen}
            onClose={() => setIsDetailsOpen(false)}
          />
          <EditStorageClassYAMLModal
            storageClass={selectedSC}
            isOpen={isEditOpen}
            onClose={() => setIsEditOpen(false)}
            onSuccess={handleModalSuccess}
          />
          <DeleteStorageClassModal
            storageClass={selectedSC}
            isOpen={isDeleteOpen}
            onClose={() => setIsDeleteOpen(false)}
            onSuccess={handleModalSuccess}
          />
        </>
      )}

      {/* Create Modal */}
      <CreateStorageClassModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        clusterName={currentCluster || 'default'}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}

