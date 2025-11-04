import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getPriorityClasses } from '@/services/api'
import { useMemo, useState } from 'react'
import { 
  PencilSquareIcon, 
  TrashIcon, 
  EyeIcon,
  ChevronUpIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import CreatePriorityClassModal from '@/components/PriorityClasses/CreatePriorityClassModal'
import EditPriorityClassYAMLModal from '@/components/PriorityClasses/EditPriorityClassYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'
import clsx from 'clsx'

interface PriorityClassData {
  metadata: {
    name: string
    creationTimestamp: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  value: number
  globalDefault?: boolean
  preemptionPolicy?: string
  description?: string
  clusterName: string
}

export default function PriorityClasses() {
  const { cluster } = useParams<{ cluster?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedPriorityClass, setSelectedPriorityClass] = useState<PriorityClassData | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch priority classes from all clusters or specific cluster
  const { data: allPriorityClasses, isLoading } = useQuery({
    queryKey: cluster 
      ? ['priorityclasses', cluster]
      : ['all-priorityclasses', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster requested
      if (cluster) {
        const pcs = await getPriorityClasses(cluster)
        return pcs.map((pc: any) => ({ ...pc, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allPCs = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const pcs = await getPriorityClasses(cluster.name)
            return pcs.map((pc: any) => ({ ...pc, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching priority classes from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allPCs.flat()
    },
    enabled: cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper function to get priority level color
  const getPriorityColor = (value: number): string => {
    if (value >= 1000000) return 'text-red-600 dark:text-red-400'
    if (value >= 10000) return 'text-orange-600 dark:text-orange-400'
    if (value >= 1000) return 'text-yellow-600 dark:text-yellow-400'
    if (value >= 0) return 'text-green-600 dark:text-green-400'
    return 'text-gray-600 dark:text-gray-400'
  }

  // Action handlers
  const handleEditClick = (pc: PriorityClassData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPriorityClass(pc)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (pc: PriorityClassData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPriorityClass(pc)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedPriorityClass) return
    try {
      await api.delete(`/clusters/${selectedPriorityClass.clusterName}/priorityclasses/${selectedPriorityClass.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Priority Class deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedPriorityClass(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['priorityclasses'] })
      await queryClient.invalidateQueries({ queryKey: ['all-priorityclasses'] })
      await queryClient.refetchQueries({ queryKey: ['priorityclasses'] })
      await queryClient.refetchQueries({ queryKey: ['all-priorityclasses'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete priority class: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<PriorityClassData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (pc) => (
        <div className="flex items-center gap-2">
          <ChevronUpIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${pc.clusterName}/priorityclasses/${pc.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {pc.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {pc.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (pc) => pc.metadata.name,
      searchValue: (pc) => `${pc.metadata.name} ${pc.clusterName}`,
    },
    {
      key: 'value',
      header: 'Value',
      accessor: (pc) => (
        <span className={clsx('text-sm font-bold', getPriorityColor(pc.value))}>
          {pc.value.toLocaleString()}
        </span>
      ),
      sortable: true,
      sortValue: (pc) => pc.value,
      searchValue: (pc) => String(pc.value),
    },
    {
      key: 'globalDefault',
      header: 'Global Default',
      accessor: (pc) => (
        <span className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
          pc.globalDefault
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
        )}>
          {pc.globalDefault ? 'Yes' : 'No'}
        </span>
      ),
      sortable: true,
      sortValue: (pc) => pc.globalDefault ? 1 : 0,
      searchValue: (pc) => pc.globalDefault ? 'Yes' : 'No',
      filterable: true,
      filterOptions: () => ['Yes', 'No'],
      filterValue: (pc) => pc.globalDefault ? 'Yes' : 'No',
    },
    {
      key: 'preemptionPolicy',
      header: 'Preemption Policy',
      accessor: (pc) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {pc.preemptionPolicy || 'PreemptLowerPriority'}
        </span>
      ),
      sortable: true,
      sortValue: (pc) => pc.preemptionPolicy || 'PreemptLowerPriority',
      searchValue: (pc) => pc.preemptionPolicy || 'PreemptLowerPriority',
      filterable: true,
      filterOptions: () => ['PreemptLowerPriority', 'Never'],
      filterValue: (pc) => pc.preemptionPolicy || 'PreemptLowerPriority',
    },
    {
      key: 'description',
      header: 'Description',
      accessor: (pc) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate block max-w-xs" title={pc.description}>
          {pc.description || '-'}
        </span>
      ),
      sortable: false,
      searchValue: (pc) => pc.description || '',
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (pc) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(pc.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (pc) => new Date(pc.metadata.creationTimestamp).getTime(),
      searchValue: (pc) => formatAge(pc.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (pc) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${pc.clusterName}/priorityclasses/${pc.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(pc, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(pc, e)}
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
          { name: 'Priority Classes' }
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            Priority Classes
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {cluster 
              ? `Priority classes in ${cluster}`
              : `All priority classes across ${clusters?.length || 0} cluster(s)`
            }
          </p>
        </div>
        {cluster && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Create Priority Class</span>
            <span className="sm:hidden">Create</span>
          </button>
        )}
      </div>
      
      <DataTable
        data={allPriorityClasses || []}
        columns={columns}
        keyExtractor={(pc: PriorityClassData) => `${pc.clusterName}-${pc.metadata.name}`}
        searchPlaceholder="Search priority classes by name, description..."
        isLoading={isLoading}
        emptyMessage="No priority classes found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <ChevronUpIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(pc) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <ChevronUpIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${pc.clusterName}/priorityclasses/${pc.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {pc.metadata.name}
                  </button>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {pc.clusterName}
                    </div>
                  )}
                </div>
              </div>
              <span className={clsx('text-lg font-bold shrink-0', getPriorityColor(pc.value))}>
                {pc.value.toLocaleString()}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Global Default:</span>
                <span className={clsx(
                  'ml-1 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full',
                  pc.globalDefault
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                )}>
                  {pc.globalDefault ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Preemption:</span>
                <span className="ml-1 text-gray-900 dark:text-white text-xs">
                  {pc.preemptionPolicy || 'PreemptLowerPriority'}
                </span>
              </div>
            </div>

            {pc.description && (
              <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                {pc.description}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(pc.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${pc.clusterName}/priorityclasses/${pc.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(pc, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(pc, e)}
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
        <CreatePriorityClassModal
          clusterName={cluster}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={async () => {
            await queryClient.invalidateQueries({ queryKey: ['priorityclasses'] })
            await queryClient.invalidateQueries({ queryKey: ['all-priorityclasses'] })
            await queryClient.refetchQueries({ queryKey: ['priorityclasses'] })
            await queryClient.refetchQueries({ queryKey: ['all-priorityclasses'] })
            setIsCreateModalOpen(false)
          }}
        />
      )}
      
      {selectedPriorityClass && (
        <>
          <EditPriorityClassYAMLModal
            priorityClass={selectedPriorityClass}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedPriorityClass(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['priorityclasses'] })
              await queryClient.invalidateQueries({ queryKey: ['all-priorityclasses'] })
              await queryClient.refetchQueries({ queryKey: ['priorityclasses'] })
              await queryClient.refetchQueries({ queryKey: ['all-priorityclasses'] })
              setIsEditModalOpen(false)
              setSelectedPriorityClass(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedPriorityClass(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete Priority Class"
            message={`Are you sure you want to delete priority class "${selectedPriorityClass.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
