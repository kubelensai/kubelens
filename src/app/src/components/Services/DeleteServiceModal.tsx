import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ExclamationTriangleIcon, XMarkIcon, CloudIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import clsx from 'clsx'

interface DeleteServiceModalProps {
  service: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function DeleteServiceModal({ service, isOpen, onClose, onSuccess }: DeleteServiceModalProps) {
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: async (serviceToDelete: any) => {
      if (!serviceToDelete) {
        throw new Error('Service data is missing for deletion.')
      }
      await api.delete(
        `/clusters/${serviceToDelete.clusterName}/namespaces/${serviceToDelete.metadata.namespace}/services/${serviceToDelete.metadata.name}`
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['services'] })
      await queryClient.invalidateQueries({ queryKey: ['all-services'] })
      await queryClient.refetchQueries({ queryKey: ['services'] })
      await queryClient.refetchQueries({ queryKey: ['all-services'] })
      onSuccess()
    },
    onError: (error) => {
      console.error('Error deleting service:', error)
    },
  })

  const handleDelete = () => {
    if (service) {
      deleteMutation.mutate(service)
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
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between">
                  <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-gray-900 dark:text-white flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
                    Delete Service
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                <div className="mt-4">
                  {service ? (
                    <>
                      <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg mb-4">
                        <CloudIcon className="h-5 w-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {service.metadata.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Namespace: {service.metadata.namespace}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Type: {service.spec.type}
                          </p>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Are you sure you want to delete this service?
                      </p>
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">
                        This action cannot be undone. Any pods using this service will lose their network endpoint.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No service selected for deletion.
                    </p>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onClose}
                    disabled={deleteMutation.isPending}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={clsx(
                      "btn-danger",
                      deleteMutation.isPending && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending || !service}
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete Service'}
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

