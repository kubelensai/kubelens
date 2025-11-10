import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getDeployments } from '@/services/api'
import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { 
  ArrowsUpDownIcon, 
  PencilSquareIcon, 
  TrashIcon, 
  ArrowPathIcon, 
  InformationCircleIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import DeploymentDetailsModal from '@/components/Deployments/DeploymentDetailsModal'
import DeploymentPodsModal from '@/components/Deployments/DeploymentPodsModal'
import ScaleDeploymentModal from '@/components/Deployments/ScaleDeploymentModal'
import EditDeploymentModal from '@/components/Deployments/EditDeploymentModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { DataTable, Column } from '@/components/shared/DataTable'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface DeploymentData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
    labels?: Record<string, string>
  }
  spec: {
    replicas?: number
    strategy?: {
      type?: string
    }
  }
  status: {
    replicas?: number
    readyReplicas?: number
    availableReplicas?: number
    updatedReplicas?: number
    conditions?: Array<{
      type: string
      status: string
      reason?: string
    }>
  }
  clusterName: string
}

export default function Deployments() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentData | null>(null)
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

  // Fetch deployments from all clusters or specific cluster/namespace
  const { data: allDeployments, isLoading } = useQuery({
    queryKey: namespace 
      ? ['deployments', cluster, namespace]
      : cluster 
        ? ['deployments', cluster] 
        : ['all-deployments', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const deployments = await getDeployments(cluster, namespace)
        return deployments.map((deployment: any) => ({ ...deployment, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const deployments = await getDeployments(cluster)
        return deployments.map((deployment: any) => ({ ...deployment, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allDeployments = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const deployments = await getDeployments(cluster.name)
            return deployments.map((deployment: any) => ({ ...deployment, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching deployments from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allDeployments.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper function to determine deployment status
  const getDeploymentStatus = (deployment: DeploymentData): string => {
    const desired = deployment.spec.replicas || 0
    const current = deployment.status.replicas || 0
    const ready = deployment.status.readyReplicas || 0
    const available = deployment.status.availableReplicas || 0
    const updated = deployment.status.updatedReplicas || 0

    // Check conditions
    const conditions = deployment.status.conditions || []
    const progressingCondition = conditions.find((c: any) => c.type === 'Progressing')
    
    // Stalled: Progress deadline exceeded
    if (progressingCondition && progressingCondition.status === 'False' && progressingCondition.reason === 'ProgressDeadlineExceeded') {
      return 'Stalled'
    }

    // Unavailable: No ready pods when replicas are desired
    if (ready === 0 && desired > 0) {
      return 'Unavailable'
    }

    // Scaling: current replicas doesn't match desired
    if (current !== desired) {
      return 'Scaling'
    }

    // Scaling: actively progressing (e.g., during restart/rollout)
    if (progressingCondition && progressingCondition.status === 'True' && progressingCondition.reason === 'ReplicaSetUpdated') {
      return 'Scaling'
    }

    // Scaling: not all replicas are updated yet (during rollout)
    if (updated < desired) {
      return 'Scaling'
    }

    // Running: all replicas are ready and available
    if (ready === desired && available === desired && updated === desired) {
      return 'Running'
    }

    // Scaling: has desired replicas but not all ready yet
    if (current === desired && ready < desired) {
      if (progressingCondition && progressingCondition.status === 'True') {
        return 'Scaling'
      }
      return 'Stalled'
    }

    return 'Scaling'
  }


  // Action handlers
  const handleScaleClick = (deployment: DeploymentData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDeployment(deployment)
    setIsScaleModalOpen(true)
  }

  const handleEditClick = (deployment: DeploymentData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDeployment(deployment)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (deployment: DeploymentData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDeployment(deployment)
    setIsDeleteModalOpen(true)
  }

  const handleViewDetailsClick = (deployment: DeploymentData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDeployment(deployment)
    setIsDetailsModalOpen(true)
  }

  const handleRestartClick = (deployment: DeploymentData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDeployment(deployment)
    setIsRestartModalOpen(true)
  }

  const handleRestartConfirm = async () => {
    if (!selectedDeployment) return
    try {
      await api.post(`/clusters/${selectedDeployment.clusterName}/namespaces/${selectedDeployment.metadata.namespace}/deployments/${selectedDeployment.metadata.name}/restart`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Deployment restarted successfully',
      })
      setIsRestartModalOpen(false)
      setSelectedDeployment(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['deployments'] })
      await queryClient.invalidateQueries({ queryKey: ['all-deployments'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to restart deployment: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedDeployment) return
    try {
      await api.delete(`/clusters/${selectedDeployment.clusterName}/namespaces/${selectedDeployment.metadata.namespace}/deployments/${selectedDeployment.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Deployment deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedDeployment(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['deployments'] })
      await queryClient.invalidateQueries({ queryKey: ['all-deployments'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete deployment: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<DeploymentData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (deployment) => (
        <div className="flex items-center gap-2">
          <RocketLaunchIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${deployment.clusterName}/namespaces/${deployment.metadata.namespace}/deployments/${deployment.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {deployment.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {deployment.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (deployment) => deployment.metadata.name,
      searchValue: (deployment) => `${deployment.metadata.name} ${deployment.clusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (deployment) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {deployment.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (deployment) => deployment.metadata.namespace,
      searchValue: (deployment) => deployment.metadata.namespace,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (deployment) => {
        const status = getDeploymentStatus(deployment)
        const isRunning = status === 'Running'
        const isScaling = status === 'Scaling'
        const isStalled = status === 'Stalled'
        const isUnavailable = status === 'Unavailable'
        
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
            isRunning
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : isScaling
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
              : isStalled || isUnavailable
              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
          )}>
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full',
              isRunning ? 'bg-green-600 dark:bg-green-400' :
              isScaling ? 'bg-yellow-600 dark:bg-yellow-400' :
              isStalled || isUnavailable ? 'bg-red-600 dark:bg-red-400' :
              'bg-gray-600 dark:bg-gray-400'
            )} />
            {status}
          </span>
        )
      },
      sortable: true,
      sortValue: (deployment) => getDeploymentStatus(deployment),
      searchValue: (deployment) => getDeploymentStatus(deployment),
      filterable: true,
      filterOptions: (data) => {
        const statuses = new Set(data.map(d => getDeploymentStatus(d)))
        return Array.from(statuses).sort()
      },
      filterValue: (deployment) => getDeploymentStatus(deployment),
    },
    {
      key: 'replicas',
      header: 'Replicas',
      accessor: (deployment) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {deployment.status.replicas || 0}
        </span>
      ),
      sortable: true,
      sortValue: (deployment) => deployment.status.replicas || 0,
      searchValue: (deployment) => (deployment.status.replicas || 0).toString(),
    },
    {
      key: 'pods',
      header: 'Pods',
      accessor: (deployment) => {
        const ready = deployment.status.readyReplicas || 0
        const total = deployment.status.replicas || 0
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
      sortValue: (deployment) => deployment.status.readyReplicas || 0,
      searchValue: (deployment) => `${deployment.status.readyReplicas || 0}/${deployment.status.replicas || 0}`,
    },
    {
      key: 'strategy',
      header: 'Strategy',
      accessor: (deployment) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {deployment.spec.strategy?.type || 'RollingUpdate'}
        </span>
      ),
      sortable: true,
      sortValue: (deployment) => deployment.spec.strategy?.type || 'RollingUpdate',
      searchValue: (deployment) => deployment.spec.strategy?.type || 'RollingUpdate',
      filterable: true,
      filterOptions: (data) => {
        const strategies = new Set(data.map(d => d.spec.strategy?.type || 'RollingUpdate'))
        return Array.from(strategies).sort()
      },
      filterValue: (deployment) => deployment.spec.strategy?.type || 'RollingUpdate',
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (deployment) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(deployment.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (deployment) => new Date(deployment.metadata.creationTimestamp).getTime(),
      searchValue: (deployment) => formatAge(deployment.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (deployment) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => handleScaleClick(deployment, e)}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="Scale"
          >
            <ArrowsUpDownIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleRestartClick(deployment, e)}
            className="p-1.5 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
            title="Restart"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleViewDetailsClick(deployment, e)}
            className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
            title="Details"
          >
            <InformationCircleIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(deployment, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(deployment, e)}
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
          { name: 'Deployments' }
        ]}
      />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
          Deployments
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {namespace 
            ? `Deployments in ${cluster} / ${namespace}`
            : cluster 
              ? `All deployments in ${cluster}`
              : `All deployments across ${clusters?.length || 0} cluster(s)`
          }
        </p>
      </div>
      
      <DataTable
        data={allDeployments || []}
        columns={columns}
        keyExtractor={(deployment) => `${deployment.clusterName}-${deployment.metadata.namespace}-${deployment.metadata.name}`}
        searchPlaceholder="Search deployments by name, cluster, namespace, status, strategy..."
        isLoading={isLoading}
        emptyMessage="No deployments found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <RocketLaunchIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(deployment) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <RocketLaunchIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${deployment.clusterName}/namespaces/${deployment.metadata.namespace}/deployments/${deployment.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {deployment.metadata.name}
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {deployment.metadata.namespace}
                  </div>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {deployment.clusterName}
                    </div>
                  )}
                </div>
              </div>
              <span className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full shrink-0',
                getDeploymentStatus(deployment) === 'Running'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : getDeploymentStatus(deployment) === 'Scaling'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              )}>
                <span className={clsx(
                  'w-1.5 h-1.5 rounded-full',
                  getDeploymentStatus(deployment) === 'Running' ? 'bg-green-600' :
                  getDeploymentStatus(deployment) === 'Scaling' ? 'bg-yellow-600' :
                  'bg-red-600'
                )} />
                {getDeploymentStatus(deployment)}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Replicas:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{deployment.status.replicas || 0}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Pods:</span>
                <span className={clsx(
                  'ml-1 font-medium',
                  (deployment.status.readyReplicas || 0) === (deployment.status.replicas || 0) && (deployment.status.replicas || 0) > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-900 dark:text-white'
                )}>
                  {deployment.status.readyReplicas || 0}/{deployment.status.replicas || 0}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 dark:text-gray-400">Strategy:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{deployment.spec.strategy?.type || 'RollingUpdate'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(deployment.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => handleScaleClick(deployment, e)}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="Scale"
                >
                  <ArrowsUpDownIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleRestartClick(deployment, e)}
                  className="p-1.5 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                  title="Restart"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleViewDetailsClick(deployment, e)}
                  className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                  title="Details"
                >
                  <InformationCircleIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(deployment, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(deployment, e)}
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
      {selectedDeployment && (
        <>
          <DeploymentDetailsModal
            deployment={selectedDeployment}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedDeployment(null)
            }}
          />
          <DeploymentPodsModal
            deployment={selectedDeployment}
            isOpen={isPodsModalOpen}
            onClose={() => {
              setIsPodsModalOpen(false)
              setSelectedDeployment(null)
            }}
          />
          <ScaleDeploymentModal
            deployment={selectedDeployment}
            isOpen={isScaleModalOpen}
            onClose={() => {
              setIsScaleModalOpen(false)
              setSelectedDeployment(null)
            }}
            onSuccess={async () => {
              // Invalidate and immediately refetch all deployment queries
              await queryClient.invalidateQueries({ queryKey: ['deployments'] })
              await queryClient.invalidateQueries({ queryKey: ['all-deployments'] })
              await queryClient.refetchQueries({ queryKey: ['deployments'] })
              await queryClient.refetchQueries({ queryKey: ['all-deployments'] })
              setIsScaleModalOpen(false)
              setSelectedDeployment(null)
            }}
          />
          <EditDeploymentModal
            deployment={selectedDeployment}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedDeployment(null)
            }}
            onSuccess={async () => {
              // Invalidate and immediately refetch all deployment queries
              await queryClient.invalidateQueries({ queryKey: ['deployments'] })
              await queryClient.invalidateQueries({ queryKey: ['all-deployments'] })
              await queryClient.refetchQueries({ queryKey: ['deployments'] })
              await queryClient.refetchQueries({ queryKey: ['all-deployments'] })
              setIsEditModalOpen(false)
              setSelectedDeployment(null)
            }}
          />
          <ConfirmationModal
            isOpen={isRestartModalOpen}
            onClose={() => {
              setIsRestartModalOpen(false)
              setSelectedDeployment(null)
            }}
            onConfirm={handleRestartConfirm}
            title="Restart Deployment"
            message={`Are you sure you want to restart deployment "${selectedDeployment.metadata.name}"? This will restart all pods.`}
            confirmText="Restart"
            type="warning"
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedDeployment(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete Deployment"
            message={`Are you sure you want to delete deployment "${selectedDeployment.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}

