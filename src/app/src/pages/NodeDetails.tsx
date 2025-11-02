import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ServerIcon,
  CpuChipIcon,
  CircleStackIcon,
  CubeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import Breadcrumb from '@/components/shared/Breadcrumb'
import YamlEditor from '@/components/shared/YamlEditor'
import Terminal from '@/components/shared/Terminal'
import { DataTable, Column } from '@/components/shared/DataTable'
import api from '@/services/api'
import yaml from 'js-yaml'

interface NodeDetailsProps {}

type TabType = 'overview' | 'yaml' | 'pods' | 'terminal' | 'events'

export default function NodeDetails({}: NodeDetailsProps) {
  const { cluster, nodeName } = useParams<{ cluster: string; nodeName: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [node, setNode] = useState<any>(null)
  const [nodeMetrics, setNodeMetrics] = useState<any>(null)
  const [pods, setPods] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [yamlContent, setYamlContent] = useState('')
  const [expandedSections, setExpandedSections] = useState({
    labels: false,
    taints: false,
    annotations: false,
    falseConditions: false,
  })

  useEffect(() => {
    if (cluster && nodeName) {
      fetchNodeDetails()
    }
  }, [cluster, nodeName])

  // Auto-refresh pods when Pods tab is active
  useEffect(() => {
    if (activeTab !== 'pods' || !cluster || !nodeName) return

    const refreshPods = async () => {
      try {
        // Use field selector for server-side filtering (Best Practice: 10-100x faster)
        const podsRes = await api.get(`/clusters/${cluster}/pods?nodeName=${nodeName}`)
        const podsData = podsRes.data || []
        // No need to filter - API already returns only pods on this node
        setPods(podsData)
      } catch (error) {
        console.error('Failed to refresh pods:', error)
      }
    }

    // Initial fetch
    refreshPods()

    // Set up interval for auto-refresh every 5 seconds
    const intervalId = setInterval(refreshPods, 5000)

    // Cleanup on unmount or when dependencies change
    return () => clearInterval(intervalId)
  }, [activeTab, cluster, nodeName])

  const fetchNodeDetails = async () => {
    try {
      setIsLoading(true)
      const [nodeRes, metricsRes, podsRes, eventsRes] = await Promise.all([
        api.get(`/clusters/${cluster}/nodes/${nodeName}`),
        api.get(`/clusters/${cluster}/nodes/${nodeName}/metrics`).catch(() => ({ data: null })),
        // Use field selector for server-side filtering (Best Practice: 10-100x faster than client-side)
        api.get(`/clusters/${cluster}/pods?nodeName=${nodeName}`).catch(() => ({ data: [] })),
        api.get(`/clusters/${cluster}/events`).catch(() => ({ data: [] })),
      ])

      const nodeData = nodeRes.data
      const metricsData = metricsRes.data
      const podsData = podsRes.data || []
      const eventsData = eventsRes.data || []

      setNode(nodeData)
      setNodeMetrics(metricsData)
      // No need to filter - API already returns only pods on this node using field selector
      setPods(podsData)
      
      // Filter events related to this node
      // Include events where:
      // 1. InvolvedObject is the node itself
      // 2. Source.host matches the node name
      // 3. Message mentions the node name
      const nodeEvents = eventsData.filter((event: any) => {
        if (!nodeName) return false
        
        const involvedObjectMatch = event.involvedObject?.kind === 'Node' && event.involvedObject?.name === nodeName
        const sourceHostMatch = event.source?.host === nodeName
        const messageMatch = event.message?.toLowerCase().includes(nodeName.toLowerCase())
        
        return involvedObjectMatch || sourceHostMatch || messageMatch
      })
      
      console.log('Total events:', eventsData.length)
      console.log('Node events:', nodeEvents.length)
      console.log('Node name:', nodeName)
      
      setEvents(nodeEvents)
      
      // Format as Kubernetes manifest
      const k8sManifest = {
        apiVersion: nodeData.apiVersion || 'v1',
        kind: nodeData.kind || 'Node',
        metadata: nodeData.metadata,
        spec: nodeData.spec,
        status: nodeData.status,
      }
      setYamlContent(yaml.dump(k8sManifest, { indent: 2, lineWidth: -1, sortKeys: false }))
    } catch (error) {
      console.error('Failed to fetch node details:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const parseK8sResource = (value: string): number => {
    if (!value) return 0
    // Handle CPU: "4" or "4000m"
    if (value.endsWith('m')) {
      return parseInt(value.replace('m', ''))
    }
    // Handle Memory: "16Gi", "1024Mi", "1048576Ki"
    if (value.endsWith('Ki')) {
      return parseInt(value.replace('Ki', '')) * 1024
    }
    if (value.endsWith('Mi')) {
      return parseInt(value.replace('Mi', '')) * 1024 * 1024
    }
    if (value.endsWith('Gi')) {
      return parseInt(value.replace('Gi', '')) * 1024 * 1024 * 1024
    }
    // Plain number (CPU cores or bytes)
    const num = parseFloat(value)
    return isNaN(num) ? 0 : num
  }

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const formatCPU = (millicores: number) => {
    if (!millicores || millicores === 0) return '0m'
    if (millicores < 1000) return `${millicores}m`
    return `${(millicores / 1000).toFixed(2)} cores`
  }

  const calculatePercentage = (used: number, total: number) => {
    if (!total || total === 0) return 0
    return Math.min((used / total) * 100, 100)
  }

  const getConditionIcon = (status: string, type: string) => {
    if (type === 'Ready' && status === 'True') {
      return <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
    }
    if (status === 'True') {
      return <ExclamationCircleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
    }
    return <XCircleIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
  }

  const formatAge = (timestamp: string) => {
    const now = new Date().getTime()
    const created = new Date(timestamp).getTime()
    const diff = now - created
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const getStatusBadge = (pod: any) => {
    const phase = pod.status?.phase || 'Unknown'
    const colorMap: Record<string, string> = {
      Running: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
      Pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
      Succeeded: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
      Failed: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
      Unknown: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    }
    return (
      <span className={clsx('px-2 py-1 rounded-full text-xs font-medium', colorMap[phase] || colorMap.Unknown)}>
        {phase}
      </span>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'yaml', label: 'YAML' },
    { id: 'pods', label: 'Pods' },
    { id: 'terminal', label: 'Terminal' },
    { id: 'events', label: 'Events' },
  ]

  // Separate conditions into True and False
  const trueConditions = useMemo(() => {
    return node?.status?.conditions?.filter((c: any) => c.status === 'True') || []
  }, [node])

  const falseConditions = useMemo(() => {
    return node?.status?.conditions?.filter((c: any) => c.status !== 'True') || []
  }, [node])

  // Handle pod row click - navigate to Pod details page
  const handlePodClick = (pod: any) => {
    const podName = pod.metadata?.name
    const namespace = pod.metadata?.namespace
    if (cluster && namespace && podName) {
      // Navigate to pod details page with correct route pattern
      navigate(`/clusters/${cluster}/namespaces/${namespace}/pods/${podName}`)
    }
  }

  // Pod columns for DataTable
  const podColumns: Column<any>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (pod) => (
        <span className="text-sm font-medium text-gray-900 dark:text-white break-all">
          {pod.metadata?.name}
        </span>
      ),
      sortable: true,
      sortValue: (pod) => pod.metadata?.name || '',
      searchValue: (pod) => pod.metadata?.name || '',
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (pod) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {pod.metadata?.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (pod) => pod.metadata?.namespace || '',
      searchValue: (pod) => pod.metadata?.namespace || '',
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (pod) => getStatusBadge(pod),
      sortable: true,
      sortValue: (pod) => pod.status?.phase || 'Unknown',
      searchValue: (pod) => pod.status?.phase || 'Unknown',
    },
    {
      key: 'restarts',
      header: 'Restarts',
      accessor: (pod) => {
        const restarts = pod.status?.containerStatuses?.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0) || 0
        return (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {restarts}
          </span>
        )
      },
      sortable: true,
      sortValue: (pod) => pod.status?.containerStatuses?.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0) || 0,
      searchValue: (pod) => String(pod.status?.containerStatuses?.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0) || 0),
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (pod) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(pod.metadata?.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (pod) => new Date(pod.metadata?.creationTimestamp).getTime(),
      searchValue: (pod) => formatAge(pod.metadata?.creationTimestamp),
    },
  ], [])

  // Event columns for DataTable
  const eventColumns: Column<any>[] = useMemo(() => [
    {
      key: 'type',
      header: 'Type',
      accessor: (event) => {
        const type = event.type || 'Normal'
        return (
          <span className={clsx(
            'px-2 py-1 rounded-full text-xs font-medium',
            type === 'Warning' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
            type === 'Error' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
            'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
          )}>
            {type}
          </span>
        )
      },
      sortable: true,
      sortValue: (event) => event.type || 'Normal',
      searchValue: (event) => event.type || 'Normal',
    },
    {
      key: 'reason',
      header: 'Reason',
      accessor: (event) => (
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {event.reason}
        </span>
      ),
      sortable: true,
      sortValue: (event) => event.reason || '',
      searchValue: (event) => event.reason || '',
    },
    {
      key: 'message',
      header: 'Message',
      accessor: (event) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
          {event.message}
        </span>
      ),
      sortable: false,
      searchValue: (event) => event.message || '',
    },
    {
      key: 'count',
      header: 'Count',
      accessor: (event) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {event.count || 1}
        </span>
      ),
      sortable: true,
      sortValue: (event) => event.count || 1,
      searchValue: (event) => String(event.count || 1),
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (event) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(event.lastTimestamp || event.metadata?.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (event) => new Date(event.lastTimestamp || event.metadata?.creationTimestamp).getTime(),
      searchValue: (event) => formatAge(event.lastTimestamp || event.metadata?.creationTimestamp),
    },
  ], [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!node) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Node not found</p>
      </div>
    )
  }

  // Parse resource values from API
  // Metrics API returns: { capacity: { cpu: millicores, memory: bytes }, usage: { cpu: millicores, memory: bytes } }
  const cpuCapacity = nodeMetrics?.capacity?.cpu || 0 // millicores
  const cpuAllocatable = parseK8sResource(node.status?.allocatable?.cpu || '0') // parse from node
  const cpuUsage = nodeMetrics?.usage?.cpu || 0 // millicores

  const memCapacity = nodeMetrics?.capacity?.memory || 0 // bytes
  const memAllocatable = parseK8sResource(node.status?.allocatable?.memory || '0') // parse from node
  const memUsage = nodeMetrics?.usage?.memory || 0 // bytes

  const podCapacity = parseInt(node.status?.capacity?.pods || '0')
  const podAllocatable = parseInt(node.status?.allocatable?.pods || '0')
  const podUsage = pods.length

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { name: cluster || 'Cluster', href: `/clusters/${cluster}` },
          { name: 'Nodes', href: `/clusters/${cluster}/nodes` },
          { name: nodeName || 'Node' },
        ]}
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
          <ServerIcon className="h-8 w-8" />
          {nodeName}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Detailed information and management for this node
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={clsx(
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <>
            {/* Node Information */}
            <div className="card">
              <div className="p-6 space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Node Information
                </h3>

                {/* Basic Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Name</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white break-all">
                      {node.metadata?.name}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Version</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {node.status?.nodeInfo?.kubeletVersion}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">OS</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {node.status?.nodeInfo?.osImage}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Architecture</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {node.status?.nodeInfo?.architecture}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Container Runtime</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white break-all">
                      {node.status?.nodeInfo?.containerRuntimeVersion}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Kernel Version</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {node.status?.nodeInfo?.kernelVersion}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Internal IP</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                      {node.status?.addresses?.find((a: any) => a.type === 'InternalIP')?.address || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Hostname</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {node.status?.addresses?.find((a: any) => a.type === 'Hostname')?.address || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Collapsible Sections */}
                {/* Labels */}
                {node.metadata?.labels && Object.keys(node.metadata.labels).length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <button
                      onClick={() => toggleSection('labels')}
                      className="flex items-center justify-between w-full text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded-lg transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Labels ({Object.keys(node.metadata.labels).length})
                      </span>
                      {expandedSections.labels ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                    {expandedSections.labels && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(node.metadata.labels).map(([key, value]: [string, any]) => (
                          <span
                            key={key}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                          >
                            <span className="font-semibold">{key}</span>
                            <span className="mx-1.5 text-blue-400">:</span>
                            <span>{value}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Taints */}
                {node.spec?.taints && node.spec.taints.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <button
                      onClick={() => toggleSection('taints')}
                      className="flex items-center justify-between w-full text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded-lg transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Taints ({node.spec.taints.length})
                      </span>
                      {expandedSections.taints ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                    {expandedSections.taints && (
                      <div className="mt-3 space-y-2">
                        {node.spec.taints.map((taint: any, index: number) => (
                          <div
                            key={index}
                            className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                          >
                            <p className="text-sm font-medium text-red-900 dark:text-red-300">
                              <span className="font-semibold">{taint.key}</span>
                              {taint.value && <span>={taint.value}</span>}
                              <span className="text-red-600 dark:text-red-400"> : {taint.effect}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Annotations */}
                {node.metadata?.annotations && Object.keys(node.metadata.annotations).length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <button
                      onClick={() => toggleSection('annotations')}
                      className="flex items-center justify-between w-full text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded-lg transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Annotations ({Object.keys(node.metadata.annotations).length})
                      </span>
                      {expandedSections.annotations ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                    {expandedSections.annotations && (
                      <div className="mt-3 space-y-2">
                        {Object.entries(node.metadata.annotations).map(([key, value]: [string, any]) => (
                          <div
                            key={key}
                            className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                          >
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 break-all mb-1">
                              {key}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 break-all">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Resource Capacity */}
            <div className="card">
              <div className="p-6 space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Resource Capacity
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* CPU */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-900/10 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-blue-600 dark:bg-blue-500">
                        <CpuChipIcon className="h-6 w-6 text-white" />
                      </div>
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white">CPU</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Capacity</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {formatCPU(cpuCapacity)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Allocatable</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {formatCPU(cpuAllocatable)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Usage</span>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                          {formatCPU(cpuUsage)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 shadow-lg"
                          style={{
                            width: `${calculatePercentage(cpuUsage, cpuAllocatable)}%`,
                          }}
                        />
                      </div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 text-center">
                        {calculatePercentage(cpuUsage, cpuAllocatable).toFixed(1)}% utilized
                      </p>
                    </div>
                  </div>

                  {/* Memory */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-900/10 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-green-600 dark:bg-green-500">
                        <CircleStackIcon className="h-6 w-6 text-white" />
                      </div>
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white">Memory</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Capacity</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {formatBytes(memCapacity)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Allocatable</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {formatBytes(memAllocatable)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Usage</span>
                        <span className="text-sm font-bold text-green-600 dark:text-green-400">
                          {formatBytes(memUsage)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
                        <div
                          className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500 shadow-lg"
                          style={{
                            width: `${calculatePercentage(memUsage, memAllocatable)}%`,
                          }}
                        />
                      </div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 text-center">
                        {calculatePercentage(memUsage, memAllocatable).toFixed(1)}% utilized
                      </p>
                    </div>
                  </div>

                  {/* Pods */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-900/10 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-purple-600 dark:bg-purple-500">
                        <CubeIcon className="h-6 w-6 text-white" />
                      </div>
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white">Pods</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Capacity</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {podCapacity}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Allocatable</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {podAllocatable}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Usage</span>
                        <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                          {podUsage}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all duration-500 shadow-lg"
                          style={{
                            width: `${calculatePercentage(podUsage, podAllocatable)}%`,
                          }}
                        />
                      </div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 text-center">
                        {calculatePercentage(podUsage, podAllocatable).toFixed(1)}% utilized
                      </p>
                    </div>
                  </div>

                  {/* Storage */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-900/10 border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-lg bg-orange-600 dark:bg-orange-500">
                        <CircleStackIcon className="h-6 w-6 text-white" />
                      </div>
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white">Ephemeral Storage</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Capacity</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {node.status?.capacity?.['ephemeral-storage'] || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Allocatable</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {node.status?.allocatable?.['ephemeral-storage'] || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Node Conditions */}
            <div className="card">
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Node Conditions
                </h3>

                {/* True Conditions - Always Visible */}
                {trueConditions.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {trueConditions.map((condition: any, index: number) => (
                      <div
                        key={index}
                        className={clsx(
                          'p-4 rounded-lg border-2 transition-all hover:shadow-md',
                          condition.type === 'Ready'
                            ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
                            : 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getConditionIcon(condition.status, condition.type)}
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {condition.type}
                            </span>
                          </div>
                          <span
                            className={clsx(
                              'text-xs px-2.5 py-1 rounded-full font-semibold',
                              condition.type === 'Ready'
                                ? 'bg-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                                : 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
                            )}
                          >
                            {condition.status}
                          </span>
                        </div>
                        {condition.message && (
                          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                            {condition.message}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* False Conditions - Collapsible */}
                {falseConditions.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <button
                      onClick={() => toggleSection('falseConditions')}
                      className="flex items-center justify-between w-full text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded-lg transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Other Conditions ({falseConditions.length})
                      </span>
                      {expandedSections.falseConditions ? (
                        <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                    {expandedSections.falseConditions && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {falseConditions.map((condition: any, index: number) => (
                          <div
                            key={index}
                            className="p-4 rounded-lg border-2 border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50 transition-all hover:shadow-md"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getConditionIcon(condition.status, condition.type)}
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {condition.type}
                                </span>
                              </div>
                              <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                {condition.status}
                              </span>
                            </div>
                            {condition.message && (
                              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                {condition.message}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'yaml' && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Node YAML Configuration
            </h3>
            <YamlEditor
              value={yamlContent}
              onChange={setYamlContent}
              readOnly={true}
              height="600px"
            />
          </div>
        )}

        {activeTab === 'pods' && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Pods Running on This Node ({pods.length})
            </h3>
            <DataTable
              data={pods}
              columns={podColumns}
              keyExtractor={(pod) => `${pod.metadata?.namespace}-${pod.metadata?.name}`}
              searchPlaceholder="Search pods by name, namespace, status..."
              isLoading={false}
              emptyMessage="No pods running on this node"
              emptyIcon={
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <CubeIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                </div>
              }
              onRowClick={handlePodClick}
            />
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="card overflow-hidden" style={{ height: '600px' }}>
            <Terminal
              wsUrl={`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/clusters/${cluster}/nodes/${nodeName}/shell?shell=/bin/zsh`}
              title={`Node Shell: ${nodeName}`}
              subtitle={`Cluster: ${cluster}`}
            />
          </div>
        )}

        {activeTab === 'events' && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Node Events ({events.length})
            </h3>
            <DataTable
              data={events}
              columns={eventColumns}
              keyExtractor={(event) => `${event.metadata?.uid || event.metadata?.name}-${event.lastTimestamp}`}
              searchPlaceholder="Search events by type, reason, message..."
              isLoading={false}
              emptyMessage="No events found for this node"
              emptyIcon={
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <ClockIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                </div>
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
