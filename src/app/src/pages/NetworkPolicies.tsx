import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getNetworkPolicies } from '@/services/api'
import { useMemo, useState, useEffect } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import NetworkPolicyDetailsModal from '@/components/NetworkPolicies/NetworkPolicyDetailsModal'
import EditNetworkPolicyYAMLModal from '@/components/NetworkPolicies/EditNetworkPolicyYAMLModal'
import DeleteNetworkPolicyModal from '@/components/NetworkPolicies/DeleteNetworkPolicyModal'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'
import { useClusterStore } from '@/stores/clusterStore'
import { useNamespaceStore } from '@/stores/namespaceStore'

interface NetworkPolicy {
  clusterName: string
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
    uid: string
  }
  spec: {
    podSelector: any
    policyTypes: string[]
    ingress?: any[]
    egress?: any[]
  }
}

export default function NetworkPolicies() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const queryClient = useQueryClient()
  const { selectedCluster } = useClusterStore()
  const { selectedNamespace } = useNamespaceStore()
  const [filterText, setFilterText] = useState('')
  const [selectedNetworkPolicy, setSelectedNetworkPolicy] = useState<NetworkPolicy | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditYAMLModalOpen, setIsEditYAMLModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const currentCluster = cluster || selectedCluster
  const currentNamespace = namespace || selectedNamespace

  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    namespace: 150,
    podSelector: 200,
    policyTypes: 150,
    age: 120,
    actions: 150,
  }, 'networkpolicies-column-widths')

  // Reset state when cluster or namespace changes
  useEffect(() => {
    setSelectedNetworkPolicy(null)
    setIsDetailsModalOpen(false)
    setIsEditYAMLModalOpen(false)
    setIsDeleteModalOpen(false)
  }, [currentCluster, currentNamespace])
  
  // Fetch clusters first
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Build queries array
  const networkPolicyQueries = useMemo(() => {
    if (!clusters) return []

    if (currentCluster) {
      return [
        {
          queryKey: ['networkpolicies', currentCluster, currentNamespace || 'all'],
          queryFn: () => getNetworkPolicies(currentCluster, currentNamespace || 'all'),
          refetchInterval: 5000,
        },
      ]
    }

    return clusters.map((c: any) => ({
      queryKey: ['networkpolicies', c.name, currentNamespace || 'all'],
      queryFn: () => getNetworkPolicies(c.name, currentNamespace || 'all'),
      refetchInterval: 5000,
    }))
  }, [clusters, currentCluster, currentNamespace])

  // Use useQueries (NOT .map with useQuery!)
  const networkPolicyResults = useQueries({ queries: networkPolicyQueries })
  const isLoading = networkPolicyResults.some((result) => result.isLoading)

  // Flatten results from all clusters
  const allNetworkPolicies: any[] = useMemo(() => {
    return networkPolicyResults.flatMap((result: any) => result.data || [])
  }, [networkPolicyResults])

  // Filter network policies
  const filteredNetworkPolicies = useMemo(() => {
    return allNetworkPolicies.filter((np: NetworkPolicy) => {
      const searchText = filterText.toLowerCase()
      const name = np.metadata?.name?.toLowerCase() || ''
      const ns = np.metadata?.namespace?.toLowerCase() || ''
      const policyTypes = (np.spec?.policyTypes || []).join(' ').toLowerCase()

      return name.includes(searchText) || ns.includes(searchText) || policyTypes.includes(searchText)
    })
  }, [allNetworkPolicies, filterText])

  // Apply sorting
  const { sortedData: sortedNetworkPolicies, sortConfig, requestSort } = useTableSort(filteredNetworkPolicies, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: networkPolicies,
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
  } = usePagination(sortedNetworkPolicies, 10, 'networkpolicies')

  // Helper functions
  const getPodSelectorDisplay = (podSelector: any) => {
    if (!podSelector) return 'All pods'
    if (Object.keys(podSelector.matchLabels || {}).length === 0 && 
        !podSelector.matchExpressions?.length) {
      return 'All pods'
    }
    const labels = Object.entries(podSelector.matchLabels || {})
      .map(([key, value]) => `${key}=${value}`)
      .join(', ')
    return labels || 'With expressions'
  }

  const getPolicyTypesDisplay = (policyTypes: string[]) => {
    if (!policyTypes || policyTypes.length === 0) return '-'
    return policyTypes.join(', ')
  }

  // Action handlers
  const handleRowClick = (networkPolicy: NetworkPolicy) => {
    setSelectedNetworkPolicy(networkPolicy)
    setIsDetailsModalOpen(true)
  }

  const handleEditYAMLClick = (networkPolicy: NetworkPolicy, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedNetworkPolicy(networkPolicy)
    setIsEditYAMLModalOpen(true)
  }

  const handleDeleteClick = (networkPolicy: NetworkPolicy, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedNetworkPolicy(networkPolicy)
    setIsDeleteModalOpen(true)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <div>
        <Breadcrumb 
          items={
            currentCluster
              ? [
                  { name: currentCluster, href: `/clusters/${currentCluster}/overview` },
                  { name: 'Network Policies' }
                ]
              : [{ name: 'Network Policies' }]
          }
        />
      </div>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Network Policies</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            All network policies across {clusters?.length || 0} cluster(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name, namespace..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-11 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Table */}
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
                  width={columnWidths.name}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Namespace"
                  columnKey="namespace"
                  sortKey="metadata.namespace"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.namespace}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Pod Selector"
                  columnKey="podSelector"
                  sortKey="spec.podSelector"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.podSelector}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Policy Types"
                  columnKey="policyTypes"
                  sortKey="spec.policyTypes"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.policyTypes}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Age"
                  columnKey="age"
                  sortKey="metadata.creationTimestamp"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.age}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Actions"
                  columnKey="actions"
                  sortKey=""
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.actions}
                  onResizeStart={handleResizeStart}
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
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading network policies...</span>
                    </div>
                  </td>
                </tr>
              ) : networkPolicies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                      {filterText ? 'No network policies found matching your filter' : 'No network policies found'}
                    </p>
                  </td>
                </tr>
              ) : (
                networkPolicies.map((np: NetworkPolicy) => (
                  <tr
                    key={`${np.clusterName}-${np.metadata?.namespace}-${np.metadata?.name}`}
                    onClick={() => handleRowClick(np)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  >
                    <td
                      className="px-2 sm:px-4 py-3 text-sm font-medium text-gray-900 dark:text-white truncate"
                      style={{ width: columnWidths.name, maxWidth: columnWidths.name }}
                    >
                      {np.metadata?.name}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.namespace, maxWidth: columnWidths.namespace }}
                    >
                      {np.metadata?.namespace}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.podSelector, maxWidth: columnWidths.podSelector }}
                      title={getPodSelectorDisplay(np.spec?.podSelector)}
                    >
                      {getPodSelectorDisplay(np.spec?.podSelector)}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.policyTypes, maxWidth: columnWidths.policyTypes }}
                    >
                      {getPolicyTypesDisplay(np.spec?.policyTypes)}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.age, maxWidth: columnWidths.age }}
                    >
                      {formatAge(np.metadata?.creationTimestamp)}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-right text-sm font-medium"
                      style={{ width: columnWidths.actions, maxWidth: columnWidths.actions }}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleEditYAMLClick(np, e)}
                          className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(np, e)}
                          className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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

      {/* Modals */}
      {selectedNetworkPolicy && (
        <>
          <NetworkPolicyDetailsModal
            networkPolicy={selectedNetworkPolicy}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedNetworkPolicy(null)
            }}
          />
          <EditNetworkPolicyYAMLModal
            networkPolicy={selectedNetworkPolicy}
            isOpen={isEditYAMLModalOpen}
            onClose={() => {
              setIsEditYAMLModalOpen(false)
              setSelectedNetworkPolicy(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['networkpolicies'] })
              await queryClient.refetchQueries({ queryKey: ['networkpolicies'] })
              setIsEditYAMLModalOpen(false)
              setSelectedNetworkPolicy(null)
            }}
          />
          <DeleteNetworkPolicyModal
            networkPolicy={selectedNetworkPolicy}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedNetworkPolicy(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['networkpolicies'] })
              await queryClient.refetchQueries({ queryKey: ['networkpolicies'] })
              setIsDeleteModalOpen(false)
              setSelectedNetworkPolicy(null)
            }}
          />
        </>
      )}
    </div>
  )
}

