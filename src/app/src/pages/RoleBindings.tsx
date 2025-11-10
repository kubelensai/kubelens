import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getRoleBindings } from '@/services/api'
import { useMemo, useState } from 'react'
import { 
  PencilSquareIcon, 
  TrashIcon, 
  EyeIcon,
  LinkIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import CreateRoleBindingModal from '@/components/RoleBindings/CreateRoleBindingModal'
import EditRoleBindingYAMLModal from '@/components/RoleBindings/EditRoleBindingYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'


interface RoleBindingData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  roleRef: {
    kind: string
    name: string
    apiGroup?: string
  }
  subjects?: Array<{
    kind: string
    name: string
    namespace?: string
  }>
  ClusterName: string
}

export default function RoleBindings() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedRoleBinding, setSelectedRoleBinding] = useState<RoleBindingData | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch role bindings from all clusters or specific cluster/namespace
  const { data: allRoleBindings, isLoading } = useQuery({
    queryKey: namespace 
      ? ['rolebindings', cluster, namespace]
      : cluster 
        ? ['rolebindings', cluster] 
        : ['all-rolebindings', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const roleBindings = await getRoleBindings(cluster, namespace)
        return roleBindings.map((rb: any) => ({ ...rb, ClusterName: cluster }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const roleBindings = await getRoleBindings(cluster, 'all')
        return roleBindings.map((rb: any) => ({ ...rb, ClusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allRoleBindings = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const roleBindings = await getRoleBindings(cluster.name, 'all')
            return roleBindings.map((rb: any) => ({ ...rb, ClusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching role bindings from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allRoleBindings.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper functions
  const getSubjectsCount = (rb: RoleBindingData): number => {
    return (rb.subjects || []).length
  }

  // Action handlers
  const handleEditClick = (rb: RoleBindingData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedRoleBinding(rb)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (rb: RoleBindingData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedRoleBinding(rb)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedRoleBinding) return
    try {
      await api.delete(`/clusters/${selectedRoleBinding.ClusterName}/namespaces/${selectedRoleBinding.metadata.namespace}/rolebindings/${selectedRoleBinding.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Role binding deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedRoleBinding(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['rolebindings'] })
      await queryClient.invalidateQueries({ queryKey: ['all-rolebindings'] })
      await queryClient.refetchQueries({ queryKey: ['rolebindings'] })
      await queryClient.refetchQueries({ queryKey: ['all-rolebindings'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete role binding: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<RoleBindingData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (rb) => (
        <div className="flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${rb.ClusterName}/namespaces/${rb.metadata.namespace}/rolebindings/${rb.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {rb.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {rb.ClusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (rb) => rb.metadata.name,
      searchValue: (rb) => `${rb.metadata.name} ${rb.ClusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (rb) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {rb.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (rb) => rb.metadata.namespace,
      searchValue: (rb) => rb.metadata.namespace,
    },
    {
      key: 'role',
      header: 'Role',
      accessor: (rb) => (
        <div className="flex flex-col gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              // Navigate to role or cluster role based on kind
              if (rb.roleRef.kind === 'ClusterRole') {
                navigate(`/clusters/${rb.ClusterName}/clusterroles/${rb.roleRef.name}`)
              } else {
                navigate(`/clusters/${rb.ClusterName}/namespaces/${rb.metadata.namespace}/roles/${rb.roleRef.name}`)
              }
            }}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-left"
          >
            {rb.roleRef.name}
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {rb.roleRef.kind}
          </span>
        </div>
      ),
      sortable: true,
      sortValue: (rb) => rb.roleRef.name,
      searchValue: (rb) => `${rb.roleRef.name} ${rb.roleRef.kind}`,
    },
    {
      key: 'subjects',
      header: 'Subjects',
      accessor: (rb) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {getSubjectsCount(rb)}
        </span>
      ),
      sortable: true,
      sortValue: (rb) => getSubjectsCount(rb),
      searchValue: (rb) => String(getSubjectsCount(rb)),
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (rb) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(rb.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (rb) => new Date(rb.metadata.creationTimestamp).getTime(),
      searchValue: (rb) => formatAge(rb.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (rb) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${rb.ClusterName}/namespaces/${rb.metadata.namespace}/rolebindings/${rb.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(rb, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(rb, e)}
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
          { name: 'Role Bindings' }
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            Role Bindings
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {namespace 
              ? `Role bindings in ${cluster} / ${namespace}`
              : cluster 
                ? `All role bindings in ${cluster}`
                : `All role bindings across ${clusters?.length || 0} cluster(s)`
            }
          </p>
        </div>
        {cluster && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Create Role Binding</span>
            <span className="sm:hidden">Create</span>
          </button>
        )}
      </div>
      
      <DataTable
        data={allRoleBindings || []}
        columns={columns}
        keyExtractor={(rb) => `${rb.ClusterName}-${rb.metadata.namespace}-${rb.metadata.name}`}
        searchPlaceholder="Search role bindings by name, cluster, namespace, role..."
        isLoading={isLoading}
        emptyMessage="No role bindings found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <LinkIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(rb) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <LinkIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${rb.ClusterName}/namespaces/${rb.metadata.namespace}/rolebindings/${rb.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {rb.metadata.name}
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {rb.metadata.namespace}
                  </div>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {rb.ClusterName}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Role:</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    // Navigate to role or cluster role based on kind
                    if (rb.roleRef.kind === 'ClusterRole') {
                      navigate(`/clusters/${rb.ClusterName}/clusterroles/${rb.roleRef.name}`)
                    } else {
                      navigate(`/clusters/${rb.ClusterName}/namespaces/${rb.metadata.namespace}/roles/${rb.roleRef.name}`)
                    }
                  }}
                  className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  {rb.roleRef.name}
                </button>
                <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({rb.roleRef.kind})</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Subjects:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{getSubjectsCount(rb)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(rb.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${rb.ClusterName}/namespaces/${rb.metadata.namespace}/rolebindings/${rb.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(rb, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(rb, e)}
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
      <CreateRoleBindingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={async () => {
          await queryClient.invalidateQueries({ queryKey: ['rolebindings'] })
          await queryClient.invalidateQueries({ queryKey: ['all-rolebindings'] })
          await queryClient.refetchQueries({ queryKey: ['rolebindings'] })
          await queryClient.refetchQueries({ queryKey: ['all-rolebindings'] })
          setIsCreateModalOpen(false)
        }}
        cluster={cluster || ''}
        namespace={namespace || 'default'}
      />
      
      {selectedRoleBinding && (
        <>
          <EditRoleBindingYAMLModal
            roleBinding={selectedRoleBinding}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedRoleBinding(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['rolebindings'] })
              await queryClient.invalidateQueries({ queryKey: ['all-rolebindings'] })
              await queryClient.refetchQueries({ queryKey: ['rolebindings'] })
              await queryClient.refetchQueries({ queryKey: ['all-rolebindings'] })
              setIsEditModalOpen(false)
              setSelectedRoleBinding(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedRoleBinding(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete Role Binding"
            message={`Are you sure you want to delete role binding "${selectedRoleBinding.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
