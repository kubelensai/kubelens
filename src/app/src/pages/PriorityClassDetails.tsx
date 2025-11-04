import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronUpIcon,
  TrashIcon,
  ChevronDownIcon as ChevronDownIconOutline,
  ChevronUpIcon as ChevronUpIconOutline,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import Breadcrumb from '@/components/shared/Breadcrumb'
import YamlEditor from '@/components/shared/YamlEditor'
import { DataTable, Column } from '@/components/shared/DataTable'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import yaml from 'js-yaml'
import { formatAge } from '@/utils/format'

type TabType = 'overview' | 'yaml' | 'events'

export default function PriorityClassDetails() {
  const { cluster, priorityClassName } = useParams<{ cluster: string; priorityClassName: string }>()
  const navigate = useNavigate()
  const { addNotification } = useNotificationStore()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [priorityClass, setPriorityClass] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [yamlContent, setYamlContent] = useState('')
  const [expandedSections, setExpandedSections] = useState({
    labels: false,
    annotations: false,
  })

  // Modal states
  const [isSaveYamlModalOpen, setIsSaveYamlModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  useEffect(() => {
    if (cluster && priorityClassName) {
      fetchPriorityClassDetails()
    }
  }, [cluster, priorityClassName])

  const fetchPriorityClassDetails = async () => {
    try {
      setIsLoading(true)
      const [pcRes, eventsRes] = await Promise.all([
        api.get(`/clusters/${cluster}/priorityclasses/${priorityClassName}`),
        api.get(`/clusters/${cluster}/events`).catch(() => ({ data: { events: [] } })),
      ])

      const pcData = pcRes.data
      const eventsData = eventsRes.data.events || []

      setPriorityClass(pcData)
      
      // Filter events related to this priority class
      const pcEvents = eventsData.filter((event: any) => {
        if (!priorityClassName) return false
        
        const involvedObjectMatch = event.involvedObject?.kind === 'PriorityClass' && 
                                    event.involvedObject?.name === priorityClassName
        const messageMatch = event.message?.toLowerCase().includes(priorityClassName.toLowerCase())
        
        return involvedObjectMatch || messageMatch
      })
      
      setEvents(pcEvents)
      
      // Format as Kubernetes manifest
      const k8sManifest: any = {
        apiVersion: pcData.apiVersion || 'scheduling.k8s.io/v1',
        kind: pcData.kind || 'PriorityClass',
        metadata: pcData.metadata,
        value: pcData.value,
      }
      
      if (pcData.globalDefault !== undefined) {
        k8sManifest.globalDefault = pcData.globalDefault
      }
      
      if (pcData.preemptionPolicy) {
        k8sManifest.preemptionPolicy = pcData.preemptionPolicy
      }
      
      if (pcData.description) {
        k8sManifest.description = pcData.description
      }
      
      setYamlContent(yaml.dump(k8sManifest, { indent: 2, lineWidth: -1, sortKeys: false }))
    } catch (error) {
      console.error('Failed to fetch priority class details:', error)
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load priority class details',
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
      await api.put(`/clusters/${cluster}/priorityclasses/${priorityClassName}`, updatedManifest)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Priority class updated successfully',
      })
      fetchPriorityClassDetails()
      setIsSaveYamlModalOpen(false)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to update priority class: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleDeletePriorityClass = async () => {
    try {
      await api.delete(`/clusters/${cluster}/priorityclasses/${priorityClassName}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Priority class deleted successfully',
      })
      setIsDeleteModalOpen(false)
      navigate(`/clusters/${cluster}/priorityclasses`)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete priority class: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Helper function to get priority level color
  const getPriorityColor = (value: number): string => {
    if (value >= 1000000) return 'from-red-500 to-pink-600'
    if (value >= 10000) return 'from-orange-500 to-red-600'
    if (value >= 1000) return 'from-yellow-500 to-orange-600'
    if (value >= 0) return 'from-green-500 to-emerald-600'
    return 'from-gray-500 to-gray-600'
  }

  // Helper function to get priority level label
  const getPriorityLevel = (value: number): string => {
    if (value >= 1000000) return 'System Critical'
    if (value >= 10000) return 'High Priority'
    if (value >= 1000) return 'Medium Priority'
    if (value >= 0) return 'Low Priority'
    return 'Negative Priority'
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

  if (!priorityClass) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Priority class not found</p>
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
          { name: cluster || '' },
          { name: 'Priority Classes' },
          { name: priorityClassName || '' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center',
            getPriorityColor(priorityClass.value)
          )}>
            <ChevronUpIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              {priorityClassName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Priority Class Details
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
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
            {/* Priority Class Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Priority Class Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Name:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{priorityClass.metadata.name}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Age:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatAge(priorityClass.metadata.creationTimestamp)}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Global Default:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {priorityClass.globalDefault ? 'Yes' : 'No'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Preemption Policy:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {priorityClass.preemptionPolicy || 'PreemptLowerPriority'}
                  </p>
                </div>
              </div>

              {priorityClass.description && (
                <div className="mt-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Description:</span>
                  <p className="text-sm text-gray-900 dark:text-white mt-1">
                    {priorityClass.description}
                  </p>
                </div>
              )}

              {/* Labels */}
              {priorityClass.metadata.labels && Object.keys(priorityClass.metadata.labels).length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => toggleSection('labels')}
                    className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    {expandedSections.labels ? (
                      <ChevronUpIconOutline className="w-4 h-4" />
                    ) : (
                      <ChevronDownIconOutline className="w-4 h-4" />
                    )}
                    Labels ({Object.keys(priorityClass.metadata.labels).length})
                  </button>
                  {expandedSections.labels && (
                    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(priorityClass.metadata.labels).map(([key, value]) => (
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
              {priorityClass.metadata.annotations && Object.keys(priorityClass.metadata.annotations).length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => toggleSection('annotations')}
                    className="flex items-center gap-2 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                  >
                    {expandedSections.annotations ? (
                      <ChevronUpIconOutline className="w-4 h-4" />
                    ) : (
                      <ChevronDownIconOutline className="w-4 h-4" />
                    )}
                    Annotations ({Object.keys(priorityClass.metadata.annotations).length})
                  </button>
                  {expandedSections.annotations && (
                    <div className="mt-3 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 max-h-60 overflow-y-auto">
                      <div className="space-y-3">
                        {Object.entries(priorityClass.metadata.annotations).map(([key, value]) => (
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

            {/* Priority Value Visualization */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Priority Value</h3>
              
              <div className={clsx(
                'p-6 rounded-lg bg-gradient-to-r',
                getPriorityColor(priorityClass.value)
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-1">
                      {getPriorityLevel(priorityClass.value)}
                    </h4>
                    <p className="text-xs text-white/80">
                      Priority value determines pod scheduling order
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-bold text-white">
                      {priorityClass.value.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Priority Scale:</h4>
                <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-pink-600"></div>
                    <span>≥ 1,000,000: System Critical (Reserved for system pods)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-orange-500 to-red-600"></div>
                    <span>≥ 10,000: High Priority</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-yellow-500 to-orange-600"></div>
                    <span>≥ 1,000: Medium Priority</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-600"></div>
                    <span>≥ 0: Low Priority</span>
                  </div>
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

        {activeTab === 'events' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <DataTable
              data={events}
              columns={eventColumns}
              keyExtractor={(event) => `${event.metadata?.uid || event.involvedObject?.uid}-${event.lastTimestamp}`}
              searchPlaceholder="Search events..."
              emptyMessage="No events found for this priority class"
              pageSize={20}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {priorityClass && (
        <>
          <ConfirmationModal
            isOpen={isSaveYamlModalOpen}
            onClose={() => setIsSaveYamlModalOpen(false)}
            onConfirm={handleSaveYaml}
            title="Save YAML Changes"
            message="Are you sure you want to save the YAML changes? This will update the priority class."
            confirmText="Save"
            type="warning"
          />

          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleDeletePriorityClass}
            title="Delete Priority Class"
            message={`Are you sure you want to delete priority class "${priorityClassName}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}

