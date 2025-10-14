import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import { formatAge } from '@/utils/format'

interface EndpointDetailsModalProps {
  endpoint: any
  isOpen: boolean
  onClose: () => void
}

export default function EndpointDetailsModal({ endpoint, isOpen, onClose }: EndpointDetailsModalProps) {
  if (!endpoint) return null

  const getReadyAddresses = () => {
    const addresses: any[] = []
    endpoint.subsets?.forEach((subset: any) => {
      subset.addresses?.forEach((addr: any) => {
        addresses.push({
          ip: addr.ip,
          hostname: addr.hostname,
          nodeName: addr.nodeName,
          targetRef: addr.targetRef,
        })
      })
    })
    return addresses
  }

  const getNotReadyAddresses = () => {
    const addresses: any[] = []
    endpoint.subsets?.forEach((subset: any) => {
      subset.notReadyAddresses?.forEach((addr: any) => {
        addresses.push({
          ip: addr.ip,
          hostname: addr.hostname,
          nodeName: addr.nodeName,
          targetRef: addr.targetRef,
        })
      })
    })
    return addresses
  }

  const getPorts = () => {
    const ports: any[] = []
    endpoint.subsets?.forEach((subset: any) => {
      subset.ports?.forEach((port: any) => {
        if (!ports.some(p => p.name === port.name && p.port === port.port)) {
          ports.push({
            name: port.name || 'N/A',
            port: port.port,
            protocol: port.protocol,
            appProtocol: port.appProtocol,
          })
        }
      })
    })
    return ports
  }

  const readyAddresses = getReadyAddresses()
  const notReadyAddresses = getNotReadyAddresses()
  const ports = getPorts()

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
                    <GlobeAltIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Endpoint Details: {endpoint.metadata.name}
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
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Name:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {endpoint.metadata.name}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Namespace:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {endpoint.metadata.namespace}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Age:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {formatAge(endpoint.metadata.creationTimestamp)}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Ready:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {readyAddresses.length} / {readyAddresses.length + notReadyAddresses.length}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Ports */}
                  {ports.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                        Ports
                      </h3>
                      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Name
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Port
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Protocol
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                App Protocol
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {ports.map((port, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                  {port.name}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                  {port.port}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                  {port.protocol}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                  {port.appProtocol || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Ready Addresses */}
                  {readyAddresses.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                        Ready Addresses ({readyAddresses.length})
                      </h3>
                      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                IP
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Hostname
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Node
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Target
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {readyAddresses.map((addr, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">
                                  {addr.ip}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                  {addr.hostname || '-'}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                  {addr.nodeName || '-'}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                  {addr.targetRef ? `${addr.targetRef.kind}/${addr.targetRef.name}` : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Not Ready Addresses */}
                  {notReadyAddresses.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                        Not Ready Addresses ({notReadyAddresses.length})
                      </h3>
                      <div className="overflow-x-auto rounded-lg border border-yellow-200 dark:border-yellow-700">
                        <table className="min-w-full divide-y divide-yellow-200 dark:divide-yellow-700">
                          <thead className="bg-yellow-50 dark:bg-yellow-900/20">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                IP
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Hostname
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Node
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                Target
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-900 divide-y divide-yellow-200 dark:divide-yellow-700">
                            {notReadyAddresses.map((addr, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">
                                  {addr.ip}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                  {addr.hostname || '-'}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                  {addr.nodeName || '-'}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                  {addr.targetRef ? `${addr.targetRef.kind}/${addr.targetRef.name}` : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Labels */}
                  {endpoint.metadata.labels && Object.keys(endpoint.metadata.labels).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                        Labels
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(endpoint.metadata.labels).map(([key, value]) => (
                            <span
                              key={key}
                              className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            >
                              <span className="font-semibold">{key}</span>
                              <span className="mx-1">=</span>
                              <span>{value as string}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Annotations */}
                  {endpoint.metadata.annotations && Object.keys(endpoint.metadata.annotations).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                        Annotations
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                        {Object.entries(endpoint.metadata.annotations).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="font-mono text-gray-700 dark:text-gray-300">{key}:</span>
                            <span className="ml-2 text-gray-500 dark:text-gray-400 break-all">
                              {value as string}
                            </span>
                          </div>
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

