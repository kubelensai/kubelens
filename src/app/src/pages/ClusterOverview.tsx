import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { 
  CpuChipIcon, 
  CircleStackIcon,
  CubeIcon,
  RocketLaunchIcon,
  ServerIcon
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import MetricCard from '@/components/shared/MetricCard'
import { useClusters } from '@/hooks/useClusters'

// Mock function - will be replaced with real API
const getClusterMetrics = async (clusterName: string) => {
  // This will be replaced with actual metrics-server API call
  const response = await fetch(`/api/v1/clusters/${clusterName}/metrics`)
  if (!response.ok) {
    throw new Error('Failed to fetch cluster metrics')
  }
  return response.json()
}

const getClusterResources = async (clusterName: string) => {
  const response = await fetch(`/api/v1/clusters/${clusterName}/resources-summary`)
  if (!response.ok) {
    throw new Error('Failed to fetch cluster resources')
  }
  return response.json()
}

export default function ClusterOverview() {
  const { cluster } = useParams<{ cluster: string }>()
  const { data: clusters } = useClusters()

  const clusterData = clusters?.find((c: any) => c.name === cluster)

  // Fetch cluster metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['cluster-metrics', cluster],
    queryFn: () => cluster ? getClusterMetrics(cluster) : Promise.resolve(null),
    enabled: !!cluster,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch resource summary
  const { data: resources, isLoading: resourcesLoading } = useQuery({
    queryKey: ['cluster-resources', cluster],
    queryFn: () => cluster ? getClusterResources(cluster) : Promise.resolve(null),
    enabled: !!cluster,
  })

  if (!cluster) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center text-gray-500 dark:text-gray-400">
          Please select a cluster
        </div>
      </div>
    )
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const formatCPU = (millicores: number) => {
    // Convert millicores to cores (1 core = 1000 millicores)
    const cores = millicores / 1000
    
    if (cores < 1) {
      return `${millicores.toFixed(0)}m`
    }
    return `${cores.toFixed(2)}`
  }

  const calculatePercentage = (used: number, total: number) => {
    if (!total) return 0
    return ((used / total) * 100).toFixed(1)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Breadcrumb 
          items={[
            { name: cluster || '', href: '/' },
            { name: 'Overview' }
          ]} 
        />
        <div className="mt-2">
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            {cluster} - Overview
          </h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            Resource usage and capacity metrics
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link to={`/clusters/${cluster}/nodes`} className="block transition-transform hover:scale-105 cursor-pointer">
          <MetricCard
            title="Nodes"
            value={resources?.totalNodes || 0}
            subtitle={`${resources?.readyNodes || 0} ready`}
            icon={<ServerIcon className="h-6 w-6" />}
            color="primary"
            isLoading={resourcesLoading}
          />
        </Link>
        <Link to={`/clusters/${cluster}/pods`} className="block transition-transform hover:scale-105 cursor-pointer">
          <MetricCard
            title="Pods"
            value={resources?.totalPods || 0}
            subtitle={`${resources?.runningPods || 0} running`}
            icon={<CubeIcon className="h-6 w-6" />}
            color="info"
            isLoading={resourcesLoading}
          />
        </Link>
        <Link to={`/clusters/${cluster}/deployments`} className="block transition-transform hover:scale-105 cursor-pointer">
          <MetricCard
            title="Deployments"
            value={resources?.totalDeployments || 0}
            subtitle={`${resources?.availableDeployments || 0} available`}
            icon={<RocketLaunchIcon className="h-6 w-6" />}
            color="success"
            isLoading={resourcesLoading}
          />
        </Link>
      </div>

      {/* CPU Metrics */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          CPU Resources
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            title="Capacity"
            value={formatCPU(metrics?.cpu?.capacity || 0)}
            unit="cores"
            subtitle="Total CPU capacity"
            icon={<CpuChipIcon className="h-6 w-6" />}
            color="primary"
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Allocatable"
            value={formatCPU(metrics?.cpu?.allocatable || 0)}
            unit="cores"
            subtitle="Available for pods"
            color="info"
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Requests"
            value={formatCPU(metrics?.cpu?.requests || 0)}
            unit="cores"
            subtitle={`${calculatePercentage(metrics?.cpu?.requests || 0, metrics?.cpu?.allocatable || 0)}% of allocatable`}
            color="success"
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Limits"
            value={formatCPU(metrics?.cpu?.limits || 0)}
            unit="cores"
            subtitle={`${calculatePercentage(metrics?.cpu?.limits || 0, metrics?.cpu?.allocatable || 0)}% of allocatable`}
            color="warning"
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Usage"
            value={formatCPU(metrics?.cpu?.usage || 0)}
            unit="cores"
            subtitle={`${calculatePercentage(metrics?.cpu?.usage || 0, metrics?.cpu?.allocatable || 0)}% utilization`}
            color="danger"
            isLoading={metricsLoading}
          />
        </div>
      </div>

      {/* Memory Metrics */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Memory Resources
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            title="Capacity"
            value={formatBytes(metrics?.memory?.capacity || 0)}
            subtitle="Total memory capacity"
            icon={<CircleStackIcon className="h-6 w-6" />}
            color="primary"
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Allocatable"
            value={formatBytes(metrics?.memory?.allocatable || 0)}
            subtitle="Available for pods"
            color="info"
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Requests"
            value={formatBytes(metrics?.memory?.requests || 0)}
            subtitle={`${calculatePercentage(metrics?.memory?.requests || 0, metrics?.memory?.allocatable || 0)}% of allocatable`}
            color="success"
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Limits"
            value={formatBytes(metrics?.memory?.limits || 0)}
            subtitle={`${calculatePercentage(metrics?.memory?.limits || 0, metrics?.memory?.allocatable || 0)}% of allocatable`}
            color="warning"
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Usage"
            value={formatBytes(metrics?.memory?.usage || 0)}
            subtitle={`${calculatePercentage(metrics?.memory?.usage || 0, metrics?.memory?.allocatable || 0)}% utilization`}
            color="danger"
            isLoading={metricsLoading}
          />
        </div>
      </div>

      {/* Cluster Info */}
      {clusterData && (
        <div className="card p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Cluster Information
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{clusterData.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Version</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{clusterData.version || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
              <dd className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  clusterData.status === 'connected' || clusterData.status === 'healthy'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {clusterData.status}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}

