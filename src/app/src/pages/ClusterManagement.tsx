import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getClusters, removeCluster } from '@/services/api'
import {
  PencilSquareIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ServerIcon,
  CpuChipIcon,
  CircleStackIcon,
} from '@heroicons/react/24/outline'
import { Switch } from '@headlessui/react'
import clsx from 'clsx'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { DataTable, Column } from '@/components/shared/DataTable'
import api from '@/services/api'
import ImportClusterModal from '@/components/ClusterManagement/ImportClusterModal'
import EditClusterModal from '@/components/ClusterManagement/EditClusterModal'
import { useNotificationStore } from '@/stores/notificationStore'

interface ClusterMetrics {
  [clusterName: string]: {
    cpu: {
      usage: number
      capacity: number
    }
    memory: {
      usage: number
      capacity: number
    }
  }
}

interface ClusterData {
  name: string
  enabled?: boolean
  status?: string
  version: string
  context?: string
  is_default?: boolean
  metadata?: {
    nodes_count?: number
    namespaces_count?: number
    provider?: string
  }
}

export default function ClusterManagement() {
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [clusterMetrics, setClusterMetrics] = useState<ClusterMetrics>({})
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedCluster, setSelectedCluster] = useState<ClusterData | null>(null)

  const { data: clusters, isLoading } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  const deleteMutation = useMutation({
    mutationFn: removeCluster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      setIsDeleteModalOpen(false)
      setSelectedCluster(null)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Cluster deleted successfully'
      })
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Error',
        message: error?.response?.data?.error || 'Failed to delete cluster'
      })
    }
  })

  const toggleClusterMutation = useMutation({
    mutationFn: async ({ name, enabled }: { name: string; enabled: boolean }) => {
      await api.patch(`/clusters/${name}/enabled`, { enabled })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clusters'], exact: false })
      await queryClient.refetchQueries({ queryKey: ['clusters'], exact: false })
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Cluster status updated successfully'
      })
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Error',
        message: error?.response?.data?.error || 'Failed to update cluster status'
      })
    }
  })

  const toggleCluster = (clusterName: string, currentEnabled: boolean) => {
    toggleClusterMutation.mutate({ name: clusterName, enabled: !currentEnabled })
  }

  const handleEdit = (cluster: ClusterData) => {
    setSelectedCluster(cluster)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (cluster: ClusterData) => {
    setSelectedCluster(cluster)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (selectedCluster) {
      deleteMutation.mutate(selectedCluster.name)
    }
  }

  // Fetch metrics for all clusters
  useEffect(() => {
    if (clusters && clusters.length > 0) {
      fetchAllClusterMetrics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters])

  const fetchAllClusterMetrics = async () => {
    if (!clusters) return
    const metricsMap: ClusterMetrics = {}
    
    await Promise.all(
      clusters.map(async (cluster: any) => {
        try {
          const response = await api.get(`/clusters/${cluster.name}/metrics`)
          const data = response.data
          
          if (data) {
            metricsMap[cluster.name] = {
              cpu: {
                usage: data.cpu?.usage || 0,
                capacity: data.cpu?.capacity || 0
              },
              memory: {
                usage: data.memory?.usage || 0,
                capacity: data.memory?.capacity || 0
              }
            }
          }
        } catch (error) {
          // Silently fail for metrics
        }
      })
    )
    
    setClusterMetrics(metricsMap)
  }

  const getClusterCondition = (cluster: any) => {
    // Use status from API response
    const status = cluster.status || 'unknown'
    
    switch (status.toLowerCase()) {
      case 'connected':
        return { status: 'Connected', color: 'success' }
      case 'disconnected':
        return { status: 'Disconnected', color: 'error' }
      case 'error':
        return { status: 'Error', color: 'error' }
      default:
        return { status: 'Unknown', color: 'warning' }
    }
  }

  const getProviderBadge = (provider?: string) => {
    const providerLower = provider?.toLowerCase() || 'self-hosted'
    const colors: Record<string, string> = {
      eks: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      gke: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      aks: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
      'self-hosted': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    }
    return colors[providerLower] || colors['self-hosted']
  }

  const formatCPU = (millicores: number) => {
    if (!millicores) return 'N/A'
    const cores = millicores / 1000
    if (cores < 1) {
      return `${millicores}m`
    }
    return `${cores.toFixed(1)}`
  }

  const formatBytes = (bytes: number) => {
    if (!bytes) return 'N/A'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)}${sizes[i]}`
  }

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500 dark:bg-red-600'
    if (percentage >= 75) return 'bg-yellow-500 dark:bg-yellow-600'
    return 'bg-green-500 dark:bg-green-600'
  }

  const renderResourceBar = (usage: number, capacity: number, formatFn: (val: number) => string) => {
    if (!capacity || capacity === 0) {
      return <span className="text-xs text-gray-400">N/A</span>
    }

    if (!usage) {
      return (
        <div className="flex flex-col gap-1 w-full min-w-[100px]">
          <span className="text-xs text-gray-500 dark:text-gray-400">No metrics</span>
          <div className="text-[10px] text-gray-400 dark:text-gray-500">
            Capacity: {formatFn(capacity)}
          </div>
        </div>
      )
    }

    const percentage = Math.min((usage / capacity) * 100, 100)
    const colorClass = getProgressBarColor(percentage)

    return (
      <div className="flex flex-col gap-1 w-full min-w-[100px]">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-gray-900 dark:text-white">{formatFn(usage)}</span>
          <span className="text-gray-500 dark:text-gray-400">
            {percentage.toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${colorClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          Cap: {formatFn(capacity)}
        </span>
      </div>
    )
  }

  // Define DataTable columns
  const columns: Column<ClusterData>[] = [
    {
      key: 'name',
      header: 'Cluster',
      accessor: (cluster) => (
        <Link
          to="/dashboard"
          className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
        >
          {cluster.name}
        </Link>
      ),
      sortable: true,
      sortValue: (cluster) => cluster.name,
      searchValue: (cluster) => cluster.name,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (cluster) => (
        <Switch
          checked={cluster.enabled ?? false}
          onChange={() => toggleCluster(cluster.name, cluster.enabled ?? false)}
          className={clsx(
            cluster.enabled ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700',
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900'
          )}
        >
          <span
            className={clsx(
              cluster.enabled ? 'translate-x-6' : 'translate-x-1',
              'inline-block h-4 w-4 transform rounded-full bg-white transition-transform'
            )}
          />
        </Switch>
      ),
      sortable: true,
      sortValue: (cluster) => cluster.enabled ? 1 : 0,
      filterable: true,
      filterOptions: () => ['Enabled', 'Disabled'],
      filterValue: (cluster) => cluster.enabled ? 'Enabled' : 'Disabled',
    },
    {
      key: 'condition',
      header: 'Condition',
      accessor: (cluster) => {
        const condition = getClusterCondition(cluster)
        return (
          <span className={clsx(
            'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold',
            condition.color === 'success' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            condition.color === 'warning' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
            condition.color === 'error' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          )}>
            {condition.status}
          </span>
        )
      },
      sortable: true,
      sortValue: (cluster) => getClusterCondition(cluster).status,
      filterable: true,
      filterOptions: (data) => {
        const conditions = new Set(data.map(c => getClusterCondition(c).status))
        return Array.from(conditions)
      },
      filterValue: (cluster) => getClusterCondition(cluster).status,
    },
    {
      key: 'nodes',
      header: 'Nodes',
      accessor: (cluster) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {cluster.metadata?.nodes_count || 0}
        </span>
      ),
      sortable: true,
      sortValue: (cluster) => cluster.metadata?.nodes_count || 0,
    },
    {
      key: 'cpu',
      header: 'CPU',
      accessor: (cluster) => {
        const metrics = clusterMetrics[cluster.name]
        const cpuUsed = metrics?.cpu?.usage || 0
        const cpuTotal = metrics?.cpu?.capacity || 0
        return renderResourceBar(cpuUsed, cpuTotal, formatCPU)
      },
      sortable: true,
      sortValue: (cluster) => {
        const metrics = clusterMetrics[cluster.name]
        return metrics?.cpu?.usage || 0
      },
    },
    {
      key: 'memory',
      header: 'Memory',
      accessor: (cluster) => {
        const metrics = clusterMetrics[cluster.name]
        const memoryUsed = metrics?.memory?.usage || 0
        const memoryTotal = metrics?.memory?.capacity || 0
        return renderResourceBar(memoryUsed, memoryTotal, formatBytes)
      },
      sortable: true,
      sortValue: (cluster) => {
        const metrics = clusterMetrics[cluster.name]
        return metrics?.memory?.usage || 0
      },
    },
    {
      key: 'version',
      header: 'Version',
      accessor: (cluster) => (
        <span className="text-sm text-gray-900 dark:text-white font-mono">
          {cluster.version}
        </span>
      ),
      sortable: true,
      sortValue: (cluster) => cluster.version,
      searchValue: (cluster) => cluster.version,
    },
    {
      key: 'provider',
      header: 'Provider',
      accessor: (cluster) => (
        <span className={clsx(
          'inline-flex px-2.5 py-1 rounded-full text-xs font-semibold',
          getProviderBadge(cluster.metadata?.provider)
        )}>
          {cluster.metadata?.provider || 'Self-hosted'}
        </span>
      ),
      sortable: true,
      sortValue: (cluster) => cluster.metadata?.provider || 'Self-hosted',
      searchValue: (cluster) => cluster.metadata?.provider || 'Self-hosted',
      filterable: true,
      filterOptions: (data) => {
        const providers = new Set(data.map(c => c.metadata?.provider || 'Self-hosted'))
        return Array.from(providers)
      },
      filterValue: (cluster) => cluster.metadata?.provider || 'Self-hosted',
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (cluster) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleEdit(cluster)
            }}
            className="p-1.5 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
            title="Edit"
          >
            <PencilSquareIcon className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDeleteClick(cluster)
            }}
            className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Delete"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      ),
      className: 'text-right',
    },
  ]

  // Mobile card renderer
  const renderMobileCard = (cluster: ClusterData) => {
    const metrics = clusterMetrics[cluster.name]
    const cpuUsed = metrics?.cpu?.usage || 0
    const cpuTotal = metrics?.cpu?.capacity || 0
    const memoryUsed = metrics?.memory?.usage || 0
    const memoryTotal = metrics?.memory?.capacity || 0
    const condition = getClusterCondition(cluster)

    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/20">
              <ServerIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="flex-1 min-w-0">
              <Link
                to="/dashboard"
                className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 truncate block"
              >
                {cluster.name}
              </Link>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {cluster.version}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleEdit(cluster)
              }}
              className="p-1.5 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
            >
              <PencilSquareIcon className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteClick(cluster)
              }}
              className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Status & Condition */}
        <div className="flex items-center justify-between gap-3 py-2 border-t border-b border-gray-100 dark:border-white/[0.05]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Status:</span>
            <Switch
              checked={cluster.enabled ?? false}
              onChange={() => toggleCluster(cluster.name, cluster.enabled ?? false)}
              className={clsx(
                cluster.enabled ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700',
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors'
              )}
            >
              <span
                className={clsx(
                  cluster.enabled ? 'translate-x-5' : 'translate-x-1',
                  'inline-block h-3 w-3 transform rounded-full bg-white transition-transform'
                )}
              />
            </Switch>
          </div>
          <span className={clsx(
            'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold',
            condition.color === 'success' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
            condition.color === 'warning' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
            condition.color === 'error' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          )}>
            {condition.status}
          </span>
        </div>

        {/* Provider & Nodes */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Provider</span>
            <span className={clsx(
              'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold',
              getProviderBadge(cluster.metadata?.provider)
            )}>
              {cluster.metadata?.provider || 'Self-hosted'}
            </span>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Nodes</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {cluster.metadata?.nodes_count || 0}
            </span>
          </div>
        </div>

        {/* CPU & Memory */}
        <div className="space-y-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CpuChipIcon className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">CPU</span>
            </div>
            {renderResourceBar(cpuUsed, cpuTotal, formatCPU)}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CircleStackIcon className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Memory</span>
            </div>
            {renderResourceBar(memoryUsed, memoryTotal, formatBytes)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Breadcrumb */}
      <Breadcrumb items={[{ name: 'Cluster Management' }]} />

      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            Cluster Management
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage and monitor your Kubernetes clusters
          </p>
        </div>
        <button 
          onClick={() => setIsImportModalOpen(true)}
          className="btn-primary flex items-center gap-2 justify-center whitespace-nowrap"
        >
          <ArrowDownTrayIcon className="h-5 w-5" />
          <span>Import Cluster</span>
        </button>
      </div>

      {/* DataTable */}
      <DataTable
        data={clusters || []}
        columns={columns}
        searchPlaceholder="Search clusters by name, version, or provider..."
        isLoading={isLoading}
        emptyMessage="No clusters configured yet"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <ServerIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={renderMobileCard}
        keyExtractor={(cluster) => cluster.name}
      />

      {/* Modals */}
      <ImportClusterModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
      <EditClusterModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        cluster={selectedCluster}
      />
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setSelectedCluster(null)
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Cluster"
        message={`Are you sure you want to delete "${selectedCluster?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
