import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import Breadcrumb from '@/components/shared/Breadcrumb'
import YamlEditor from '@/components/shared/YamlEditor'
import { DataTable, Column } from '@/components/shared/DataTable'
import NextExecutionCountdown from '@/components/CronJobs/NextExecutionCountdown'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import { formatAge } from '@/utils/format'
import { getTimezoneDisplay } from '@/utils/cron'
import api from '@/services/api'
import yaml from 'js-yaml'

interface CronJobDetailsProps {}

type TabType = 'overview' | 'yaml' | 'jobs' | 'events'

export default function CronJobDetails({}: CronJobDetailsProps) {
  const { cluster, namespace, cronjobName } = useParams<{ cluster: string; namespace: string; cronjobName: string }>()
  const navigate = useNavigate()
  const { addNotification } = useNotificationStore()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [cronjob, setCronJob] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [yamlContent, setYamlContent] = useState('')
  const [isSaveYamlModalOpen, setIsSaveYamlModalOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    labels: false,
    annotations: false,
    jobTemplate: false,
  })

  useEffect(() => {
    if (cluster && namespace && cronjobName) {
      fetchCronJobDetails()
    }
  }, [cluster, namespace, cronjobName])

  // Auto-refresh jobs when Jobs tab is active
  useEffect(() => {
    if (activeTab !== 'jobs' || !cluster || !namespace || !cronjobName) return

    const refreshJobs = async () => {
      try {
        const jobsRes = await api.get(`/clusters/${cluster}/jobs?namespace=${namespace}&cronjob=${cronjobName}`)
        const jobsData = jobsRes.data || []
        setJobs(jobsData)
      } catch (error) {
        console.error('Failed to refresh jobs:', error)
      }
    }

    refreshJobs()
    const intervalId = setInterval(refreshJobs, 5000)
    return () => clearInterval(intervalId)
  }, [activeTab, cluster, namespace, cronjobName])

  const fetchCronJobDetails = async () => {
    try {
      setIsLoading(true)
      const [cronjobRes, jobsRes, eventsRes] = await Promise.all([
        api.get(`/clusters/${cluster}/namespaces/${namespace}/cronjobs/${cronjobName}`),
        api.get(`/clusters/${cluster}/jobs?namespace=${namespace}&cronjob=${cronjobName}`).catch(() => ({ data: [] })),
        api.get(`/clusters/${cluster}/events`).catch(() => ({ data: { events: [] } })),
      ])

      const cronjobData = cronjobRes.data
      const jobsData = jobsRes.data || []
      const eventsData = eventsRes.data.events || []

      setCronJob(cronjobData)
      setJobs(jobsData)
      
      // Filter events related to this cronjob
      const cronjobEvents = eventsData.filter((event: any) => {
        if (!cronjobName) return false
        
        const involvedObjectMatch = event.involvedObject?.kind === 'CronJob' && 
                                    event.involvedObject?.name === cronjobName &&
                                    event.involvedObject?.namespace === namespace
        const messageMatch = event.message?.toLowerCase().includes(cronjobName.toLowerCase())
        
        return involvedObjectMatch || messageMatch
      })
      
      setEvents(cronjobEvents)
      
      // Format as Kubernetes manifest
      const k8sManifest = {
        apiVersion: cronjobData.apiVersion || 'batch/v1',
        kind: cronjobData.kind || 'CronJob',
        metadata: cronjobData.metadata,
        spec: cronjobData.spec,
        status: cronjobData.status,
      }
      setYamlContent(yaml.dump(k8sManifest, { indent: 2, lineWidth: -1, sortKeys: false }))
    } catch (error) {
      console.error('Failed to fetch cronjob details:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const handleSaveYaml = async () => {
    try {
      const updatedManifest = yaml.load(yamlContent)
      await api.put(`/clusters/${cluster}/namespaces/${namespace}/cronjobs/${cronjobName}`, updatedManifest)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'CronJob updated successfully',
      })
      fetchCronJobDetails()
      setIsSaveYamlModalOpen(false)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to update cronjob: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const getCronJobStatus = () => {
    if (!cronjob) return 'Unknown'
    
    if (cronjob.spec.suspend) {
      return 'Suspended'
    }

    const active = cronjob.status?.active?.length || 0
    if (active > 0) {
      return 'Active'
    }

    return 'Ready'
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'text-green-600 dark:text-green-400'
      case 'suspended':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'ready':
        return 'text-blue-600 dark:text-blue-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  // Job columns
  const jobColumns = useMemo<Column<any>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (job) => (
        <button
          onClick={() => navigate(`/clusters/${cluster}/namespaces/${namespace}/jobs/${job.metadata.name}`)}
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-left"
        >
          {job.metadata.name}
        </button>
      ),
      sortable: true,
      sortValue: (job) => job.metadata.name,
      searchValue: (job) => job.metadata.name,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (job) => {
        const succeeded = job.status?.succeeded || 0
        const failed = job.status?.failed || 0
        const active = job.status?.active || 0
        
        let status = 'Unknown'
        let color = 'gray'
        
        if (succeeded > 0) {
          status = 'Succeeded'
          color = 'green'
        } else if (failed > 0) {
          status = 'Failed'
          color = 'red'
        } else if (active > 0) {
          status = 'Running'
          color = 'blue'
        }
        
        const colorClasses = {
          green: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          red: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
          blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
          gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
        }
        
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
            colorClasses[color as keyof typeof colorClasses]
          )}>
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full',
              color === 'green' ? 'bg-green-600' :
              color === 'red' ? 'bg-red-600' :
              color === 'blue' ? 'bg-blue-600' :
              'bg-gray-600'
            )} />
            {status}
          </span>
        )
      },
      sortable: true,
      sortValue: (job) => {
        const succeeded = job.status?.succeeded || 0
        const failed = job.status?.failed || 0
        const active = job.status?.active || 0
        if (succeeded > 0) return 'Succeeded'
        if (failed > 0) return 'Failed'
        if (active > 0) return 'Running'
        return 'Unknown'
      },
      searchValue: (job) => {
        const succeeded = job.status?.succeeded || 0
        const failed = job.status?.failed || 0
        const active = job.status?.active || 0
        if (succeeded > 0) return 'Succeeded'
        if (failed > 0) return 'Failed'
        if (active > 0) return 'Running'
        return 'Unknown'
      },
    },
    {
      key: 'completions',
      header: 'Completions',
      accessor: (job) => {
        const succeeded = job.status?.succeeded || 0
        const completions = job.spec?.completions || 1
        return (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {succeeded}/{completions}
          </span>
        )
      },
      sortable: true,
      sortValue: (job) => (job.status?.succeeded || 0) / (job.spec?.completions || 1),
      searchValue: (job) => `${job.status?.succeeded || 0}/${job.spec?.completions || 1}`,
    },
    {
      key: 'duration',
      header: 'Duration',
      accessor: (job) => {
        const startTime = job.status?.startTime
        const completionTime = job.status?.completionTime
        
        if (!startTime) {
          return <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
        }
        
        const start = new Date(startTime).getTime()
        const end = completionTime ? new Date(completionTime).getTime() : Date.now()
        const duration = Math.floor((end - start) / 1000)
        
        if (duration < 60) {
          return <span className="text-sm text-gray-700 dark:text-gray-300">{duration}s</span>
        }
        
        const minutes = Math.floor(duration / 60)
        const seconds = duration % 60
        return (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {minutes}m {seconds}s
          </span>
        )
      },
      sortable: true,
      sortValue: (job) => {
        const startTime = job.status?.startTime
        const completionTime = job.status?.completionTime
        if (!startTime) return 0
        const start = new Date(startTime).getTime()
        const end = completionTime ? new Date(completionTime).getTime() : Date.now()
        return end - start
      },
      searchValue: (job) => {
        const startTime = job.status?.startTime
        const completionTime = job.status?.completionTime
        if (!startTime) return ''
        const start = new Date(startTime).getTime()
        const end = completionTime ? new Date(completionTime).getTime() : Date.now()
        const duration = Math.floor((end - start) / 1000)
        return `${duration}s`
      },
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
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${cluster}/namespaces/${namespace}/jobs/${job.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
        </div>
      ),
      sortable: false,
    },
  ], [cluster, namespace, navigate])

  // Event columns
  const eventColumns = useMemo<Column<any>[]>(() => [
    {
      key: 'type',
      header: 'Type',
      accessor: (event) => (
        <span className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
          event.type === 'Normal'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
        )}>
          {event.type || 'Unknown'}
        </span>
      ),
      sortable: true,
      sortValue: (event) => event.type || '',
      searchValue: (event) => event.type || '',
    },
    {
      key: 'reason',
      header: 'Reason',
      accessor: (event) => (
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {event.reason || '-'}
        </span>
      ),
      sortable: true,
      sortValue: (event) => event.reason || '',
      searchValue: (event) => event.reason || '',
    },
    {
      key: 'message',
      header: 'Message',
      accessor: (event) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {event.message || '-'}
        </span>
      ),
      sortable: false,
      searchValue: (event) => event.message || '',
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (event) => {
        const timestamp = event.lastTimestamp || event.firstTimestamp
        if (!timestamp) return <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
        return (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {formatAge(timestamp)}
          </span>
        )
      },
      sortable: true,
      sortValue: (event) => {
        const timestamp = event.lastTimestamp || event.firstTimestamp
        if (!timestamp) return 0
        return new Date(timestamp).getTime()
      },
      searchValue: (event) => {
        const timestamp = event.lastTimestamp || event.firstTimestamp
        return timestamp ? formatAge(timestamp) : ''
      },
    },
  ], [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!cronjob) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">CronJob not found</p>
      </div>
    )
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'yaml', label: 'YAML' },
    { id: 'jobs', label: 'Jobs History' },
    { id: 'events', label: 'Events' },
  ]

  return (
    <div className="space-y-4 md:space-y-6">
      <Breadcrumb
        items={[
          { name: cluster || '', href: `/clusters/${cluster}` },
          { name: namespace || '', href: `/clusters/${cluster}/namespaces/${namespace}/cronjobs` },
          { name: 'CRONJOBS', href: `/clusters/${cluster}/namespaces/${namespace}/cronjobs` },
          { name: cronjobName || '' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
            <ClockIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              {cronjobName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              CronJob Details
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Next Execution */}
            <NextExecutionCountdown 
              schedule={cronjob.spec.schedule}
              suspended={cronjob.spec.suspend}
            />

            {/* CronJob Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">CronJob Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Name:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{cronjob.metadata.name}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Namespace:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{cronjob.metadata.namespace}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
                  <p className={clsx('text-sm font-medium', getStatusColor(getCronJobStatus()))}>
                    {getCronJobStatus()}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Schedule:</span>
                  <p className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                    {cronjob.spec.schedule}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Timezone:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {getTimezoneDisplay(Intl.DateTimeFormat().resolvedOptions().timeZone)}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Concurrency Policy:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {cronjob.spec.concurrencyPolicy || 'Allow'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Suspend:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {cronjob.spec.suspend ? 'Yes' : 'No'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Starting Deadline Seconds:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {cronjob.spec.startingDeadlineSeconds || 'Not set'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Age:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatAge(cronjob.metadata.creationTimestamp)}
                  </p>
                </div>
              </div>

              {/* Labels */}
              {cronjob.metadata.labels && Object.keys(cronjob.metadata.labels).length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => toggleSection('labels')}
                    className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    {expandedSections.labels ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )}
                    Labels ({Object.keys(cronjob.metadata.labels).length})
                  </button>
                  {expandedSections.labels && (
                    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(cronjob.metadata.labels).map(([key, value]) => (
                          <div key={key} className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{key}</span>
                            <span className="text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-1 rounded border border-blue-200 dark:border-blue-700">
                              {value as string}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Annotations */}
              {cronjob.metadata.annotations && Object.keys(cronjob.metadata.annotations).length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => toggleSection('annotations')}
                    className="flex items-center gap-2 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                  >
                    {expandedSections.annotations ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )}
                    Annotations ({Object.keys(cronjob.metadata.annotations).length})
                  </button>
                  {expandedSections.annotations && (
                    <div className="mt-3 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 max-h-60 overflow-y-auto">
                      <div className="space-y-3">
                        {Object.entries(cronjob.metadata.annotations).map(([key, value]) => (
                          <div key={key} className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">{key}</span>
                            <p className="text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-1 rounded border border-purple-200 dark:border-purple-700 break-all">
                              {value as string}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Job Status */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Job Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {cronjob.status?.active?.length || 0}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Active</p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {cronjob.status?.lastScheduleTime ? formatAge(cronjob.status.lastScheduleTime) : '-'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Last Schedule</p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {cronjob.status?.lastSuccessfulTime ? formatAge(cronjob.status.lastSuccessfulTime) : '-'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Last Successful</p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {cronjob.spec.successfulJobsHistoryLimit || 3}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">History Limit</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'yaml' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">YAML Manifest</h3>
              <button
                onClick={() => setIsSaveYamlModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
            <YamlEditor 
              value={yamlContent} 
              onChange={(value) => setYamlContent(value)} 
              readOnly={false}
            />
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <DataTable
              data={jobs}
              columns={jobColumns}
              keyExtractor={(job) => job.metadata.uid}
              searchPlaceholder="Search jobs..."
              emptyMessage="No jobs found for this cronjob"
              pageSize={20}
            />
          </div>
        )}

        {activeTab === 'events' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <DataTable
              data={events}
              columns={eventColumns}
              keyExtractor={(event) => `${event.metadata?.uid || event.involvedObject?.uid}-${event.lastTimestamp}`}
              searchPlaceholder="Search events..."
              emptyMessage="No events found for this cronjob"
              pageSize={20}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <ConfirmationModal
        isOpen={isSaveYamlModalOpen}
        onClose={() => setIsSaveYamlModalOpen(false)}
        onConfirm={handleSaveYaml}
        title="Save YAML Changes"
        message="Are you sure you want to save the YAML changes? This will update the cronjob."
        confirmText="Save"
        type="warning"
      />
    </div>
  )
}

