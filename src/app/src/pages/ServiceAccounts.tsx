import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getServiceAccounts } from '@/services/api'
import { useMemo, useState } from 'react'
import { 
  PencilSquareIcon, 
  TrashIcon, 
  EyeIcon,
  UserCircleIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import CreateServiceAccountModal from '@/components/ServiceAccounts/CreateServiceAccountModal'
import EditServiceAccountYAMLModal from '@/components/ServiceAccounts/EditServiceAccountYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'
import clsx from 'clsx'

interface ServiceAccountData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
  }
  secrets?: Array<{
    name: string
  }>
  automountServiceAccountToken?: boolean
  ClusterName: string
}

export default function ServiceAccounts() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedServiceAccount, setSelectedServiceAccount] = useState<ServiceAccountData | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch service accounts from all clusters or specific cluster/namespace
  const { data: allServiceAccounts, isLoading } = useQuery({
    queryKey: namespace 
      ? ['serviceaccounts', cluster, namespace]
      : cluster 
        ? ['serviceaccounts', cluster] 
        : ['all-serviceaccounts', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const serviceAccounts = await getServiceAccounts(cluster, namespace)
        return serviceAccounts.map((sa: any) => ({ ...sa, ClusterName: cluster }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const serviceAccounts = await getServiceAccounts(cluster, 'all')
        return serviceAccounts.map((sa: any) => ({ ...sa, ClusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allServiceAccounts = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const serviceAccounts = await getServiceAccounts(cluster.name, 'all')
            return serviceAccounts.map((sa: any) => ({ ...sa, ClusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching service accounts from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allServiceAccounts.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper functions
  const getSecretsCount = (sa: ServiceAccountData): number => {
    return (sa.secrets || []).length
  }

  // Action handlers
  const handleEditClick = (sa: ServiceAccountData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedServiceAccount(sa)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (sa: ServiceAccountData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedServiceAccount(sa)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedServiceAccount) return
    try {
      await api.delete(`/clusters/${selectedServiceAccount.ClusterName}/namespaces/${selectedServiceAccount.metadata.namespace}/serviceaccounts/${selectedServiceAccount.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Service account deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedServiceAccount(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['serviceaccounts'] })
      await queryClient.invalidateQueries({ queryKey: ['all-serviceaccounts'] })
      await queryClient.refetchQueries({ queryKey: ['serviceaccounts'] })
      await queryClient.refetchQueries({ queryKey: ['all-serviceaccounts'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete service account: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<ServiceAccountData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (sa) => (
        <div className="flex items-center gap-2">
          <UserCircleIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${sa.ClusterName}/namespaces/${sa.metadata.namespace}/serviceaccounts/${sa.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {sa.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {sa.ClusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (sa) => sa.metadata.name,
      searchValue: (sa) => `${sa.metadata.name} ${sa.ClusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (sa) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {sa.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (sa) => sa.metadata.namespace,
      searchValue: (sa) => sa.metadata.namespace,
    },
    {
      key: 'secrets',
      header: 'Secrets',
      accessor: (sa) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {getSecretsCount(sa)}
        </span>
      ),
      sortable: true,
      sortValue: (sa) => getSecretsCount(sa),
      searchValue: (sa) => String(getSecretsCount(sa)),
    },
    {
      key: 'autoMount',
      header: 'Auto Mount',
      accessor: (sa) => {
        const autoMount = sa.automountServiceAccountToken
        const colorClasses = autoMount === false
          ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          : autoMount === true
          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
        
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
            colorClasses
          )}>
            {autoMount === false ? 'Disabled' : autoMount === true ? 'Enabled' : 'Default'}
          </span>
        )
      },
      sortable: true,
      sortValue: (sa) => sa.automountServiceAccountToken === false ? 0 : sa.automountServiceAccountToken === true ? 2 : 1,
      searchValue: (sa) => sa.automountServiceAccountToken === false ? 'Disabled' : sa.automountServiceAccountToken === true ? 'Enabled' : 'Default',
      filterable: true,
      filterOptions: () => ['Enabled', 'Disabled', 'Default'],
      filterValue: (sa) => sa.automountServiceAccountToken === false ? 'Disabled' : sa.automountServiceAccountToken === true ? 'Enabled' : 'Default',
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (sa) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(sa.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (sa) => new Date(sa.metadata.creationTimestamp).getTime(),
      searchValue: (sa) => formatAge(sa.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (sa) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${sa.ClusterName}/namespaces/${sa.metadata.namespace}/serviceaccounts/${sa.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(sa, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(sa, e)}
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
          { name: 'Service Accounts' }
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            Service Accounts
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {namespace 
              ? `Service accounts in ${cluster} / ${namespace}`
              : cluster 
                ? `All service accounts in ${cluster}`
                : `All service accounts across ${clusters?.length || 0} cluster(s)`
            }
          </p>
        </div>
        {cluster && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Create Service Account</span>
            <span className="sm:hidden">Create</span>
          </button>
        )}
      </div>
      
      <DataTable
        data={allServiceAccounts || []}
        columns={columns}
        keyExtractor={(sa) => `${sa.ClusterName}-${sa.metadata.namespace}-${sa.metadata.name}`}
        searchPlaceholder="Search service accounts by name, cluster, namespace..."
        isLoading={isLoading}
        emptyMessage="No service accounts found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <UserCircleIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(sa) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <UserCircleIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${sa.ClusterName}/namespaces/${sa.metadata.namespace}/serviceaccounts/${sa.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {sa.metadata.name}
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {sa.metadata.namespace}
                  </div>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {sa.ClusterName}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Secrets:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{getSecretsCount(sa)}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Auto Mount:</span>
                <span className={clsx(
                  'ml-1 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
                  sa.automountServiceAccountToken === false
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    : sa.automountServiceAccountToken === true
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                )}>
                  {sa.automountServiceAccountToken === false ? 'Disabled' : sa.automountServiceAccountToken === true ? 'Enabled' : 'Default'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(sa.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${sa.ClusterName}/namespaces/${sa.metadata.namespace}/serviceaccounts/${sa.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(sa, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(sa, e)}
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
      <CreateServiceAccountModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={async () => {
          await queryClient.invalidateQueries({ queryKey: ['serviceaccounts'] })
          await queryClient.invalidateQueries({ queryKey: ['all-serviceaccounts'] })
          await queryClient.refetchQueries({ queryKey: ['serviceaccounts'] })
          await queryClient.refetchQueries({ queryKey: ['all-serviceaccounts'] })
          setIsCreateModalOpen(false)
        }}
        cluster={cluster || ''}
        namespace={namespace || 'default'}
      />
      
      {selectedServiceAccount && (
        <>
          <EditServiceAccountYAMLModal
            serviceAccount={selectedServiceAccount}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedServiceAccount(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['serviceaccounts'] })
              await queryClient.invalidateQueries({ queryKey: ['all-serviceaccounts'] })
              await queryClient.refetchQueries({ queryKey: ['serviceaccounts'] })
              await queryClient.refetchQueries({ queryKey: ['all-serviceaccounts'] })
              setIsEditModalOpen(false)
              setSelectedServiceAccount(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedServiceAccount(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete Service Account"
            message={`Are you sure you want to delete service account "${selectedServiceAccount.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
