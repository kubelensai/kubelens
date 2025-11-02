import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getClusters, getPods } from '@/services/api'
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import clsx from 'clsx'
import { 
  CubeIcon, 
  CpuChipIcon, 
  CircleStackIcon,
  EyeIcon,
  CommandLineIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import api from '@/services/api'
import { formatAge } from '@/utils/format'

interface PodMetrics {
  [podKey: string]: {
    cpuUsage: number
    memoryUsage: number
    cpuRequests: number
    memoryRequests: number
    cpuLimits: number
    memoryLimits: number
  }
}

interface PodData {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
    labels?: Record<string, string>
  }
  spec?: {
    nodeName?: string
    containers?: Array<{
      name: string
      resources?: {
        requests?: Record<string, string>
        limits?: Record<string, string>
      }
    }>
  }
  status?: {
    phase?: string
    conditions?: Array<{ type: string; status: string }>
    containerStatuses?: Array<{
      name: string
      restartCount: number
      state?: any
    }>
    qosClass?: string
  }
  clusterName: string
}

export default function Pods() {
  const { cluster, namespace: namespaceFromRoute } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const namespaceFromQuery = searchParams.get('namespace')
  // Use namespace from route params first, then fall back to query params
  const namespace = namespaceFromRoute || namespaceFromQuery || undefined
  const [podMetrics, setPodMetrics] = useState<PodMetrics>({})
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; pod: PodData | null }>({ isOpen: false, pod: null })
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch pods from all clusters or specific cluster/namespace
  const { data: allPods, isLoading, refetch } = useQuery({
    queryKey: namespace 
      ? ['pods', cluster, namespace]
      : cluster 
        ? ['pods', cluster] 
        : ['all-pods', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const pods = await getPods(cluster, namespace)
        return pods.map((pod: any) => ({ ...pod, clusterName: cluster, namespace }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const pods = await getPods(cluster)
        return pods.map((pod: any) => ({ ...pod, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allPods = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const pods = await getPods(cluster.name)
            return pods.map((pod: any) => ({ ...pod, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching pods from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allPods.flat()
    },
    enabled: cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  })

  // Track visible pods to fetch metrics only for them
  const [visiblePods, setVisiblePods] = useState<PodData[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Callback to receive paginated data from DataTable
  const handlePaginatedDataChange = useCallback((paginatedPods: PodData[]) => {
    console.log(`[Pods] Paginated data changed: ${paginatedPods.length} visible pods`)
    setVisiblePods(paginatedPods)
  }, [])
  
  // Fetch metrics when visible pods change
  useEffect(() => {
    if (visiblePods.length > 0) {
      // Cancel previous fetch if still running
      if (abortControllerRef.current) {
        console.log('[Pods] Cancelling previous metrics fetch')
        abortControllerRef.current.abort()
      }
      
      // Create new abort controller for this fetch
      abortControllerRef.current = new AbortController()
      
      console.log(`[Pods] Fetching metrics for ${visiblePods.length} visible pods`)
      fetchPodMetrics(visiblePods, abortControllerRef.current.signal)
      
      // Clear existing interval
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current)
      }
      
      // Set up periodic metrics refresh for visible pods (every 5 seconds)
      metricsIntervalRef.current = setInterval(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()
        console.log(`[Pods] Auto-refreshing metrics for ${visiblePods.length} visible pods`)
        fetchPodMetrics(visiblePods, abortControllerRef.current.signal)
      }, 5000)
      
      // Cleanup on unmount or when visible pods change
      return () => {
        if (metricsIntervalRef.current) {
          clearInterval(metricsIntervalRef.current)
        }
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
      }
    }
  }, [visiblePods])

  // Fetch metrics only for specific pods (visible on current page)
  const fetchPodMetrics = async (pods: PodData[], signal?: AbortSignal) => {
    if (!pods || pods.length === 0) return
    
    const metricsMap: PodMetrics = {}
    
    try {
      // Fetch metrics for all visible pods in parallel
      await Promise.all(
      pods.map(async (pod: any) => {
        // Check if request was aborted
        if (signal?.aborted) {
          console.log(`[Pods] Fetch aborted for pod: ${pod.metadata.name}`)
          return
        }
        
        try {
          // Calculate requests and limits from pod spec (no API call needed)
          let totalCpuRequests = 0
          let totalMemoryRequests = 0
          let totalCpuLimits = 0
          let totalMemoryLimits = 0
          
          pod.spec?.containers?.forEach((container: any) => {
            if (container.resources?.requests?.cpu) {
              const cpuStr = container.resources.requests.cpu
              if (cpuStr.endsWith('m')) {
                totalCpuRequests += parseInt(cpuStr.replace('m', ''))
              } else {
                totalCpuRequests += parseFloat(cpuStr) * 1000
              }
            }
            
            if (container.resources?.requests?.memory) {
              const memStr = container.resources.requests.memory
              if (memStr.endsWith('Ki')) {
                totalMemoryRequests += parseInt(memStr.replace('Ki', '')) * 1024
              } else if (memStr.endsWith('Mi')) {
                totalMemoryRequests += parseInt(memStr.replace('Mi', '')) * 1024 * 1024
              } else if (memStr.endsWith('Gi')) {
                totalMemoryRequests += parseInt(memStr.replace('Gi', '')) * 1024 * 1024 * 1024
              } else {
                totalMemoryRequests += parseInt(memStr)
              }
            }
            
            if (container.resources?.limits?.cpu) {
              const cpuStr = container.resources.limits.cpu
              if (cpuStr.endsWith('m')) {
                totalCpuLimits += parseInt(cpuStr.replace('m', ''))
              } else {
                totalCpuLimits += parseFloat(cpuStr) * 1000
              }
            }
            
            if (container.resources?.limits?.memory) {
              const memStr = container.resources.limits.memory
              if (memStr.endsWith('Ki')) {
                totalMemoryLimits += parseInt(memStr.replace('Ki', '')) * 1024
              } else if (memStr.endsWith('Mi')) {
                totalMemoryLimits += parseInt(memStr.replace('Mi', '')) * 1024 * 1024
              } else if (memStr.endsWith('Gi')) {
                totalMemoryLimits += parseInt(memStr.replace('Gi', '')) * 1024 * 1024 * 1024
              } else {
                totalMemoryLimits += parseInt(memStr)
              }
            }
          })
          
          // Fetch actual usage from metrics API
          let totalCpu = 0
          let totalMemory = 0
          
          try {
            const response = await api.get(`/clusters/${pod.clusterName}/namespaces/${pod.metadata.namespace}/pods/${pod.metadata.name}/metrics`)
            const data = response.data
            
            if (data && data.containers) {
              data.containers.forEach((container: any) => {
                if (container.usage) {
                  // Parse CPU (e.g., "10m" or "0.01")
                  const cpuStr = container.usage.cpu || '0'
                  if (cpuStr.endsWith('m')) {
                    totalCpu += parseInt(cpuStr.replace('m', ''))
                  } else if (cpuStr.endsWith('n')) {
                    totalCpu += parseInt(cpuStr.replace('n', '')) / 1000000
                  } else {
                    totalCpu += parseFloat(cpuStr) * 1000
                  }
                  
                  // Parse Memory (e.g., "128Mi" or "134217728")
                  const memStr = container.usage.memory || '0'
                  if (memStr.endsWith('Ki')) {
                    totalMemory += parseInt(memStr.replace('Ki', '')) * 1024
                  } else if (memStr.endsWith('Mi')) {
                    totalMemory += parseInt(memStr.replace('Mi', '')) * 1024 * 1024
                  } else if (memStr.endsWith('Gi')) {
                    totalMemory += parseInt(memStr.replace('Gi', '')) * 1024 * 1024 * 1024
                  } else {
                    totalMemory += parseInt(memStr)
                  }
                }
              })
            }
          } catch (error) {
            // Metrics API might not be available, continue with 0 usage
          }
          
          metricsMap[`${pod.clusterName}-${pod.metadata.namespace}-${pod.metadata.name}`] = {
            cpuUsage: totalCpu,
            memoryUsage: totalMemory,
            cpuRequests: totalCpuRequests,
            memoryRequests: totalMemoryRequests,
            cpuLimits: totalCpuLimits,
            memoryLimits: totalMemoryLimits
          }
        } catch (error) {
          // Silently fail for individual pods
        }
      })
    )
    
      // Update metrics state (only if not aborted)
      if (!signal?.aborted) {
        console.log(`[Pods] Setting metrics for ${Object.keys(metricsMap).length} pods`)
        // Force a new object reference to trigger React re-render
        setPodMetrics({ ...metricsMap })
      } else {
        console.log('[Pods] Fetch was aborted, not updating metrics')
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[Pods] Fetch aborted')
      } else {
        console.error('[Pods] Error fetching metrics:', error)
      }
    }
  }

  // Helper functions
  const getPodStatus = (pod: PodData) => {
    return pod.status?.phase || 'Unknown'
  }

  const isPodReady = (pod: PodData) => {
    const conditions = pod.status?.conditions || []
    return conditions.some((c) => c.type === 'Ready' && c.status === 'True')
  }

  const getTotalRestarts = (pod: PodData) => {
    const containerStatuses = pod.status?.containerStatuses || []
    return containerStatuses.reduce((sum, container) => sum + (container.restartCount || 0), 0)
  }

  const getContainerCount = (pod: PodData) => {
    const containers = pod.spec?.containers || []
    const containerStatuses = pod.status?.containerStatuses || []
    const readyCount = containerStatuses.filter((c) => c.state?.running).length
    return `${readyCount}/${containers.length}`
  }

  const formatCPU = (millicores: number): string => {
    if (millicores >= 1000) {
      return `${(millicores / 1000).toFixed(2)} cores`
    }
    return `${millicores.toFixed(0)}m`
  }

  const formatMemory = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    } else if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    }
    return `${(bytes / 1024).toFixed(2)} KB`
  }

  // Action handlers
  const handleViewDetails = (pod: PodData) => {
    navigate(`/clusters/${pod.clusterName}/namespaces/${pod.metadata.namespace}/pods/${pod.metadata.name}`)
  }

  const handleDelete = async () => {
    if (!deleteModal.pod) return
    
    try {
      await api.delete(`/clusters/${deleteModal.pod.clusterName}/namespaces/${deleteModal.pod.metadata.namespace}/pods/${deleteModal.pod.metadata.name}`)
      setDeleteModal({ isOpen: false, pod: null })
      refetch()
    } catch (error: any) {
      console.error('Failed to delete pod:', error)
      alert(`Failed to delete pod: ${error.message || 'Unknown error'}`)
    }
  }

  // Define columns
  const columns = useMemo<Column<PodData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (pod) => (
        <div className="flex items-center gap-2">
          <CubeIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/clusters/${pod.clusterName}/namespaces/${pod.metadata.namespace}/pods/${pod.metadata.name}`)
              }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate text-left"
            >
              {pod.metadata.name}
            </button>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {pod.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (pod) => pod.metadata.name,
      searchValue: (pod) => `${pod.metadata.name} ${pod.clusterName}`,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (pod) => (
        <button
          onClick={async (e) => {
            e.stopPropagation()
            try {
              await api.put('/session', {
                selected_cluster: pod.clusterName,
                selected_namespace: pod.metadata.namespace
              })
              // Navigate to pods page with namespace in route
              navigate(`/clusters/${pod.clusterName}/namespaces/${pod.metadata.namespace}/pods`)
              // Force refetch after navigation
              setTimeout(() => refetch(), 100)
            } catch (error) {
              console.error('Failed to update session:', error)
            }
          }}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          {pod.metadata.namespace}
        </button>
      ),
      sortable: true,
      sortValue: (pod) => pod.metadata.namespace,
      searchValue: (pod) => pod.metadata.namespace,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (pod) => {
        const status = getPodStatus(pod)
        const ready = isPodReady(pod)
        const isRunning = status === 'Running'
        const isSucceeded = status === 'Succeeded'
        const isFailed = status === 'Failed'
        const isPending = status === 'Pending'
        
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
            isRunning && ready
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : isSucceeded
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
              : isFailed
              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              : isPending
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
          )}>
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full',
              isRunning && ready ? 'bg-green-600 dark:bg-green-400' :
              isSucceeded ? 'bg-blue-600 dark:bg-blue-400' :
              isFailed ? 'bg-red-600 dark:bg-red-400' :
              isPending ? 'bg-yellow-600 dark:bg-yellow-400' :
              'bg-gray-600 dark:bg-gray-400'
            )} />
            {status}
          </span>
        )
      },
      sortable: true,
      sortValue: (pod) => getPodStatus(pod),
      searchValue: (pod) => getPodStatus(pod),
      filterable: true,
      filterOptions: (data) => {
        const statuses = new Set(data.map(pod => getPodStatus(pod)))
        return Array.from(statuses).sort()
      },
      filterValue: (pod) => getPodStatus(pod),
    },
    {
      key: 'containers',
      header: 'Containers',
      accessor: (pod) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {getContainerCount(pod)}
        </span>
      ),
      sortable: true,
      sortValue: (pod) => {
        const [ready, total] = getContainerCount(pod).split('/').map(Number)
        return ready / (total || 1)
      },
      searchValue: (pod) => getContainerCount(pod),
    },
    {
      key: 'restarts',
      header: 'Restarts',
      accessor: (pod) => {
        const restarts = getTotalRestarts(pod)
        return (
          <span className={clsx(
            'text-sm font-medium',
            restarts > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'
          )}>
            {restarts}
          </span>
        )
      },
      sortable: true,
      sortValue: (pod) => getTotalRestarts(pod),
      searchValue: (pod) => getTotalRestarts(pod).toString(),
    },
    {
      key: 'cpu',
      header: 'CPU',
      accessor: (pod) => {
        const metrics = podMetrics[`${pod.clusterName}-${pod.metadata.namespace}-${pod.metadata.name}`]
        
        if (!metrics) {
          return <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
        }
        
        const cpuUsage = metrics.cpuUsage || 0
        const cpuLimit = metrics.cpuLimits || 0
        
        // Calculate utilization percentage (usage/limit)
        const utilization = cpuLimit > 0 
          ? Math.min((cpuUsage / cpuLimit) * 100, 100)
          : 0

        return (
          <div className="w-full min-w-[120px]">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <CpuChipIcon className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 font-mono">
                  {formatCPU(cpuUsage)}
                </span>
              </div>
              {cpuLimit > 0 ? (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {utilization.toFixed(0)}%
                </span>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                  No Limit
                </span>
              )}
            </div>
            {cpuLimit > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 overflow-hidden">
                <div
                  className={clsx(
                    'h-1.5 rounded-full transition-all duration-300',
                    utilization >= 90 ? 'bg-red-600 dark:bg-red-500' :
                    utilization >= 75 ? 'bg-orange-600 dark:bg-orange-500' :
                    'bg-blue-600 dark:bg-blue-500'
                  )}
                  style={{ width: `${utilization}%` }}
                />
              </div>
            )}
          </div>
        )
      },
      sortable: true,
      sortValue: (pod) => {
        const metrics = podMetrics[`${pod.clusterName}-${pod.metadata.namespace}-${pod.metadata.name}`]
        return metrics?.cpuUsage || 0
      },
      searchValue: (pod) => {
        const metrics = podMetrics[`${pod.clusterName}-${pod.metadata.namespace}-${pod.metadata.name}`]
        return metrics ? formatCPU(metrics.cpuUsage) : ''
      },
    },
    {
      key: 'memory',
      header: 'Memory',
      accessor: (pod) => {
        const metrics = podMetrics[`${pod.clusterName}-${pod.metadata.namespace}-${pod.metadata.name}`]
        
        if (!metrics) {
          return <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
        }
        
        const memoryUsage = metrics.memoryUsage || 0
        const memoryLimit = metrics.memoryLimits || 0
        
        // Calculate utilization percentage (usage/limit)
        const utilization = memoryLimit > 0 
          ? Math.min((memoryUsage / memoryLimit) * 100, 100)
          : 0

        return (
          <div className="w-full min-w-[120px]">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <CircleStackIcon className="w-4 h-4 text-green-500 dark:text-green-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 font-mono">
                  {formatMemory(memoryUsage)}
                </span>
              </div>
              {memoryLimit > 0 ? (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {utilization.toFixed(0)}%
                </span>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                  No Limit
                </span>
              )}
            </div>
            {memoryLimit > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 overflow-hidden">
                <div
                  className={clsx(
                    'h-1.5 rounded-full transition-all duration-300',
                    utilization >= 90 ? 'bg-red-600 dark:bg-red-500' :
                    utilization >= 75 ? 'bg-orange-600 dark:bg-orange-500' :
                    'bg-green-600 dark:bg-green-500'
                  )}
                  style={{ width: `${utilization}%` }}
                />
              </div>
            )}
          </div>
        )
      },
      sortable: true,
      sortValue: (pod) => {
        const metrics = podMetrics[`${pod.clusterName}-${pod.metadata.namespace}-${pod.metadata.name}`]
        return metrics?.memoryUsage || 0
      },
      searchValue: (pod) => {
        const metrics = podMetrics[`${pod.clusterName}-${pod.metadata.namespace}-${pod.metadata.name}`]
        return metrics ? formatMemory(metrics.memoryUsage) : ''
      },
    },
    {
      key: 'node',
      header: 'Node',
      accessor: (pod) => {
        const nodeName = pod.spec?.nodeName
        if (!nodeName) {
          return <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
        }
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${pod.clusterName}/nodes/${nodeName}`)
            }}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate"
          >
            {nodeName}
          </button>
        )
      },
      sortable: true,
      sortValue: (pod) => pod.spec?.nodeName || '',
      searchValue: (pod) => pod.spec?.nodeName || '',
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (pod) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(pod.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (pod) => new Date(pod.metadata.creationTimestamp).getTime(),
      searchValue: (pod) => formatAge(pod.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (pod) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleViewDetails(pod)
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${pod.clusterName}/namespaces/${pod.metadata.namespace}/pods/${pod.metadata.name}?tab=terminal`)
            }}
            className="p-1.5 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
            title="Shell"
          >
            <CommandLineIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${pod.clusterName}/namespaces/${pod.metadata.namespace}/pods/${pod.metadata.name}?tab=logs`)
            }}
            className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
            title="Logs"
          >
            <DocumentTextIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${pod.clusterName}/namespaces/${pod.metadata.namespace}/pods/${pod.metadata.name}?tab=yaml`)
            }}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setDeleteModal({ isOpen: true, pod })
            }}
            className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
      sortable: false,
    },
  ], [cluster, namespace, podMetrics, navigate, refetch])

  return (
    <div className="space-y-4 md:space-y-6">
      <Breadcrumb
        items={[
          ...(cluster ? [{ name: cluster, href: `/clusters/${cluster}` }] : []),
          ...(namespace ? [{ name: namespace, href: `/clusters/${cluster}/namespaces/${namespace}` }] : []),
          { name: 'Pods' }
        ]}
      />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
          Pods
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage and monitor your Kubernetes pods
        </p>
      </div>
      
      <DataTable
        data={allPods || []}
        columns={columns}
        keyExtractor={(pod) => `${pod.clusterName}-${pod.metadata.namespace}-${pod.metadata.name}`}
        searchPlaceholder="Search pods by name, cluster, namespace, status, node..."
        isLoading={isLoading}
        emptyMessage="No pods found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <CubeIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        pageSize={10}
        pageSizeOptions={[10, 20, 50, 100]}
        onPaginatedDataChange={handlePaginatedDataChange}
        mobileCardRenderer={(pod) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <CubeIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white truncate">
                    {pod.metadata.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {pod.metadata.namespace}
                  </div>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {pod.clusterName}
                    </div>
                  )}
                </div>
              </div>
              <span className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full shrink-0',
                getPodStatus(pod) === 'Running' && isPodReady(pod)
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : getPodStatus(pod) === 'Succeeded'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                  : getPodStatus(pod) === 'Failed'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
              )}>
                <span className={clsx(
                  'w-1.5 h-1.5 rounded-full',
                  getPodStatus(pod) === 'Running' && isPodReady(pod) ? 'bg-green-600' :
                  getPodStatus(pod) === 'Succeeded' ? 'bg-blue-600' :
                  getPodStatus(pod) === 'Failed' ? 'bg-red-600' :
                  'bg-yellow-600'
                )} />
                {getPodStatus(pod)}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Containers:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{getContainerCount(pod)}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Restarts:</span>
                <span className={clsx(
                  'ml-1 font-medium',
                  getTotalRestarts(pod) > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-white'
                )}>
                  {getTotalRestarts(pod)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">CPU:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">
                  {(() => {
                    const metrics = podMetrics[`${pod.clusterName}-${pod.metadata.namespace}-${pod.metadata.name}`]
                    return metrics ? formatCPU(metrics.cpuUsage) : '-'
                  })()}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Memory:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">
                  {(() => {
                    const metrics = podMetrics[`${pod.clusterName}-${pod.metadata.namespace}-${pod.metadata.name}`]
                    return metrics ? formatMemory(metrics.memoryUsage) : '-'
                  })()}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 dark:text-gray-400">Node:</span>
                <span className="ml-1 text-gray-900 dark:text-white text-xs truncate">
                  {pod.spec?.nodeName || '-'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(pod.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleViewDetails(pod)
                  }}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="View Details"
                >
                  <EyeIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${pod.clusterName}/namespaces/${pod.metadata.namespace}/pods/${pod.metadata.name}?tab=terminal`)
                  }}
                  className="p-1.5 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                  title="Shell"
                >
                  <CommandLineIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${pod.clusterName}/namespaces/${pod.metadata.namespace}/pods/${pod.metadata.name}?tab=logs`)
                  }}
                  className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                  title="Logs"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/clusters/${pod.clusterName}/namespaces/${pod.metadata.namespace}/pods/${pod.metadata.name}?tab=yaml`)
                  }}
                  className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Edit YAML"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteModal({ isOpen: true, pod })
                  }}
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

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, pod: null })}
        onConfirm={handleDelete}
        title="Delete Pod"
        message={`Are you sure you want to delete pod "${deleteModal.pod?.metadata.name}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
      />
    </div>
  )
}
