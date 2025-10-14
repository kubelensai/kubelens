import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, RectangleGroupIcon } from '@heroicons/react/24/outline'

interface IngressClassDetailsModalProps {
  ingressClass: any
  isOpen: boolean
  onClose: () => void
}

export default function IngressClassDetailsModal({ ingressClass, isOpen, onClose }: IngressClassDetailsModalProps) {
  if (!ingressClass) return null

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
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <RectangleGroupIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Priority Class Details
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                  {/* Basic Info */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Basic Information</h3>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Name</span>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{ingressClass.metadata?.name}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Cluster</span>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{ingressClass.clusterName}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Created</span>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(ingressClass.metadata?.creationTimestamp).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">UID</span>
                          <p className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">
                            {ingressClass.metadata?.uid}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Priority Configuration */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Priority Configuration</h3>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Priority Value</span>
                        <div className="flex items-center gap-2 mt-1">
                          <RectangleGroupIcon className="h-5 w-5 text-primary-500" />
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{ingressClass.value}</p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Higher values indicate higher priority
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Global Default</span>
                        <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                          {ingressClass.globalDefault ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Yes - This is the default priority for pods without a ingress class
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                              No
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Preemption Policy</span>
                        <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                          {ingressClass.preemptionPolicy || 'PreemptLowerPriority'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {ingressClass.preemptionPolicy === 'Never'
                            ? 'Pods with this ingress class will not preempt other pods'
                            : 'Pods with this ingress class can preempt pods with lower priority'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {ingressClass.description && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Description</h3>
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                        <p className="text-sm text-gray-700 dark:text-gray-300">{ingressClass.description}</p>
                      </div>
                    </div>
                  )}

                  {/* Labels */}
                  {ingressClass.metadata?.labels && Object.keys(ingressClass.metadata.labels).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Labels</h3>
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(ingressClass.metadata.labels).map(([key, value]) => (
                            <span
                              key={key}
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            >
                              {key}={String(value)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Annotations */}
                  {ingressClass.metadata?.annotations && Object.keys(ingressClass.metadata.annotations).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Annotations</h3>
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                        <div className="space-y-1">
                          {Object.entries(ingressClass.metadata.annotations).map(([key, value]) => (
                            <div key={key} className="text-xs font-mono">
                              <span className="text-gray-600 dark:text-gray-400">{key}:</span>{' '}
                              <span className="text-gray-900 dark:text-white">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-end border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
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

