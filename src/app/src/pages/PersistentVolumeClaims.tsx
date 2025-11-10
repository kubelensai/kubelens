import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getPersistentVolumeClaims } from '@/services/api'
import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { 
  PencilSquareIcon, 
  TrashIcon, 
  EyeIcon,
  CircleStackIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import EditPVCYAMLModal from '@/components/PersistentVolumeClaims/EditPVCYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface PersistentVolumeClaimData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
    uid: string
  }
  spec: {
    accessModes: string[]
    resources: {
      requests: {
        storage: string
      }
    }
    storageClassName?: string
    volumeName?: string
  }
  status: {
    phase: string
    capacity?: {
      storage: string
    }
  }
  clusterName: string
}

export default function PersistentVolumeClaims() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedPVC, setSelectedPVC] = useState<PersistentVolumeClaimData | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch PVCs from all clusters or specific cluster/namespace
  const { data: allPVCs, isLoading } = useQuery({
    queryKey: namespace 
      ? ['persistentvolumeclaims', cluster, namespace]
      : cluster 
        ? ['persistentvolumeclaims', cluster] 
        : ['all-persistentvolumeclaims', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const pvcs = await getPersistentVolumeClaims(cluster, namespace)
        return pvcs.map((pvc: any) => ({ ...pvc, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const pvcs = await getPersistentVolumeClaims(cluster)
        return pvcs.map((pvc: any) => ({ ...pvc, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allPVCs = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const pvcs = await getPersistentVolumeClaims(cluster.name)
            return pvcs.map((pvc: any) => ({ ...pvc, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching PVCs from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allPVCs.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper functions
  const getPVCStatus = (pvc: PersistentVolumeClaimData) => {
    const phase = pvc.status?.phase || 'Unknown'
    const colorMap: Record<string, string> = {
      'Bound': 'green',
      'Pending': 'yellow',
      'Lost': 'red',
    }
    return { status: phase, color: colorMap[phase] || 'gray' }
  }

  // Action handlers
  const handleEditClick = (pvc: PersistentVolumeClaimData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPVC(pvc)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (pvc: PersistentVolumeClaimData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPVC(pvc)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedPVC) return
    try {
      await api.delete(`/clusters/${selectedPVC.clusterName}/namespaces/${selectedPVC.metadata.namespace}/persistentvolumeclaims/${selectedPVC.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Persistent volume claim deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedPVC(null)
      await queryClient.invalidateQueries({ queryKey: ['persistentvolumeclaims'] })
      await queryClient.invalidateQueries({ queryKey: ['all-persistentvolumeclaims'] })
      await queryClient.refetchQueries({ queryKey: ['persistentvolumeclaims'] })
      await queryClient.refetchQueries({ queryKey: ['all-persistentvolumeclaims'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete persistent volume claim: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<PersistentVolumeClaimData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (pvc) => (
        <div className="flex items-center gap-2">
          <CircleStackIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${pvc.clusterName}/namespaces/${pvc.metadata.namespace}/persistentvolumeclaims/${pvc.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {pvc.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {pvc.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (pvc) => pvc.metadata.name,
      searchValue: (pvc) => `${pvc.metadata.name} ${pvc.clusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (pvc) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {pvc.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (pvc) => pvc.metadata.namespace,
      searchValue: (pvc) => pvc.metadata.namespace,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (pvc) => {
        const pvcStatus = getPVCStatus(pvc)
        const colorClasses = {
          green: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
          red: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
          gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
        }
        
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
            colorClasses[pvcStatus.color as keyof typeof colorClasses]
          )}>
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full',
              pvcStatus.color === 'green' ? 'bg-green-600' :
              pvcStatus.color === 'yellow' ? 'bg-yellow-600' :
              pvcStatus.color === 'red' ? 'bg-red-600' :
              'bg-gray-600'
            )} />
            {pvcStatus.status}
          </span>
        )
      },
      sortable: true,
      sortValue: (pvc) => getPVCStatus(pvc).status,
      searchValue: (pvc) => getPVCStatus(pvc).status,
      filterable: true,
      filterOptions: (data) => {
        const statuses = new Set(data.map(p => getPVCStatus(p).status))
        return Array.from(statuses).sort()
      },
      filterValue: (pvc) => getPVCStatus(pvc).status,
    },
    {
      key: 'volume',
      header: 'Volume',
      accessor: (pvc) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 font-mono text-xs">
          {pvc.spec?.volumeName || '-'}
        </span>
      ),
      sortable: false,
      searchValue: (pvc) => pvc.spec?.volumeName || '',
    },
    {
      key: 'capacity',
      header: 'Capacity',
      accessor: (pvc) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">
          {pvc.status?.capacity?.storage || pvc.spec?.resources?.requests?.storage || '-'}
        </span>
      ),
      sortable: true,
      sortValue: (pvc) => pvc.status?.capacity?.storage || pvc.spec?.resources?.requests?.storage || '',
      searchValue: (pvc) => pvc.status?.capacity?.storage || pvc.spec?.resources?.requests?.storage || '',
    },
    {
      key: 'accessModes',
      header: 'Access Modes',
      accessor: (pvc) => (
        <div className="flex flex-wrap gap-1">
          {pvc.spec?.accessModes?.map((mode, idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            >
              {mode}
            </span>
          )) || '-'}
        </div>
      ),
      sortable: false,
      searchValue: (pvc) => pvc.spec?.accessModes?.join(', ') || '',
    },
    {
      key: 'storageClass',
      header: 'Storage Class',
      accessor: (pvc) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {pvc.spec?.storageClassName || '-'}
        </span>
      ),
      sortable: true,
      sortValue: (pvc) => pvc.spec?.storageClassName || '',
      searchValue: (pvc) => pvc.spec?.storageClassName || '',
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (pvc) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(pvc.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (pvc) => new Date(pvc.metadata.creationTimestamp).getTime(),
      searchValue: (pvc) => formatAge(pvc.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (pvc) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${pvc.clusterName}/namespaces/${pvc.metadata.namespace}/persistentvolumeclaims/${pvc.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(pvc, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(pvc, e)}
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
          { name: 'Persistent Volume Claims' }
        ]}
      />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
          Persistent Volume Claims
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {namespace 
            ? `Persistent volume claims in ${cluster} / ${namespace}`
            : cluster 
              ? `All persistent volume claims in ${cluster}`
              : `All persistent volume claims across ${clusters?.length || 0} cluster(s)`
          }
        </p>
      </div>
      
      <DataTable
        data={allPVCs || []}
        columns={columns}
        keyExtractor={(pvc) => `${pvc.clusterName}-${pvc.metadata.namespace}-${pvc.metadata.name}`}
        searchPlaceholder="Search persistent volume claims by name, cluster, namespace..."
        isLoading={isLoading}
        emptyMessage="No persistent volume claims found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <CircleStackIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(pvc) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <CircleStackIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${pvc.clusterName}/namespaces/${pvc.metadata.namespace}/persistentvolumeclaims/${pvc.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {pvc.metadata.name}
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {pvc.metadata.namespace}
                  </div>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {pvc.clusterName}
                    </div>
                  )}
                </div>
              </div>
              <span className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full shrink-0',
                getPVCStatus(pvc).color === 'green'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : getPVCStatus(pvc).color === 'yellow'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                  : getPVCStatus(pvc).color === 'red'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
              )}>
                {getPVCStatus(pvc).status}
              </span>
            </div>
            
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Capacity:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono">{pvc.status?.capacity?.storage || pvc.spec?.resources?.requests?.storage || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Volume:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">{pvc.spec?.volumeName || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Storage Class:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{pvc.spec?.storageClassName || '-'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(pvc.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${pvc.clusterName}/namespaces/${pvc.metadata.namespace}/persistentvolumeclaims/${pvc.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(pvc, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(pvc, e)}
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
      {selectedPVC && (
        <>
          <EditPVCYAMLModal
            pvc={selectedPVC}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedPVC(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['persistentvolumeclaims'] })
              await queryClient.invalidateQueries({ queryKey: ['all-persistentvolumeclaims'] })
              await queryClient.refetchQueries({ queryKey: ['persistentvolumeclaims'] })
              await queryClient.refetchQueries({ queryKey: ['all-persistentvolumeclaims'] })
              setIsEditModalOpen(false)
              setSelectedPVC(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedPVC(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete Persistent Volume Claim"
            message={`Are you sure you want to delete persistent volume claim "${selectedPVC.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
