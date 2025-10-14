import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import api from '@/services/api'
import { useMutation } from '@tanstack/react-query'

interface CreateStorageClassModalProps {
  isOpen: boolean
  onClose: () => void
  clusterName: string
  onSuccess: () => void
}

export default function CreateStorageClassModal({
  isOpen,
  onClose,
  clusterName,
  onSuccess,
}: CreateStorageClassModalProps) {
  const [name, setName] = useState('')
  const [provisioner, setProvisioner] = useState('')
  const [reclaimPolicy, setReclaimPolicy] = useState<'Delete' | 'Retain'>('Delete')
  const [volumeBindingMode, setVolumeBindingMode] = useState<'Immediate' | 'WaitForFirstConsumer'>('Immediate')
  const [allowVolumeExpansion, setAllowVolumeExpansion] = useState(false)
  const [parameters, setParameters] = useState<Array<{ key: string; value: string }>>([])
  const [mountOptions, setMountOptions] = useState<string[]>([])

  const createMutation = useMutation({
    mutationFn: async (storageClass: any) => {
      const { data } = await api.post(`/clusters/${clusterName}/storageclasses`, storageClass)
      return data
    },
    onSuccess: () => {
      onSuccess()
      handleClose()
    },
  })

  const handleClose = () => {
    setName('')
    setProvisioner('')
    setReclaimPolicy('Delete')
    setVolumeBindingMode('Immediate')
    setAllowVolumeExpansion(false)
    setParameters([])
    setMountOptions([])
    onClose()
  }

  const handleAddParameter = () => {
    setParameters([...parameters, { key: '', value: '' }])
  }

  const handleRemoveParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index))
  }

  const handleParameterChange = (index: number, field: 'key' | 'value', value: string) => {
    const newParameters = [...parameters]
    newParameters[index][field] = value
    setParameters(newParameters)
  }

  const handleAddMountOption = () => {
    setMountOptions([...mountOptions, ''])
  }

  const handleRemoveMountOption = (index: number) => {
    setMountOptions(mountOptions.filter((_, i) => i !== index))
  }

  const handleMountOptionChange = (index: number, value: string) => {
    const newMountOptions = [...mountOptions]
    newMountOptions[index] = value
    setMountOptions(newMountOptions)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Build parameters object
    const parametersObj: Record<string, string> = {}
    parameters.forEach(param => {
      if (param.key && param.value) {
        parametersObj[param.key] = param.value
      }
    })

    // Build mount options array (filter out empty strings)
    const mountOptionsArray = mountOptions.filter(opt => opt.trim() !== '')

    const storageClass = {
      apiVersion: 'storage.k8s.io/v1',
      kind: 'StorageClass',
      metadata: {
        name,
      },
      provisioner,
      reclaimPolicy,
      volumeBindingMode,
      allowVolumeExpansion,
      ...(Object.keys(parametersObj).length > 0 && { parameters: parametersObj }),
      ...(mountOptionsArray.length > 0 && { mountOptions: mountOptionsArray }),
    }

    createMutation.mutate(storageClass)
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title as="h3" className="text-xl font-semibold text-gray-900 dark:text-white">
                    Create Storage Class
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., fast-ssd"
                    />
                  </div>

                  {/* Provisioner */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Provisioner *
                    </label>
                    <input
                      type="text"
                      value={provisioner}
                      onChange={(e) => setProvisioner(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., kubernetes.io/aws-ebs"
                    />
                  </div>

                  {/* Reclaim Policy */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Reclaim Policy
                    </label>
                    <select
                      value={reclaimPolicy}
                      onChange={(e) => setReclaimPolicy(e.target.value as 'Delete' | 'Retain')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Delete">Delete</option>
                      <option value="Retain">Retain</option>
                    </select>
                  </div>

                  {/* Volume Binding Mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Volume Binding Mode
                    </label>
                    <select
                      value={volumeBindingMode}
                      onChange={(e) => setVolumeBindingMode(e.target.value as 'Immediate' | 'WaitForFirstConsumer')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Immediate">Immediate</option>
                      <option value="WaitForFirstConsumer">WaitForFirstConsumer</option>
                    </select>
                  </div>

                  {/* Allow Volume Expansion */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="allowVolumeExpansion"
                      checked={allowVolumeExpansion}
                      onChange={(e) => setAllowVolumeExpansion(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="allowVolumeExpansion" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Allow Volume Expansion
                    </label>
                  </div>

                  {/* Parameters */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Parameters (Optional)
                      </label>
                      <button
                        type="button"
                        onClick={handleAddParameter}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                      >
                        + Add Parameter
                      </button>
                    </div>
                    {parameters.map((param, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={param.key}
                          onChange={(e) => handleParameterChange(index, 'key', e.target.value)}
                          placeholder="Key"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <input
                          type="text"
                          value={param.value}
                          onChange={(e) => handleParameterChange(index, 'value', e.target.value)}
                          placeholder="Value"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveParameter(index)}
                          className="px-3 py-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Mount Options */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Mount Options (Optional)
                      </label>
                      <button
                        type="button"
                        onClick={handleAddMountOption}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                      >
                        + Add Option
                      </button>
                    </div>
                    {mountOptions.map((option, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => handleMountOptionChange(index, e.target.value)}
                          placeholder="e.g., debug"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveMountOption(index)}
                          className="px-3 py-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Error Message */}
                  {createMutation.isError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Failed to create storage class: {(createMutation.error as any)?.response?.data?.error || (createMutation.error as Error).message}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending || !name || !provisioner}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createMutation.isPending ? 'Creating...' : 'Create Storage Class'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

