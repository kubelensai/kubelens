import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getReplicaSets } from '@/services/api'
import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { 
  ArrowsUpDownIcon, 
  TrashIcon, 
  InformationCircleIcon,
  Square3Stack3DIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ReplicaSetDetailsModal from '@/components/ReplicaSets/ReplicaSetDetailsModal'
import ReplicaSetPodsModal from '@/components/ReplicaSets/ReplicaSetPodsModal'
import ScaleReplicaSetModal from '@/components/ReplicaSets/ScaleReplicaSetModal'
import EditReplicaSetModal from '@/components/ReplicaSets/EditReplicaSetModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { DataTable, Column } from '@/components/shared/DataTable'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface ReplicaSetData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
    labels?: Record<string, string>
    ownerReferences?: Array<{
      kind: string
      name: string
    }>
  }
  spec: {
    replicas?: number
  }
  status: {
    replicas?: number
    readyReplicas?: number
    availableReplicas?: number
  }
  clusterName: string
}

export default function ReplicaSets() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedReplicaSet, setSelectedReplicaSet] = useState<ReplicaSetData | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isPodsModalOpen, setIsPodsModalOpen] = useState(false)
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch replicasets from all clusters or specific cluster/namespace
  const { data: allReplicaSets, isLoading } = useQuery({
    queryKey: namespace 
      ? ['replicasets', cluster, namespace]
      : cluster 
        ? ['replicasets', cluster] 
        : ['all-replicasets', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const replicasets = await getReplicaSets(cluster, namespace)
        return replicasets.map((replicaset: any) => ({ ...replicaset, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const replicasets = await getReplicaSets(cluster)
        return replicasets.map((replicaset: any) => ({ ...replicaset, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allReplicaSets = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const replicasets = await getReplicaSets(cluster.name)
            return replicasets.map((replicaset: any) => ({ ...replicaset, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching replicasets from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allReplicaSets.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper function to determine replicaset status
  const getReplicaSetStatus = (replicaset: ReplicaSetData): string => {
    const desired = replicaset.spec.replicas || 0
    const current = replicaset.status.replicas || 0
    const ready = replicaset.status.readyReplicas || 0
    const available = replicaset.status.availableReplicas || 0

    // Ready: all replicas are ready and available
    if (ready === desired && available === desired && current === desired) {
      return 'Ready'
    }

    // Not Ready: No ready pods when replicas are desired
    if (ready === 0 && desired > 0) {
      return 'Not Ready'
    }

    // Scaling: current replicas doesn't match desired
    if (current !== desired) {
      return 'Scaling'
    }

    // Partial: has desired replicas but not all ready yet
    if (current === desired && ready < desired) {
      return 'Partial'
    }

    return 'Scaling'
  }

  // Action handlers
  const handleScaleClick = (replicaset: ReplicaSetData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedReplicaSet(replicaset)
    setIsScaleModalOpen(true)
  }

  const handleEditClick = (replicaset: ReplicaSetData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedReplicaSet(replicaset)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (replicaset: ReplicaSetData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedReplicaSet(replicaset)
    setIsDeleteModalOpen(true)
  }

  const handleViewDetailsClick = (replicaset: ReplicaSetData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedReplicaSet(replicaset)
    setIsDetailsModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedReplicaSet) return
    try {
      await api.delete(`/clusters/${selectedReplicaSet.clusterName}/namespaces/${selectedReplicaSet.metadata.namespace}/replicasets/${selectedReplicaSet.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'ReplicaSet deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedReplicaSet(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['replicasets'] })
      await queryClient.invalidateQueries({ queryKey: ['all-replicasets'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete replicaset: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<ReplicaSetData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (replicaset) => (
        <div className="flex items-center gap-2">
          <Square3Stack3DIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${replicaset.clusterName}/namespaces/${replicaset.metadata.namespace}/replicasets/${replicaset.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {replicaset.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {replicaset.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (replicaset) => replicaset.metadata.name,
      searchValue: (replicaset) => `${replicaset.metadata.name} ${replicaset.clusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (replicaset) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {replicaset.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (replicaset) => replicaset.metadata.namespace,
      searchValue: (replicaset) => replicaset.metadata.namespace,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (replicaset) => {
        const status = getReplicaSetStatus(replicaset)
        const isReady = status === 'Ready'
        const isScaling = status === 'Scaling' || status === 'Partial'
        const isNotReady = status === 'Not Ready'
        
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
            isReady
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : isScaling
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
              : isNotReady
              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
          )}>
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full',
              isReady ? 'bg-green-600 dark:bg-green-400' :
              isScaling ? 'bg-yellow-600 dark:bg-yellow-400' :
              isNotReady ? 'bg-red-600 dark:bg-red-400' :
              'bg-gray-600 dark:bg-gray-400'
            )} />
            {status}
          </span>
        )
      },
      sortable: true,
      sortValue: (replicaset) => getReplicaSetStatus(replicaset),
      searchValue: (replicaset) => getReplicaSetStatus(replicaset),
      filterable: true,
      filterOptions: (data) => {
        const statuses = new Set(data.map(d => getReplicaSetStatus(d)))
        return Array.from(statuses).sort()
      },
      filterValue: (replicaset) => getReplicaSetStatus(replicaset),
    },
    {
      key: 'desired',
      header: 'Desired',
      accessor: (replicaset) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {replicaset.spec.replicas || 0}
        </span>
      ),
      sortable: true,
      sortValue: (replicaset) => replicaset.spec.replicas || 0,
      searchValue: (replicaset) => (replicaset.spec.replicas || 0).toString(),
    },
    {
      key: 'current',
      header: 'Current',
      accessor: (replicaset) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {replicaset.status.replicas || 0}
        </span>
      ),
      sortable: true,
      sortValue: (replicaset) => replicaset.status.replicas || 0,
      searchValue: (replicaset) => (replicaset.status.replicas || 0).toString(),
    },
    {
      key: 'ready',
      header: 'Ready',
      accessor: (replicaset) => {
        const ready = replicaset.status.readyReplicas || 0
        const total = replicaset.spec.replicas || 0
        const allReady = ready === total && total > 0
        
        return (
          <span className={clsx(
            'text-sm font-medium',
            allReady ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'
          )}>
            {ready}
          </span>
        )
      },
      sortable: true,
      sortValue: (replicaset) => replicaset.status.readyReplicas || 0,
      searchValue: (replicaset) => (replicaset.status.readyReplicas || 0).toString(),
    },
    {
      key: 'owner',
      header: 'Owner',
      accessor: (replicaset) => {
        const owner = replicaset.metadata.ownerReferences?.[0]
        if (!owner) {
          return <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
        }
        return (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {owner.kind} / {owner.name}
          </span>
        )
      },
      sortable: false,
      searchValue: (replicaset) => {
        const owner = replicaset.metadata.ownerReferences?.[0]
        return owner ? `${owner.kind} ${owner.name}` : ''
      },
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (replicaset) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(replicaset.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (replicaset) => new Date(replicaset.metadata.creationTimestamp).getTime(),
      searchValue: (replicaset) => formatAge(replicaset.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (replicaset) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => handleScaleClick(replicaset, e)}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="Scale"
          >
            <ArrowsUpDownIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleViewDetailsClick(replicaset, e)}
            className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
            title="Details"
          >
            <InformationCircleIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(replicaset, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(replicaset, e)}
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
          { name: 'ReplicaSets' }
        ]}
      />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
          ReplicaSets
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {namespace 
            ? `ReplicaSets in ${cluster} / ${namespace}`
            : cluster 
              ? `All replicasets in ${cluster}`
              : `All replicasets across ${clusters?.length || 0} cluster(s)`
          }
        </p>
      </div>
      
      <DataTable
        data={allReplicaSets || []}
        columns={columns}
        keyExtractor={(replicaset) => `${replicaset.clusterName}-${replicaset.metadata.namespace}-${replicaset.metadata.name}`}
        searchPlaceholder="Search replicasets by name, cluster, namespace, status, owner..."
        isLoading={isLoading}
        emptyMessage="No replicasets found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <Square3Stack3DIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(replicaset) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Square3Stack3DIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${replicaset.clusterName}/namespaces/${replicaset.metadata.namespace}/replicasets/${replicaset.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {replicaset.metadata.name}
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {replicaset.metadata.namespace}
                  </div>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {replicaset.clusterName}
                    </div>
                  )}
                </div>
              </div>
              <span className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full shrink-0',
                getReplicaSetStatus(replicaset) === 'Ready'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : getReplicaSetStatus(replicaset) === 'Scaling' || getReplicaSetStatus(replicaset) === 'Partial'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              )}>
                <span className={clsx(
                  'w-1.5 h-1.5 rounded-full',
                  getReplicaSetStatus(replicaset) === 'Ready' ? 'bg-green-600' :
                  getReplicaSetStatus(replicaset) === 'Scaling' || getReplicaSetStatus(replicaset) === 'Partial' ? 'bg-yellow-600' :
                  'bg-red-600'
                )} />
                {getReplicaSetStatus(replicaset)}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Desired:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{replicaset.spec.replicas || 0}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Current:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{replicaset.status.replicas || 0}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Ready:</span>
                <span className={clsx(
                  'ml-1 font-medium',
                  (replicaset.status.readyReplicas || 0) === (replicaset.spec.replicas || 0) && (replicaset.spec.replicas || 0) > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-900 dark:text-white'
                )}>
                  {replicaset.status.readyReplicas || 0}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Owner:</span>
                <span className="ml-1 text-gray-900 dark:text-white text-xs">
                  {replicaset.metadata.ownerReferences?.[0]?.kind || '-'} / {replicaset.metadata.ownerReferences?.[0]?.name || '-'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(replicaset.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => handleScaleClick(replicaset, e)}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="Scale"
                >
                  <ArrowsUpDownIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleViewDetailsClick(replicaset, e)}
                  className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                  title="Details"
                >
                  <InformationCircleIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(replicaset, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(replicaset, e)}
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
      {selectedReplicaSet && (
        <>
          <ReplicaSetDetailsModal
            replicaset={selectedReplicaSet}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedReplicaSet(null)
            }}
          />
          <ReplicaSetPodsModal
            replicaset={selectedReplicaSet}
            isOpen={isPodsModalOpen}
            onClose={() => {
              setIsPodsModalOpen(false)
              setSelectedReplicaSet(null)
            }}
          />
          <ScaleReplicaSetModal
            replicaset={selectedReplicaSet}
            isOpen={isScaleModalOpen}
            onClose={() => {
              setIsScaleModalOpen(false)
              setSelectedReplicaSet(null)
            }}
            onSuccess={async () => {
              // Invalidate and immediately refetch all replicaset queries
              await queryClient.invalidateQueries({ queryKey: ['replicasets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-replicasets'] })
              await queryClient.refetchQueries({ queryKey: ['replicasets'] })
              await queryClient.refetchQueries({ queryKey: ['all-replicasets'] })
              setIsScaleModalOpen(false)
              setSelectedReplicaSet(null)
            }}
          />
          <EditReplicaSetModal
            replicaset={selectedReplicaSet}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedReplicaSet(null)
            }}
            onSuccess={async () => {
              // Invalidate and immediately refetch all replicaset queries
              await queryClient.invalidateQueries({ queryKey: ['replicasets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-replicasets'] })
              await queryClient.refetchQueries({ queryKey: ['replicasets'] })
              await queryClient.refetchQueries({ queryKey: ['all-replicasets'] })
              setIsEditModalOpen(false)
              setSelectedReplicaSet(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedReplicaSet(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete ReplicaSet"
            message={`Are you sure you want to delete replicaset "${selectedReplicaSet.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}

