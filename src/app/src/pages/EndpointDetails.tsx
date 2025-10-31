import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  LinkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface EndpointDetailsProps {}

type TabType = 'overview' | 'events'

export default function EndpointDetails({}: EndpointDetailsProps) {
  const { cluster, namespace, endpointName } = useParams<{ cluster: string; namespace: string; endpointName: string }>()
  const { addNotification } = useNotificationStore()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [endpoint, setEndpoint] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedSections, setExpandedSections] = useState({
    labels: false,
    annotations: false,
    readyAddresses: false,
    notReadyAddresses: false,
  })

  useEffect(() => {
    if (cluster && namespace && endpointName) {
      fetchEndpointDetails()
    }
  }, [cluster, namespace, endpointName])

  const fetchEndpointDetails = async () => {
    try {
      setIsLoading(true)
      const [endpointRes, eventsRes] = await Promise.all([
        api.get(`/clusters/${cluster}/namespaces/${namespace}/endpoints/${endpointName}`),
        api.get(`/clusters/${cluster}/events`).catch(() => ({ data: { events: [] } })),
      ])

      const endpointData = endpointRes.data
      const eventsData = eventsRes.data.events || []

      setEndpoint(endpointData)
      
      // Filter events related to this endpoint
      const endpointEvents = eventsData.filter((event: any) => {
        if (!endpointName) return false
        
        const involvedObjectMatch = event.involvedObject?.kind === 'Endpoints' && 
                                    event.involvedObject?.name === endpointName &&
                                    event.involvedObject?.namespace === namespace
        const messageMatch = event.message?.toLowerCase().includes(endpointName.toLowerCase())
        
        return involvedObjectMatch || messageMatch
      })
      
      setEvents(endpointEvents)
    } catch (error) {
      console.error('Failed to fetch endpoint details:', error)
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch endpoint details',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const getEndpointStatus = () => {
    if (!endpoint) return 'Unknown'
    
    let readyCount = 0
    let notReadyCount = 0
    
    endpoint.subsets?.forEach((subset: any) => {
      readyCount += subset.addresses?.length || 0
      notReadyCount += subset.notReadyAddresses?.length || 0
    })
    
    if (readyCount === 0 && notReadyCount === 0) {
      return 'No Endpoints'
    }
    
    if (readyCount > 0 && notReadyCount === 0) {
      return 'Ready'
    }
    
    if (readyCount === 0 && notReadyCount > 0) {
      return 'Not Ready'
    }
    
    return 'Partial'
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ready':
        return 'text-green-600 dark:text-green-400'
      case 'partial':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'not ready':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getAllAddresses = (type: 'ready' | 'notReady') => {
    if (!endpoint?.subsets) return []
    
    const addresses: any[] = []
    endpoint.subsets.forEach((subset: any) => {
      const subsetAddresses = type === 'ready' ? subset.addresses : subset.notReadyAddresses
      if (subsetAddresses) {
        subsetAddresses.forEach((addr: any) => {
          addresses.push({
            ip: addr.ip,
            nodeName: addr.nodeName,
            targetRef: addr.targetRef,
            ports: subset.ports || [],
          })
        })
      }
    })
    
    return addresses
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

  if (!endpoint) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Endpoint not found</p>
      </div>
    )
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'events', label: 'Events' },
  ]

  const readyAddresses = getAllAddresses('ready')
  const notReadyAddresses = getAllAddresses('notReady')

  return (
    <div className="space-y-4 md:space-y-6">
      <Breadcrumb
        items={[
          { name: cluster || '', href: `/clusters/${cluster}` },
          { name: namespace || '', href: `/clusters/${cluster}/namespaces/${namespace}/endpoints` },
          { name: 'Endpoints', href: `/clusters/${cluster}/namespaces/${namespace}/endpoints` },
          { name: endpointName || '' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <LinkIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              {endpointName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Endpoint Details
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
            {/* Endpoint Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Endpoint Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Name:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{endpoint.metadata.name}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Namespace:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{endpoint.metadata.namespace}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
                  <p className={clsx('text-sm font-medium', getStatusColor(getEndpointStatus()))}>
                    {getEndpointStatus()}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Ready Addresses:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {readyAddresses.length}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Not Ready Addresses:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {notReadyAddresses.length}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Age:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatAge(endpoint.metadata.creationTimestamp)}
                  </p>
                </div>
              </div>

              {/* Labels */}
              {endpoint.metadata.labels && Object.keys(endpoint.metadata.labels).length > 0 && (
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
                    Labels ({Object.keys(endpoint.metadata.labels).length})
                  </button>
                  {expandedSections.labels && (
                    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(endpoint.metadata.labels).map(([key, value]) => (
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
              {endpoint.metadata.annotations && Object.keys(endpoint.metadata.annotations).length > 0 && (
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
                    Annotations ({Object.keys(endpoint.metadata.annotations).length})
                  </button>
                  {expandedSections.annotations && (
                    <div className="mt-3 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 max-h-60 overflow-y-auto">
                      <div className="space-y-3">
                        {Object.entries(endpoint.metadata.annotations).map(([key, value]) => (
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

            {/* Ready Addresses */}
            {readyAddresses.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Ready Addresses ({readyAddresses.length})
                </h3>
                <div className="space-y-3">
                  {readyAddresses.map((addr: any, index: number) => (
                    <div key={index} className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">IP:</span>
                          <p className="font-medium font-mono text-gray-900 dark:text-white">{addr.ip}</p>
                        </div>
                        {addr.nodeName && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Node:</span>
                            <p className="font-medium text-gray-900 dark:text-white">{addr.nodeName}</p>
                          </div>
                        )}
                        {addr.targetRef && (
                          <>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Target Kind:</span>
                              <p className="font-medium text-gray-900 dark:text-white">{addr.targetRef.kind}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Target Name:</span>
                              <p className="font-medium text-gray-900 dark:text-white">{addr.targetRef.name}</p>
                            </div>
                          </>
                        )}
                        {addr.ports && addr.ports.length > 0 && (
                          <div className="col-span-2">
                            <span className="text-gray-500 dark:text-gray-400">Ports:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {addr.ports.map((port: any, portIdx: number) => (
                                <span key={portIdx} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-white dark:bg-gray-800 border border-green-200 dark:border-green-700">
                                  {port.name && `${port.name}: `}{port.port}/{port.protocol}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Not Ready Addresses */}
            {notReadyAddresses.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Not Ready Addresses ({notReadyAddresses.length})
                </h3>
                <div className="space-y-3">
                  {notReadyAddresses.map((addr: any, index: number) => (
                    <div key={index} className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">IP:</span>
                          <p className="font-medium font-mono text-gray-900 dark:text-white">{addr.ip}</p>
                        </div>
                        {addr.nodeName && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Node:</span>
                            <p className="font-medium text-gray-900 dark:text-white">{addr.nodeName}</p>
                          </div>
                        )}
                        {addr.targetRef && (
                          <>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Target Kind:</span>
                              <p className="font-medium text-gray-900 dark:text-white">{addr.targetRef.kind}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Target Name:</span>
                              <p className="font-medium text-gray-900 dark:text-white">{addr.targetRef.name}</p>
                            </div>
                          </>
                        )}
                        {addr.ports && addr.ports.length > 0 && (
                          <div className="col-span-2">
                            <span className="text-gray-500 dark:text-gray-400">Ports:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {addr.ports.map((port: any, portIdx: number) => (
                                <span key={portIdx} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700">
                                  {port.name && `${port.name}: `}{port.port}/{port.protocol}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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
              emptyMessage="No events found for this endpoint"
              pageSize={20}
            />
          </div>
        )}
      </div>
    </div>
  )
}

