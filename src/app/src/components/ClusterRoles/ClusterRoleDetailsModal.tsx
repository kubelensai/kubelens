import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, ShieldCheckIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface ClusterRoleDetailsModalProps {
  clusterRole: any
  isOpen: boolean
  onClose: () => void
}

export default function ClusterRoleDetailsModal({
  clusterRole,
  isOpen,
  onClose,
}: ClusterRoleDetailsModalProps) {
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set([0]))

  if (!clusterRole) return null

  const rules = clusterRole.rules || []
  const isAggregated = !!clusterRole.aggregationRule

  const toggleRule = (index: number) => {
    const newExpanded = new Set(expandedRules)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedRules(newExpanded)
  }

  const toggleAllRules = () => {
    if (expandedRules.size === rules.length) {
      setExpandedRules(new Set())
    } else {
      setExpandedRules(new Set(rules.map((_: any, i: number) => i)))
    }
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
                      <ShieldCheckIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
                        {clusterRole.metadata?.name}
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Cluster Role Details
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
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                        <div className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">
                          Rules Count
                        </div>
                        <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                          {rules.length}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                        <div className="text-sm font-medium text-purple-700 dark:text-purple-400 mb-1">
                          Aggregated
                        </div>
                        <div className="text-2xl font-bold text-purple-900 dark:text-purple-300">
                          {isAggregated ? 'Yes' : 'No'}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">
                          Cluster
                        </div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-300 truncate">
                          {clusterRole.ClusterName}
                        </div>
                      </div>
                    </div>

                    {/* Rules Section */}
                    {rules.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Permission Rules
                          </h3>
                          <button
                            onClick={toggleAllRules}
                            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                          >
                            {expandedRules.size === rules.length ? 'Collapse All' : 'Expand All'}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {rules.map((rule: any, index: number) => {
                            const isExpanded = expandedRules.has(index)
                            return (
                              <div
                                key={index}
                                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800/30"
                              >
                                {/* Rule Header */}
                                <button
                                  onClick={() => toggleRule(index)}
                                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    {isExpanded ? (
                                      <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                                    ) : (
                                      <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                                    )}
                                    <span className="font-medium text-gray-900 dark:text-white">
                                      Rule #{index + 1}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                      {(rule.verbs || []).length} verbs
                                    </span>
                                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                      {(rule.resources || []).length} resources
                                    </span>
                                  </div>
                                </button>

                                {/* Rule Details */}
                                {isExpanded && (
                                  <div className="px-4 pb-4 pt-2 space-y-3 bg-gray-50 dark:bg-gray-900/30">
                                    {/* API Groups */}
                                    <div>
                                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                        API Groups
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {(rule.apiGroups || ['']).map((group: string, i: number) => (
                                          <span
                                            key={i}
                                            className="inline-flex items-center px-3 py-1 rounded-md text-sm font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-300"
                                          >
                                            {group || '""'}
                                          </span>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Resources */}
                                    <div>
                                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                        Resources
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {(rule.resources || []).map((resource: string, i: number) => (
                                          <span
                                            key={i}
                                            className="inline-flex items-center px-3 py-1 rounded-md text-sm font-mono bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                                          >
                                            {resource}
                                          </span>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Verbs */}
                                    <div>
                                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                        Verbs
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {(rule.verbs || []).map((verb: string, i: number) => (
                                          <span
                                            key={i}
                                            className="inline-flex items-center px-3 py-1 rounded-md text-sm font-mono bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400"
                                          >
                                            {verb}
                                          </span>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Resource Names (if present) */}
                                    {rule.resourceNames && rule.resourceNames.length > 0 && (
                                      <div>
                                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                          Resource Names
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {rule.resourceNames.map((name: string, i: number) => (
                                            <span
                                              key={i}
                                              className="inline-flex items-center px-3 py-1 rounded-md text-sm font-mono bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400"
                                            >
                                              {name}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Non Resource URLs (if present) */}
                                    {rule.nonResourceURLs && rule.nonResourceURLs.length > 0 && (
                                      <div>
                                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                          Non-Resource URLs
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {rule.nonResourceURLs.map((url: string, i: number) => (
                                            <span
                                              key={i}
                                              className="inline-flex items-center px-3 py-1 rounded-md text-sm font-mono bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400"
                                            >
                                              {url}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Aggregation Rule */}
                    {isAggregated && clusterRole.aggregationRule && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                        <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-300 mb-3">
                          Aggregation Rule
                        </h3>
                        <div className="space-y-2">
                          {(clusterRole.aggregationRule.clusterRoleSelectors || []).map((selector: any, i: number) => (
                            <div key={i} className="bg-white dark:bg-purple-950/30 px-4 py-3 rounded-lg border border-purple-200 dark:border-purple-800">
                              {selector.matchLabels && (
                                <div>
                                  <div className="text-xs font-medium text-purple-700 dark:text-purple-400 mb-2">
                                    Match Labels:
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(selector.matchLabels).map(([key, value]) => (
                                      <span key={key} className="inline-flex px-2.5 py-1 rounded-md text-xs font-mono bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
                                        {key}: {String(value)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Labels */}
                    {clusterRole.metadata?.labels && Object.keys(clusterRole.metadata.labels).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                          Labels
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(clusterRole.metadata.labels).map(([key, value]) => (
                            <span
                              key={key}
                              className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-mono bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400"
                            >
                              <span className="font-semibold">{key}:</span>
                              <span className="ml-1">{String(value)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Annotations */}
                    {clusterRole.metadata?.annotations && Object.keys(clusterRole.metadata.annotations).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                          Annotations
                        </h3>
                        <div className="space-y-2">
                          {Object.entries(clusterRole.metadata.annotations).map(([key, value]) => (
                            <div key={key} className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                              <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                {key}
                              </div>
                              <div className="text-sm font-mono text-gray-800 dark:text-gray-300 break-all">
                                {String(value)}
                              </div>
                            </div>
                          ))}
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
