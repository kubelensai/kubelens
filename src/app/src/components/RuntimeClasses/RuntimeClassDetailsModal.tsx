import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { XMarkIcon, CommandLineIcon } from '@heroicons/react/24/outline'
import { formatAge } from '@/utils/format'

interface RuntimeClassDetailsModalProps {
  runtimeClass: any
  isOpen: boolean
  onClose: () => void
}

export default function RuntimeClassDetailsModal({
  runtimeClass,
  isOpen,
  onClose,
}: RuntimeClassDetailsModalProps) {
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
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
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
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                      <CommandLineIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
                        {runtimeClass.metadata?.name}
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Runtime Class Details
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4 space-y-6 max-h-[70vh] overflow-y-auto">
                  {/* Basic Information */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Name
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white font-medium">
                          {runtimeClass.metadata?.name}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Cluster
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {runtimeClass.clusterName}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Handler
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                          {runtimeClass.handler}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Created
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {formatAge(runtimeClass.metadata?.creationTimestamp)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Overhead Configuration */}
                  {runtimeClass.overhead?.podFixed && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                        Pod Overhead
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-4">
                          {runtimeClass.overhead.podFixed.cpu && (
                            <div>
                              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                CPU
                              </label>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                                {runtimeClass.overhead.podFixed.cpu}
                              </p>
                            </div>
                          )}
                          {runtimeClass.overhead.podFixed.memory && (
                            <div>
                              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                Memory
                              </label>
                              <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                                {runtimeClass.overhead.podFixed.memory}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Scheduling Configuration */}
                  {runtimeClass.scheduling && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                        Scheduling
                      </h3>
                      <div className="space-y-4">
                        {/* Node Selector */}
                        {runtimeClass.scheduling.nodeSelector && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              Node Selector
                            </label>
                            <div className="mt-2 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 font-mono text-xs">
                              {Object.entries(runtimeClass.scheduling.nodeSelector).map(([key, value]) => (
                                <div key={key} className="text-gray-900 dark:text-white">
                                  {key}: {String(value)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tolerations */}
                        {runtimeClass.scheduling.tolerations && runtimeClass.scheduling.tolerations.length > 0 && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              Tolerations
                            </label>
                            <div className="mt-2 space-y-2">
                              {runtimeClass.scheduling.tolerations.map((toleration: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-xs"
                                >
                                  <div className="grid grid-cols-2 gap-2">
                                    {toleration.key && (
                                      <div>
                                        <span className="text-gray-500 dark:text-gray-400">Key: </span>
                                        <span className="text-gray-900 dark:text-white font-mono">
                                          {toleration.key}
                                        </span>
                                      </div>
                                    )}
                                    {toleration.operator && (
                                      <div>
                                        <span className="text-gray-500 dark:text-gray-400">Operator: </span>
                                        <span className="text-gray-900 dark:text-white">{toleration.operator}</span>
                                      </div>
                                    )}
                                    {toleration.effect && (
                                      <div>
                                        <span className="text-gray-500 dark:text-gray-400">Effect: </span>
                                        <span className="text-gray-900 dark:text-white">{toleration.effect}</span>
                                      </div>
                                    )}
                                    {toleration.value && (
                                      <div>
                                        <span className="text-gray-500 dark:text-gray-400">Value: </span>
                                        <span className="text-gray-900 dark:text-white">{toleration.value}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Labels */}
                  {runtimeClass.metadata?.labels && Object.keys(runtimeClass.metadata.labels).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                        Labels
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 font-mono text-xs space-y-1">
                        {Object.entries(runtimeClass.metadata.labels).map(([key, value]) => (
                          <div key={key} className="text-gray-900 dark:text-white">
                            <span className="text-primary-600 dark:text-primary-400">{key}</span>:{' '}
                            {String(value)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Annotations */}
                  {runtimeClass.metadata?.annotations && Object.keys(runtimeClass.metadata.annotations).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                        Annotations
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 font-mono text-xs space-y-1 max-h-40 overflow-y-auto">
                        {Object.entries(runtimeClass.metadata.annotations).map(([key, value]) => (
                          <div key={key} className="text-gray-900 dark:text-white">
                            <span className="text-primary-600 dark:text-primary-400">{key}</span>:{' '}
                            {String(value)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
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
