import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { formatDistanceToNow } from 'date-fns'

interface DeploymentDetailsModalProps {
  deployment: any
  isOpen: boolean
  onClose: () => void
}

export default function DeploymentDetailsModal({ deployment, isOpen, onClose }: DeploymentDetailsModalProps) {
  if (!deployment) return null

  return (
    <Transition.Root show={isOpen} as={Fragment}>
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
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6">
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="w-full mt-3 text-center sm:mt-0 sm:text-left">
                    <Dialog.Title
                      as="h3"
                      className="text-xl font-semibold leading-6 text-gray-900 dark:text-white mb-4"
                    >
                      Deployment Details: {deployment.metadata.name}
                    </Dialog.Title>

                    <div className="mt-4 space-y-6">
                      {/* Basic Info */}
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                          Basic Information
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Cluster:</span>
                            <span className="ml-2 text-gray-900 dark:text-white font-medium">
                              {deployment.clusterName}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Namespace:</span>
                            <span className="ml-2 text-gray-900 dark:text-white font-medium">
                              {deployment.metadata.namespace}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Created:</span>
                            <span className="ml-2 text-gray-900 dark:text-white">
                              {formatDistanceToNow(new Date(deployment.metadata.creationTimestamp), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">UID:</span>
                            <span className="ml-2 text-gray-900 dark:text-white font-mono text-xs">
                              {deployment.metadata.uid}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Replica Status */}
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                          Replica Status
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                            <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Desired</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                              {deployment.spec.replicas || 0}
                            </div>
                          </div>
                          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                            <div className="text-green-600 dark:text-green-400 text-xs mb-1">Ready</div>
                            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                              {deployment.status.readyReplicas || 0}
                            </div>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <div className="text-blue-600 dark:text-blue-400 text-xs mb-1">Up-to-date</div>
                            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                              {deployment.status.updatedReplicas || 0}
                            </div>
                          </div>
                          <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                            <div className="text-purple-600 dark:text-purple-400 text-xs mb-1">Available</div>
                            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                              {deployment.status.availableReplicas || 0}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Strategy */}
                      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                          Update Strategy
                        </h4>
                        <div className="text-sm space-y-2">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Type:</span>
                            <span className="ml-2 text-gray-900 dark:text-white font-medium">
                              {deployment.spec.strategy?.type || 'RollingUpdate'}
                            </span>
                          </div>
                          {deployment.spec.strategy?.rollingUpdate && (
                            <>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Max Surge:</span>
                                <span className="ml-2 text-gray-900 dark:text-white">
                                  {deployment.spec.strategy.rollingUpdate.maxSurge || 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Max Unavailable:</span>
                                <span className="ml-2 text-gray-900 dark:text-white">
                                  {deployment.spec.strategy.rollingUpdate.maxUnavailable || 'N/A'}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Selector */}
                      {deployment.spec.selector?.matchLabels && (
                        <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                            Selector
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(deployment.spec.selector.matchLabels).map(([key, value]) => (
                              <span
                                key={key}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                              >
                                {key}: {String(value)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Labels */}
                      {deployment.metadata.labels && Object.keys(deployment.metadata.labels).length > 0 && (
                        <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                            Labels
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(deployment.metadata.labels).map(([key, value]) => (
                              <span
                                key={key}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                              >
                                {key}: {String(value)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Annotations */}
                      {deployment.metadata.annotations && Object.keys(deployment.metadata.annotations).length > 0 && (
                        <div className="pb-4">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                            Annotations
                          </h4>
                          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-xs font-mono max-h-40 overflow-auto">
                            {Object.entries(deployment.metadata.annotations).map(([key, value]) => (
                              <div key={key} className="text-gray-700 dark:text-gray-300 mb-1">
                                <span className="text-gray-500 dark:text-gray-400">{key}:</span>{' '}
                                <span className="break-all">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Conditions */}
                      {deployment.status.conditions && deployment.status.conditions.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                            Conditions
                          </h4>
                          <div className="space-y-2">
                            {deployment.status.conditions.map((condition: any, index: number) => (
                              <div
                                key={index}
                                className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-xs"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {condition.type}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      condition.status === 'True'
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                    }`}
                                  >
                                    {condition.status}
                                  </span>
                                </div>
                                {condition.reason && (
                                  <div className="text-gray-600 dark:text-gray-400">
                                    Reason: {condition.reason}
                                  </div>
                                )}
                                {condition.message && (
                                  <div className="text-gray-600 dark:text-gray-400 mt-1">
                                    {condition.message}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}


