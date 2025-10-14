import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useMutation } from '@tanstack/react-query'
import { deleteClusterRoleBinding } from '@/services/api'
import { useNotificationStore } from '@/stores/notificationStore'

interface DeleteClusterRoleBindingBindingModalProps {
  clusterRoleBinding: any
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function DeleteClusterRoleBindingBindingModal({
  clusterRoleBinding,
  isOpen,
  onClose,
  onSuccess,
}: DeleteClusterRoleBindingBindingModalProps) {
  const { addNotification } = useNotificationStore()

  const deleteMutation = useMutation({
    mutationFn: ({ clusterName, crName }: { clusterName: string; crName: string }) =>
      deleteClusterRoleBinding(clusterName, crName),
    onSuccess: () => {
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Cluster Role Binding deleted successfully',
      })
      onSuccess?.()
      onClose()
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.error || 'Failed to delete cluster role binding',
      })
    },
  })

  const handleDelete = () => {
    const clusterName = clusterRoleBinding.ClusterName
    const crName = clusterRoleBinding.metadata?.name
    deleteMutation.mutate({ clusterName, crName })
  }

  if (!clusterRoleBinding) return null

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
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-red-50 dark:bg-red-900/20">
                  <Dialog.Title className="text-xl font-bold text-red-900 dark:text-red-400 flex items-center gap-2">
                    <TrashIcon className="h-6 w-6" />
                    Delete Cluster Role Binding
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    disabled={deleteMutation.isPending}
                    className="rounded-lg p-2 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                  >
                    <XMarkIcon className="h-5 w-5 text-red-500 dark:text-red-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <ExclamationTriangleIcon className="h-10 w-10 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                        Are you sure you want to delete this cluster role binding? This action cannot be undone.
                      </p>
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-500 dark:text-gray-400">Name:</span>
                          <span className="text-gray-900 dark:text-white font-mono">
                            {clusterRoleBinding.metadata?.name}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-500 dark:text-gray-400">Cluster:</span>
                          <span className="text-gray-900 dark:text-white font-mono">
                            {clusterRoleBinding.ClusterName}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-500 dark:text-gray-400">Rules:</span>
                          <span className="text-gray-900 dark:text-white">
                            {(clusterRoleBinding.rules || []).length}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={deleteMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {deleteMutation.isPending ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <TrashIcon className="h-4 w-4" />
                        Delete
                      </>
                    )}
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

