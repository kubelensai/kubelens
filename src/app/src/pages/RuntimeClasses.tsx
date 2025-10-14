import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getRuntimeClasses } from '@/services/api'
import { useMemo, useState, useEffect } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, PlusIcon, CommandLineIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import RuntimeClassDetailsModal from '@/components/RuntimeClasses/RuntimeClassDetailsModal'
import EditRuntimeClassYAMLModal from '@/components/RuntimeClasses/EditRuntimeClassYAMLModal'
import DeleteRuntimeClassModal from '@/components/RuntimeClasses/DeleteRuntimeClassModal'
import CreateRuntimeClassModal from '@/components/RuntimeClasses/CreateRuntimeClassModal'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

export default function RuntimeClasses() {
  const { cluster } = useParams<{ cluster?: string }>()
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')
  const [selectedRuntimeClass, setSelectedRuntimeClass] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditYAMLModalOpen, setIsEditYAMLModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 250,
    handler: 150,
    hasOverhead: 130,
    hasScheduling: 140,
    age: 120,
    actions: 150,
  }, 'runtimeclasses-column-widths')

  // Reset state when cluster changes
  useEffect(() => {
    setSelectedRuntimeClass(null)
    setIsDetailsModalOpen(false)
    setIsEditYAMLModalOpen(false)
    setIsDeleteModalOpen(false)
    setIsCreateModalOpen(false)
  }, [cluster])
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch runtime classes from all clusters or specific cluster
  const runtimeClassQueries = useMemo(() => {
    if (!clusters) return []

    if (cluster) {
      return [
        {
          queryKey: ['runtimeclasses', cluster],
          queryFn: () => getRuntimeClasses(cluster),
          refetchInterval: 5000,
        },
      ]
    }

    return clusters.map((c: any) => ({
      queryKey: ['runtimeclasses', c.name],
      queryFn: () => getRuntimeClasses(c.name),
      refetchInterval: 5000,
    }))
  }, [clusters, cluster])

  const runtimeClassResults = useQueries({ queries: runtimeClassQueries })
  const isLoading = runtimeClassResults.some((result) => result.isLoading)

  const allRuntimeClasses = useMemo(() => {
    return runtimeClassResults.flatMap((result) => result.data || [])
  }, [runtimeClassResults])

  // Filter runtime classes
  const filteredRuntimeClasses = useMemo(() => {
    return allRuntimeClasses.filter((rc: any) => {
      const searchText = filterText.toLowerCase()
      const name = rc.metadata?.name?.toLowerCase() || ''
      const handler = rc.handler?.toLowerCase() || ''

      return name.includes(searchText) || handler.includes(searchText)
    })
  }, [allRuntimeClasses, filterText])

  // Apply sorting
  const { sortedData: sortedRuntimeClasses, sortConfig, requestSort } = useTableSort(filteredRuntimeClasses, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: runtimeClasses,
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
  } = usePagination(sortedRuntimeClasses, 10, 'runtimeclasses')

  // Helper functions
  const hasOverhead = (rc: any) => {
    return rc.overhead?.podFixed ? 'Yes' : 'No'
  }

  const hasScheduling = (rc: any) => {
    return rc.scheduling ? 'Yes' : 'No'
  }

  // Action handlers
  const handleRowClick = (rc: any) => {
    setSelectedRuntimeClass(rc)
    setIsDetailsModalOpen(true)
  }

  const handleEditYAMLClick = (rc: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedRuntimeClass(rc)
    setIsEditYAMLModalOpen(true)
  }

  const handleDeleteClick = (rc: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedRuntimeClass(rc)
    setIsDeleteModalOpen(true)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <div>
        <Breadcrumb 
          items={
            cluster
              ? [
                  { name: cluster, href: `/clusters/${cluster}/overview` },
                  { name: 'Runtime Classes' }
                ]
              : [{ name: 'Runtime Classes' }]
          }
        />
      </div>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Runtime Classes</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            All runtime classes across {clusters?.length || 0} cluster(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name or handler..."
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
                  label="Handler"
                  columnKey="handler"
                  sortKey="handler"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.handler}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Has Overhead"
                  columnKey="hasOverhead"
                  sortKey="overhead"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.hasOverhead}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Has Scheduling"
                  columnKey="hasScheduling"
                  sortKey="scheduling"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.hasScheduling}
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
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading runtime classes...</span>
                    </div>
                  </td>
                </tr>
              ) : runtimeClasses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                      {filterText ? 'No runtime classes found matching your filter' : 'No runtime classes found'}
                    </p>
                  </td>
                </tr>
              ) : (
                runtimeClasses.map((rc: any) => (
                  <tr
                    key={`${rc.clusterName}-${rc.metadata?.name}`}
                    onClick={() => handleRowClick(rc)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  >
                    <td
                      className="px-2 sm:px-4 py-3 text-sm font-medium text-gray-900 dark:text-white truncate"
                      style={{ width: columnWidths.name, maxWidth: columnWidths.name }}
                    >
                      {rc.metadata?.name}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.handler, maxWidth: columnWidths.handler }}
                    >
                      <div className="flex items-center gap-1">
                        <CommandLineIcon className="h-4 w-4 text-primary-500" />
                        <span className="font-mono text-xs">{rc.handler}</span>
                      </div>
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.hasOverhead, maxWidth: columnWidths.hasOverhead }}
                    >
                      {hasOverhead(rc)}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.hasScheduling, maxWidth: columnWidths.hasScheduling }}
                    >
                      {hasScheduling(rc)}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.age, maxWidth: columnWidths.age }}
                    >
                      {formatAge(rc.metadata?.creationTimestamp)}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-right text-sm font-medium"
                      style={{ width: columnWidths.actions, maxWidth: columnWidths.actions }}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleEditYAMLClick(rc, e)}
                          className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(rc, e)}
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
      {selectedRuntimeClass && (
        <>
          <RuntimeClassDetailsModal
            runtimeClass={selectedRuntimeClass}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedRuntimeClass(null)
            }}
          />
          <EditRuntimeClassYAMLModal
            runtimeClass={selectedRuntimeClass}
            isOpen={isEditYAMLModalOpen}
            onClose={() => {
              setIsEditYAMLModalOpen(false)
              setSelectedRuntimeClass(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['runtimeclasses'] })
            }}
          />
          <DeleteRuntimeClassModal
            runtimeClass={selectedRuntimeClass}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedRuntimeClass(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['runtimeclasses'] })
            }}
          />
        </>
      )}
      
      {/* Create Modal - outside selectedRuntimeClass block */}
      {cluster && (
        <CreateRuntimeClassModal
          clusterName={cluster}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['runtimeclasses'] })
            setIsCreateModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
