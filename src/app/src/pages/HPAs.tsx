import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getHPAs } from '@/services/api'
import { useMemo, useState } from 'react'
import { 
  PencilSquareIcon, 
  TrashIcon, 
  EyeIcon,
  AdjustmentsHorizontalIcon,
  PlusIcon,
  ArrowsUpDownIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import CreateHPAModal from '@/components/HPAs/CreateHPAModal'
import EditHPAYAMLModal from '@/components/HPAs/EditHPAYAMLModal'
import ScaleHPAModal from '@/components/HPAs/ScaleHPAModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'
import clsx from 'clsx'

interface HPAData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec: {
    minReplicas?: number
    maxReplicas: number
    scaleTargetRef: {
      kind: string
      name: string
      apiVersion?: string
    }
    metrics?: Array<{
      type: string
      resource?: {
        name: string
        target: {
          type: string
          averageUtilization?: number
          averageValue?: string
        }
      }
      pods?: {
        metric: {
          name: string
        }
        target: {
          type: string
          averageValue: string
        }
      }
      object?: {
        metric: {
          name: string
        }
        target: {
          type: string
          value: string
        }
        describedObject: {
          kind: string
          name: string
          apiVersion?: string
        }
      }
    }>
  }
  status?: {
    currentReplicas?: number
    desiredReplicas?: number
    currentMetrics?: Array<any>
    conditions?: Array<{
      type: string
      status: string
      reason?: string
      message?: string
    }>
  }
  clusterName: string
}

export default function HPAs() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedHPA, setSelectedHPA] = useState<HPAData | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch HPAs from all clusters or specific cluster/namespace
  const { data: allHPAs, isLoading } = useQuery({
    queryKey: namespace 
      ? ['hpas', cluster, namespace]
      : cluster 
        ? ['hpas', cluster, 'all'] 
        : ['all-hpas', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const hpas = await getHPAs(cluster, namespace)
        return hpas.map((hpa: any) => ({ ...hpa, clusterName: cluster }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const hpas = await getHPAs(cluster, 'all')
        return hpas.map((hpa: any) => ({ ...hpa, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allHPAs = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const hpas = await getHPAs(cluster.name, 'all')
            return hpas.map((hpa: any) => ({ ...hpa, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching HPAs from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allHPAs.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper functions
  const getMetricsDisplay = (hpa: HPAData): string => {
    const metrics = hpa.spec?.metrics || []
    if (metrics.length === 0) return 'None'
    
    return metrics.map((metric) => {
      if (metric.type === 'Resource' && metric.resource) {
        const target = metric.resource.target
        if (target?.type === 'Utilization') {
          return `${metric.resource.name}: ${target.averageUtilization}%`
        } else if (target?.type === 'AverageValue') {
          return `${metric.resource.name}: ${target.averageValue}`
        }
      } else if (metric.type === 'Pods' && metric.pods) {
        return `pods: ${metric.pods.target.averageValue}`
      } else if (metric.type === 'Object' && metric.object) {
        return `${metric.object.metric.name}`
      }
      return metric.type
    }).join(', ')
  }

  const getStatusDisplay = (hpa: HPAData) => {
    const conditions = hpa.status?.conditions || []
    const scalingActive = conditions.find((c) => c.type === 'ScalingActive')
    const scalingLimited = conditions.find((c) => c.type === 'ScalingLimited')
    
    if (scalingLimited?.status === 'True') {
      return { label: 'Limited', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' }
    }
    
    if (scalingActive?.status === 'True') {
      return { label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' }
    }
    
    if (scalingActive?.status === 'False') {
      return { label: 'Inactive', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400' }
    }
    
    return { label: 'Unknown', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400' }
  }

  // Action handlers
  const handleEditClick = (hpa: HPAData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedHPA(hpa)
    setIsEditModalOpen(true)
  }

  const handleScaleClick = (hpa: HPAData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedHPA(hpa)
    setIsScaleModalOpen(true)
  }

  const handleDeleteClick = (hpa: HPAData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedHPA(hpa)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedHPA) return
    try {
      await api.delete(`/clusters/${selectedHPA.clusterName}/namespaces/${selectedHPA.metadata.namespace}/hpas/${selectedHPA.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'HPA deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedHPA(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['hpas'] })
      await queryClient.invalidateQueries({ queryKey: ['all-hpas'] })
      await queryClient.refetchQueries({ queryKey: ['hpas'] })
      await queryClient.refetchQueries({ queryKey: ['all-hpas'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete HPA: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<HPAData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (hpa) => (
        <div className="flex items-center gap-2">
          <AdjustmentsHorizontalIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${hpa.clusterName}/namespaces/${hpa.metadata.namespace}/hpas/${hpa.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {hpa.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {hpa.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (hpa) => hpa.metadata.name,
      searchValue: (hpa) => `${hpa.metadata.name} ${hpa.clusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (hpa) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {hpa.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (hpa) => hpa.metadata.namespace,
      searchValue: (hpa) => hpa.metadata.namespace,
    },
    {
      key: 'target',
      header: 'Target',
      accessor: (hpa) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {hpa.spec.scaleTargetRef.name}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {hpa.spec.scaleTargetRef.kind}
          </span>
        </div>
      ),
      sortable: true,
      sortValue: (hpa) => hpa.spec.scaleTargetRef.name,
      searchValue: (hpa) => `${hpa.spec.scaleTargetRef.kind} ${hpa.spec.scaleTargetRef.name}`,
    },
    {
      key: 'replicas',
      header: 'Replicas',
      accessor: (hpa) => (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">{hpa.status?.currentReplicas || 0}</span>
          <span className="text-gray-500 dark:text-gray-400">
            {' '}/ {hpa.spec.minReplicas || 1}-{hpa.spec.maxReplicas}
          </span>
        </div>
      ),
      sortable: true,
      sortValue: (hpa) => hpa.status?.currentReplicas || 0,
      searchValue: (hpa) => `${hpa.status?.currentReplicas || 0} ${hpa.spec.minReplicas || 1} ${hpa.spec.maxReplicas}`,
    },
    {
      key: 'metrics',
      header: 'Metrics',
      accessor: (hpa) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate block max-w-xs" title={getMetricsDisplay(hpa)}>
          {getMetricsDisplay(hpa)}
        </span>
      ),
      sortable: false,
      searchValue: (hpa) => getMetricsDisplay(hpa),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (hpa) => {
        const status = getStatusDisplay(hpa)
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
            status.color
          )}>
            {status.label}
          </span>
        )
      },
      sortable: true,
      sortValue: (hpa) => getStatusDisplay(hpa).label,
      searchValue: (hpa) => getStatusDisplay(hpa).label,
      filterable: true,
      filterOptions: () => ['Active', 'Inactive', 'Limited', 'Unknown'],
      filterValue: (hpa) => getStatusDisplay(hpa).label,
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (hpa) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(hpa.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (hpa) => new Date(hpa.metadata.creationTimestamp).getTime(),
      searchValue: (hpa) => formatAge(hpa.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (hpa) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${hpa.clusterName}/namespaces/${hpa.metadata.namespace}/hpas/${hpa.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleScaleClick(hpa, e)}
            className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
            title="Scale"
          >
            <ArrowsUpDownIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(hpa, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(hpa, e)}
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
          { name: 'HPAs' }
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            Horizontal Pod Autoscalers
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {namespace 
              ? `HPAs in ${cluster} / ${namespace}`
              : cluster 
                ? `All HPAs in ${cluster}`
                : `All HPAs across ${clusters?.length || 0} cluster(s)`
            }
          </p>
        </div>
        {cluster && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Create HPA</span>
            <span className="sm:hidden">Create</span>
          </button>
        )}
      </div>
      
      <DataTable
        data={allHPAs || []}
        columns={columns}
        keyExtractor={(hpa: HPAData) => `${hpa.clusterName}-${hpa.metadata.namespace}-${hpa.metadata.name}`}
        searchPlaceholder="Search HPAs by name, cluster, namespace, target..."
        isLoading={isLoading}
        emptyMessage="No HPAs found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <AdjustmentsHorizontalIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(hpa) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <AdjustmentsHorizontalIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${hpa.clusterName}/namespaces/${hpa.metadata.namespace}/hpas/${hpa.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {hpa.metadata.name}
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {hpa.metadata.namespace}
                  </div>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {hpa.clusterName}
                    </div>
                  )}
                </div>
              </div>
              <span className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full shrink-0',
                getStatusDisplay(hpa).color
              )}>
                {getStatusDisplay(hpa).label}
              </span>
            </div>
            
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Target:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-medium">
                  {hpa.spec.scaleTargetRef.kind}/{hpa.spec.scaleTargetRef.name}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Replicas:</span>
                <span className="ml-1 text-gray-900 dark:text-white">
                  {hpa.status?.currentReplicas || 0} / {hpa.spec.minReplicas || 1}-{hpa.spec.maxReplicas}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Metrics:</span>
                <span className="ml-1 text-gray-900 dark:text-white truncate block">
                  {getMetricsDisplay(hpa)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(hpa.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${hpa.clusterName}/namespaces/${hpa.metadata.namespace}/hpas/${hpa.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleScaleClick(hpa, e)}
                  className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                  title="Scale"
                >
                  <ArrowsUpDownIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(hpa, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(hpa, e)}
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
      {cluster && (
        <CreateHPAModal
          clusterName={cluster}
          namespace={namespace || 'default'}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={async () => {
            await queryClient.invalidateQueries({ queryKey: ['hpas'] })
            await queryClient.invalidateQueries({ queryKey: ['all-hpas'] })
            await queryClient.refetchQueries({ queryKey: ['hpas'] })
            await queryClient.refetchQueries({ queryKey: ['all-hpas'] })
            setIsCreateModalOpen(false)
          }}
        />
      )}
      
      {selectedHPA && (
        <>
          <ScaleHPAModal
            hpa={selectedHPA}
            isOpen={isScaleModalOpen}
            onClose={() => {
              setIsScaleModalOpen(false)
              setSelectedHPA(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['hpas'] })
              await queryClient.invalidateQueries({ queryKey: ['all-hpas'] })
              await queryClient.refetchQueries({ queryKey: ['hpas'] })
              await queryClient.refetchQueries({ queryKey: ['all-hpas'] })
              setIsScaleModalOpen(false)
              setSelectedHPA(null)
            }}
          />
          <EditHPAYAMLModal
            hpa={selectedHPA}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedHPA(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['hpas'] })
              await queryClient.invalidateQueries({ queryKey: ['all-hpas'] })
              await queryClient.refetchQueries({ queryKey: ['hpas'] })
              await queryClient.refetchQueries({ queryKey: ['all-hpas'] })
              setIsEditModalOpen(false)
              setSelectedHPA(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedHPA(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete HPA"
            message={`Are you sure you want to delete HPA "${selectedHPA.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
