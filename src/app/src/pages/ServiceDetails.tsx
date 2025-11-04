import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  GlobeAltIcon,
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

interface ServiceDetailsProps {}

type TabType = 'overview' | 'yaml' | 'events'

export default function ServiceDetails({}: ServiceDetailsProps) {
  const { cluster, namespace, serviceName } = useParams<{ cluster: string; namespace: string; serviceName: string }>()
  const navigate = useNavigate()
  const { addNotification } = useNotificationStore()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [service, setService] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [yamlContent, setYamlContent] = useState('')
  const [expandedSections, setExpandedSections] = useState({
    labels: false,
    annotations: false,
    selector: false,
    ports: false,
  })

  // Modal states
  const [isSaveYamlModalOpen, setIsSaveYamlModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  useEffect(() => {
    if (cluster && namespace && serviceName) {
      fetchServiceDetails()
    }
  }, [cluster, namespace, serviceName])

  const fetchServiceDetails = async () => {
    try {
      setIsLoading(true)
      const [serviceRes, eventsRes] = await Promise.all([
        api.get(`/clusters/${cluster}/namespaces/${namespace}/services/${serviceName}`),
        api.get(`/clusters/${cluster}/events`).catch(() => ({ data: { events: [] } })),
      ])

      const serviceData = serviceRes.data
      const eventsData = eventsRes.data.events || []

      setService(serviceData)
      
      // Filter events related to this service
      const serviceEvents = eventsData.filter((event: any) => {
        if (!serviceName) return false
        
        const involvedObjectMatch = event.involvedObject?.kind === 'Service' && 
                                    event.involvedObject?.name === serviceName &&
                                    event.involvedObject?.namespace === namespace
        const messageMatch = event.message?.toLowerCase().includes(serviceName.toLowerCase())
        
        return involvedObjectMatch || messageMatch
      })
      
      setEvents(serviceEvents)
      
      // Format as Kubernetes manifest
      const k8sManifest = {
        apiVersion: serviceData.apiVersion || 'v1',
        kind: serviceData.kind || 'Service',
        metadata: serviceData.metadata,
        spec: serviceData.spec,
        status: serviceData.status,
      }
      setYamlContent(yaml.dump(k8sManifest, { indent: 2, lineWidth: -1, sortKeys: false }))
    } catch (error) {
      console.error('Failed to fetch service details:', error)
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch service details',
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
      await api.put(`/clusters/${cluster}/namespaces/${namespace}/services/${serviceName}`, updatedManifest)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Service updated successfully',
      })
      fetchServiceDetails()
      setIsSaveYamlModalOpen(false)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to update service: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleDeleteService = async () => {
    try {
      await api.delete(`/clusters/${cluster}/namespaces/${namespace}/services/${serviceName}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Service deleted successfully',
      })
      setIsDeleteModalOpen(false)
      navigate(`/clusters/${cluster}/namespaces/${namespace}/services`)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete service: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const getServiceStatus = () => {
    if (!service) return 'Unknown'
    
    // ExternalName services are always considered active
    if (service.spec?.type === 'ExternalName') {
      return 'Active'
    }
    
    // LoadBalancer services
    if (service.spec?.type === 'LoadBalancer') {
      if (service.status?.loadBalancer?.ingress && service.status.loadBalancer.ingress.length > 0) {
        return 'Active'
      }
      return 'Pending'
    }
    
    // Services with selectors should have endpoints
    if (service.spec?.selector) {
      return 'Active'
    }
    
    // Headless services (ClusterIP: None)
    if (service.spec?.clusterIP === 'None') {
      return 'Headless'
    }
    
    return 'Active'
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'text-green-600 dark:text-green-400'
      case 'pending':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'headless':
        return 'text-blue-600 dark:text-blue-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const formatPorts = (service: any) => {
    if (!service.spec?.ports || service.spec.ports.length === 0) return []
    return service.spec.ports
  }

  const getExternalIP = (service: any) => {
    // For LoadBalancer services
    if (service.status?.loadBalancer?.ingress && service.status.loadBalancer.ingress.length > 0) {
      const ingress = service.status.loadBalancer.ingress[0]
      return ingress.ip || ingress.hostname || 'Pending'
    }
    
    // For services with externalIPs
    if (service.spec?.externalIPs && service.spec.externalIPs.length > 0) {
      return service.spec.externalIPs.join(', ')
    }
    
    // For NodePort services
    if (service.spec?.type === 'NodePort') {
      return '<nodes>'
    }
    
    // For ExternalName services
    if (service.spec?.type === 'ExternalName') {
      return service.spec.externalName || 'N/A'
    }
    
    return 'None'
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

  if (!service) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Service not found</p>
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
          { name: namespace || '' },
          { name: 'Services' },
          { name: serviceName || '' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <GlobeAltIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              {serviceName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Service Details
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
            {/* Service Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Service Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Name:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{service.metadata.name}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Namespace:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{service.metadata.namespace}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
                  <p className={clsx('text-sm font-medium', getStatusColor(getServiceStatus()))}>
                    {getServiceStatus()}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Type:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {service.spec?.type || 'ClusterIP'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Cluster IP:</span>
                  <p className="text-sm font-medium font-mono text-gray-900 dark:text-white">
                    {service.spec?.clusterIP || 'None'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">External IP:</span>
                  <p className="text-sm font-medium font-mono text-gray-900 dark:text-white">
                    {getExternalIP(service)}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Session Affinity:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {service.spec?.sessionAffinity || 'None'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Age:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatAge(service.metadata.creationTimestamp)}
                  </p>
                </div>
              </div>

              {/* Labels */}
              {service.metadata.labels && Object.keys(service.metadata.labels).length > 0 && (
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
                    Labels ({Object.keys(service.metadata.labels).length})
                  </button>
                  {expandedSections.labels && (
                    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(service.metadata.labels).map(([key, value]) => (
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
              {service.metadata.annotations && Object.keys(service.metadata.annotations).length > 0 && (
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
                    Annotations ({Object.keys(service.metadata.annotations).length})
                  </button>
                  {expandedSections.annotations && (
                    <div className="mt-3 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 max-h-60 overflow-y-auto">
                      <div className="space-y-3">
                        {Object.entries(service.metadata.annotations).map(([key, value]) => (
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

              {/* Selector */}
              {service.spec?.selector && Object.keys(service.spec.selector).length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => toggleSection('selector')}
                    className="flex items-center gap-2 text-sm font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300"
                  >
                    {expandedSections.selector ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )}
                    Selector ({Object.keys(service.spec.selector).length})
                  </button>
                  {expandedSections.selector && (
                    <div className="mt-3 p-4 bg-cyan-50 dark:bg-cyan-900/10 rounded-lg border border-cyan-200 dark:border-cyan-800">
                      <div className="space-y-2">
                        {Object.entries(service.spec.selector).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">{key}:</span>
                            <span className="text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-1 rounded border border-cyan-200 dark:border-cyan-700">
                              {value as string}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Ports */}
            {formatPorts(service).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ports</h3>
                <div className="space-y-3">
                  {formatPorts(service).map((port: any, index: number) => (
                    <div key={index} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        {port.name && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Name:</span>
                            <p className="font-medium text-gray-900 dark:text-white">{port.name}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Port:</span>
                          <p className="font-medium font-mono text-gray-900 dark:text-white">{port.port}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Target Port:</span>
                          <p className="font-medium font-mono text-gray-900 dark:text-white">{port.targetPort || port.port}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Protocol:</span>
                          <p className="font-medium text-gray-900 dark:text-white">{port.protocol}</p>
                        </div>
                        {port.nodePort && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Node Port:</span>
                            <p className="font-medium font-mono text-gray-900 dark:text-white">{port.nodePort}</p>
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
              emptyMessage="No events found for this service"
              pageSize={20}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {service && (
        <>
          <ConfirmationModal
            isOpen={isSaveYamlModalOpen}
            onClose={() => setIsSaveYamlModalOpen(false)}
            onConfirm={handleSaveYaml}
            title="Save YAML Changes"
            message="Are you sure you want to save the YAML changes? This will update the service."
            confirmText="Save"
            type="warning"
          />

          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleDeleteService}
            title="Delete Service"
            message={`Are you sure you want to delete service "${serviceName}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}

