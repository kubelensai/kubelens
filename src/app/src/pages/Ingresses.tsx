import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { MagnifyingGlassIcon, PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { getIngresses, getClusters } from '../services/api'
import { formatAge } from '@/utils/format'
import Breadcrumb from '../components/shared/Breadcrumb'
import { useClusterStore } from '../stores/clusterStore'
import { useNamespaceStore } from '../stores/namespaceStore'
import { useTableSort } from '../hooks/useTableSort'
import { useResizableColumns } from '../hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'
import ResizableTableHeader from '../components/shared/ResizableTableHeader'
import IngressDetailsModal from '../components/Ingresses/IngressDetailsModal'
import EditIngressYAMLModal from '../components/Ingresses/EditIngressYAMLModal'
import DeleteIngressModal from '../components/Ingresses/DeleteIngressModal'
import CreateIngressModal from '../components/Ingresses/CreateIngressModal'

interface Ingress {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
    uid: string
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
  const { cluster: clusterParam, namespace: namespaceParam } = useParams()
  const { selectedCluster } = useClusterStore()
  const { selectedNamespace } = useNamespaceStore()
  const queryClient = useQueryClient()
  const { data: clusters = [] } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIngress, setSelectedIngress] = useState<Ingress | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createNamespace, setCreateNamespace] = useState(namespaceParam || selectedNamespace || 'default')

  const currentCluster = clusterParam || selectedCluster
  const currentNamespace = namespaceParam || selectedNamespace

  // Reset state when cluster or namespace changes
  useEffect(() => {
    setSelectedIngress(null)
    setIsDetailsModalOpen(false)
    setIsEditModalOpen(false)
    setIsDeleteModalOpen(false)
    setIsCreateModalOpen(false)
  }, [currentCluster, currentNamespace])

  // Fetch ingresses from all clusters or selected cluster
  const clustersToFetch = currentCluster ? [currentCluster] : clusters.map((c: any) => c.name)

  const ingressQueries = clustersToFetch.map((clusterName: string) => ({
    queryKey: ['ingresses', clusterName, currentNamespace],
    queryFn: () => getIngresses(clusterName, currentNamespace === 'all' ? undefined : (currentNamespace || undefined)),
    refetchInterval: 5000,
  }))

  const queries = useQueries({ queries: ingressQueries })

  const allIngresses = useMemo(() => {
    return queries.flatMap((query) => {
      if (query.isSuccess && Array.isArray(query.data)) {
        return query.data
      }
      return []
    })
  }, [queries])

  // Filter ingresses
  const filteredIngresses = useMemo(() => {
    return allIngresses.filter((ing: Ingress) => {
      const matchesSearch =
        ing.metadata.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ing.metadata.namespace.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ing.spec.ingressClassName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ing.spec.rules?.some(rule => rule.host?.toLowerCase().includes(searchTerm.toLowerCase()))
      return matchesSearch
    })
  }, [allIngresses, searchTerm])

  const { sortedData: sortedIngresses, sortConfig, requestSort } = useTableSort(filteredIngresses, { key: 'metadata.name', direction: 'asc' })

  // Apply pagination
  const {
    paginatedData: sortedData,
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
  } = usePagination(sortedIngresses, 10, 'ingresses')

  const { columnWidths, handleMouseDown: startResize } = useResizableColumns({
    name: 200,
    namespace: 150,
    class: 150,
    hosts: 200,
    loadbalancers: 150,
    rules: 100,
    age: 120,
  }, 'ingresses-column-widths')

  const handleRowClick = (ingress: Ingress) => {
    setSelectedIngress(ingress)
    setIsDetailsModalOpen(true)
  }

  const handleEdit = (ingress: Ingress, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIngress(ingress)
    setIsEditModalOpen(true)
  }

  const handleDelete = (ingress: Ingress, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIngress(ingress)
    setIsDeleteModalOpen(true)
  }

  const getHosts = (ingress: Ingress) => {
    const hosts = ingress.spec.rules?.map(rule => rule.host).filter(Boolean) || []
    return hosts.length > 0 ? hosts.join(', ') : '*'
  }

  const getLoadBalancers = (ingress: Ingress) => {
    const lbs = ingress.status?.loadBalancer?.ingress || []
    return lbs.length
  }

  const getLoadBalancersDisplay = (ingress: Ingress) => {
    const lbs = ingress.status?.loadBalancer?.ingress || []
    if (lbs.length === 0) return '-'
    const addresses = lbs.map(lb => lb.ip || lb.hostname).filter(Boolean)
    return addresses.length > 0 ? addresses.join(', ') : '-'
  }

  const getRulesCount = (ingress: Ingress) => {
    return ingress.spec.rules?.length || 0
  }

  const isLoading = queries.some((q) => q.isLoading)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Breadcrumb 
          items={
            currentCluster
              ? [
                  { name: currentCluster, href: "/dashboard" },
                  { name: 'Ingresses' }
                ]
              : [{ name: 'Ingresses' }]
          }
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Ingresses</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            HTTP/HTTPS routing rules across {clustersToFetch.length} cluster(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name, namespace, class, or host..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          {currentCluster && (
            <button
              onClick={() => {
                setCreateNamespace(currentNamespace || 'default')
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
                  width={columnWidths.name}
                  onResizeStart={startResize}
                />
                <ResizableTableHeader
                  label="Namespace"
                  columnKey="namespace"
                  sortKey="metadata.namespace"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.namespace}
                  onResizeStart={startResize}
                />
                <ResizableTableHeader
                  label="Class"
                  columnKey="class"
                  sortKey="spec.ingressClassName"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.class}
                  onResizeStart={startResize}
                />
                <ResizableTableHeader
                  label="Hosts"
                  columnKey="hosts"
                  sortKey="hosts"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.hosts}
                  onResizeStart={startResize}
                />
                <ResizableTableHeader
                  label="Load Balancers"
                  columnKey="loadbalancers"
                  sortKey="loadbalancers"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.loadbalancers}
                  onResizeStart={startResize}
                />
                <ResizableTableHeader
                  label="Rules"
                  columnKey="rules"
                  sortKey="rules"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.rules}
                  onResizeStart={startResize}
                />
                <ResizableTableHeader
                  label="Age"
                  columnKey="age"
                  sortKey="metadata.creationTimestamp"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.age}
                  onResizeStart={startResize}
                />
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading ingresses...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    {searchTerm ? 'No ingresses found matching your search.' : 'No ingresses found.'}
                  </td>
                </tr>
              ) : (
                sortedData.map((ingress: Ingress) => (
                  <tr
                    key={ingress.metadata.uid}
                    onClick={() => handleRowClick(ingress)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white" style={{ width: columnWidths.name }}>
                      {ingress.metadata.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400" style={{ width: columnWidths.namespace }}>
                      {ingress.metadata.namespace}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400" style={{ width: columnWidths.class }}>
                      {ingress.spec.ingressClassName || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400" style={{ width: columnWidths.hosts }}>
                      <div className="truncate" title={getHosts(ingress)}>
                        {getHosts(ingress)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400" style={{ width: columnWidths.loadbalancers }}>
                      <div className="truncate" title={getLoadBalancersDisplay(ingress)}>
                        {getLoadBalancers(ingress) > 0 ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            {getLoadBalancers(ingress)} LB{getLoadBalancers(ingress) > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400" style={{ width: columnWidths.rules }}>
                      {getRulesCount(ingress) > 0 ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {getRulesCount(ingress)}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400" style={{ width: columnWidths.age }}>
                      {formatAge(ingress.metadata.creationTimestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right" style={{ width: columnWidths.actions }}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleEdit(ingress, e)}
                          className="p-1.5 text-yellow-600 hover:text-yellow-700 dark:text-yellow-500 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-all"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(ingress, e)}
                          className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                          title="Delete"
                        >
                          <TrashIcon className="h-5 w-5" />
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
      {selectedIngress && (
        <>
          <IngressDetailsModal
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedIngress(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['ingresses'] })
              await queryClient.refetchQueries({ queryKey: ['ingresses'] })
              setIsDetailsModalOpen(false)
              setSelectedIngress(null)
            }}
            ingress={selectedIngress}
          />
          <EditIngressYAMLModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedIngress(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['ingresses'] })
              await queryClient.refetchQueries({ queryKey: ['ingresses'] })
              setIsEditModalOpen(false)
              setSelectedIngress(null)
            }}
            ingress={selectedIngress}
          />
          <DeleteIngressModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedIngress(null)
            }}
            onSuccess={async () => {
              console.log('Delete onSuccess called, refetching ingresses...')
              await queryClient.invalidateQueries({ queryKey: ['ingresses'] })
              await queryClient.refetchQueries({ queryKey: ['ingresses'] })
              console.log('Ingresses refetched successfully')
              setIsDeleteModalOpen(false)
              setSelectedIngress(null)
            }}
            ingress={selectedIngress}
          />
        </>
      )}
      {currentCluster && createNamespace && (
        <CreateIngressModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            queryClient.invalidateQueries({ queryKey: ['ingresses'] })
            setIsCreateModalOpen(false)
          }}
          clusterName={currentCluster}
          namespace={createNamespace}
        />
      )}
    </div>
  )
}

