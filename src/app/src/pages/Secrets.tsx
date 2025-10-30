import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getSecrets } from '@/services/api'
import { useMemo, useState } from 'react'
import { 
  PencilSquareIcon, 
  TrashIcon, 
  EyeIcon,
  KeyIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import CreateSecretModal from '@/components/Secrets/CreateSecretModal'
import { DataTable, Column } from '@/components/shared/DataTable'
import EditSecretYAMLModal from '@/components/Secrets/EditSecretYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface SecretData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
  }
  type: string
  data?: Record<string, string>
  clusterName: string
}

export default function Secrets() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedSecret, setSelectedSecret] = useState<SecretData | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch secrets from all clusters or specific cluster/namespace
  const { data: allSecrets, isLoading } = useQuery({
    queryKey: namespace 
      ? ['secrets', cluster, namespace]
      : cluster 
        ? ['secrets', cluster] 
        : ['all-secrets', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const secrets = await getSecrets(cluster, namespace)
        return secrets.map((secret: any) => ({ ...secret, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const secrets = await getSecrets(cluster)
        return secrets.map((secret: any) => ({ ...secret, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allSecrets = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const secrets = await getSecrets(cluster.name)
            return secrets.map((secret: any) => ({ ...secret, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching secrets from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allSecrets.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper functions
  const getKeysCount = (secret: SecretData): number => {
    return Object.keys(secret.data || {}).length
  }

  // Action handlers
  const handleEditClick = (secret: SecretData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedSecret(secret)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (secret: SecretData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedSecret(secret)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedSecret) return
    try {
      await api.delete(`/clusters/${selectedSecret.clusterName}/namespaces/${selectedSecret.metadata.namespace}/secrets/${selectedSecret.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Secret deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedSecret(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['secrets'] })
      await queryClient.invalidateQueries({ queryKey: ['all-secrets'] })
      await queryClient.refetchQueries({ queryKey: ['secrets'] })
      await queryClient.refetchQueries({ queryKey: ['all-secrets'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete secret: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<SecretData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (secret) => (
        <div className="flex items-center gap-2">
          <KeyIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${secret.clusterName}/namespaces/${secret.metadata.namespace}/secrets/${secret.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {secret.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {secret.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (secret) => secret.metadata.name,
      searchValue: (secret) => `${secret.metadata.name} ${secret.clusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (secret) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {secret.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (secret) => secret.metadata.namespace,
      searchValue: (secret) => secret.metadata.namespace,
    },
    {
      key: 'type',
      header: 'Type',
      accessor: (secret) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">
          {secret.type}
        </span>
      ),
      sortable: true,
      sortValue: (secret) => secret.type,
      searchValue: (secret) => secret.type,
      filterable: true,
      filterOptions: (data) => {
        const types = new Set(data.map(s => s.type))
        return Array.from(types).sort()
      },
      filterValue: (secret) => secret.type,
    },
    {
      key: 'keys',
      header: 'Keys',
      accessor: (secret) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {getKeysCount(secret)}
        </span>
      ),
      sortable: true,
      sortValue: (secret) => getKeysCount(secret),
      searchValue: (secret) => String(getKeysCount(secret)),
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (secret) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(secret.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (secret) => new Date(secret.metadata.creationTimestamp).getTime(),
      searchValue: (secret) => formatAge(secret.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (secret) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${secret.clusterName}/namespaces/${secret.metadata.namespace}/secrets/${secret.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(secret, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(secret, e)}
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
          { name: 'Secrets' }
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            Secrets
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {namespace 
              ? `Secrets in ${cluster} / ${namespace}`
              : cluster 
                ? `All secrets in ${cluster}`
                : `All secrets across ${clusters?.length || 0} cluster(s)`
            }
          </p>
        </div>
        {cluster && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Create Secret</span>
            <span className="sm:hidden">Create</span>
          </button>
        )}
      </div>
      
      <DataTable
        data={allSecrets || []}
        columns={columns}
        keyExtractor={(secret) => `${secret.clusterName}-${secret.metadata.namespace}-${secret.metadata.name}`}
        searchPlaceholder="Search secrets by name, cluster, namespace, type..."
        isLoading={isLoading}
        emptyMessage="No secrets found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <KeyIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(secret) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <KeyIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${secret.clusterName}/namespaces/${secret.metadata.namespace}/secrets/${secret.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {secret.metadata.name}
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {secret.metadata.namespace}
                  </div>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {secret.clusterName}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Type:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">{secret.type}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Keys:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{getKeysCount(secret)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(secret.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${secret.clusterName}/namespaces/${secret.metadata.namespace}/secrets/${secret.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(secret, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(secret, e)}
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
      <CreateSecretModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={async () => {
          await queryClient.invalidateQueries({ queryKey: ['secrets'] })
          await queryClient.invalidateQueries({ queryKey: ['all-secrets'] })
          await queryClient.refetchQueries({ queryKey: ['secrets'] })
          await queryClient.refetchQueries({ queryKey: ['all-secrets'] })
          setIsCreateModalOpen(false)
        }}
        clusterName={cluster || ''}
        namespace={namespace || ''}
      />
      
      {selectedSecret && (
        <>
          <EditSecretYAMLModal
            secret={selectedSecret}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedSecret(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['secrets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-secrets'] })
              await queryClient.refetchQueries({ queryKey: ['secrets'] })
              await queryClient.refetchQueries({ queryKey: ['all-secrets'] })
              setIsEditModalOpen(false)
              setSelectedSecret(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedSecret(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete Secret"
            message={`Are you sure you want to delete secret "${selectedSecret.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
