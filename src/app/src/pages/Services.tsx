import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getServices } from '@/services/api'
import { useState, useMemo } from 'react'
import clsx from 'clsx'
import { 
  PencilSquareIcon, 
  TrashIcon, 
  EyeIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import EditServiceModal from '@/components/Services/EditServiceModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface ServiceData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
  }
  spec: {
    type: string
    clusterIP?: string
    ports?: Array<{
      port: number
      nodePort?: number
      protocol: string
      name?: string
    }>
    selector?: Record<string, string>
    externalIPs?: string[]
    externalName?: string
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

export default function Services() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [selectedService, setSelectedService] = useState<ServiceData | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch services from all clusters or specific cluster/namespace
  const { data: allServices, isLoading } = useQuery({
    queryKey: namespace 
      ? ['services', cluster, namespace]
      : cluster 
        ? ['services', cluster] 
        : ['all-services', clusters?.map(c => c.name).sort().join(',')],
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
    refetchInterval: 5000,
  })

  // Helper functions
  const formatPorts = (service: ServiceData): string => {
    if (!service.spec?.ports || service.spec.ports.length === 0) return 'None'
    return service.spec.ports
      .map((port) => `${port.port}${port.nodePort ? ':' + port.nodePort : ''}/${port.protocol}`)
      .join(', ')
  }

  const getExternalIP = (service: ServiceData): string => {
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

  const getServiceStatus = (service: ServiceData) => {
    // ExternalName services are always considered active
    if (service.spec?.type === 'ExternalName') {
      return { status: 'Active', color: 'green' }
    }
    
    // LoadBalancer services
    if (service.spec?.type === 'LoadBalancer') {
      if (service.status?.loadBalancer?.ingress && service.status.loadBalancer.ingress.length > 0) {
        return { status: 'Active', color: 'green' }
      }
      return { status: 'Pending', color: 'yellow' }
    }
    
    // Services with selectors should have endpoints
    if (service.spec?.selector) {
      return { status: 'Active', color: 'green' }
    }
    
    // Headless services (ClusterIP: None)
    if (service.spec?.clusterIP === 'None') {
      return { status: 'Headless', color: 'blue' }
    }
    
    return { status: 'Active', color: 'green' }
  }

  // Action handlers
  const handleEditClick = (service: ServiceData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedService(service)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (service: ServiceData, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedService(service)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedService) return
    try {
      await api.delete(`/clusters/${selectedService.clusterName}/namespaces/${selectedService.metadata.namespace}/services/${selectedService.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Service deleted successfully',
      })
      setIsDeleteModalOpen(false)
      setSelectedService(null)
      // Invalidate queries to refetch
      await queryClient.invalidateQueries({ queryKey: ['services'] })
      await queryClient.invalidateQueries({ queryKey: ['all-services'] })
      await queryClient.refetchQueries({ queryKey: ['services'] })
      await queryClient.refetchQueries({ queryKey: ['all-services'] })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete service: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Define columns
  const columns = useMemo<Column<ServiceData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (service) => (
        <div className="flex items-center gap-2">
          <GlobeAltIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${service.clusterName}/namespaces/${service.metadata.namespace}/services/${service.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {service.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {service.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (service) => service.metadata.name,
      searchValue: (service) => `${service.metadata.name} ${service.clusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (service) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {service.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (service) => service.metadata.namespace,
      searchValue: (service) => service.metadata.namespace,
    },
    {
      key: 'type',
      header: 'Type',
      accessor: (service) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {service.spec.type}
        </span>
      ),
      sortable: true,
      sortValue: (service) => service.spec.type,
      searchValue: (service) => service.spec.type,
      filterable: true,
      filterOptions: (data) => {
        const types = new Set(data.map(s => s.spec.type))
        return Array.from(types).sort()
      },
      filterValue: (service) => service.spec.type,
    },
    {
      key: 'clusterIP',
      header: 'Cluster IP',
      accessor: (service) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">
          {service.spec.clusterIP || 'None'}
        </span>
      ),
      sortable: true,
      sortValue: (service) => service.spec.clusterIP || '',
      searchValue: (service) => service.spec.clusterIP || '',
    },
    {
      key: 'externalIP',
      header: 'External IP',
      accessor: (service) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">
          {getExternalIP(service)}
        </span>
      ),
      sortable: false,
      searchValue: (service) => getExternalIP(service),
    },
    {
      key: 'ports',
      header: 'Ports',
      accessor: (service) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">
          {formatPorts(service)}
        </span>
      ),
      sortable: false,
      searchValue: (service) => formatPorts(service),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (service) => {
        const serviceStatus = getServiceStatus(service)
        const colorClasses = {
          green: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
          blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
        }
        
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
            colorClasses[serviceStatus.color as keyof typeof colorClasses]
          )}>
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full',
              serviceStatus.color === 'green' ? 'bg-green-600' :
              serviceStatus.color === 'yellow' ? 'bg-yellow-600' :
              'bg-blue-600'
            )} />
            {serviceStatus.status}
          </span>
        )
      },
      sortable: true,
      sortValue: (service) => getServiceStatus(service).status,
      searchValue: (service) => getServiceStatus(service).status,
      filterable: true,
      filterOptions: (data) => {
        const statuses = new Set(data.map(s => getServiceStatus(s).status))
        return Array.from(statuses).sort()
      },
      filterValue: (service) => getServiceStatus(service).status,
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (service) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(service.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (service) => new Date(service.metadata.creationTimestamp).getTime(),
      searchValue: (service) => formatAge(service.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (service) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${service.clusterName}/namespaces/${service.metadata.namespace}/services/${service.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleEditClick(service, e)}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDeleteClick(service, e)}
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
          { name: 'Services' }
        ]}
      />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
          Services
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {namespace 
            ? `Services in ${cluster} / ${namespace}`
            : cluster 
              ? `All services in ${cluster}`
              : `All services across ${clusters?.length || 0} cluster(s)`
          }
        </p>
      </div>
      
      <DataTable
        data={allServices || []}
        columns={columns}
        keyExtractor={(service) => `${service.clusterName}-${service.metadata.namespace}-${service.metadata.name}`}
        searchPlaceholder="Search services by name, cluster, namespace, IP, ports..."
        isLoading={isLoading}
        emptyMessage="No services found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <GlobeAltIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(service) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <GlobeAltIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/clusters/${service.clusterName}/namespaces/${service.metadata.namespace}/services/${service.metadata.name}`)
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                  >
                    {service.metadata.name}
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {service.metadata.namespace}
                  </div>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {service.clusterName}
                    </div>
                  )}
                </div>
              </div>
              <span className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full shrink-0',
                getServiceStatus(service).color === 'green'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : getServiceStatus(service).color === 'yellow'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
              )}>
                <span className={clsx(
                  'w-1.5 h-1.5 rounded-full',
                  getServiceStatus(service).color === 'green' ? 'bg-green-600' :
                  getServiceStatus(service).color === 'yellow' ? 'bg-yellow-600' :
                  'bg-blue-600'
                )} />
                {getServiceStatus(service).status}
              </span>
            </div>
            
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Type:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{service.spec.type}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Cluster IP:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">{service.spec.clusterIP || 'None'}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">External IP:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">{getExternalIP(service)}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Ports:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">{formatPorts(service)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(service.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${service.clusterName}/namespaces/${service.metadata.namespace}/services/${service.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleEditClick(service, e)}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(service, e)}
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
      {selectedService && (
        <>
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
          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedService(null)
            }}
            onConfirm={handleDeleteConfirm}
            title="Delete Service"
            message={`Are you sure you want to delete service "${selectedService.metadata.name}"? This action cannot be undone. Any pods using this service will lose their network endpoint.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
