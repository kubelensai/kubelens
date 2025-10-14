import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useMutation } from '@tanstack/react-query'
import { createRole } from '@/services/api'
import yaml from 'js-yaml'
import { useNotificationStore } from '@/stores/notificationStore'

interface CreateRoleModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  cluster: string
  namespace: string
}

interface Rule {
  apiGroups: string[]
  resources: string[]
  verbs: string[]
  resourceNames?: string[]
}

export default function CreateRoleModal({
  isOpen,
  onClose,
  onSuccess,
  cluster,
  namespace,
}: CreateRoleModalProps) {
  const [name, setName] = useState('')
  const [rules, setRules] = useState<Rule[]>([
    { apiGroups: [''], resources: [''], verbs: [''] }
  ])
  const [labels, setLabels] = useState<Array<{ key: string; value: string }>>([])
  const [annotations, setAnnotations] = useState<Array<{ key: string; value: string }>>([])
  const { addNotification } = useNotificationStore()

  const createMutation = useMutation({
    mutationFn: ({ clusterName, namespace, yaml }: { clusterName: string; namespace: string; yaml: string }) =>
      createRole(clusterName, namespace, yaml),
    onSuccess: () => {
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Role created successfully',
      })
      onSuccess?.()
      handleClose()
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.error || 'Failed to create role',
      })
    },
  })

  const handleClose = () => {
    setName('')
    setRules([{ apiGroups: [''], resources: [''], verbs: [''] }])
    setLabels([])
    setAnnotations([])
    onClose()
  }

  const handleCreate = () => {
    if (!name.trim()) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Role name is required',
      })
      return
    }

    // Build Role object
    const role: any = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'Role',
      metadata: {
        name: name.trim(),
        namespace: namespace,
      },
      rules: rules
        .filter(rule => 
          rule.apiGroups.some(g => g.trim()) &&
          rule.resources.some(r => r.trim()) &&
          rule.verbs.some(v => v.trim())
        )
        .map(rule => ({
          apiGroups: rule.apiGroups.filter(g => g.trim()),
          resources: rule.resources.filter(r => r.trim()),
          verbs: rule.verbs.filter(v => v.trim()),
          ...(rule.resourceNames && rule.resourceNames.length > 0 && { resourceNames: rule.resourceNames.filter(n => n.trim()) })
        }))
    }

    // Add labels
    if (labels.length > 0) {
      const labelsObj: Record<string, string> = {}
      labels.forEach(({ key, value }) => {
        if (key.trim() && value.trim()) {
          labelsObj[key.trim()] = value.trim()
        }
      })
      if (Object.keys(labelsObj).length > 0) {
        role.metadata.labels = labelsObj
      }
    }

    // Add annotations
    if (annotations.length > 0) {
      const annotationsObj: Record<string, string> = {}
      annotations.forEach(({ key, value }) => {
        if (key.trim() && value.trim()) {
          annotationsObj[key.trim()] = value.trim()
        }
      })
      if (Object.keys(annotationsObj).length > 0) {
        role.metadata.annotations = annotationsObj
      }
    }

    const yamlString = yaml.dump(role)
    createMutation.mutate({ clusterName: cluster, namespace, yaml: yamlString })
  }

  const addRule = () => {
    setRules([...rules, { apiGroups: [''], resources: [''], verbs: [''] }])
  }

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index))
  }

  const updateRule = (index: number, field: 'apiGroups' | 'resources' | 'verbs' | 'resourceNames', value: string) => {
    const newRules = [...rules]
    newRules[index][field] = value.split(',').map(v => v.trim())
    setRules(newRules)
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
                    <PlusIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Create Role
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    disabled={createMutation.isPending}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
                  <div className="space-y-6">
                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., pod-reader"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    {/* Rules */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Rules *
                        </label>
                        <button
                          type="button"
                          onClick={addRule}
                          className="text-xs flex items-center gap-1 px-3 py-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 bg-primary-50 dark:bg-primary-900/20 rounded-lg transition-colors"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Add Rule
                        </button>
                      </div>
                      <div className="space-y-4">
                        {rules.map((rule, index) => (
                          <div
                            key={index}
                            className="relative bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                          >
                            {rules.length > 1 && (
                              <button
                                onClick={() => removeRule(index)}
                                className="absolute top-3 right-3 p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                  API Groups (comma-separated, use "" for core)
                                </label>
                                <input
                                  type="text"
                                  value={rule.apiGroups.join(', ')}
                                  onChange={(e) => updateRule(index, 'apiGroups', e.target.value)}
                                  placeholder='e.g., "", apps, batch'
                                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                  Resources (comma-separated)
                                </label>
                                <input
                                  type="text"
                                  value={rule.resources.join(', ')}
                                  onChange={(e) => updateRule(index, 'resources', e.target.value)}
                                  placeholder="e.g., pods, services, deployments"
                                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                  Verbs (comma-separated)
                                </label>
                                <input
                                  type="text"
                                  value={rule.verbs.join(', ')}
                                  onChange={(e) => updateRule(index, 'verbs', e.target.value)}
                                  placeholder="e.g., get, list, watch, create, update, delete"
                                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                  Resource Names (optional, comma-separated)
                                </label>
                                <input
                                  type="text"
                                  value={(rule.resourceNames || []).join(', ')}
                                  onChange={(e) => updateRule(index, 'resourceNames', e.target.value)}
                                  placeholder="e.g., my-pod, my-service"
                                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Labels */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Labels (Optional)
                        </label>
                        <button
                          type="button"
                          onClick={() => setLabels([...labels, { key: '', value: '' }])}
                          className="text-xs flex items-center gap-1 px-2 py-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Add
                        </button>
                      </div>
                      <div className="space-y-2">
                        {labels.map((label, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={label.key}
                              onChange={(e) => {
                                const newLabels = [...labels]
                                newLabels[index].key = e.target.value
                                setLabels(newLabels)
                              }}
                              placeholder="Key"
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <input
                              type="text"
                              value={label.value}
                              onChange={(e) => {
                                const newLabels = [...labels]
                                newLabels[index].value = e.target.value
                                setLabels(newLabels)
                              }}
                              placeholder="Value"
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <button
                              onClick={() => setLabels(labels.filter((_, i) => i !== index))}
                              className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Annotations */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Annotations (Optional)
                        </label>
                        <button
                          type="button"
                          onClick={() => setAnnotations([...annotations, { key: '', value: '' }])}
                          className="text-xs flex items-center gap-1 px-2 py-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Add
                        </button>
                      </div>
                      <div className="space-y-2">
                        {annotations.map((annotation, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={annotation.key}
                              onChange={(e) => {
                                const newAnnotations = [...annotations]
                                newAnnotations[index].key = e.target.value
                                setAnnotations(newAnnotations)
                              }}
                              placeholder="Key"
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <input
                              type="text"
                              value={annotation.value}
                              onChange={(e) => {
                                const newAnnotations = [...annotations]
                                newAnnotations[index].value = e.target.value
                                setAnnotations(newAnnotations)
                              }}
                              placeholder="Value"
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <button
                              onClick={() => setAnnotations(annotations.filter((_, i) => i !== index))}
                              className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={createMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {createMutation.isPending ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <PlusIcon className="h-4 w-4" />
                        Create
                      </>
                    )}
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

