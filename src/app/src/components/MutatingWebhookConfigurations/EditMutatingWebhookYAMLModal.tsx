import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useState, useEffect } from 'react'
import { XMarkIcon, BoltIcon } from '@heroicons/react/24/outline'
import { getMutatingWebhookConfiguration } from '@/services/api'
import yaml from 'js-yaml'
import { cleanKubernetesManifest } from '@/utils/kubernetes'
import api from '@/services/api'
import YamlEditor from '@/components/shared/YamlEditor'

interface EditMutatingWebhookYAMLModalProps {
  webhook: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditMutatingWebhookYAMLModal({
  webhook,
  isOpen,
  onClose,
  onSuccess,
}: EditMutatingWebhookYAMLModalProps) {
  const [yamlContent, setYamlContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && webhook) {
      setIsLoading(true)
      setError(null)
      
      getMutatingWebhookConfiguration(webhook.clusterName, webhook.metadata.name)
        .then((data) => {
          const cleanedManifest = cleanKubernetesManifest(data, 'mutatingwebhookconfiguration')
          const yamlStr = yaml.dump(cleanedManifest, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
          })
          setYamlContent(yamlStr)
          setIsLoading(false)
        })
        .catch((err) => {
          console.error('Failed to fetch webhook:', err)
          setError('Failed to load webhook YAML')
          setIsLoading(false)
        })
    }
  }, [isOpen, webhook])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setError(null)

      const parsedYaml = yaml.load(yamlContent) as any
      
      await api.put(
        `/clusters/${webhook.clusterName}/mutatingwebhookconfigurations/${webhook.metadata.name}`,
        parsedYaml
      )

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Failed to update webhook:', err)
      setError(err.response?.data?.error || err.message || 'Failed to update webhook')
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
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
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
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <BoltIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
                        Edit Webhook YAML
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {webhook.metadata?.name}
                      </p>
                    </div>
                  </div>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors">
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="px-6 py-4">
                  {error && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 text-sm">
                      {error}
                    </div>
                  )}

                  {isLoading ? (
                    <div className="flex items-center justify-center h-96">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  ) : (
                    <YamlEditor
                      value={yamlContent}
                      onChange={setYamlContent}
                      height="500px"
                    />
                  )}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
                  <button
                    onClick={onClose}
                    disabled={isSaving}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || isLoading}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSaving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                    {isSaving ? 'Saving...' : 'Save Changes'}
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
