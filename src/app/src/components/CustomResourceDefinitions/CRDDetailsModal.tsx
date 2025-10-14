import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CubeIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

interface CRDDetailsModalProps {
  crd: any
  isOpen: boolean
  onClose: () => void
}

export default function CRDDetailsModal({
  crd,
  isOpen,
  onClose,
}: CRDDetailsModalProps) {
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set([0]))

  if (!crd) return null

  const spec = crd.spec || {}
  const versions = spec.versions || []
  const names = spec.names || {}
  const status = crd.status || {}

  const toggleVersion = (index: number) => {
    const newExpanded = new Set(expandedVersions)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedVersions(newExpanded)
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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-gray-800/50 dark:to-gray-800/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                      <CubeIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
                        {names.plural || crd.metadata?.name}
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Custom Resource Definition
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 hover:bg-white/50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                        <div className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">
                          Group
                        </div>
                        <div className="text-lg font-bold text-blue-900 dark:text-blue-300 truncate">
                          {spec.group || '-'}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                        <div className="text-sm font-medium text-purple-700 dark:text-purple-400 mb-1">
                          Scope
                        </div>
                        <div className="text-lg font-bold text-purple-900 dark:text-purple-300">
                          {spec.scope || '-'}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                        <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                          Versions
                        </div>
                        <div className="text-2xl font-bold text-green-900 dark:text-green-300">
                          {versions.length}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
                        <div className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-1">
                          Cluster
                        </div>
                        <div className="text-lg font-bold text-orange-900 dark:text-orange-300 truncate">
                          {crd.ClusterName}
                        </div>
                      </div>
                    </div>

                    {/* Names Section */}
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
                      <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-3">
                        Resource Names
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs font-medium text-indigo-700 dark:text-indigo-400 mb-1">Plural</div>
                          <div className="text-sm font-mono text-indigo-900 dark:text-indigo-300">{names.plural || '-'}</div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-indigo-700 dark:text-indigo-400 mb-1">Singular</div>
                          <div className="text-sm font-mono text-indigo-900 dark:text-indigo-300">{names.singular || '-'}</div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-indigo-700 dark:text-indigo-400 mb-1">Kind</div>
                          <div className="text-sm font-mono text-indigo-900 dark:text-indigo-300">{names.kind || '-'}</div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-indigo-700 dark:text-indigo-400 mb-1">List Kind</div>
                          <div className="text-sm font-mono text-indigo-900 dark:text-indigo-300">{names.listKind || '-'}</div>
                        </div>
                        {names.shortNames && names.shortNames.length > 0 && (
                          <div className="col-span-2">
                            <div className="text-xs font-medium text-indigo-700 dark:text-indigo-400 mb-2">Short Names</div>
                            <div className="flex flex-wrap gap-2">
                              {names.shortNames.map((name: string, i: number) => (
                                <span key={i} className="px-2 py-1 text-xs font-mono bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded">
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Versions Section */}
                    {versions.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                          Versions
                        </h3>
                        <div className="space-y-2">
                          {versions.map((version: any, index: number) => {
                            const isExpanded = expandedVersions.has(index)
                            return (
                              <div
                                key={index}
                                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800/30"
                              >
                                <button
                                  onClick={() => toggleVersion(index)}
                                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    {isExpanded ? (
                                      <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                                    ) : (
                                      <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                                    )}
                                    <span className="font-medium text-gray-900 dark:text-white font-mono">
                                      {version.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {version.served && (
                                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                        Served
                                      </span>
                                    )}
                                    {version.storage && (
                                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                        Storage
                                      </span>
                                    )}
                                    {version.deprecated && (
                                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                        Deprecated
                                      </span>
                                    )}
                                  </div>
                                </button>

                                {isExpanded && (
                                  <div className="px-4 pb-4 space-y-3 bg-gray-50 dark:bg-gray-900/30">
                                    {version.deprecationWarning && (
                                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                                        <div className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1">
                                          Deprecation Warning
                                        </div>
                                        <div className="text-sm text-yellow-800 dark:text-yellow-300">
                                          {version.deprecationWarning}
                                        </div>
                                      </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Served</div>
                                        <div className="text-sm text-gray-900 dark:text-gray-300">{version.served ? 'Yes' : 'No'}</div>
                                      </div>
                                      <div>
                                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Storage</div>
                                        <div className="text-sm text-gray-900 dark:text-gray-300">{version.storage ? 'Yes' : 'No'}</div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Status Section */}
                    {status.acceptedNames && (
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                          Status
                        </h3>
                        <div className="space-y-2">
                          {status.conditions && status.conditions.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {status.conditions.map((condition: any, i: number) => (
                                <span
                                  key={i}
                                  className={`px-2 py-1 text-xs font-medium rounded ${
                                    condition.status === 'True'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  {condition.type}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
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

