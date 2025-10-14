import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getEndpoints } from '@/services/api'
import { useMemo, useState } from 'react'
import { MagnifyingGlassIcon, InformationCircleIcon } from '@heroicons/react/24/outline'

import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import EndpointDetailsModal from '@/components/Endpoints/EndpointDetailsModal'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

export default function Endpoints() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()

  const [filterText, setFilterText] = useState('')
  const [selectedEndpoint, setSelectedEndpoint] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    namespace: 150,
    addresses: 300,
    age: 120,
    actions: 100,
  }, 'endpoints-column-widths')
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch endpoints from all clusters or specific cluster/namespace
  const endpointQueries = useQuery({
    queryKey: namespace 
      ? ['endpoints', cluster, namespace]
      : cluster 
        ? ['endpoints', cluster] 
        : ['all-endpoints', clusters?.map(c => c.name)],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const endpoints = await getEndpoints(cluster, namespace)
        return endpoints.map((endpoint: any) => ({ ...endpoint, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const endpoints = await getEndpoints(cluster)
        return endpoints.map((endpoint: any) => ({ ...endpoint, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allEndpoints = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const endpoints = await getEndpoints(cluster.name)
            return endpoints.map((endpoint: any) => ({ ...endpoint, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching endpoints from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allEndpoints.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
  })

  const isLoading = endpointQueries.isLoading
  const allEndpoints = endpointQueries.data || []

  // Filter endpoints by name, addresses, or ports
  const filteredEndpoints = useMemo(() => {
    if (!filterText) return allEndpoints
    const lowerFilter = filterText.toLowerCase()
    return allEndpoints.filter((endpoint: any) => {
      // Filter by name
      if (endpoint.metadata?.name?.toLowerCase().includes(lowerFilter)) return true
      
      // Filter by addresses
      const addresses = formatAddresses(endpoint).toLowerCase()
      if (addresses.includes(lowerFilter)) return true
      
      return false
    })
  }, [allEndpoints, filterText])

  // Apply sorting
  const { sortedData: sortedEndpoints, sortConfig, requestSort } = useTableSort(filteredEndpoints, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: endpoints,
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
  } = usePagination(sortedEndpoints, 10, 'endpoints')

  // Helper functions
  const formatAddresses = (endpoint: any) => {
    const allAddresses: string[] = []
    
    // Get addresses from ready subsets
    endpoint.subsets?.forEach((subset: any) => {
      subset.addresses?.forEach((addr: any) => {
        allAddresses.push(addr.ip)
      })
    })
    
    return allAddresses.length > 0 ? allAddresses.slice(0, 3).join(', ') + (allAddresses.length > 3 ? '...' : '') : 'None'
  }

  // Action handlers
  const handleRowClick = (endpoint: any) => {
    setSelectedEndpoint(endpoint)
    setIsDetailsModalOpen(true)
  }

  const handleDetailsClick = (endpoint: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedEndpoint(endpoint)
    setIsDetailsModalOpen(true)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Breadcrumb 
              items={
                cluster
                  ? [
                      { name: cluster, href: `/clusters/${cluster}/overview` },
                      { name: 'Endpoints' }
                    ]
                  : [{ name: 'Endpoints' }]
              }
        />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Endpoints</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            All endpoints across {clusters?.length || 0} cluster(s)
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by name or addresses..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-11 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
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
                  label="Addresses"
                  columnKey="addresses"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.addresses}
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
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading endpoints...</span>
                    </div>
                  </td>
                </tr>
              ) : endpoints.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No endpoints found</p>
                  </td>
                </tr>
              ) : (
                endpoints.map((endpoint) => {
                  return (
                    <tr 
                      key={`${endpoint.clusterName}-${endpoint.metadata.namespace}-${endpoint.metadata.name}`} 
                      onClick={() => handleRowClick(endpoint)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    >
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        <div className="truncate max-w-[150px] sm:max-w-none">
                          {endpoint.metadata.name}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {endpoint.metadata.namespace}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        <div className="break-words">
                          {formatAddresses(endpoint)}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {formatAge(endpoint.metadata.creationTimestamp)}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleDetailsClick(endpoint, e)}
                            className="p-1.5 text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                            title="View details"
                          >
                            <InformationCircleIcon className="h-4 w-4" />
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

      {/* Endpoint Modal */}
      {selectedEndpoint && (
        <EndpointDetailsModal
          endpoint={selectedEndpoint}
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false)
            setSelectedEndpoint(null)
          }}
        />
      )}
    </div>
  )
}

