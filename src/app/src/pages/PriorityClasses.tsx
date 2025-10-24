import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getPriorityClasses } from '@/services/api'
import { useMemo, useState, useEffect } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, PlusIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import PriorityClassDetailsModal from '@/components/PriorityClasses/PriorityClassDetailsModal'
import EditPriorityClassYAMLModal from '@/components/PriorityClasses/EditPriorityClassYAMLModal'
import DeletePriorityClassModal from '@/components/PriorityClasses/DeletePriorityClassModal'
import CreatePriorityClassModal from '@/components/PriorityClasses/CreatePriorityClassModal'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

export default function PriorityClasses() {
  const { cluster } = useParams<{ cluster?: string }>()
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')
  const [selectedPriorityClass, setSelectedPriorityClass] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditYAMLModalOpen, setIsEditYAMLModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 250,
    value: 100,
    globalDefault: 130,
    preemptionPolicy: 180,
    age: 120,
    actions: 150,
  }, 'priorityclasses-column-widths')

  // Reset state when cluster changes
  useEffect(() => {
    setSelectedPriorityClass(null)
    setIsDetailsModalOpen(false)
    setIsEditYAMLModalOpen(false)
    setIsDeleteModalOpen(false)
    setIsCreateModalOpen(false)
  }, [cluster])
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch priority classes from all clusters or specific cluster
  const priorityClassQueries = useMemo(() => {
    if (!clusters) return []

    if (cluster) {
      return [
        {
          queryKey: ['priorityclasses', cluster],
          queryFn: () => getPriorityClasses(cluster),
          refetchInterval: 5000,
        },
      ]
    }

    return clusters.map((c: any) => ({
      queryKey: ['priorityclasses', c.name],
      queryFn: () => getPriorityClasses(c.name),
      refetchInterval: 5000,
    }))
  }, [clusters, cluster])

  const priorityClassResults = useQueries({ queries: priorityClassQueries })
  const isLoading = priorityClassResults.some((result) => result.isLoading)

  const allPriorityClasses = useMemo(() => {
    return priorityClassResults.flatMap((result) => result.data || [])
  }, [priorityClassResults])

  // Filter priority classes
  const filteredPriorityClasses = useMemo(() => {
    return allPriorityClasses.filter((pc: any) => {
      const searchText = filterText.toLowerCase()
      const name = pc.metadata?.name?.toLowerCase() || ''
      const description = pc.description?.toLowerCase() || ''

      return name.includes(searchText) || description.includes(searchText)
    })
  }, [allPriorityClasses, filterText])

  // Apply sorting
  const { sortedData: sortedPriorityClasses, sortConfig, requestSort } = useTableSort(filteredPriorityClasses, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: priorityClasses,
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
  } = usePagination(sortedPriorityClasses, 10, 'priorityclasses')

  // Helper functions
  const getPreemptionPolicyDisplay = (policy: any) => {
    if (!policy) return 'PreemptLowerPriority'
    return policy
  }

  const getGlobalDefaultDisplay = (globalDefault: boolean) => {
    return globalDefault ? (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        Yes
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
        No
      </span>
    )
  }

  // Action handlers
  const handleRowClick = (pc: any) => {
    setSelectedPriorityClass(pc)
    setIsDetailsModalOpen(true)
  }

  const handleEditYAMLClick = (pc: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPriorityClass(pc)
    setIsEditYAMLModalOpen(true)
  }

  const handleDeleteClick = (pc: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPriorityClass(pc)
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
                  { name: cluster, href: "/dashboard" },
                  { name: 'Priority Classes' }
                ]
              : [{ name: 'Priority Classes' }]
          }
        />
      </div>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Priority Classes</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            All priority classes across {clusters?.length || 0} cluster(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name or description..."
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
                  label="Value"
                  columnKey="value"
                  sortKey="value"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.value}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Global Default"
                  columnKey="globalDefault"
                  sortKey="globalDefault"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.globalDefault}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Preemption Policy"
                  columnKey="preemptionPolicy"
                  sortKey="preemptionPolicy"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.preemptionPolicy}
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
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading priority classes...</span>
                    </div>
                  </td>
                </tr>
              ) : priorityClasses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    {filterText ? 'No priority classes found matching your filter' : 'No priority classes found'}
                  </td>
                </tr>
              ) : (
                priorityClasses.map((pc: any) => (
                  <tr
                    key={`${pc.clusterName}-${pc.metadata?.name}`}
                    onClick={() => handleRowClick(pc)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  >
                    <td
                      className="px-2 sm:px-4 py-3 text-sm font-medium text-gray-900 dark:text-white truncate"
                      style={{ width: columnWidths.name, maxWidth: columnWidths.name }}
                    >
                      {pc.metadata?.name}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.value, maxWidth: columnWidths.value }}
                    >
                      <div className="flex items-center gap-1">
                        <ChevronUpIcon className="h-4 w-4 text-primary-500" />
                        <span className="font-semibold">{pc.value}</span>
                      </div>
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.globalDefault, maxWidth: columnWidths.globalDefault }}
                    >
                      {getGlobalDefaultDisplay(pc.globalDefault)}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.preemptionPolicy, maxWidth: columnWidths.preemptionPolicy }}
                    >
                      {getPreemptionPolicyDisplay(pc.preemptionPolicy)}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.age, maxWidth: columnWidths.age }}
                    >
                      {formatAge(pc.metadata?.creationTimestamp)}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-right text-sm font-medium"
                      style={{ width: columnWidths.actions, maxWidth: columnWidths.actions }}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleEditYAMLClick(pc, e)}
                          className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(pc, e)}
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
      {selectedPriorityClass && (
        <>
          <PriorityClassDetailsModal
            priorityClass={selectedPriorityClass}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedPriorityClass(null)
            }}
          />
          <EditPriorityClassYAMLModal
            priorityClass={selectedPriorityClass}
            isOpen={isEditYAMLModalOpen}
            onClose={() => {
              setIsEditYAMLModalOpen(false)
              setSelectedPriorityClass(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['priorityclasses'] })
            }}
          />
          <DeletePriorityClassModal
            priorityClass={selectedPriorityClass}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedPriorityClass(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['priorityclasses'] })
            }}
          />
        </>
      )}
      
      {/* Create Modal - outside selectedPriorityClass block */}
      {cluster && (
        <CreatePriorityClassModal
          clusterName={cluster}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['priorityclasses'] })
            setIsCreateModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

