import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getIngresses } from '@/services/api'
import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { 
  PencilSquareIcon, 
  TrashIcon, 
  EyeIcon,
  GlobeAltIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import CreateIngressModal from '@/components/Ingresses/CreateIngressModal'
import { DataTable, Column } from '@/components/shared/DataTable'
import EditIngressYAMLModal from '@/components/Ingresses/EditIngressYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface IngressData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
  }
  spec: {
    rules?: Array<{
      host?: string
      http?: {
        paths: Array<{
          path: string
          pathType: string
          backend: {
            service: {
              name: string
              port: {
                number?: number
                name?: string
              }
            }
          }
        }>
      }
    }>
    tls?: Array<{
      hosts: string[]
      secretName: string
    }>
    ingressClassName?: string
  }
  status?: {
    loadBalancer?: {
      ingress?: Array<{
        ip?: string
        hostname?: string
      }>
    }
  }
  clusterName: string
}

export default function Ingresses() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedIngress, setSelectedIngress] = useState<IngressData | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch ingresses from all clusters or specific cluster/namespace
  const { data: allIngresses, isLoading } = useQuery({
    queryKey: namespace 
      ? ['ingresses', cluster, namespace]
      : cluster 
        ? ['ingresses', cluster] 
        : ['all-ingresses', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const ingresses = await getIngresses(cluster, namespace)
        return ingresses.map((ingress: any) => ({ ...ingress, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const ingresses = await getIngresses(cluster)
        return ingresses.map((ingress: any) => ({ ...ingress, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allIngresses = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const ingresses = await getIngresses(cluster.name)
            return ingresses.map((ingress: any) => ({ ...ingress, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching ingresses from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allIngresses.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper functions
  const formatHosts = (ingress: IngressData): string => {
    const hosts: string[] = []
    ingress.spec.rules?.forEach((rule) => {
      if (rule.host) {
        hosts.push(rule.host)
      }
    })
    return hosts.length > 0 ? hosts.slice(0, 2).join(', ') + (hosts.length > 2 ? '...' : '') : 'None'
  }

  const getIngressStatus = (ingress: IngressData) => {
    const hasLoadBalancer = ingress.status?.loadBalancer?.ingress && ingress.status.loadBalancer.ingress.length > 0
    
    if (hasLoadBalancer) {
      return { status: 'Active', color: 'green' }
    }
    
    return { status: 'Pending', color: 'yellow' }
  }

  // Action handlers
  const handleEditClick = (ingress: IngressData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIngress(ingress)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (ingress: IngressData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIngress(ingress)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedIngress) return
    try {
      await api.delete(`/clusters/${selectedIngress.clusterName}/namespaces/${selectedIngress.metadata.namespace}/ingresses/${selectedIngress.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Ingress deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedIngress(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['ingresses'] })
      await queryClient.invalidateQueries({ queryKey: ['all-ingresses'] })
      await queryClient.refetchQueries({ queryKey: ['ingresses'] })
      await queryClient.refetchQueries({ queryKey: ['all-ingresses'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete ingress: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<IngressData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (ingress) => (
        <div className="flex items-center gap-2">
          <GlobeAltIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${ingress.clusterName}/namespaces/${ingress.metadata.namespace}/ingresses/${ingress.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {ingress.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {ingress.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (ingress) => ingress.metadata.name,
      searchValue: (ingress) => `${ingress.metadata.name} ${ingress.clusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (ingress) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {ingress.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (ingress) => ingress.metadata.namespace,
      searchValue: (ingress) => ingress.metadata.namespace,
    },
    {
      key: 'hosts',
      header: 'Hosts',
      accessor: (ingress) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">
          {formatHosts(ingress)}
        </span>
      ),
      sortable: false,
      searchValue: (ingress) => formatHosts(ingress),
    },
    {
      key: 'class',
      header: 'Class',
      accessor: (ingress) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {ingress.spec.ingressClassName || '-'}
        </span>
      ),
      sortable: true,
      sortValue: (ingress) => ingress.spec.ingressClassName || '',
      searchValue: (ingress) => ingress.spec.ingressClassName || '',
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (ingress) => {
        const ingressStatus = getIngressStatus(ingress)
        const colorClasses = {
          green: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
        }
        
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
            colorClasses[ingressStatus.color as keyof typeof colorClasses]
          )}>
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full',
              ingressStatus.color === 'green' ? 'bg-green-600' : 'bg-yellow-600'
            )} />
            {ingressStatus.status}
          </span>
        )
      },
      sortable: true,
      sortValue: (ingress) => getIngressStatus(ingress).status,
      searchValue: (ingress) => getIngressStatus(ingress).status,
      filterable: true,
      filterOptions: (data) => {
        const statuses = new Set(data.map(i => getIngressStatus(i).status))
        return Array.from(statuses).sort()
      },
      filterValue: (ingress) => getIngressStatus(ingress).status,
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (ingress) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(ingress.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (ingress) => new Date(ingress.metadata.creationTimestamp).getTime(),
      searchValue: (ingress) => formatAge(ingress.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (ingress) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${ingress.clusterName}/namespaces/${ingress.metadata.namespace}/ingresses/${ingress.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(ingress, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(ingress, e)}
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
          { name: 'Ingresses' }
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            Ingresses
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {namespace 
              ? `Ingresses in ${cluster} / ${namespace}`
              : cluster 
                ? `All ingresses in ${cluster}`
                : `All ingresses across ${clusters?.length || 0} cluster(s)`
            }
          </p>
        </div>
        {cluster && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Create Ingress</span>
            <span className="sm:hidden">Create</span>
          </button>
        )}
      </div>
      
      <DataTable
        data={allIngresses || []}
        columns={columns}
        keyExtractor={(ingress) => `${ingress.clusterName}-${ingress.metadata.namespace}-${ingress.metadata.name}`}
        searchPlaceholder="Search ingresses by name, cluster, namespace, hosts..."
        isLoading={isLoading}
        emptyMessage="No ingresses found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <GlobeAltIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(ingress) => {
          const ingressStatus = getIngressStatus(ingress)
          return (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <GlobeAltIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                  <div className="min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/clusters/${ingress.clusterName}/namespaces/${ingress.metadata.namespace}/ingresses/${ingress.metadata.name}`)
                      }}
                      className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                    >
                      {ingress.metadata.name}
                    </button>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {ingress.metadata.namespace}
                    </div>
                    {!cluster && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {ingress.clusterName}
                      </div>
                    )}
                  </div>
                </div>
                <span className={clsx(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full shrink-0',
                  ingressStatus.color === 'green'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                )}>
                  <span className={clsx(
                    'w-1.5 h-1.5 rounded-full',
                    ingressStatus.color === 'green' ? 'bg-green-600' : 'bg-yellow-600'
                  )} />
                  {ingressStatus.status}
                </span>
              </div>
              
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Hosts:</span>
                  <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">{formatHosts(ingress)}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Class:</span>
                  <span className="ml-1 text-gray-900 dark:text-white">{ingress.spec.ingressClassName || '-'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatAge(ingress.metadata.creationTimestamp)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${ingress.clusterName}/namespaces/${ingress.metadata.namespace}/ingresses/${ingress.metadata.name}`)
                    }}
                    className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                    title="View Details"
                  >
                    <EyeIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleEditClick(ingress, e)}
                    className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                    title="Edit YAML"
                  >
                    <PencilSquareIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteClick(ingress, e)}
                    className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        }}
      />

      {/* Modals */}
      <CreateIngressModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        clusterName={cluster || ''}
        namespace={namespace || ''}
      />
      
      {selectedIngress && (
        <>
          <EditIngressYAMLModal
            ingress={selectedIngress}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedIngress(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['ingresses'] })
              await queryClient.invalidateQueries({ queryKey: ['all-ingresses'] })
              await queryClient.refetchQueries({ queryKey: ['ingresses'] })
              await queryClient.refetchQueries({ queryKey: ['all-ingresses'] })
              setIsEditModalOpen(false)
              setSelectedIngress(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedIngress(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete Ingress"
            message={`Are you sure you want to delete ingress "${selectedIngress.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
