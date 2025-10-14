import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'
import { XMarkIcon, ClockIcon } from '@heroicons/react/24/outline'
import { createLease } from '@/services/api'

interface CreateLeaseModalProps {
  clusterName: string
  namespace: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreateLeaseModal({
  clusterName,
  namespace,
  isOpen,
  onClose,
  onSuccess,
}: CreateLeaseModalProps) {
  const [name, setName] = useState('')
  const [holderIdentity, setHolderIdentity] = useState('')
  const [leaseDurationSeconds, setLeaseDurationSeconds] = useState('15')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    if (!holderIdentity.trim()) {
      setError('Holder identity is required')
      return
    }

    const duration = parseInt(leaseDurationSeconds)
    if (isNaN(duration) || duration <= 0) {
      setError('Lease duration must be a positive number')
      return
    }

    try {
      setIsCreating(true)
      setError(null)

      const lease = {
        apiVersion: 'coordination.k8s.io/v1',
        kind: 'Lease',
        metadata: {
          name: name.trim(),
          namespace: namespace,
        },
        spec: {
          holderIdentity: holderIdentity.trim(),
          leaseDurationSeconds: duration,
          acquireTime: new Date().toISOString(),
          renewTime: new Date().toISOString(),
          leaseTransitions: 0,
        },
      }

      await createLease(clusterName, namespace, lease)

      // Reset form
      setName('')
      setHolderIdentity('')
      setLeaseDurationSeconds('15')

      onSuccess()
    } catch (err: any) {
      console.error('Failed to create lease:', err)
      setError(err.response?.data?.error || err.message || 'Failed to create lease')
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    if (!isCreating) {
      setName('')
      setHolderIdentity('')
      setLeaseDurationSeconds('15')
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
                      <ClockIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
                      Create Lease
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
                      placeholder="e.g., my-leader-election"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      disabled={isCreating}
                    />
                  </div>

                  {/* Namespace (read-only) */}
                  <div>
                    <label
                      htmlFor="namespace"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Namespace
                    </label>
                    <input
                      id="namespace"
                      type="text"
                      value={namespace}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-400 cursor-not-allowed"
                    />
                  </div>

                  {/* Holder Identity */}
                  <div>
                    <label
                      htmlFor="holderIdentity"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Holder Identity <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="holderIdentity"
                      type="text"
                      value={holderIdentity}
                      onChange={(e) => setHolderIdentity(e.target.value)}
                      placeholder="e.g., controller-pod-name"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      disabled={isCreating}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      The identity of the entity holding this lease (typically a pod name)
                    </p>
                  </div>

                  {/* Lease Duration */}
                  <div>
                    <label
                      htmlFor="leaseDuration"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Lease Duration (seconds) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="leaseDuration"
                      type="number"
                      value={leaseDurationSeconds}
                      onChange={(e) => setLeaseDurationSeconds(e.target.value)}
                      min="1"
                      placeholder="15"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      disabled={isCreating}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      How long the lease is valid for (default: 15 seconds)
                    </p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Note:</strong> Leases are used for distributed coordination,
                      typically for leader election. The holder identity should be a unique
                      identifier for the entity holding the lease (e.g., pod name). The lease
                      must be renewed before the duration expires to maintain the lock.
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
                    disabled={isCreating || !name.trim() || !holderIdentity.trim()}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCreating && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    )}
                    {isCreating ? 'Creating...' : 'Create Lease'}
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

