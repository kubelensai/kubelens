import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getClusterRoles } from '@/services/api'
import { useMemo, useState } from 'react'
import { 
  PencilSquareIcon, 
  TrashIcon, 
  EyeIcon,
  ShieldCheckIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import CreateClusterRoleModal from '@/components/ClusterRoles/CreateClusterRoleModal'
import EditClusterRoleYAMLModal from '@/components/ClusterRoles/EditClusterRoleYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'
import clsx from 'clsx'

interface ClusterRoleData {
  metadata: {
    name: string
    creationTimestamp: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  rules?: Array<{
    apiGroups?: string[]
    resources?: string[]
    verbs?: string[]
  }>
  aggregationRule?: any
  ClusterName: string
}

export default function ClusterRoles() {
  const { cluster } = useParams<{ cluster?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedClusterRole, setSelectedClusterRole] = useState<ClusterRoleData | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch cluster roles from all clusters or specific cluster
  const { data: allClusterRoles, isLoading } = useQuery({
    queryKey: cluster 
      ? ['clusterroles', cluster] 
      : ['all-clusterroles', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster requested
      if (cluster) {
        const clusterRoles = await getClusterRoles(cluster)
        return clusterRoles.map((cr: any) => ({ ...cr, ClusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allClusterRoles = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const clusterRoles = await getClusterRoles(cluster.name)
            return clusterRoles.map((cr: any) => ({ ...cr, ClusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching cluster roles from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allClusterRoles.flat()
    },
    enabled: cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper functions
  const getRulesCount = (cr: ClusterRoleData): number => {
    return (cr.rules || []).length
  }

  // Action handlers
  const handleEditClick = (cr: ClusterRoleData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedClusterRole(cr)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (cr: ClusterRoleData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedClusterRole(cr)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedClusterRole) return
    try {
      await api.delete(`/clusters/${selectedClusterRole.ClusterName}/clusterroles/${selectedClusterRole.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Cluster role deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedClusterRole(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['clusterroles'] })
      await queryClient.invalidateQueries({ queryKey: ['all-clusterroles'] })
      await queryClient.refetchQueries({ queryKey: ['clusterroles'] })
      await queryClient.refetchQueries({ queryKey: ['all-clusterroles'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete cluster role: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<ClusterRoleData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (cr) => (
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${cr.ClusterName}/clusterroles/${cr.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {cr.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {cr.ClusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (cr) => cr.metadata.name,
      searchValue: (cr) => `${cr.metadata.name} ${cr.ClusterName}`,
    },
    {
      key: 'rules',
      header: 'Rules',
      accessor: (cr) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {getRulesCount(cr)}
        </span>
      ),
      sortable: true,
      sortValue: (cr) => getRulesCount(cr),
      searchValue: (cr) => String(getRulesCount(cr)),
    },
    {
      key: 'aggregated',
      header: 'Aggregated',
      accessor: (cr) => {
        if (cr.aggregationRule) {
          return (
            <span className={clsx(
              'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
              'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
            )}>
              Yes
            </span>
          )
        }
        return <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
      },
      sortable: true,
      sortValue: (cr) => cr.aggregationRule ? 1 : 0,
      searchValue: (cr) => cr.aggregationRule ? 'Yes' : 'No',
    },
    {
      key: 'labels',
      header: 'Labels',
      accessor: (cr) => {
        const labels = cr.metadata.labels
        if (!labels || Object.keys(labels).length === 0) {
          return <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
        }
        const labelCount = Object.keys(labels).length
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
            'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
          )}>
            {labelCount} {labelCount === 1 ? 'label' : 'labels'}
          </span>
        )
      },
      sortable: true,
      sortValue: (cr) => Object.keys(cr.metadata.labels || {}).length,
      searchValue: (cr) => {
        const labels = cr.metadata.labels
        if (!labels) return ''
        return Object.entries(labels).map(([k, v]) => `${k}:${v}`).join(' ')
      },
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (cr) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(cr.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (cr) => new Date(cr.metadata.creationTimestamp).getTime(),
      searchValue: (cr) => formatAge(cr.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (cr) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${cr.ClusterName}/clusterroles/${cr.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(cr, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(cr, e)}
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
          { name: 'Cluster Roles' }
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            Cluster Roles
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {cluster 
              ? `All cluster roles in ${cluster}`
              : `All cluster roles across ${clusters?.length || 0} cluster(s)`
            }
          </p>
        </div>
        {cluster && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Create Cluster Role</span>
            <span className="sm:hidden">Create</span>
          </button>
        )}
      </div>
      
      <DataTable
        data={allClusterRoles || []}
        columns={columns}
        keyExtractor={(cr) => `${cr.ClusterName}-${cr.metadata.name}`}
        searchPlaceholder="Search cluster roles by name, cluster, labels..."
        isLoading={isLoading}
        emptyMessage="No cluster roles found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <ShieldCheckIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(cr) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <ShieldCheckIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${cr.ClusterName}/clusterroles/${cr.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {cr.metadata.name}
                  </button>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {cr.ClusterName}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Rules:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{getRulesCount(cr)}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Aggregated:</span>
                <span className="ml-1 text-gray-900 dark:text-white">
                  {cr.aggregationRule ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Labels:</span>
                <span className="ml-1 text-gray-900 dark:text-white">
                  {cr.metadata.labels && Object.keys(cr.metadata.labels).length > 0 
                    ? `${Object.keys(cr.metadata.labels).length} ${Object.keys(cr.metadata.labels).length === 1 ? 'label' : 'labels'}`
                    : '-'
                  }
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(cr.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${cr.ClusterName}/clusterroles/${cr.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(cr, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(cr, e)}
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
      <CreateClusterRoleModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={async () => {
          await queryClient.invalidateQueries({ queryKey: ['clusterroles'] })
          await queryClient.invalidateQueries({ queryKey: ['all-clusterroles'] })
          await queryClient.refetchQueries({ queryKey: ['clusterroles'] })
          await queryClient.refetchQueries({ queryKey: ['all-clusterroles'] })
          setIsCreateModalOpen(false)
        }}
        cluster={cluster || ''}
      />
      
      {selectedClusterRole && (
        <>
          <EditClusterRoleYAMLModal
            clusterRole={selectedClusterRole}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedClusterRole(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['clusterroles'] })
              await queryClient.invalidateQueries({ queryKey: ['all-clusterroles'] })
              await queryClient.refetchQueries({ queryKey: ['clusterroles'] })
              await queryClient.refetchQueries({ queryKey: ['all-clusterroles'] })
              setIsEditModalOpen(false)
              setSelectedClusterRole(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedClusterRole(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete Cluster Role"
            message={`Are you sure you want to delete cluster role "${selectedClusterRole.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
