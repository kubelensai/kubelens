import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import api from '@/services/api'
import yaml from 'js-yaml'
import { cleanKubernetesManifest } from '@/utils/kubernetes'
import YamlEditor from '@/components/shared/YamlEditor'

interface EditDaemonSetModalProps {
  daemonset: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditDaemonSetModal({
  daemonset,
  isOpen,
  onClose,
  onSuccess,
}: EditDaemonSetModalProps) {
  const [daemonsetYaml, setDaemonSetYaml] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (isOpen && daemonset) {
      fetchDaemonSetYaml()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, daemonset])

  const fetchDaemonSetYaml = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await api.get(
        `/clusters/${daemonset.clusterName}/namespaces/${daemonset.metadata.namespace}/daemonsets/${daemonset.metadata.name}`
      )
      // Clean and reorder the manifest
      const cleanedManifest = cleanKubernetesManifest(response.data, 'daemonset')
      
      // Convert to YAML format
      const yamlStr = yaml.dump(cleanedManifest, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
      })
      setDaemonSetYaml(yamlStr)
    } catch (err) {
      console.error('Failed to fetch daemonset:', err)
      setError('Failed to load daemonset data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError('')
    try {
      // Parse YAML to JSON
      const parsedDaemonSet = yaml.load(daemonsetYaml)

      await api.put(
        `/clusters/${daemonset.clusterName}/namespaces/${daemonset.metadata.namespace}/daemonsets/${daemonset.metadata.name}`,
        parsedDaemonSet
      )

      onSuccess()
    } catch (err: any) {
      console.error('Failed to update daemonset:', err)
      if (err.name === 'YAMLException') {
        setError(`YAML Syntax Error: ${err.message}`)
      } else {
        setError(
          err.response?.data?.error || 'Failed to update daemonset. Please check your YAML syntax.'
        )
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (!daemonset) return null

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
              <Dialog.Panel className="relative transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all w-full max-w-5xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <PencilSquareIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Edit DaemonSet
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4">
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Editing DaemonSet: <span className="font-semibold text-gray-900 dark:text-white">{daemonset.metadata.name}</span> in{' '}
                      <span className="font-semibold text-gray-900 dark:text-white">{daemonset.metadata.namespace}</span>
                    </p>
                  </div>

                  {error && (
                    <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 p-4">
                      <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                    </div>
                  )}

                  {isLoading ? (
                    <div className="flex justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          DaemonSet YAML
                        </label>
                        <YamlEditor
                          value={daemonsetYaml}
                          onChange={setDaemonSetYaml}
                          height="500px"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving || isLoading}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 rounded-lg transition-colors flex items-center gap-2"
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
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}


