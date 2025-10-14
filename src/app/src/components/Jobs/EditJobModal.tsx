import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import api from '@/services/api'
import yaml from 'js-yaml'
import { cleanKubernetesManifest } from '@/utils/kubernetes'
import YamlEditor from '@/components/shared/YamlEditor'

interface EditJobModalProps {
  job: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditJobModal({
  job,
  isOpen,
  onClose,
  onSuccess,
}: EditJobModalProps) {
  const [jobYaml, setJobYaml] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (isOpen && job) {
      fetchJobYaml()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, job])

  const fetchJobYaml = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await api.get(
        `/clusters/${job.clusterName}/namespaces/${job.metadata.namespace}/jobs/${job.metadata.name}`
      )
      // Clean and reorder the manifest
      const cleanedManifest = cleanKubernetesManifest(response.data, 'job')
      
      // Convert to YAML format
      const yamlStr = yaml.dump(cleanedManifest, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
      })
      setJobYaml(yamlStr)
    } catch (err) {
      console.error('Failed to fetch job:', err)
      setError('Failed to load job data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError('')
    try {
      // Parse YAML to JSON
      const parsedJob = yaml.load(jobYaml)

      await api.put(
        `/clusters/${job.clusterName}/namespaces/${job.metadata.namespace}/jobs/${job.metadata.name}`,
        parsedJob
      )

      onSuccess()
    } catch (err: any) {
      console.error('Failed to update job:', err)
      if (err.name === 'YAMLException') {
        setError(`YAML Syntax Error: ${err.message}`)
      } else {
        setError(
          err.response?.data?.error || 'Failed to update job. Please check your YAML syntax.'
        )
      }
    } finally {
      setIsSaving(false)
    }
  }

  if (!job) return null

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
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <PencilSquareIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Edit Job: {job.metadata?.name}
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
                    <div className="flex justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Job Definition (YAML):
                        </label>
                        <YamlEditor
                          value={jobYaml}
                          onChange={setJobYaml}
                          height="500px"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || isLoading}
                    className="px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
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


