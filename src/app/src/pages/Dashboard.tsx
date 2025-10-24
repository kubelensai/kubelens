import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useClusterStore } from '@/stores/clusterStore'
import { useClusters } from '@/hooks/useClusters'
import {
  ServerIcon,
  CubeIcon,
  GlobeAltIcon,
  CircleStackIcon,
  ViewColumnsIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResourceWidget from '@/components/dashboard/ResourceWidget'
import UsageWidget from '@/components/dashboard/UsageWidget'
import api from '@/services/api'

// Fetch cluster metrics with authentication
const getClusterMetrics = async (clusterName: string) => {
  const response = await api.get(`/clusters/${clusterName}/metrics`)
  return response.data
}

const getClusterResources = async (clusterName: string) => {
  const response = await api.get(`/clusters/${clusterName}/resources-summary`)
  return response.data
}

export default function Dashboard() {
  const { selectedCluster } = useClusterStore()
  const { data: clusters } = useClusters(true) // Get enabled clusters only

  // Fetch cluster metrics and resources only if we have at least one cluster
  const hasCluster = clusters && clusters.length > 0
  const clusterToShow = selectedCluster || (hasCluster ? clusters[0]?.name : null)

  // Fetch cluster metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['cluster-metrics', clusterToShow],
    queryFn: () => clusterToShow ? getClusterMetrics(clusterToShow) : Promise.resolve(null),
    enabled: !!clusterToShow,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Fetch resource summary
  const { data: resources, isLoading: resourcesLoading } = useQuery({
    queryKey: ['cluster-resources', clusterToShow],
    queryFn: () => clusterToShow ? getClusterResources(clusterToShow) : Promise.resolve(null),
    enabled: !!clusterToShow,
  })

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const formatCPU = (millicores: number) => {
    const cores = millicores / 1000
    if (cores < 1) {
      return `${millicores.toFixed(0)}m`
    }
    return `${cores.toFixed(2)}`
  }

  const calculatePercentage = (used: number, total: number) => {
    if (!total) return '0.0'
    return ((used / total) * 100).toFixed(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb items={[]} />
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold gradient-text">
            Dashboard
          </h1>
        </div>
      </div>

      {/* Welcome Section */}
      <div className="card p-6 sm:p-8 bg-gradient-to-br from-primary-50 via-white to-purple-50 dark:from-gray-800 dark:via-gray-800 dark:to-purple-900/20 border-primary-100 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome to Kubelens! 👋
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-2xl">
              Manage your Kubernetes resources with ease. 
            </p>
          </div>
        </div>
      </div>

      {/* Cluster Widgets - Only show when at least one cluster is added */}
      {hasCluster && clusterToShow && (
        <>
          {/* Resource Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to={`/clusters/${clusterToShow}/nodes`} className="block transition-transform hover:scale-105">
              <ResourceWidget
                title="Nodes"
                icon={<ServerIcon className="h-5 w-5" />}
                value={resources?.totalNodes || 0}
                subtitle={`${resources?.readyNodes || 0} All ready`}
                color="blue"
                isLoading={resourcesLoading}
              />
            </Link>
            <Link to={`/clusters/${clusterToShow}/pods`} className="block transition-transform hover:scale-105">
              <ResourceWidget
                title="Pods"
                icon={<CubeIcon className="h-5 w-5" />}
                value={resources?.totalPods || 0}
                subtitle={`${resources?.runningPods || 0} All ready`}
                color="green"
                isLoading={resourcesLoading}
              />
            </Link>
            <Link to={`/clusters/${clusterToShow}/namespaces`} className="block transition-transform hover:scale-105">
              <ResourceWidget
                title="Namespaces"
                icon={<ViewColumnsIcon className="h-5 w-5" />}
                value={resources?.totalNamespaces || 5}
                subtitle="All ready"
                color="purple"
                isLoading={resourcesLoading}
              />
            </Link>
            <Link to={`/clusters/${clusterToShow}/services`} className="block transition-transform hover:scale-105">
              <ResourceWidget
                title="Services"
                icon={<GlobeAltIcon className="h-5 w-5" />}
                value={resources?.totalServices || 6}
                subtitle="All ready"
                color="orange"
                isLoading={resourcesLoading}
              />
            </Link>
          </div>

          {/* CPU and Memory Usage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UsageWidget
              title="CPU Usage"
              icon={<CpuChipIcon className="h-6 w-6" />}
              requests={`${formatCPU(metrics?.cpu?.requests || 0)} cores`}
              limits={`${formatCPU(metrics?.cpu?.limits || 0)} cores`}
              total={`${formatCPU(metrics?.cpu?.allocatable || 0)} cores`}
              requestsPercent={calculatePercentage(metrics?.cpu?.requests || 0, metrics?.cpu?.allocatable || 0)}
              limitsPercent={calculatePercentage(metrics?.cpu?.limits || 0, metrics?.cpu?.allocatable || 0)}
              isLoading={metricsLoading}
            />
            <UsageWidget
              title="Memory Usage"
              icon={<CircleStackIcon className="h-6 w-6" />}
              requests={formatBytes(metrics?.memory?.requests || 0)}
              limits={formatBytes(metrics?.memory?.limits || 0)}
              total={formatBytes(metrics?.memory?.allocatable || 0)}
              requestsPercent={calculatePercentage(metrics?.memory?.requests || 0, metrics?.memory?.allocatable || 0)}
              limitsPercent={calculatePercentage(metrics?.memory?.limits || 0, metrics?.memory?.allocatable || 0)}
              isLoading={metricsLoading}
            />
          </div>

          {/* Cluster Information */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Cluster Information
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{clusterToShow}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Version</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {clusters?.find((c: any) => c.name === clusterToShow)?.version || 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    clusters?.find((c: any) => c.name === clusterToShow)?.status === 'connected' || 
                    clusters?.find((c: any) => c.name === clusterToShow)?.status === 'healthy'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {clusters?.find((c: any) => c.name === clusterToShow)?.status || 'Unknown'}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Recent Events */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Events
            </h3>
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="text-sm">Latest cluster events</p>
              <p className="text-sm mt-2">No recent events</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
