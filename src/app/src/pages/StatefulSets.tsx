import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getStatefulSets } from '@/services/api'
import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { 
  ArrowsUpDownIcon, 
  ArrowPathIcon, 
  TrashIcon, 
  InformationCircleIcon,
  CircleStackIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import StatefulSetDetailsModal from '@/components/StatefulSets/StatefulSetDetailsModal'
import StatefulSetPodsModal from '@/components/StatefulSets/StatefulSetPodsModal'
import ScaleStatefulSetModal from '@/components/StatefulSets/ScaleStatefulSetModal'
import EditStatefulSetModal from '@/components/StatefulSets/EditStatefulSetModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { DataTable, Column } from '@/components/shared/DataTable'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface StatefulSetData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
    labels?: Record<string, string>
  }
  spec: {
    replicas?: number
    updateStrategy?: {
      type?: string
    }
  }
  status: {
    currentReplicas?: number
    readyReplicas?: number
    updatedReplicas?: number
  }
  clusterName: string
}

export default function StatefulSets() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedStatefulSet, setSelectedStatefulSet] = useState<StatefulSetData | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isPodsModalOpen, setIsPodsModalOpen] = useState(false)
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isRestartModalOpen, setIsRestartModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch statefulsets from all clusters or specific cluster/namespace
  const { data: allStatefulSets, isLoading } = useQuery({
    queryKey: namespace 
      ? ['statefulsets', cluster, namespace]
      : cluster 
        ? ['statefulsets', cluster] 
        : ['all-statefulsets', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const statefulsets = await getStatefulSets(cluster, namespace)
        return statefulsets.map((statefulset: any) => ({ ...statefulset, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const statefulsets = await getStatefulSets(cluster)
        return statefulsets.map((statefulset: any) => ({ ...statefulset, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allStatefulSets = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const statefulsets = await getStatefulSets(cluster.name)
            return statefulsets.map((statefulset: any) => ({ ...statefulset, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching statefulsets from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allStatefulSets.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper function to determine statefulset status
  const getStatefulSetStatus = (statefulset: StatefulSetData): string => {
    const desired = statefulset.spec.replicas || 0
    const current = statefulset.status.currentReplicas || 0
    const ready = statefulset.status.readyReplicas || 0
    const updated = statefulset.status.updatedReplicas || 0

    // Running: all replicas are ready and updated
    if (ready === desired && updated === desired && current === desired) {
      return 'Running'
    }

    // Unavailable: No ready pods when replicas are desired
    if (ready === 0 && desired > 0) {
      return 'Unavailable'
    }

    // Scaling: current replicas doesn't match desired
    if (current !== desired) {
      return 'Scaling'
    }

    // Updating: not all replicas are updated yet
    if (updated < desired) {
      return 'Updating'
    }

    // Degraded: has desired replicas but not all ready yet
    if (current === desired && ready < desired) {
      return 'Degraded'
    }

    return 'Updating'
  }

  // Action handlers
  const handleScaleClick = (statefulset: StatefulSetData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedStatefulSet(statefulset)
    setIsScaleModalOpen(true)
  }

  const handleEditClick = (statefulset: StatefulSetData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedStatefulSet(statefulset)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (statefulset: StatefulSetData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedStatefulSet(statefulset)
    setIsDeleteModalOpen(true)
  }

  const handleViewDetailsClick = (statefulset: StatefulSetData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedStatefulSet(statefulset)
    setIsDetailsModalOpen(true)
  }

  const handleRestartClick = (statefulset: StatefulSetData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedStatefulSet(statefulset)
    setIsRestartModalOpen(true)
  }

  const handleRestartConfirm = async () => {
    if (!selectedStatefulSet) return
    try {
      await api.post(`/clusters/${selectedStatefulSet.clusterName}/namespaces/${selectedStatefulSet.metadata.namespace}/statefulsets/${selectedStatefulSet.metadata.name}/restart`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'StatefulSet restarted successfully',
      })
      setIsRestartModalOpen(false)
      setSelectedStatefulSet(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['statefulsets'] })
      await queryClient.invalidateQueries({ queryKey: ['all-statefulsets'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to restart statefulset: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedStatefulSet) return
    try {
      await api.delete(`/clusters/${selectedStatefulSet.clusterName}/namespaces/${selectedStatefulSet.metadata.namespace}/statefulsets/${selectedStatefulSet.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'StatefulSet deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedStatefulSet(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['statefulsets'] })
      await queryClient.invalidateQueries({ queryKey: ['all-statefulsets'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete statefulset: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<StatefulSetData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (statefulset) => (
        <div className="flex items-center gap-2">
          <CircleStackIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${statefulset.clusterName}/namespaces/${statefulset.metadata.namespace}/statefulsets/${statefulset.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {statefulset.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {statefulset.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (statefulset) => statefulset.metadata.name,
      searchValue: (statefulset) => `${statefulset.metadata.name} ${statefulset.clusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (statefulset) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {statefulset.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (statefulset) => statefulset.metadata.namespace,
      searchValue: (statefulset) => statefulset.metadata.namespace,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (statefulset) => {
        const status = getStatefulSetStatus(statefulset)
        const isRunning = status === 'Running'
        const isUpdating = status === 'Updating' || status === 'Scaling'
        const isDegraded = status === 'Degraded' || status === 'Unavailable'
        
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
            isRunning
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : isUpdating
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
              : isDegraded
              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
          )}>
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full',
              isRunning ? 'bg-green-600 dark:bg-green-400' :
              isUpdating ? 'bg-yellow-600 dark:bg-yellow-400' :
              isDegraded ? 'bg-red-600 dark:bg-red-400' :
              'bg-gray-600 dark:bg-gray-400'
            )} />
            {status}
          </span>
        )
      },
      sortable: true,
      sortValue: (statefulset) => getStatefulSetStatus(statefulset),
      searchValue: (statefulset) => getStatefulSetStatus(statefulset),
      filterable: true,
      filterOptions: (data) => {
        const statuses = new Set(data.map(d => getStatefulSetStatus(d)))
        return Array.from(statuses).sort()
      },
      filterValue: (statefulset) => getStatefulSetStatus(statefulset),
    },
    {
      key: 'replicas',
      header: 'Replicas',
      accessor: (statefulset) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {statefulset.status.currentReplicas || 0}
        </span>
      ),
      sortable: true,
      sortValue: (statefulset) => statefulset.status.currentReplicas || 0,
      searchValue: (statefulset) => (statefulset.status.currentReplicas || 0).toString(),
    },
    {
      key: 'ready',
      header: 'Ready',
      accessor: (statefulset) => {
        const ready = statefulset.status.readyReplicas || 0
        const total = statefulset.spec.replicas || 0
        const allReady = ready === total && total > 0
        
        return (
          <span className={clsx(
            'text-sm font-medium',
            allReady ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'
          )}>
            {ready}/{total}
          </span>
        )
      },
      sortable: true,
      sortValue: (statefulset) => statefulset.status.readyReplicas || 0,
      searchValue: (statefulset) => `${statefulset.status.readyReplicas || 0}/${statefulset.spec.replicas || 0}`,
    },
    {
      key: 'updateStrategy',
      header: 'Update Strategy',
      accessor: (statefulset) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {statefulset.spec.updateStrategy?.type || 'RollingUpdate'}
        </span>
      ),
      sortable: true,
      sortValue: (statefulset) => statefulset.spec.updateStrategy?.type || 'RollingUpdate',
      searchValue: (statefulset) => statefulset.spec.updateStrategy?.type || 'RollingUpdate',
      filterable: true,
      filterOptions: (data) => {
        const strategies = new Set(data.map(d => d.spec.updateStrategy?.type || 'RollingUpdate'))
        return Array.from(strategies).sort()
      },
      filterValue: (statefulset) => statefulset.spec.updateStrategy?.type || 'RollingUpdate',
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (statefulset) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(statefulset.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (statefulset) => new Date(statefulset.metadata.creationTimestamp).getTime(),
      searchValue: (statefulset) => formatAge(statefulset.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (statefulset) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => handleScaleClick(statefulset, e)}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="Scale"
          >
            <ArrowsUpDownIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleRestartClick(statefulset, e)}
            className="p-1.5 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
            title="Restart"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleViewDetailsClick(statefulset, e)}
            className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
            title="Details"
          >
            <InformationCircleIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(statefulset, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(statefulset, e)}
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
          ...(namespace ? [{ name: namespace }] : []),
          { name: 'StatefulSets' }
        ]}
      />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
          StatefulSets
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {namespace 
            ? `StatefulSets in ${cluster} / ${namespace}`
            : cluster 
              ? `All statefulsets in ${cluster}`
              : `All statefulsets across ${clusters?.length || 0} cluster(s)`
          }
        </p>
      </div>
      
      <DataTable
        data={allStatefulSets || []}
        columns={columns}
        keyExtractor={(statefulset) => `${statefulset.clusterName}-${statefulset.metadata.namespace}-${statefulset.metadata.name}`}
        searchPlaceholder="Search statefulsets by name, cluster, namespace, status, strategy..."
        isLoading={isLoading}
        emptyMessage="No statefulsets found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <CircleStackIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(statefulset) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <CircleStackIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${statefulset.clusterName}/namespaces/${statefulset.metadata.namespace}/statefulsets/${statefulset.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {statefulset.metadata.name}
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {statefulset.metadata.namespace}
                  </div>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {statefulset.clusterName}
                    </div>
                  )}
                </div>
              </div>
              <span className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full shrink-0',
                getStatefulSetStatus(statefulset) === 'Running'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : getStatefulSetStatus(statefulset) === 'Updating' || getStatefulSetStatus(statefulset) === 'Scaling'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              )}>
                <span className={clsx(
                  'w-1.5 h-1.5 rounded-full',
                  getStatefulSetStatus(statefulset) === 'Running' ? 'bg-green-600' :
                  getStatefulSetStatus(statefulset) === 'Updating' || getStatefulSetStatus(statefulset) === 'Scaling' ? 'bg-yellow-600' :
                  'bg-red-600'
                )} />
                {getStatefulSetStatus(statefulset)}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Replicas:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{statefulset.status.currentReplicas || 0}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Ready:</span>
                <span className={clsx(
                  'ml-1 font-medium',
                  (statefulset.status.readyReplicas || 0) === (statefulset.spec.replicas || 0) && (statefulset.spec.replicas || 0) > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-900 dark:text-white'
                )}>
                  {statefulset.status.readyReplicas || 0}/{statefulset.spec.replicas || 0}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 dark:text-gray-400">Strategy:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{statefulset.spec.updateStrategy?.type || 'RollingUpdate'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(statefulset.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => handleScaleClick(statefulset, e)}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="Scale"
                >
                  <ArrowsUpDownIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleRestartClick(statefulset, e)}
                  className="p-1.5 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                  title="Restart"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleViewDetailsClick(statefulset, e)}
                  className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                  title="Details"
                >
                  <InformationCircleIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(statefulset, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(statefulset, e)}
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
      {selectedStatefulSet && (
        <>
          <StatefulSetDetailsModal
            statefulset={selectedStatefulSet}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedStatefulSet(null)
            }}
          />
          <StatefulSetPodsModal
            statefulset={selectedStatefulSet}
            isOpen={isPodsModalOpen}
            onClose={() => {
              setIsPodsModalOpen(false)
              setSelectedStatefulSet(null)
            }}
          />
          <ScaleStatefulSetModal
            statefulset={selectedStatefulSet}
            isOpen={isScaleModalOpen}
            onClose={() => {
              setIsScaleModalOpen(false)
              setSelectedStatefulSet(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['statefulsets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-statefulsets'] })
              await queryClient.refetchQueries({ queryKey: ['statefulsets'] })
              await queryClient.refetchQueries({ queryKey: ['all-statefulsets'] })
              setIsScaleModalOpen(false)
              setSelectedStatefulSet(null)
            }}
          />
          <EditStatefulSetModal
            statefulset={selectedStatefulSet}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedStatefulSet(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['statefulsets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-statefulsets'] })
              await queryClient.refetchQueries({ queryKey: ['statefulsets'] })
              await queryClient.refetchQueries({ queryKey: ['all-statefulsets'] })
              setIsEditModalOpen(false)
              setSelectedStatefulSet(null)
            }}
          />
          <ConfirmationModal
            isOpen={isRestartModalOpen}
            onClose={() => {
              setIsRestartModalOpen(false)
              setSelectedStatefulSet(null)
            }}
            onConfirm={handleRestartConfirm}
            title="Restart StatefulSet"
            message={`Are you sure you want to restart statefulset "${selectedStatefulSet.metadata.name}"? This will restart all pods.`}
            confirmText="Restart"
            type="warning"
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedStatefulSet(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete StatefulSet"
            message={`Are you sure you want to delete statefulset "${selectedStatefulSet.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}

