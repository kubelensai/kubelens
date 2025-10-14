import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'

interface PDBDetailsModalProps {
  pdb: any
  isOpen: boolean
  onClose: () => void
}

export default function PDBDetailsModal({ pdb, isOpen, onClose }: PDBDetailsModalProps) {
  if (!pdb) return null

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
                    <AdjustmentsHorizontalIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Pod Disruption Budget Details
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
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{pdb.metadata?.name}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Namespace</span>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{pdb.metadata?.namespace}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Cluster</span>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{pdb.clusterName}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Created</span>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(pdb.metadata?.creationTimestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Disruption Configuration */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Disruption Configuration</h3>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
                      {pdb.spec?.minAvailable !== undefined && (
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Min Available</span>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{pdb.spec.minAvailable}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Minimum number of pods that must be available during a disruption
                          </p>
                        </div>
                      )}
                      {pdb.spec?.maxUnavailable !== undefined && (
                        <div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Max Unavailable</span>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{pdb.spec.maxUnavailable}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Maximum number of pods that can be unavailable during a disruption
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selector */}
                  {pdb.spec?.selector && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Selector</h3>
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                        {pdb.spec.selector.matchLabels && (
                          <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Match Labels</span>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {Object.entries(pdb.spec.selector.matchLabels).map(([key, value]) => (
                                <span
                                  key={key}
                                  className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                >
                                  {key}={String(value)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Status */}
                  {pdb.status && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Status</h3>
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2">
                        <div className="grid grid-cols-3 gap-4">
                          {pdb.status.currentHealthy !== undefined && (
                            <div>
                              <span className="text-xs text-gray-500 dark:text-gray-400">Current Healthy</span>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{pdb.status.currentHealthy}</p>
                            </div>
                          )}
                          {pdb.status.desiredHealthy !== undefined && (
                            <div>
                              <span className="text-xs text-gray-500 dark:text-gray-400">Desired Healthy</span>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{pdb.status.desiredHealthy}</p>
                            </div>
                          )}
                          {pdb.status.disruptionsAllowed !== undefined && (
                            <div>
                              <span className="text-xs text-gray-500 dark:text-gray-400">Disruptions Allowed</span>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{pdb.status.disruptionsAllowed}</p>
                            </div>
                          )}
                        </div>
                        {pdb.status.expectedPods !== undefined && (
                          <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Expected Pods</span>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{pdb.status.expectedPods}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Labels */}
                  {pdb.metadata?.labels && Object.keys(pdb.metadata.labels).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Labels</h3>
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(pdb.metadata.labels).map(([key, value]) => (
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

