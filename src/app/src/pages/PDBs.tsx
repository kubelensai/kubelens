import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getPDBs } from '@/services/api'
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
import CreatePDBModal from '@/components/PDBs/CreatePDBModal'
import EditPDBYAMLModal from '@/components/PDBs/EditPDBYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'
import clsx from 'clsx'

interface PDBData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec: {
    minAvailable?: number | string
    maxUnavailable?: number | string
    selector?: {
      matchLabels?: Record<string, string>
      matchExpressions?: Array<any>
    }
    unhealthyPodEvictionPolicy?: string
  }
  status?: {
    currentHealthy?: number
    desiredHealthy?: number
    disruptionsAllowed?: number
    expectedPods?: number
    observedGeneration?: number
    conditions?: Array<{
      type: string
      status: string
      reason?: string
      message?: string
      lastTransitionTime?: string
    }>
  }
  clusterName: string
}

export default function PDBs() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedPDB, setSelectedPDB] = useState<PDBData | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch PDBs from all clusters or specific cluster/namespace
  const { data: allPDBs, isLoading } = useQuery({
    queryKey: namespace 
      ? ['pdbs', cluster, namespace]
      : cluster 
        ? ['pdbs', cluster, 'all'] 
        : ['all-pdbs', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const pdbs = await getPDBs(cluster, namespace)
        return pdbs.map((pdb: any) => ({ ...pdb, clusterName: cluster }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const pdbs = await getPDBs(cluster, 'all')
        return pdbs.map((pdb: any) => ({ ...pdb, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allPDBs = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const pdbs = await getPDBs(cluster.name, 'all')
            return pdbs.map((pdb: any) => ({ ...pdb, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching PDBs from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allPDBs.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper functions
  const getMinAvailable = (pdb: PDBData): string => {
    if (pdb.spec?.minAvailable !== undefined) {
      return String(pdb.spec.minAvailable)
    }
    return '-'
  }

  const getMaxUnavailable = (pdb: PDBData): string => {
    if (pdb.spec?.maxUnavailable !== undefined) {
      return String(pdb.spec.maxUnavailable)
    }
    return '-'
  }

  const getHealthStatus = (pdb: PDBData) => {
    const current = pdb.status?.currentHealthy || 0
    const desired = pdb.status?.desiredHealthy || 0
    const allowed = pdb.status?.disruptionsAllowed || 0
    
    if (current >= desired && allowed > 0) {
      return { label: 'Healthy', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' }
    } else if (current < desired) {
      return { label: 'Unhealthy', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' }
    } else if (allowed === 0) {
      return { label: 'At Risk', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' }
    }
    return { label: 'Unknown', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400' }
  }

  // Action handlers
  const handleEditClick = (pdb: PDBData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPDB(pdb)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (pdb: PDBData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedPDB(pdb)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedPDB) return
    try {
      await api.delete(`/clusters/${selectedPDB.clusterName}/namespaces/${selectedPDB.metadata.namespace}/pdbs/${selectedPDB.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'PDB deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedPDB(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['pdbs'] })
      await queryClient.invalidateQueries({ queryKey: ['all-pdbs'] })
      await queryClient.refetchQueries({ queryKey: ['pdbs'] })
      await queryClient.refetchQueries({ queryKey: ['all-pdbs'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete PDB: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<PDBData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (pdb) => (
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${pdb.clusterName}/namespaces/${pdb.metadata.namespace}/pdbs/${pdb.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {pdb.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {pdb.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (pdb) => pdb.metadata.name,
      searchValue: (pdb) => `${pdb.metadata.name} ${pdb.clusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (pdb) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {pdb.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (pdb) => pdb.metadata.namespace,
      searchValue: (pdb) => pdb.metadata.namespace,
    },
    {
      key: 'minAvailable',
      header: 'Min Available',
      accessor: (pdb) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {getMinAvailable(pdb)}
        </span>
      ),
      sortable: true,
      sortValue: (pdb) => pdb.spec?.minAvailable || 0,
      searchValue: (pdb) => getMinAvailable(pdb),
    },
    {
      key: 'maxUnavailable',
      header: 'Max Unavailable',
      accessor: (pdb) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {getMaxUnavailable(pdb)}
        </span>
      ),
      sortable: true,
      sortValue: (pdb) => pdb.spec?.maxUnavailable || 0,
      searchValue: (pdb) => getMaxUnavailable(pdb),
    },
    {
      key: 'healthy',
      header: 'Current/Desired',
      accessor: (pdb) => (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">{pdb.status?.currentHealthy || 0}</span>
          <span className="text-gray-500 dark:text-gray-400">
            {' '}/ {pdb.status?.desiredHealthy || 0}
          </span>
        </div>
      ),
      sortable: true,
      sortValue: (pdb) => pdb.status?.currentHealthy || 0,
      searchValue: (pdb) => `${pdb.status?.currentHealthy || 0} ${pdb.status?.desiredHealthy || 0}`,
    },
    {
      key: 'disruptions',
      header: 'Disruptions Allowed',
      accessor: (pdb) => (
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {pdb.status?.disruptionsAllowed !== undefined ? pdb.status.disruptionsAllowed : '-'}
        </span>
      ),
      sortable: true,
      sortValue: (pdb) => pdb.status?.disruptionsAllowed || 0,
      searchValue: (pdb) => String(pdb.status?.disruptionsAllowed || 0),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (pdb) => {
        const status = getHealthStatus(pdb)
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
            status.color
          )}>
            {status.label}
          </span>
        )
      },
      sortable: true,
      sortValue: (pdb) => getHealthStatus(pdb).label,
      searchValue: (pdb) => getHealthStatus(pdb).label,
      filterable: true,
      filterOptions: () => ['Healthy', 'Unhealthy', 'At Risk', 'Unknown'],
      filterValue: (pdb) => getHealthStatus(pdb).label,
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (pdb) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(pdb.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (pdb) => new Date(pdb.metadata.creationTimestamp).getTime(),
      searchValue: (pdb) => formatAge(pdb.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (pdb) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${pdb.clusterName}/namespaces/${pdb.metadata.namespace}/pdbs/${pdb.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(pdb, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(pdb, e)}
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
          { name: 'PDBs' }
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            Pod Disruption Budgets
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {namespace 
              ? `PDBs in ${cluster} / ${namespace}`
              : cluster 
                ? `All PDBs in ${cluster}`
                : `All PDBs across ${clusters?.length || 0} cluster(s)`
            }
          </p>
        </div>
        {cluster && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Create PDB</span>
            <span className="sm:hidden">Create</span>
          </button>
        )}
      </div>
      
      <DataTable
        data={allPDBs || []}
        columns={columns}
        keyExtractor={(pdb: PDBData) => `${pdb.clusterName}-${pdb.metadata.namespace}-${pdb.metadata.name}`}
        searchPlaceholder="Search PDBs by name, cluster, namespace..."
        isLoading={isLoading}
        emptyMessage="No PDBs found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <ShieldCheckIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(pdb) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <ShieldCheckIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${pdb.clusterName}/namespaces/${pdb.metadata.namespace}/pdbs/${pdb.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {pdb.metadata.name}
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {pdb.metadata.namespace}
                  </div>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {pdb.clusterName}
                    </div>
                  )}
                </div>
              </div>
              <span className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full shrink-0',
                getHealthStatus(pdb).color
              )}>
                {getHealthStatus(pdb).label}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Min Available:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-medium">
                  {getMinAvailable(pdb)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Max Unavailable:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-medium">
                  {getMaxUnavailable(pdb)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Current/Desired:</span>
                <span className="ml-1 text-gray-900 dark:text-white">
                  {pdb.status?.currentHealthy || 0} / {pdb.status?.desiredHealthy || 0}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Disruptions:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-medium">
                  {pdb.status?.disruptionsAllowed !== undefined ? pdb.status.disruptionsAllowed : '-'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(pdb.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${pdb.clusterName}/namespaces/${pdb.metadata.namespace}/pdbs/${pdb.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(pdb, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(pdb, e)}
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
      {cluster && (
        <CreatePDBModal
          clusterName={cluster}
          namespace={namespace || 'default'}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={async () => {
            await queryClient.invalidateQueries({ queryKey: ['pdbs'] })
            await queryClient.invalidateQueries({ queryKey: ['all-pdbs'] })
            await queryClient.refetchQueries({ queryKey: ['pdbs'] })
            await queryClient.refetchQueries({ queryKey: ['all-pdbs'] })
            setIsCreateModalOpen(false)
          }}
        />
      )}
      
      {selectedPDB && (
        <>
          <EditPDBYAMLModal
            pdb={selectedPDB}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedPDB(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['pdbs'] })
              await queryClient.invalidateQueries({ queryKey: ['all-pdbs'] })
              await queryClient.refetchQueries({ queryKey: ['pdbs'] })
              await queryClient.refetchQueries({ queryKey: ['all-pdbs'] })
              setIsEditModalOpen(false)
              setSelectedPDB(null)
            }}
          />
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedPDB(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete PDB"
            message={`Are you sure you want to delete PDB "${selectedPDB.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
