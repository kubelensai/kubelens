import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { getClusters, getNodes, getPods, cordonNode, uncordonNode, drainNode, deleteNode } from '@/services/api'
import { 
  InformationCircleIcon, 
  CubeIcon, 
  MagnifyingGlassIcon,
  LockClosedIcon,
  LockOpenIcon,
  ArrowPathIcon,
  TrashIcon,
  XMarkIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { formatAge } from '@/utils/format'
import Breadcrumb from '@/components/shared/Breadcrumb'
import NodeDetailsModal from '@/components/Nodes/NodeDetailsModal'
import NodePodsModal from '@/components/Nodes/NodePodsModal'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import Tooltip from '@/components/shared/Tooltip'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import api from '@/services/api'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'
import { notifyResourceAction } from '@/utils/notifications'

interface NodeMetrics {
  [nodeKey: string]: {
    cpuUsage: number
    memoryUsage: number
  }
}

export default function Nodes() {
  const { cluster } = useParams<{ cluster?: string }>()
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isPodsModalOpen, setIsPodsModalOpen] = useState(false)
  const [nodeDetails, setNodeDetails] = useState<any>(null)
  const [nodePods, setNodePods] = useState<any[]>([])
  const [isLoadingPods, setIsLoadingPods] = useState(false)
  const [actioningNode, setActioningNode] = useState<string | null>(null)
  const [nodeMetrics, setNodeMetrics] = useState<NodeMetrics>({})
  const [filterText, setFilterText] = useState('')
  
  // Confirmation modals state
  const [cordonModal, setCordonModal] = useState<{isOpen: boolean, node: any, action: 'cordon' | 'uncordon'}>({
    isOpen: false,
    node: null,
    action: 'cordon'
  })
  const [drainModal, setDrainModal] = useState<{isOpen: boolean, node: any}>({
    isOpen: false,
    node: null
  })
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, node: any}>({
    isOpen: false,
    node: null
  })

  // Resizable columns (removed cluster)
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    status: 120,
    roles: 120,
    version: 120,
    ip: 150,
    taints: 100,
    labels: 100,
    cpu: 150,
    memory: 150,
    age: 120,
    actions: 140,
  }, 'nodes-column-widths')
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch nodes from all clusters or specific cluster with auto-refresh
  const { data: allNodes, isLoading, refetch } = useQuery({
    queryKey: cluster ? ['nodes', cluster] : ['all-nodes', clusters?.map(c => c.name)],
    queryFn: async () => {
      // If specific cluster requested
      if (cluster) {
        const nodes = await getNodes(cluster)
        return nodes.map((node: any) => ({ ...node, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allNodes = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const nodes = await getNodes(cluster.name)
            return nodes.map((node: any) => ({ ...node, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching nodes from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allNodes.flat()
    },
    enabled: cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  })

  // Helper: Get node IPs
  const getNodeIPs = (node: any) => {
    const addresses = node.status?.addresses || []
    const internalIP = addresses.find((addr: any) => addr.type === 'InternalIP')?.address || ''
    const externalIP = addresses.find((addr: any) => addr.type === 'ExternalIP')?.address || ''
    return { internal: internalIP, external: externalIP, combined: [internalIP, externalIP].filter(Boolean).join(', ') }
  }

  // Helper: Get taints
  const getNodeTaints = (node: any) => {
    return node.spec?.taints || []
  }

  // Helper: Get labels as array
  const getNodeLabelsArray = (node: any) => {
    const labels = node.metadata?.labels || {}
    return Object.entries(labels).map(([key, value]) => `${key}=${value}`)
  }

  // Filter nodes by name, taints, labels, IP, version
  const filteredNodes = useMemo(() => {
    const nodes = allNodes || []
    if (!filterText) return nodes
    const lowerFilter = filterText.toLowerCase()
    return nodes.filter((node: any) => {
      const name = node.metadata?.name?.toLowerCase() || ''
      const version = node.status?.nodeInfo?.kubeletVersion?.toLowerCase() || ''
      const ips = getNodeIPs(node)
      const ipStr = ips.combined.toLowerCase()
      const taints = getNodeTaints(node)
      const taintsStr = taints.map((t: any) => `${t.key}=${t.value}:${t.effect}`).join(' ').toLowerCase()
      const labels = getNodeLabelsArray(node)
      const labelsStr = labels.join(' ').toLowerCase()
      
      return (
        name.includes(lowerFilter) ||
        version.includes(lowerFilter) ||
        ipStr.includes(lowerFilter) ||
        taintsStr.includes(lowerFilter) ||
        labelsStr.includes(lowerFilter)
      )
    })
  }, [allNodes, filterText])

  // Custom sorting with special handling for complex fields
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>({
    key: 'metadata.name',
    direction: 'asc'
  })

  const sortedNodes = useMemo(() => {
    if (!sortConfig) return filteredNodes
    
    const sorted = [...filteredNodes].sort((a: any, b: any) => {
      let aValue: any
      let bValue: any
      
      // Custom sorting logic for complex fields
      if (sortConfig.key === 'status.conditions[0].type') {
        // Sort by primary condition (Ready first, then others)
        const aConditions = getNodeConditions(a)
        const bConditions = getNodeConditions(b)
        aValue = aConditions.statuses[0] || ''
        bValue = bConditions.statuses[0] || ''
      } else if (sortConfig.key === 'status.addresses[0].address') {
        // Sort by internal IP
        const aIPs = getNodeIPs(a)
        const bIPs = getNodeIPs(b)
        aValue = aIPs.internal || aIPs.external || ''
        bValue = bIPs.internal || bIPs.external || ''
      } else if (sortConfig.key === 'spec.taints') {
        // Sort by taint count
        aValue = getNodeTaints(a).length
        bValue = getNodeTaints(b).length
      } else if (sortConfig.key === 'metadata.labels') {
        // Sort by label count
        aValue = getNodeLabelsArray(a).length
        bValue = getNodeLabelsArray(b).length
      } else {
        // Default nested key sorting
        const getNestedValue = (obj: any, path: string) => {
          return path.split('.').reduce((current, key) => current?.[key], obj)
        }
        aValue = getNestedValue(a, sortConfig.key)
        bValue = getNestedValue(b, sortConfig.key)
      }
      
      // Handle null/undefined
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return 1
      if (bValue == null) return -1
      
      // Compare values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue)
        return sortConfig.direction === 'asc' ? comparison : -comparison
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
      }
      
      return 0
    })
    
    return sorted
  }, [filteredNodes, sortConfig])

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  // Apply pagination
  const {
    paginatedData: nodes,
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
  } = usePagination(sortedNodes, 10, 'nodes')

  // Fetch metrics for all nodes
  useEffect(() => {
    if (nodes.length > 0) {
      fetchAllNodeMetrics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes])

  const fetchAllNodeMetrics = async () => {
    const metricsMap: NodeMetrics = {}
    
    await Promise.all(
      nodes.map(async (node: any) => {
        try {
          const response = await api.get(`/clusters/${node.clusterName}/nodes/${node.metadata.name}/metrics`)
          const data = response.data
          
          console.log('Node metrics response for', node.metadata.name, ':', data)
          
          if (data && data.usage) {
            // Backend returns integers: cpu in millicores, memory in bytes
            metricsMap[`${node.clusterName}-${node.metadata.name}`] = {
              cpuUsage: typeof data.usage.cpu === 'number' ? data.usage.cpu : 0,
              memoryUsage: typeof data.usage.memory === 'number' ? data.usage.memory : 0
            }
          }
        } catch (error) {
          console.error('Failed to fetch metrics for node', node.metadata.name, ':', error)
        }
      })
    )
    
    console.log('Final metrics map:', metricsMap)
    setNodeMetrics(metricsMap)
  }

  const handleViewDetails = async (node: any) => {
    setSelectedNode(node)
    setIsDetailsModalOpen(true)

    try {
      // Fetch node metrics and pods running on the node
      const [metricsRes, allPods] = await Promise.all([
        api.get(`/clusters/${node.clusterName}/nodes/${node.metadata.name}/metrics`).catch(() => ({ data: null })),
        getPods(node.clusterName).catch(() => [])
      ])

      const podsOnNode = allPods.filter((pod: any) => pod.spec?.nodeName === node.metadata.name) || []
      
      setNodeDetails({
        metrics: metricsRes.data,
        pods: podsOnNode
      })
    } catch (error) {
      console.error('Failed to fetch node details:', error)
      setNodeDetails({ metrics: null, pods: [] })
    }
  }

  const handleViewPods = async (node: any) => {
    setSelectedNode(node)
    setIsPodsModalOpen(true)
    setIsLoadingPods(true)

    try {
      // Use getPods which properly handles the API response format
      const allPods = await getPods(node.clusterName)
      console.log('Total pods in cluster:', allPods.length)
      console.log('Looking for pods on node:', node.metadata.name)
      
      const podsOnNode = allPods.filter((pod: any) => {
        const podNodeName = pod.spec?.nodeName
        return podNodeName === node.metadata.name
      })
      
      console.log('Found pods on this node:', podsOnNode.length, podsOnNode)
      setNodePods(podsOnNode)
    } catch (error) {
      console.error('Failed to fetch node pods:', error)
      setNodePods([])
    } finally {
      setIsLoadingPods(false)
    }
  }

  const handleCordonClick = (node: any) => {
    const isSchedulable = !node.spec?.unschedulable
    setCordonModal({
      isOpen: true,
      node: node,
      action: isSchedulable ? 'cordon' : 'uncordon'
    })
  }

  const handleCordonConfirm = async () => {
    const { node, action } = cordonModal
    if (!node) return

    const nodeName = node.metadata.name
    setActioningNode(nodeName)
    
    try {
      if (action === 'cordon') {
        await cordonNode(node.clusterName, nodeName)
        notifyResourceAction.updated('Node', nodeName)
      } else {
        await uncordonNode(node.clusterName, nodeName)
        notifyResourceAction.updated('Node', nodeName)
      }
      refetch()
      setCordonModal({ isOpen: false, node: null, action: 'cordon' })
    } catch (error: any) {
      console.error('Failed to toggle cordon:', error)
      const errorMsg = error.response?.data?.error || error.message
      notifyResourceAction.failed(action, 'Node', nodeName, errorMsg)
    } finally {
      setActioningNode(null)
    }
  }

  const handleDrainClick = (node: any) => {
    setDrainModal({
      isOpen: true,
      node: node
    })
  }

  const handleDrainConfirm = async () => {
    const { node } = drainModal
    if (!node) return

    const nodeName = node.metadata.name
    setActioningNode(nodeName)
    
    try {
      const result = await drainNode(node.clusterName, nodeName)
      refetch()
      setDrainModal({ isOpen: false, node: null })
      
      // Show success notification with drain stats
      notifyResourceAction.drained('Node', nodeName, {
        evicted: result.evicted,
        failed: result.failed,
        skipped: result.skipped
      })
    } catch (error: any) {
      console.error('Failed to drain node:', error)
      const errorMsg = error.response?.data?.error || error.message
      notifyResourceAction.failed('drain', 'Node', nodeName, errorMsg)
      setDrainModal({ isOpen: false, node: null })
    } finally {
      setActioningNode(null)
    }
  }

  const handleDeleteClick = (node: any) => {
    setDeleteModal({
      isOpen: true,
      node: node
    })
  }

  const handleDeleteConfirm = async () => {
    const { node } = deleteModal
    if (!node) return

    const nodeName = node.metadata.name
    setActioningNode(nodeName)
    
    try {
      await deleteNode(node.clusterName, nodeName)
      refetch()
      setDeleteModal({ isOpen: false, node: null })
      notifyResourceAction.deleted('Node', nodeName)
    } catch (error: any) {
      console.error('Failed to delete node:', error)
      const errorMsg = error.response?.data?.error || error.message
      notifyResourceAction.failed('delete', 'Node', nodeName, errorMsg)
      setDeleteModal({ isOpen: false, node: null })
    } finally {
      setActioningNode(null)
    }
  }

  const handleCopyNodeName = (nodeName: string) => {
    navigator.clipboard.writeText(nodeName).then(() => {
      // Optional: Add a visual feedback (e.g., toast notification)
      console.log('Copied to clipboard:', nodeName)
    }).catch(err => {
      console.error('Failed to copy:', err)
    })
  }

  const formatBytes = (bytes: number) => {
    if (!bytes) return 'N/A'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)}${sizes[i]}`
  }

  const formatCPU = (millicores: number) => {
    if (!millicores) return 'N/A'
    const cores = millicores / 1000
    if (cores < 1) {
      return `${millicores}m`
    }
    return `${cores.toFixed(1)}`
  }

  const getNodeRoles = (node: any) => {
    const labels = node.metadata?.labels || {}
    const roles = Object.keys(labels)
      .filter(key => key.startsWith('node-role.kubernetes.io/'))
      .map(key => key.replace('node-role.kubernetes.io/', ''))
    return roles.length > 0 ? roles.join(', ') : 'worker'
  }

  const getNodeConditions = (node: any) => {
    const conditions = node.status?.conditions || []
    // Get all conditions that are True
    const trueConditions = conditions.filter((c: any) => c.status === 'True')
    
    if (trueConditions.length === 0) {
      return { statuses: ['Unknown'], colors: ['error'], tooltip: 'No conditions found' }
    }
    
    // Map conditions to display format
    const statuses = trueConditions.map((c: any) => c.type)
    const colors = trueConditions.map((c: any) => {
      if (c.type === 'Ready') return 'success'
      // Warning conditions
      if (['MemoryPressure', 'DiskPressure', 'PIDPressure', 'NetworkUnavailable'].includes(c.type)) {
        return 'warning'
      }
      return 'info'
    })
    const tooltip = trueConditions.map((c: any) => 
      `${c.type}: ${c.status} (${c.reason || 'N/A'})`
    ).join('\n')
    
    return { statuses, colors, tooltip }
  }

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500 dark:bg-red-600'
    if (percentage >= 75) return 'bg-yellow-500 dark:bg-yellow-600'
    return 'bg-green-500 dark:bg-green-600'
  }

  const renderResourceBar = (usage: number, capacity: number, formatFn: (val: number) => string) => {
    if (!capacity || capacity === 0) {
      return <span className="text-xs text-gray-400">N/A</span>
    }

    if (!usage) {
      return (
        <div className="flex flex-col gap-1 w-full min-w-[100px]">
          <span className="text-xs text-gray-500 dark:text-gray-400">No metrics</span>
          <div className="text-[10px] text-gray-400 dark:text-gray-500">
            Capacity: {formatFn(capacity)}
          </div>
        </div>
      )
    }

    const percentage = Math.min((usage / capacity) * 100, 100)
    const colorClass = getProgressBarColor(percentage)

    return (
      <div className="flex flex-col gap-1 w-full min-w-[100px]">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-gray-900 dark:text-white">{formatFn(usage)}</span>
          <span className="text-gray-500 dark:text-gray-400">
            {percentage.toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${colorClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          Cap: {formatFn(capacity)}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Breadcrumb 
          items={cluster 
            ? [
                { name: cluster, href: `/clusters/${cluster}/overview` },
                { name: 'Nodes' }
              ]
            : [{ name: 'Nodes' }]
          } 
        />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Nodes</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            All nodes across {clusters?.length || 0} cluster(s)
          </p>
        </div>
        <div className="relative sm:w-80">
          <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, IP, version, taints, labels..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-11 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {filterText && (
            <button
              onClick={() => setFilterText('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Clear filter"
            >
              <XMarkIcon className="h-4 w-4" />
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
                  onResizeStart={handleResizeStart}
                  width={columnWidths.name}
                />
                <ResizableTableHeader
                  label="Status"
                  columnKey="status"
                  sortKey="status.conditions[0].type"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.status}
                />
                <ResizableTableHeader
                  label="Roles"
                  columnKey="roles"
                  sortKey="metadata.labels"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.roles}
                />
                <ResizableTableHeader
                  label="Version"
                  columnKey="version"
                  sortKey="status.nodeInfo.kubeletVersion"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.version}
                />
                <ResizableTableHeader
                  label="IP"
                  columnKey="ip"
                  sortKey="status.addresses[0].address"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.ip}
                />
                <ResizableTableHeader
                  label="Taints"
                  columnKey="taints"
                  sortKey="spec.taints"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.taints}
                />
                <ResizableTableHeader
                  label="Labels"
                  columnKey="labels"
                  sortKey="metadata.labels"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.labels}
                />
                <ResizableTableHeader
                  label="CPU Usage"
                  columnKey="cpu"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.cpu}
                />
                <ResizableTableHeader
                  label="Memory Usage"
                  columnKey="memory"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.memory}
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
                />
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-[#1a1f2e] divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading nodes...</span>
                    </div>
                  </td>
                </tr>
              ) : nodes.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No nodes found</p>
                  </td>
                </tr>
              ) : (
                nodes.map((node) => {
                  const condition = getNodeConditions(node)
                  const cpuCapacity = node.status?.capacity?.cpu ? parseInt(node.status.capacity.cpu) * 1000 : 0
                  const memCapacity = node.status?.capacity?.memory ? parseInt(node.status.capacity.memory.replace('Ki', '')) * 1024 : 0
                  const nodeKey = `${node.clusterName}-${node.metadata.name}`
                  const metrics = nodeMetrics[nodeKey]
                  const ips = getNodeIPs(node)
                  const taints = getNodeTaints(node)
                  const labels = getNodeLabelsArray(node)

                  return (
                    <tr 
                      key={`${node.clusterName}-${node.metadata.name}`} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        <button
                          onClick={() => handleCopyNodeName(node.metadata.name)}
                          className="group flex items-center gap-2 w-full text-left hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                          title={`Click to copy: ${node.metadata.name}`}
                          style={{ maxWidth: columnWidths.name ? `${columnWidths.name}px` : 'auto' }}
                        >
                          <span className="truncate flex-1 min-w-0">{node.metadata.name}</span>
                          <ClipboardDocumentIcon className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </button>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4">
                        <div 
                          className="flex flex-wrap gap-1"
                          title={condition.tooltip}
                        >
                          {condition.statuses.map((status: string, idx: number) => (
                            <span 
                              key={idx} 
                              className={clsx('badge text-xs', `badge-${condition.colors[idx]}`)}
                            >
                              {status}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {getNodeRoles(node)}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                        <span className="font-mono font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded">
                          {node.status.nodeInfo?.kubeletVersion || 'N/A'}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm">
                        <div className="flex flex-col gap-0.5">
                          {ips.internal && (
                            <div className="font-mono font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded inline-block">
                              {ips.internal}
                            </div>
                          )}
                          {ips.external && (
                            <div className="font-mono font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded inline-block">
                              {ips.external}
                            </div>
                          )}
                          {!ips.internal && !ips.external && <span className="text-gray-400">N/A</span>}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                        {taints.length > 0 ? (
                          <Tooltip content={taints.map((t: any) => `${t.key}=${t.value || ''}:${t.effect}`).join('\n')} mode="click">
                            <span className="badge badge-warning text-xs cursor-pointer">
                              {taints.length}
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                        {labels.length > 0 ? (
                          <Tooltip content={labels.join('\n')} mode="click">
                            <span className="badge badge-info text-xs cursor-pointer">
                              {labels.length}
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4">
                        {renderResourceBar(metrics?.cpuUsage || 0, cpuCapacity, formatCPU)}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4">
                        {renderResourceBar(metrics?.memoryUsage || 0, memCapacity, formatBytes)}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {formatAge(node.metadata.creationTimestamp)}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewDetails(node)}
                            className="p-1.5 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20 rounded transition-colors"
                            title="View Details"
                            disabled={actioningNode === node.metadata?.name}
                          >
                            <InformationCircleIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleViewPods(node)}
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 rounded transition-colors"
                            title="View Pods"
                            disabled={actioningNode === node.metadata?.name}
                          >
                            <CubeIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleCordonClick(node)}
                            className={clsx(
                              'p-1.5 rounded transition-colors',
                              node.spec?.unschedulable
                                ? 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
                                : 'text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20'
                            )}
                            title={node.spec?.unschedulable ? 'Uncordon (Make Schedulable)' : 'Cordon (Make Unschedulable)'}
                            disabled={actioningNode === node.metadata?.name}
                          >
                            {actioningNode === node.metadata?.name ? (
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : node.spec?.unschedulable ? (
                              <LockOpenIcon className="h-4 w-4" />
                            ) : (
                              <LockClosedIcon className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDrainClick(node)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Drain Node (Evict All Pods)"
                            disabled={actioningNode === node.metadata?.name}
                          >
                            {actioningNode === node.metadata?.name ? (
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowPathIcon className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteClick(node)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete Node"
                            disabled={actioningNode === node.metadata?.name}
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

      {/* Node Details Modal */}
      <NodeDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false)
          setSelectedNode(null)
          setNodeDetails(null)
        }}
        node={selectedNode}
        metrics={nodeDetails?.metrics}
        pods={nodeDetails?.pods || []}
      />

      {/* Node Pods Modal */}
      <NodePodsModal
        isOpen={isPodsModalOpen}
        onClose={() => {
          setIsPodsModalOpen(false)
          setSelectedNode(null)
          setNodePods([])
          setIsLoadingPods(false)
        }}
        nodeName={selectedNode?.metadata?.name || ''}
        clusterName={selectedNode?.clusterName || ''}
        pods={nodePods}
        isLoading={isLoadingPods}
        onRefresh={() => selectedNode && handleViewPods(selectedNode)}
      />

      {/* Cordon/Uncordon Confirmation Modal */}
      <ConfirmationModal
        isOpen={cordonModal.isOpen}
        onClose={() => setCordonModal({ isOpen: false, node: null, action: 'cordon' })}
        onConfirm={handleCordonConfirm}
        title={cordonModal.action === 'cordon' ? 'Cordon Node?' : 'Uncordon Node?'}
        message={
          cordonModal.action === 'cordon'
            ? `Are you sure you want to cordon node "${cordonModal.node?.metadata?.name}"?\n\nNew pods will not be scheduled on this node.`
            : `Are you sure you want to uncordon node "${cordonModal.node?.metadata?.name}"?\n\nNew pods will be schedulable on this node.`
        }
        confirmText={cordonModal.action === 'cordon' ? 'Cordon' : 'Uncordon'}
        cancelText="Cancel"
        type="warning"
        isLoading={actioningNode === cordonModal.node?.metadata?.name}
      />

      {/* Drain Confirmation Modal */}
      <ConfirmationModal
        isOpen={drainModal.isOpen}
        onClose={() => setDrainModal({ isOpen: false, node: null })}
        onConfirm={handleDrainConfirm}
        title="Drain Node?"
        message={`Are you sure you want to drain node "${drainModal.node?.metadata?.name}"?\n\nThis will:\n• Cordon the node (mark as unschedulable)\n• Evict all pods (except DaemonSets)\n• This action cannot be undone`}
        confirmText="Drain"
        cancelText="Cancel"
        type="danger"
        isLoading={actioningNode === drainModal.node?.metadata?.name}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, node: null })}
        onConfirm={handleDeleteConfirm}
        title="⚠️ Delete Node?"
        message={`Are you sure you want to DELETE node "${deleteModal.node?.metadata?.name}"?\n\nThis will:\n• Permanently remove the node from the cluster\n• All pods on this node will become unscheduled\n• This action CANNOT be undone!`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        isLoading={actioningNode === deleteModal.node?.metadata?.name}
      />
    </div>
  )
}

