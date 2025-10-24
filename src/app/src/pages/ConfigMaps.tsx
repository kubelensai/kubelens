import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getConfigMaps } from '@/services/api'
import { useMemo, useState } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'

import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import ConfigMapDetailsModal from '@/components/ConfigMaps/ConfigMapDetailsModal'
import EditConfigMapYAMLModal from '@/components/ConfigMaps/EditConfigMapYAMLModal'
import DeleteConfigMapModal from '@/components/ConfigMaps/DeleteConfigMapModal'
import CreateConfigMapModal from '@/components/ConfigMaps/CreateConfigMapModal'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

export default function ConfigMaps() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')
  const [selectedConfigMap, setSelectedConfigMap] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditYAMLModalOpen, setIsEditYAMLModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createNamespace, setCreateNamespace] = useState(namespace || 'default')

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    namespace: 150,
    keys: 150,
    age: 120,
    actions: 150,
  }, 'configmaps-column-widths')
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch configmaps from all clusters or specific cluster/namespace
  const configMapQueries = useQuery({
    queryKey: namespace 
      ? ['configmaps', cluster, namespace]
      : cluster 
        ? ['configmaps', cluster] 
        : ['all-configmaps', clusters?.map(c => c.name)],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const configMaps = await getConfigMaps(cluster, namespace)
        return configMaps.map((cm: any) => ({ ...cm, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const configMaps = await getConfigMaps(cluster)
        return configMaps.map((cm: any) => ({ ...cm, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allConfigMaps = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const configMaps = await getConfigMaps(cluster.name)
            return configMaps.map((cm: any) => ({ ...cm, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching configmaps from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allConfigMaps.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
  })

  const isLoading = configMapQueries.isLoading
  const allConfigMaps = configMapQueries.data || []

  // Filter configmaps by name
  const filteredConfigMaps = useMemo(() => {
    if (!filterText) return allConfigMaps
    const lowerFilter = filterText.toLowerCase()
    return allConfigMaps.filter((cm: any) => {
      // Filter by name
      if (cm.metadata?.name?.toLowerCase().includes(lowerFilter)) return true
      return false
    })
  }, [allConfigMaps, filterText])

  // Apply sorting
  const { sortedData: sortedConfigMaps, sortConfig, requestSort } = useTableSort(filteredConfigMaps, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: configMaps,
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
  } = usePagination(sortedConfigMaps, 10, 'configmaps')

  // Helper functions
  const getDataKeysCount = (configMap: any) => {
    if (!configMap.data) return 0
    return Object.keys(configMap.data).length
  }

  // Action handlers
  const handleRowClick = (configMap: any) => {
    setSelectedConfigMap(configMap)
    setIsDetailsModalOpen(true)
  }

  const handleEditYAMLClick = (configMap: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedConfigMap(configMap)
    setIsEditYAMLModalOpen(true)
  }

  const handleDeleteClick = (configMap: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedConfigMap(configMap)
    setIsDeleteModalOpen(true)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Breadcrumb 
              items={
                cluster
                  ? [
                      { name: cluster, href: "/dashboard" },
                      { name: 'ConfigMaps' }
                    ]
                  : [{ name: 'ConfigMaps' }]
              }
        />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">ConfigMaps</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            All configmaps across {clusters?.length || 0} cluster(s)
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
              onClick={() => {
                setCreateNamespace(namespace || 'default')
                setIsCreateModalOpen(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              <PlusIcon className="h-5 w-5" />
              Create
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
                  label="Data Keys"
                  columnKey="keys"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.keys}
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
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.actions}
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
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading config maps...</span>
                    </div>
                  </td>
                </tr>
              ) : configMaps.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No config maps found</p>
                  </td>
                </tr>
              ) : (
                configMaps.map((configMap) => {
                  return (
                    <tr 
                      key={`${configMap.clusterName}-${configMap.metadata.namespace}-${configMap.metadata.name}`} 
                      onClick={() => handleRowClick(configMap)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    >
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        <div className="truncate max-w-[150px] sm:max-w-none">
                          {configMap.metadata.name}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {configMap.metadata.namespace}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {getDataKeysCount(configMap)} keys
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {formatAge(configMap.metadata.creationTimestamp)}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleEditYAMLClick(configMap, e)}
                            className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                            title="Edit YAML"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(configMap, e)}
                            className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete configmap"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
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

      {/* ConfigMap Modals */}
      {selectedConfigMap && (
        <>
          <ConfigMapDetailsModal
            configMap={selectedConfigMap}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedConfigMap(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['configmaps'] })
              await queryClient.invalidateQueries({ queryKey: ['all-configmaps'] })
              await queryClient.refetchQueries({ queryKey: ['configmaps'] })
              await queryClient.refetchQueries({ queryKey: ['all-configmaps'] })
            }}
          />
          <EditConfigMapYAMLModal
            configMap={selectedConfigMap}
            isOpen={isEditYAMLModalOpen}
            onClose={() => {
              setIsEditYAMLModalOpen(false)
              setSelectedConfigMap(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['configmaps'] })
              await queryClient.invalidateQueries({ queryKey: ['all-configmaps'] })
              await queryClient.refetchQueries({ queryKey: ['configmaps'] })
              await queryClient.refetchQueries({ queryKey: ['all-configmaps'] })
              setIsEditYAMLModalOpen(false)
              setSelectedConfigMap(null)
            }}
          />
          <DeleteConfigMapModal
            configMap={selectedConfigMap}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedConfigMap(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['configmaps'] })
              await queryClient.invalidateQueries({ queryKey: ['all-configmaps'] })
              await queryClient.refetchQueries({ queryKey: ['configmaps'] })
              await queryClient.refetchQueries({ queryKey: ['all-configmaps'] })
              setIsDeleteModalOpen(false)
              setSelectedConfigMap(null)
            }}
          />
        </>
      )}

      {/* Create ConfigMap Modal - separate from selectedConfigMap condition */}
      {cluster && createNamespace && (
        <CreateConfigMapModal
          clusterName={cluster}
          namespace={createNamespace}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={async () => {
            await queryClient.invalidateQueries({ queryKey: ['configmaps'] })
            await queryClient.invalidateQueries({ queryKey: ['all-configmaps'] })
            await queryClient.refetchQueries({ queryKey: ['configmaps'] })
            await queryClient.refetchQueries({ queryKey: ['all-configmaps'] })
            setIsCreateModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

