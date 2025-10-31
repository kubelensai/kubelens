import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getCustomResources, getClusters } from '@/services/api'
import { useMemo, useState } from 'react'
import { CubeIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import { formatAge } from '@/utils/format'
import { useClusterStore } from '@/stores/clusterStore'
import { useNamespaceStore } from '@/stores/namespaceStore'
import EditCustomResourceModal from '@/components/CustomResources/EditCustomResourceModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'

export default function GenericCRDPage() {
  const { cluster: clusterParam, namespace: namespaceParam, group, version, resource } = useParams<{
    cluster?: string
    namespace?: string
    group: string
    version: string
    resource: string
  }>()

  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { addNotification } = useNotificationStore()
  
  // Modal states
  const [selectedResource, setSelectedResource] = useState<any>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Global stores
  const { selectedCluster } = useClusterStore()
  const { selectedNamespace } = useNamespaceStore()

  // Fetch enabled clusters
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Determine active cluster: URL param > store > first enabled cluster
  const activeCluster = clusterParam || selectedCluster || (clusters && clusters.length > 0 ? clusters[0].name : null)
  const rawNamespace = namespaceParam || selectedNamespace
  // If namespace is 'all' or null, treat it as undefined to fetch all namespaces
  const activeNamespace = rawNamespace === 'all' || !rawNamespace ? undefined : rawNamespace

  // Fetch resources
  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['customresources', activeCluster, group, version, resource, activeNamespace],
    queryFn: () => getCustomResources(activeCluster!, group!, version!, resource!, activeNamespace),
    enabled: !!activeCluster && !!group && !!version && !!resource,
    refetchInterval: 5000,
  })

  const handleDeleteResource = async () => {
    if (!selectedResource) return
    
    try {
      const namespace = selectedResource.metadata?.namespace
      const name = selectedResource.metadata?.name
      
      if (namespace) {
        await api.delete(
          `/clusters/${activeCluster}/namespaces/${namespace}/customresources/${name}?group=${group}&version=${version}&resource=${resource}`
        )
      } else {
        await api.delete(
          `/clusters/${activeCluster}/customresources/${name}?group=${group}&version=${version}&resource=${resource}`
        )
      }
      
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Custom resource deleted successfully',
      })
      queryClient.invalidateQueries({ queryKey: ['customresources'] })
      setIsDeleteModalOpen(false)
      setSelectedResource(null)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete custom resource: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Get resource kind for display (capitalize first letter of singular form)
  const resourceKind = resource ? resource.charAt(0).toUpperCase() + resource.slice(1, -1) : 'Resource'

  const columns = useMemo<Column<any>[]>(() => {
    const cols: Column<any>[] = [
      {
        key: 'name',
        header: 'Name',
        accessor: (r) => {
          const name = r.metadata?.name || '-'
          const ns = r.metadata?.namespace
          
          return (
            <button
              onClick={() => {
                if (ns) {
                  navigate(`/clusters/${activeCluster}/namespaces/${ns}/customresources/${group}/${version}/${resource}/${name}`)
                } else {
                  navigate(`/clusters/${activeCluster}/customresources/${group}/${version}/${resource}/${name}`)
                }
              }}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-left"
            >
              {name}
            </button>
          )
        },
        sortable: true,
        sortValue: (r) => r.metadata?.name || '',
        searchValue: (r) => r.metadata?.name || '',
      },
    ]

    // Only show namespace column if we're viewing all namespaces
    if (activeNamespace === undefined) {
      cols.push({
        key: 'namespace',
        header: 'Namespace',
        accessor: (r) => {
          const ns = r.metadata?.namespace
          if (!ns) return <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
          
          return (
            <button
              onClick={() => navigate(`/clusters/${activeCluster}/namespaces/${ns}/customresources/${group}/${version}/${resource}`)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm text-left"
            >
              {ns}
            </button>
          )
        },
        sortable: true,
        sortValue: (r) => r.metadata?.namespace || '',
        searchValue: (r) => r.metadata?.namespace || '',
      })
    }

    cols.push(
      {
        key: 'kind',
        header: 'Kind',
        accessor: (r) => (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {r.kind || '-'}
          </span>
        ),
        sortable: true,
        sortValue: (r) => r.kind || '',
        searchValue: (r) => r.kind || '',
      },
      {
        key: 'apiVersion',
        header: 'API Version',
        accessor: (r) => (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {r.apiVersion || `${group}/${version}`}
          </span>
        ),
        sortable: true,
        sortValue: (r) => r.apiVersion || `${group}/${version}`,
        searchValue: (r) => r.apiVersion || `${group}/${version}`,
      },
      {
        key: 'age',
        header: 'Age',
        accessor: (r) => (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {formatAge(r.metadata?.creationTimestamp)}
          </span>
        ),
        sortable: true,
        sortValue: (r) => new Date(r.metadata?.creationTimestamp || 0).getTime(),
        searchValue: (r) => formatAge(r.metadata?.creationTimestamp),
      },
      {
        key: 'actions',
        header: 'Actions',
        accessor: (r) => (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedResource(r)
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
                setSelectedResource(r)
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
      }
    )

    return cols
  }, [activeNamespace, activeCluster, group, version, resource, navigate])

  const mobileCardRenderer = (r: any) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <CubeIcon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <button
              onClick={() => {
                const name = r.metadata?.name
                const ns = r.metadata?.namespace
                if (ns) {
                  navigate(`/clusters/${activeCluster}/namespaces/${ns}/customresources/${group}/${version}/${resource}/${name}`)
                } else {
                  navigate(`/clusters/${activeCluster}/customresources/${group}/${version}/${resource}/${name}`)
                }
              }}
              className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-left truncate block w-full"
            >
              {r.metadata?.name || '-'}
            </button>
            {activeNamespace === undefined && r.metadata?.namespace && (
              <button
                onClick={() => navigate(`/clusters/${activeCluster}/namespaces/${r.metadata.namespace}/customresources/${group}/${version}/${resource}`)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                {r.metadata.namespace}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedResource(r)
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
              setSelectedResource(r)
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
          <span className="text-gray-500 dark:text-gray-400">Kind:</span>
          <p className="text-gray-900 dark:text-white">
            {r.kind || '-'}
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">API Version:</span>
          <p className="text-gray-900 dark:text-white truncate">
            {r.apiVersion || `${group}/${version}`}
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Age:</span>
          <p className="text-gray-900 dark:text-white">
            {formatAge(r.metadata?.creationTimestamp)}
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 md:space-y-6">
      <Breadcrumb
        items={
          clusterParam
            ? namespaceParam
              ? [
                  { name: clusterParam, href: `/clusters/${clusterParam}` },
                  { name: namespaceParam, href: `/clusters/${clusterParam}/namespaces/${namespaceParam}` },
                  { name: resourceKind },
                ]
              : [{ name: clusterParam, href: `/clusters/${clusterParam}` }, { name: resourceKind }]
            : [{ name: resourceKind }]
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <CubeIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {resourceKind}s
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Custom resources from {group}/{version}
            </p>
          </div>
        </div>
      </div>

      <DataTable
        data={resources}
        columns={columns}
        keyExtractor={(r) => `${r.metadata?.namespace || 'cluster'}-${r.metadata?.name}`}
        searchPlaceholder="Search custom resources..."
        isLoading={isLoading}
        emptyMessage="No custom resources found"
        emptyIcon={<CubeIcon className="w-12 h-12 text-gray-400" />}
        mobileCardRenderer={mobileCardRenderer}
      />

      {selectedResource && (
        <>
          <EditCustomResourceModal
            resource={selectedResource}
            group={group!}
            version={version!}
            resourceType={resource!}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedResource(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['customresources'] })
              addNotification({
                type: 'success',
                title: 'Success',
                message: 'Custom resource updated successfully',
              })
              setIsEditModalOpen(false)
              setSelectedResource(null)
            }}
          />

          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedResource(null)
            }}
            onConfirm={handleDeleteResource}
            title="Delete Custom Resource"
            message={`Are you sure you want to delete custom resource "${selectedResource.metadata?.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
