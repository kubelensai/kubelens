import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getIngressClasses } from '@/services/api'
import { useMemo, useState, useEffect } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, PlusIcon, RectangleGroupIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import IngressClassDetailsModal from '@/components/IngressClasses/IngressClassDetailsModal'
import EditIngressClassYAMLModal from '@/components/IngressClasses/EditIngressClassYAMLModal'
import DeleteIngressClassModal from '@/components/IngressClasses/DeleteIngressClassModal'
import CreateIngressClassModal from '@/components/IngressClasses/CreateIngressClassModal'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

export default function IngressClasses() {
  const { cluster } = useParams<{ cluster?: string }>()
  const queryClient = useQueryClient()

  const [filterText, setFilterText] = useState('')
  const [selectedIngressClass, setSelectedIngressClass] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditYAMLModalOpen, setIsEditYAMLModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 250,
    controller: 200,
    parameters: 150,
    age: 120,
    actions: 150,
  }, 'ingressclasses-column-widths')

  // Reset state when cluster changes
  useEffect(() => {
    setSelectedIngressClass(null)
    setIsDetailsModalOpen(false)
    setIsEditYAMLModalOpen(false)
    setIsDeleteModalOpen(false)
    setIsCreateModalOpen(false)
  }, [cluster])
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch ingress classes from all clusters or specific cluster
  const ingressClassQueries = useMemo(() => {
    if (!clusters) return []

    if (cluster) {
      return [
        {
          queryKey: ['ingressclasses', cluster],
          queryFn: () => getIngressClasses(cluster),
          refetchInterval: 5000,
        },
      ]
    }

    return clusters.map((c: any) => ({
      queryKey: ['ingressclasses', c.name],
      queryFn: () => getIngressClasses(c.name),
      refetchInterval: 5000,
    }))
  }, [clusters, cluster])

  const ingressClassResults = useQueries({ queries: ingressClassQueries })
  const isLoading = ingressClassResults.some((result) => result.isLoading)

  const allIngressClasses = useMemo(() => {
    return ingressClassResults.flatMap((result) => result.data || [])
  }, [ingressClassResults])

  // Filter ingress classes
  const filteredIngressClasses = useMemo(() => {
    return allIngressClasses.filter((ic: any) => {
      const searchText = filterText.toLowerCase()
      const name = ic.metadata?.name?.toLowerCase() || ''
      const controller = ic.spec?.controller?.toLowerCase() || ''

      return name.includes(searchText) || controller.includes(searchText)
    })
  }, [allIngressClasses, filterText])

  // Apply sorting
  const { sortedData: sortedIngressClasses, sortConfig, requestSort } = useTableSort(filteredIngressClasses, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: ingressClasses,
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
  } = usePagination(sortedIngressClasses, 10, 'ingressclasses')

  // Helper functions
  const getParametersCount = (ic: any) => {
    return ic.spec?.parameters ? Object.keys(ic.spec.parameters).length : 0
  }

  // Action handlers
  const handleRowClick = (ic: any) => {
    setSelectedIngressClass(ic)
    setIsDetailsModalOpen(true)
  }

  const handleEditYAMLClick = (ic: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIngressClass(ic)
    setIsEditYAMLModalOpen(true)
  }

  const handleDeleteClick = (ic: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIngressClass(ic)
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
                  { name: 'Ingress Classes' }
                ]
              : [{ name: 'Ingress Classes' }]
          }
        />
      </div>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Ingress Classes</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            Ingress controller implementations across {clusters?.length || 0} cluster(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name or controller..."
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
                  label="Controller"
                  columnKey="controller"
                  sortKey="spec.controller"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.controller}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Parameters"
                  columnKey="parameters"
                  sortKey="parameters"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.parameters}
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading ingress classes...</span>
                    </div>
                  </td>
                </tr>
              ) : ingressClasses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    {filterText ? 'No ingress classes found matching your search.' : 'No ingress classes found.'}
                  </td>
                </tr>
              ) : (
                ingressClasses.map((ic: any) => (
                  <tr
                    key={ic.metadata.uid}
                    onClick={() => handleRowClick(ic)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <RectangleGroupIcon className="h-5 w-5 text-primary-600 dark:text-primary-400 mr-3" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {ic.metadata.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {ic.spec?.controller || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {getParametersCount(ic) > 0 ? `${getParametersCount(ic)} param(s)` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatAge(ic.metadata.creationTimestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleEditYAMLClick(ic, e)}
                          className="p-1.5 text-yellow-600 hover:text-yellow-700 dark:text-yellow-500 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-all"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(ic, e)}
                          className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
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
      {selectedIngressClass && (
        <>
          <IngressClassDetailsModal
            isOpen={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
            ingressClass={selectedIngressClass}
          />
          <EditIngressClassYAMLModal
            isOpen={isEditYAMLModalOpen}
            onClose={() => setIsEditYAMLModalOpen(false)}
            ingressClass={selectedIngressClass}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['ingressclasses'] })}
          />
          <DeleteIngressClassModal isOpen={isDeleteModalOpen} onClose={() => { setIsDeleteModalOpen(false); setSelectedIngressClass(null); }} ingressClass={selectedIngressClass} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['ingressclasses'] }); }} />
        </>
      )}

      {cluster && (
        <CreateIngressClassModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          clusterName={cluster}
        />
      )}
    </div>
  )
}

