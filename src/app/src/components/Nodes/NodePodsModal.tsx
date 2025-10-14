import { Fragment, useEffect, useState, useMemo } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CubeIcon, MagnifyingGlassIcon, ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import api from '@/services/api'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

interface NodePodsModalProps {
  isOpen: boolean
  onClose: () => void
  nodeName: string
  clusterName: string
  pods: any[]
  isLoading: boolean
  onRefresh?: () => void
}

interface PodMetrics {
  [podName: string]: {
    cpu: string
    memory: string
    cpuMillicores: number
    memoryBytes: number
  }
}

export default function NodePodsModal({ isOpen, onClose, nodeName, clusterName, pods, isLoading, onRefresh }: NodePodsModalProps) {
  const navigate = useNavigate()
  const [podMetrics, setPodMetrics] = useState<PodMetrics>({})
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [filterText, setFilterText] = useState('')
  const [evictingPod, setEvictingPod] = useState<string | null>(null)
  const [confirmEvict, setConfirmEvict] = useState<any | null>(null)

  useEffect(() => {
    if (isOpen && pods.length > 0) {
      fetchPodMetrics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pods])

  const fetchPodMetrics = async () => {
    setMetricsLoading(true)
    try {
      // Fetch metrics for all pods
      const metricsPromises = pods.map(async (pod) => {
        try {
          const response = await api.get(
            `/clusters/${clusterName}/namespaces/${pod.metadata.namespace}/pods/${pod.metadata.name}/metrics`
          )
          return {
            name: pod.metadata.name,
            metrics: response.data
          }
        } catch {
          return { name: pod.metadata.name, metrics: null }
        }
      })

      const results = await Promise.all(metricsPromises)
      const metricsMap: PodMetrics = {}
      
      results.forEach(({ name, metrics }) => {
        if (metrics?.containers) {
          // Sum up CPU and memory from all containers
          let totalCpu = 0
          let totalMemory = 0
          
          metrics.containers.forEach((container: any) => {
            if (container.usage) {
              // CPU can be in various formats: "125m", "1", "1500000n"
              const cpu = container.usage.cpu
              if (typeof cpu === 'string') {
                if (cpu.endsWith('m')) {
                  totalCpu += parseInt(cpu.replace('m', ''))
                } else if (cpu.endsWith('n')) {
                  totalCpu += parseInt(cpu.replace('n', '')) / 1000000
                } else {
                  // Core value, convert to millicores
                  totalCpu += parseFloat(cpu) * 1000
                }
              }
              
              // Memory can be in various formats: "125Mi", "1Gi", "1024Ki", or raw bytes
              const mem = container.usage.memory
              if (typeof mem === 'string') {
                if (mem.endsWith('Ki')) {
                  totalMemory += parseInt(mem.replace('Ki', '')) * 1024
                } else if (mem.endsWith('Mi')) {
                  totalMemory += parseInt(mem.replace('Mi', '')) * 1024 * 1024
                } else if (mem.endsWith('Gi')) {
                  totalMemory += parseInt(mem.replace('Gi', '')) * 1024 * 1024 * 1024
                } else {
                  // Assume bytes
                  totalMemory += parseInt(mem)
                }
              }
            }
          })
          
          metricsMap[name] = {
            cpu: formatCPU(totalCpu),
            memory: formatBytes(totalMemory),
            cpuMillicores: totalCpu,
            memoryBytes: totalMemory
          }
        }
      })
      
      setPodMetrics(metricsMap)
    } catch (error) {
      console.error('Failed to fetch pod metrics:', error)
    } finally {
      setMetricsLoading(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return 'N/A'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  const formatCPU = (milliCores: number) => {
    if (!milliCores || milliCores === 0) return 'N/A'
    if (milliCores < 1000) {
      return `${milliCores.toFixed(0)}m`
    }
    return `${(milliCores / 1000).toFixed(2)}`
  }

  const getContainerStatus = (pod: any) => {
    if (!pod.status?.containerStatuses) return { ready: 0, total: 0, text: '0/0' }
    
    const total = pod.status.containerStatuses.length
    const ready = pod.status.containerStatuses.filter((cs: any) => cs.ready).length
    
    return {
      ready,
      total,
      text: `${ready}/${total}`,
      allReady: ready === total && total > 0
    }
  }

  const parseResourceValue = (value: string | undefined, type: 'cpu' | 'memory'): number => {
    if (!value) return 0
    
    if (type === 'cpu') {
      // CPU: "100m" = 100 millicores, "1" = 1000 millicores
      if (value.endsWith('m')) {
        return parseInt(value.replace('m', ''))
      } else if (value.endsWith('n')) {
        return parseInt(value.replace('n', '')) / 1000000
      } else {
        return parseFloat(value) * 1000
      }
    } else {
      // Memory: convert to bytes
      if (value.endsWith('Ki')) {
        return parseInt(value.replace('Ki', '')) * 1024
      } else if (value.endsWith('Mi')) {
        return parseInt(value.replace('Mi', '')) * 1024 * 1024
      } else if (value.endsWith('Gi')) {
        return parseInt(value.replace('Gi', '')) * 1024 * 1024 * 1024
      } else if (value.endsWith('Ti')) {
        return parseInt(value.replace('Ti', '')) * 1024 * 1024 * 1024 * 1024
      } else {
        return parseInt(value)
      }
    }
  }

  const getPodResourceLimits = (pod: any) => {
    let totalCpuLimit = 0
    let totalMemoryLimit = 0
    
    if (pod.spec?.containers) {
      pod.spec.containers.forEach((container: any) => {
        if (container.resources?.limits) {
          totalCpuLimit += parseResourceValue(container.resources.limits.cpu, 'cpu')
          totalMemoryLimit += parseResourceValue(container.resources.limits.memory, 'memory')
        }
      })
    }
    
    return {
      cpuLimit: totalCpuLimit,
      memoryLimit: totalMemoryLimit
    }
  }

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500 dark:bg-red-600'
    if (percentage >= 75) return 'bg-yellow-500 dark:bg-yellow-600'
    return 'bg-green-500 dark:bg-green-600'
  }

  const renderResourceBar = (usage: number, limit: number, formatFn: (val: number) => string, _type: 'cpu' | 'memory') => {
    if (limit === 0) {
      return (
        <div className="flex flex-col items-end">
          <span className="text-xs text-gray-500 dark:text-gray-400">No limit</span>
          <span className="text-xs font-mono text-gray-900 dark:text-white">{formatFn(usage)}</span>
        </div>
      )
    }

    const percentage = Math.min((usage / limit) * 100, 100)
    const colorClass = getProgressBarColor(percentage)

    return (
      <div className="flex flex-col gap-1 w-full min-w-[120px]">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-gray-900 dark:text-white">{formatFn(usage)}</span>
          <span className="text-gray-500 dark:text-gray-400">
            {percentage.toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${colorClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          Limit: {formatFn(limit)}
        </span>
      </div>
    )
  }

  // Filter pods
  const filteredPods = useMemo(() => {
    if (!filterText) return pods
    const lowerFilter = filterText.toLowerCase()
    return pods.filter(pod => 
      pod.metadata?.name?.toLowerCase().includes(lowerFilter) ||
      pod.metadata?.namespace?.toLowerCase().includes(lowerFilter)
    )
  }, [pods, filterText])

  // Sort pods
  const { sortedData, sortConfig, requestSort } = useTableSort(filteredPods, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Convert sortConfig key to string for ResizableTableHeader
  const currentSortKey = sortConfig?.key ? String(sortConfig.key) : null

  // Resizable columns
  const { columnWidths, handleMouseDown } = useResizableColumns({
    name: 200,
    namespace: 150,
    containers: 120,
    status: 120,
    cpu: 180,
    memory: 180,
    actions: 100
  })

  // Pagination
  const {
    paginatedData: paginatedPods,
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    changePageSize,
    hasNextPage,
    hasPreviousPage
  } = usePagination(sortedData, 10, 'node-pods-modal')

  const handleRowClick = (pod: any) => {
    // Navigate to Pods page with filter
    navigate(`/clusters/${clusterName}/pods`, { 
      state: { filterPodName: pod.metadata?.name } 
    })
    onClose()
  }

  const handleEvict = async (pod: any) => {
    setEvictingPod(pod.metadata?.name)
    try {
      await api.post(`/clusters/${clusterName}/namespaces/${pod.metadata?.namespace}/pods/${pod.metadata?.name}/evict`)
      // Refresh pods list
      setConfirmEvict(null)
      // Call parent refresh function
      if (onRefresh) {
        onRefresh()
      }
    } catch (error: any) {
      console.error('Failed to evict pod:', error)
      alert(`Failed to evict pod: ${error.response?.data?.error || error.message}`)
    } finally {
      setEvictingPod(null)
    }
  }

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-7xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                    <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <CubeIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                      Pods on {nodeName}
                    </Dialog.Title>
                    <button
                      onClick={onClose}
                      className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Filter by name or namespace..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="max-h-[60vh] overflow-auto px-6 py-4">
                    {isLoading ? (
                      <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                      </div>
                    ) : paginatedPods.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full bg-white dark:bg-[#0d1117]">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <ResizableTableHeader
                                label="Name"
                                columnKey="name"
                                sortKey="metadata.name"
                                currentSortKey={currentSortKey}
                                currentSortDirection={sortConfig?.direction}
                                onSort={requestSort}
                                onResizeStart={handleMouseDown}
                                width={columnWidths.name}
                                sortable
                              />
                              <ResizableTableHeader
                                label="Namespace"
                                columnKey="namespace"
                                sortKey="metadata.namespace"
                                currentSortKey={currentSortKey}
                                currentSortDirection={sortConfig?.direction}
                                onSort={requestSort}
                                onResizeStart={handleMouseDown}
                                width={columnWidths.namespace}
                                sortable
                              />
                              <ResizableTableHeader
                                label="Containers"
                                columnKey="containers"
                                align="center"
                                onResizeStart={handleMouseDown}
                                width={columnWidths.containers}
                              />
                              <ResizableTableHeader
                                label="Status"
                                columnKey="status"
                                sortKey="status.phase"
                                currentSortKey={currentSortKey}
                                currentSortDirection={sortConfig?.direction}
                                onSort={requestSort}
                                align="center"
                                onResizeStart={handleMouseDown}
                                width={columnWidths.status}
                                sortable
                              />
                              <ResizableTableHeader
                                label="CPU Usage"
                                columnKey="cpu"
                                align="right"
                                onResizeStart={handleMouseDown}
                                width={columnWidths.cpu}
                              />
                              <ResizableTableHeader
                                label="Memory Usage"
                                columnKey="memory"
                                align="right"
                                onResizeStart={handleMouseDown}
                                width={columnWidths.memory}
                              />
                              <ResizableTableHeader
                                label="Actions"
                                columnKey="actions"
                                align="right"
                                onResizeStart={handleMouseDown}
                                width={columnWidths.actions}
                              />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-[#0d1117]">
                            {paginatedPods.map((pod: any) => {
                              const containerStatus = getContainerStatus(pod)
                              const metrics = podMetrics[pod.metadata?.name]
                              const limits = getPodResourceLimits(pod)
                              
                              return (
                                <tr
                                  key={pod.metadata?.uid}
                                  onClick={() => handleRowClick(pod)}
                                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                                >
                                  <td className="py-3 px-4" style={{ width: columnWidths.name }}>
                                    <div className="flex items-center gap-2">
                                      <CubeIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {pod.metadata?.name}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4" style={{ width: columnWidths.namespace }}>
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                      {pod.metadata?.namespace}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center" style={{ width: columnWidths.containers }}>
                                    <span
                                      className={clsx(
                                        'inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium',
                                        containerStatus.allReady
                                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                      )}
                                    >
                                      {containerStatus.text}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center" style={{ width: columnWidths.status }}>
                                    <span
                                      className={clsx(
                                        'inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium',
                                        pod.status?.phase === 'Running' &&
                                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                                        pod.status?.phase === 'Pending' &&
                                          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                                        pod.status?.phase === 'Failed' &&
                                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                                        pod.status?.phase === 'Succeeded' &&
                                          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                                        !pod.status?.phase &&
                                          'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                                      )}
                                    >
                                      {pod.status?.phase || 'Unknown'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4" style={{ width: columnWidths.cpu }}>
                                    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                                      {metricsLoading ? (
                                        <span className="text-xs text-gray-400">Loading...</span>
                                      ) : metrics ? (
                                        renderResourceBar(
                                          metrics.cpuMillicores,
                                          limits.cpuLimit,
                                          formatCPU,
                                          'cpu'
                                        )
                                      ) : (
                                        <span className="text-xs text-gray-400">N/A</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4" style={{ width: columnWidths.memory }}>
                                    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                                      {metricsLoading ? (
                                        <span className="text-xs text-gray-400">Loading...</span>
                                      ) : metrics ? (
                                        renderResourceBar(
                                          metrics.memoryBytes,
                                          limits.memoryLimit,
                                          formatBytes,
                                          'memory'
                                        )
                                      ) : (
                                        <span className="text-xs text-gray-400">N/A</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-right" style={{ width: columnWidths.actions }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setConfirmEvict(pod)
                                      }}
                                      disabled={evictingPod === pod.metadata?.name}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                                    >
                                      {evictingPod === pod.metadata?.name ? (
                                        <>
                                          <ArrowPathIcon className="h-3 w-3 animate-spin" />
                                          <span>Evicting...</span>
                                        </>
                                      ) : (
                                        <>
                                          <ArrowPathIcon className="h-3 w-3" />
                                          <span>Evict</span>
                                        </>
                                      )}
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <CubeIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          {filterText ? 'No matching pods' : 'No pods found'}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {filterText 
                            ? 'Try adjusting your filter'
                            : 'There are no pods running on this node'
                          }
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer with Pagination */}
                  <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Showing <span className="font-semibold text-gray-900 dark:text-white">{paginatedPods.length}</span> of{' '}
                        <span className="font-semibold text-gray-900 dark:text-white">{totalItems}</span> pods
                      </p>
                      <button onClick={onClose} className="btn-primary">
                        Close
                      </button>
                    </div>
                    {totalPages > 1 && (
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
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Confirm Evict Modal */}
      {confirmEvict && (
        <Transition appear show={!!confirmEvict} as={Fragment}>
          <Dialog as="div" className="relative z-[60]" onClose={() => setConfirmEvict(null)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                      <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                        Confirm Evict Pod
                      </Dialog.Title>
                    </div>
                    <div className="px-6 py-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Are you sure you want to evict this pod? This will gracefully terminate the pod respecting PodDisruptionBudgets.
                      </p>
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Name:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{confirmEvict.metadata?.name}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Namespace:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{confirmEvict.metadata?.namespace}</span>
                        </div>
                      </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex gap-3 justify-end">
                      <button
                        onClick={() => setConfirmEvict(null)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleEvict(confirmEvict)}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Evict Pod
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      )}
    </>
  )
}
