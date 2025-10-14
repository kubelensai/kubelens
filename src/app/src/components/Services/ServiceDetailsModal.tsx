import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CloudIcon } from '@heroicons/react/24/outline'

interface ServiceDetailsModalProps {
  service: any
  isOpen: boolean
  onClose: () => void
}

export default function ServiceDetailsModal({ service, isOpen, onClose }: ServiceDetailsModalProps) {
  if (!service) return null

  const formatPorts = () => {
    if (!service.spec?.ports || service.spec.ports.length === 0) return []
    return service.spec.ports.map((port: any) => ({
      name: port.name || 'N/A',
      port: port.port,
      targetPort: port.targetPort,
      protocol: port.protocol,
      nodePort: port.nodePort,
    }))
  }

  const getSelector = () => {
    if (!service.spec?.selector) return null
    return Object.entries(service.spec.selector).map(([key, value]) => ({ key, value }))
  }

  const getExternalIPs = () => {
    const ips = []
    
    // LoadBalancer ingress
    if (service.status?.loadBalancer?.ingress) {
      service.status.loadBalancer.ingress.forEach((ing: any) => {
        if (ing.ip) ips.push(ing.ip)
        if (ing.hostname) ips.push(ing.hostname)
      })
    }
    
    // External IPs
    if (service.spec?.externalIPs) {
      ips.push(...service.spec.externalIPs)
    }
    
    return ips
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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <CloudIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Service Details: {service.metadata.name}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="max-h-[70vh] overflow-auto px-6 py-4 space-y-6">
                  {/* Basic Info */}
                  <div className="card bg-gray-50 dark:bg-gray-800/50 p-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Basic Information</h3>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">{service.metadata.name}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Namespace</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">{service.metadata.namespace}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">{service.spec.type}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Cluster IP</dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-white">{service.spec.clusterIP || 'None'}</dd>
                      </div>
                      {service.spec.sessionAffinity && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Session Affinity</dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-white">{service.spec.sessionAffinity}</dd>
                        </div>
                      )}
                      {service.spec.externalName && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">External Name</dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-white">{service.spec.externalName}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {/* Ports */}
                  {formatPorts().length > 0 && (
                    <div className="card bg-gray-50 dark:bg-gray-800/50 p-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Ports</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-gray-700/50">
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Name</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Port</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Target Port</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Protocol</th>
                              {service.spec.type === 'NodePort' && (
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Node Port</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {formatPorts().map((port: any, idx: number) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{port.name}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{port.port}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{port.targetPort}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{port.protocol}</td>
                                {service.spec.type === 'NodePort' && (
                                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{port.nodePort || 'N/A'}</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* External IPs */}
                  {getExternalIPs().length > 0 && (
                    <div className="card bg-gray-50 dark:bg-gray-800/50 p-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">External IPs</h3>
                      <ul className="list-disc list-inside space-y-1">
                        {getExternalIPs().map((ip: string, idx: number) => (
                          <li key={idx} className="text-sm text-gray-900 dark:text-white">{ip}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Selector */}
                  {getSelector() && (
                    <div className="card bg-gray-50 dark:bg-gray-800/50 p-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Selector</h3>
                      <dl className="space-y-2">
                        {getSelector()!.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{item.key}:</dt>
                            <dd className="text-sm text-gray-900 dark:text-white">{item.value as string}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {/* Labels */}
                  {service.metadata.labels && Object.keys(service.metadata.labels).length > 0 && (
                    <div className="card bg-gray-50 dark:bg-gray-800/50 p-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Labels</h3>
                      <dl className="space-y-2">
                        {Object.entries(service.metadata.labels).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2">
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{key}:</dt>
                            <dd className="text-sm text-gray-900 dark:text-white">{value as string}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex justify-end">
                  <button onClick={onClose} className="btn-primary">
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

