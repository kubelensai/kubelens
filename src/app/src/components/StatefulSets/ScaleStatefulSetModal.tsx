import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useMutation } from '@tanstack/react-query'
import api from '@/services/api'

interface ScaleStatefulSetModalProps {
  statefulset: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ScaleStatefulSetModal({
  statefulset,
  isOpen,
  onClose,
  onSuccess,
}: ScaleStatefulSetModalProps) {
  const [replicas, setReplicas] = useState<number>(statefulset?.spec?.replicas || 1)
  const [error, setError] = useState<string>('')

  // Update replicas when statefulset changes or modal opens
  useEffect(() => {
    if (isOpen && statefulset) {
      setReplicas(statefulset.spec?.replicas || 1)
      setError('')
    }
  }, [isOpen, statefulset])

  const scaleMutation = useMutation({
    mutationFn: async (newReplicas: number) => {
      await api.patch(
        `/clusters/${statefulset.clusterName}/namespaces/${statefulset.metadata.namespace}/statefulsets/${statefulset.metadata.name}/scale`,
        { replicas: newReplicas }
      )
    },
    onSuccess: () => {
      onSuccess()
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to scale statefulset')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (replicas < 0) {
      setError('Replicas must be a non-negative number')
      return
    }
    
    scaleMutation.mutate(replicas)
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
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="w-full mt-3 text-center sm:mt-0 sm:text-left">
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold leading-6 text-gray-900 dark:text-white mb-4"
                    >
                      Scale StatefulSet
                    </Dialog.Title>

                    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                      <div>
                        <label
                          htmlFor="statefulset-name"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          StatefulSet
                        </label>
                        <input
                          type="text"
                          id="statefulset-name"
                          value={statefulset?.metadata?.name || ''}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="current-replicas"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          Current Replicas
                        </label>
                        <input
                          type="number"
                          id="current-replicas"
                          value={statefulset?.spec?.replicas || 0}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="new-replicas"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        >
                          New Replicas
                        </label>
                        <input
                          type="number"
                          id="new-replicas"
                          min="0"
                          value={replicas}
                          onChange={(e) => setReplicas(parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                          autoFocus
                        />
                      </div>

                      {error && (
                        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
                          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                        </div>
                      )}

                      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                        <button
                          type="submit"
                          disabled={scaleMutation.isPending}
                          className="inline-flex w-full justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
                        >
                          {scaleMutation.isPending ? 'Scaling...' : 'Scale'}
                        </button>
                        <button
                          type="button"
                          onClick={onClose}
                          className="mt-3 inline-flex w-full justify-center rounded-lg bg-white dark:bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:mt-0 sm:w-auto"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}


