import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CircleStackIcon } from '@heroicons/react/24/outline'
import { StarIcon } from '@heroicons/react/24/solid'
import { formatAge } from '@/utils/format'

interface StorageClassDetailsModalProps {
  storageClass: any
  isOpen: boolean
  onClose: () => void
}

export default function StorageClassDetailsModal({
  storageClass,
  isOpen,
  onClose,
}: StorageClassDetailsModalProps) {
  if (!storageClass) return null

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
                    <CircleStackIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Storage Class Details
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                  {/* Basic Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Name
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                          {storageClass.metadata.name}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Age
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {formatAge(storageClass.metadata.creationTimestamp)}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Default
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {storageClass.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                              <StarIcon className="h-3 w-3 mr-1" />
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400">
                              No
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Provisioner Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Provisioner Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Provisioner
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                          {storageClass.provisioner}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Reclaim Policy
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {storageClass.reclaimPolicy || 'Delete'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Volume Binding Mode
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {storageClass.volumeBindingMode || 'Immediate'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Allow Volume Expansion
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {storageClass.allowVolumeExpansion ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400">
                              No
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Parameters */}
                  {storageClass.parameters && Object.keys(storageClass.parameters).length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        Parameters
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(storageClass.parameters).map(([key, value]) => (
                          <div
                            key={key}
                            className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                          >
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {key}
                            </span>
                            <code className="text-sm text-gray-900 dark:text-white">
                              {String(value)}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mount Options */}
                  {storageClass.mountOptions && storageClass.mountOptions.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        Mount Options
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {storageClass.mountOptions.map((option: string, idx: number) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                          >
                            {option}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Labels */}
                  {storageClass.metadata.labels && Object.keys(storageClass.metadata.labels).length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        Labels
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(storageClass.metadata.labels).map(([key, value]) => (
                          <span
                            key={key}
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                          >
                            <code>{key}: {String(value)}</code>
                          </span>
                        ))}
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

