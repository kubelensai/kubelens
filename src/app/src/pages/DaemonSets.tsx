import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getDaemonSets } from '@/services/api'
import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { 
  ArrowPathIcon, 
  TrashIcon, 
  InformationCircleIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import DaemonSetDetailsModal from '@/components/DaemonSets/DaemonSetDetailsModal'
import DaemonSetPodsModal from '@/components/DaemonSets/DaemonSetPodsModal'
import EditDaemonSetModal from '@/components/DaemonSets/EditDaemonSetModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { DataTable, Column } from '@/components/shared/DataTable'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface DaemonSetData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
    labels?: Record<string, string>
  }
  spec: {
    updateStrategy?: {
      type?: string
    }
  }
  status: {
    desiredNumberScheduled?: number
    currentNumberScheduled?: number
    numberReady?: number
    numberAvailable?: number
    updatedNumberScheduled?: number
  }
  clusterName: string
}

export default function DaemonSets() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedDaemonSet, setSelectedDaemonSet] = useState<DaemonSetData | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isPodsModalOpen, setIsPodsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isRestartModalOpen, setIsRestartModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch daemonsets from all clusters or specific cluster/namespace
  const { data: allDaemonSets, isLoading } = useQuery({
    queryKey: namespace 
      ? ['daemonsets', cluster, namespace]
      : cluster 
        ? ['daemonsets', cluster] 
        : ['all-daemonsets', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const daemonsets = await getDaemonSets(cluster, namespace)
        return daemonsets.map((daemonset: any) => ({ ...daemonset, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const daemonsets = await getDaemonSets(cluster)
        return daemonsets.map((daemonset: any) => ({ ...daemonset, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allDaemonSets = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const daemonsets = await getDaemonSets(cluster.name)
            return daemonsets.map((daemonset: any) => ({ ...daemonset, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching daemonsets from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allDaemonSets.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper function to determine daemonset status
  const getDaemonSetStatus = (daemonset: DaemonSetData): string => {
    const desired = daemonset.status.desiredNumberScheduled || 0
    const current = daemonset.status.currentNumberScheduled || 0
    const ready = daemonset.status.numberReady || 0
    const available = daemonset.status.numberAvailable || 0
    const updated = daemonset.status.updatedNumberScheduled || 0

    // Unavailable: No ready pods when nodes exist
    if (ready === 0 && desired > 0) {
      return 'Unavailable'
    }

    // Updating: not all nodes have updated pods
    if (updated < desired) {
      return 'Updating'
    }

    // Running: all scheduled pods are ready and available
    if (ready === desired && available === desired && current === desired) {
      return 'Running'
    }

    // Pending: has desired schedule but not all current or ready
    if (current < desired || ready < desired) {
      return 'Pending'
    }

    return 'Pending'
  }

  // Action handlers
  const handleViewDetailsClick = (daemonset: DaemonSetData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDaemonSet(daemonset)
    setIsDetailsModalOpen(true)
  }

  const handleRestartClick = (daemonset: DaemonSetData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDaemonSet(daemonset)
    setIsRestartModalOpen(true)
  }

  const handleDeleteClick = (daemonset: DaemonSetData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDaemonSet(daemonset)
    setIsDeleteModalOpen(true)
  }

  const handleRestartConfirm = async () => {
    if (!selectedDaemonSet) return
    try {
      await api.post(`/clusters/${selectedDaemonSet.clusterName}/namespaces/${selectedDaemonSet.metadata.namespace}/daemonsets/${selectedDaemonSet.metadata.name}/restart`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'DaemonSet restarted successfully',
      })
      setIsRestartModalOpen(false)
      setSelectedDaemonSet(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['daemonsets'] })
      await queryClient.invalidateQueries({ queryKey: ['all-daemonsets'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to restart daemonset: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedDaemonSet) return
    try {
      await api.delete(`/clusters/${selectedDaemonSet.clusterName}/namespaces/${selectedDaemonSet.metadata.namespace}/daemonsets/${selectedDaemonSet.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'DaemonSet deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedDaemonSet(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['daemonsets'] })
      await queryClient.invalidateQueries({ queryKey: ['all-daemonsets'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete daemonset: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<DaemonSetData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (daemonset) => (
        <div className="flex items-center gap-2">
          <ServerStackIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${daemonset.clusterName}/namespaces/${daemonset.metadata.namespace}/daemonsets/${daemonset.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {daemonset.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {daemonset.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (daemonset) => daemonset.metadata.name,
      searchValue: (daemonset) => `${daemonset.metadata.name} ${daemonset.clusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (daemonset) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {daemonset.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (daemonset) => daemonset.metadata.namespace,
      searchValue: (daemonset) => daemonset.metadata.namespace,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (daemonset) => {
        const status = getDaemonSetStatus(daemonset)
        const isRunning = status === 'Running'
        const isUpdating = status === 'Updating'
        const isPending = status === 'Pending'
        const isUnavailable = status === 'Unavailable'
        
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
            isRunning
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : isUpdating || isPending
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
              : isUnavailable
              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
          )}>
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full',
              isRunning ? 'bg-green-600 dark:bg-green-400' :
              isUpdating || isPending ? 'bg-yellow-600 dark:bg-yellow-400' :
              isUnavailable ? 'bg-red-600 dark:bg-red-400' :
              'bg-gray-600 dark:bg-gray-400'
            )} />
            {status}
          </span>
        )
      },
      sortable: true,
      sortValue: (daemonset) => getDaemonSetStatus(daemonset),
      searchValue: (daemonset) => getDaemonSetStatus(daemonset),
      filterable: true,
      filterOptions: (data) => {
        const statuses = new Set(data.map(d => getDaemonSetStatus(d)))
        return Array.from(statuses).sort()
      },
      filterValue: (daemonset) => getDaemonSetStatus(daemonset),
    },
    {
      key: 'desired',
      header: 'Desired',
      accessor: (daemonset) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {daemonset.status.desiredNumberScheduled || 0}
        </span>
      ),
      sortable: true,
      sortValue: (daemonset) => daemonset.status.desiredNumberScheduled || 0,
      searchValue: (daemonset) => (daemonset.status.desiredNumberScheduled || 0).toString(),
    },
    {
      key: 'ready',
      header: 'Ready',
      accessor: (daemonset) => {
        const ready = daemonset.status.numberReady || 0
        const desired = daemonset.status.desiredNumberScheduled || 0
        const allReady = ready === desired && desired > 0
        
        return (
          <span className={clsx(
            'text-sm font-medium',
            allReady ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'
          )}>
            {ready}/{desired}
          </span>
        )
      },
      sortable: true,
      sortValue: (daemonset) => daemonset.status.numberReady || 0,
      searchValue: (daemonset) => `${daemonset.status.numberReady || 0}/${daemonset.status.desiredNumberScheduled || 0}`,
    },
    {
      key: 'strategy',
      header: 'Strategy',
      accessor: (daemonset) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {daemonset.spec.updateStrategy?.type || 'RollingUpdate'}
        </span>
      ),
      sortable: true,
      sortValue: (daemonset) => daemonset.spec.updateStrategy?.type || 'RollingUpdate',
      searchValue: (daemonset) => daemonset.spec.updateStrategy?.type || 'RollingUpdate',
      filterable: true,
      filterOptions: (data) => {
        const strategies = new Set(data.map(d => d.spec.updateStrategy?.type || 'RollingUpdate'))
        return Array.from(strategies).sort()
      },
      filterValue: (daemonset) => daemonset.spec.updateStrategy?.type || 'RollingUpdate',
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (daemonset) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(daemonset.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (daemonset) => new Date(daemonset.metadata.creationTimestamp).getTime(),
      searchValue: (daemonset) => formatAge(daemonset.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (daemonset) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => handleRestartClick(daemonset, e)}
            className="p-1.5 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
            title="Restart"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleViewDetailsClick(daemonset, e)}
            className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
            title="Details"
          >
            <InformationCircleIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(daemonset, e)}
            className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
      sortable: false,
    },
  ], [cluster, navigate])

  return (
    <div className="space-y-4 md:space-y-6">
      <Breadcrumb
        items={[
          ...(cluster ? [{ name: cluster }] : []),
          { name: 'DaemonSets' }
        ]}
      />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
          DaemonSets
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {namespace 
            ? `DaemonSets in ${cluster} / ${namespace}`
            : cluster 
              ? `All daemonsets in ${cluster}`
              : `All daemonsets across ${clusters?.length || 0} cluster(s)`
          }
        </p>
      </div>
      
      <DataTable
        data={allDaemonSets || []}
        columns={columns}
        keyExtractor={(daemonset) => `${daemonset.clusterName}-${daemonset.metadata.namespace}-${daemonset.metadata.name}`}
        searchPlaceholder="Search daemonsets by name, cluster, namespace, status, strategy..."
        isLoading={isLoading}
        emptyMessage="No daemonsets found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <ServerStackIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(daemonset) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <ServerStackIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${daemonset.clusterName}/namespaces/${daemonset.metadata.namespace}/daemonsets/${daemonset.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {daemonset.metadata.name}
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {daemonset.metadata.namespace}
                  </div>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {daemonset.clusterName}
                    </div>
                  )}
                </div>
              </div>
              <span className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full shrink-0',
                getDaemonSetStatus(daemonset) === 'Running'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : getDaemonSetStatus(daemonset) === 'Updating' || getDaemonSetStatus(daemonset) === 'Pending'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              )}>
                <span className={clsx(
                  'w-1.5 h-1.5 rounded-full',
                  getDaemonSetStatus(daemonset) === 'Running' ? 'bg-green-600' :
                  getDaemonSetStatus(daemonset) === 'Updating' || getDaemonSetStatus(daemonset) === 'Pending' ? 'bg-yellow-600' :
                  'bg-red-600'
                )} />
                {getDaemonSetStatus(daemonset)}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Desired:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{daemonset.status.desiredNumberScheduled || 0}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Ready:</span>
                <span className={clsx(
                  'ml-1 font-medium',
                  (daemonset.status.numberReady || 0) === (daemonset.status.desiredNumberScheduled || 0) && (daemonset.status.desiredNumberScheduled || 0) > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-900 dark:text-white'
                )}>
                  {daemonset.status.numberReady || 0}/{daemonset.status.desiredNumberScheduled || 0}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 dark:text-gray-400">Strategy:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{daemonset.spec.updateStrategy?.type || 'RollingUpdate'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(daemonset.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => handleRestartClick(daemonset, e)}
                  className="p-1.5 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                  title="Restart"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleViewDetailsClick(daemonset, e)}
                  className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                  title="Details"
                >
                  <InformationCircleIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(daemonset, e)}
                  className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Delete"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      />

      {/* Modals */}
      {selectedDaemonSet && (
        <>
          <DaemonSetDetailsModal
            daemonset={selectedDaemonSet}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedDaemonSet(null)
            }}
          />
          <DaemonSetPodsModal
            daemonset={selectedDaemonSet}
            isOpen={isPodsModalOpen}
            onClose={() => {
              setIsPodsModalOpen(false)
              setSelectedDaemonSet(null)
            }}
          />
          <EditDaemonSetModal
            daemonset={selectedDaemonSet}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedDaemonSet(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['daemonsets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-daemonsets'] })
              await queryClient.refetchQueries({ queryKey: ['daemonsets'] })
              await queryClient.refetchQueries({ queryKey: ['all-daemonsets'] })
              setIsEditModalOpen(false)
              setSelectedDaemonSet(null)
            }}
          />
          <ConfirmationModal
            isOpen={isRestartModalOpen}
            onClose={() => {
              setIsRestartModalOpen(false)
              setSelectedDaemonSet(null)
            }}
            onConfirm={handleRestartConfirm}
            title="Restart DaemonSet"
            message={`Are you sure you want to restart daemonset "${selectedDaemonSet.metadata.name}"? This will restart all pods.`}
            confirmText="Restart"
            type="warning"
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedDaemonSet(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete DaemonSet"
            message={`Are you sure you want to delete daemonset "${selectedDaemonSet.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}

