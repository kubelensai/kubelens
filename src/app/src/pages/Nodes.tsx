import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getNodes, cordonNode, uncordonNode, deleteNode } from '@/services/api'
import { 
  ServerIcon,
  LockClosedIcon,
  LockOpenIcon,
  ArrowPathIcon,
  TrashIcon,
  CpuChipIcon,
  CircleStackIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { formatAge } from '@/utils/format'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import TerminalModal from '@/components/shared/TerminalModal'
import { DataTable, Column } from '@/components/shared/DataTable'
import api from '@/services/api'
import { notifyResourceAction } from '@/utils/notifications'

interface NodeMetrics {
  [nodeKey: string]: {
    cpuUsage: number
    memoryUsage: number
  }
}

interface NodeData {
  metadata: {
    name: string
    labels?: Record<string, string>
    creationTimestamp: string
  }
  spec?: {
    taints?: Array<{ key: string; value: string; effect: string }>
    unschedulable?: boolean
  }
  status?: {
    conditions?: Array<{ type: string; status: string }>
    addresses?: Array<{ type: string; address: string }>
    nodeInfo?: {
      kubeletVersion: string
    }
    allocatable?: {
      cpu: string
      memory: string
    }
  }
  clusterName: string
}

export default function Nodes() {
  const { cluster } = useParams<{ cluster?: string }>()
  const navigate = useNavigate()
  const [actioningNode, setActioningNode] = useState<string | null>(null)
  const [nodeMetrics, setNodeMetrics] = useState<NodeMetrics>({})
  
  // Confirmation modals state
  const [cordonModal, setCordonModal] = useState<{isOpen: boolean, node: any, action: 'cordon' | 'uncordon'}>({
    isOpen: false,
    node: null,
    action: 'cordon'
  })
  const [drainConfirmModal, setDrainConfirmModal] = useState<{isOpen: boolean, node: any}>({
    isOpen: false,
    node: null
  })
  const [drainTerminalModal, setDrainTerminalModal] = useState<{isOpen: boolean, node: any}>({
    isOpen: false,
    node: null
  })
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, node: any}>({
    isOpen: false,
    node: null
  })
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch nodes from all clusters or specific cluster with auto-refresh
  const { data: allNodes, isLoading, refetch } = useQuery({
    queryKey: cluster ? ['nodes', cluster] : ['all-nodes', clusters?.map(c => c.name)],
    queryFn: async () => {
      if (cluster) {
        const nodes = await getNodes(cluster)
        return nodes.map((node: any) => ({ ...node, clusterName: cluster }))
      }
      
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
    refetchInterval: 5000,
  })

  // Fetch metrics for all nodes
  useEffect(() => {
    if (allNodes && allNodes.length > 0) {
      fetchAllNodeMetrics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allNodes])

  const fetchAllNodeMetrics = async () => {
    if (!allNodes) return
    const metricsMap: NodeMetrics = {}
    
    await Promise.all(
      allNodes.map(async (node: any) => {
        try {
          const response = await api.get(`/clusters/${node.clusterName}/nodes/${node.metadata.name}/metrics`)
          const data = response.data
          
          if (data && data.usage) {
            metricsMap[`${node.clusterName}-${node.metadata.name}`] = {
              cpuUsage: typeof data.usage.cpu === 'number' ? data.usage.cpu : 0,
              memoryUsage: typeof data.usage.memory === 'number' ? data.usage.memory : 0
            }
          }
        } catch (error) {
          // Silently fail for metrics
        }
      })
    )
    
    setNodeMetrics(metricsMap)
  }

  // Helper functions
  const getNodeIPs = (node: NodeData) => {
    const addresses = node.status?.addresses || []
    const internalIP = addresses.find((addr) => addr.type === 'InternalIP')?.address || ''
    const externalIP = addresses.find((addr) => addr.type === 'ExternalIP')?.address || ''
    return { internal: internalIP, external: externalIP, combined: [internalIP, externalIP].filter(Boolean).join(', ') }
  }

  const getNodeRoles = (node: NodeData) => {
    const labels = node.metadata?.labels || {}
    const roles = []
    if (labels['node-role.kubernetes.io/master'] || labels['node-role.kubernetes.io/control-plane']) {
      roles.push('master')
    }
    Object.keys(labels).forEach(key => {
      if (key.startsWith('node-role.kubernetes.io/') && key !== 'node-role.kubernetes.io/master' && key !== 'node-role.kubernetes.io/control-plane') {
        roles.push(key.replace('node-role.kubernetes.io/', ''))
      }
    })
    return roles.length > 0 ? roles.join(', ') : 'worker'
  }


  const isNodeReady = (node: NodeData) => {
    const conditions = node.status?.conditions || []
    return conditions.some((c) => c.type === 'Ready' && c.status === 'True')
  }

  const formatCPU = (millicores: number) => {
    if (millicores < 1000) {
      return `${millicores}m`
    }
    return `${(millicores / 1000).toFixed(2)}`
  }

  const formatMemory = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024)
    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`
    }
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(0)} MB`
  }

  // Action handlers
  const handleViewDetails = async (node: any) => {
    // Navigate to node details page
    navigate(`/clusters/${node.clusterName}/nodes/${node.metadata.name}`)
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
    } catch (error: any) {
      console.error(`Failed to ${action} node:`, error)
      alert(`Failed to ${action} node: ${error.message || 'Unknown error'}`)
    } finally {
      setActioningNode(null)
      setCordonModal({ isOpen: false, node: null, action: 'cordon' })
    }
  }

  const handleDrainClick = (node: any) => {
    // Show confirmation modal first
    setDrainConfirmModal({ isOpen: true, node })
  }

  const handleDrainConfirm = () => {
    const { node } = drainConfirmModal
    if (!node) return
    
    // Close confirmation modal and open terminal modal
    setDrainConfirmModal({ isOpen: false, node: null })
    setDrainTerminalModal({ isOpen: true, node })
  }

  const handleDrainTerminalClose = () => {
    setDrainTerminalModal({ isOpen: false, node: null })
    // Refetch to update node status after drain
    refetch()
  }

  const handleDeleteClick = (node: any) => {
    setDeleteModal({ isOpen: true, node })
  }

  const handleDeleteConfirm = async () => {
    const { node } = deleteModal
    if (!node) return

    const nodeName = node.metadata.name
    setActioningNode(nodeName)
    
    try {
      await deleteNode(node.clusterName, nodeName)
      notifyResourceAction.deleted('Node', nodeName)
      refetch()
    } catch (error: any) {
      console.error('Failed to delete node:', error)
      alert(`Failed to delete node: ${error.message || 'Unknown error'}`)
    } finally {
      setActioningNode(null)
      setDeleteModal({ isOpen: false, node: null })
    }
  }

  // Define columns
  const columns = useMemo<Column<NodeData>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (node) => (
        <div className="flex items-center gap-2">
          <ServerIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-gray-900 dark:text-white truncate">
              {node.metadata.name}
            </div>
            {!cluster && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {node.clusterName}
              </div>
            )}
          </div>
        </div>
      ),
      sortable: true,
      sortValue: (node) => node.metadata.name,
      searchValue: (node) => `${node.metadata.name} ${node.clusterName}`,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (node) => {
        const ready = isNodeReady(node)
        // Check if node is cordoned (has unschedulable taint)
        const isCordoned = node.spec?.taints?.some(
          (taint: any) => taint.key === 'node.kubernetes.io/unschedulable' && taint.effect === 'NoSchedule'
        ) || node.spec?.unschedulable === true
        
        return (
          <div className="flex flex-col gap-1">
            <span className={clsx(
              'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full w-fit',
              ready
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            )}>
              <span className={clsx('w-1.5 h-1.5 rounded-full', ready ? 'bg-green-600 dark:bg-green-400' : 'bg-red-600 dark:bg-red-400')} />
              {ready ? 'Ready' : 'Not Ready'}
            </span>
            {isCordoned && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-600 dark:bg-yellow-400" />
                NoSchedule
              </span>
            )}
          </div>
        )
      },
      sortable: true,
      sortValue: (node) => {
        const ready = isNodeReady(node) ? 'Ready' : 'Not Ready'
        const isCordoned = node.spec?.taints?.some(
          (taint: any) => taint.key === 'node.kubernetes.io/unschedulable' && taint.effect === 'NoSchedule'
        ) || node.spec?.unschedulable === true
        return isCordoned ? `${ready} (NoSchedule)` : ready
      },
      searchValue: (node) => {
        const ready = isNodeReady(node) ? 'Ready' : 'Not Ready'
        const isCordoned = node.spec?.taints?.some(
          (taint: any) => taint.key === 'node.kubernetes.io/unschedulable' && taint.effect === 'NoSchedule'
        ) || node.spec?.unschedulable === true
        return isCordoned ? `${ready} NoSchedule Cordoned` : ready
      },
      filterable: true,
      filterOptions: (data) => {
        const statuses = new Set<string>()
        data.forEach(node => {
          const ready = isNodeReady(node) ? 'Ready' : 'Not Ready'
          const isCordoned = node.spec?.taints?.some(
            (taint: any) => taint.key === 'node.kubernetes.io/unschedulable' && taint.effect === 'NoSchedule'
          ) || node.spec?.unschedulable === true
          
          statuses.add(ready)
          if (isCordoned) {
            statuses.add('NoSchedule')
          }
        })
        return Array.from(statuses).sort()
      },
      filterValue: (node) => {
        const ready = isNodeReady(node) ? 'Ready' : 'Not Ready'
        const isCordoned = node.spec?.taints?.some(
          (taint: any) => taint.key === 'node.kubernetes.io/unschedulable' && taint.effect === 'NoSchedule'
        ) || node.spec?.unschedulable === true
        return isCordoned ? `${ready} (NoSchedule)` : ready
      },
    },
    {
      key: 'roles',
      header: 'Roles',
      accessor: (node) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {getNodeRoles(node)}
        </span>
      ),
      sortable: true,
      sortValue: (node) => getNodeRoles(node),
      searchValue: (node) => getNodeRoles(node),
    },
    {
      key: 'version',
      header: 'Version',
      accessor: (node) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">
          {node.status?.nodeInfo?.kubeletVersion || 'N/A'}
        </span>
      ),
      sortable: true,
      sortValue: (node) => node.status?.nodeInfo?.kubeletVersion || '',
      searchValue: (node) => node.status?.nodeInfo?.kubeletVersion || '',
    },
    {
      key: 'ip',
      header: 'IP Address',
      accessor: (node) => {
        const ips = getNodeIPs(node)
        return (
          <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">
            {ips.internal || 'N/A'}
          </span>
        )
      },
      sortable: true,
      sortValue: (node) => getNodeIPs(node).internal || '',
      searchValue: (node) => getNodeIPs(node).combined || '',
    },
    {
      key: 'cpu',
      header: 'CPU Usage',
      accessor: (node) => {
        const metrics = nodeMetrics[`${node.clusterName}-${node.metadata.name}`]
        if (!metrics) {
          return <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
        }
        const percentage = (metrics.cpuUsage / (node.status?.allocatable?.cpu ? parseInt(node.status.allocatable.cpu) * 1000 : 1)) * 100
        const displayPercentage = Math.min(percentage, 100)
        return (
          <div className="w-full min-w-[120px]">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <CpuChipIcon className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 font-mono">
                  {formatCPU(metrics.cpuUsage)}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {displayPercentage.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 overflow-hidden">
              <div
                className={clsx(
                  'h-1.5 rounded-full transition-all duration-300',
                  displayPercentage >= 90 ? 'bg-red-600 dark:bg-red-500' :
                  displayPercentage >= 75 ? 'bg-orange-600 dark:bg-orange-500' :
                  'bg-blue-600 dark:bg-blue-500'
                )}
                style={{ width: `${displayPercentage}%` }}
              />
            </div>
          </div>
        )
      },
      sortable: true,
      sortValue: (node) => {
        const metrics = nodeMetrics[`${node.clusterName}-${node.metadata.name}`]
        return metrics?.cpuUsage || 0
      },
      searchValue: (node) => {
        const metrics = nodeMetrics[`${node.clusterName}-${node.metadata.name}`]
        return metrics ? formatCPU(metrics.cpuUsage) : ''
      },
    },
    {
      key: 'memory',
      header: 'Memory Usage',
      accessor: (node) => {
        const metrics = nodeMetrics[`${node.clusterName}-${node.metadata.name}`]
        if (!metrics) {
          return <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
        }
        const capacityBytes = node.status?.allocatable?.memory ? 
          parseInt(node.status.allocatable.memory.replace('Ki', '')) * 1024 : 1
        const percentage = (metrics.memoryUsage / capacityBytes) * 100
        const displayPercentage = Math.min(percentage, 100)
        return (
          <div className="w-full min-w-[120px]">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <CircleStackIcon className="w-4 h-4 text-green-500 dark:text-green-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 font-mono">
                  {formatMemory(metrics.memoryUsage)}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {displayPercentage.toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 overflow-hidden">
              <div
                className={clsx(
                  'h-1.5 rounded-full transition-all duration-300',
                  displayPercentage >= 90 ? 'bg-red-600 dark:bg-red-500' :
                  displayPercentage >= 75 ? 'bg-orange-600 dark:bg-orange-500' :
                  'bg-green-600 dark:bg-green-500'
                )}
                style={{ width: `${displayPercentage}%` }}
              />
            </div>
          </div>
        )
      },
      sortable: true,
      sortValue: (node) => {
        const metrics = nodeMetrics[`${node.clusterName}-${node.metadata.name}`]
        return metrics?.memoryUsage || 0
      },
      searchValue: (node) => {
        const metrics = nodeMetrics[`${node.clusterName}-${node.metadata.name}`]
        return metrics ? formatMemory(metrics.memoryUsage) : ''
      },
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (node) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(node.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (node) => new Date(node.metadata.creationTimestamp).getTime(),
      searchValue: (node) => formatAge(node.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (node) => {
        const isSchedulable = !node.spec?.unschedulable
        const isActioning = actioningNode === node.metadata.name

        return (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleCordonClick(node)
              }}
              disabled={isActioning}
              className="p-1.5 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded disabled:opacity-50 transition-colors"
              title={isSchedulable ? 'Cordon' : 'Uncordon'}
            >
              {isSchedulable ? (
                <LockClosedIcon className="h-4 w-4" />
              ) : (
                <LockOpenIcon className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDrainClick(node)
              }}
              disabled={isActioning}
              className="p-1.5 text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded disabled:opacity-50 transition-colors"
              title="Drain"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteClick(node)
              }}
              disabled={isActioning}
              className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50 transition-colors"
              title="Delete"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        )
      },
    },
  ], [cluster, nodeMetrics, actioningNode])

  return (
    <div className="space-y-4 md:space-y-6">
      <Breadcrumb
        items={[
          ...(cluster ? [{ name: cluster, href: `/clusters/${cluster}` }] : []),
          { name: 'Nodes' }
        ]}
      />

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
          Nodes
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage and monitor your Kubernetes nodes
        </p>
      </div>

      <DataTable
        data={allNodes || []}
        columns={columns}
        keyExtractor={(node) => `${node.clusterName}-${node.metadata.name}`}
        searchPlaceholder="Search nodes by name, cluster, status, role, version, IP, CPU, memory, age..."
        isLoading={isLoading}
        emptyMessage="No nodes found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <ServerIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        onRowClick={handleViewDetails}
        mobileCardRenderer={(node) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <ServerIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white truncate">
                    {node.metadata.name}
                  </div>
                  {!cluster && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {node.clusterName}
                    </div>
                  )}
                </div>
              </div>
              <span className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full shrink-0',
                isNodeReady(node)
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              )}>
                <span className={clsx('w-1.5 h-1.5 rounded-full', isNodeReady(node) ? 'bg-green-600' : 'bg-red-600')} />
                {isNodeReady(node) ? 'Ready' : 'Not Ready'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Role:</span>
                <span className="ml-1 text-gray-900 dark:text-white">{getNodeRoles(node)}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Version:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">
                  {node.status?.nodeInfo?.kubeletVersion || 'N/A'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 dark:text-gray-400">IP:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">
                  {getNodeIPs(node).internal || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">CPU:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">
                  {(() => {
                    const metrics = nodeMetrics[`${node.clusterName}-${node.metadata.name}`]
                    return metrics ? formatCPU(metrics.cpuUsage) : '-'
                  })()}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Memory:</span>
                <span className="ml-1 text-gray-900 dark:text-white font-mono text-xs">
                  {(() => {
                    const metrics = nodeMetrics[`${node.clusterName}-${node.metadata.name}`]
                    return metrics ? formatMemory(metrics.memoryUsage) : '-'
                  })()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(node.metadata.creationTimestamp)}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCordonClick(node)
                  }}
                  className="p-1.5 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title={!node.spec?.unschedulable ? 'Cordon' : 'Uncordon'}
                >
                  {!node.spec?.unschedulable ? (
                    <LockClosedIcon className="w-4 h-4" />
                  ) : (
                    <LockOpenIcon className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDrainClick(node)
                  }}
                  className="p-1.5 text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                  title="Drain"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteClick(node)
                  }}
                  className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Delete"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      />

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={cordonModal.isOpen}
        onClose={() => setCordonModal({ isOpen: false, node: null, action: 'cordon' })}
        onConfirm={handleCordonConfirm}
        title={cordonModal.action === 'cordon' ? 'Cordon Node' : 'Uncordon Node'}
        message={
          cordonModal.action === 'cordon'
            ? `Are you sure you want to cordon node "${cordonModal.node?.metadata?.name}"? This will mark the node as unschedulable.`
            : `Are you sure you want to uncordon node "${cordonModal.node?.metadata?.name}"? This will mark the node as schedulable.`
        }
        confirmText={cordonModal.action === 'cordon' ? 'Cordon' : 'Uncordon'}
        type="warning"
      />

      <ConfirmationModal
        isOpen={drainConfirmModal.isOpen}
        onClose={() => setDrainConfirmModal({ isOpen: false, node: null })}
        onConfirm={handleDrainConfirm}
        title="Drain Node"
        message={`Are you sure you want to drain node "${drainConfirmModal.node?.metadata?.name}"? This will evict all pods from the node and may take several minutes.`}
        confirmText="Start Drain"
        type="warning"
      />

      <TerminalModal
        isOpen={drainTerminalModal.isOpen}
        onClose={handleDrainTerminalClose}
        wsUrl={
          drainTerminalModal.node
            ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/clusters/${drainTerminalModal.node.clusterName}/nodes/${drainTerminalModal.node.metadata.name}/drain?force=true&grace-period=300&delete-local-data=true`
            : ''
        }
        title={`Drain Node: ${drainTerminalModal.node?.metadata?.name || ''}`}
        subtitle={`Cluster: ${drainTerminalModal.node?.clusterName || ''}`}
      />

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, node: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Node"
        message={`Are you sure you want to delete node "${deleteModal.node?.metadata?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
      />
    </div>
  )
}

