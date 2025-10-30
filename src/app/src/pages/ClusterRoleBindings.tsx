import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getClusterRoleBindings } from '@/services/api'
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
import CreateClusterRoleBindingModal from '@/components/ClusterRoleBindings/CreateClusterRoleBindingModal'
import EditClusterRoleBindingYAMLModal from '@/components/ClusterRoleBindings/EditClusterRoleBindingYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface ClusterRoleBindingData {
  metadata: {
    name: string
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

export default function ClusterRoleBindings() {
  const { cluster } = useParams<{ cluster?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedClusterRoleBinding, setSelectedClusterRoleBinding] = useState<ClusterRoleBindingData | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch cluster role bindings from all clusters or specific cluster
  const { data: allClusterRoleBindings, isLoading } = useQuery({
    queryKey: cluster 
      ? ['clusterrolebindings', cluster] 
      : ['all-clusterrolebindings', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster requested
      if (cluster) {
        const clusterRoleBindings = await getClusterRoleBindings(cluster)
        return clusterRoleBindings.map((crb: any) => ({ ...crb, ClusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allClusterRoleBindings = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const clusterRoleBindings = await getClusterRoleBindings(cluster.name)
            return clusterRoleBindings.map((crb: any) => ({ ...crb, ClusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching cluster role bindings from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allClusterRoleBindings.flat()
    },
    enabled: cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper functions
  const getSubjectsCount = (crb: ClusterRoleBindingData): number => {
    return (crb.subjects || []).length
  }

  // Action handlers
  const handleEditClick = (crb: ClusterRoleBindingData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedClusterRoleBinding(crb)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (crb: ClusterRoleBindingData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedClusterRoleBinding(crb)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedClusterRoleBinding) return
    try {
      await api.delete(`/clusters/${selectedClusterRoleBinding.ClusterName}/clusterrolebindings/${selectedClusterRoleBinding.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Cluster role binding deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedClusterRoleBinding(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['clusterrolebindings'] })
      await queryClient.invalidateQueries({ queryKey: ['all-clusterrolebindings'] })
      await queryClient.refetchQueries({ queryKey: ['clusterrolebindings'] })
      await queryClient.refetchQueries({ queryKey: ['all-clusterrolebindings'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete cluster role binding: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<ClusterRoleBindingData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (crb) => (
        <div className="flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${crb.ClusterName}/clusterrolebindings/${crb.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {crb.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {crb.ClusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (crb) => crb.metadata.name,
      searchValue: (crb) => `${crb.metadata.name} ${crb.ClusterName}`,
    },
    {
      key: 'role',
      header: 'Role',
      accessor: (crb) => (
        <div className="flex flex-col gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${crb.ClusterName}/clusterroles/${crb.roleRef.name}`)
            }}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-left"
          >
            {crb.roleRef.name}
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {crb.roleRef.kind}
          </span>
        </div>
      ),
      sortable: true,
      sortValue: (crb) => crb.roleRef.name,
      searchValue: (crb) => `${crb.roleRef.name} ${crb.roleRef.kind}`,
    },
    {
      key: 'subjects',
      header: 'Subjects',
      accessor: (crb) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {getSubjectsCount(crb)}
        </span>
      ),
      sortable: true,
      sortValue: (crb) => getSubjectsCount(crb),
      searchValue: (crb) => String(getSubjectsCount(crb)),
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (crb) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(crb.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (crb) => new Date(crb.metadata.creationTimestamp).getTime(),
      searchValue: (crb) => formatAge(crb.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (crb) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${crb.ClusterName}/clusterrolebindings/${crb.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(crb, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(crb, e)}
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
          { name: 'Cluster Role Bindings' }
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            Cluster Role Bindings
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {cluster 
              ? `All cluster role bindings in ${cluster}`
              : `All cluster role bindings across ${clusters?.length || 0} cluster(s)`
            }
          </p>
        </div>
        {cluster && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Create Cluster Role Binding</span>
            <span className="sm:hidden">Create</span>
          </button>
        )}
      </div>
      
      <DataTable
        data={allClusterRoleBindings || []}
        columns={columns}
        keyExtractor={(crb) => `${crb.ClusterName}-${crb.metadata.name}`}
        searchPlaceholder="Search cluster role bindings by name, cluster, role..."
        isLoading={isLoading}
        emptyMessage="No cluster role bindings found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <LinkIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(crb) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <LinkIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${crb.ClusterName}/clusterrolebindings/${crb.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {crb.metadata.name}
                  </button>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {crb.ClusterName}
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
                    navigate(`/clusters/${crb.ClusterName}/clusterroles/${crb.roleRef.name}`)
                  }}
                  className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  {crb.roleRef.name}
                </button>
                <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({crb.roleRef.kind})</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Subjects:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{getSubjectsCount(crb)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(crb.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${crb.ClusterName}/clusterrolebindings/${crb.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(crb, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(crb, e)}
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
      <CreateClusterRoleBindingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={async () => {
          await queryClient.invalidateQueries({ queryKey: ['clusterrolebindings'] })
          await queryClient.invalidateQueries({ queryKey: ['all-clusterrolebindings'] })
          await queryClient.refetchQueries({ queryKey: ['clusterrolebindings'] })
          await queryClient.refetchQueries({ queryKey: ['all-clusterrolebindings'] })
          setIsCreateModalOpen(false)
        }}
        cluster={cluster || ''}
      />
      
      {selectedClusterRoleBinding && (
        <>
          <EditClusterRoleBindingYAMLModal
            clusterRoleBinding={selectedClusterRoleBinding}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedClusterRoleBinding(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['clusterrolebindings'] })
              await queryClient.invalidateQueries({ queryKey: ['all-clusterrolebindings'] })
              await queryClient.refetchQueries({ queryKey: ['clusterrolebindings'] })
              await queryClient.refetchQueries({ queryKey: ['all-clusterrolebindings'] })
              setIsEditModalOpen(false)
              setSelectedClusterRoleBinding(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedClusterRoleBinding(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete Cluster Role Binding"
            message={`Are you sure you want to delete cluster role binding "${selectedClusterRoleBinding.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
