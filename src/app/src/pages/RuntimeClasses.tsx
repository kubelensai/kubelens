import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getRuntimeClasses } from '@/services/api'
import { useMemo, useState } from 'react'
import { 
  PencilSquareIcon, 
  TrashIcon, 
  EyeIcon,
  CommandLineIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import CreateRuntimeClassModal from '@/components/RuntimeClasses/CreateRuntimeClassModal'
import EditRuntimeClassYAMLModal from '@/components/RuntimeClasses/EditRuntimeClassYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface RuntimeClassData {
  metadata: {
    name: string
    creationTimestamp: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  handler: string
  overhead?: {
    podFixed?: {
      cpu?: string
      memory?: string
    }
  }
  scheduling?: {
    nodeSelector?: Record<string, string>
    tolerations?: Array<any>
  }
  clusterName: string
}

export default function RuntimeClasses() {
  const { cluster } = useParams<{ cluster?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedRuntimeClass, setSelectedRuntimeClass] = useState<RuntimeClassData | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  const { data: allRuntimeClasses, isLoading } = useQuery({
    queryKey: cluster 
      ? ['runtimeclasses', cluster]
      : ['all-runtimeclasses', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      if (cluster) {
        const rcs = await getRuntimeClasses(cluster)
        return rcs.map((rc: any) => ({ ...rc, clusterName: cluster }))
      }
      
      if (!clusters || clusters.length === 0) return []
      
      const allRCs = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const rcs = await getRuntimeClasses(cluster.name)
            return rcs.map((rc: any) => ({ ...rc, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching runtime classes from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allRCs.flat()
    },
    enabled: cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  const handleEditClick = (rc: RuntimeClassData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedRuntimeClass(rc)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (rc: RuntimeClassData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedRuntimeClass(rc)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedRuntimeClass) return
    try {
      await api.delete(`/clusters/${selectedRuntimeClass.clusterName}/runtimeclasses/${selectedRuntimeClass.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Runtime class deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedRuntimeClass(null)
      await queryClient.invalidateQueries({ queryKey: ['runtimeclasses'] })
      await queryClient.invalidateQueries({ queryKey: ['all-runtimeclasses'] })
      await queryClient.refetchQueries({ queryKey: ['runtimeclasses'] })
      await queryClient.refetchQueries({ queryKey: ['all-runtimeclasses'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete runtime class: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const columns = useMemo<Column<RuntimeClassData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (rc) => (
        <div className="flex items-center gap-2">
          <CommandLineIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${rc.clusterName}/runtimeclasses/${rc.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {rc.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {rc.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (rc) => rc.metadata.name,
      searchValue: (rc) => `${rc.metadata.name} ${rc.clusterName}`,
    },
    {
      key: 'handler',
      header: 'Handler',
      accessor: (rc) => (
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {rc.handler}
        </span>
      ),
      sortable: true,
      sortValue: (rc) => rc.handler,
      searchValue: (rc) => rc.handler,
    },
    {
      key: 'overhead',
      header: 'Overhead',
      accessor: (rc) => {
        const cpu = rc.overhead?.podFixed?.cpu
        const memory = rc.overhead?.podFixed?.memory
        if (!cpu && !memory) return <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
        return (
          <div className="text-sm text-gray-700 dark:text-gray-300">
            {cpu && <div>CPU: {cpu}</div>}
            {memory && <div>Memory: {memory}</div>}
          </div>
        )
      },
      sortable: false,
      searchValue: (rc) => `${rc.overhead?.podFixed?.cpu || ''} ${rc.overhead?.podFixed?.memory || ''}`,
    },
    {
      key: 'scheduling',
      header: 'Scheduling',
      accessor: (rc) => {
        const hasNodeSelector = rc.scheduling?.nodeSelector && Object.keys(rc.scheduling.nodeSelector).length > 0
        const hasTolerations = rc.scheduling?.tolerations && rc.scheduling.tolerations.length > 0
        if (!hasNodeSelector && !hasTolerations) {
          return <span className="text-sm text-gray-500 dark:text-gray-400">None</span>
        }
        return (
          <div className="text-xs text-gray-700 dark:text-gray-300">
            {hasNodeSelector && <div>Node Selector: {Object.keys(rc.scheduling!.nodeSelector!).length}</div>}
            {hasTolerations && <div>Tolerations: {rc.scheduling!.tolerations!.length}</div>}
          </div>
        )
      },
      sortable: false,
      searchValue: (rc) => {
        const parts = []
        if (rc.scheduling?.nodeSelector) parts.push('node selector')
        if (rc.scheduling?.tolerations) parts.push('tolerations')
        return parts.join(' ')
      },
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (rc) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(rc.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (rc) => new Date(rc.metadata.creationTimestamp).getTime(),
      searchValue: (rc) => formatAge(rc.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (rc) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${rc.clusterName}/runtimeclasses/${rc.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(rc, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(rc, e)}
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
          ...(cluster ? [{ name: cluster, href: `/clusters/${cluster}` }] : []),
          { name: 'Runtime Classes' }
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            Runtime Classes
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {cluster 
              ? `Runtime classes in ${cluster}`
              : `All runtime classes across ${clusters?.length || 0} cluster(s)`
            }
          </p>
        </div>
        {cluster && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Create Runtime Class</span>
            <span className="sm:hidden">Create</span>
          </button>
        )}
      </div>
      
      <DataTable
        data={allRuntimeClasses || []}
        columns={columns}
        keyExtractor={(rc: RuntimeClassData) => `${rc.clusterName}-${rc.metadata.name}`}
        searchPlaceholder="Search runtime classes by name, handler..."
        isLoading={isLoading}
        emptyMessage="No runtime classes found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <CommandLineIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(rc) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <CommandLineIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${rc.clusterName}/runtimeclasses/${rc.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {rc.metadata.name}
                  </button>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {rc.clusterName}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="text-sm">
              <span className="text-gray-500 dark:text-gray-400">Handler:</span>
              <span className="ml-1 text-gray-900 dark:text-white font-medium">
                {rc.handler}
              </span>
            </div>

            {(rc.overhead?.podFixed?.cpu || rc.overhead?.podFixed?.memory) && (
              <div className="text-sm">
                <span className="text-gray-500 dark:text-gray-400">Overhead:</span>
                <div className="ml-1 text-gray-900 dark:text-white">
                  {rc.overhead.podFixed.cpu && <div>CPU: {rc.overhead.podFixed.cpu}</div>}
                  {rc.overhead.podFixed.memory && <div>Memory: {rc.overhead.podFixed.memory}</div>}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(rc.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${rc.clusterName}/runtimeclasses/${rc.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(rc, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(rc, e)}
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

      {cluster && (
        <CreateRuntimeClassModal
          clusterName={cluster}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={async () => {
            await queryClient.invalidateQueries({ queryKey: ['runtimeclasses'] })
            await queryClient.invalidateQueries({ queryKey: ['all-runtimeclasses'] })
            await queryClient.refetchQueries({ queryKey: ['runtimeclasses'] })
            await queryClient.refetchQueries({ queryKey: ['all-runtimeclasses'] })
            setIsCreateModalOpen(false)
          }}
        />
      )}
      
      {selectedRuntimeClass && (
        <>
          <EditRuntimeClassYAMLModal
            runtimeClass={selectedRuntimeClass}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedRuntimeClass(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['runtimeclasses'] })
              await queryClient.invalidateQueries({ queryKey: ['all-runtimeclasses'] })
              await queryClient.refetchQueries({ queryKey: ['runtimeclasses'] })
              await queryClient.refetchQueries({ queryKey: ['all-runtimeclasses'] })
              setIsEditModalOpen(false)
              setSelectedRuntimeClass(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedRuntimeClass(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete Runtime Class"
            message={`Are you sure you want to delete runtime class "${selectedRuntimeClass.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
