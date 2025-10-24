import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getJobs } from '@/services/api'
import { useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import { PencilSquareIcon, TrashIcon, InformationCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import JobDetailsModal from '@/components/Jobs/JobDetailsModal'
import JobPodsModal from '@/components/Jobs/JobPodsModal'
import EditJobModal from '@/components/Jobs/EditJobModal'
import DeleteJobModal from '@/components/Jobs/DeleteJobModal'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'

import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

export default function Jobs() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()

  const queryClient = useQueryClient()
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isPodsModalOpen, setIsPodsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [filterText, setFilterText] = useState('')

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    namespace: 150,
    completions: 120,
    status: 100,
    duration: 120,
    age: 120,
    actions: 140,
  }, 'jobs-column-widths')

  // Reset state when cluster or namespace changes
  useEffect(() => {
    setSelectedJob(null)
    setIsDetailsModalOpen(false)
    setIsPodsModalOpen(false)
    setIsEditModalOpen(false)
    setIsDeleteModalOpen(false)
  }, [cluster, namespace])
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch jobs from all clusters or specific cluster/namespace
  const jobQueries = useQuery({
    queryKey: namespace 
      ? ['jobs', cluster, namespace]
      : cluster 
        ? ['jobs', cluster] 
        : ['all-jobs', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const jobs = await getJobs(cluster, namespace)
        return jobs.map((job: any) => ({ ...job, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const jobs = await getJobs(cluster)
        return jobs.map((job: any) => ({ ...job, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allJobs = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const jobs = await getJobs(cluster.name)
            return jobs.map((job: any) => ({ ...job, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching jobs from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allJobs.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchOnMount: true,
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchInterval: 5000, // Auto-refresh every 5 seconds to show live status updates
    staleTime: 0, // Data is immediately stale, always fetch fresh
  })

  const isLoading = jobQueries.isLoading
  const allJobs = jobQueries.data || []

  // Filter jobs by name
  const filteredJobs = useMemo(() => {
    if (!filterText) return allJobs
    const lowerFilter = filterText.toLowerCase()
    return allJobs.filter((job: any) =>
      job.metadata?.name?.toLowerCase().includes(lowerFilter)
    )
  }, [allJobs, filterText])

  // Apply sorting
  const { sortedData: sortedJobs, sortConfig, requestSort } = useTableSort(filteredJobs, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: jobs,
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
  } = usePagination(sortedJobs, 10, 'jobs')

  // Helper function to determine job status
  const getJobStatus = (job: any) => {
    const conditions = job.status.conditions || []
    const completions = job.spec.completions || 0
    const succeeded = job.status.succeeded || 0
    const failed = job.status.failed || 0
    const active = job.status.active || 0
    
    // Check if job is suspended
    if (job.spec.suspend) {
      return { status: 'suspended', color: 'badge-warning' }
    }

    // Check for Complete condition
    const completeCondition = conditions.find((c: any) => c.type === 'Complete')
    if (completeCondition && completeCondition.status === 'True') {
      return { status: 'complete', color: 'badge-success' }
    }

    // Check for Failed condition
    const failedCondition = conditions.find((c: any) => c.type === 'Failed')
    if (failedCondition && failedCondition.status === 'True') {
      return { status: 'failed', color: 'badge-error' }
    }

    // Job has succeeded if it has the desired completions
    if (completions > 0 && succeeded >= completions) {
      return { status: 'complete', color: 'badge-success' }
    }

    // Job has failed if there are failures
    if (failed > 0) {
      return { status: 'failed', color: 'badge-error' }
    }

    // Job is running if there are active pods
    if (active > 0) {
      return { status: 'running', color: 'badge-info' }
    }

    // Default to pending
    return { status: 'pending', color: 'badge-warning' }
  }

  // Helper function to calculate job duration
  const getJobDuration = (job: any) => {
    if (!job.status.startTime) return '-'
    
    const startTime = new Date(job.status.startTime)
    const endTime = job.status.completionTime ? new Date(job.status.completionTime) : new Date()
    const durationMs = endTime.getTime() - startTime.getTime()
    const durationSec = Math.floor(durationMs / 1000)

    if (durationSec < 60) return `${durationSec}s`
    if (durationSec < 3600) return `${Math.floor(durationSec / 60)}m`
    if (durationSec < 86400) return `${Math.floor(durationSec / 3600)}h`
    return `${Math.floor(durationSec / 86400)}d`
  }


  const handleJobClick = (job: any) => {
    setSelectedJob(job)
    setIsPodsModalOpen(true)
  }


  const handleEditClick = (job: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedJob(job)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (job: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedJob(job)
    setIsDeleteModalOpen(true)
  }

  const handleViewDetailsClick = (job: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedJob(job)
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
                      { name: 'Jobs' }
                    ]
                  : [{ name: 'Jobs' }]
              }
        />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Jobs</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            {namespace 
              ? `Jobs in ${cluster} / ${namespace}`
              : cluster 
                ? `All jobs in ${cluster}`
                : `All jobs across ${clusters?.length || 0} cluster(s)`
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
                  label="Completions"
                  columnKey="completions"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.completions}
                />
                <ResizableTableHeader
                  label="Status"
                  columnKey="status"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.status}
                />
                <ResizableTableHeader
                  label="Duration"
                  columnKey="duration"
                  sortable={false}
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.duration}
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
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading jobs...</span>
                    </div>
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No jobs found</p>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const jobKey = `${job.clusterName}-${job.metadata.namespace}-${job.metadata.name}`
                  const jobStatus = getJobStatus(job)
                  
                  return (
                    <tr 
                      key={jobKey} 
                      onClick={() => handleJobClick(job)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    >
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        <div className="truncate max-w-[150px] sm:max-w-none">
                          {job.metadata.name}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {job.metadata.namespace}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {job.status.succeeded || 0}/{job.spec.completions || 1}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                        <span className={clsx('badge text-xs capitalize', jobStatus.color)}>
                          {jobStatus.status}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {getJobDuration(job)}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {formatAge(job.metadata.creationTimestamp)}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleViewDetailsClick(job, e)}
                            className="p-1.5 text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                            title="View details"
                          >
                            <InformationCircleIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleEditClick(job, e)}
                            className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                            title="Edit job"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(job, e)}
                            className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete job"
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
      {selectedJob && (
        <>
          <JobDetailsModal
            job={selectedJob}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedJob(null)
            }}
          />
          <JobPodsModal
            job={selectedJob}
            isOpen={isPodsModalOpen}
            onClose={() => {
              setIsPodsModalOpen(false)
              setSelectedJob(null)
            }}
          />
          <EditJobModal
            job={selectedJob}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedJob(null)
            }}
            onSuccess={async () => {
              // Invalidate and immediately refetch all job queries
              await queryClient.invalidateQueries({ queryKey: ['jobs'] })
              await queryClient.invalidateQueries({ queryKey: ['all-jobs'] })
              await queryClient.refetchQueries({ queryKey: ['jobs'] })
              await queryClient.refetchQueries({ queryKey: ['all-jobs'] })
              setIsEditModalOpen(false)
              setSelectedJob(null)
            }}
          />
          <DeleteJobModal
            job={selectedJob}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedJob(null)
            }}
            onSuccess={async () => {
              console.log('Delete onSuccess called, refetching jobs...')
              // Invalidate and immediately refetch all job queries
              await queryClient.invalidateQueries({ queryKey: ['jobs'] })
              await queryClient.invalidateQueries({ queryKey: ['all-jobs'] })
              await queryClient.refetchQueries({ queryKey: ['jobs'] })
              await queryClient.refetchQueries({ queryKey: ['all-jobs'] })
              console.log('Jobs refetched successfully')
              setIsDeleteModalOpen(false)
              setSelectedJob(null)
            }}
          />
        </>
      )}
    </div>
  )
}

