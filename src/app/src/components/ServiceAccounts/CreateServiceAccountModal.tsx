import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, IdentificationIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { createServiceAccount } from '@/services/api'
import { notifyResourceAction } from '@/utils/notifications'

interface CreateServiceAccountModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  cluster: string
  namespace: string
}

interface LabelAnnotation {
  key: string
  value: string
}

export default function CreateServiceAccountModal({
  isOpen,
  onClose,
  onSuccess,
  cluster,
  namespace,
}: CreateServiceAccountModalProps) {
  const [name, setName] = useState('')
  const [labels, setLabels] = useState<LabelAnnotation[]>([{ key: '', value: '' }])
  const [annotations, setAnnotations] = useState<LabelAnnotation[]>([{ key: '', value: '' }])
  const [automountToken, setAutomountToken] = useState<'default' | 'enabled' | 'disabled'>('default')
  const [imagePullSecrets, setImagePullSecrets] = useState<string[]>([''])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleAddLabel = () => {
    setLabels([...labels, { key: '', value: '' }])
  }

  const handleRemoveLabel = (index: number) => {
    setLabels(labels.filter((_, i) => i !== index))
  }

  const handleLabelChange = (index: number, field: 'key' | 'value', value: string) => {
    const newLabels = [...labels]
    newLabels[index][field] = value
    setLabels(newLabels)
  }

  const handleAddAnnotation = () => {
    setAnnotations([...annotations, { key: '', value: '' }])
  }

  const handleRemoveAnnotation = (index: number) => {
    setAnnotations(annotations.filter((_, i) => i !== index))
  }

  const handleAnnotationChange = (index: number, field: 'key' | 'value', value: string) => {
    const newAnnotations = [...annotations]
    newAnnotations[index][field] = value
    setAnnotations(newAnnotations)
  }

  const handleAddImagePullSecret = () => {
    setImagePullSecrets([...imagePullSecrets, ''])
  }

  const handleRemoveImagePullSecret = (index: number) => {
    setImagePullSecrets(imagePullSecrets.filter((_, i) => i !== index))
  }

  const handleImagePullSecretChange = (index: number, value: string) => {
    const newSecrets = [...imagePullSecrets]
    newSecrets[index] = value
    setImagePullSecrets(newSecrets)
  }

  const handleCreate = async () => {
    // Validation
    if (!name.trim()) {
      setError('Service Account name is required')
      return
    }

    if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)) {
      setError('Name must be lowercase alphanumeric with hyphens')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      // Build metadata
      const metadata: any = {
        name: name.trim(),
        namespace: namespace !== 'all' ? namespace : 'default',
      }

      // Add labels if any
      const validLabels = labels.filter(l => l.key.trim() && l.value.trim())
      if (validLabels.length > 0) {
        metadata.labels = Object.fromEntries(validLabels.map(l => [l.key, l.value]))
      }

      // Add annotations if any
      const validAnnotations = annotations.filter(a => a.key.trim() && a.value.trim())
      if (validAnnotations.length > 0) {
        metadata.annotations = Object.fromEntries(validAnnotations.map(a => [a.key, a.value]))
      }

      // Build service account manifest
      const serviceAccount: any = {
        apiVersion: 'v1',
        kind: 'ServiceAccount',
        metadata,
      }

      // Add automountServiceAccountToken
      if (automountToken === 'enabled') {
        serviceAccount.automountServiceAccountToken = true
      } else if (automountToken === 'disabled') {
        serviceAccount.automountServiceAccountToken = false
      } else {
        // default - explicitly set to null
        serviceAccount.automountServiceAccountToken = null
      }

      // Add imagePullSecrets if any
      const validSecrets = imagePullSecrets.filter(s => s.trim())
      if (validSecrets.length > 0) {
        serviceAccount.imagePullSecrets = validSecrets.map(s => ({ name: s.trim() }))
      }

      // Convert to YAML and send
      const yaml = require('js-yaml')
      const yamlStr = yaml.dump(serviceAccount, { indent: 2, lineWidth: -1 })

      await createServiceAccount(cluster, metadata.namespace, yamlStr)

      notifyResourceAction.created('Service Account', name)
      
      // Reset form
      setName('')
      setLabels([{ key: '', value: '' }])
      setAnnotations([{ key: '', value: '' }])
      setAutomountToken('default')
      setImagePullSecrets([''])
      
      onSuccess()
      onClose()
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create Service Account'
      setError(errorMsg)
      notifyResourceAction.failed('create', 'Service Account', name, errorMsg)
    } finally {
      setIsCreating(false)
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
                    <IdentificationIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Create Service Account
                  </Dialog.Title>
                  <button
                    onClick={onClose}
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
                        Service Account Name *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="my-service-account"
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
                        value={namespace !== 'all' ? namespace : 'default'}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Selected from current context
                      </p>
                    </div>
                  </div>

                  {/* Auto Mount Service Account Token */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Auto Mount Token
                    </label>
                    <div className="flex gap-4">
                      {[
                        { value: 'default', label: 'Default' },
                        { value: 'enabled', label: 'Enabled' },
                        { value: 'disabled', label: 'Disabled' },
                      ].map((option) => (
                        <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="automount"
                            value={option.value}
                            checked={automountToken === option.value}
                            onChange={(e) => setAutomountToken(e.target.value as any)}
                            className="text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Labels */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Labels (Optional)
                      </label>
                      <button
                        onClick={handleAddLabel}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 bg-primary-50 dark:bg-primary-900/20 rounded transition-colors"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Add Label
                      </button>
                    </div>
                    <div className="space-y-3">
                      {labels.map((label, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={label.key}
                              onChange={(e) => handleLabelChange(index, 'key', e.target.value)}
                              placeholder="Key"
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <input
                              type="text"
                              value={label.value}
                              onChange={(e) => handleLabelChange(index, 'value', e.target.value)}
                              placeholder="Value"
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            {labels.length > 1 && (
                              <button
                                onClick={() => handleRemoveLabel(index)}
                                className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Remove label"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Annotations */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Annotations (Optional)
                      </label>
                      <button
                        onClick={handleAddAnnotation}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 bg-primary-50 dark:bg-primary-900/20 rounded transition-colors"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Add Annotation
                      </button>
                    </div>
                    <div className="space-y-3">
                      {annotations.map((annotation, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={annotation.key}
                              onChange={(e) => handleAnnotationChange(index, 'key', e.target.value)}
                              placeholder="Key"
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <input
                              type="text"
                              value={annotation.value}
                              onChange={(e) => handleAnnotationChange(index, 'value', e.target.value)}
                              placeholder="Value"
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            {annotations.length > 1 && (
                              <button
                                onClick={() => handleRemoveAnnotation(index)}
                                className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Remove annotation"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Image Pull Secrets */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Image Pull Secrets (Optional)
                      </label>
                      <button
                        onClick={handleAddImagePullSecret}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 bg-primary-50 dark:bg-primary-900/20 rounded transition-colors"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Add Secret
                      </button>
                    </div>
                    <div className="space-y-3">
                      {imagePullSecrets.map((secret, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={secret}
                              onChange={(e) => handleImagePullSecretChange(index, e.target.value)}
                              placeholder="Secret name"
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            {imagePullSecrets.length > 1 && (
                              <button
                                onClick={() => handleRemoveImagePullSecret(index)}
                                className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Remove secret"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={onClose}
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
                        Create Service Account
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
