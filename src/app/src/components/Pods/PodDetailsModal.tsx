import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CubeIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface PodDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  pod: any
  clusterName: string
}

export default function PodDetailsModal({ isOpen, onClose, pod, clusterName }: PodDetailsModalProps) {
  if (!pod) return null

  const getContainerState = (container: any) => {
    const state = container.state
    if (state?.running) return { status: 'Running', color: 'green', detail: `Started: ${new Date(state.running.startedAt).toLocaleString()}` }
    if (state?.waiting) return { status: 'Waiting', color: 'yellow', detail: state.waiting.reason || 'Waiting' }
    if (state?.terminated) return { status: 'Terminated', color: 'red', detail: state.terminated.reason || 'Terminated' }
    return { status: 'Unknown', color: 'gray', detail: '' }
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
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <CubeIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Pod Details: {pod.metadata?.name}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="max-h-[70vh] overflow-auto px-6 py-4">
                  <div className="space-y-6">
                    {/* Metadata Section */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Metadata</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Name:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{pod.metadata?.name}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Namespace:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{pod.metadata?.namespace}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">UID:</span>
                          <span className="ml-2 text-gray-900 dark:text-white font-mono text-xs">{pod.metadata?.uid}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Created:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{new Date(pod.metadata?.creationTimestamp).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Cluster:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{clusterName}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">QoS Class:</span>
                          <span className={clsx(
                            'ml-2 px-2 py-0.5 rounded text-xs font-medium',
                            pod.status?.qosClass === 'Guaranteed' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                            pod.status?.qosClass === 'Burstable' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                            pod.status?.qosClass === 'BestEffort' && 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                          )}>
                            {pod.status?.qosClass || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Labels */}
                    {pod.metadata?.labels && Object.keys(pod.metadata.labels).length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Labels</h3>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(pod.metadata.labels).map(([key, value]: [string, any]) => (
                            <span key={key} className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs font-mono">
                              {key}: {value}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Spec Section */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Spec</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Node:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{pod.spec?.nodeName || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Service Account:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{pod.spec?.serviceAccountName || 'default'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Restart Policy:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{pod.spec?.restartPolicy || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Priority Class:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{pod.spec?.priorityClassName || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Section */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Status</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Phase:</span>
                          <span className={clsx(
                            'ml-2 px-2 py-0.5 rounded text-xs font-medium',
                            pod.status?.phase === 'Running' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                            pod.status?.phase === 'Pending' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                            pod.status?.phase === 'Failed' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                            pod.status?.phase === 'Succeeded' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          )}>
                            {pod.status?.phase}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Pod IP:</span>
                          <span className="ml-2 text-gray-900 dark:text-white font-mono">{pod.status?.podIP || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Host IP:</span>
                          <span className="ml-2 text-gray-900 dark:text-white font-mono">{pod.status?.hostIP || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600 dark:text-gray-400">Start Time:</span>
                          <span className="ml-2 text-gray-900 dark:text-white">{pod.status?.startTime ? new Date(pod.status.startTime).toLocaleString() : 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Conditions */}
                    {pod.status?.conditions && pod.status.conditions.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Conditions</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b border-gray-200 dark:border-gray-700">
                              <tr>
                                <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400">Type</th>
                                <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400">Status</th>
                                <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400">Last Transition</th>
                                <th className="text-left py-2 px-3 text-gray-600 dark:text-gray-400">Reason</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pod.status.conditions.map((condition: any, index: number) => (
                                <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                                  <td className="py-2 px-3 text-gray-900 dark:text-white">{condition.type}</td>
                                  <td className="py-2 px-3">
                                    <span className={clsx(
                                      'px-2 py-0.5 rounded text-xs',
                                      condition.status === 'True' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                                    )}>
                                      {condition.status}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{new Date(condition.lastTransitionTime).toLocaleString()}</td>
                                  <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{condition.reason || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Containers */}
                    {pod.status?.containerStatuses && pod.status.containerStatuses.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Containers</h3>
                        <div className="space-y-4">
                          {pod.status.containerStatuses.map((container: any, index: number) => {
                            const state = getContainerState(container)
                            const spec = pod.spec?.containers?.find((c: any) => c.name === container.name)
                            
                            return (
                              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-semibold text-gray-900 dark:text-white">{container.name}</h4>
                                  <span className={clsx(
                                    'px-2 py-1 rounded text-xs font-medium',
                                    state.color === 'green' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                                    state.color === 'yellow' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                                    state.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                                    state.color === 'gray' && 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                                  )}>
                                    {state.status}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="font-medium text-gray-600 dark:text-gray-400">Image:</span>
                                    <span className="ml-2 text-gray-900 dark:text-white text-xs font-mono">{container.image}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-gray-600 dark:text-gray-400">Ready:</span>
                                    <span className="ml-2 text-gray-900 dark:text-white">{container.ready ? 'Yes' : 'No'}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-gray-600 dark:text-gray-400">Restart Count:</span>
                                    <span className="ml-2 text-gray-900 dark:text-white">{container.restartCount}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-gray-600 dark:text-gray-400">Container ID:</span>
                                    <span className="ml-2 text-gray-900 dark:text-white text-xs font-mono">{container.containerID?.split('//')[1]?.substring(0, 12) || 'N/A'}</span>
                                  </div>
                                  {spec?.resources && (
                                    <>
                                      {spec.resources.requests && (
                                        <div className="col-span-2">
                                          <span className="font-medium text-gray-600 dark:text-gray-400">Requests:</span>
                                          <span className="ml-2 text-gray-900 dark:text-white">
                                            CPU: {spec.resources.requests.cpu || 'N/A'}, Memory: {spec.resources.requests.memory || 'N/A'}
                                          </span>
                                        </div>
                                      )}
                                      {spec.resources.limits && (
                                        <div className="col-span-2">
                                          <span className="font-medium text-gray-600 dark:text-gray-400">Limits:</span>
                                          <span className="ml-2 text-gray-900 dark:text-white">
                                            CPU: {spec.resources.limits.cpu || 'N/A'}, Memory: {spec.resources.limits.memory || 'N/A'}
                                          </span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Volumes */}
                    {pod.spec?.volumes && pod.spec.volumes.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Volumes</h3>
                        <div className="space-y-2">
                          {pod.spec.volumes.map((volume: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                              <span className="font-medium text-gray-900 dark:text-white">{volume.name}</span>
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {Object.keys(volume).filter(k => k !== 'name')[0] || 'unknown'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
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

