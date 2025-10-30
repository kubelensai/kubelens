import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getConfigMaps } from '@/services/api'
import { useMemo, useState } from 'react'
import { 
  PencilSquareIcon, 
  TrashIcon, 
  EyeIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import EditConfigMapYAMLModal from '@/components/ConfigMaps/EditConfigMapYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface ConfigMapData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
  }
  data?: Record<string, string>
  binaryData?: Record<string, string>
  clusterName: string
}

export default function ConfigMaps() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedConfigMap, setSelectedConfigMap] = useState<ConfigMapData | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch configmaps from all clusters or specific cluster/namespace
  const { data: allConfigMaps, isLoading } = useQuery({
    queryKey: namespace 
      ? ['configmaps', cluster, namespace]
      : cluster 
        ? ['configmaps', cluster] 
        : ['all-configmaps', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const configMaps = await getConfigMaps(cluster, namespace)
        return configMaps.map((cm: any) => ({ ...cm, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const configMaps = await getConfigMaps(cluster)
        return configMaps.map((cm: any) => ({ ...cm, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allConfigMaps = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const configMaps = await getConfigMaps(cluster.name)
            return configMaps.map((cm: any) => ({ ...cm, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching configmaps from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allConfigMaps.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper functions
  const getKeysCount = (configMap: ConfigMapData): number => {
    const dataKeys = Object.keys(configMap.data || {}).length
    const binaryDataKeys = Object.keys(configMap.binaryData || {}).length
    return dataKeys + binaryDataKeys
  }

  // Action handlers
  const handleEditClick = (configMap: ConfigMapData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedConfigMap(configMap)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (configMap: ConfigMapData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedConfigMap(configMap)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedConfigMap) return
    try {
      await api.delete(`/clusters/${selectedConfigMap.clusterName}/namespaces/${selectedConfigMap.metadata.namespace}/configmaps/${selectedConfigMap.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'ConfigMap deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedConfigMap(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['configmaps'] })
      await queryClient.invalidateQueries({ queryKey: ['all-configmaps'] })
      await queryClient.refetchQueries({ queryKey: ['configmaps'] })
      await queryClient.refetchQueries({ queryKey: ['all-configmaps'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete configmap: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<ConfigMapData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (configMap) => (
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${configMap.clusterName}/namespaces/${configMap.metadata.namespace}/configmaps/${configMap.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {configMap.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {configMap.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (configMap) => configMap.metadata.name,
      searchValue: (configMap) => `${configMap.metadata.name} ${configMap.clusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (configMap) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {configMap.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (configMap) => configMap.metadata.namespace,
      searchValue: (configMap) => configMap.metadata.namespace,
    },
    {
      key: 'keys',
      header: 'Keys',
      accessor: (configMap) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {getKeysCount(configMap)}
        </span>
      ),
      sortable: true,
      sortValue: (configMap) => getKeysCount(configMap),
      searchValue: (configMap) => String(getKeysCount(configMap)),
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (configMap) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(configMap.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (configMap) => new Date(configMap.metadata.creationTimestamp).getTime(),
      searchValue: (configMap) => formatAge(configMap.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (configMap) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${configMap.clusterName}/namespaces/${configMap.metadata.namespace}/configmaps/${configMap.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(configMap, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(configMap, e)}
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
          { name: 'ConfigMaps' }
        ]}
      />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
          ConfigMaps
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {namespace 
            ? `ConfigMaps in ${cluster} / ${namespace}`
            : cluster 
              ? `All configmaps in ${cluster}`
              : `All configmaps across ${clusters?.length || 0} cluster(s)`
          }
        </p>
      </div>
      
      <DataTable
        data={allConfigMaps || []}
        columns={columns}
        keyExtractor={(configMap) => `${configMap.clusterName}-${configMap.metadata.namespace}-${configMap.metadata.name}`}
        searchPlaceholder="Search configmaps by name, cluster, namespace..."
        isLoading={isLoading}
        emptyMessage="No configmaps found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <DocumentTextIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(configMap) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <DocumentTextIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${configMap.clusterName}/namespaces/${configMap.metadata.namespace}/configmaps/${configMap.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {configMap.metadata.name}
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {configMap.metadata.namespace}
                  </div>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {configMap.clusterName}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Keys:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{getKeysCount(configMap)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(configMap.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${configMap.clusterName}/namespaces/${configMap.metadata.namespace}/configmaps/${configMap.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(configMap, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(configMap, e)}
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
      {selectedConfigMap && (
        <>
          <EditConfigMapYAMLModal
            configMap={selectedConfigMap}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedConfigMap(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['configmaps'] })
              await queryClient.invalidateQueries({ queryKey: ['all-configmaps'] })
              await queryClient.refetchQueries({ queryKey: ['configmaps'] })
              await queryClient.refetchQueries({ queryKey: ['all-configmaps'] })
              setIsEditModalOpen(false)
              setSelectedConfigMap(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedConfigMap(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete ConfigMap"
            message={`Are you sure you want to delete configmap "${selectedConfigMap.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
