import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ShieldCheckIcon,
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

export default function RoleDetails() {
  const { cluster, namespace, roleName } = useParams<{ cluster: string; namespace: string; roleName: string }>()
  const navigate = useNavigate()
  const { addNotification } = useNotificationStore()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [role, setRole] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [yamlContent, setYamlContent] = useState('')
  const [expandedSections, setExpandedSections] = useState({
    labels: false,
    annotations: false,
    rules: true,
  })

  // Modal states
  const [isSaveYamlModalOpen, setIsSaveYamlModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  useEffect(() => {
    if (cluster && namespace && roleName) {
      fetchRoleDetails()
    }
  }, [cluster, namespace, roleName])

  const fetchRoleDetails = async () => {
    try {
      setIsLoading(true)
      const [roleRes, eventsRes] = await Promise.all([
        api.get(`/clusters/${cluster}/namespaces/${namespace}/roles/${roleName}`),
        api.get(`/clusters/${cluster}/events`).catch(() => ({ data: { events: [] } })),
      ])

      const roleData = roleRes.data
      const eventsData = eventsRes.data.events || []

      setRole(roleData)
      
      // Filter events related to this role
      const roleEvents = eventsData.filter((event: any) => {
        if (!roleName) return false
        
        const involvedObjectMatch = event.involvedObject?.kind === 'Role' && 
                                    event.involvedObject?.name === roleName &&
                                    event.involvedObject?.namespace === namespace
        const messageMatch = event.message?.toLowerCase().includes(roleName.toLowerCase())
        
        return involvedObjectMatch || messageMatch
      })
      
      setEvents(roleEvents)
      
      // Format as Kubernetes manifest
      const k8sManifest = {
        apiVersion: roleData.apiVersion || 'rbac.authorization.k8s.io/v1',
        kind: roleData.kind || 'Role',
        metadata: roleData.metadata,
        rules: roleData.rules,
      }
      setYamlContent(yaml.dump(k8sManifest, { indent: 2, lineWidth: -1, sortKeys: false }))
    } catch (error) {
      console.error('Failed to fetch role details:', error)
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load role details',
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
      await api.put(`/clusters/${cluster}/namespaces/${namespace}/roles/${roleName}`, updatedManifest)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Role updated successfully',
      })
      fetchRoleDetails()
      setIsSaveYamlModalOpen(false)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to update role: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleDeleteRole = async () => {
    try {
      await api.delete(`/clusters/${cluster}/namespaces/${namespace}/roles/${roleName}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Role deleted successfully',
      })
      setIsDeleteModalOpen(false)
      navigate(`/clusters/${cluster}/namespaces/${namespace}/roles`)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete role: ${error.message || 'Unknown error'}`,
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

  if (!role) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Role not found</p>
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
          { name: namespace || '', href: `/clusters/${cluster}/namespaces/${namespace}/roles` },
          { name: 'Roles', href: `/clusters/${cluster}/namespaces/${namespace}/roles` },
          { name: roleName || '' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <ShieldCheckIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              {roleName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Role Details
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
            {/* Role Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Role Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Name:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{role.metadata.name}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Namespace:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{role.metadata.namespace}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Rules:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {(role.rules || []).length}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Age:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatAge(role.metadata.creationTimestamp)}
                  </p>
                </div>
              </div>

              {/* Labels */}
              {role.metadata.labels && Object.keys(role.metadata.labels).length > 0 && (
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
                    Labels ({Object.keys(role.metadata.labels).length})
                  </button>
                  {expandedSections.labels && (
                    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(role.metadata.labels).map(([key, value]) => (
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
              {role.metadata.annotations && Object.keys(role.metadata.annotations).length > 0 && (
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
                    Annotations ({Object.keys(role.metadata.annotations).length})
                  </button>
                  {expandedSections.annotations && (
                    <div className="mt-3 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 max-h-60 overflow-y-auto">
                      <div className="space-y-3">
                        {Object.entries(role.metadata.annotations).map(([key, value]) => (
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

            {/* Rules */}
            {role.rules && role.rules.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <button
                  onClick={() => toggleSection('rules')}
                  className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {expandedSections.rules ? (
                    <ChevronUpIcon className="w-5 h-5" />
                  ) : (
                    <ChevronDownIcon className="w-5 h-5" />
                  )}
                  Rules ({role.rules.length})
                </button>
                {expandedSections.rules && (
                  <div className="mt-4 space-y-4">
                    {role.rules.map((rule: any, index: number) => (
                      <div key={index} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="space-y-3">
                          {rule.apiGroups && rule.apiGroups.length > 0 && (
                            <div>
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">API Groups:</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {rule.apiGroups.map((group: string, idx: number) => (
                                  <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                    {group || '""'}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {rule.resources && rule.resources.length > 0 && (
                            <div>
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Resources:</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {rule.resources.map((resource: string, idx: number) => (
                                  <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                    {resource}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {rule.verbs && rule.verbs.length > 0 && (
                            <div>
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Verbs:</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {rule.verbs.map((verb: string, idx: number) => (
                                  <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                    {verb}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {rule.resourceNames && rule.resourceNames.length > 0 && (
                            <div>
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Resource Names:</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {rule.resourceNames.map((name: string, idx: number) => (
                                  <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                                    {name}
                                  </span>
                                ))}
                              </div>
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
              emptyMessage="No events found for this role"
              pageSize={20}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {role && (
        <>
          <ConfirmationModal
            isOpen={isSaveYamlModalOpen}
            onClose={() => setIsSaveYamlModalOpen(false)}
            onConfirm={handleSaveYaml}
            title="Save YAML Changes"
            message="Are you sure you want to save the YAML changes? This will update the role."
            confirmText="Save"
            type="warning"
          />

          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleDeleteRole}
            title="Delete Role"
            message={`Are you sure you want to delete role "${roleName}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}

