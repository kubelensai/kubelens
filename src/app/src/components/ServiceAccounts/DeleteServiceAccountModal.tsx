import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useMutation } from '@tanstack/react-query'
import { deleteServiceAccount } from '@/services/api'

interface DeleteServiceAccountModalProps {
  serviceAccount: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function DeleteServiceAccountModal({
  serviceAccount,
  isOpen,
  onClose,
  onSuccess,
}: DeleteServiceAccountModalProps) {
  const [error, setError] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: ({ cluster, namespace, name }: { cluster: string; namespace: string; name: string }) =>
      deleteServiceAccount(cluster, namespace, name),
    onSuccess: () => {
      onSuccess()
      onClose()
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to delete ServiceAccount')
    },
  })

  const handleDelete = () => {
    if (!serviceAccount) return

    deleteMutation.mutate({
      cluster: serviceAccount.ClusterName,
      namespace: serviceAccount.metadata.namespace,
      name: serviceAccount.metadata.name,
    })
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
          <div className="fixed inset-0 bg-black/25 dark:bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 sm:h-10 sm:w-10">
                      <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <Dialog.Title
                      as="h3"
                      className="ml-3 text-xl font-semibold leading-6 text-gray-900 dark:text-white"
                    >
                      Delete ServiceAccount
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {error && (
                  <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <div className="mt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Are you sure you want to delete this ServiceAccount? This action cannot be undone.
                  </p>

                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Name:</span>
                      <span className="text-sm text-gray-900 dark:text-white font-mono">
                        {serviceAccount?.metadata?.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Namespace:</span>
                      <span className="text-sm text-gray-900 dark:text-white font-mono">
                        {serviceAccount?.metadata?.namespace}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Cluster:</span>
                      <span className="text-sm text-gray-900 dark:text-white font-mono">
                        {serviceAccount?.ClusterName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Secrets:</span>
                      <span className="text-sm text-gray-900 dark:text-white">
                        {(serviceAccount?.secrets || []).length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 transition-colors"
                    onClick={onClose}
                    disabled={deleteMutation.isPending}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-lg border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
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

