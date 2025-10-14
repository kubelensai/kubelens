import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CloudIcon } from '@heroicons/react/24/outline'
import { useMutation } from '@tanstack/react-query'
import api from '@/services/api'
import yaml from 'js-yaml'
import clsx from 'clsx'
import { cleanKubernetesManifest } from '@/utils/kubernetes'
import YamlEditor from '@/components/shared/YamlEditor'

interface EditServiceModalProps {
  service: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditServiceModal({ service, isOpen, onClose, onSuccess }: EditServiceModalProps) {
  const [serviceYaml, setServiceYaml] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (service && isOpen) {
      try {
        // Clean and reorder the manifest
        const cleanedManifest = cleanKubernetesManifest(service, 'service')
        const yamlStr = yaml.dump(cleanedManifest, {
          indent: 2,
          lineWidth: -1,
          noRefs: true,
          sortKeys: false,
        })
        setServiceYaml(yamlStr)
        setError('')
      } catch (err) {
        setError('Failed to convert service to YAML')
      }
    }
  }, [service, isOpen])

  const updateMutation = useMutation({
    mutationFn: async (updatedYaml: string) => {
      if (!service) {
        throw new Error('Service data is missing')
      }

      try {
        const updatedService = yaml.load(updatedYaml) as any
        
        await api.put(
          `/clusters/${service.clusterName}/namespaces/${service.metadata.namespace}/services/${service.metadata.name}`,
          updatedService
        )
      } catch (err: any) {
        throw new Error(err.response?.data?.error || err.message || 'Failed to update service')
      }
    },
    onSuccess: () => {
      onSuccess()
    },
    onError: (error: Error) => {
      setError(error.message)
    },
  })

  const handleSave = () => {
    try {
      // Validate YAML
      yaml.load(serviceYaml)
      setError('')
      updateMutation.mutate(serviceYaml)
    } catch (err: any) {
      setError('Invalid YAML: ' + err.message)
    }
  }

  if (!service) return null

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
                    <CloudIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Edit Service: {service.metadata.name}
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
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Edit the service YAML configuration below. Make sure to maintain valid YAML syntax.
                  </p>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  <YamlEditor
                    value={serviceYaml}
                    onChange={setServiceYaml}
                    height="500px"
                  />
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onClose}
                    disabled={updateMutation.isPending}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={clsx(
                      "btn-primary",
                      updateMutation.isPending && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
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

