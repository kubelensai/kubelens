import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { deletePersistentVolumeClaim } from '@/services/api'
import { notifyResourceAction } from '@/utils/notifications'

interface DeletePVCModalProps {
  pvc: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function DeletePVCModal({
  pvc,
  isOpen,
  onClose,
  onSuccess,
}: DeletePVCModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setIsDeleting(true)
    setError('')
    
    try {
      await deletePersistentVolumeClaim(
        pvc.clusterName,
        pvc.metadata.namespace,
        pvc.metadata.name
      )

      notifyResourceAction.deleted('PVC', pvc.metadata.name)
      onSuccess()
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to delete PVC'
      setError(errorMsg)
      notifyResourceAction.failed('delete', 'PVC', pvc.metadata.name, errorMsg)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!pvc) return null

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
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-red-50 dark:bg-red-900/20">
                  <Dialog.Title className="text-xl font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-6 w-6" />
                    Delete PVC
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Are you sure you want to delete this persistent volume claim? This action cannot be undone.
                    <span className="block mt-2 font-medium text-red-600 dark:text-red-400">
                      Warning: Deleting this PVC will release the associated storage.
                    </span>
                  </p>

                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Name:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {pvc.metadata.name}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Namespace:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {pvc.metadata.namespace}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Status:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {pvc.status?.phase || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Storage:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {pvc.status?.capacity?.storage || pvc.spec?.resources?.requests?.storage || '-'}
                      </span>
                    </div>
                    {pvc.spec?.volumeName && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Volume:</span>
                        <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]" title={pvc.spec.volumeName}>
                          {pvc.spec.volumeName}
                        </span>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isDeleting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
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
                      'Delete PVC'
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

