import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CircleStackIcon } from '@heroicons/react/24/outline'
import { formatAge } from '@/utils/format'

interface PVDetailsModalProps {
  pv: any
  isOpen: boolean
  onClose: () => void
}

export default function PVDetailsModal({
  pv,
  isOpen,
  onClose,
}: PVDetailsModalProps) {
  if (!pv) return null

  const getStatusBadge = (phase: string) => {
    const statusColors: Record<string, string> = {
      'Available': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'Bound': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'Released': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      'Failed': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    }
    return statusColors[phase] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
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
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <CircleStackIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    PV Details
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
                          {pv.metadata.name}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Status
                        </label>
                        <div className="mt-1">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(pv.status?.phase)}`}>
                            {pv.status?.phase || 'Unknown'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Capacity
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {pv.spec?.capacity?.storage || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Age
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {formatAge(pv.metadata.creationTimestamp)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Storage Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Storage Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Storage Class
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {pv.spec?.storageClassName || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Reclaim Policy
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {pv.spec?.persistentVolumeReclaimPolicy || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Volume Mode
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {pv.spec?.volumeMode || 'Filesystem'}
                        </p>
                      </div>
                      {pv.spec?.claimRef && (
                        <div>
                          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Bound to Claim
                          </label>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                            {pv.spec.claimRef.namespace}/{pv.spec.claimRef.name}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Access Modes */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Access Modes
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {pv.spec?.accessModes?.map((mode: string, idx: number) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        >
                          {mode}
                        </span>
                      )) || <span className="text-sm text-gray-500 dark:text-gray-400">No access modes defined</span>}
                    </div>
                  </div>

                  {/* Mount Options */}
                  {pv.spec?.mountOptions && pv.spec.mountOptions.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        Mount Options
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {pv.spec.mountOptions.map((option: string, idx: number) => (
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
                  {pv.metadata.labels && Object.keys(pv.metadata.labels).length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        Labels
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(pv.metadata.labels).map(([key, value]) => (
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

                  {/* Volume Source Info */}
                  {pv.spec && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        Volume Source
                      </h3>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                          {Object.keys(pv.spec)
                            .filter(key => !['capacity', 'accessModes', 'persistentVolumeReclaimPolicy', 'storageClassName', 'claimRef', 'volumeMode', 'mountOptions'].includes(key))
                            .map(key => `${key}: ${typeof pv.spec[key] === 'object' ? JSON.stringify(pv.spec[key], null, 2) : pv.spec[key]}`)
                            .join('\n') || 'No volume source defined'}
                        </pre>
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

