import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { XMarkIcon, ClockIcon } from '@heroicons/react/24/outline'
import { formatAge } from '@/utils/format'
import { format } from 'date-fns'

interface LeaseDetailsModalProps {
  lease: any
  isOpen: boolean
  onClose: () => void
}

export default function LeaseDetailsModal({
  lease,
  isOpen,
  onClose,
}: LeaseDetailsModalProps) {
  const formatDateTime = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'N/A'
    try {
      return format(new Date(timestamp), 'MMM dd, yyyy HH:mm:ss')
    } catch {
      return 'Invalid date'
    }
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
                      <ClockIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
                        {lease.metadata?.name}
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Lease Details
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
                          {lease.metadata?.name}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Namespace
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {lease.metadata?.namespace}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Cluster
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {lease.clusterName}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Created
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {formatAge(lease.metadata?.creationTimestamp)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Lease Spec */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                      Lease Configuration
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Holder Identity
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono break-all">
                          {lease.spec?.holderIdentity || 'N/A'}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Lease Duration
                          </label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">
                            {lease.spec?.leaseDurationSeconds ? `${lease.spec.leaseDurationSeconds}s` : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Lease Transitions
                          </label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">
                            {lease.spec?.leaseTransitions || 0}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Acquire Time
                          </label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">
                            {formatDateTime(lease.spec?.acquireTime)}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Renew Time
                          </label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">
                            {formatDateTime(lease.spec?.renewTime)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Labels */}
                  {lease.metadata?.labels && Object.keys(lease.metadata.labels).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                        Labels
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 font-mono text-xs space-y-1">
                        {Object.entries(lease.metadata.labels).map(([key, value]) => (
                          <div key={key} className="text-gray-900 dark:text-white">
                            <span className="text-primary-600 dark:text-primary-400">{key}</span>:{' '}
                            {String(value)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Annotations */}
                  {lease.metadata?.annotations && Object.keys(lease.metadata.annotations).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                        Annotations
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 font-mono text-xs space-y-1 max-h-40 overflow-y-auto">
                        {Object.entries(lease.metadata.annotations).map(([key, value]) => (
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

