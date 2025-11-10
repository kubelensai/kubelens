import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getJobs } from '@/services/api'
import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { 
  PencilSquareIcon, 
  TrashIcon, 
  InformationCircleIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import JobDetailsModal from '@/components/Jobs/JobDetailsModal'
import JobPodsModal from '@/components/Jobs/JobPodsModal'
import EditJobModal from '@/components/Jobs/EditJobModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { DataTable, Column } from '@/components/shared/DataTable'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface JobData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
    labels?: Record<string, string>
  }
  spec: {
    completions?: number
    parallelism?: number
    suspend?: boolean
  }
  status: {
    succeeded?: number
    failed?: number
    active?: number
    startTime?: string
    completionTime?: string
    conditions?: Array<{
      type: string
      status: string
      reason?: string
    }>
  }
  clusterName: string
}

export default function Jobs() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedJob, setSelectedJob] = useState<JobData | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isPodsModalOpen, setIsPodsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch jobs from all clusters or specific cluster/namespace
  const { data: allJobs, isLoading } = useQuery({
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
    refetchInterval: 5000,
  })

  // Helper function to determine job status
  const getJobStatus = (job: JobData): string => {
    const conditions = job.status.conditions || []
    const completions = job.spec.completions || 0
    const succeeded = job.status.succeeded || 0
    const failed = job.status.failed || 0
    const active = job.status.active || 0
    
    // Check if job is suspended
    if (job.spec.suspend) {
      return 'Suspended'
    }

    // Check for Complete condition
    const completeCondition = conditions.find((c: any) => c.type === 'Complete')
    if (completeCondition && completeCondition.status === 'True') {
      return 'Complete'
    }

    // Check for Failed condition
    const failedCondition = conditions.find((c: any) => c.type === 'Failed')
    if (failedCondition && failedCondition.status === 'True') {
      return 'Failed'
    }

    // Job has succeeded if it has the desired completions
    if (completions > 0 && succeeded >= completions) {
      return 'Complete'
    }

    // Job has failed if there are failures
    if (failed > 0) {
      return 'Failed'
    }

    // Job is running if there are active pods
    if (active > 0) {
      return 'Running'
    }

    // Default to pending
    return 'Pending'
  }

  // Helper function to calculate job duration
  const getJobDuration = (job: JobData): string => {
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

  // Action handlers
  const handleEditClick = (job: JobData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedJob(job)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (job: JobData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedJob(job)
    setIsDeleteModalOpen(true)
  }

  const handleViewDetailsClick = (job: JobData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedJob(job)
    setIsDetailsModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedJob) return
    try {
      await api.delete(`/clusters/${selectedJob.clusterName}/namespaces/${selectedJob.metadata.namespace}/jobs/${selectedJob.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Job deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedJob(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['jobs'] })
      await queryClient.invalidateQueries({ queryKey: ['all-jobs'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete job: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<JobData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (job) => (
        <div className="flex items-center gap-2">
          <BriefcaseIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${job.clusterName}/namespaces/${job.metadata.namespace}/jobs/${job.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {job.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {job.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (job) => job.metadata.name,
      searchValue: (job) => `${job.metadata.name} ${job.clusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (job) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {job.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (job) => job.metadata.namespace,
      searchValue: (job) => job.metadata.namespace,
    },
    {
      key: 'completions',
      header: 'Completions',
      accessor: (job) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {job.status.succeeded || 0}/{job.spec.completions || 1}
        </span>
      ),
      sortable: true,
      sortValue: (job) => job.status.succeeded || 0,
      searchValue: (job) => `${job.status.succeeded || 0}/${job.spec.completions || 1}`,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (job) => {
        const status = getJobStatus(job)
        const isComplete = status === 'Complete'
        const isRunning = status === 'Running'
        const isFailed = status === 'Failed'
        const isSuspended = status === 'Suspended'
        
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
            isComplete
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : isRunning
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
              : isFailed
              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              : isSuspended
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
          )}>
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full',
              isComplete ? 'bg-green-600 dark:bg-green-400' :
              isRunning ? 'bg-blue-600 dark:bg-blue-400' :
              isFailed ? 'bg-red-600 dark:bg-red-400' :
              isSuspended ? 'bg-yellow-600 dark:bg-yellow-400' :
              'bg-gray-600 dark:bg-gray-400'
            )} />
            {status}
          </span>
        )
      },
      sortable: true,
      sortValue: (job) => getJobStatus(job),
      searchValue: (job) => getJobStatus(job),
      filterable: true,
      filterOptions: (data) => {
        const statuses = new Set(data.map(d => getJobStatus(d)))
        return Array.from(statuses).sort()
      },
      filterValue: (job) => getJobStatus(job),
    },
    {
      key: 'duration',
      header: 'Duration',
      accessor: (job) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {getJobDuration(job)}
        </span>
      ),
      sortable: true,
      sortValue: (job) => {
        if (!job.status.startTime) return 0
        const startTime = new Date(job.status.startTime)
        const endTime = job.status.completionTime ? new Date(job.status.completionTime) : new Date()
        return endTime.getTime() - startTime.getTime()
      },
      searchValue: (job) => getJobDuration(job),
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (job) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(job.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (job) => new Date(job.metadata.creationTimestamp).getTime(),
      searchValue: (job) => formatAge(job.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (job) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => handleViewDetailsClick(job, e)}
            className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
            title="Details"
          >
            <InformationCircleIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(job, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(job, e)}
            className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
      sortable: false,
    },
  ], [cluster, navigate])


  return (
    <div className="space-y-4 md:space-y-6">
      <Breadcrumb
        items={[
          ...(cluster ? [{ name: cluster }] : []),
          ...(namespace ? [{ name: namespace }] : []),
          { name: 'Jobs' }
        ]}
      />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
          Jobs
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {namespace 
            ? `Jobs in ${cluster} / ${namespace}`
            : cluster 
              ? `All jobs in ${cluster}`
              : `All jobs across ${clusters?.length || 0} cluster(s)`
          }
        </p>
      </div>
      
      <DataTable
        data={allJobs || []}
        columns={columns}
        keyExtractor={(job) => `${job.clusterName}-${job.metadata.namespace}-${job.metadata.name}`}
        searchPlaceholder="Search jobs by name, cluster, namespace, status..."
        isLoading={isLoading}
        emptyMessage="No jobs found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <BriefcaseIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(job) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <BriefcaseIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${job.clusterName}/namespaces/${job.metadata.namespace}/jobs/${job.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {job.metadata.name}
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {job.metadata.namespace}
                  </div>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {job.clusterName}
                    </div>
                  )}
                </div>
              </div>
              <span className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full shrink-0',
                getJobStatus(job) === 'Complete'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : getJobStatus(job) === 'Running'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                  : getJobStatus(job) === 'Failed'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                  : getJobStatus(job) === 'Suspended'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
              )}>
                <span className={clsx(
                  'w-1.5 h-1.5 rounded-full',
                  getJobStatus(job) === 'Complete' ? 'bg-green-600' :
                  getJobStatus(job) === 'Running' ? 'bg-blue-600' :
                  getJobStatus(job) === 'Failed' ? 'bg-red-600' :
                  getJobStatus(job) === 'Suspended' ? 'bg-yellow-600' :
                  'bg-gray-600'
                )} />
                {getJobStatus(job)}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Completions:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{job.status.succeeded || 0}/{job.spec.completions || 1}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Duration:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{getJobDuration(job)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(job.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => handleViewDetailsClick(job, e)}
                  className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                  title="Details"
                >
                  <InformationCircleIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(job, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(job, e)}
                  className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Delete"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      />

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
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedJob(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete Job"
            message={`Are you sure you want to delete job "${selectedJob.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}

