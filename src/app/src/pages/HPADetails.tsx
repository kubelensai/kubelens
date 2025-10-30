import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  AdjustmentsHorizontalIcon,
  TrashIcon,
  ArrowsUpDownIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import Breadcrumb from '@/components/shared/Breadcrumb'
import YamlEditor from '@/components/shared/YamlEditor'
import { DataTable, Column } from '@/components/shared/DataTable'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import ScaleHPAModal from '@/components/HPAs/ScaleHPAModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import yaml from 'js-yaml'
import { formatAge } from '@/utils/format'

type TabType = 'overview' | 'yaml' | 'events'

export default function HPADetails() {
  const { cluster, namespace, hpaName } = useParams<{ cluster: string; namespace: string; hpaName: string }>()
  const navigate = useNavigate()
  const { addNotification } = useNotificationStore()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [hpa, setHpa] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [yamlContent, setYamlContent] = useState('')
  const [expandedSections, setExpandedSections] = useState({
    labels: false,
    annotations: false,
    metrics: true,
    conditions: true,
  })

  // Modal states
  const [isSaveYamlModalOpen, setIsSaveYamlModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false)

  useEffect(() => {
    if (cluster && namespace && hpaName) {
      fetchHPADetails()
    }
  }, [cluster, namespace, hpaName])

  const fetchHPADetails = async () => {
    try {
      setIsLoading(true)
      const [hpaRes, eventsRes] = await Promise.all([
        api.get(`/clusters/${cluster}/namespaces/${namespace}/hpas/${hpaName}`),
        api.get(`/clusters/${cluster}/events`).catch(() => ({ data: { events: [] } })),
      ])

      const hpaData = hpaRes.data
      const eventsData = eventsRes.data.events || []

      setHpa(hpaData)
      
      // Filter events related to this HPA
      const hpaEvents = eventsData.filter((event: any) => {
        if (!hpaName) return false
        
        const involvedObjectMatch = event.involvedObject?.kind === 'HorizontalPodAutoscaler' && 
                                    event.involvedObject?.name === hpaName &&
                                    event.involvedObject?.namespace === namespace
        const messageMatch = event.message?.toLowerCase().includes(hpaName.toLowerCase())
        
        return involvedObjectMatch || messageMatch
      })
      
      setEvents(hpaEvents)
      
      // Format as Kubernetes manifest
      const k8sManifest: any = {
        apiVersion: hpaData.apiVersion || 'autoscaling/v2',
        kind: hpaData.kind || 'HorizontalPodAutoscaler',
        metadata: hpaData.metadata,
        spec: hpaData.spec,
      }
      
      if (hpaData.status) {
        k8sManifest.status = hpaData.status
      }
      
      setYamlContent(yaml.dump(k8sManifest, { indent: 2, lineWidth: -1, sortKeys: false }))
    } catch (error) {
      console.error('Failed to fetch HPA details:', error)
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load HPA details',
      })
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
      await api.put(`/clusters/${cluster}/namespaces/${namespace}/hpas/${hpaName}`, updatedManifest)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'HPA updated successfully',
      })
      fetchHPADetails()
      setIsSaveYamlModalOpen(false)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to update HPA: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleDeleteHPA = async () => {
    try {
      await api.delete(`/clusters/${cluster}/namespaces/${namespace}/hpas/${hpaName}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'HPA deleted successfully',
      })
      setIsDeleteModalOpen(false)
      navigate(`/clusters/${cluster}/namespaces/${namespace}/hpas`)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete HPA: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Helper function to calculate percentage for progress bar
  const calculatePercentage = (current: number, target: number): number => {
    if (target === 0) return 0
    return Math.min(Math.round((current / target) * 100), 100)
  }

  // Helper function to get metric color based on status
  const getMetricColor = (current: number, target: number): string => {
    const percentage = (current / target) * 100
    if (percentage < 80) return 'bg-green-500'
    if (percentage < 95) return 'bg-yellow-500'
    return 'bg-red-500'
  }

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

  if (!hpa) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">HPA not found</p>
      </div>
    )
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'yaml', label: 'YAML' },
    { id: 'events', label: 'Events' },
  ]

  return (
    <div className="space-y-4 md:space-y-6">
      <Breadcrumb
        items={[
          { name: cluster || '', href: `/clusters/${cluster}` },
          { name: namespace || '', href: `/clusters/${cluster}/namespaces/${namespace}/hpas` },
          { name: 'HPAs', href: `/clusters/${cluster}/namespaces/${namespace}/hpas` },
          { name: hpaName || '' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <AdjustmentsHorizontalIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              {hpaName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              HPA Details
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsScaleModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
            title="Scale"
          >
            <ArrowsUpDownIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Scale</span>
          </button>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Delete</span>
          </button>
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
            {/* HPA Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">HPA Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Name:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{hpa.metadata.name}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Namespace:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{hpa.metadata.namespace}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Age:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatAge(hpa.metadata.creationTimestamp)}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Target:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {hpa.spec.scaleTargetRef.kind}/{hpa.spec.scaleTargetRef.name}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Min Replicas:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {hpa.spec.minReplicas || 1}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Max Replicas:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {hpa.spec.maxReplicas}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Current Replicas:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {hpa.status?.currentReplicas || 0}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Desired Replicas:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {hpa.status?.desiredReplicas || 0}
                  </p>
                </div>
              </div>

              {/* Labels */}
              {hpa.metadata.labels && Object.keys(hpa.metadata.labels).length > 0 && (
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
                    Labels ({Object.keys(hpa.metadata.labels).length})
                  </button>
                  {expandedSections.labels && (
                    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(hpa.metadata.labels).map(([key, value]) => (
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
              {hpa.metadata.annotations && Object.keys(hpa.metadata.annotations).length > 0 && (
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
                    Annotations ({Object.keys(hpa.metadata.annotations).length})
                  </button>
                  {expandedSections.annotations && (
                    <div className="mt-3 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 max-h-60 overflow-y-auto">
                      <div className="space-y-3">
                        {Object.entries(hpa.metadata.annotations).map(([key, value]) => (
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

            {/* Metrics with Progress Bars */}
            {hpa.spec.metrics && hpa.spec.metrics.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <button
                  onClick={() => toggleSection('metrics')}
                  className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 w-full"
                >
                  {expandedSections.metrics ? (
                    <ChevronUpIcon className="w-5 h-5" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5" />
                  )}
                  Metrics ({hpa.spec.metrics.length})
                </button>
                {expandedSections.metrics && (
                  <div className="mt-4 space-y-6">
                    {hpa.spec.metrics.map((metric: any, index: number) => {
                      const currentMetric = hpa.status?.currentMetrics?.[index]
                      
                      // Debug logging
                      console.log('Metric:', metric)
                      console.log('Current Metric:', currentMetric)
                      
                      if (metric.type === 'Resource' && metric.resource) {
                        const target = metric.resource.target
                        const current = currentMetric?.resource?.current
                        
                        if (target.type === 'Utilization') {
                          const targetValue = target.averageUtilization || 0
                          // Check both averageUtilization and averageValue for current metrics
                          const currentValue = current?.averageUtilization 
                            ? current.averageUtilization 
                            : (current?.averageValue ? parseInt(current.averageValue) : 0)
                          const percentage = calculatePercentage(currentValue, targetValue)
                          
                          return (
                            <div key={index} className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                                    {metric.resource.name} Utilization
                                  </h4>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Resource metric
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {currentValue}%
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Target: {targetValue}%
                                  </p>
                                </div>
                              </div>
                              <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={clsx(
                                    'h-full rounded-full transition-all duration-500',
                                    getMetricColor(currentValue, targetValue)
                                  )}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <div className="flex justify-between mt-2 text-xs text-gray-600 dark:text-gray-400">
                                <span>0%</span>
                                <span>{targetValue}%</span>
                                <span>100%</span>
                              </div>
                            </div>
                          )
                        } else if (target.type === 'AverageValue') {
                          const targetValue = target.averageValue || '0'
                          const currentValue = current?.averageValue || '0'
                          
                          return (
                            <div key={index} className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-lg border border-green-200 dark:border-green-800">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                                    {metric.resource.name} Average Value
                                  </h4>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Resource metric
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {currentValue}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Target: {targetValue}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )
                        }
                      } else if (metric.type === 'Pods' && metric.pods) {
                        const targetValue = metric.pods.target.averageValue || '0'
                        const currentValue = currentMetric?.pods?.current?.averageValue || '0'
                        
                        return (
                          <div key={index} className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {metric.pods.metric.name}
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  Pods metric
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                  {currentValue}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Target: {targetValue}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      } else if (metric.type === 'Object' && metric.object) {
                        const targetValue = metric.object.target.value || '0'
                        const currentValue = currentMetric?.object?.current?.value || '0'
                        
                        return (
                          <div key={index} className="p-4 bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/10 dark:to-rose-900/10 rounded-lg border border-pink-200 dark:border-pink-800">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {metric.object.metric.name}
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  Object metric: {metric.object.describedObject.kind}/{metric.object.describedObject.name}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                  {currentValue}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Target: {targetValue}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      
                      return null
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Conditions */}
            {hpa.status?.conditions && hpa.status.conditions.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <button
                  onClick={() => toggleSection('conditions')}
                  className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 w-full"
                >
                  {expandedSections.conditions ? (
                    <ChevronUpIcon className="w-5 h-5" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5" />
                  )}
                  Conditions ({hpa.status.conditions.length})
                </button>
                {expandedSections.conditions && (
                  <div className="mt-4 space-y-3">
                    {hpa.status.conditions.map((condition: any, index: number) => (
                      <div key={index} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {condition.type}
                              </span>
                              <span className={clsx(
                                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                                condition.status === 'True'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                              )}>
                                {condition.status}
                              </span>
                            </div>
                            {condition.reason && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                Reason: {condition.reason}
                              </p>
                            )}
                            {condition.message && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {condition.message}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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

        {activeTab === 'events' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <DataTable
              data={events}
              columns={eventColumns}
              keyExtractor={(event) => `${event.metadata?.uid || event.involvedObject?.uid}-${event.lastTimestamp}`}
              searchPlaceholder="Search events..."
              emptyMessage="No events found for this HPA"
              pageSize={20}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {hpa && (
        <>
          <ConfirmationModal
            isOpen={isSaveYamlModalOpen}
            onClose={() => setIsSaveYamlModalOpen(false)}
            onConfirm={handleSaveYaml}
            title="Save YAML Changes"
            message="Are you sure you want to save the YAML changes? This will update the HPA."
            confirmText="Save"
            type="warning"
          />

          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleDeleteHPA}
            title="Delete HPA"
            message={`Are you sure you want to delete HPA "${hpaName}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />

          <ScaleHPAModal
            hpa={hpa}
            isOpen={isScaleModalOpen}
            onClose={() => setIsScaleModalOpen(false)}
            onSuccess={() => {
              fetchHPADetails()
              setIsScaleModalOpen(false)
            }}
          />
        </>
      )}
    </div>
  )
}

