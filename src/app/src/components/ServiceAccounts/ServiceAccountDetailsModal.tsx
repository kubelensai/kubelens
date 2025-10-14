import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, IdentificationIcon, ArrowTopRightOnSquareIcon, EyeIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'

interface ServiceAccountDetailsModalProps {
  serviceAccount: any
  isOpen: boolean
  onClose: () => void
}

export default function ServiceAccountDetailsModal({
  serviceAccount,
  isOpen,
  onClose,
}: ServiceAccountDetailsModalProps) {
  const navigate = useNavigate()
  
  if (!serviceAccount) return null

  const secrets = serviceAccount.secrets || []
  const imagePullSecrets = serviceAccount.imagePullSecrets || []
  const autoMount = 
    serviceAccount.automountServiceAccountToken === false 
      ? 'Disabled' 
      : serviceAccount.automountServiceAccountToken === true 
      ? 'Enabled' 
      : 'Default'

  const handleViewSecret = (secretName: string) => {
    const cluster = serviceAccount.ClusterName
    const namespace = serviceAccount.metadata?.namespace
    // Navigate to secrets page with query param to auto-open the secret
    navigate(`/clusters/${cluster}/namespaces/${namespace}/secrets?open=${secretName}`)
    onClose()
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
          <div className="fixed inset-0 bg-black/25 dark:bg-black/50 backdrop-blur-sm" />
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
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <IdentificationIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Service Account Details
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6">

                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                        {serviceAccount.metadata?.name}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Namespace</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                        {serviceAccount.metadata?.namespace}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Cluster</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                        {serviceAccount.ClusterName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Auto Mount Token</dt>
                      <dd className="mt-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          serviceAccount.automountServiceAccountToken === false
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : serviceAccount.automountServiceAccountToken === true
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {autoMount}
                        </span>
                      </dd>
                    </div>
                  </div>

                  {/* Secrets */}
                  {secrets.length > 0 && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Secrets ({secrets.length})
                      </dt>
                      <dd className="mt-1 space-y-2">
                        {secrets.map((secret: any, index: number) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 px-3 py-2 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <span className="text-sm text-gray-900 dark:text-white font-mono">
                              {secret.name}
                            </span>
                            <button
                              onClick={() => handleViewSecret(secret.name)}
                              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <EyeIcon className="h-4 w-4" />
                              View Details
                              <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </dd>
                    </div>
                  )}

                  {/* Image Pull Secrets */}
                  {imagePullSecrets.length > 0 && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Image Pull Secrets ({imagePullSecrets.length})
                      </dt>
                      <dd className="mt-1 space-y-1">
                        {imagePullSecrets.map((secret: any, index: number) => (
                          <div
                            key={index}
                            className="text-sm text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded"
                          >
                            {secret.name}
                          </div>
                        ))}
                      </dd>
                    </div>
                  )}

                  {/* Labels */}
                  {serviceAccount.metadata?.labels && Object.keys(serviceAccount.metadata.labels).length > 0 && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Labels</dt>
                      <dd className="mt-1">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(serviceAccount.metadata.labels).map(([key, value]) => (
                            <span
                              key={key}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            >
                              {key}: {String(value)}
                            </span>
                          ))}
                        </div>
                      </dd>
                    </div>
                  )}

                  {/* Annotations */}
                  {serviceAccount.metadata?.annotations && Object.keys(serviceAccount.metadata.annotations).length > 0 && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Annotations</dt>
                      <dd className="mt-1 space-y-1">
                        {Object.entries(serviceAccount.metadata.annotations).map(([key, value]) => (
                          <div key={key} className="text-sm bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded">
                            <span className="font-medium text-gray-700 dark:text-gray-300">{key}:</span>{' '}
                            <span className="text-gray-600 dark:text-gray-400 font-mono break-all">{String(value)}</span>
                          </div>
                        ))}
                      </dd>
                    </div>
                  )}
                </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Close
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

