import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import { getServiceAccount, updateServiceAccount } from '@/services/api'
import yaml from 'js-yaml'
import { cleanKubernetesManifest } from '@/utils/kubernetes'
import YamlEditor from '@/components/shared/YamlEditor'
import { notifyResourceAction } from '@/utils/notifications'

interface EditServiceAccountYAMLModalProps {
  serviceAccount: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditServiceAccountYAMLModal({
  serviceAccount,
  isOpen,
  onClose,
  onSuccess,
}: EditServiceAccountYAMLModalProps) {
  const [yamlContent, setYamlContent] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen && serviceAccount) {
      fetchServiceAccount()
    }
  }, [isOpen, serviceAccount])

  const fetchServiceAccount = async () => {
    setIsLoading(true)
    try {
      const data = await getServiceAccount(
        serviceAccount.ClusterName,
        serviceAccount.metadata.namespace,
        serviceAccount.metadata.name
      )
      const cleaned = cleanKubernetesManifest(data, 'serviceaccount')
      setYamlContent(yaml.dump(cleaned, { indent: 2, lineWidth: -1 }))
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to fetch ServiceAccount')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setError('')
      
      // Validate YAML syntax
      yaml.load(yamlContent)
      
      await updateServiceAccount(
        serviceAccount.ClusterName,
        serviceAccount.metadata.namespace,
        serviceAccount.metadata.name,
        yamlContent
      )

      notifyResourceAction.updated('ServiceAccount', serviceAccount.metadata.name)
      onSuccess()
      onClose()
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to update ServiceAccount'
      setError(errorMsg)
      notifyResourceAction.failed('update', 'ServiceAccount', serviceAccount.metadata.name, errorMsg)
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
              <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <UserCircleIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Edit ServiceAccount YAML: {serviceAccount?.metadata?.name}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                      )}

                      <YamlEditor 
                        value={yamlContent} 
                        onChange={setYamlContent} 
                        height="500px"
                      />
                    </div>
                  )}
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
                    disabled={isSaving || isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
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

