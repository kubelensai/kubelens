import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { XMarkIcon, BoltIcon } from '@heroicons/react/24/outline'
import { formatAge } from '@/utils/format'

interface MutatingWebhookDetailsModalProps {
  webhook: any
  isOpen: boolean
  onClose: () => void
}

export default function MutatingWebhookDetailsModal({
  webhook,
  isOpen,
  onClose,
}: MutatingWebhookDetailsModalProps) {
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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                      <BoltIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
                        {webhook.metadata?.name}
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Mutating Webhook Configuration
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4 space-y-6 max-h-[70vh] overflow-y-auto">
                  {/* Basic Information */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Name
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white font-medium">
                          {webhook.metadata?.name}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Cluster
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {webhook.clusterName}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Webhooks Count
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {webhook.webhooks?.length || 0}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Created
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {formatAge(webhook.metadata?.creationTimestamp)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Webhooks */}
                  {webhook.webhooks && webhook.webhooks.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                        Webhooks ({webhook.webhooks.length})
                      </h3>
                      <div className="space-y-4">
                        {webhook.webhooks.map((wh: any, idx: number) => (
                          <div
                            key={idx}
                            className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                {wh.name}
                              </h4>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                wh.sideEffects === 'None' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                              }`}>
                                {wh.sideEffects || 'Unknown'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Admission Review Versions:</span>
                                <p className="text-gray-900 dark:text-white mt-1">
                                  {wh.admissionReviewVersions?.join(', ') || 'N/A'}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Failure Policy:</span>
                                <p className="text-gray-900 dark:text-white mt-1">
                                  {wh.failurePolicy || 'Fail'}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Match Policy:</span>
                                <p className="text-gray-900 dark:text-white mt-1">
                                  {wh.matchPolicy || 'Equivalent'}
                                </p>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Timeout:</span>
                                <p className="text-gray-900 dark:text-white mt-1">
                                  {wh.timeoutSeconds ? `${wh.timeoutSeconds}s` : '10s (default)'}
                                </p>
                              </div>
                            </div>

                            {/* Client Config */}
                            {wh.clientConfig && (
                              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Client Config:</span>
                                <div className="mt-2 text-xs space-y-1">
                                  {wh.clientConfig.service && (
                                    <p className="text-gray-900 dark:text-white">
                                      <span className="text-gray-500 dark:text-gray-400">Service:</span>{' '}
                                      {wh.clientConfig.service.namespace}/{wh.clientConfig.service.name}
                                      {wh.clientConfig.service.path && ` (${wh.clientConfig.service.path})`}
                                      {wh.clientConfig.service.port && ` :${wh.clientConfig.service.port}`}
                                    </p>
                                  )}
                                  {wh.clientConfig.url && (
                                    <p className="text-gray-900 dark:text-white">
                                      <span className="text-gray-500 dark:text-gray-400">URL:</span>{' '}
                                      {wh.clientConfig.url}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Rules */}
                            {wh.rules && wh.rules.length > 0 && (
                              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Rules ({wh.rules.length}):</span>
                                <div className="mt-2 space-y-2">
                                  {wh.rules.slice(0, 3).map((rule: any, rIdx: number) => (
                                    <div key={rIdx} className="text-xs bg-white dark:bg-gray-800 rounded p-2">
                                      <p className="text-gray-900 dark:text-white">
                                        <span className="text-gray-500 dark:text-gray-400">Operations:</span>{' '}
                                        {rule.operations?.join(', ') || 'N/A'}
                                      </p>
                                      <p className="text-gray-900 dark:text-white">
                                        <span className="text-gray-500 dark:text-gray-400">Resources:</span>{' '}
                                        {rule.resources?.join(', ') || 'N/A'}
                                      </p>
                                      {rule.apiGroups && (
                                        <p className="text-gray-900 dark:text-white">
                                          <span className="text-gray-500 dark:text-gray-400">API Groups:</span>{' '}
                                          {rule.apiGroups.join(', ')}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                  {wh.rules.length > 3 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                      ... and {wh.rules.length - 3} more
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Labels */}
                  {webhook.metadata?.labels && Object.keys(webhook.metadata.labels).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                        Labels
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 font-mono text-xs space-y-1">
                        {Object.entries(webhook.metadata.labels).map(([key, value]) => (
                          <div key={key} className="text-gray-900 dark:text-white">
                            <span className="text-primary-600 dark:text-primary-400">{key}</span>:{' '}
                            {String(value)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
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
