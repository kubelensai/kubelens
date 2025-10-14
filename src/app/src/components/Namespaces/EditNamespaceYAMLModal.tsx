import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useMutation } from '@tanstack/react-query'
import api from '@/services/api'
import YamlEditor from '@/components/shared/YamlEditor'
import yaml from 'js-yaml'
import { cleanKubernetesManifest } from '@/utils/kubernetes'

interface EditNamespaceYAMLModalProps {
  namespace: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditNamespaceYAMLModal({
  namespace,
  isOpen,
  onClose,
  onSuccess,
}: EditNamespaceYAMLModalProps) {
  const [yamlContent, setYamlContent] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (namespace && isOpen) {
      try {
        const cleaned = cleanKubernetesManifest(namespace, 'namespace')
        const yamlStr = yaml.dump(cleaned, { indent: 2, lineWidth: -1 })
        setYamlContent(yamlStr)
        setError('')
      } catch (err) {
        setError('Failed to parse namespace data')
        console.error('Failed to convert namespace to YAML:', err)
      }
    }
  }, [namespace, isOpen])

  const updateMutation = useMutation({
    mutationFn: async (updatedNamespace: any) => {
      const { data } = await api.put(
        `/clusters/${namespace.clusterName}/namespaces/${namespace.metadata.name}`,
        updatedNamespace
      )
      return data
    },
    onSuccess: () => {
      onSuccess()
      onClose()
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || err.message || 'Failed to update namespace')
    },
  })

  const handleSave = () => {
    try {
      const parsed = yaml.load(yamlContent)
      setError('')
      updateMutation.mutate(parsed)
    } catch (err) {
      setError('Invalid YAML format. Please check your syntax.')
      console.error('YAML parse error:', err)
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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
                    Edit Namespace YAML
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
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      YAML Configuration
                    </label>
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-900">
                      <YamlEditor
                          value={yamlContent}
                          onChange={setYamlContent}
                          height="500px"
                        />
                    </div>
                  </div>

                  {error && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={updateMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

