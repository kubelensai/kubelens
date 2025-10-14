import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline'
import yaml from 'js-yaml'
import api from '@/services/api'
import { notifyResourceAction } from '@/utils/notifications'
import { cleanKubernetesManifest } from '@/utils/kubernetes'
import YamlEditor from '@/components/shared/YamlEditor'

interface EditHPAYAMLModalProps {
  hpa: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditHPAYAMLModal({
  hpa,
  isOpen,
  onClose,
  onSuccess,
}: EditHPAYAMLModalProps) {
  const [yamlContent, setYamlContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && hpa) {
      const cleanedHPA = cleanKubernetesManifest(hpa, 'horizontalpodautoscaler')
      setYamlContent(yaml.dump(cleanedHPA, { lineWidth: -1, noRefs: true }))
      setError(null)
    }
  }, [isOpen, hpa])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setError(null)

      // Parse YAML
      const parsedHPA = yaml.load(yamlContent) as any

      // Update via API
      await api.put(
        `/clusters/${hpa.clusterName}/namespaces/${hpa.metadata.namespace}/hpas/${hpa.metadata.name}`,
        parsedHPA
      )

      notifyResourceAction.updated('HPA', hpa.metadata.name)
      onSuccess()
      onClose()
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to update HPA'
      setError(errorMsg)
      notifyResourceAction.failed('update', 'HPA', hpa.metadata.name, errorMsg)
      console.error('Failed to update HPA:', err)
    } finally {
      setIsSaving(false)
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
          <div className="fixed inset-0 bg-black/25 dark:bg-black/50" />
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
              <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-gray-800 dark:to-gray-700">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                    Edit HPA YAML: {hpa.metadata?.name}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6">
                  {error && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  <YamlEditor
                    value={yamlContent}
                    onChange={setYamlContent}
                    height="500px"
                  />
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

