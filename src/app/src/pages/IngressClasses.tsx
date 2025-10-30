import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getIngressClasses } from '@/services/api'
import { useMemo, useState } from 'react'
import { 
  PencilSquareIcon, 
  TrashIcon, 
  EyeIcon,
  RectangleGroupIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import CreateIngressClassModal from '@/components/IngressClasses/CreateIngressClassModal'
import { DataTable, Column } from '@/components/shared/DataTable'
import EditIngressClassYAMLModal from '@/components/IngressClasses/EditIngressClassYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface IngressClassData {
  metadata: {
    name: string
    creationTimestamp: string
  }
  spec: {
    controller: string
    parameters?: {
      apiGroup?: string
      kind: string
      name: string
    }
  }
  clusterName: string
}

export default function IngressClasses() {
  const { cluster } = useParams<{ cluster?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedIngressClass, setSelectedIngressClass] = useState<IngressClassData | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch ingress classes from all clusters or specific cluster
  const { data: allIngressClasses, isLoading } = useQuery({
    queryKey: cluster 
      ? ['ingressclasses', cluster] 
      : ['all-ingressclasses', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster requested
      if (cluster) {
        const ingressClasses = await getIngressClasses(cluster)
        return ingressClasses.map((ic: any) => ({ ...ic, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allIngressClasses = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const ingressClasses = await getIngressClasses(cluster.name)
            return ingressClasses.map((ic: any) => ({ ...ic, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching ingress classes from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allIngressClasses.flat()
    },
    enabled: cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Action handlers
  const handleEditClick = (ingressClass: IngressClassData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIngressClass(ingressClass)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (ingressClass: IngressClassData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIngressClass(ingressClass)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedIngressClass) return
    try {
      await api.delete(`/clusters/${selectedIngressClass.clusterName}/ingressclasses/${selectedIngressClass.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Ingress class deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedIngressClass(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['ingressclasses'] })
      await queryClient.invalidateQueries({ queryKey: ['all-ingressclasses'] })
      await queryClient.refetchQueries({ queryKey: ['ingressclasses'] })
      await queryClient.refetchQueries({ queryKey: ['all-ingressclasses'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete ingress class: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<IngressClassData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (ingressClass) => (
        <div className="flex items-center gap-2">
          <RectangleGroupIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${ingressClass.clusterName}/ingressclasses/${ingressClass.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {ingressClass.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {ingressClass.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (ingressClass) => ingressClass.metadata.name,
      searchValue: (ingressClass) => `${ingressClass.metadata.name} ${ingressClass.clusterName}`,
    },
    {
      key: 'controller',
      header: 'Controller',
      accessor: (ingressClass) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">
          {ingressClass.spec.controller}
        </span>
      ),
      sortable: true,
      sortValue: (ingressClass) => ingressClass.spec.controller,
      searchValue: (ingressClass) => ingressClass.spec.controller,
    },
    {
      key: 'parameters',
      header: 'Parameters',
      accessor: (ingressClass) => {
        if (!ingressClass.spec.parameters) {
          return <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
        }
        return (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {ingressClass.spec.parameters.kind}/{ingressClass.spec.parameters.name}
          </span>
        )
      },
      sortable: false,
      searchValue: (ingressClass) => ingressClass.spec.parameters ? `${ingressClass.spec.parameters.kind}/${ingressClass.spec.parameters.name}` : '',
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (ingressClass) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(ingressClass.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (ingressClass) => new Date(ingressClass.metadata.creationTimestamp).getTime(),
      searchValue: (ingressClass) => formatAge(ingressClass.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (ingressClass) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${ingressClass.clusterName}/ingressclasses/${ingressClass.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(ingressClass, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(ingressClass, e)}
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
          { name: 'Ingress Classes' }
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            Ingress Classes
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {cluster 
              ? `All ingress classes in ${cluster}`
              : `All ingress classes across ${clusters?.length || 0} cluster(s)`
            }
          </p>
        </div>
        {cluster && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Create Ingress Class</span>
            <span className="sm:hidden">Create</span>
          </button>
        )}
      </div>
      
      <DataTable
        data={allIngressClasses || []}
        columns={columns}
        keyExtractor={(ingressClass) => `${ingressClass.clusterName}-${ingressClass.metadata.name}`}
        searchPlaceholder="Search ingress classes by name, cluster, controller..."
        isLoading={isLoading}
        emptyMessage="No ingress classes found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <RectangleGroupIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(ingressClass) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <RectangleGroupIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${ingressClass.clusterName}/ingressclasses/${ingressClass.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {ingressClass.metadata.name}
                  </button>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {ingressClass.clusterName}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Controller:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">{ingressClass.spec.controller}</span>
              </div>
              {ingressClass.spec.parameters && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Parameters:</span>
                  <span className="ml-1 text-gray-900 dark:text-white">{ingressClass.spec.parameters.kind}/{ingressClass.spec.parameters.name}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(ingressClass.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${ingressClass.clusterName}/ingressclasses/${ingressClass.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(ingressClass, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(ingressClass, e)}
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
      <CreateIngressClassModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        clusterName={cluster || ''}
      />
      
      {selectedIngressClass && (
        <>
          <EditIngressClassYAMLModal
            ingressClass={selectedIngressClass}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedIngressClass(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['ingressclasses'] })
              await queryClient.invalidateQueries({ queryKey: ['all-ingressclasses'] })
              await queryClient.refetchQueries({ queryKey: ['ingressclasses'] })
              await queryClient.refetchQueries({ queryKey: ['all-ingressclasses'] })
              setIsEditModalOpen(false)
              setSelectedIngressClass(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedIngressClass(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete Ingress Class"
            message={`Are you sure you want to delete ingress class "${selectedIngressClass.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
