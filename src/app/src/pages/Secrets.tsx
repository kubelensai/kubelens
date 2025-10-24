import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { getClusters, getSecrets } from '@/services/api'
import { useMemo, useState, useEffect } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, KeyIcon, PlusIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import SecretDetailsModal from '@/components/Secrets/SecretDetailsModal'
import EditSecretYAMLModal from '@/components/Secrets/EditSecretYAMLModal'
import DeleteSecretModal from '@/components/Secrets/DeleteSecretModal'
import CreateSecretModal from '@/components/Secrets/CreateSecretModal'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

export default function Secrets() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')
  const [selectedSecret, setSelectedSecret] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditYAMLModalOpen, setIsEditYAMLModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createNamespace, setCreateNamespace] = useState(namespace || 'default')

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    namespace: 150,
    type: 150,
    keys: 120,
    age: 120,
    actions: 150,
  }, 'secrets-column-widths')
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch secrets from all clusters or specific cluster/namespace
  const secretQueries = useQuery({
    queryKey: namespace 
      ? ['secrets', cluster, namespace]
      : cluster 
        ? ['secrets', cluster] 
        : ['all-secrets', clusters?.map(c => c.name)],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const secrets = await getSecrets(cluster, namespace)
        return secrets.map((secret: any) => ({ ...secret, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const secrets = await getSecrets(cluster)
        return secrets.map((secret: any) => ({ ...secret, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allSecrets = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const secrets = await getSecrets(cluster.name)
            return secrets.map((secret: any) => ({ ...secret, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching secrets from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allSecrets.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
  })

  const isLoading = secretQueries.isLoading
  const allSecrets = secretQueries.data || []

  // Filter secrets by name
  const filteredSecrets = useMemo(() => {
    if (!filterText) return allSecrets
    const lowerFilter = filterText.toLowerCase()
    return allSecrets.filter((secret: any) => {
      // Filter by name or type
      if (secret.metadata?.name?.toLowerCase().includes(lowerFilter)) return true
      if (secret.type?.toLowerCase().includes(lowerFilter)) return true
      return false
    })
  }, [allSecrets, filterText])

  // Apply sorting
  const { sortedData: sortedSecrets, sortConfig, requestSort } = useTableSort(filteredSecrets, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: secrets,
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    changePageSize,
    hasNextPage,
    hasPreviousPage,
  } = usePagination(sortedSecrets, 10, 'secrets')

  // Auto-open secret details from query parameter (e.g., when navigating from ServiceAccount)
  useEffect(() => {
    const openSecretName = searchParams.get('open')
    if (openSecretName && allSecrets.length > 0) {
      const secretToOpen = allSecrets.find((s: any) => s.metadata?.name === openSecretName)
      if (secretToOpen) {
        setSelectedSecret(secretToOpen)
        setIsDetailsModalOpen(true)
        // Remove the query parameter
        searchParams.delete('open')
        setSearchParams(searchParams, { replace: true })
      }
    }
  }, [allSecrets, searchParams, setSearchParams])

  // Helper functions
  const getDataKeysCount = (secret: any) => {
    if (!secret.data) return 0
    return Object.keys(secret.data).length
  }

  const getSecretTypeDisplay = (type: string) => {
    const typeMap: Record<string, { label: string; color: string }> = {
      'kubernetes.io/tls': { label: 'TLS', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
      'kubernetes.io/dockerconfigjson': { label: 'Docker', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
      'kubernetes.io/service-account-token': { label: 'Service Account', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
      'kubernetes.io/basic-auth': { label: 'Basic Auth', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
      'kubernetes.io/ssh-auth': { label: 'SSH', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
      'Opaque': { label: 'Opaque', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
    }
    return typeMap[type] || { label: type, color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' }
  }

  // Action handlers
  const handleRowClick = (secret: any) => {
    setSelectedSecret(secret)
    setIsDetailsModalOpen(true)
  }

  const handleEditYAMLClick = (secret: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedSecret(secret)
    setIsEditYAMLModalOpen(true)
  }

  const handleDeleteClick = (secret: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedSecret(secret)
    setIsDeleteModalOpen(true)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Breadcrumb 
              items={
                cluster
                  ? [
                      { name: cluster, href: "/dashboard" },
                      { name: 'Secrets' }
                    ]
                  : [{ name: 'Secrets' }]
              }
        />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Secrets</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            All secrets across {clusters?.length || 0} cluster(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name or type..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-11 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          {cluster && (
            <button
              onClick={() => {
                setCreateNamespace(namespace || 'default')
                setIsCreateModalOpen(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors whitespace-nowrap"
            >
              <PlusIcon className="h-5 w-5" />
              Create
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <ResizableTableHeader
                  label="Name"
                  columnKey="name"
                  sortKey="metadata.name"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.name}
                />
                <ResizableTableHeader
                  label="Namespace"
                  columnKey="namespace"
                  sortKey="metadata.namespace"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.namespace}
                />
                <ResizableTableHeader
                  label="Type"
                  columnKey="type"
                  sortKey="type"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.type}
                />
                <ResizableTableHeader
                  label="Data Keys"
                  columnKey="keys"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.keys}
                />
                <ResizableTableHeader
                  label="Age"
                  columnKey="age"
                  sortKey="metadata.creationTimestamp"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.age}
                />
                <ResizableTableHeader
                  label="Actions"
                  columnKey="actions"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.actions}
                  align="right"
                />
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading secrets...</span>
                    </div>
                  </td>
                </tr>
              ) : secrets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No secrets found</p>
                  </td>
                </tr>
              ) : (
                secrets.map((secret) => {
                  const secretType = getSecretTypeDisplay(secret.type)
                  return (
                    <tr 
                      key={`${secret.clusterName}-${secret.metadata.namespace}-${secret.metadata.name}`} 
                      onClick={() => handleRowClick(secret)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    >
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <KeyIcon className="h-4 w-4 text-gray-400" />
                          <div className="truncate max-w-[150px] sm:max-w-none">
                            {secret.metadata.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {secret.metadata.namespace}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                        <span className={clsx('inline-flex items-center px-2 py-1 rounded text-xs font-medium', secretType.color)}>
                          {secretType.label}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center">
                        {getDataKeysCount(secret)} keys
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {formatAge(secret.metadata.creationTimestamp)}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleEditYAMLClick(secret, e)}
                            className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                            title="Edit YAML"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(secret, e)}
                            className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete secret"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={goToPage}
          onPageSizeChange={changePageSize}
          onNextPage={goToNextPage}
          onPreviousPage={goToPreviousPage}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
        />
      </div>

      {/* Secret Modals */}
      {selectedSecret && (
        <>
          <SecretDetailsModal
            secret={selectedSecret}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedSecret(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['secrets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-secrets'] })
              await queryClient.refetchQueries({ queryKey: ['secrets'] })
              await queryClient.refetchQueries({ queryKey: ['all-secrets'] })
            }}
          />
          <EditSecretYAMLModal
            secret={selectedSecret}
            isOpen={isEditYAMLModalOpen}
            onClose={() => {
              setIsEditYAMLModalOpen(false)
              setSelectedSecret(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['secrets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-secrets'] })
              await queryClient.refetchQueries({ queryKey: ['secrets'] })
              await queryClient.refetchQueries({ queryKey: ['all-secrets'] })
              setIsEditYAMLModalOpen(false)
              setSelectedSecret(null)
            }}
          />
          <DeleteSecretModal
            secret={selectedSecret}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedSecret(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['secrets'] })
              await queryClient.invalidateQueries({ queryKey: ['all-secrets'] })
              await queryClient.refetchQueries({ queryKey: ['secrets'] })
              await queryClient.refetchQueries({ queryKey: ['all-secrets'] })
              setIsDeleteModalOpen(false)
              setSelectedSecret(null)
            }}
          />
        </>
      )}
      
      {/* Create Secret Modal - separate from selectedSecret condition */}
      {cluster && createNamespace && (
        <CreateSecretModal
          clusterName={cluster}
          namespace={createNamespace}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={async () => {
            await queryClient.invalidateQueries({ queryKey: ['secrets'] })
            await queryClient.invalidateQueries({ queryKey: ['all-secrets'] })
            await queryClient.refetchQueries({ queryKey: ['secrets'] })
            await queryClient.refetchQueries({ queryKey: ['all-secrets'] })
            setIsCreateModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

