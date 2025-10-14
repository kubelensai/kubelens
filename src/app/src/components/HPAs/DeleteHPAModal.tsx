import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { deleteHPA } from '@/services/api'
import { notifyResourceAction } from '@/utils/notifications'

interface DeleteHPAModalProps {
  hpa: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function DeleteHPAModal({
  hpa,
  isOpen,
  onClose,
  onSuccess,
}: DeleteHPAModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteHPA(hpa.clusterName, hpa.metadata.namespace, hpa.metadata.name)
      notifyResourceAction.deleted('HPA', hpa.metadata.name)
      onSuccess()
      onClose()
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error'
      notifyResourceAction.failed('delete', 'HPA', hpa.metadata.name, errorMsg)
      console.error('Failed to delete HPA:', error)
    } finally {
      setIsDeleting(false)
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
          <div className="fixed inset-0 bg-black/25 dark:bg-black/50" />
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all">
                <div className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                        <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                        Delete HPA
                      </Dialog.Title>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        Are you sure you want to delete the HPA <span className="font-semibold text-gray-900 dark:text-white">{hpa.metadata?.name}</span> from namespace{' '}
                        <span className="font-semibold text-gray-900 dark:text-white">{hpa.metadata?.namespace}</span>?
                      </p>
                      <div className="mt-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-3 border border-yellow-200 dark:border-yellow-800">
                        <p className="text-sm text-yellow-800 dark:text-yellow-400">
                          <strong>Warning:</strong> This action will stop automatic scaling for the target resource. The deployment will no longer scale based on metrics.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isDeleting}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {isDeleting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Deleting...
                        </>
                      ) : (
                        'Delete HPA'
                      )}
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

