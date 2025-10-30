import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getEndpoints } from '@/services/api'
import { useMemo } from 'react'
import clsx from 'clsx'
import { 
  EyeIcon,
  ServerIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import { formatAge } from '@/utils/format'

interface EndpointData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
  }
  subsets?: Array<{
    addresses?: Array<{
      ip: string
      nodeName?: string
      targetRef?: {
        kind: string
        name: string
        namespace: string
      }
    }>
    notReadyAddresses?: Array<{
      ip: string
      nodeName?: string
      targetRef?: {
        kind: string
        name: string
        namespace: string
      }
    }>
    ports?: Array<{
      name?: string
      port: number
      protocol: string
    }>
  }>
  clusterName: string
}

export default function Endpoints() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch endpoints from all clusters or specific cluster/namespace
  const { data: allEndpoints, isLoading } = useQuery({
    queryKey: namespace 
      ? ['endpoints', cluster, namespace]
      : cluster 
        ? ['endpoints', cluster] 
        : ['all-endpoints', clusters?.map(c => c.name).sort().join(',')],
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
    refetchInterval: 5000,
  })

  // Helper functions
  const formatAddresses = (endpoint: EndpointData): string => {
    const allAddresses: string[] = []
    
    // Get addresses from ready subsets
    endpoint.subsets?.forEach((subset) => {
      subset.addresses?.forEach((addr) => {
        allAddresses.push(addr.ip)
      })
    })
    
    return allAddresses.length > 0 ? allAddresses.slice(0, 3).join(', ') + (allAddresses.length > 3 ? '...' : '') : 'None'
  }

  const getEndpointStatus = (endpoint: EndpointData) => {
    let readyCount = 0
    let notReadyCount = 0
    
    endpoint.subsets?.forEach((subset) => {
      readyCount += subset.addresses?.length || 0
      notReadyCount += subset.notReadyAddresses?.length || 0
    })
    
    if (readyCount === 0 && notReadyCount === 0) {
      return { status: 'No Endpoints', color: 'gray', ready: 0, notReady: 0 }
    }
    
    if (readyCount > 0 && notReadyCount === 0) {
      return { status: 'Ready', color: 'green', ready: readyCount, notReady: notReadyCount }
    }
    
    if (readyCount === 0 && notReadyCount > 0) {
      return { status: 'Not Ready', color: 'red', ready: readyCount, notReady: notReadyCount }
    }
    
    return { status: 'Partial', color: 'yellow', ready: readyCount, notReady: notReadyCount }
  }

  // Define columns
  const columns = useMemo<Column<EndpointData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (endpoint) => (
        <div className="flex items-center gap-2">
          <ServerIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${endpoint.clusterName}/namespaces/${endpoint.metadata.namespace}/endpoints/${endpoint.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {endpoint.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {endpoint.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (endpoint) => endpoint.metadata.name,
      searchValue: (endpoint) => `${endpoint.metadata.name} ${endpoint.clusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (endpoint) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {endpoint.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (endpoint) => endpoint.metadata.namespace,
      searchValue: (endpoint) => endpoint.metadata.namespace,
    },
    {
      key: 'addresses',
      header: 'Addresses',
      accessor: (endpoint) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">
          {formatAddresses(endpoint)}
        </span>
      ),
      sortable: false,
      searchValue: (endpoint) => formatAddresses(endpoint),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (endpoint) => {
        const endpointStatus = getEndpointStatus(endpoint)
        const colorClasses = {
          green: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
          red: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
          gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
        }
        
        return (
          <div className="flex flex-col gap-1">
            <span className={clsx(
              'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full w-fit',
              colorClasses[endpointStatus.color as keyof typeof colorClasses]
            )}>
              <span className={clsx(
                'w-1.5 h-1.5 rounded-full',
                endpointStatus.color === 'green' ? 'bg-green-600' :
                endpointStatus.color === 'yellow' ? 'bg-yellow-600' :
                endpointStatus.color === 'red' ? 'bg-red-600' :
                'bg-gray-600'
              )} />
              {endpointStatus.status}
            </span>
            {(endpointStatus.ready > 0 || endpointStatus.notReady > 0) && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {endpointStatus.ready} ready, {endpointStatus.notReady} not ready
              </span>
            )}
          </div>
        )
      },
      sortable: true,
      sortValue: (endpoint) => getEndpointStatus(endpoint).status,
      searchValue: (endpoint) => getEndpointStatus(endpoint).status,
      filterable: true,
      filterOptions: (data) => {
        const statuses = new Set(data.map(e => getEndpointStatus(e).status))
        return Array.from(statuses).sort()
      },
      filterValue: (endpoint) => getEndpointStatus(endpoint).status,
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (endpoint) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(endpoint.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (endpoint) => new Date(endpoint.metadata.creationTimestamp).getTime(),
      searchValue: (endpoint) => formatAge(endpoint.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (endpoint) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${endpoint.clusterName}/namespaces/${endpoint.metadata.namespace}/endpoints/${endpoint.metadata.name}`)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
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
          { name: 'Endpoints' }
        ]}
      />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
          Endpoints
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {namespace 
            ? `Endpoints in ${cluster} / ${namespace}`
            : cluster 
              ? `All endpoints in ${cluster}`
              : `All endpoints across ${clusters?.length || 0} cluster(s)`
          }
        </p>
      </div>
      
      <DataTable
        data={allEndpoints || []}
        columns={columns}
        keyExtractor={(endpoint) => `${endpoint.clusterName}-${endpoint.metadata.namespace}-${endpoint.metadata.name}`}
        searchPlaceholder="Search endpoints by name, cluster, namespace, addresses..."
        isLoading={isLoading}
        emptyMessage="No endpoints found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <ServerIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(endpoint) => {
          const endpointStatus = getEndpointStatus(endpoint)
          return (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <ServerIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                  <div className="min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/clusters/${endpoint.clusterName}/namespaces/${endpoint.metadata.namespace}/endpoints/${endpoint.metadata.name}`)
                      }}
                      className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
                    >
                      {endpoint.metadata.name}
                    </button>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {endpoint.metadata.namespace}
                    </div>
                    {!cluster && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {endpoint.clusterName}
                      </div>
                    )}
                  </div>
                </div>
                <span className={clsx(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full shrink-0',
                  endpointStatus.color === 'green'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : endpointStatus.color === 'yellow'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                    : endpointStatus.color === 'red'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                )}>
                  <span className={clsx(
                    'w-1.5 h-1.5 rounded-full',
                    endpointStatus.color === 'green' ? 'bg-green-600' :
                    endpointStatus.color === 'yellow' ? 'bg-yellow-600' :
                    endpointStatus.color === 'red' ? 'bg-red-600' :
                    'bg-gray-600'
                  )} />
                  {endpointStatus.status}
                </span>
              </div>
              
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Addresses:</span>
                  <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">{formatAddresses(endpoint)}</span>
                </div>
                {(endpointStatus.ready > 0 || endpointStatus.notReady > 0) && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Ready/Not Ready:</span>
                    <span className="ml-1 text-gray-900 dark:text-white">{endpointStatus.ready} / {endpointStatus.notReady}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatAge(endpoint.metadata.creationTimestamp)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${endpoint.clusterName}/namespaces/${endpoint.metadata.namespace}/endpoints/${endpoint.metadata.name}`)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        }}
      />
    </div>
  )
}
