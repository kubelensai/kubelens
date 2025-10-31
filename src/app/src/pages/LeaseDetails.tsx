import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ClockIcon,
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
import { format } from 'date-fns'

type TabType = 'overview' | 'yaml' | 'events'

export default function LeaseDetails() {
  const { cluster, namespace, leaseName } = useParams<{ cluster: string; namespace: string; leaseName: string }>()
  const navigate = useNavigate()
  const { addNotification } = useNotificationStore()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [lease, setLease] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [yamlContent, setYamlContent] = useState('')
  const [expandedSections, setExpandedSections] = useState({
    labels: false,
    annotations: false,
  })

  const [isSaveYamlModalOpen, setIsSaveYamlModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  useEffect(() => {
    if (cluster && namespace && leaseName) {
      fetchLeaseDetails()
    }
  }, [cluster, namespace, leaseName])

  const fetchLeaseDetails = async () => {
    try {
      setIsLoading(true)
      const [leaseRes, eventsRes] = await Promise.all([
        api.get(`/clusters/${cluster}/namespaces/${namespace}/leases/${leaseName}`),
        api.get(`/clusters/${cluster}/events`).catch(() => ({ data: { events: [] } })),
      ])

      const leaseData = leaseRes.data
      const eventsData = eventsRes.data.events || []

      setLease(leaseData)
      
      const leaseEvents = eventsData.filter((event: any) => {
        if (!leaseName) return false
        
        const involvedObjectMatch = event.involvedObject?.kind === 'Lease' && 
                                    event.involvedObject?.name === leaseName &&
                                    event.involvedObject?.namespace === namespace
        const messageMatch = event.message?.toLowerCase().includes(leaseName.toLowerCase())
        
        return involvedObjectMatch || messageMatch
      })
      
      setEvents(leaseEvents)
      
      const k8sManifest = {
        apiVersion: leaseData.apiVersion || 'coordination.k8s.io/v1',
        kind: leaseData.kind || 'Lease',
        metadata: leaseData.metadata,
        spec: leaseData.spec,
      }
      
      setYamlContent(yaml.dump(k8sManifest, { indent: 2, lineWidth: -1, sortKeys: false }))
    } catch (error) {
      console.error('Failed to fetch lease details:', error)
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load lease details',
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
      await api.put(`/clusters/${cluster}/namespaces/${namespace}/leases/${leaseName}`, updatedManifest)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Lease updated successfully',
      })
      fetchLeaseDetails()
      setIsSaveYamlModalOpen(false)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to update lease: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleDeleteLease = async () => {
    try {
      await api.delete(`/clusters/${cluster}/namespaces/${namespace}/leases/${leaseName}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Lease deleted successfully',
      })
      setIsDeleteModalOpen(false)
      navigate(`/clusters/${cluster}/leases`)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete lease: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const formatRenewTime = (renewTime: string | null | undefined) => {
    if (!renewTime) return 'Never'
    try {
      const date = new Date(renewTime)
      return format(date, 'MMM dd, yyyy HH:mm:ss')
    } catch {
      return 'Invalid'
    }
  }

  const formatAcquireTime = (acquireTime: string | null | undefined) => {
    if (!acquireTime) return 'N/A'
    try {
      const date = new Date(acquireTime)
      return format(date, 'MMM dd, yyyy HH:mm:ss')
    } catch {
      return 'Invalid'
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

  if (!lease) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Lease not found</p>
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
          { name: 'Leases', href: `/clusters/${cluster}/leases` },
          { name: namespace || '', href: `/clusters/${cluster}/leases` },
          { name: leaseName || '' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <ClockIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              {leaseName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Lease Details
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Lease Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Name:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{lease.metadata.name}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Namespace:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{lease.metadata.namespace}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Holder Identity:</span>
                  <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
                    {lease.spec?.holderIdentity || '-'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Lease Duration:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {lease.spec?.leaseDurationSeconds ? `${lease.spec.leaseDurationSeconds}s` : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Acquire Time:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatAcquireTime(lease.spec?.acquireTime)}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Renew Time:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatRenewTime(lease.spec?.renewTime)}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Lease Transitions:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {lease.spec?.leaseTransitions || '0'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Age:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatAge(lease.metadata.creationTimestamp)}
                  </p>
                </div>
              </div>

              {lease.metadata.labels && Object.keys(lease.metadata.labels).length > 0 && (
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
                    Labels ({Object.keys(lease.metadata.labels).length})
                  </button>
                  {expandedSections.labels && (
                    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(lease.metadata.labels).map(([key, value]) => (
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

              {lease.metadata.annotations && Object.keys(lease.metadata.annotations).length > 0 && (
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
                    Annotations ({Object.keys(lease.metadata.annotations).length})
                  </button>
                  {expandedSections.annotations && (
                    <div className="mt-3 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 max-h-60 overflow-y-auto">
                      <div className="space-y-3">
                        {Object.entries(lease.metadata.annotations).map(([key, value]) => (
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
              emptyMessage="No events found for this lease"
              pageSize={20}
            />
          </div>
        )}
      </div>

      {lease && (
        <>
          <ConfirmationModal
            isOpen={isSaveYamlModalOpen}
            onClose={() => setIsSaveYamlModalOpen(false)}
            onConfirm={handleSaveYaml}
            title="Save YAML Changes"
            message="Are you sure you want to save the YAML changes? This will update the lease."
            confirmText="Save"
            type="warning"
          />

          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleDeleteLease}
            title="Delete Lease"
            message={`Are you sure you want to delete lease "${leaseName}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}

