import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'
import { XMarkIcon, CommandLineIcon } from '@heroicons/react/24/outline'
import { createRuntimeClass } from '@/services/api'

interface CreateRuntimeClassModalProps {
  clusterName: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreateRuntimeClassModal({
  clusterName,
  isOpen,
  onClose,
  onSuccess,
}: CreateRuntimeClassModalProps) {
  const [name, setName] = useState('')
  const [handler, setHandler] = useState('runc')
  const [enableOverhead, setEnableOverhead] = useState(false)
  const [cpuOverhead, setCpuOverhead] = useState('')
  const [memoryOverhead, setMemoryOverhead] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    if (!handler.trim()) {
      setError('Handler is required')
      return
    }

    try {
      setIsCreating(true)
      setError(null)

      const runtimeClass: any = {
        apiVersion: 'node.k8s.io/v1',
        kind: 'RuntimeClass',
        metadata: {
          name: name.trim(),
        },
        handler: handler.trim(),
      }

      // Add overhead if enabled
      if (enableOverhead && (cpuOverhead || memoryOverhead)) {
        runtimeClass.overhead = {
          podFixed: {}
        }
        if (cpuOverhead) {
          runtimeClass.overhead.podFixed.cpu = cpuOverhead
        }
        if (memoryOverhead) {
          runtimeClass.overhead.podFixed.memory = memoryOverhead
        }
      }

      await createRuntimeClass(clusterName, runtimeClass)

      // Reset form
      setName('')
      setHandler('runc')
      setEnableOverhead(false)
      setCpuOverhead('')
      setMemoryOverhead('')

      onSuccess()
    } catch (err: any) {
      console.error('Failed to create runtime class:', err)
      setError(err.response?.data?.error || err.message || 'Failed to create runtime class')
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    if (!isCreating) {
      setName('')
      setHandler('runc')
      setEnableOverhead(false)
      setCpuOverhead('')
      setMemoryOverhead('')
      setError(null)
      onClose()
    }
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
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                      <CommandLineIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
                      Create Runtime Class
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={isCreating}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4 space-y-4">
                  {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 text-sm">
                      {error}
                    </div>
                  )}

                  {/* Name */}
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., kata-runtime"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      disabled={isCreating}
                    />
                  </div>

                  {/* Handler */}
                  <div>
                    <label
                      htmlFor="handler"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Handler <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="handler"
                      value={handler}
                      onChange={(e) => setHandler(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      disabled={isCreating}
                    >
                      <option value="runc">runc (default)</option>
                      <option value="kata">kata</option>
                      <option value="gvisor">gvisor</option>
                      <option value="firecracker">firecracker</option>
                      <option value="custom">custom</option>
                    </select>
                    {handler === 'custom' && (
                      <input
                        type="text"
                        value={handler === 'custom' ? '' : handler}
                        onChange={(e) => setHandler(e.target.value)}
                        placeholder="Enter custom handler name"
                        className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        disabled={isCreating}
                      />
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      The name of the container runtime handler
                    </p>
                  </div>

                  {/* Overhead Configuration */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        id="enableOverhead"
                        type="checkbox"
                        checked={enableOverhead}
                        onChange={(e) => setEnableOverhead(e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        disabled={isCreating}
                      />
                      <label
                        htmlFor="enableOverhead"
                        className="text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Configure Pod Overhead (Optional)
                      </label>
                    </div>

                    {enableOverhead && (
                      <div className="ml-6 space-y-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                        <div>
                          <label
                            htmlFor="cpuOverhead"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                          >
                            CPU Overhead
                          </label>
                          <input
                            id="cpuOverhead"
                            type="text"
                            value={cpuOverhead}
                            onChange={(e) => setCpuOverhead(e.target.value)}
                            placeholder="e.g., 250m"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            disabled={isCreating}
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            CPU overhead per pod (e.g., 250m for 0.25 cores)
                          </p>
                        </div>

                        <div>
                          <label
                            htmlFor="memoryOverhead"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                          >
                            Memory Overhead
                          </label>
                          <input
                            id="memoryOverhead"
                            type="text"
                            value={memoryOverhead}
                            onChange={(e) => setMemoryOverhead(e.target.value)}
                            placeholder="e.g., 120Mi"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            disabled={isCreating}
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Memory overhead per pod (e.g., 120Mi)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Note:</strong> Runtime classes define which container runtime to use
                      for pods. Pods can reference a runtime class in their spec to use a specific
                      container runtime handler.
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
                  <button
                    onClick={handleClose}
                    disabled={isCreating}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={isCreating || !name.trim() || !handler.trim()}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCreating && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    )}
                    {isCreating ? 'Creating...' : 'Create Runtime Class'}
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
