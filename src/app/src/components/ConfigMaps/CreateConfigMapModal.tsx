import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, DocumentTextIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import api from '@/services/api'
import { notifyResourceAction } from '@/utils/notifications'

interface CreateConfigMapModalProps {
  clusterName: string
  namespace: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface ConfigMapDataField {
  key: string
  value: string
}

export default function CreateConfigMapModal({ clusterName, namespace, isOpen, onClose, onSuccess }: CreateConfigMapModalProps) {
  const [configMapName, setConfigMapName] = useState('')
  const [dataFields, setDataFields] = useState<ConfigMapDataField[]>([
    { key: '', value: '' }
  ])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleAddField = () => {
    setDataFields([...dataFields, { key: '', value: '' }])
  }

  const handleRemoveField = (index: number) => {
    setDataFields(dataFields.filter((_, i) => i !== index))
  }

  const handleFieldChange = (index: number, field: 'key' | 'value', value: string) => {
    const newFields = [...dataFields]
    newFields[index][field] = value
    setDataFields(newFields)
  }

  const handleCreate = async () => {
    // Validation
    if (!configMapName.trim()) {
      setError('ConfigMap name is required')
      return
    }

    if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(configMapName)) {
      setError('ConfigMap name must be lowercase alphanumeric with hyphens')
      return
    }

    const validFields = dataFields.filter(f => f.key.trim())
    if (validFields.length === 0) {
      setError('At least one data field is required')
      return
    }

    // Check for duplicate keys
    const keys = validFields.map(f => f.key)
    if (new Set(keys).size !== keys.length) {
      setError('Duplicate keys are not allowed')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      // Prepare data
      const data: Record<string, string> = {}
      validFields.forEach(field => {
        data[field.key] = field.value
      })

      // Prepare configmap manifest
      const configMap = {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: configMapName,
          namespace: namespace,
        },
        data: data,
      }

      await api.post(
        `/clusters/${clusterName}/namespaces/${namespace}/configmaps`,
        configMap
      )

      notifyResourceAction.created('ConfigMap', configMapName)
      
      // Reset form
      setConfigMapName('')
      setDataFields([{ key: '', value: '' }])
      
      onSuccess()
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create configmap'
      setError(errorMsg)
      notifyResourceAction.failed('create', 'ConfigMap', configMapName, errorMsg)
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    // Reset form
    setConfigMapName('')
    setDataFields([{ key: '', value: '' }])
    setError('')
    onClose()
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
                    <DocumentTextIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Create ConfigMap
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                  {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        ConfigMap Name *
                      </label>
                      <input
                        type="text"
                        value={configMapName}
                        onChange={(e) => setConfigMapName(e.target.value)}
                        placeholder="my-config"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Lowercase alphanumeric with hyphens
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Namespace *
                      </label>
                      <input
                        type="text"
                        value={namespace}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Selected from current context
                      </p>
                    </div>
                  </div>

                  {/* Data Fields */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Data Fields *
                      </label>
                      <button
                        onClick={handleAddField}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 bg-primary-50 dark:bg-primary-900/20 rounded transition-colors"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Add Field
                      </button>
                    </div>
                    <div className="space-y-3">
                      {dataFields.map((field, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={field.key}
                              onChange={(e) => handleFieldChange(index, 'key', e.target.value)}
                              placeholder="Key (e.g., database.host)"
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            {dataFields.length > 1 && (
                              <button
                                onClick={() => handleRemoveField(index)}
                                className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Remove field"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            )}
                          </div>
                          <textarea
                            value={field.value}
                            onChange={(e) => handleFieldChange(index, 'value', e.target.value)}
                            placeholder="Value (plain text, no encoding needed)"
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isCreating}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isCreating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <PlusIcon className="h-4 w-4" />
                        Create ConfigMap
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

