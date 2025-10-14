import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, ChevronUpIcon, PlusIcon } from '@heroicons/react/24/outline'
import api from '@/services/api'
import { notifyResourceAction } from '@/utils/notifications'

interface CreatePriorityClassModalProps {
  clusterName: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreatePriorityClassModal({ clusterName, isOpen, onClose, onSuccess }: CreatePriorityClassModalProps) {
  const [pcName, setPcName] = useState('')
  const [value, setValue] = useState(1000)
  const [globalDefault, setGlobalDefault] = useState(false)
  const [preemptionPolicy, setPreemptionPolicy] = useState<'PreemptLowerPriority' | 'Never'>('PreemptLowerPriority')
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    // Validation
    if (!pcName.trim()) {
      setError('Priority class name is required')
      return
    }

    if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(pcName)) {
      setError('Priority class name must be lowercase alphanumeric with hyphens')
      return
    }

    if (value < -2147483648 || value > 2147483647) {
      setError('Priority value must be between -2147483648 and 2147483647')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      // Prepare priority class manifest
      const pc: any = {
        apiVersion: 'scheduling.k8s.io/v1',
        kind: 'PriorityClass',
        metadata: {
          name: pcName,
        },
        value: value,
        globalDefault: globalDefault,
        preemptionPolicy: preemptionPolicy,
      }

      if (description.trim()) {
        pc.description = description.trim()
      }

      await api.post(
        `/clusters/${clusterName}/priorityclasses`,
        pc
      )

      notifyResourceAction.created('Priority Class', pcName)
      
      // Reset form
      setPcName('')
      setValue(1000)
      setGlobalDefault(false)
      setPreemptionPolicy('PreemptLowerPriority')
      setDescription('')
      
      onSuccess()
      onClose()
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create priority class'
      setError(errorMsg)
      notifyResourceAction.failed('create', 'Priority Class', pcName, errorMsg)
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    // Reset form
    setPcName('')
    setValue(1000)
    setGlobalDefault(false)
    setPreemptionPolicy('PreemptLowerPriority')
    setDescription('')
    setError('')
    onClose()
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ChevronUpIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Create Priority Class
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                  {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  {/* Basic Info */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Priority Class Name *
                    </label>
                    <input
                      type="text"
                      value={pcName}
                      onChange={(e) => setPcName(e.target.value)}
                      placeholder="high-priority"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Lowercase alphanumeric with hyphens (cluster-scoped)
                    </p>
                  </div>

                  {/* Priority Value */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Priority Value *
                    </label>
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => setValue(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Higher values indicate higher priority. Range: -2147483648 to 2147483647
                    </p>
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      <p>• System critical: 2000000000</p>
                      <p>• High: 1000000</p>
                      <p>• Medium: 1000</p>
                      <p>• Low: 0</p>
                    </div>
                  </div>

                  {/* Global Default */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="globalDefault"
                        checked={globalDefault}
                        onChange={(e) => setGlobalDefault(e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <label htmlFor="globalDefault" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                          Set as Global Default
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          If enabled, this priority class will be assigned to pods that don't specify a priority class. 
                          Only one priority class can be set as the global default in a cluster.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Preemption Policy */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Preemption Policy *
                    </label>
                    <select
                      value={preemptionPolicy}
                      onChange={(e) => setPreemptionPolicy(e.target.value as 'PreemptLowerPriority' | 'Never')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="PreemptLowerPriority">PreemptLowerPriority</option>
                      <option value="Never">Never</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {preemptionPolicy === 'Never'
                        ? 'Pods with this priority class will not preempt other pods'
                        : 'Pods with this priority class can preempt (evict) pods with lower priority'}
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe when to use this priority class..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Human-readable description of when to use this priority class
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isCreating}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isCreating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <PlusIcon className="h-4 w-4" />
                        Create Priority Class
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

