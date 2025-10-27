import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CpuChipIcon, CircleStackIcon, CubeIcon } from '@heroicons/react/24/outline'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

interface NodeDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  node: any
  metrics: any
  pods: any[]
}

export default function NodeDetailsModal({ isOpen, onClose, node, metrics, pods }: NodeDetailsModalProps) {
  if (!node) return null

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
    if (!total) return 0
    return ((used / total) * 100).toFixed(1)
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
          <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-full sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-full sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate pr-2">
                    {node.metadata?.name}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="max-h-[70vh] sm:max-h-[75vh] overflow-y-auto px-4 sm:px-6 py-4 space-y-4 sm:space-y-6">
                  {/* Node Info */}
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">Node Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Name:</span>
                          <p className="text-sm font-medium text-gray-900 dark:text-white break-all">{node.metadata?.name}</p>
                        </div>
                        <div>
                          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Version:</span>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{node.status?.nodeInfo?.kubeletVersion}</p>
                        </div>
                        <div>
                          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">OS:</span>
                          <p className="text-sm font-medium text-gray-900 dark:text-white break-words">
                            {node.status?.nodeInfo?.osImage} ({node.status?.nodeInfo?.architecture})
                          </p>
                        </div>
                        <div>
                          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Container Runtime:</span>
                          <p className="text-sm font-medium text-gray-900 dark:text-white break-all">{node.status?.nodeInfo?.containerRuntimeVersion}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Internal IP:</span>
                          <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                            {node.status?.addresses?.find((a: any) => a.type === 'InternalIP')?.address || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Hostname:</span>
                          <p className="text-sm font-medium text-gray-900 dark:text-white break-all">
                            {node.status?.addresses?.find((a: any) => a.type === 'Hostname')?.address || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Age:</span>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatDistanceToNow(new Date(node.metadata?.creationTimestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Resource Metrics */}
                  {metrics && (
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">Resource Usage</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {/* CPU */}
                        <div className="card p-3 sm:p-4">
                          <div className="flex items-center gap-2 sm:gap-3 mb-3">
                            <div className="p-1.5 sm:p-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 shrink-0">
                              <CpuChipIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600 dark:text-primary-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">CPU Usage</p>
                              <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                                {formatCPU(metrics.usage?.cpu || 0)} / {formatCPU(metrics.capacity?.cpu || 0)}
                              </p>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-primary-600 h-2 rounded-full transition-all"
                              style={{ width: `${calculatePercentage(metrics.usage?.cpu || 0, metrics.capacity?.cpu || 0)}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {calculatePercentage(metrics.usage?.cpu || 0, metrics.capacity?.cpu || 0)}% utilized
                          </p>
                        </div>

                        {/* Memory */}
                        <div className="card p-3 sm:p-4">
                          <div className="flex items-center gap-2 sm:gap-3 mb-3">
                            <div className="p-1.5 sm:p-2 rounded-lg bg-green-50 dark:bg-green-900/20 shrink-0">
                              <CircleStackIcon className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Memory Usage</p>
                              <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                                {formatBytes(metrics.usage?.memory || 0)} / {formatBytes(metrics.capacity?.memory || 0)}
                              </p>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all"
                              style={{ width: `${calculatePercentage(metrics.usage?.memory || 0, metrics.capacity?.memory || 0)}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {calculatePercentage(metrics.usage?.memory || 0, metrics.capacity?.memory || 0)}% utilized
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Conditions */}
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">Node Conditions</h3>
                    <div className="space-y-2">
                      {node.status?.conditions?.map((condition: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                          <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 truncate pr-2">{condition.type}</span>
                          <span className={clsx(
                            'text-xs px-2 py-1 rounded-full font-medium shrink-0',
                            condition.status === 'True' && condition.type === 'Ready' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                            condition.status === 'False' && 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
                            condition.status === 'True' && condition.type !== 'Ready' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          )}>
                            {condition.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pods */}
                  {pods && pods.length > 0 && (
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <CubeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                        Pods Running on This Node ({pods.length})
                      </h3>
                      <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
                        {pods.map((pod: any) => (
                          <div key={pod.metadata?.uid} className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                            <div className="flex-1 min-w-0 pr-2">
                              <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">{pod.metadata?.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{pod.metadata?.namespace}</p>
                            </div>
                            <span className={clsx(
                              'text-xs px-2 py-1 rounded-full font-medium flex-shrink-0',
                              pod.status?.phase === 'Running' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                              pod.status?.phase === 'Pending' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                              pod.status?.phase === 'Failed' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            )}>
                              {pod.status?.phase}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Labels */}
                  {node.metadata?.labels && Object.keys(node.metadata.labels).length > 0 && (
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">Labels</h3>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {Object.entries(node.metadata.labels).map(([key, value]: [string, any]) => (
                          <span key={key} className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 break-all">
                            <span className="font-medium">{key}:</span>
                            <span className="ml-1">{value}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Taints */}
                  {node.spec?.taints && node.spec.taints.length > 0 && (
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">Taints</h3>
                      <div className="space-y-2">
                        {node.spec.taints.map((taint: any, index: number) => (
                          <div key={index} className="p-2.5 sm:p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                            <p className="text-xs sm:text-sm font-medium text-red-900 dark:text-red-300 break-all">
                              {taint.key}={taint.value || ''} : {taint.effect}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    onClick={onClose}
                    className="btn-primary w-full"
                  >
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

