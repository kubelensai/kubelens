import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  CubeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import Breadcrumb from '@/components/shared/Breadcrumb'
import YamlEditor from '@/components/shared/YamlEditor'
import Terminal from '@/components/shared/Terminal'
import EnhancedMultiPodLogViewer from '@/components/shared/EnhancedMultiPodLogViewer'
import PodDetailContent from '@/components/shared/PodDetailContent'
import { DataTable, Column } from '@/components/shared/DataTable'
import api from '@/services/api'
import yaml from 'js-yaml'
import { formatAge } from '@/utils/format'

interface PodDetailsProps {}

type TabType = 'overview' | 'yaml' | 'logs' | 'terminal' | 'events'

export default function PodDetails({}: PodDetailsProps) {
  const { cluster, namespace, podName } = useParams<{ cluster: string; namespace: string; podName: string }>()
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as TabType | null
  const [activeTab, setActiveTab] = useState<TabType>(tabParam || 'overview')
  const [pod, setPod] = useState<any>(null)
  const [podMetrics, setPodMetrics] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [yamlContent, setYamlContent] = useState('')
  const [selectedContainer, setSelectedContainer] = useState<string>('')
  const [selectedShell, setSelectedShell] = useState<string>('/bin/sh')
  const [expandedSections, setExpandedSections] = useState({
    falseConditions: false,
  })

  useEffect(() => {
    if (cluster && namespace && podName) {
      fetchPodDetails()
    }
  }, [cluster, namespace, podName])

  const fetchPodDetails = async () => {
    try {
      setIsLoading(true)
      const [podRes, metricsRes, eventsRes] = await Promise.all([
        api.get(`/clusters/${cluster}/namespaces/${namespace}/pods/${podName}`),
        api.get(`/clusters/${cluster}/namespaces/${namespace}/pods/${podName}/metrics`).catch(() => ({ data: null })),
        api.get(`/clusters/${cluster}/events`).catch(() => ({ data: { events: [] } })),
      ])

      const podData = podRes.data
      const metricsData = metricsRes.data
      const eventsData = eventsRes.data.events || []

      setPod(podData)
      setPodMetrics(metricsData)
      
      // Set default selected container
      if (podData.spec?.containers?.length > 0 && !selectedContainer) {
        setSelectedContainer(podData.spec.containers[0].name)
      }
      
      // Filter events related to this pod
      const podEvents = eventsData.filter((event: any) => {
        if (!podName) return false
        
        const involvedObjectMatch = event.involvedObject?.kind === 'Pod' && 
                                    event.involvedObject?.name === podName &&
                                    event.involvedObject?.namespace === namespace
        const messageMatch = event.message?.toLowerCase().includes(podName.toLowerCase())
        
        return involvedObjectMatch || messageMatch
      })
      
      setEvents(podEvents)
      
      // Format as Kubernetes manifest
      const k8sManifest = {
        apiVersion: podData.apiVersion || 'v1',
        kind: podData.kind || 'Pod',
        metadata: podData.metadata,
        spec: podData.spec,
        status: podData.status,
      }
      setYamlContent(yaml.dump(k8sManifest, { indent: 2, lineWidth: -1, sortKeys: false }))
    } catch (error) {
      console.error('Failed to fetch pod details:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const getConditionIcon = (status: string) => {
    if (status === 'True') {
      return <CheckCircleIcon className="w-5 h-5 text-green-500" />
    } else if (status === 'False') {
      return <XCircleIcon className="w-5 h-5 text-red-500" />
    }
    return <ExclamationCircleIcon className="w-5 h-5 text-yellow-500" />
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

  if (!pod) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Pod not found</p>
      </div>
    )
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'yaml', label: 'YAML' },
    { id: 'logs', label: 'Logs' },
    { id: 'terminal', label: 'Terminal' },
    { id: 'events', label: 'Events' },
  ]

  const trueConditions = pod.status?.conditions?.filter((c: any) => c.status === 'True') || []
  const falseConditions = pod.status?.conditions?.filter((c: any) => c.status !== 'True') || []

  return (
    <div className="space-y-4 md:space-y-6">
      <Breadcrumb
        items={[
          { name: cluster || '', href: `/clusters/${cluster}` },
          { name: namespace || '', href: `/clusters/${cluster}/namespaces/${namespace}/pods` },
          { name: podName || '' },
        ]}
      />

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <CubeIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            {podName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pod Details
          </p>
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
            {/* Pod Detail Content - Using Reusable Component */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <PodDetailContent pod={pod} podMetrics={podMetrics} />
            </div>

            {/* Pod Conditions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-white mb-4">Pod Conditions</h3>
              <div className="space-y-3">
                {trueConditions.map((condition: any, index: number) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    {getConditionIcon(condition.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-white">{condition.type}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatAge(condition.lastTransitionTime)}
                        </span>
                      </div>
                      {condition.message && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{condition.message}</p>
                      )}
                    </div>
                  </div>
                ))}
                
                {falseConditions.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => toggleSection('falseConditions')}
                      className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    >
                      {expandedSections.falseConditions ? (
                        <ChevronUpIcon className="w-4 h-4" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4" />
                      )}
                      Other Conditions ({falseConditions.length})
                    </button>
                    {expandedSections.falseConditions && (
                      <div className="mt-2 space-y-2">
                        {falseConditions.map((condition: any, index: number) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            {getConditionIcon(condition.status)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900 dark:text-white">{condition.type}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {formatAge(condition.lastTransitionTime)}
                                </span>
                              </div>
                              {condition.message && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{condition.message}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'yaml' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">YAML Manifest</h3>
              <button
                onClick={async () => {
                  try {
                    const updatedManifest = yaml.load(yamlContent)
                    await api.put(`/clusters/${cluster}/namespaces/${namespace}/pods/${podName}`, updatedManifest)
                    alert('Pod updated successfully')
                    fetchPodDetails()
                  } catch (error: any) {
                    alert(`Failed to update pod: ${error.message || 'Unknown error'}`)
                  }
                }}
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

        {activeTab === 'logs' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            {pod && (
              <EnhancedMultiPodLogViewer
                cluster={cluster || ''}
                namespace={namespace || ''}
                pods={[pod]}
                container={selectedContainer}
                containers={pod.spec?.containers || []}
                onContainerChange={setSelectedContainer}
              />
            )}
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-4 flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Container
                </label>
                <select
                  value={selectedContainer}
                  onChange={(e) => setSelectedContainer(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {pod.spec?.containers?.map((container: any) => (
                    <option key={container.name} value={container.name}>
                      {container.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Shell
                </label>
                <select
                  value={selectedShell}
                  onChange={(e) => setSelectedShell(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="/bin/sh">sh (default)</option>
                  <option value="/bin/bash">Bash</option>
                  <option value="/bin/zsh">Zsh</option>
                  <option value="/bin/ash">Ash</option>
                  <option value="/bin/dash">Dash</option>
                </select>
              </div>
            </div>
            {selectedContainer && (
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <Terminal
                  wsUrl={`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/clusters/${cluster}/namespaces/${namespace}/pods/${podName}/shell?container=${selectedContainer}&shell=${encodeURIComponent(selectedShell)}`}
                  key={`${selectedContainer}-${selectedShell}`}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <DataTable
              data={events}
              columns={eventColumns}
              keyExtractor={(event) => `${event.metadata?.uid || event.involvedObject?.uid}-${event.lastTimestamp}`}
              searchPlaceholder="Search events..."
              emptyMessage="No events found for this pod"
              pageSize={20}
            />
          </div>
        )}
      </div>
    </div>
  )
}

