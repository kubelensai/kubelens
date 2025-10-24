import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getServices } from '@/services/api'
import { useMemo, useState } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import ServiceDetailsModal from '@/components/Services/ServiceDetailsModal'
import EditServiceModal from '@/components/Services/EditServiceModal'
import DeleteServiceModal from '@/components/Services/DeleteServiceModal'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

export default function Services() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')
  const [selectedService, setSelectedService] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    namespace: 150,
    type: 120,
    clusterIP: 130,
    ports: 200,
    externalIP: 150,
    selector: 150, // Same width as externalIP
    status: 100,
    age: 120,
    actions: 120,
  }, 'services-column-widths')
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch services from all clusters or specific cluster/namespace
  const serviceQueries = useQuery({
    queryKey: namespace 
      ? ['services', cluster, namespace]
      : cluster 
        ? ['services', cluster] 
        : ['all-services', clusters?.map(c => c.name)],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const services = await getServices(cluster, namespace)
        return services.map((service: any) => ({ ...service, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const services = await getServices(cluster)
        return services.map((service: any) => ({ ...service, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allServices = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const services = await getServices(cluster.name)
            return services.map((service: any) => ({ ...service, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching services from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allServices.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
  })

  const isLoading = serviceQueries.isLoading
  const allServices = serviceQueries.data || []

  // Filter services by name, cluster IP, external IP, ports, or selector
  const filteredServices = useMemo(() => {
    if (!filterText) return allServices
    const lowerFilter = filterText.toLowerCase()
    return allServices.filter((service: any) => {
      // Filter by name
      if (service.metadata?.name?.toLowerCase().includes(lowerFilter)) return true
      
      // Filter by cluster IP
      if (service.spec?.clusterIP?.toLowerCase().includes(lowerFilter)) return true
      
      // Filter by external IP
      const externalIP = getExternalIP(service).toLowerCase()
      if (externalIP.includes(lowerFilter)) return true
      
      // Filter by ports
      const ports = formatPorts(service).toLowerCase()
      if (ports.includes(lowerFilter)) return true
      
      // Filter by selector
      const selectors = formatSelector(service)
      if (selectors) {
        const selectorText = selectors
          .map((s: any) => `${s.key}=${s.value}`)
          .join(' ')
          .toLowerCase()
        if (selectorText.includes(lowerFilter)) return true
      }
      
      return false
    })
  }, [allServices, filterText])

  // Apply sorting
  const { sortedData: sortedServices, sortConfig, requestSort } = useTableSort(filteredServices, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Apply pagination
  const {
    paginatedData: services,
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
  } = usePagination(sortedServices, 10, 'services')

  // Helper functions
  const formatPorts = (service: any) => {
    if (!service.spec?.ports || service.spec.ports.length === 0) return 'None'
    return service.spec.ports
      .map((port: any) => `${port.port}${port.nodePort ? ':' + port.nodePort : ''}/${port.protocol}`)
      .join(', ')
  }

  const getExternalIP = (service: any) => {
    // For LoadBalancer services
    if (service.status?.loadBalancer?.ingress && service.status.loadBalancer.ingress.length > 0) {
      const ingress = service.status.loadBalancer.ingress[0]
      return ingress.ip || ingress.hostname || 'Pending'
    }
    
    // For services with externalIPs
    if (service.spec?.externalIPs && service.spec.externalIPs.length > 0) {
      return service.spec.externalIPs.join(', ')
    }
    
    // For NodePort services
    if (service.spec?.type === 'NodePort') {
      return '<nodes>'
    }
    
    // For ExternalName services
    if (service.spec?.type === 'ExternalName') {
      return service.spec.externalName || 'N/A'
    }
    
    return 'None'
  }

  const formatSelector = (service: any) => {
    if (!service.spec?.selector) return null
    const selector = service.spec.selector
    return Object.entries(selector).map(([key, value]) => ({
      key,
      value: value as string
    }))
  }

  const getServiceStatus = (service: any) => {
    // ExternalName services are always considered active
    if (service.spec?.type === 'ExternalName') {
      return { status: 'Active', color: 'badge-success' }
    }
    
    // LoadBalancer services
    if (service.spec?.type === 'LoadBalancer') {
      if (service.status?.loadBalancer?.ingress && service.status.loadBalancer.ingress.length > 0) {
        return { status: 'Active', color: 'badge-success' }
      }
      return { status: 'Pending', color: 'badge-warning' }
    }
    
    // Services with selectors should have endpoints
    if (service.spec?.selector) {
      // We'd need to fetch endpoints to determine this accurately
      // For now, assume active if selector is present
      return { status: 'Active', color: 'badge-success' }
    }
    
    // Headless services (ClusterIP: None)
    if (service.spec?.clusterIP === 'None') {
      return { status: 'Headless', color: 'badge-info' }
    }
    
    return { status: 'Active', color: 'badge-success' }
  }

  // Action handlers
  const handleRowClick = (service: any) => {
    setSelectedService(service)
    setIsDetailsModalOpen(true)
  }

  const handleEditClick = (service: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedService(service)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (service: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedService(service)
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
                      { name: 'Services' }
                    ]
                  : [{ name: 'Services' }]
              }
        />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Services</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            All services across {clusters?.length || 0} cluster(s)
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by name, IP, ports, selector..."
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
                  label="Type"
                  columnKey="type"
                  sortKey="spec.type"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.type}
                />
                <ResizableTableHeader
                  label="Cluster IP"
                  columnKey="clusterIP"
                  sortKey="spec.clusterIP"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.clusterIP}
                />
                <ResizableTableHeader
                  label="Ports"
                  columnKey="ports"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.ports}
                />
                <ResizableTableHeader
                  label="External IP"
                  columnKey="externalIP"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.externalIP}
                />
                <ResizableTableHeader
                  label="Selector"
                  columnKey="selector"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.selector}
                />
                <ResizableTableHeader
                  label="Status"
                  columnKey="status"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.status}
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
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading services...</span>
                    </div>
                  </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No services found</p>
                  </td>
                </tr>
              ) : (
                services.map((service) => {
                  const status = getServiceStatus(service)
                  
                  return (
                    <tr 
                      key={`${service.clusterName}-${service.metadata.namespace}-${service.metadata.name}`} 
                      onClick={() => handleRowClick(service)}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    >
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        <div className="truncate max-w-[150px] sm:max-w-none">
                          {service.metadata.name}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {service.metadata.namespace}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {service.spec.type}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {service.spec.clusterIP || 'None'}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        <div className="break-words">
                          {formatPorts(service)}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        <div className="break-words">
                          {getExternalIP(service)}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {(() => {
                          const selectors = formatSelector(service)
                          if (!selectors || selectors.length === 0) {
                            return <span className="text-gray-400 dark:text-gray-500">None</span>
                          }
                          return (
                            <div className="flex flex-wrap gap-1">
                              {selectors.map((selector: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                  title={`${selector.key}=${selector.value}`}
                                >
                                  <span className="font-semibold">{selector.key}</span>
                                  <span className="mx-0.5">=</span>
                                  <span>{selector.value}</span>
                                </span>
                              ))}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                        <span className={clsx('badge text-xs', status.color)}>
                          {status.status}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {formatAge(service.metadata.creationTimestamp)}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleEditClick(service, e)}
                            className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                            title="Edit service"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(service, e)}
                            className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete service"
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

      {/* Service Modals */}
      {selectedService && (
        <>
          <ServiceDetailsModal
            service={selectedService}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedService(null)
            }}
          />
          <EditServiceModal
            service={selectedService}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedService(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['services'] })
              await queryClient.invalidateQueries({ queryKey: ['all-services'] })
              await queryClient.refetchQueries({ queryKey: ['services'] })
              await queryClient.refetchQueries({ queryKey: ['all-services'] })
              setIsEditModalOpen(false)
              setSelectedService(null)
            }}
          />
          <DeleteServiceModal
            service={selectedService}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedService(null)
            }}
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['services'] })
              await queryClient.invalidateQueries({ queryKey: ['all-services'] })
              await queryClient.refetchQueries({ queryKey: ['services'] })
              await queryClient.refetchQueries({ queryKey: ['all-services'] })
              setIsDeleteModalOpen(false)
              setSelectedService(null)
            }}
          />
        </>
      )}
    </div>
  )
}

