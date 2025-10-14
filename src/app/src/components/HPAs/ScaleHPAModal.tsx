import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ArrowsUpDownIcon } from '@heroicons/react/24/outline'
import api from '@/services/api'
import { notifyResourceAction } from '@/utils/notifications'

interface ScaleHPAModalProps {
  hpa: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ScaleHPAModal({
  hpa,
  isOpen,
  onClose,
  onSuccess,
}: ScaleHPAModalProps) {
  const [minReplicas, setMinReplicas] = useState(hpa?.spec?.minReplicas || 1)
  const [maxReplicas, setMaxReplicas] = useState(hpa?.spec?.maxReplicas || 10)
  const [isScaling, setIsScaling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleScale = async () => {
    // Validation
    if (minReplicas < 1) {
      setError('Min replicas must be at least 1')
      return
    }
    if (maxReplicas < minReplicas) {
      setError('Max replicas must be greater than or equal to min replicas')
      return
    }

    setIsScaling(true)
    setError(null)

    try {
      // Get the current HPA
      const response = await api.get(
        `/clusters/${hpa.clusterName}/namespaces/${hpa.metadata.namespace}/hpas/${hpa.metadata.name}`
      )
      
      const updatedHPA = {
        ...response.data,
        spec: {
          ...response.data.spec,
          minReplicas: minReplicas,
          maxReplicas: maxReplicas,
        }
      }

      // Update the HPA
      await api.put(
        `/clusters/${hpa.clusterName}/namespaces/${hpa.metadata.namespace}/hpas/${hpa.metadata.name}`,
        updatedHPA
      )

      notifyResourceAction.updated('HPA scale limits', hpa.metadata.name)
      onSuccess()
      onClose()
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to scale HPA'
      setError(errorMsg)
      notifyResourceAction.failed('scale', 'HPA', hpa.metadata.name, errorMsg)
      console.error('Failed to scale HPA:', error)
    } finally {
      setIsScaling(false)
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
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-shrink-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
                        <ArrowsUpDownIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                        Scale HPA
                      </Dialog.Title>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Adjust min and max replica limits for <span className="font-semibold text-gray-900 dark:text-white">{hpa.metadata?.name}</span>
                      </p>
                    </div>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Current Status */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Min</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {hpa?.spec?.minReplicas || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current</p>
                          <p className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                            {hpa?.status?.currentReplicas || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Max</p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-white">
                            {hpa?.spec?.maxReplicas || 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Min Replicas Input */}
                    <div>
                      <label htmlFor="minReplicas" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Minimum Replicas
                      </label>
                      <input
                        type="number"
                        id="minReplicas"
                        min="1"
                        value={minReplicas}
                        onChange={(e) => {
                          const value = parseInt(e.target.value)
                          setMinReplicas(isNaN(value) ? 1 : value)
                          setError(null)
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        The minimum number of pods HPA will maintain
                      </p>
                    </div>

                    {/* Max Replicas Input */}
                    <div>
                      <label htmlFor="maxReplicas" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Maximum Replicas
                      </label>
                      <input
                        type="number"
                        id="maxReplicas"
                        min={minReplicas}
                        value={maxReplicas}
                        onChange={(e) => {
                          const value = parseInt(e.target.value)
                          setMaxReplicas(isNaN(value) ? minReplicas : value)
                          setError(null)
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        The maximum number of pods HPA can scale to
                      </p>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <p className="text-xs text-blue-800 dark:text-blue-300">
                        <strong>Note:</strong> HPA will automatically scale the number of pods between these limits based on the configured metrics.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isScaling}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleScale}
                      disabled={isScaling}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isScaling ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Scaling...
                        </>
                      ) : (
                        <>
                          <ArrowsUpDownIcon className="h-4 w-4" />
                          Scale HPA
                        </>
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

