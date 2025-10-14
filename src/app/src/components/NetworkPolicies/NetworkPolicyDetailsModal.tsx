import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { formatAge } from '@/utils/format'

interface NetworkPolicyDetailsModalProps {
  networkPolicy: any
  isOpen: boolean
  onClose: () => void
}

export default function NetworkPolicyDetailsModal({
  networkPolicy,
  isOpen,
  onClose,
}: NetworkPolicyDetailsModalProps) {
  if (!networkPolicy) return null

  const renderPodSelector = (podSelector: any) => {
    if (!podSelector || (Object.keys(podSelector.matchLabels || {}).length === 0 && !podSelector.matchExpressions?.length)) {
      return <span className="text-gray-600 dark:text-gray-400">All pods in namespace</span>
    }

    return (
      <div className="space-y-2">
        {Object.entries(podSelector.matchLabels || {}).map(([key, value]) => (
          <div key={key} className="inline-flex items-center px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm mr-2">
            <code>{key}={String(value)}</code>
          </div>
        ))}
        {podSelector.matchExpressions?.length > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            + {podSelector.matchExpressions.length} expression(s)
          </div>
        )}
      </div>
    )
  }

  const renderIngressRules = (ingress: any[]) => {
    if (!ingress || ingress.length === 0) {
      return <span className="text-gray-500 dark:text-gray-400">No ingress rules defined (default deny)</span>
    }

    return (
      <div className="space-y-3">
        {ingress.map((rule, idx) => (
          <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rule {idx + 1}
            </div>
            {rule.from && rule.from.length > 0 && (
              <div className="text-sm">
                <span className="text-gray-500 dark:text-gray-400">From: </span>
                <span className="text-gray-900 dark:text-white">{rule.from.length} source(s)</span>
              </div>
            )}
            {rule.ports && rule.ports.length > 0 && (
              <div className="text-sm mt-1">
                <span className="text-gray-500 dark:text-gray-400">Ports: </span>
                {rule.ports.map((port: any, portIdx: number) => (
                  <span key={portIdx} className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs mr-1">
                    {port.port}/{port.protocol || 'TCP'}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  const renderEgressRules = (egress: any[]) => {
    if (!egress || egress.length === 0) {
      return <span className="text-gray-500 dark:text-gray-400">No egress rules defined (default deny)</span>
    }

    return (
      <div className="space-y-3">
        {egress.map((rule, idx) => (
          <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rule {idx + 1}
            </div>
            {rule.to && rule.to.length > 0 && (
              <div className="text-sm">
                <span className="text-gray-500 dark:text-gray-400">To: </span>
                <span className="text-gray-900 dark:text-white">{rule.to.length} destination(s)</span>
              </div>
            )}
            {rule.ports && rule.ports.length > 0 && (
              <div className="text-sm mt-1">
                <span className="text-gray-500 dark:text-gray-400">Ports: </span>
                {rule.ports.map((port: any, portIdx: number) => (
                  <span key={portIdx} className="inline-flex items-center px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs mr-1">
                    {port.port}/{port.protocol || 'TCP'}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    )
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
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ShieldCheckIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Network Policy Details
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                  {/* Basic Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Name
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                          {networkPolicy.metadata.name}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Namespace
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {networkPolicy.metadata.namespace}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Age
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {formatAge(networkPolicy.metadata.creationTimestamp)}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Policy Types
                        </label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {networkPolicy.spec.policyTypes?.join(', ') || '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pod Selector */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Pod Selector
                    </h3>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      {renderPodSelector(networkPolicy.spec.podSelector)}
                    </div>
                  </div>

                  {/* Ingress Rules */}
                  {networkPolicy.spec.policyTypes?.includes('Ingress') && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        Ingress Rules
                      </h3>
                      {renderIngressRules(networkPolicy.spec.ingress)}
                    </div>
                  )}

                  {/* Egress Rules */}
                  {networkPolicy.spec.policyTypes?.includes('Egress') && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        Egress Rules
                      </h3>
                      {renderEgressRules(networkPolicy.spec.egress)}
                    </div>
                  )}

                  {/* Labels */}
                  {networkPolicy.metadata.labels && Object.keys(networkPolicy.metadata.labels).length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        Labels
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(networkPolicy.metadata.labels).map(([key, value]) => (
                          <span
                            key={key}
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                          >
                            <code>{key}: {String(value)}</code>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
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

