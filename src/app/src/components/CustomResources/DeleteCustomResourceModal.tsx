import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useMutation } from '@tanstack/react-query'
import { deleteCustomResource } from '@/services/api'
import { useNotificationStore } from '@/stores/notificationStore'

interface DeleteCustomResourceModalProps {
  resource: any
  group: string
  version: string
  resourceType: string
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function DeleteCustomResourceModal({
  resource,
  group,
  version,
  resourceType,
  isOpen,
  onClose,
  onSuccess,
}: DeleteCustomResourceModalProps) {
  const { addNotification } = useNotificationStore()

  const deleteMutation = useMutation({
    mutationFn: ({
      clusterName,
      group,
      version,
      resourceType,
      resourceName,
      namespace,
    }: {
      clusterName: string
      group: string
      version: string
      resourceType: string
      resourceName: string
      namespace?: string
    }) => deleteCustomResource(clusterName, group, version, resourceType, resourceName, namespace),
    onSuccess: () => {
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Resource deleted successfully',
      })
      if (onSuccess) onSuccess()
      onClose()
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.error || 'Failed to delete resource',
      })
    },
  })

  const handleDelete = () => {
    if (resource) {
      deleteMutation.mutate({
        clusterName: resource.ClusterName || resource.metadata?.clusterName,
        group,
        version,
        resourceType,
        resourceName: resource.metadata?.name,
        namespace: resource.metadata?.namespace,
      })
    }
  }

  if (!resource) return null

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
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                        <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Delete Resource
                      </Dialog.Title>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Are you sure you want to delete this resource? This action cannot be undone.
                      </p>

                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Name:</span>
                          <span className="font-medium text-gray-900 dark:text-white font-mono">
                            {resource.metadata?.name}
                          </span>
                        </div>
                        {resource.metadata?.namespace && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">Namespace:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {resource.metadata.namespace}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Type:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {group}/{version}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={onClose}
                      disabled={deleteMutation.isPending}
                      className="rounded-lg p-1 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    </button>
                  </div>
                </div>

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
                      'Delete Resource'
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

