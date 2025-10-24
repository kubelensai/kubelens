import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getCronJobs } from '@/services/api'
import { useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import { PencilSquareIcon, TrashIcon, InformationCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import CronJobDetailsModal from '@/components/CronJobs/CronJobDetailsModal'
import EditCronJobModal from '@/components/CronJobs/EditCronJobModal'
import DeleteCronJobModal from '@/components/CronJobs/DeleteCronJobModal'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'

import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

export default function CronJobs() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()

  const queryClient = useQueryClient()
  const [selectedCronJob, setSelectedCronJob] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [filterText, setFilterText] = useState('')

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    namespace: 150,
    schedule: 150,
    status: 100,
    active: 80,
    lastSchedule: 150,
    age: 120,
    actions: 140,
  }, 'cronjobs-column-widths')

  // Reset state when cluster or namespace changes
  useEffect(() => {
    setSelectedCronJob(null)
    setIsDetailsModalOpen(false)
    setIsEditModalOpen(false)
    setIsDeleteModalOpen(false)
  }, [cluster, namespace])
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch cronjobs from all clusters or specific cluster/namespace
  const cronjobQueries = useQuery({
    queryKey: namespace 
      ? ['cronjobs', cluster, namespace]
      : cluster 
        ? ['cronjobs', cluster] 
        : ['all-cronjobs', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const cronjobs = await getCronJobs(cluster, namespace)
        return cronjobs.map((cronjob: any) => ({ ...cronjob, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const cronjobs = await getCronJobs(cluster)
        return cronjobs.map((cronjob: any) => ({ ...cronjob, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allCronJobs = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const cronjobs = await getCronJobs(cluster.name)
            return cronjobs.map((cronjob: any) => ({ ...cronjob, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching cronjobs from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allCronJobs.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchOnMount: true,
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchInterval: 5000, // Auto-refresh every 5 seconds to show live status updates
    staleTime: 0, // Data is immediately stale, always fetch fresh
  })

  const isLoading = cronjobQueries.isLoading
  const allCronJobs = cronjobQueries.data || []

  // Filter cronjobs by name
  const filteredCronJobs = useMemo(() => {
    if (!filterText) return allCronJobs
    const lowerFilter = filterText.toLowerCase()
    return allCronJobs.filter((cronjob: any) =>
      cronjob.metadata?.name?.toLowerCase().includes(lowerFilter)
    )
  }, [allCronJobs, filterText])

  // Apply sorting
  const { sortedData: sortedCronJobs, sortConfig, requestSort } = useTableSort(filteredCronJobs, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: cronjobs,
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
  } = usePagination(sortedCronJobs, 10, 'cronjobs')

  // Helper function to determine cronjob status
  const getCronJobStatus = (cronjob: any) => {
    const active = cronjob.status?.active?.length || 0
    
    // Check if cronjob is suspended
    if (cronjob.spec.suspend) {
      return { status: 'suspended', color: 'badge-warning' }
    }

    // CronJob is active if there are active jobs
    if (active > 0) {
      return { status: 'active', color: 'badge-success' }
    }

    // Default to ready
    return { status: 'ready', color: 'badge-info' }
  }


  const handleCronJobClick = (cronjob: any) => {
    setSelectedCronJob(cronjob)
    setIsDetailsModalOpen(true)
  }


  const handleEditClick = (cronjob: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedCronJob(cronjob)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (cronjob: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedCronJob(cronjob)
    setIsDeleteModalOpen(true)
  }

  const handleViewDetailsClick = (cronjob: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedCronJob(cronjob)
    setIsDetailsModalOpen(true)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Breadcrumb 
              items={
                cluster
                  ? [
                      { name: cluster, href: "/dashboard" },
                      { name: 'CronJobs' }
                    ]
                  : [{ name: 'CronJobs' }]
              }
        />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">CronJobs</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            {namespace 
              ? `CronJobs in ${cluster} / ${namespace}`
              : cluster 
                ? `All cronjobs in ${cluster}`
                : `All cronjobs across ${clusters?.length || 0} cluster(s)`
            }
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by name..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-11 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
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
                  label="Schedule"
                  columnKey="schedule"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.schedule}
                />
                <ResizableTableHeader
                  label="Status"
                  columnKey="status"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.status}
                />
                <ResizableTableHeader
                  label="Active"
                  columnKey="active"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.active}
                />
                <ResizableTableHeader
                  label="Last Schedule"
                  columnKey="lastSchedule"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.lastSchedule}
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
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading cron jobs...</span>
                    </div>
                  </td>
                </tr>
              ) : cronjobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No cron jobs found</p>
                  </td>
                </tr>
              ) : (
                cronjobs.map((cronjob) => {
                  const cronjobKey = `${cronjob.clusterName}-${cronjob.metadata.namespace}-${cronjob.metadata.name}`
                  const cronjobStatus = getCronJobStatus(cronjob)
                  
                  return (
                    <tr 
                      key={cronjobKey} 
                      onClick={() => handleCronJobClick(cronjob)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    >
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        <div className="truncate max-w-[150px] sm:max-w-none">
                          {cronjob.metadata.name}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {cronjob.metadata.namespace}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-mono">
                        {cronjob.spec.schedule}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                        <span className={clsx('badge text-xs capitalize', cronjobStatus.color)}>
                          {cronjobStatus.status}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center">
                        {cronjob.status?.active?.length || 0}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {cronjob.status?.lastScheduleTime ? formatAge(cronjob.status.lastScheduleTime) : '-'}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {formatAge(cronjob.metadata.creationTimestamp)}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleViewDetailsClick(cronjob, e)}
                            className="p-1.5 text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                            title="View details"
                          >
                            <InformationCircleIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleEditClick(cronjob, e)}
                            className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                            title="Edit cronjob"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(cronjob, e)}
                            className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete cronjob"
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
      {selectedCronJob && (
        <>
          <CronJobDetailsModal
            cronjob={selectedCronJob}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedCronJob(null)
            }}
          />
          <EditCronJobModal
            cronjob={selectedCronJob}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedCronJob(null)
            }}
            onSuccess={async () => {
              // Invalidate and immediately refetch all cronjob queries
              await queryClient.invalidateQueries({ queryKey: ['cronjobs'] })
              await queryClient.invalidateQueries({ queryKey: ['all-cronjobs'] })
              await queryClient.refetchQueries({ queryKey: ['cronjobs'] })
              await queryClient.refetchQueries({ queryKey: ['all-cronjobs'] })
              setIsEditModalOpen(false)
              setSelectedCronJob(null)
            }}
          />
          <DeleteCronJobModal
            cronjob={selectedCronJob}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedCronJob(null)
            }}
            onSuccess={async () => {
              console.log('Delete onSuccess called, refetching cronjobs...')
              // Invalidate and immediately refetch all cronjob queries
              await queryClient.invalidateQueries({ queryKey: ['cronjobs'] })
              await queryClient.invalidateQueries({ queryKey: ['all-cronjobs'] })
              await queryClient.refetchQueries({ queryKey: ['cronjobs'] })
              await queryClient.refetchQueries({ queryKey: ['all-cronjobs'] })
              console.log('CronJobs refetched successfully')
              setIsDeleteModalOpen(false)
              setSelectedCronJob(null)
            }}
          />
        </>
      )}
    </div>
  )
}

