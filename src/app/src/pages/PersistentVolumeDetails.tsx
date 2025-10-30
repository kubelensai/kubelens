import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CircleStackIcon,
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

interface PersistentVolumeDetailsProps {}

type TabType = 'overview' | 'yaml' | 'events'

export default function PersistentVolumeDetails({}: PersistentVolumeDetailsProps) {
  const { cluster, pvName } = useParams<{ cluster: string; pvName: string }>()
  const navigate = useNavigate()
  const { addNotification } = useNotificationStore()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [pv, setPV] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [yamlContent, setYamlContent] = useState('')
  const [expandedSections, setExpandedSections] = useState({
    labels: false,
    annotations: false,
    nodeAffinity: false,
  })

  // Modal states
  const [isSaveYamlModalOpen, setIsSaveYamlModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  useEffect(() => {
    if (cluster && pvName) {
      fetchPVDetails()
    }
  }, [cluster, pvName])

  const fetchPVDetails = async () => {
    try {
      setIsLoading(true)
      const [pvRes, eventsRes] = await Promise.all([
        api.get(`/clusters/${cluster}/persistentvolumes/${pvName}`),
        api.get(`/clusters/${cluster}/events`).catch(() => ({ data: { events: [] } })),
      ])

      const pvData = pvRes.data
      const eventsData = eventsRes.data.events || []

      setPV(pvData)
      
      // Filter events related to this PV
      const pvEvents = eventsData.filter((event: any) => {
        if (!pvName) return false
        
        const involvedObjectMatch = event.involvedObject?.kind === 'PersistentVolume' && 
                                    event.involvedObject?.name === pvName
        const messageMatch = event.message?.toLowerCase().includes(pvName.toLowerCase())
        
        return involvedObjectMatch || messageMatch
      })
      
      setEvents(pvEvents)
      
      // Format as Kubernetes manifest
      const k8sManifest = {
        apiVersion: pvData.apiVersion || 'v1',
        kind: pvData.kind || 'PersistentVolume',
        metadata: pvData.metadata,
        spec: pvData.spec,
        status: pvData.status,
      }
      setYamlContent(yaml.dump(k8sManifest, { indent: 2, lineWidth: -1, sortKeys: false }))
    } catch (error) {
      console.error('Failed to fetch persistent volume details:', error)
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
      await api.put(`/clusters/${cluster}/persistentvolumes/${pvName}`, updatedManifest)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Persistent volume updated successfully',
      })
      fetchPVDetails()
      setIsSaveYamlModalOpen(false)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to update persistent volume: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleDeletePV = async () => {
    try {
      await api.delete(`/clusters/${cluster}/persistentvolumes/${pvName}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Persistent volume deleted successfully',
      })
      setIsDeleteModalOpen(false)
      navigate(`/clusters/${cluster}/persistentvolumes`)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete persistent volume: ${error.message || 'Unknown error'}`,
      })
    }
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

  if (!pv) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Persistent volume not found</p>
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
          { name: 'Persistent Volumes', href: `/clusters/${cluster}/persistentvolumes` },
          { name: pvName || '' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <CircleStackIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              {pvName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Persistent Volume Details
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
            {/* PV Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Persistent Volume Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Name:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{pv.metadata.name}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{pv.status?.phase || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Capacity:</span>
                  <p className="text-sm font-medium font-mono text-gray-900 dark:text-white">
                    {pv.spec?.capacity?.storage || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Access Modes:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {pv.spec?.accessModes?.join(', ') || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Reclaim Policy:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {pv.spec?.persistentVolumeReclaimPolicy || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Storage Class:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {pv.spec?.storageClassName || '-'}
                  </p>
                </div>
                {pv.spec?.claimRef && (
                  <>
                    <div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Claim Namespace:</span>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {pv.spec.claimRef.namespace}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Claim Name:</span>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {pv.spec.claimRef.name}
                      </p>
                    </div>
                  </>
                )}
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Age:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatAge(pv.metadata.creationTimestamp)}
                  </p>
                </div>
              </div>

              {/* Labels */}
              {pv.metadata.labels && Object.keys(pv.metadata.labels).length > 0 && (
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
                    Labels ({Object.keys(pv.metadata.labels).length})
                  </button>
                  {expandedSections.labels && (
                    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(pv.metadata.labels).map(([key, value]) => (
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
              {pv.metadata.annotations && Object.keys(pv.metadata.annotations).length > 0 && (
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
                    Annotations ({Object.keys(pv.metadata.annotations).length})
                  </button>
                  {expandedSections.annotations && (
                    <div className="mt-3 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 max-h-60 overflow-y-auto">
                      <div className="space-y-3">
                        {Object.entries(pv.metadata.annotations).map(([key, value]) => (
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

              {/* Node Affinity */}
              {pv.spec?.nodeAffinity && (
                <div className="mt-4">
                  <button
                    onClick={() => toggleSection('nodeAffinity')}
                    className="flex items-center gap-2 text-sm font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                  >
                    {expandedSections.nodeAffinity ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )}
                    Node Affinity
                  </button>
                  {expandedSections.nodeAffinity && (
                    <div className="mt-3 p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800 max-h-60 overflow-y-auto">
                      <pre className="text-xs font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 p-2 rounded border border-green-200 dark:border-green-700 overflow-x-auto">
                        {JSON.stringify(pv.spec.nodeAffinity, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
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
              emptyMessage="No events found for this persistent volume"
              pageSize={20}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {pv && (
        <>
          <ConfirmationModal
            isOpen={isSaveYamlModalOpen}
            onClose={() => setIsSaveYamlModalOpen(false)}
            onConfirm={handleSaveYaml}
            title="Save YAML Changes"
            message="Are you sure you want to save the YAML changes? This will update the persistent volume."
            confirmText="Save"
            type="warning"
          />

          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleDeletePV}
            title="Delete Persistent Volume"
            message={`Are you sure you want to delete persistent volume "${pvName}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
