import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useMutation } from '@tanstack/react-query'
import { deleteNamespace } from '@/services/api'

interface DeleteNamespaceModalProps {
  namespace: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function DeleteNamespaceModal({
  namespace,
  isOpen,
  onClose,
  onSuccess,
}: DeleteNamespaceModalProps) {
  const deleteMutation = useMutation({
    mutationFn: () => deleteNamespace(namespace.clusterName, namespace.metadata.name),
    onSuccess: () => {
      onSuccess()
      onClose()
    },
  })

  const handleDelete = () => {
    deleteMutation.mutate()
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                    Delete Namespace
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="mb-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                      Are you sure you want to delete this namespace? This action cannot be undone.
                    </p>

                    <div className="space-y-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Name:</span>
                        <span className="text-sm font-mono text-gray-900 dark:text-white">{namespace?.metadata?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cluster:</span>
                        <span className="text-sm font-mono text-gray-900 dark:text-white">{namespace?.clusterName}</span>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        ⚠️ <strong>Warning:</strong> Deleting a namespace will also delete all resources within it, including pods, services, config maps, and secrets.
                      </p>
                    </div>
                  </div>

                  {deleteMutation.isError && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Failed to delete namespace: {(deleteMutation.error as any)?.response?.data?.error || (deleteMutation.error as Error).message}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={deleteMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleteMutation.isPending ? 'Deleting...' : 'Delete Namespace'}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

