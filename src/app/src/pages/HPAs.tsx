import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getHPAs } from '@/services/api'
import { useMemo, useState, useEffect } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, ArrowsUpDownIcon, PlusIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import HPADetailsModal from '@/components/HPAs/HPADetailsModal'
import EditHPAYAMLModal from '@/components/HPAs/EditHPAYAMLModal'
import ScaleHPAModal from '@/components/HPAs/ScaleHPAModal'
import DeleteHPAModal from '@/components/HPAs/DeleteHPAModal'
import CreateHPAModal from '@/components/HPAs/CreateHPAModal'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

export default function HPAs() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')
  const [selectedHPA, setSelectedHPA] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditYAMLModalOpen, setIsEditYAMLModalOpen] = useState(false)
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createNamespace, setCreateNamespace] = useState(namespace || 'default')

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    namespace: 150,
    metrics: 200,
    minPods: 100,
    maxPods: 100,
    replicas: 100,
    status: 120,
    age: 120,
    actions: 180,
  }, 'hpas-column-widths')

  // Reset state when cluster or namespace changes
  useEffect(() => {
    setSelectedHPA(null)
    setIsDetailsModalOpen(false)
    setIsEditYAMLModalOpen(false)
    setIsScaleModalOpen(false)
    setIsDeleteModalOpen(false)
    setIsCreateModalOpen(false)
    setCreateNamespace(namespace || 'default')
  }, [cluster, namespace])
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch HPAs from all clusters or specific cluster/namespace
  const hpaQueries = useMemo(() => {
    if (!clusters) return []

    if (cluster) {
      return [
        {
          queryKey: ['hpas', cluster, namespace || 'all'],
          queryFn: () => getHPAs(cluster, namespace || 'all'),
          refetchInterval: 5000,
        },
      ]
    }

    return clusters.map((c: any) => ({
      queryKey: ['hpas', c.name, namespace || 'all'],
      queryFn: () => getHPAs(c.name, namespace || 'all'),
      refetchInterval: 5000,
    }))
  }, [clusters, cluster, namespace])

  const hpaResults = useQueries({ queries: hpaQueries })
  const isLoading = hpaResults.some((result) => result.isLoading)

  const allHPAs = useMemo(() => {
    return hpaResults.flatMap((result) => result.data || [])
  }, [hpaResults])

  const filteredHPAs = useMemo(() => {
    return allHPAs.filter((hpa: any) => {
      const searchText = filterText.toLowerCase()
      const name = hpa.metadata?.name?.toLowerCase() || ''
      const ns = hpa.metadata?.namespace?.toLowerCase() || ''
      const targetRef = hpa.spec?.scaleTargetRef?.name?.toLowerCase() || ''

      return name.includes(searchText) || ns.includes(searchText) || targetRef.includes(searchText)
    })
  }, [allHPAs, filterText])

  // Apply sorting
  const { sortedData: sortedHPAs, sortConfig, requestSort } = useTableSort(filteredHPAs, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: hpas,
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
  } = usePagination(sortedHPAs, 10, 'hpas')

  // Helper functions
  const getMetricsDisplay = (hpa: any) => {
    const metrics = hpa.spec?.metrics || []
    if (metrics.length === 0) return 'None'
    
    return metrics.map((metric: any) => {
      if (metric.type === 'Resource') {
        const target = metric.resource?.target
        if (target?.type === 'Utilization') {
          return `${metric.resource.name}: ${target.averageUtilization}%`
        } else if (target?.type === 'AverageValue') {
          return `${metric.resource.name}: ${target.averageValue}`
        }
      } else if (metric.type === 'Pods') {
        return `pods: ${metric.pods?.target?.averageValue}`
      } else if (metric.type === 'Object') {
        return `${metric.object?.metric?.name}`
      }
      return metric.type
    }).join(', ')
  }

  const getStatusDisplay = (hpa: any) => {
    const conditions = hpa.status?.conditions || []
    const scalingActive = conditions.find((c: any) => c.type === 'ScalingActive')
    const scalingLimited = conditions.find((c: any) => c.type === 'ScalingLimited')
    
    if (scalingLimited?.status === 'True') {
      return { label: 'Limited', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' }
    }
    
    if (scalingActive?.status === 'True') {
      return { label: 'Active', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
    }
    
    if (scalingActive?.status === 'False') {
      return { label: 'Inactive', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' }
    }
    
    return { label: 'Unknown', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' }
  }

  // Action handlers
  const handleRowClick = (hpa: any) => {
    setSelectedHPA(hpa)
    setIsDetailsModalOpen(true)
  }

  const handleEditYAMLClick = (hpa: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedHPA(hpa)
    setIsEditYAMLModalOpen(true)
  }

  const handleScaleClick = (hpa: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedHPA(hpa)
    setIsScaleModalOpen(true)
  }

  const handleDeleteClick = (hpa: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedHPA(hpa)
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
                  { name: 'Horizontal Pod Autoscalers' }
                ]
              : [{ name: 'Horizontal Pod Autoscalers' }]
          }
        />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Horizontal Pod Autoscalers</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            All HPAs across {clusters?.length || 0} cluster(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name, namespace or target..."
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
                  label="Metrics"
                  columnKey="metrics"
                  sortKey="spec.metrics"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.metrics}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Min Pods"
                  columnKey="minPods"
                  sortKey="spec.minReplicas"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.minPods}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Max Pods"
                  columnKey="maxPods"
                  sortKey="spec.maxReplicas"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.maxPods}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Replicas"
                  columnKey="replicas"
                  sortKey="status.currentReplicas"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.replicas}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Status"
                  columnKey="status"
                  sortKey="status.conditions"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.status}
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
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading HPAs...</span>
                    </div>
                  </td>
                </tr>
              ) : hpas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                      {filterText ? 'No HPAs found matching your filter' : 'No HPAs found'}
                    </p>
                  </td>
                </tr>
              ) : (
                hpas.map((hpa: any) => {
                  const status = getStatusDisplay(hpa)
                  return (
                    <tr
                      key={`${hpa.clusterName}-${hpa.metadata?.namespace}-${hpa.metadata?.name}`}
                      onClick={() => handleRowClick(hpa)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    >
                      <td
                        className="px-2 sm:px-4 py-3 text-sm font-medium text-gray-900 dark:text-white truncate"
                        style={{ width: columnWidths.name, maxWidth: columnWidths.name }}
                      >
                        {hpa.metadata?.name}
                      </td>
                      <td
                        className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400 truncate"
                        style={{ width: columnWidths.namespace, maxWidth: columnWidths.namespace }}
                      >
                        {hpa.metadata?.namespace}
                      </td>
                      <td
                        className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400 truncate"
                        style={{ width: columnWidths.metrics, maxWidth: columnWidths.metrics }}
                        title={getMetricsDisplay(hpa)}
                      >
                        {getMetricsDisplay(hpa)}
                      </td>
                      <td
                        className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                        style={{ width: columnWidths.minPods, maxWidth: columnWidths.minPods }}
                      >
                        {hpa.spec?.minReplicas || 0}
                      </td>
                      <td
                        className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                        style={{ width: columnWidths.maxPods, maxWidth: columnWidths.maxPods }}
                      >
                        {hpa.spec?.maxReplicas || 0}
                      </td>
                      <td
                        className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                        style={{ width: columnWidths.replicas, maxWidth: columnWidths.replicas }}
                      >
                        {hpa.status?.currentReplicas || 0}
                      </td>
                      <td
                        className="px-2 sm:px-4 py-3 text-sm"
                        style={{ width: columnWidths.status, maxWidth: columnWidths.status }}
                      >
                        <span className={clsx('px-2 py-1 text-xs font-semibold rounded', status.color)}>
                          {status.label}
                        </span>
                      </td>
                      <td
                        className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                        style={{ width: columnWidths.age, maxWidth: columnWidths.age }}
                      >
                        {formatAge(hpa.metadata?.creationTimestamp)}
                      </td>
                      <td
                        className="px-2 sm:px-4 py-3 text-right text-sm font-medium"
                        style={{ width: columnWidths.actions, maxWidth: columnWidths.actions }}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleScaleClick(hpa, e)}
                            className="p-1.5 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Scale min/max replicas"
                          >
                            <ArrowsUpDownIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleEditYAMLClick(hpa, e)}
                            className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                            title="Edit YAML"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(hpa, e)}
                            className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete"
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

      {/* Modals */}
      {selectedHPA && (
        <>
          <HPADetailsModal
            hpa={selectedHPA}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedHPA(null)
            }}
          />
          <ScaleHPAModal
            hpa={selectedHPA}
            isOpen={isScaleModalOpen}
            onClose={() => {
              setIsScaleModalOpen(false)
              setSelectedHPA(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['hpas'] })
            }}
          />
          <EditHPAYAMLModal
            hpa={selectedHPA}
            isOpen={isEditYAMLModalOpen}
            onClose={() => {
              setIsEditYAMLModalOpen(false)
              setSelectedHPA(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['hpas'] })
            }}
          />
          <DeleteHPAModal
            hpa={selectedHPA}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedHPA(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['hpas'] })
            }}
          />
        </>
      )}
      
      {/* Create Modal - outside selectedHPA block */}
      {cluster && (
        <CreateHPAModal
          clusterName={cluster}
          namespace={createNamespace}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['hpas'] })
            setIsCreateModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

