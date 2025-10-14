import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'
import { formatAge } from '@/utils/format'

interface HPADetailsModalProps {
  hpa: any
  isOpen: boolean
  onClose: () => void
}

export default function HPADetailsModal({ hpa, isOpen, onClose }: HPADetailsModalProps) {
  const getStatusDisplay = (hpa: any) => {
    const conditions = hpa.status?.conditions || []
    return conditions.map((c: any) => ({
      type: c.type,
      status: c.status,
      reason: c.reason,
      message: c.message,
      lastTransition: c.lastTransitionTime,
    }))
  }

  const getMetrics = (hpa: any) => {
    const metrics = hpa.spec?.metrics || []
    return metrics.map((metric: any, index: number) => {
      if (metric.type === 'Resource') {
        const target = metric.resource?.target
        return {
          index,
          type: 'Resource',
          name: metric.resource.name,
          targetType: target?.type,
          targetValue: target?.type === 'Utilization' 
            ? `${target.averageUtilization}%` 
            : target?.averageValue || 'N/A',
        }
      } else if (metric.type === 'Pods') {
        return {
          index,
          type: 'Pods',
          name: metric.pods?.metric?.name || 'N/A',
          targetType: 'AverageValue',
          targetValue: metric.pods?.target?.averageValue || 'N/A',
        }
      } else if (metric.type === 'Object') {
        return {
          index,
          type: 'Object',
          name: metric.object?.metric?.name || 'N/A',
          targetType: metric.object?.target?.type || 'N/A',
          targetValue: metric.object?.target?.value || 'N/A',
        }
      } else if (metric.type === 'External') {
        return {
          index,
          type: 'External',
          name: metric.external?.metric?.name || 'N/A',
          targetType: metric.external?.target?.type || 'N/A',
          targetValue: metric.external?.target?.value || 'N/A',
        }
      }
      return {
        index,
        type: metric.type,
        name: 'Unknown',
        targetType: 'N/A',
        targetValue: 'N/A',
      }
    })
  }

  const getCurrentMetrics = (hpa: any) => {
    const currentMetrics = hpa.status?.currentMetrics || []
    return currentMetrics.map((metric: any, index: number) => {
      if (metric.type === 'Resource') {
        return {
          index,
          type: 'Resource',
          name: metric.resource.name,
          currentValue: metric.resource.current.averageUtilization 
            ? `${metric.resource.current.averageUtilization}%` 
            : metric.resource.current.averageValue || 'N/A',
        }
      } else if (metric.type === 'Pods') {
        return {
          index,
          type: 'Pods',
          name: metric.pods?.metric?.name || 'N/A',
          currentValue: metric.pods?.current?.averageValue || 'N/A',
        }
      } else if (metric.type === 'Object') {
        return {
          index,
          type: 'Object',
          name: metric.object?.metric?.name || 'N/A',
          currentValue: metric.object?.current?.value || 'N/A',
        }
      } else if (metric.type === 'External') {
        return {
          index,
          type: 'External',
          name: metric.external?.metric?.name || 'N/A',
          currentValue: metric.external?.current?.value || 'N/A',
        }
      }
      return {
        index,
        type: metric.type,
        name: 'Unknown',
        currentValue: 'N/A',
      }
    })
  }

  const targetMetrics = getMetrics(hpa)
  const currentMetrics = getCurrentMetrics(hpa)
  const conditions = getStatusDisplay(hpa)

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
          <div className="fixed inset-0 bg-black/25 dark:bg-black/50" />
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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-gray-800 dark:to-gray-700">
                  <div className="flex items-center gap-3">
                    <AdjustmentsHorizontalIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                        {hpa.metadata?.name}
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Horizontal Pod Autoscaler Details
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                  {/* Basic Info */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Name:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {hpa.metadata?.name}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Namespace:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {hpa.metadata?.namespace}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Target:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {hpa.spec?.scaleTargetRef?.kind}: {hpa.spec?.scaleTargetRef?.name}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Age:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {formatAge(hpa.metadata?.creationTimestamp)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Scaling Configuration */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Scaling Configuration
                    </h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Min Replicas:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {hpa.spec?.minReplicas || 0}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Max Replicas:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {hpa.spec?.maxReplicas || 0}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Current Replicas:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {hpa.status?.currentReplicas || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Target Metrics */}
                  {targetMetrics.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        Target Metrics
                      </h3>
                      <div className="space-y-2">
                        {targetMetrics.map((metric: any) => (
                          <div
                            key={metric.index}
                            className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800"
                          >
                            <div className="grid grid-cols-4 gap-3 text-sm">
                              <div>
                                <span className="text-blue-600 dark:text-blue-400 font-medium">Type:</span>
                                <p className="text-gray-900 dark:text-white mt-1">{metric.type}</p>
                              </div>
                              <div>
                                <span className="text-blue-600 dark:text-blue-400 font-medium">Name:</span>
                                <p className="text-gray-900 dark:text-white mt-1">{metric.name}</p>
                              </div>
                              <div>
                                <span className="text-blue-600 dark:text-blue-400 font-medium">Target Type:</span>
                                <p className="text-gray-900 dark:text-white mt-1">{metric.targetType}</p>
                              </div>
                              <div>
                                <span className="text-blue-600 dark:text-blue-400 font-medium">Target Value:</span>
                                <p className="text-gray-900 dark:text-white mt-1">{metric.targetValue}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Current Metrics */}
                  {currentMetrics.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        Current Metrics
                      </h3>
                      <div className="space-y-2">
                        {currentMetrics.map((metric: any) => (
                          <div
                            key={metric.index}
                            className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800"
                          >
                            <div className="grid grid-cols-3 gap-3 text-sm">
                              <div>
                                <span className="text-green-600 dark:text-green-400 font-medium">Type:</span>
                                <p className="text-gray-900 dark:text-white mt-1">{metric.type}</p>
                              </div>
                              <div>
                                <span className="text-green-600 dark:text-green-400 font-medium">Name:</span>
                                <p className="text-gray-900 dark:text-white mt-1">{metric.name}</p>
                              </div>
                              <div>
                                <span className="text-green-600 dark:text-green-400 font-medium">Current Value:</span>
                                <p className="text-gray-900 dark:text-white mt-1">{metric.currentValue}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conditions */}
                  {conditions.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        Conditions
                      </h3>
                      <div className="space-y-2">
                        {conditions.map((condition: any, index: number) => (
                          <div
                            key={index}
                            className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                          >
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-gray-600 dark:text-gray-400 font-medium">Type:</span>
                                <p className="text-gray-900 dark:text-white mt-1">{condition.type}</p>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400 font-medium">Status:</span>
                                <p className="text-gray-900 dark:text-white mt-1">{condition.status}</p>
                              </div>
                              {condition.reason && (
                                <div className="col-span-2">
                                  <span className="text-gray-600 dark:text-gray-400 font-medium">Reason:</span>
                                  <p className="text-gray-900 dark:text-white mt-1">{condition.reason}</p>
                                </div>
                              )}
                              {condition.message && (
                                <div className="col-span-2">
                                  <span className="text-gray-600 dark:text-gray-400 font-medium">Message:</span>
                                  <p className="text-gray-900 dark:text-white mt-1">{condition.message}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Labels */}
                  {hpa.metadata?.labels && Object.keys(hpa.metadata.labels).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                        Labels
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(hpa.metadata.labels).map(([key, value]) => (
                            <span
                              key={key}
                              className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            >
                              <span className="font-semibold">{key}</span>
                              <span className="mx-1">=</span>
                              <span>{value as string}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
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

