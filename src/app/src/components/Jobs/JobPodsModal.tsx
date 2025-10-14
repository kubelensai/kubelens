import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CubeIcon } from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { getPods } from '@/services/api'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import api from '@/services/api'

interface JobPodsModalProps {
  job: any
  isOpen: boolean
  onClose: () => void
}

interface PodMetrics {
  [podName: string]: {
    cpu: string
    memory: string
    cpuMillicores: number
    memoryBytes: number
  }
}

export default function JobPodsModal({
  job,
  isOpen,
  onClose,
}: JobPodsModalProps) {
  const navigate = useNavigate()
  const [pods, setPods] = useState<any[]>([])
  const [podMetrics, setPodMetrics] = useState<PodMetrics>({})
  const [metricsLoading, setMetricsLoading] = useState(false)

  // Fetch pods for this job
  const { data: allPods, isLoading } = useQuery({
    queryKey: ['job-pods', job?.clusterName, job?.metadata?.namespace, job?.metadata?.name],
    queryFn: async () => {
      if (!job) return []
      const pods = await getPods(job.clusterName, job.metadata.namespace)
      return pods
    },
    enabled: isOpen && !!job,
  })

  // Filter pods that belong to this job
  useEffect(() => {
    if (allPods && job) {
      const jobSelector = job.spec?.selector?.matchLabels || {}
      const filteredPods = allPods.filter((pod: any) => {
        const podLabels = pod.metadata?.labels || {}
        // Check if all job selector labels match pod labels
        return Object.entries(jobSelector).every(
          ([key, value]) => podLabels[key] === value
        )
      })
      setPods(filteredPods)
    }
  }, [allPods, job])

  // Fetch metrics for filtered pods
  useEffect(() => {
    if (isOpen && pods.length > 0 && job) {
      fetchPodMetrics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pods])

  const fetchPodMetrics = async () => {
    setMetricsLoading(true)
    try {
      const metricsPromises = pods.map(async (pod) => {
        try {
          const response = await api.get(
            `/clusters/${job.clusterName}/namespaces/${pod.metadata.namespace}/pods/${pod.metadata.name}/metrics`
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
          let totalCpu = 0
          let totalMemory = 0
          
          metrics.containers.forEach((container: any) => {
            if (container.usage) {
              const cpu = container.usage.cpu
              if (typeof cpu === 'string') {
                if (cpu.endsWith('m')) {
                  totalCpu += parseInt(cpu.replace('m', ''))
                } else if (cpu.endsWith('n')) {
                  totalCpu += parseInt(cpu.replace('n', '')) / 1000000
                } else {
                  totalCpu += parseFloat(cpu) * 1000
                }
              }
              
              const mem = container.usage.memory
              if (typeof mem === 'string') {
                if (mem.endsWith('Ki')) {
                  totalMemory += parseInt(mem.replace('Ki', '')) * 1024
                } else if (mem.endsWith('Mi')) {
                  totalMemory += parseInt(mem.replace('Mi', '')) * 1024 * 1024
                } else if (mem.endsWith('Gi')) {
                  totalMemory += parseInt(mem.replace('Gi', '')) * 1024 * 1024 * 1024
                } else {
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
      if (value.endsWith('m')) {
        return parseInt(value.replace('m', ''))
      } else if (value.endsWith('n')) {
        return parseInt(value.replace('n', '')) / 1000000
      } else {
        return parseFloat(value) * 1000
      }
    } else {
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

  const renderResourceBar = (usage: number, limit: number, formatFn: (val: number) => string) => {
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

  if (!job) return null

  const handlePodClick = (_pod: any) => {
    navigate(`/clusters/${job.clusterName}/namespaces/${job.metadata.namespace}/pods`)
    onClose()
  }

  return (
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
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <div>
                    <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <CubeIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                      Pods in Job
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {job.metadata.name} • {job.metadata.namespace}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="max-h-[70vh] overflow-auto px-6 py-4">
                  {isLoading ? (
                    <div className="flex justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  ) : pods.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                              Name
                            </th>
                            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                              Namespace
                            </th>
                            <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                              Containers
                            </th>
                            <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                              Pod Status
                            </th>
                            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider min-w-[140px]">
                              CPU Usage
                            </th>
                            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider min-w-[140px]">
                              Memory Usage
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {pods.map((pod: any) => {
                            const containerStatus = getContainerStatus(pod)
                            const metrics = podMetrics[pod.metadata?.name]
                            const limits = getPodResourceLimits(pod)
                            
                            return (
                              <tr
                                key={pod.metadata?.uid}
                                onClick={() => handlePodClick(pod)}
                                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                              >
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <CubeIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                                      {pod.metadata?.name}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {pod.metadata?.namespace}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
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
                                <td className="py-3 px-4 text-center">
                                  <span
                                    className={clsx(
                                      'inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium',
                                      pod.metadata.deletionTimestamp
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        : pod.status?.phase === 'Running'
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                        : pod.status?.phase === 'Pending'
                                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                        : pod.status?.phase === 'Failed'
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        : pod.status?.phase === 'Succeeded'
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                                    )}
                                  >
                                    {pod.metadata.deletionTimestamp ? 'Terminating' : pod.status?.phase || 'Unknown'}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex justify-end">
                                    {metricsLoading ? (
                                      <span className="text-xs text-gray-400">Loading...</span>
                                    ) : metrics ? (
                                      renderResourceBar(
                                        metrics.cpuMillicores,
                                        limits.cpuLimit,
                                        formatCPU
                                      )
                                    ) : (
                                      <span className="text-xs text-gray-400">N/A</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex justify-end">
                                    {metricsLoading ? (
                                      <span className="text-xs text-gray-400">Loading...</span>
                                    ) : metrics ? (
                                      renderResourceBar(
                                        metrics.memoryBytes,
                                        limits.memoryLimit,
                                        formatBytes
                                      )
                                    ) : (
                                      <span className="text-xs text-gray-400">N/A</span>
                                    )}
                                  </div>
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
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">No pods found</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        This job has no running pods
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total: <span className="font-semibold text-gray-900 dark:text-white">{pods.length}</span> pod{pods.length !== 1 ? 's' : ''}
                  </p>
                  <button onClick={onClose} className="btn-primary">
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
