import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getNetworkPolicies } from '@/services/api'
import { useMemo, useState } from 'react'
import { 
  PencilSquareIcon, 
  TrashIcon, 
  EyeIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import EditNetworkPolicyYAMLModal from '@/components/NetworkPolicies/EditNetworkPolicyYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface NetworkPolicyData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
  }
  spec: {
    podSelector: any
    policyTypes: string[]
    ingress?: any[]
    egress?: any[]
  }
  clusterName: string
}

export default function NetworkPolicies() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedNetworkPolicy, setSelectedNetworkPolicy] = useState<NetworkPolicyData | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch network policies from all clusters or specific cluster/namespace
  const { data: allNetworkPolicies, isLoading } = useQuery({
    queryKey: namespace 
      ? ['networkpolicies', cluster, namespace]
      : cluster 
        ? ['networkpolicies', cluster] 
        : ['all-networkpolicies', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const networkPolicies = await getNetworkPolicies(cluster, namespace)
        return networkPolicies.map((np: any) => ({ ...np, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const networkPolicies = await getNetworkPolicies(cluster)
        return networkPolicies.map((np: any) => ({ ...np, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allNetworkPolicies = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const networkPolicies = await getNetworkPolicies(cluster.name)
            return networkPolicies.map((np: any) => ({ ...np, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching network policies from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allNetworkPolicies.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper functions
  const formatPodSelector = (np: NetworkPolicyData): string => {
    if (!np.spec.podSelector) return 'All pods'
    if (Object.keys(np.spec.podSelector.matchLabels || {}).length === 0) return 'All pods'
    const labels = Object.entries(np.spec.podSelector.matchLabels || {})
      .map(([key, value]) => `${key}=${value}`)
      .slice(0, 2)
      .join(', ')
    return labels + (Object.keys(np.spec.podSelector.matchLabels || {}).length > 2 ? '...' : '')
  }

  const formatPolicyTypes = (np: NetworkPolicyData): string => {
    return np.spec.policyTypes?.join(', ') || '-'
  }

  // Action handlers
  const handleEditClick = (networkPolicy: NetworkPolicyData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedNetworkPolicy(networkPolicy)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (networkPolicy: NetworkPolicyData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedNetworkPolicy(networkPolicy)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedNetworkPolicy) return
    try {
      await api.delete(`/clusters/${selectedNetworkPolicy.clusterName}/namespaces/${selectedNetworkPolicy.metadata.namespace}/networkpolicies/${selectedNetworkPolicy.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Network policy deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedNetworkPolicy(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['networkpolicies'] })
      await queryClient.invalidateQueries({ queryKey: ['all-networkpolicies'] })
      await queryClient.refetchQueries({ queryKey: ['networkpolicies'] })
      await queryClient.refetchQueries({ queryKey: ['all-networkpolicies'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete network policy: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<NetworkPolicyData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (networkPolicy) => (
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${networkPolicy.clusterName}/namespaces/${networkPolicy.metadata.namespace}/networkpolicies/${networkPolicy.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {networkPolicy.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {networkPolicy.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (networkPolicy) => networkPolicy.metadata.name,
      searchValue: (networkPolicy) => `${networkPolicy.metadata.name} ${networkPolicy.clusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (networkPolicy) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {networkPolicy.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (networkPolicy) => networkPolicy.metadata.namespace,
      searchValue: (networkPolicy) => networkPolicy.metadata.namespace,
    },
    {
      key: 'podSelector',
      header: 'Pod Selector',
      accessor: (networkPolicy) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">
          {formatPodSelector(networkPolicy)}
        </span>
      ),
      sortable: false,
      searchValue: (networkPolicy) => formatPodSelector(networkPolicy),
    },
    {
      key: 'policyTypes',
      header: 'Policy Types',
      accessor: (networkPolicy) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatPolicyTypes(networkPolicy)}
        </span>
      ),
      sortable: false,
      searchValue: (networkPolicy) => formatPolicyTypes(networkPolicy),
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (networkPolicy) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(networkPolicy.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (networkPolicy) => new Date(networkPolicy.metadata.creationTimestamp).getTime(),
      searchValue: (networkPolicy) => formatAge(networkPolicy.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (networkPolicy) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${networkPolicy.clusterName}/namespaces/${networkPolicy.metadata.namespace}/networkpolicies/${networkPolicy.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(networkPolicy, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(networkPolicy, e)}
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
          { name: 'Network Policies' }
        ]}
      />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
          Network Policies
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {namespace 
            ? `Network policies in ${cluster} / ${namespace}`
            : cluster 
              ? `All network policies in ${cluster}`
              : `All network policies across ${clusters?.length || 0} cluster(s)`
          }
        </p>
      </div>
      
      <DataTable
        data={allNetworkPolicies || []}
        columns={columns}
        keyExtractor={(networkPolicy) => `${networkPolicy.clusterName}-${networkPolicy.metadata.namespace}-${networkPolicy.metadata.name}`}
        searchPlaceholder="Search network policies by name, cluster, namespace..."
        isLoading={isLoading}
        emptyMessage="No network policies found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <ShieldCheckIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(networkPolicy) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <ShieldCheckIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${networkPolicy.clusterName}/namespaces/${networkPolicy.metadata.namespace}/networkpolicies/${networkPolicy.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {networkPolicy.metadata.name}
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {networkPolicy.metadata.namespace}
                  </div>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {networkPolicy.clusterName}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Pod Selector:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">{formatPodSelector(networkPolicy)}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Policy Types:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{formatPolicyTypes(networkPolicy)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(networkPolicy.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${networkPolicy.clusterName}/namespaces/${networkPolicy.metadata.namespace}/networkpolicies/${networkPolicy.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(networkPolicy, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(networkPolicy, e)}
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
      {selectedNetworkPolicy && (
        <>
          <EditNetworkPolicyYAMLModal
            networkPolicy={selectedNetworkPolicy}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedNetworkPolicy(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['networkpolicies'] })
              await queryClient.invalidateQueries({ queryKey: ['all-networkpolicies'] })
              await queryClient.refetchQueries({ queryKey: ['networkpolicies'] })
              await queryClient.refetchQueries({ queryKey: ['all-networkpolicies'] })
              setIsEditModalOpen(false)
              setSelectedNetworkPolicy(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedNetworkPolicy(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete Network Policy"
            message={`Are you sure you want to delete network policy "${selectedNetworkPolicy.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
