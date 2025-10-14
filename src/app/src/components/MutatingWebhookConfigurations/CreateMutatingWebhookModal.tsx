import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState } from 'react'
import { XMarkIcon, BoltIcon } from '@heroicons/react/24/outline'
import { createMutatingWebhookConfiguration } from '@/services/api'

interface CreateMutatingWebhookModalProps {
  clusterName: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreateMutatingWebhookModal({
  clusterName,
  isOpen,
  onClose,
  onSuccess,
}: CreateMutatingWebhookModalProps) {
  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    try {
      setIsCreating(true)
      setError(null)

      // Create a basic webhook configuration template
      const webhook = {
        apiVersion: 'admissionregistration.k8s.io/v1',
        kind: 'MutatingWebhookConfiguration',
        metadata: {
          name: name.trim(),
        },
        webhooks: [
          {
            name: `${name.trim()}.example.com`,
            clientConfig: {
              service: {
                name: 'webhook-service',
                namespace: 'default',
                path: '/mutate',
              },
            },
            rules: [
              {
                operations: ['CREATE', 'UPDATE'],
                apiGroups: [''],
                apiVersions: ['v1'],
                resources: ['pods'],
              },
            ],
            admissionReviewVersions: ['v1', 'v1beta1'],
            sideEffects: 'None',
            failurePolicy: 'Fail',
          },
        ],
      }

      await createMutatingWebhookConfiguration(clusterName, webhook)

      setName('')
      onSuccess()
    } catch (err: any) {
      console.error('Failed to create webhook:', err)
      setError(err.response?.data?.error || err.message || 'Failed to create webhook')
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    if (!isCreating) {
      setName('')
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
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                      <BoltIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
                      Create Mutating Webhook Configuration
                    </Dialog.Title>
                  </div>
                  <button onClick={handleClose} disabled={isCreating} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors">
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="px-6 py-4 space-y-4">
                  {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 text-sm">
                      {error}
                    </div>
                  )}

                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., my-mutating-webhook"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      disabled={isCreating}
                    />
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Note:</strong> This will create a basic webhook configuration template.
                      You'll need to edit the YAML to configure your webhook service, rules,
                      and other settings according to your needs.
                    </p>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Default Template Includes:
                    </p>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                      <li>Single webhook targeting pods</li>
                      <li>Operations: CREATE, UPDATE</li>
                      <li>Failure Policy: Fail</li>
                      <li>Side Effects: None</li>
                      <li>Service endpoint: default/webhook-service/mutate</li>
                    </ul>
                  </div>
                </div>

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
                    disabled={isCreating || !name.trim()}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCreating && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                    {isCreating ? 'Creating...' : 'Create Webhook'}
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
