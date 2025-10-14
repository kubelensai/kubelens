import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, ExclamationTriangleIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useMutation } from '@tanstack/react-query'
import api from '@/services/api'

interface DeleteStatefulSetModalProps {
  statefulset: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function DeleteStatefulSetModal({
  statefulset,
  isOpen,
  onClose,
  onSuccess,
}: DeleteStatefulSetModalProps) {
  if (!statefulset) {
    console.error('DeleteStatefulSetModal: statefulset is null!')
    return null
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      console.log('Deleting statefulset:', statefulset.metadata.name)
      const response = await api.delete(
        `/clusters/${statefulset.clusterName}/namespaces/${statefulset.metadata.namespace}/statefulsets/${statefulset.metadata.name}`
      )
      console.log('Delete response:', response)
      return response
    },
    onSuccess: () => {
      console.log('Delete successful, calling onSuccess')
      onSuccess()
    },
    onError: (err: any) => {
      console.error('Failed to delete statefulset:', err)
    },
  })

  const handleDelete = () => {
    console.log('handleDelete called')
    deleteMutation.mutate()
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
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
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                    onClick={onClose}
                    disabled={deleteMutation.isPending}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 sm:mx-0 sm:h-10 sm:w-10">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold leading-6 text-gray-900 dark:text-white"
                    >
                      Delete StatefulSet
                    </Dialog.Title>
                    <div className="mt-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Are you sure you want to delete this statefulset? This action cannot be undone.
                      </p>
                      
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">StatefulSet:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {statefulset?.metadata?.name}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Namespace:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {statefulset?.metadata?.namespace}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Current Pods:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {statefulset?.status?.replicas || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                              Warning
                            </h3>
                            <div className="mt-2 text-sm text-red-700 dark:text-red-400">
                              <ul className="list-disc list-inside space-y-1">
                                <li>All pods managed by this statefulset will be deleted</li>
                                <li>This action is permanent and cannot be reversed</li>
                                <li>Consider scaling to 0 replicas instead if unsure</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="inline-flex w-full justify-center items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
                  >
                    {deleteMutation.isPending ? (
                      <>
                        <TrashIcon className="h-4 w-4 animate-pulse" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <TrashIcon className="h-4 w-4" />
                        Delete StatefulSet
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={deleteMutation.isPending}
                    className="mt-3 inline-flex w-full justify-center rounded-lg bg-white dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed sm:mt-0 sm:w-auto"
                  >
                    Cancel
                  </button>
                </div>

                {deleteMutation.isError && (
                  <div className="mt-4 rounded-md bg-red-50 dark:bg-red-900/20 p-3">
                    <p className="text-sm text-red-800 dark:text-red-300">
                      Failed to delete statefulset. Please try again.
                    </p>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}

