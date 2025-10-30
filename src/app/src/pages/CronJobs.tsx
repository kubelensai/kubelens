import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getCronJobs } from '@/services/api'
import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { 
  PencilSquareIcon, 
  TrashIcon, 
  EyeIcon
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import EditCronJobModal from '@/components/CronJobs/EditCronJobModal'
import DeleteCronJobModal from '@/components/CronJobs/DeleteCronJobModal'
import { formatAge } from '@/utils/format'
import { getNextExecution, getTimezoneDisplay } from '@/utils/cron'

export default function CronJobs() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedCronJob, setSelectedCronJob] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

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
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
    staleTime: 0,
  })

  const isLoading = cronjobQueries.isLoading
  const allCronJobs = cronjobQueries.data || []

  // Helper function to determine cronjob status
  const getCronJobStatus = (cronjob: any) => {
    const active = cronjob.status?.active?.length || 0
    
    if (cronjob.spec.suspend) {
      return { status: 'suspended', color: 'yellow' }
    }

    if (active > 0) {
      return { status: 'active', color: 'green' }
    }

    return { status: 'ready', color: 'blue' }
  }

  // Define columns for DataTable
  const columns = useMemo<Column<any>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (cronjob) => (
        <button
          onClick={() => navigate(`/clusters/${cronjob.clusterName}/namespaces/${cronjob.metadata.namespace}/cronjobs/${cronjob.metadata.name}`)}
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-left"
        >
          {cronjob.metadata.name}
        </button>
      ),
      sortable: true,
      sortValue: (cronjob) => cronjob.metadata.name,
      searchValue: (cronjob) => cronjob.metadata.name,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (cronjob) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {cronjob.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (cronjob) => cronjob.metadata.namespace,
      searchValue: (cronjob) => cronjob.metadata.namespace,
    },
    {
      key: 'schedule',
      header: 'Schedule',
      accessor: (cronjob) => (
        <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
          {cronjob.spec.schedule}
        </span>
      ),
      sortable: false,
      searchValue: (cronjob) => cronjob.spec.schedule,
    },
    {
      key: 'nextExecution',
      header: 'Next Execution',
      accessor: (cronjob) => {
        if (cronjob.spec.suspend) {
          return (
            <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
              Suspended
            </span>
          )
        }
        const nextExec = getNextExecution(cronjob.spec.schedule)
        if (!nextExec) {
          return <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
        }
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {nextExec.countdown}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {nextExec.formatted}
            </span>
          </div>
        )
      },
      sortable: true,
      sortValue: (cronjob) => {
        if (cronjob.spec.suspend) return 0
        const nextExec = getNextExecution(cronjob.spec.schedule)
        return nextExec ? nextExec.date.getTime() : 0
      },
      searchValue: (cronjob) => {
        const nextExec = getNextExecution(cronjob.spec.schedule)
        return nextExec ? nextExec.countdown : ''
      },
    },
    {
      key: 'timezone',
      header: 'Timezone',
      accessor: (cronjob) => {
        const nextExec = getNextExecution(cronjob.spec.schedule)
        if (!nextExec) {
          return <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
        }
        return (
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {getTimezoneDisplay(nextExec.timezone)}
          </span>
        )
      },
      sortable: false,
      searchValue: (cronjob) => {
        const nextExec = getNextExecution(cronjob.spec.schedule)
        return nextExec ? nextExec.timezone : ''
      },
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (cronjob) => {
        const cronjobStatus = getCronJobStatus(cronjob)
        const colorClasses = {
          green: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
          blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
        }
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full capitalize',
            colorClasses[cronjobStatus.color as keyof typeof colorClasses]
          )}>
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full',
              cronjobStatus.color === 'green' ? 'bg-green-600' :
              cronjobStatus.color === 'yellow' ? 'bg-yellow-600' :
              'bg-blue-600'
            )} />
            {cronjobStatus.status}
          </span>
        )
      },
      sortable: true,
      sortValue: (cronjob) => getCronJobStatus(cronjob).status,
      searchValue: (cronjob) => getCronJobStatus(cronjob).status,
    },
    {
      key: 'active',
      header: 'Active',
      accessor: (cronjob) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 text-center block">
          {cronjob.status?.active?.length || 0}
        </span>
      ),
      sortable: true,
      sortValue: (cronjob) => cronjob.status?.active?.length || 0,
      searchValue: (cronjob) => String(cronjob.status?.active?.length || 0),
    },
    {
      key: 'lastSchedule',
      header: 'Last Schedule',
      accessor: (cronjob) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {cronjob.status?.lastScheduleTime ? formatAge(cronjob.status.lastScheduleTime) : '-'}
        </span>
      ),
      sortable: true,
      sortValue: (cronjob) => cronjob.status?.lastScheduleTime ? new Date(cronjob.status.lastScheduleTime).getTime() : 0,
      searchValue: (cronjob) => cronjob.status?.lastScheduleTime ? formatAge(cronjob.status.lastScheduleTime) : '',
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (cronjob) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(cronjob.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (cronjob) => new Date(cronjob.metadata.creationTimestamp).getTime(),
      searchValue: (cronjob) => formatAge(cronjob.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (cronjob) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${cronjob.clusterName}/namespaces/${cronjob.metadata.namespace}/cronjobs/${cronjob.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedCronJob(cronjob)
              setIsEditModalOpen(true)
            }}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedCronJob(cronjob)
              setIsDeleteModalOpen(true)
            }}
            className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
      sortable: false,
    },
  ], [navigate])

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Breadcrumb 
          items={
            cluster
              ? [
                  { name: cluster, href: "/dashboard" },
                  { name: 'CRONJOBS' }
                ]
              : [{ name: 'CRONJOBS' }]
          }
        />
      </div>
      
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">CronJobs</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {namespace 
            ? `CronJobs in ${cluster} / ${namespace}`
            : cluster 
              ? `All cronjobs in ${cluster}`
              : `All cronjobs across ${clusters?.length || 0} cluster(s)`
          }
        </p>
      </div>
      
      <DataTable
        data={allCronJobs}
        columns={columns}
        keyExtractor={(cronjob) => `${cronjob.clusterName}-${cronjob.metadata.namespace}-${cronjob.metadata.name}`}
        searchPlaceholder="Search cronjobs by name, namespace, schedule, status..."
        isLoading={isLoading}
        emptyMessage="No cron jobs found"
        pageSize={10}
      />

      {/* Modals */}
      {selectedCronJob && (
        <>
          <EditCronJobModal
            cronjob={selectedCronJob}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedCronJob(null)
            }}
            onSuccess={async () => {
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
              await queryClient.invalidateQueries({ queryKey: ['cronjobs'] })
              await queryClient.invalidateQueries({ queryKey: ['all-cronjobs'] })
              await queryClient.refetchQueries({ queryKey: ['cronjobs'] })
              await queryClient.refetchQueries({ queryKey: ['all-cronjobs'] })
              setIsDeleteModalOpen(false)
              setSelectedCronJob(null)
            }}
          />
        </>
      )}
    </div>
  )
}
