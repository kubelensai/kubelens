import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getPersistentVolumes } from '@/services/api'
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
import EditPVYAMLModal from '@/components/PersistentVolumes/EditPVYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface PersistentVolumeData {
  metadata: {
    name: string
    creationTimestamp: string
    labels?: Record<string, string>
  }
  spec: {
    capacity?: {
      storage?: string
    }
    accessModes?: string[]
    persistentVolumeReclaimPolicy?: string
    storageClassName?: string
    claimRef?: {
      namespace?: string
      name?: string
    }
  }
  status: {
    phase?: string
  }
  clusterName: string
}

export default function PersistentVolumes() {
  const { cluster } = useParams<{ cluster?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedPV, setSelectedPV] = useState<PersistentVolumeData | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch persistent volumes from all clusters or specific cluster
  const { data: allPVs, isLoading } = useQuery({
    queryKey: cluster 
      ? ['persistentvolumes', cluster] 
      : ['all-persistentvolumes', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster requested
      if (cluster) {
        const pvs = await getPersistentVolumes(cluster)
        return pvs.map((pv: any) => ({ ...pv, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allPVs = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const pvs = await getPersistentVolumes(cluster.name)
            return pvs.map((pv: any) => ({ ...pv, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching persistent volumes from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allPVs.flat()
    },
    enabled: cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper functions
  const getPVStatus = (pv: PersistentVolumeData) => {
    const phase = pv.status?.phase || 'Unknown'
    const colorMap: Record<string, string> = {
      'Available': 'green',
      'Bound': 'blue',
      'Released': 'yellow',
      'Failed': 'red',
    }
    return { status: phase, color: colorMap[phase] || 'gray' }
  }

  // Action handlers
  const handleEditClick = (pv: PersistentVolumeData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPV(pv)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (pv: PersistentVolumeData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPV(pv)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedPV) return
    try {
      await api.delete(`/clusters/${selectedPV.clusterName}/persistentvolumes/${selectedPV.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Persistent volume deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedPV(null)
      await queryClient.invalidateQueries({ queryKey: ['persistentvolumes'] })
      await queryClient.invalidateQueries({ queryKey: ['all-persistentvolumes'] })
      await queryClient.refetchQueries({ queryKey: ['persistentvolumes'] })
      await queryClient.refetchQueries({ queryKey: ['all-persistentvolumes'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete persistent volume: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<PersistentVolumeData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (pv) => (
        <div className="flex items-center gap-2">
          <CircleStackIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${pv.clusterName}/persistentvolumes/${pv.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {pv.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {pv.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (pv) => pv.metadata.name,
      searchValue: (pv) => `${pv.metadata.name} ${pv.clusterName}`,
    },
    {
      key: 'capacity',
      header: 'Capacity',
      accessor: (pv) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">
          {pv.spec?.capacity?.storage || '-'}
        </span>
      ),
      sortable: true,
      sortValue: (pv) => pv.spec?.capacity?.storage || '',
      searchValue: (pv) => pv.spec?.capacity?.storage || '',
    },
    {
      key: 'accessModes',
      header: 'Access Modes',
      accessor: (pv) => (
        <div className="flex flex-wrap gap-1">
          {pv.spec?.accessModes?.map((mode, idx) => (
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
      searchValue: (pv) => pv.spec?.accessModes?.join(', ') || '',
    },
    {
      key: 'reclaimPolicy',
      header: 'Reclaim Policy',
      accessor: (pv) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {pv.spec?.persistentVolumeReclaimPolicy || '-'}
        </span>
      ),
      sortable: true,
      sortValue: (pv) => pv.spec?.persistentVolumeReclaimPolicy || '',
      searchValue: (pv) => pv.spec?.persistentVolumeReclaimPolicy || '',
      filterable: true,
      filterOptions: (data) => {
        const policies = new Set(data.map(p => p.spec?.persistentVolumeReclaimPolicy || '-'))
        return Array.from(policies).sort()
      },
      filterValue: (pv) => pv.spec?.persistentVolumeReclaimPolicy || '-',
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (pv) => {
        const pvStatus = getPVStatus(pv)
        const colorClasses = {
          green: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
          yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
          red: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
          gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
        }
        
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
            colorClasses[pvStatus.color as keyof typeof colorClasses]
          )}>
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full',
              pvStatus.color === 'green' ? 'bg-green-600' :
              pvStatus.color === 'blue' ? 'bg-blue-600' :
              pvStatus.color === 'yellow' ? 'bg-yellow-600' :
              pvStatus.color === 'red' ? 'bg-red-600' :
              'bg-gray-600'
            )} />
            {pvStatus.status}
          </span>
        )
      },
      sortable: true,
      sortValue: (pv) => getPVStatus(pv).status,
      searchValue: (pv) => getPVStatus(pv).status,
      filterable: true,
      filterOptions: (data) => {
        const statuses = new Set(data.map(p => getPVStatus(p).status))
        return Array.from(statuses).sort()
      },
      filterValue: (pv) => getPVStatus(pv).status,
    },
    {
      key: 'claim',
      header: 'Claim',
      accessor: (pv) => {
        const claim = pv.spec?.claimRef
        if (!claim) return <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
        return (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {claim.namespace}/{claim.name}
          </span>
        )
      },
      sortable: false,
      searchValue: (pv) => {
        const claim = pv.spec?.claimRef
        return claim ? `${claim.namespace}/${claim.name}` : ''
      },
    },
    {
      key: 'storageClass',
      header: 'Storage Class',
      accessor: (pv) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {pv.spec?.storageClassName || '-'}
        </span>
      ),
      sortable: true,
      sortValue: (pv) => pv.spec?.storageClassName || '',
      searchValue: (pv) => pv.spec?.storageClassName || '',
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (pv) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(pv.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (pv) => new Date(pv.metadata.creationTimestamp).getTime(),
      searchValue: (pv) => formatAge(pv.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (pv) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${pv.clusterName}/persistentvolumes/${pv.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(pv, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(pv, e)}
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
          { name: 'Persistent Volumes' }
        ]}
      />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
          Persistent Volumes
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {cluster 
            ? `Persistent volumes in ${cluster}`
            : `All persistent volumes across ${clusters?.length || 0} cluster(s)`
          }
        </p>
      </div>
      
      <DataTable
        data={allPVs || []}
        columns={columns}
        keyExtractor={(pv) => `${pv.clusterName}-${pv.metadata.name}`}
        searchPlaceholder="Search persistent volumes by name, cluster, claim..."
        isLoading={isLoading}
        emptyMessage="No persistent volumes found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <CircleStackIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(pv) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <CircleStackIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${pv.clusterName}/persistentvolumes/${pv.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {pv.metadata.name}
                  </button>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {pv.clusterName}
                    </div>
                  )}
                </div>
              </div>
              <span className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full shrink-0',
                getPVStatus(pv).color === 'green'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : getPVStatus(pv).color === 'blue'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                  : getPVStatus(pv).color === 'yellow'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                  : getPVStatus(pv).color === 'red'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
              )}>
                {getPVStatus(pv).status}
              </span>
            </div>
            
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Capacity:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono">{pv.spec?.capacity?.storage || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Reclaim Policy:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{pv.spec?.persistentVolumeReclaimPolicy || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Storage Class:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{pv.spec?.storageClassName || '-'}</span>
              </div>
              {pv.spec?.claimRef && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Claim:</span>
                  <span className="ml-1 text-gray-900 dark:text-white">{pv.spec.claimRef.namespace}/{pv.spec.claimRef.name}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(pv.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${pv.clusterName}/persistentvolumes/${pv.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(pv, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(pv, e)}
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
      {selectedPV && (
        <>
          <EditPVYAMLModal
            pv={selectedPV}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedPV(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['persistentvolumes'] })
              await queryClient.invalidateQueries({ queryKey: ['all-persistentvolumes'] })
              await queryClient.refetchQueries({ queryKey: ['persistentvolumes'] })
              await queryClient.refetchQueries({ queryKey: ['all-persistentvolumes'] })
              setIsEditModalOpen(false)
              setSelectedPV(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedPV(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete Persistent Volume"
            message={`Are you sure you want to delete persistent volume "${selectedPV.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
