import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CubeIcon,
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

type TabType = 'overview' | 'yaml' | 'status' | 'events'

export default function GenericCRDDetails() {
  const { cluster, namespace, group, version, resource, resourceName } = useParams<{
    cluster: string
    namespace?: string
    group: string
    version: string
    resource: string
    resourceName: string
  }>()
  const navigate = useNavigate()
  const { addNotification } = useNotificationStore()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [customResource, setCustomResource] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [yamlContent, setYamlContent] = useState('')
  const [expandedSections, setExpandedSections] = useState({
    labels: false,
    annotations: false,
    spec: true,
    status: false,
  })

  const [isSaveYamlModalOpen, setIsSaveYamlModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  useEffect(() => {
    if (cluster && group && version && resource && resourceName) {
      fetchResourceDetails()
    }
  }, [cluster, namespace, group, version, resource, resourceName])

  const fetchResourceDetails = async () => {
    try {
      setIsLoading(true)
      
      // Fetch the custom resource
      let resourceRes
      if (namespace) {
        resourceRes = await api.get(
          `/clusters/${cluster}/namespaces/${namespace}/customresources/${resourceName}?group=${group}&version=${version}&resource=${resource}`
        )
      } else {
        resourceRes = await api.get(
          `/clusters/${cluster}/customresources/${resourceName}?group=${group}&version=${version}&resource=${resource}`
        )
      }

      const resourceData = resourceRes.data
      setCustomResource(resourceData)

      // Fetch events
      const eventsRes = await api.get(`/clusters/${cluster}/events`).catch(() => ({ data: { events: [] } }))
      const eventsData = eventsRes.data.events || []
      
      const resourceEvents = eventsData.filter((event: any) => {
        if (!resourceName) return false
        
        const involvedObjectMatch = event.involvedObject?.name === resourceName
        if (namespace) {
          return involvedObjectMatch && event.involvedObject?.namespace === namespace
        }
        return involvedObjectMatch
      })
      
      setEvents(resourceEvents)
      
      // Create YAML manifest
      const k8sManifest: any = {
        apiVersion: `${group}/${version}`,
        kind: resourceData.kind || resource,
        metadata: resourceData.metadata,
      }
      
      if (resourceData.spec) {
        k8sManifest.spec = resourceData.spec
      }
      
      if (resourceData.status) {
        k8sManifest.status = resourceData.status
      }
      
      setYamlContent(yaml.dump(k8sManifest, { indent: 2, lineWidth: -1, sortKeys: false }))
    } catch (error) {
      console.error('Failed to fetch custom resource details:', error)
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load custom resource details',
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
      
      if (namespace) {
        await api.put(
          `/clusters/${cluster}/namespaces/${namespace}/customresources/${resourceName}?group=${group}&version=${version}&resource=${resource}`,
          updatedManifest
        )
      } else {
        await api.put(
          `/clusters/${cluster}/customresources/${resourceName}?group=${group}&version=${version}&resource=${resource}`,
          updatedManifest
        )
      }
      
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Custom resource updated successfully',
      })
      fetchResourceDetails()
      setIsSaveYamlModalOpen(false)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to update custom resource: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleDeleteResource = async () => {
    try {
      if (namespace) {
        await api.delete(
          `/clusters/${cluster}/namespaces/${namespace}/customresources/${resourceName}?group=${group}&version=${version}&resource=${resource}`
        )
      } else {
        await api.delete(
          `/clusters/${cluster}/customresources/${resourceName}?group=${group}&version=${version}&resource=${resource}`
        )
      }
      
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Custom resource deleted successfully',
      })
      setIsDeleteModalOpen(false)
      
      // Navigate back to the list
      if (namespace) {
        navigate(`/clusters/${cluster}/namespaces/${namespace}/customresources/${group}/${version}/${resource}`)
      } else {
        navigate(`/clusters/${cluster}/customresources/${group}/${version}/${resource}`)
      }
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete custom resource: ${error.message || 'Unknown error'}`,
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

  if (!customResource) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Custom resource not found</p>
      </div>
    )
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'yaml', label: 'YAML' },
    { id: 'status', label: 'Status' },
    { id: 'events', label: 'Events' },
  ]

  // Get resource kind for display
  const resourceKind = customResource.kind || (resource ? resource.charAt(0).toUpperCase() + resource.slice(1, -1) : 'Resource')

  return (
    <div className="space-y-4 md:space-y-6">
      <Breadcrumb
        items={
          namespace
            ? [
                { name: cluster || '', href: `/clusters/${cluster}` },
                { name: namespace, href: `/clusters/${cluster}/namespaces/${namespace}` },
                { name: resourceKind, href: `/clusters/${cluster}/namespaces/${namespace}/customresources/${group}/${version}/${resource}` },
                { name: resourceName || '' },
              ]
            : [
                { name: cluster || '', href: `/clusters/${cluster}` },
                { name: resourceKind, href: `/clusters/${cluster}/customresources/${group}/${version}/${resource}` },
                { name: resourceName || '' },
              ]
        }
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <CubeIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              {resourceName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {resourceKind} Details
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resource Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Name:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{customResource.metadata?.name}</p>
                </div>
                {namespace && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Namespace:</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{customResource.metadata?.namespace}</p>
                  </div>
                )}
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Kind:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{resourceKind}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">API Version:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{`${group}/${version}`}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Age:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatAge(customResource.metadata?.creationTimestamp)}
                  </p>
                </div>
              </div>

              {customResource.metadata?.labels && Object.keys(customResource.metadata.labels).length > 0 && (
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
                    Labels ({Object.keys(customResource.metadata.labels).length})
                  </button>
                  {expandedSections.labels && (
                    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(customResource.metadata.labels).map(([key, value]) => (
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

              {customResource.metadata?.annotations && Object.keys(customResource.metadata.annotations).length > 0 && (
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
                    Annotations ({Object.keys(customResource.metadata.annotations).length})
                  </button>
                  {expandedSections.annotations && (
                    <div className="mt-3 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 max-h-60 overflow-y-auto">
                      <div className="space-y-3">
                        {Object.entries(customResource.metadata.annotations).map(([key, value]) => (
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

            {customResource.spec && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <button
                  onClick={() => toggleSection('spec')}
                  className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 mb-4"
                >
                  {expandedSections.spec ? (
                    <ChevronUpIcon className="w-5 h-5" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5" />
                  )}
                  Spec
                </button>
                {expandedSections.spec && (
                  <pre className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto text-sm">
                    <code className="text-gray-900 dark:text-white">
                      {JSON.stringify(customResource.spec, null, 2)}
                    </code>
                  </pre>
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

        {activeTab === 'status' && (
          <div className="space-y-4">
            {customResource.status ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Resource Status</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Current state and conditions of the resource
                  </p>
                </div>
                
                <div className="p-4 sm:p-6 space-y-6">
                  {/* Phase/State if exists */}
                  {(customResource.status.phase || customResource.status.state) && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Phase:</span>
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
                          {customResource.status.phase || customResource.status.state}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Conditions if exists */}
                  {customResource.status.conditions && Array.isArray(customResource.status.conditions) && customResource.status.conditions.length > 0 && (
                    <div>
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Conditions</h4>
                      <div className="space-y-3">
                        {customResource.status.conditions.map((condition: any, index: number) => (
                          <div
                            key={index}
                            className={clsx(
                              'p-4 rounded-lg border transition-all',
                              condition.status === 'True'
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                : condition.status === 'False'
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                            )}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={clsx(
                                    'inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full',
                                    condition.status === 'True'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400'
                                      : condition.status === 'False'
                                      ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400'
                                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400'
                                  )}
                                >
                                  {condition.type}
                                </span>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {condition.status}
                                </span>
                              </div>
                              {condition.lastTransitionTime && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {formatAge(condition.lastTransitionTime)}
                                </span>
                              )}
                            </div>
                            {condition.reason && (
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Reason: {condition.reason}
                              </p>
                            )}
                            {condition.message && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {condition.message}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Other status fields */}
                  {Object.keys(customResource.status).filter(
                    key => !['phase', 'state', 'conditions'].includes(key)
                  ).length > 0 && (
                    <div>
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Additional Status Information</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Object.entries(customResource.status)
                          .filter(([key]) => !['phase', 'state', 'conditions'].includes(key))
                          .map(([key, value]) => (
                            <div key={key} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                              <div className="mt-2">
                                {typeof value === 'object' && value !== null ? (
                                  <pre className="text-xs text-gray-900 dark:text-white overflow-x-auto">
                                    <code>{JSON.stringify(value, null, 2)}</code>
                                  </pre>
                                ) : (
                                  <p className="text-sm font-medium text-gray-900 dark:text-white break-all">
                                    {String(value)}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Full JSON view (collapsible) */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => toggleSection('status')}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      {expandedSections.status ? (
                        <ChevronUpIcon className="w-4 h-4" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4" />
                      )}
                      View Raw JSON
                    </button>
                    {expandedSections.status && (
                      <pre className="mt-3 p-4 bg-gray-900 dark:bg-black rounded-lg border border-gray-700 overflow-x-auto text-xs">
                        <code className="text-green-400">
                          {JSON.stringify(customResource.status, null, 2)}
                        </code>
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Status Available</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This resource does not have status information
                  </p>
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
              emptyMessage="No events found for this resource"
              pageSize={20}
            />
          </div>
        )}
      </div>

      {customResource && (
        <>
          <ConfirmationModal
            isOpen={isSaveYamlModalOpen}
            onClose={() => setIsSaveYamlModalOpen(false)}
            onConfirm={handleSaveYaml}
            title="Save YAML Changes"
            message="Are you sure you want to save the YAML changes? This will update the custom resource."
            confirmText="Save"
            type="warning"
          />

          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleDeleteResource}
            title="Delete Custom Resource"
            message={`Are you sure you want to delete custom resource "${resourceName}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}

