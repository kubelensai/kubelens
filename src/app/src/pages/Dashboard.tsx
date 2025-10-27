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
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import api from '@/services/api'
import clsx from 'clsx'

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

  // Calculate bar width with smart scaling for values > 100%
  const calculateBarWidth = (percentage: number) => {
    if (percentage <= 100) {
      return percentage
    }
    // For values > 100%, use logarithmic scaling to fit in the bar
    // This allows showing 1000%+ while keeping it visually meaningful
    // Formula: 100 + (log10(percentage - 100 + 1) * 20)
    // This maps: 100% -> 100%, 200% -> 120%, 1000% -> 160%, 10000% -> 180%
    const overflow = percentage - 100
    const scaledOverflow = Math.log10(overflow + 1) * 20
    return Math.min(100 + scaledOverflow, 200) // Cap at 200% visual width
  }

  // Get color class based on percentage
  const getUsageColor = (percentage: number, type: 'requests' | 'limits') => {
    if (type === 'requests') {
      if (percentage >= 90) return 'bg-red-600 dark:bg-red-500'
      if (percentage >= 75) return 'bg-orange-600 dark:bg-orange-500'
      return 'bg-blue-600 dark:bg-blue-500'
    } else {
      if (percentage >= 150) return 'bg-red-600 dark:bg-red-500'
      if (percentage >= 100) return 'bg-orange-600 dark:bg-orange-500'
      return 'bg-purple-600 dark:bg-purple-500'
    }
  }

  // Get memory color
  const getMemoryColor = (percentage: number, type: 'requests' | 'limits') => {
    if (type === 'requests') {
      if (percentage >= 90) return 'bg-red-600 dark:bg-red-500'
      if (percentage >= 75) return 'bg-orange-600 dark:bg-orange-500'
      return 'bg-green-600 dark:bg-green-500'
    } else {
      if (percentage >= 150) return 'bg-red-600 dark:bg-red-500'
      if (percentage >= 100) return 'bg-orange-600 dark:bg-orange-500'
      return 'bg-orange-600 dark:bg-orange-500'
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb items={[]} />
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
          Dashboard
        </h1>
      </div>

      {/* Welcome Section - Show when no clusters */}
      {!hasCluster && (
        <div className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 via-white to-purple-50 dark:border-primary-800 dark:from-gray-800 dark:via-gray-800 dark:to-purple-900/20 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Welcome to Kubelens! 👋
              </h2>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-2xl">
                Manage your Kubernetes resources with ease. Get started by adding your first cluster.
              </p>
            </div>
            <Link
              to="/clusters"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors whitespace-nowrap"
            >
              Add Your First Cluster
            </Link>
          </div>
        </div>
      )}

      {/* Grid Layout - TailAdmin inspired */}
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {/* Metrics Cards - Left Column */}
        <div className="col-span-12 space-y-4 md:space-y-6 xl:col-span-7">
          {/* Resource Summary Cards */}
          {hasCluster && clusterToShow && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
              {/* Nodes Card */}
              <Link 
                to={`/clusters/${clusterToShow}/nodes`} 
                className="group rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] hover:shadow-lg transition-all duration-200 overflow-hidden"
              >
                <div className="flex items-center p-5 md:p-6">
                  <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-blue-50 rounded-xl dark:bg-blue-900/20 group-hover:scale-110 transition-transform flex-shrink-0">
                    <ServerIcon className="text-blue-600 w-6 h-6 sm:w-7 sm:h-7 dark:text-blue-400" />
                  </div>
                  <div className="ml-4 flex-1 min-w-0">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Nodes</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <h4 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                        {resourcesLoading ? '...' : resources?.totalNodes || 0}
                      </h4>
                      <div className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-600 bg-green-50 rounded dark:bg-green-900/20 dark:text-green-400">
                        <ArrowTrendingUpIcon className="w-3 h-3" />
                        {resources?.readyNodes || 0} ready
                      </div>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Pods Card */}
              <Link 
                to={`/clusters/${clusterToShow}/pods`} 
                className="group rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] hover:shadow-lg transition-all duration-200 overflow-hidden"
              >
                <div className="flex items-center p-5 md:p-6">
                  <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-green-50 rounded-xl dark:bg-green-900/20 group-hover:scale-110 transition-transform flex-shrink-0">
                    <CubeIcon className="text-green-600 w-6 h-6 sm:w-7 sm:h-7 dark:text-green-400" />
                  </div>
                  <div className="ml-4 flex-1 min-w-0">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Pods</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <h4 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                        {resourcesLoading ? '...' : resources?.totalPods || 0}
                      </h4>
                      <div className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-600 bg-green-50 rounded dark:bg-green-900/20 dark:text-green-400">
                        <ArrowTrendingUpIcon className="w-3 h-3" />
                        {resources?.runningPods || 0} running
                      </div>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Namespaces Card */}
              <Link 
                to={`/clusters/${clusterToShow}/namespaces`} 
                className="group rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] hover:shadow-lg transition-all duration-200 overflow-hidden"
              >
                <div className="flex items-center p-5 md:p-6">
                  <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-purple-50 rounded-xl dark:bg-purple-900/20 group-hover:scale-110 transition-transform flex-shrink-0">
                    <ViewColumnsIcon className="text-purple-600 w-6 h-6 sm:w-7 sm:h-7 dark:text-purple-400" />
                  </div>
                  <div className="ml-4 flex-1 min-w-0">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Namespaces</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <h4 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                        {resourcesLoading ? '...' : resources?.totalNamespaces || 0}
                      </h4>
                      <div className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-purple-600 bg-purple-50 rounded dark:bg-purple-900/20 dark:text-purple-400">
                        Active
                      </div>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Services Card */}
              <Link 
                to={`/clusters/${clusterToShow}/services`} 
                className="group rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] hover:shadow-lg transition-all duration-200 overflow-hidden"
              >
                <div className="flex items-center p-5 md:p-6">
                  <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-orange-50 rounded-xl dark:bg-orange-900/20 group-hover:scale-110 transition-transform flex-shrink-0">
                    <GlobeAltIcon className="text-orange-600 w-6 h-6 sm:w-7 sm:h-7 dark:text-orange-400" />
                  </div>
                  <div className="ml-4 flex-1 min-w-0">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Services</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <h4 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                        {resourcesLoading ? '...' : (resources?.totalServices ?? '-')}
                      </h4>
                      <div className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-orange-600 bg-orange-50 rounded dark:bg-orange-900/20 dark:text-orange-400">
                        Active
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* CPU and Memory Usage */}
          {hasCluster && clusterToShow && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Resource Usage
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* CPU Usage */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 bg-blue-50 rounded-lg dark:bg-blue-900/20">
                      <CpuChipIcon className="text-blue-600 size-5 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">CPU Usage</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {metricsLoading ? '...' : `${formatCPU(metrics?.cpu?.requests || 0)} / ${formatCPU(metrics?.cpu?.allocatable || 0)} cores`}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Requests</span>
                        <span className="text-xs font-medium text-gray-900 dark:text-white">
                          {calculatePercentage(metrics?.cpu?.requests || 0, metrics?.cpu?.allocatable || 0)}%
                        </span>
                      </div>
                      <div className="relative w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
                        <div 
                          className={`h-2.5 rounded-full transition-all duration-300 ${getUsageColor(parseFloat(calculatePercentage(metrics?.cpu?.requests || 0, metrics?.cpu?.allocatable || 0)), 'requests')}`}
                          style={{ width: `${Math.min(calculateBarWidth(parseFloat(calculatePercentage(metrics?.cpu?.requests || 0, metrics?.cpu?.allocatable || 0))), 100)}%` }}
                        >
                          {parseFloat(calculatePercentage(metrics?.cpu?.requests || 0, metrics?.cpu?.allocatable || 0)) > 100 && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Limits</span>
                        <span className={`text-xs font-medium ${parseFloat(calculatePercentage(metrics?.cpu?.limits || 0, metrics?.cpu?.allocatable || 0)) > 100 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                          {calculatePercentage(metrics?.cpu?.limits || 0, metrics?.cpu?.allocatable || 0)}%
                        </span>
                      </div>
                      <div className="relative w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
                        <div 
                          className={`h-2.5 rounded-full transition-all duration-300 ${getUsageColor(parseFloat(calculatePercentage(metrics?.cpu?.limits || 0, metrics?.cpu?.allocatable || 0)), 'limits')}`}
                          style={{ width: `${Math.min(calculateBarWidth(parseFloat(calculatePercentage(metrics?.cpu?.limits || 0, metrics?.cpu?.allocatable || 0))), 100)}%` }}
                        >
                          {parseFloat(calculatePercentage(metrics?.cpu?.limits || 0, metrics?.cpu?.allocatable || 0)) > 100 && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Memory Usage */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 bg-green-50 rounded-lg dark:bg-green-900/20">
                      <CircleStackIcon className="text-green-600 size-5 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Memory Usage</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {metricsLoading ? '...' : `${formatBytes(metrics?.memory?.requests || 0)} / ${formatBytes(metrics?.memory?.allocatable || 0)}`}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Requests</span>
                        <span className="text-xs font-medium text-gray-900 dark:text-white">
                          {calculatePercentage(metrics?.memory?.requests || 0, metrics?.memory?.allocatable || 0)}%
                        </span>
                      </div>
                      <div className="relative w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
                        <div 
                          className={`h-2.5 rounded-full transition-all duration-300 ${getMemoryColor(parseFloat(calculatePercentage(metrics?.memory?.requests || 0, metrics?.memory?.allocatable || 0)), 'requests')}`}
                          style={{ width: `${Math.min(calculateBarWidth(parseFloat(calculatePercentage(metrics?.memory?.requests || 0, metrics?.memory?.allocatable || 0))), 100)}%` }}
                        >
                          {parseFloat(calculatePercentage(metrics?.memory?.requests || 0, metrics?.memory?.allocatable || 0)) > 100 && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Limits</span>
                        <span className={`text-xs font-medium ${parseFloat(calculatePercentage(metrics?.memory?.limits || 0, metrics?.memory?.allocatable || 0)) > 100 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'}`}>
                          {calculatePercentage(metrics?.memory?.limits || 0, metrics?.memory?.allocatable || 0)}%
                        </span>
                      </div>
                      <div className="relative w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
                        <div 
                          className={`h-2.5 rounded-full transition-all duration-300 ${getMemoryColor(parseFloat(calculatePercentage(metrics?.memory?.limits || 0, metrics?.memory?.allocatable || 0)), 'limits')}`}
                          style={{ width: `${Math.min(calculateBarWidth(parseFloat(calculatePercentage(metrics?.memory?.limits || 0, metrics?.memory?.allocatable || 0))), 100)}%` }}
                        >
                          {parseFloat(calculatePercentage(metrics?.memory?.limits || 0, metrics?.memory?.allocatable || 0)) > 100 && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Cluster Info */}
        <div className="col-span-12 xl:col-span-5">
          {hasCluster && clusterToShow ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Cluster Information
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl dark:bg-gray-800/50">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Cluster Name</p>
                    <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">{clusterToShow}</p>
                  </div>
                  <ServerIcon className="w-8 h-8 text-gray-400" />
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl dark:bg-gray-800/50">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Version</p>
                    <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                      {clusters?.find((c: any) => c.name === clusterToShow)?.version || 'N/A'}
                    </p>
                  </div>
                  <CubeIcon className="w-8 h-8 text-gray-400" />
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl dark:bg-gray-800/50">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                    <div className="mt-2">
                      <span className={clsx(
                        'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium',
                        clusters?.find((c: any) => c.name === clusterToShow)?.status === 'connected' || 
                        clusters?.find((c: any) => c.name === clusterToShow)?.status === 'healthy'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}>
                        {clusters?.find((c: any) => c.name === clusterToShow)?.status || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <div className={clsx(
                    'w-3 h-3 rounded-full',
                    clusters?.find((c: any) => c.name === clusterToShow)?.status === 'connected' || 
                    clusters?.find((c: any) => c.name === clusterToShow)?.status === 'healthy'
                      ? 'bg-green-500 animate-pulse'
                      : 'bg-red-500'
                  )} />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
