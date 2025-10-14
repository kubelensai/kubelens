import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, DocumentTextIcon, CheckIcon } from '@heroicons/react/24/outline'
import { formatAge } from '@/utils/format'
import api from '@/services/api'
import { notifyResourceAction } from '@/utils/notifications'

interface ConfigMapDetailsModalProps {
  configMap: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ConfigMapDetailsModal({ configMap, isOpen, onClose, onSuccess }: ConfigMapDetailsModalProps) {
  const [dataFields, setDataFields] = useState<Record<string, string>>({})
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Initialize data fields when configMap changes
  useEffect(() => {
    if (configMap?.data) {
      setDataFields({ ...configMap.data })
    }
  }, [configMap])

  if (!configMap) return null

  const handleFieldChange = (key: string, value: string) => {
    setDataFields(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Update configMap with new data
      const updatedConfigMap = {
        ...configMap,
        data: dataFields
      }

      await api.put(
        `/clusters/${configMap.clusterName}/namespaces/${configMap.metadata.namespace}/configmaps/${configMap.metadata.name}`,
        updatedConfigMap
      )

      notifyResourceAction.updated('ConfigMap', configMap.metadata.name)
      setIsEditing(false)
      onSuccess()
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error'
      notifyResourceAction.failed('update', 'ConfigMap', configMap.metadata.name, errorMsg)
      console.error('Failed to update configmap:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    // Reset to original data
    if (configMap?.data) {
      setDataFields({ ...configMap.data })
    }
    setIsEditing(false)
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
                    <DocumentTextIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    ConfigMap: {configMap.metadata.name}
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
                          {configMap.metadata.name}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Namespace:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {configMap.metadata.namespace}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Age:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {formatAge(configMap.metadata.creationTimestamp)}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Data Keys:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {Object.keys(dataFields).length} keys
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Data Fields */}
                  {Object.keys(dataFields).length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                          Data Fields
                        </h3>
                        {!isEditing ? (
                          <button
                            onClick={() => setIsEditing(true)}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                          >
                            Edit Data Fields
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={handleCancel}
                              disabled={isSaving}
                              className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSave}
                              disabled={isSaving}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {isSaving ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <CheckIcon className="h-4 w-4" />
                                  Save Changes
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        {Object.entries(dataFields).map(([key, value]) => (
                          <div key={key} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {key}
                            </label>
                            <textarea
                              value={value}
                              onChange={(e) => handleFieldChange(key, e.target.value)}
                              disabled={!isEditing}
                              rows={Math.min(Math.max(value.split('\n').length, 3), 10)}
                              className={`w-full px-3 py-2 border rounded-lg font-mono text-sm ${
                                isEditing
                                  ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                                  : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                              }`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Labels */}
                  {configMap.metadata.labels && Object.keys(configMap.metadata.labels).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                        Labels
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(configMap.metadata.labels).map(([key, value]) => (
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

