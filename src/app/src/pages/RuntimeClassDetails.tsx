import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CommandLineIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
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

export default function RuntimeClassDetails() {
  const { cluster, runtimeClassName } = useParams<{ cluster: string; runtimeClassName: string }>()
  const navigate = useNavigate()
  const { addNotification } = useNotificationStore()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [runtimeClass, setRuntimeClass] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [yamlContent, setYamlContent] = useState('')
  const [expandedSections, setExpandedSections] = useState({
    labels: false,
    annotations: false,
    nodeSelector: true,
    tolerations: true,
  })

  const [isSaveYamlModalOpen, setIsSaveYamlModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  useEffect(() => {
    if (cluster && runtimeClassName) {
      fetchRuntimeClassDetails()
    }
  }, [cluster, runtimeClassName])

  const fetchRuntimeClassDetails = async () => {
    try {
      setIsLoading(true)
      const [rcRes, eventsRes] = await Promise.all([
        api.get(`/clusters/${cluster}/runtimeclasses/${runtimeClassName}`),
        api.get(`/clusters/${cluster}/events`).catch(() => ({ data: { events: [] } })),
      ])

      const rcData = rcRes.data
      const eventsData = eventsRes.data.events || []

      setRuntimeClass(rcData)
      
      const rcEvents = eventsData.filter((event: any) => {
        if (!runtimeClassName) return false
        
        const involvedObjectMatch = event.involvedObject?.kind === 'RuntimeClass' && 
                                    event.involvedObject?.name === runtimeClassName
        const messageMatch = event.message?.toLowerCase().includes(runtimeClassName.toLowerCase())
        
        return involvedObjectMatch || messageMatch
      })
      
      setEvents(rcEvents)
      
      const k8sManifest: any = {
        apiVersion: rcData.apiVersion || 'node.k8s.io/v1',
        kind: rcData.kind || 'RuntimeClass',
        metadata: rcData.metadata,
        handler: rcData.handler,
      }
      
      if (rcData.overhead) {
        k8sManifest.overhead = rcData.overhead
      }
      
      if (rcData.scheduling) {
        k8sManifest.scheduling = rcData.scheduling
      }
      
      setYamlContent(yaml.dump(k8sManifest, { indent: 2, lineWidth: -1, sortKeys: false }))
    } catch (error) {
      console.error('Failed to fetch runtime class details:', error)
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load runtime class details',
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
      await api.put(`/clusters/${cluster}/runtimeclasses/${runtimeClassName}`, updatedManifest)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Runtime class updated successfully',
      })
      fetchRuntimeClassDetails()
      setIsSaveYamlModalOpen(false)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to update runtime class: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleDeleteRuntimeClass = async () => {
    try {
      await api.delete(`/clusters/${cluster}/runtimeclasses/${runtimeClassName}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Runtime class deleted successfully',
      })
      setIsDeleteModalOpen(false)
      navigate(`/clusters/${cluster}/runtimeclasses`)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete runtime class: ${error.message || 'Unknown error'}`,
      })
    }
  }

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

  if (!runtimeClass) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Runtime class not found</p>
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
          { name: 'Runtime Classes' },
          { name: runtimeClassName || '' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <CommandLineIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              {runtimeClassName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Runtime Class Details
            </p>
          </div>
        </div>

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

      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Runtime Class Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Name:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{runtimeClass.metadata.name}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Handler:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{runtimeClass.handler}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Age:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatAge(runtimeClass.metadata.creationTimestamp)}
                  </p>
                </div>
              </div>

              {runtimeClass.metadata.labels && Object.keys(runtimeClass.metadata.labels).length > 0 && (
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
                    Labels ({Object.keys(runtimeClass.metadata.labels).length})
                  </button>
                  {expandedSections.labels && (
                    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(runtimeClass.metadata.labels).map(([key, value]) => (
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

              {runtimeClass.metadata.annotations && Object.keys(runtimeClass.metadata.annotations).length > 0 && (
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
                    Annotations ({Object.keys(runtimeClass.metadata.annotations).length})
                  </button>
                  {expandedSections.annotations && (
                    <div className="mt-3 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 max-h-60 overflow-y-auto">
                      <div className="space-y-3">
                        {Object.entries(runtimeClass.metadata.annotations).map(([key, value]) => (
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

            {runtimeClass.overhead?.podFixed && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resource Overhead</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {runtimeClass.overhead.podFixed.cpu && (
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/10 dark:to-cyan-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">CPU Overhead</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Additional CPU per pod
                          </p>
                        </div>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {runtimeClass.overhead.podFixed.cpu}
                        </p>
                      </div>
                    </div>
                  )}
                  {runtimeClass.overhead.podFixed.memory && (
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Memory Overhead</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Additional memory per pod
                          </p>
                        </div>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {runtimeClass.overhead.podFixed.memory}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {runtimeClass.scheduling && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Scheduling</h3>
                
                {runtimeClass.scheduling.nodeSelector && Object.keys(runtimeClass.scheduling.nodeSelector).length > 0 && (
                  <div className="mb-4">
                    <button
                      onClick={() => toggleSection('nodeSelector')}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {expandedSections.nodeSelector ? (
                        <ChevronUpIcon className="w-4 h-4" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4" />
                      )}
                      Node Selector ({Object.keys(runtimeClass.scheduling.nodeSelector).length})
                    </button>
                    {expandedSections.nodeSelector && (
                      <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {Object.entries(runtimeClass.scheduling.nodeSelector).map(([key, value]) => (
                            <div key={key} className="flex flex-col gap-1">
                              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{key}</span>
                              <span className="text-sm font-mono text-gray-900 dark:text-white">
                                {value as string}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {runtimeClass.scheduling.tolerations && runtimeClass.scheduling.tolerations.length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleSection('tolerations')}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {expandedSections.tolerations ? (
                        <ChevronUpIcon className="w-4 h-4" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4" />
                      )}
                      Tolerations ({runtimeClass.scheduling.tolerations.length})
                    </button>
                    {expandedSections.tolerations && (
                      <div className="mt-3 space-y-2">
                        {runtimeClass.scheduling.tolerations.map((toleration: any, index: number) => (
                          <div key={index} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                              {toleration.key && (
                                <div>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">Key:</span>
                                  <p className="font-mono text-gray-900 dark:text-white">{toleration.key}</p>
                                </div>
                              )}
                              {toleration.operator && (
                                <div>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">Operator:</span>
                                  <p className="font-mono text-gray-900 dark:text-white">{toleration.operator}</p>
                                </div>
                              )}
                              {toleration.value && (
                                <div>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">Value:</span>
                                  <p className="font-mono text-gray-900 dark:text-white">{toleration.value}</p>
                                </div>
                              )}
                              {toleration.effect && (
                                <div>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">Effect:</span>
                                  <p className="font-mono text-gray-900 dark:text-white">{toleration.effect}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
              emptyMessage="No events found for this runtime class"
              pageSize={20}
            />
          </div>
        )}
      </div>

      {runtimeClass && (
        <>
          <ConfirmationModal
            isOpen={isSaveYamlModalOpen}
            onClose={() => setIsSaveYamlModalOpen(false)}
            onConfirm={handleSaveYaml}
            title="Save YAML Changes"
            message="Are you sure you want to save the YAML changes? This will update the runtime class."
            confirmText="Save"
            type="warning"
          />

          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleDeleteRuntimeClass}
            title="Delete Runtime Class"
            message={`Are you sure you want to delete runtime class "${runtimeClassName}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}

