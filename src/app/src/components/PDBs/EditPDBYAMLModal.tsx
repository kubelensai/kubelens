import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import api from '@/services/api'
import yaml from 'js-yaml'
import { cleanKubernetesManifest } from '@/utils/kubernetes'
import { notifyResourceAction } from '@/utils/notifications'
import YamlEditor from '@/components/shared/YamlEditor'

interface EditPDBYAMLModalProps {
  pdb: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditPDBYAMLModal({ pdb, isOpen, onClose, onSuccess }: EditPDBYAMLModalProps) {
  const [yamlContent, setYamlContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (pdb && isOpen) {
      setIsLoading(true)
      api
        .get(`/clusters/${pdb.clusterName}/namespaces/${pdb.metadata?.namespace}/pdbs/${pdb.metadata?.name}`)
        .then((response) => {
          const cleanedPDB = cleanKubernetesManifest(response.data, 'poddisruptionbudget')
          setYamlContent(yaml.dump(cleanedPDB))
          setError('')
        })
        .catch((err) => {
          setError(err.message || 'Failed to load PDB YAML')
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [pdb, isOpen])

  const handleSave = async () => {
    try {
      setIsLoading(true)
      setError('')

      const parsed = yaml.load(yamlContent) as any
      await api.put(
        `/clusters/${pdb.clusterName}/namespaces/${pdb.metadata?.namespace}/pdbs/${pdb.metadata?.name}`,
        parsed
      )

      notifyResourceAction.updated('PDB', pdb.metadata?.name)
      onSuccess()
      onClose()
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to update PDB'
      setError(errorMsg)
      notifyResourceAction.failed('update', 'PDB', pdb.metadata?.name, errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  if (!pdb) return null

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
                    <PencilSquareIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Edit PDB YAML
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
                  {error && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  {isLoading && !yamlContent ? (
                    <div className="flex items-center justify-center py-12">
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

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isLoading ? (
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

