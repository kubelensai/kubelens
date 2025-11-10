import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getRoles } from '@/services/api'
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
import CreateRoleModal from '@/components/Roles/CreateRoleModal'
import EditRoleYAMLModal from '@/components/Roles/EditRoleYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'
import clsx from 'clsx'

interface RoleData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  rules?: Array<{
    apiGroups?: string[]
    resources?: string[]
    verbs?: string[]
  }>
  ClusterName: string
}

export default function Roles() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedRole, setSelectedRole] = useState<RoleData | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch roles from all clusters or specific cluster/namespace
  const { data: allRoles, isLoading } = useQuery({
    queryKey: namespace 
      ? ['roles', cluster, namespace]
      : cluster 
        ? ['roles', cluster] 
        : ['all-roles', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const roles = await getRoles(cluster, namespace)
        return roles.map((role: any) => ({ ...role, ClusterName: cluster }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const roles = await getRoles(cluster, 'all')
        return roles.map((role: any) => ({ ...role, ClusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allRoles = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const roles = await getRoles(cluster.name, 'all')
            return roles.map((role: any) => ({ ...role, ClusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching roles from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allRoles.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper functions
  const getRulesCount = (role: RoleData): number => {
    return (role.rules || []).length
  }

  // Action handlers
  const handleEditClick = (role: RoleData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedRole(role)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (role: RoleData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedRole(role)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedRole) return
    try {
      await api.delete(`/clusters/${selectedRole.ClusterName}/namespaces/${selectedRole.metadata.namespace}/roles/${selectedRole.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Role deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedRole(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['roles'] })
      await queryClient.invalidateQueries({ queryKey: ['all-roles'] })
      await queryClient.refetchQueries({ queryKey: ['roles'] })
      await queryClient.refetchQueries({ queryKey: ['all-roles'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete role: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<RoleData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (role) => (
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${role.ClusterName}/namespaces/${role.metadata.namespace}/roles/${role.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {role.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {role.ClusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (role) => role.metadata.name,
      searchValue: (role) => `${role.metadata.name} ${role.ClusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (role) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {role.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (role) => role.metadata.namespace,
      searchValue: (role) => role.metadata.namespace,
    },
    {
      key: 'rules',
      header: 'Rules',
      accessor: (role) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {getRulesCount(role)}
        </span>
      ),
      sortable: true,
      sortValue: (role) => getRulesCount(role),
      searchValue: (role) => String(getRulesCount(role)),
    },
    {
      key: 'labels',
      header: 'Labels',
      accessor: (role) => {
        const labels = role.metadata.labels
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
      sortValue: (role) => Object.keys(role.metadata.labels || {}).length,
      searchValue: (role) => {
        const labels = role.metadata.labels
        if (!labels) return ''
        return Object.entries(labels).map(([k, v]) => `${k}:${v}`).join(' ')
      },
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (role) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(role.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (role) => new Date(role.metadata.creationTimestamp).getTime(),
      searchValue: (role) => formatAge(role.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (role) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${role.ClusterName}/namespaces/${role.metadata.namespace}/roles/${role.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(role, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(role, e)}
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
          { name: 'Roles' }
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            Roles
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {namespace 
              ? `Roles in ${cluster} / ${namespace}`
              : cluster 
                ? `All roles in ${cluster}`
                : `All roles across ${clusters?.length || 0} cluster(s)`
            }
          </p>
        </div>
        {cluster && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Create Role</span>
            <span className="sm:hidden">Create</span>
          </button>
        )}
      </div>
      
      <DataTable
        data={allRoles || []}
        columns={columns}
        keyExtractor={(role) => `${role.ClusterName}-${role.metadata.namespace}-${role.metadata.name}`}
        searchPlaceholder="Search roles by name, cluster, namespace, labels..."
        isLoading={isLoading}
        emptyMessage="No roles found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <ShieldCheckIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(role) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <ShieldCheckIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${role.ClusterName}/namespaces/${role.metadata.namespace}/roles/${role.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {role.metadata.name}
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {role.metadata.namespace}
                  </div>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {role.ClusterName}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Rules:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{getRulesCount(role)}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Labels:</span>
                <span className="ml-1 text-gray-900 dark:text-white">
                  {role.metadata.labels && Object.keys(role.metadata.labels).length > 0 
                    ? `${Object.keys(role.metadata.labels).length} ${Object.keys(role.metadata.labels).length === 1 ? 'label' : 'labels'}`
                    : '-'
                  }
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(role.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${role.ClusterName}/namespaces/${role.metadata.namespace}/roles/${role.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(role, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(role, e)}
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
      <CreateRoleModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={async () => {
          await queryClient.invalidateQueries({ queryKey: ['roles'] })
          await queryClient.invalidateQueries({ queryKey: ['all-roles'] })
          await queryClient.refetchQueries({ queryKey: ['roles'] })
          await queryClient.refetchQueries({ queryKey: ['all-roles'] })
          setIsCreateModalOpen(false)
        }}
        cluster={cluster || ''}
        namespace={namespace || 'default'}
      />
      
      {selectedRole && (
        <>
          <EditRoleYAMLModal
            role={selectedRole}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedRole(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['roles'] })
              await queryClient.invalidateQueries({ queryKey: ['all-roles'] })
              await queryClient.refetchQueries({ queryKey: ['roles'] })
              await queryClient.refetchQueries({ queryKey: ['all-roles'] })
              setIsEditModalOpen(false)
              setSelectedRole(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedRole(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete Role"
            message={`Are you sure you want to delete role "${selectedRole.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
