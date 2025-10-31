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

type TabType = 'overview' | 'yaml' | 'resources' | 'events'

export default function CRDDetails() {
  const { cluster, crdName } = useParams<{ cluster: string; crdName: string }>()
  const navigate = useNavigate()
  const { addNotification } = useNotificationStore()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [crd, setCRD] = useState<any>(null)
  const [resources, setResources] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [yamlContent, setYamlContent] = useState('')
  const [expandedSections, setExpandedSections] = useState({
    labels: false,
    annotations: false,
    versions: true,
  })

  const [isSaveYamlModalOpen, setIsSaveYamlModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  useEffect(() => {
    if (cluster && crdName) {
      fetchCRDDetails()
    }
  }, [cluster, crdName])

  const fetchCRDDetails = async () => {
    try {
      setIsLoading(true)
      const [crdRes, eventsRes] = await Promise.all([
        api.get(`/clusters/${cluster}/customresourcedefinitions/${crdName}`),
        api.get(`/clusters/${cluster}/events`).catch(() => ({ data: { events: [] } })),
      ])

      const crdData = crdRes.data
      const eventsData = eventsRes.data.events || []

      setCRD(crdData)
      
      // Fetch custom resources if we have the necessary info
      // Try to get group, version, and resource from multiple possible locations
      const group = crdData.group || crdData.spec?.group
      const resource = crdData.resource || crdData.spec?.names?.plural
      
      // Get the storage version from versions array
      let version = crdData.version
      if (!version && crdData.spec?.versions) {
        // Find the storage version
        const storageVersion = crdData.spec.versions.find((v: any) => v.storage)
        version = storageVersion?.name || crdData.spec.versions[0]?.name
      }
      
      if (group && version && resource) {
        try {
          const resourcesRes = await api.get(
            `/clusters/${cluster}/customresources?group=${group}&version=${version}&resource=${resource}`
          )
          // Handle both array response and object with data property
          const resourcesData = Array.isArray(resourcesRes.data) 
            ? resourcesRes.data 
            : (resourcesRes.data?.items || resourcesRes.data?.resources || [])
          setResources(resourcesData)
        } catch (error) {
          console.error('Failed to fetch custom resources:', error)
          setResources([])
        }
      } else {
        console.log('Missing required fields for fetching resources:', { group, version, resource })
        setResources([])
      }
      
      const crdEvents = eventsData.filter((event: any) => {
        if (!crdName) return false
        
        const involvedObjectMatch = event.involvedObject?.kind === 'CustomResourceDefinition' && 
                                    event.involvedObject?.name === crdName
        const messageMatch = event.message?.toLowerCase().includes(crdName.toLowerCase())
        
        return involvedObjectMatch || messageMatch
      })
      
      setEvents(crdEvents)
      
      const k8sManifest: any = {
        apiVersion: crdData.apiVersion || 'apiextensions.k8s.io/v1',
        kind: crdData.kind || 'CustomResourceDefinition',
        metadata: crdData.metadata,
        spec: crdData.spec,
      }
      
      if (crdData.status) {
        k8sManifest.status = crdData.status
      }
      
      setYamlContent(yaml.dump(k8sManifest, { indent: 2, lineWidth: -1, sortKeys: false }))
    } catch (error) {
      console.error('Failed to fetch CRD details:', error)
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load custom resource definition details',
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
      await api.put(`/clusters/${cluster}/customresourcedefinitions/${crdName}`, updatedManifest)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Custom resource definition updated successfully',
      })
      fetchCRDDetails()
      setIsSaveYamlModalOpen(false)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to update custom resource definition: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleDeleteCRD = async () => {
    try {
      await api.delete(`/clusters/${cluster}/customresourcedefinitions/${crdName}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Custom resource definition deleted successfully',
      })
      setIsDeleteModalOpen(false)
      navigate(`/clusters/${cluster}/customresourcedefinitions`)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete custom resource definition: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const resourceColumns = useMemo<Column<any>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (resource) => {
        const name = resource.metadata?.name || '-'
        const ns = resource.metadata?.namespace
        const group = crd.group || crd.spec?.group
        const version = crd.version || (crd.spec?.versions?.find((v: any) => v.storage)?.name || crd.spec?.versions?.[0]?.name)
        const resourceType = crd.resource || crd.spec?.names?.plural
        
        return (
          <button
            onClick={() => {
              if (ns) {
                navigate(`/clusters/${cluster}/namespaces/${ns}/customresources/${group}/${version}/${resourceType}/${name}`)
              } else {
                navigate(`/clusters/${cluster}/customresources/${group}/${version}/${resourceType}/${name}`)
              }
            }}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-left"
          >
            {name}
          </button>
        )
      },
      sortable: true,
      sortValue: (resource) => resource.metadata?.name || '',
      searchValue: (resource) => resource.metadata?.name || '',
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (resource) => {
        const ns = resource.metadata?.namespace
        if (!ns) return <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
        
        const group = crd.group || crd.spec?.group
        const version = crd.version || (crd.spec?.versions?.find((v: any) => v.storage)?.name || crd.spec?.versions?.[0]?.name)
        const resourceType = crd.resource || crd.spec?.names?.plural
        
        return (
          <button
            onClick={() => navigate(`/clusters/${cluster}/namespaces/${ns}/customresources/${group}/${version}/${resourceType}`)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-left"
          >
            {ns}
          </button>
        )
      },
      sortable: true,
      sortValue: (resource) => resource.metadata?.namespace || '',
      searchValue: (resource) => resource.metadata?.namespace || '',
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (resource) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(resource.metadata?.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (resource) => new Date(resource.metadata?.creationTimestamp || 0).getTime(),
      searchValue: (resource) => formatAge(resource.metadata?.creationTimestamp),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (resource) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {resource.status?.phase || resource.status?.state || resource.status?.conditions?.[0]?.type || 'Unknown'}
        </span>
      ),
      sortable: true,
      sortValue: (resource) => resource.status?.phase || resource.status?.state || resource.status?.conditions?.[0]?.type || 'Unknown',
      searchValue: (resource) => resource.status?.phase || resource.status?.state || resource.status?.conditions?.[0]?.type || 'Unknown',
    },
  ], [crd, cluster, navigate])

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

  if (!crd) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Custom resource definition not found</p>
      </div>
    )
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'yaml', label: 'YAML' },
    { id: 'resources', label: `Resources (${resources.length})` },
    { id: 'events', label: 'Events' },
  ]

  return (
    <div className="space-y-4 md:space-y-6">
      <Breadcrumb
        items={[
          { name: cluster || '', href: `/clusters/${cluster}` },
          { name: 'Custom Resource Definitions', href: `/clusters/${cluster}/customresourcedefinitions` },
          { name: crdName || '' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <CubeIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              {crdName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Custom Resource Definition Details
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">CRD Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Name:</span>
                  <button
                    onClick={() => {
                      const group = crd.group || crd.spec?.group
                      const version = crd.version || (crd.spec?.versions?.find((v: any) => v.storage)?.name || crd.spec?.versions?.[0]?.name)
                      const resource = crd.resource || crd.spec?.names?.plural
                      if (group && version && resource) {
                        navigate(`/clusters/${cluster}/customresources/${group}/${version}/${resource}`)
                      }
                    }}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    {crd.metadata.name}
                  </button>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Group:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{crd.group || crd.spec?.group || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Resource:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{crd.resource || crd.spec?.names?.plural || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Scope:</span>
                  <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
                    (crd.scope || crd.spec?.scope) === 'Namespaced' 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                  }`}>
                    {crd.scope || crd.spec?.scope || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Age:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatAge(crd.metadata.creationTimestamp)}
                  </p>
                </div>
              </div>

              {crd.metadata.labels && Object.keys(crd.metadata.labels).length > 0 && (
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
                    Labels ({Object.keys(crd.metadata.labels).length})
                  </button>
                  {expandedSections.labels && (
                    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(crd.metadata.labels).map(([key, value]) => (
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

              {crd.metadata.annotations && Object.keys(crd.metadata.annotations).length > 0 && (
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
                    Annotations ({Object.keys(crd.metadata.annotations).length})
                  </button>
                  {expandedSections.annotations && (
                    <div className="mt-3 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 max-h-60 overflow-y-auto">
                      <div className="space-y-3">
                        {Object.entries(crd.metadata.annotations).map(([key, value]) => (
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

            {crd.spec?.versions && crd.spec.versions.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <button
                  onClick={() => toggleSection('versions')}
                  className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 mb-4"
                >
                  {expandedSections.versions ? (
                    <ChevronUpIcon className="w-5 h-5" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5" />
                  )}
                  Versions ({crd.spec.versions.length})
                </button>
                {expandedSections.versions && (
                  <div className="space-y-3">
                    {crd.spec.versions.map((version: any, index: number) => (
                      <div key={index} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{version.name}</h4>
                          <div className="flex items-center gap-2">
                            {version.served && (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                                Served
                              </span>
                            )}
                            {version.storage && (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                                Storage
                              </span>
                            )}
                          </div>
                        </div>
                        {version.deprecated && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400">
                            ⚠️ Deprecated{version.deprecationWarning ? `: ${version.deprecationWarning}` : ''}
                          </p>
                        )}
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

        {activeTab === 'resources' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <DataTable
              data={resources}
              columns={resourceColumns}
              keyExtractor={(resource) => `${resource.metadata?.namespace || 'cluster'}-${resource.metadata?.name}`}
              searchPlaceholder="Search resources..."
              emptyMessage="No custom resources found"
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
              emptyMessage="No events found for this CRD"
              pageSize={20}
            />
          </div>
        )}
      </div>

      {crd && (
        <>
          <ConfirmationModal
            isOpen={isSaveYamlModalOpen}
            onClose={() => setIsSaveYamlModalOpen(false)}
            onConfirm={handleSaveYaml}
            title="Save YAML Changes"
            message="Are you sure you want to save the YAML changes? This will update the custom resource definition."
            confirmText="Save"
            type="warning"
          />

          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleDeleteCRD}
            title="Delete Custom Resource Definition"
            message={`Are you sure you want to delete custom resource definition "${crdName}"? This action cannot be undone and will affect all associated custom resources.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}

