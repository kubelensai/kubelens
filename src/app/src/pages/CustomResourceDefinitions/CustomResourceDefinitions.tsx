import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getCustomResourceDefinitions } from '@/services/api'
import { useMemo, useState } from 'react'
import { CubeIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import EditCRDYAMLModal from '@/components/CustomResourceDefinitions/EditCRDYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import { formatAge } from '@/utils/format'
import api from '@/services/api'

export default function CustomResourceDefinitions() {
  const { cluster } = useParams<{ cluster?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedCRD, setSelectedCRD] = useState<any>(null)

  const { data: clusters = [] } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch CRDs for all clusters or specific cluster
  const crdQueries = useMemo(() => {
    if (!clusters) return []

    if (cluster) {
      return [
        {
          queryKey: ['customresourcedefinitions', cluster],
          queryFn: () => getCustomResourceDefinitions(cluster),
          refetchInterval: 5000,
        },
      ]
    }

    return clusters.map((c: any) => ({
      queryKey: ['customresourcedefinitions', c.name],
      queryFn: () => getCustomResourceDefinitions(c.name),
      refetchInterval: 5000,
    }))
  }, [clusters, cluster])

  const crdResults = useQueries({ queries: crdQueries })
  const isLoading = crdResults.some((result) => result.isLoading)

  const allCRDs = useMemo(() => {
    return crdResults.flatMap((result) => result.data || [])
  }, [crdResults])

  const handleDeleteCRD = async () => {
    if (!selectedCRD) return
    
    try {
      await api.delete(
        `/clusters/${selectedCRD.ClusterName}/customresourcedefinitions/${selectedCRD.metadata.name}`
      )
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Custom resource definition deleted successfully',
      })
      queryClient.invalidateQueries({ queryKey: ['customresourcedefinitions'] })
      setIsDeleteModalOpen(false)
      setSelectedCRD(null)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete custom resource definition: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const columns = useMemo<Column<any>[]>(() => [
    {
      key: 'resource',
      header: 'Resource',
      accessor: (crd) => (
        <button
          onClick={() => navigate(`/clusters/${crd.ClusterName}/customresourcedefinitions/${crd.metadata.name}`)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-left"
        >
          {crd.resource || crd.spec?.names?.plural || '-'}
        </button>
      ),
      sortable: true,
      sortValue: (crd) => crd.resource || crd.spec?.names?.plural || '',
      searchValue: (crd) => crd.resource || crd.spec?.names?.plural || '',
    },
    {
      key: 'group',
      header: 'Group',
      accessor: (crd) => {
        const group = crd.group || crd.spec?.group || ''
        const version = crd.version || ''
        const resource = crd.resource || crd.spec?.names?.plural || ''
        
        return (
          <button
            onClick={() => navigate(`/clusters/${crd.ClusterName}/customresources/${group}/${version}/${resource}`)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm text-left"
          >
            {group || '-'}
          </button>
        )
      },
      sortable: true,
      sortValue: (crd) => crd.group || crd.spec?.group || '',
      searchValue: (crd) => crd.group || crd.spec?.group || '',
      filterable: true,
      filterOptions: (data) => Array.from(new Set(data.map(crd => crd.group || crd.spec?.group || '-'))).sort(),
      filterValue: (crd) => crd.group || crd.spec?.group || '-',
    },
    {
      key: 'version',
      header: 'Version',
      accessor: (crd) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {crd.version || '-'}
        </span>
      ),
      sortable: true,
      sortValue: (crd) => crd.version || '',
      searchValue: (crd) => crd.version || '',
    },
    {
      key: 'scope',
      header: 'Scope',
      accessor: (crd) => {
        const scope = crd.scope || crd.spec?.scope || '-'
        return (
          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
            scope === 'Namespaced' 
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
              : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
          }`}>
            {scope}
          </span>
        )
      },
      sortable: true,
      sortValue: (crd) => crd.scope || crd.spec?.scope || '',
      searchValue: (crd) => crd.scope || crd.spec?.scope || '',
    },
    {
      key: 'cluster',
      header: 'Cluster',
      accessor: (crd) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {crd.ClusterName}
        </span>
      ),
      sortable: true,
      sortValue: (crd) => crd.ClusterName,
      searchValue: (crd) => crd.ClusterName,
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (crd) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(crd.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (crd) => new Date(crd.metadata.creationTimestamp).getTime(),
      searchValue: (crd) => formatAge(crd.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (crd) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedCRD(crd)
              setIsEditModalOpen(true)
            }}
            className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedCRD(crd)
              setIsDeleteModalOpen(true)
            }}
            className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
      sortable: false,
    },
  ], [navigate, allCRDs])

  const mobileCardRenderer = (crd: any) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <CubeIcon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <button
              onClick={() => navigate(`/clusters/${crd.ClusterName}/customresourcedefinitions/${crd.metadata.name}`)}
              className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-left truncate block w-full"
            >
              {crd.resource || crd.spec?.names?.plural || '-'}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {crd.ClusterName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedCRD(crd)
              setIsEditModalOpen(true)
            }}
            className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedCRD(crd)
              setIsDeleteModalOpen(true)
            }}
            className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Group:</span>
          <button
            onClick={() => {
              const group = crd.group || crd.spec?.group || ''
              const version = crd.version || ''
              const resource = crd.resource || crd.spec?.names?.plural || ''
              navigate(`/clusters/${crd.ClusterName}/customresources/${group}/${version}/${resource}`)
            }}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 truncate block"
          >
            {crd.group || crd.spec?.group || '-'}
          </button>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Version:</span>
          <p className="text-gray-900 dark:text-white truncate">
            {crd.version || '-'}
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Scope:</span>
          <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
            (crd.scope || crd.spec?.scope) === 'Namespaced' 
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
              : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
          }`}>
            {crd.scope || crd.spec?.scope || '-'}
          </span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Age:</span>
          <p className="text-gray-900 dark:text-white">
            {formatAge(crd.metadata.creationTimestamp)}
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 md:space-y-6">
      <Breadcrumb
        items={
          cluster
            ? [
                { name: cluster },
                { name: 'Custom Resource Definitions' }
              ]
            : [{ name: 'Custom Resource Definitions' }]
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <CubeIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Custom Resource Definitions
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage custom resource definitions across {clusters?.length || 0} cluster(s)
            </p>
          </div>
        </div>
      </div>

      <DataTable
        data={allCRDs}
        columns={columns}
        keyExtractor={(crd) => `${crd.ClusterName}-${crd.metadata.name}`}
        searchPlaceholder="Search custom resource definitions..."
        isLoading={isLoading}
        emptyMessage="No custom resource definitions found"
        emptyIcon={<CubeIcon className="w-12 h-12 text-gray-400" />}
        mobileCardRenderer={mobileCardRenderer}
      />

      {selectedCRD && (
        <>
          <EditCRDYAMLModal
            crd={selectedCRD}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedCRD(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['customresourcedefinitions'] })
              addNotification({
                type: 'success',
                title: 'Success',
                message: 'Custom resource definition updated successfully',
              })
              setIsEditModalOpen(false)
              setSelectedCRD(null)
            }}
          />

          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedCRD(null)
            }}
            onConfirm={handleDeleteCRD}
            title="Delete Custom Resource Definition"
            message={`Are you sure you want to delete custom resource definition "${selectedCRD.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
