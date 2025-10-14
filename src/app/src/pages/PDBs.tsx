import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getPDBs } from '@/services/api'
import { useMemo, useState, useEffect } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'

import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import PDBDetailsModal from '@/components/PDBs/PDBDetailsModal'
import EditPDBYAMLModal from '@/components/PDBs/EditPDBYAMLModal'
import DeletePDBModal from '@/components/PDBs/DeletePDBModal'
import CreatePDBModal from '@/components/PDBs/CreatePDBModal'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

export default function PDBs() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')
  const [selectedPDB, setSelectedPDB] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditYAMLModalOpen, setIsEditYAMLModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createNamespace, setCreateNamespace] = useState(namespace || 'default')

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    namespace: 150,
    minAvailable: 120,
    maxUnavailable: 130,
    currentAllowed: 140,
    age: 120,
    actions: 150,
  }, 'pdbs-column-widths')

  // Reset state when cluster or namespace changes
  useEffect(() => {
    setSelectedPDB(null)
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

  // Fetch PDBs from all clusters or specific cluster/namespace
  const pdbQueries = useMemo(() => {
    if (!clusters) return []

    if (cluster) {
      return [
        {
          queryKey: ['pdbs', cluster, namespace || 'all'],
          queryFn: () => getPDBs(cluster, namespace || 'all'),
          refetchInterval: 5000,
        },
      ]
    }

    return clusters.map((c: any) => ({
      queryKey: ['pdbs', c.name, namespace || 'all'],
      queryFn: () => getPDBs(c.name, namespace || 'all'),
      refetchInterval: 5000,
    }))
  }, [clusters, cluster, namespace])

  const pdbResults = useQueries({ queries: pdbQueries })
  const isLoading = pdbResults.some((result) => result.isLoading)

  const allPDBs = useMemo(() => {
    return pdbResults.flatMap((result) => result.data || [])
  }, [pdbResults])

  // Filter PDBs
  const filteredPDBs = useMemo(() => {
    return allPDBs.filter((pdb: any) => {
      const searchText = filterText.toLowerCase()
      const name = pdb.metadata?.name?.toLowerCase() || ''
      const ns = pdb.metadata?.namespace?.toLowerCase() || ''

      return name.includes(searchText) || ns.includes(searchText)
    })
  }, [allPDBs, filterText])

  // Apply sorting
  const { sortedData: sortedPDBs, sortConfig, requestSort } = useTableSort(filteredPDBs, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: pdbs,
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
  } = usePagination(sortedPDBs, 10, 'pdbs')

  // Helper functions
  const getMinAvailable = (pdb: any) => {
    if (pdb.spec?.minAvailable !== undefined) {
      return pdb.spec.minAvailable
    }
    return '-'
  }

  const getMaxUnavailable = (pdb: any) => {
    if (pdb.spec?.maxUnavailable !== undefined) {
      return pdb.spec.maxUnavailable
    }
    return '-'
  }

  const getCurrentAllowed = (pdb: any) => {
    if (pdb.status?.currentHealthy !== undefined && pdb.status?.desiredHealthy !== undefined) {
      return `${pdb.status.currentHealthy}/${pdb.status.desiredHealthy}`
    }
    return '-'
  }

  // Action handlers
  const handleRowClick = (pdb: any) => {
    setSelectedPDB(pdb)
    setIsDetailsModalOpen(true)
  }

  const handleEditYAMLClick = (pdb: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPDB(pdb)
    setIsEditYAMLModalOpen(true)
  }

  const handleDeleteClick = (pdb: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPDB(pdb)
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
                  { name: 'Pod Disruption Budgets' }
                ]
              : [{ name: 'Pod Disruption Budgets' }]
          }
        />
      </div>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Pod Disruption Budgets</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            All PDBs across {clusters?.length || 0} cluster(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name or namespace..."
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
          <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
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
                  label="Min Available"
                  columnKey="minAvailable"
                  sortKey="spec.minAvailable"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.minAvailable}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Max Unavailable"
                  columnKey="maxUnavailable"
                  sortKey="spec.maxUnavailable"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.maxUnavailable}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Current/Desired"
                  columnKey="currentAllowed"
                  sortKey="status.currentHealthy"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.currentAllowed}
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
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading PDBs...</span>
                    </div>
                  </td>
                </tr>
              ) : pdbs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    {filterText ? 'No PDBs found matching your filter' : 'No PDBs found'}
                  </td>
                </tr>
              ) : (
                pdbs.map((pdb: any) => (
                  <tr
                    key={`${pdb.clusterName}-${pdb.metadata?.namespace}-${pdb.metadata?.name}`}
                    onClick={() => handleRowClick(pdb)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  >
                    <td
                      className="px-2 sm:px-4 py-3 text-sm font-medium text-gray-900 dark:text-white truncate"
                      style={{ width: columnWidths.name, maxWidth: columnWidths.name }}
                    >
                      {pdb.metadata?.name}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.namespace, maxWidth: columnWidths.namespace }}
                    >
                      {pdb.metadata?.namespace}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.minAvailable, maxWidth: columnWidths.minAvailable }}
                    >
                      {getMinAvailable(pdb)}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.maxUnavailable, maxWidth: columnWidths.maxUnavailable }}
                    >
                      {getMaxUnavailable(pdb)}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.currentAllowed, maxWidth: columnWidths.currentAllowed }}
                    >
                      {getCurrentAllowed(pdb)}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.age, maxWidth: columnWidths.age }}
                    >
                      {formatAge(pdb.metadata?.creationTimestamp)}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-right text-sm font-medium"
                      style={{ width: columnWidths.actions, maxWidth: columnWidths.actions }}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleEditYAMLClick(pdb, e)}
                          className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(pdb, e)}
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
      {selectedPDB && (
        <>
          <PDBDetailsModal
            pdb={selectedPDB}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedPDB(null)
            }}
          />
          <EditPDBYAMLModal
            pdb={selectedPDB}
            isOpen={isEditYAMLModalOpen}
            onClose={() => {
              setIsEditYAMLModalOpen(false)
              setSelectedPDB(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['pdbs'] })
            }}
          />
          <DeletePDBModal
            pdb={selectedPDB}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedPDB(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['pdbs'] })
            }}
          />
        </>
      )}
      
      {/* Create Modal - outside selectedPDB block */}
      {cluster && (
        <CreatePDBModal
          clusterName={cluster}
          namespace={createNamespace}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['pdbs'] })
            setIsCreateModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

