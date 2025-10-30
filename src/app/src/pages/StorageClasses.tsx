import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getStorageClasses } from '@/services/api'
import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { 
  PencilSquareIcon, 
  TrashIcon, 
  EyeIcon,
  CircleStackIcon,
  StarIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import EditStorageClassYAMLModal from '@/components/StorageClasses/EditStorageClassYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface StorageClassData {
  metadata: {
    name: string
    creationTimestamp: string
    annotations?: Record<string, string>
    labels?: Record<string, string>
  }
  provisioner: string
  parameters?: Record<string, string>
  reclaimPolicy?: string
  volumeBindingMode?: string
  allowVolumeExpansion?: boolean
  mountOptions?: string[]
  clusterName: string
}

export default function StorageClasses() {
  const { cluster } = useParams<{ cluster?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedStorageClass, setSelectedStorageClass] = useState<StorageClassData | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch storage classes from all clusters or specific cluster
  const { data: allStorageClasses, isLoading } = useQuery({
    queryKey: cluster 
      ? ['storageclasses', cluster] 
      : ['all-storageclasses', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster requested
      if (cluster) {
        const storageClasses = await getStorageClasses(cluster)
        return storageClasses.map((sc: any) => ({ ...sc, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allSCs = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const storageClasses = await getStorageClasses(cluster.name)
            return storageClasses.map((sc: any) => ({ ...sc, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching storage classes from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allSCs.flat()
    },
    enabled: cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper functions
  const isDefaultStorageClass = (sc: StorageClassData) => {
    return sc.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true' ||
           sc.metadata.annotations?.['storageclass.beta.kubernetes.io/is-default-class'] === 'true'
  }

  // Action handlers
  const handleToggleDefault = async (sc: StorageClassData, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const isDefault = isDefaultStorageClass(sc)
      const updatedSC = {
        ...sc,
        metadata: {
          ...sc.metadata,
          annotations: {
            ...sc.metadata.annotations,
            'storageclass.kubernetes.io/is-default-class': isDefault ? 'false' : 'true',
          }
        }
      }
      
      await api.put(`/clusters/${sc.clusterName}/storageclasses/${sc.metadata.name}`, updatedSC)
      addNotification({
        type: 'success',
        title: 'Success',
        message: `Storage class ${isDefault ? 'unset' : 'set'} as default successfully`,
      })
      
      await queryClient.invalidateQueries({ queryKey: ['storageclasses'] })
      await queryClient.invalidateQueries({ queryKey: ['all-storageclasses'] })
      await queryClient.refetchQueries({ queryKey: ['storageclasses'] })
      await queryClient.refetchQueries({ queryKey: ['all-storageclasses'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to toggle default storage class: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleEditClick = (sc: StorageClassData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedStorageClass(sc)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (sc: StorageClassData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedStorageClass(sc)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedStorageClass) return
    try {
      await api.delete(`/clusters/${selectedStorageClass.clusterName}/storageclasses/${selectedStorageClass.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Storage class deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedStorageClass(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['storageclasses'] })
      await queryClient.invalidateQueries({ queryKey: ['all-storageclasses'] })
      await queryClient.refetchQueries({ queryKey: ['storageclasses'] })
      await queryClient.refetchQueries({ queryKey: ['all-storageclasses'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete storage class: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<StorageClassData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (sc) => (
        <div className="flex items-center gap-2">
          <CircleStackIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${sc.clusterName}/storageclasses/${sc.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {sc.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {sc.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (sc) => sc.metadata.name,
      searchValue: (sc) => `${sc.metadata.name} ${sc.clusterName}`,
    },
    {
      key: 'default',
      header: 'Default',
      accessor: (sc) => {
        const isDefault = isDefaultStorageClass(sc)
        return (
          <button
            onClick={(e) => handleToggleDefault(sc, e)}
            className={clsx(
              'p-1.5 rounded transition-colors',
              isDefault
                ? 'text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                : 'text-gray-400 dark:text-gray-500 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
            )}
            title={isDefault ? 'Unset as default' : 'Set as default'}
          >
            {isDefault ? (
              <StarIconSolid className="w-5 h-5" />
            ) : (
              <StarIcon className="w-5 h-5" />
            )}
          </button>
        )
      },
      sortable: true,
      sortValue: (sc) => isDefaultStorageClass(sc) ? 1 : 0,
      searchValue: (sc) => isDefaultStorageClass(sc) ? 'default' : '',
      filterable: true,
      filterOptions: () => ['Default', 'Non-Default'],
      filterValue: (sc) => isDefaultStorageClass(sc) ? 'Default' : 'Non-Default',
    },
    {
      key: 'provisioner',
      header: 'Provisioner',
      accessor: (sc) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 font-mono text-xs">
          {sc.provisioner}
        </span>
      ),
      sortable: true,
      sortValue: (sc) => sc.provisioner,
      searchValue: (sc) => sc.provisioner,
    },
    {
      key: 'reclaimPolicy',
      header: 'Reclaim Policy',
      accessor: (sc) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {sc.reclaimPolicy || 'Delete'}
        </span>
      ),
      sortable: true,
      sortValue: (sc) => sc.reclaimPolicy || 'Delete',
      searchValue: (sc) => sc.reclaimPolicy || 'Delete',
      filterable: true,
      filterOptions: (data) => {
        const policies = new Set(data.map(s => s.reclaimPolicy || 'Delete'))
        return Array.from(policies).sort()
      },
      filterValue: (sc) => sc.reclaimPolicy || 'Delete',
    },
    {
      key: 'volumeBindingMode',
      header: 'Volume Binding Mode',
      accessor: (sc) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {sc.volumeBindingMode || 'Immediate'}
        </span>
      ),
      sortable: true,
      sortValue: (sc) => sc.volumeBindingMode || 'Immediate',
      searchValue: (sc) => sc.volumeBindingMode || 'Immediate',
      filterable: true,
      filterOptions: (data) => {
        const modes = new Set(data.map(s => s.volumeBindingMode || 'Immediate'))
        return Array.from(modes).sort()
      },
      filterValue: (sc) => sc.volumeBindingMode || 'Immediate',
    },
    {
      key: 'allowVolumeExpansion',
      header: 'Allow Expansion',
      accessor: (sc) => (
        <span className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
          sc.allowVolumeExpansion
            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
        )}>
          {sc.allowVolumeExpansion ? 'Yes' : 'No'}
        </span>
      ),
      sortable: true,
      sortValue: (sc) => sc.allowVolumeExpansion ? 1 : 0,
      searchValue: (sc) => sc.allowVolumeExpansion ? 'Yes' : 'No',
      filterable: true,
      filterOptions: () => ['Yes', 'No'],
      filterValue: (sc) => sc.allowVolumeExpansion ? 'Yes' : 'No',
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (sc) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(sc.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (sc) => new Date(sc.metadata.creationTimestamp).getTime(),
      searchValue: (sc) => formatAge(sc.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (sc) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${sc.clusterName}/storageclasses/${sc.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(sc, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(sc, e)}
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
          { name: 'Storage Classes' }
        ]}
      />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
          Storage Classes
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {cluster 
            ? `Storage classes in ${cluster}`
            : `All storage classes across ${clusters?.length || 0} cluster(s)`
          }
        </p>
      </div>
      
      <DataTable
        data={allStorageClasses || []}
        columns={columns}
        keyExtractor={(sc) => `${sc.clusterName}-${sc.metadata.name}`}
        searchPlaceholder="Search storage classes by name, cluster, provisioner..."
        isLoading={isLoading}
        emptyMessage="No storage classes found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <CircleStackIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(sc) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <CircleStackIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${sc.clusterName}/storageclasses/${sc.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {sc.metadata.name}
                  </button>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {sc.clusterName}
                    </div>
                  )}
                </div>
              </div>
              <span className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full shrink-0',
                sc.allowVolumeExpansion
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
              )}>
                {sc.allowVolumeExpansion ? 'Expandable' : 'Fixed'}
              </span>
            </div>
            
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Provisioner:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">{sc.provisioner}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Reclaim Policy:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{sc.reclaimPolicy || 'Delete'}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Binding Mode:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{sc.volumeBindingMode || 'Immediate'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(sc.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${sc.clusterName}/storageclasses/${sc.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(sc, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(sc, e)}
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
      {selectedStorageClass && (
        <>
          <EditStorageClassYAMLModal
            storageClass={selectedStorageClass}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedStorageClass(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['storageclasses'] })
              await queryClient.invalidateQueries({ queryKey: ['all-storageclasses'] })
              await queryClient.refetchQueries({ queryKey: ['storageclasses'] })
              await queryClient.refetchQueries({ queryKey: ['all-storageclasses'] })
              setIsEditModalOpen(false)
              setSelectedStorageClass(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedStorageClass(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete Storage Class"
            message={`Are you sure you want to delete storage class "${selectedStorageClass.metadata.name}"? This action cannot be undone. Any persistent volumes using this storage class may be affected.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
