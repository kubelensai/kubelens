import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getValidatingWebhookConfigurations } from '@/services/api'
import { useMemo, useState, useEffect } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import ValidatingWebhookDetailsModal from '@/components/ValidatingWebhookConfigurations/ValidatingWebhookDetailsModal'
import EditValidatingWebhookYAMLModal from '@/components/ValidatingWebhookConfigurations/EditValidatingWebhookYAMLModal'
import DeleteValidatingWebhookModal from '@/components/ValidatingWebhookConfigurations/DeleteValidatingWebhookModal'
import CreateValidatingWebhookModal from '@/components/ValidatingWebhookConfigurations/CreateValidatingWebhookModal'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

export default function ValidatingWebhookConfigurations() {
  const { cluster } = useParams<{ cluster?: string }>()
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')
  const [selectedWebhook, setSelectedWebhook] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditYAMLModalOpen, setIsEditYAMLModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 250,
    webhooksCount: 130,
    age: 120,
    actions: 150,
  }, 'validatingwebhooks-column-widths')

  // Reset state when cluster changes
  useEffect(() => {
    setSelectedWebhook(null)
    setIsDetailsModalOpen(false)
    setIsEditYAMLModalOpen(false)
    setIsDeleteModalOpen(false)
    setIsCreateModalOpen(false)
  }, [cluster])
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch webhook configurations from all clusters or specific cluster
  const webhookQueries = useMemo(() => {
    if (!clusters) return []

    if (cluster) {
      return [
        {
          queryKey: ['validatingwebhooks', cluster],
          queryFn: () => getValidatingWebhookConfigurations(cluster),
          refetchInterval: 5000,
        },
      ]
    }

    return clusters.map((c: any) => ({
      queryKey: ['validatingwebhooks', c.name],
      queryFn: () => getValidatingWebhookConfigurations(c.name),
      refetchInterval: 5000,
    }))
  }, [clusters, cluster])

  const webhookResults = useQueries({ queries: webhookQueries })
  const isLoading = webhookResults.some((result) => result.isLoading)

  const allWebhooks = useMemo(() => {
    return webhookResults.flatMap((result) => result.data || [])
  }, [webhookResults])

  // Filter webhooks
  const filteredWebhooks = useMemo(() => {
    return allWebhooks.filter((wh: any) => {
      const searchText = filterText.toLowerCase()
      const name = wh.metadata?.name?.toLowerCase() || ''
      return name.includes(searchText)
    })
  }, [allWebhooks, filterText])

  // Apply sorting
  const { sortedData: sortedWebhooks, sortConfig, requestSort } = useTableSort(filteredWebhooks, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: webhooks,
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
  } = usePagination(sortedWebhooks, 10, 'validatingwebhookconfigurations')

  // Helper functions
  const getWebhooksCount = (wh: any) => {
    return wh.webhooks ? wh.webhooks.length : 0
  }

  // Action handlers
  const handleRowClick = (wh: any) => {
    setSelectedWebhook(wh)
    setIsDetailsModalOpen(true)
  }

  const handleEditYAMLClick = (wh: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedWebhook(wh)
    setIsEditYAMLModalOpen(true)
  }

  const handleDeleteClick = (wh: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedWebhook(wh)
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
                  { name: 'Validating Webhooks' }
                ]
              : [{ name: 'Validating Webhooks' }]
          }
        />
      </div>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Validating Webhook Configurations</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            Admission webhooks that validate resources across {clusters?.length || 0} cluster(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name..."
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
                  label="Webhooks"
                  columnKey="webhooksCount"
                  sortKey="webhooks"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.webhooksCount}
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
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading validating webhook configurations...</span>
                    </div>
                  </td>
                </tr>
              ) : webhooks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                      {filterText ? 'No validating webhook configurations found matching your filter' : 'No validating webhook configurations found'}
                    </p>
                  </td>
                </tr>
              ) : (
                webhooks.map((wh: any) => (
                  <tr
                    key={`${wh.clusterName}-${wh.metadata?.name}`}
                    onClick={() => handleRowClick(wh)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  >
                    <td
                      className="px-2 sm:px-4 py-3 text-sm font-medium text-gray-900 dark:text-white truncate"
                      style={{ width: columnWidths.name, maxWidth: columnWidths.name }}
                    >
                      {wh.metadata?.name}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.webhooksCount, maxWidth: columnWidths.webhooksCount }}
                    >
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
                        {getWebhooksCount(wh)} webhook{getWebhooksCount(wh) !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.age, maxWidth: columnWidths.age }}
                    >
                      {formatAge(wh.metadata?.creationTimestamp)}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-right text-sm font-medium"
                      style={{ width: columnWidths.actions, maxWidth: columnWidths.actions }}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleEditYAMLClick(wh, e)}
                          className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(wh, e)}
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
      {selectedWebhook && (
        <>
          <ValidatingWebhookDetailsModal
            webhook={selectedWebhook}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedWebhook(null)
            }}
          />
          <EditValidatingWebhookYAMLModal
            webhook={selectedWebhook}
            isOpen={isEditYAMLModalOpen}
            onClose={() => {
              setIsEditYAMLModalOpen(false)
              setSelectedWebhook(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['validatingwebhooks'] })
            }}
          />
          <DeleteValidatingWebhookModal
            webhook={selectedWebhook}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedWebhook(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['validatingwebhooks'] })
            }}
          />
        </>
      )}
      
      {/* Create Modal - outside selectedWebhook block */}
      {cluster && (
        <CreateValidatingWebhookModal
          clusterName={cluster}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['validatingwebhooks'] })
            setIsCreateModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
