import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useMutation } from '@tanstack/react-query'
import { getCustomResourceDefinition, updateCustomResourceDefinition } from '@/services/api'
import { useNotificationStore } from '@/stores/notificationStore'
import YamlEditor from '@/components/shared/YamlEditor'
import yaml from 'js-yaml'
import { cleanKubernetesManifest } from '@/utils/kubernetes'

interface EditCRDYAMLModalProps {
  crd: any
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function EditCRDYAMLModal({
  crd,
  isOpen,
  onClose,
  onSuccess,
}: EditCRDYAMLModalProps) {
  const [yamlContent, setYamlContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const { addNotification } = useNotificationStore()

  useEffect(() => {
    if (isOpen && crd) {
      setIsLoading(true)
      getCustomResourceDefinition(crd.ClusterName, crd.metadata?.name)
        .then((data) => {
          const cleaned = cleanKubernetesManifest(data, 'customresourcedefinition')
          const yamlStr = yaml.dump(cleaned, { indent: 2, lineWidth: -1 })
          setYamlContent(yamlStr)
          setIsLoading(false)
        })
        .catch((error) => {
          console.error('Failed to fetch CRD:', error)
          addNotification({
            type: 'error',
            title: 'Error',
            message: 'Failed to load CRD YAML',
          })
          setIsLoading(false)
        })
    }
  }, [isOpen, crd, addNotification])

  const updateMutation = useMutation({
    mutationFn: ({ clusterName, crdName, yaml }: { clusterName: string; crdName: string; yaml: string }) =>
      updateCustomResourceDefinition(clusterName, crdName, yaml),
    onSuccess: () => {
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Custom Resource Definition updated successfully',
      })
      if (onSuccess) onSuccess()
      onClose()
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.error || 'Failed to update custom resource definition',
      })
    },
  })

  const handleSave = () => {
    try {
      // Validate YAML
      yaml.load(yamlContent)
      updateMutation.mutate({
        clusterName: crd.ClusterName,
        crdName: crd.metadata?.name,
        yaml: yamlContent,
      })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Invalid YAML',
        message: error.message || 'Please check your YAML syntax',
      })
    }
  }

  if (!crd) return null

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
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
                    Edit CRD YAML
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    disabled={updateMutation.isPending}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                <div className="p-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                    </div>
                  ) : (
                    <YamlEditor
                      value={yamlContent}
                      onChange={setYamlContent}
                      height="500px"
                    />
                  )}
                </div>

                <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={updateMutation.isPending || isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
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

