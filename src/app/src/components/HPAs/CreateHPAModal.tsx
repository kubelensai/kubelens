import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, AdjustmentsHorizontalIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import { getDeployments, getStatefulSets, getReplicaSets } from '@/services/api'
import { notifyResourceAction } from '@/utils/notifications'

interface CreateHPAModalProps {
  clusterName: string
  namespace: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreateHPAModal({ clusterName, namespace, isOpen, onClose, onSuccess }: CreateHPAModalProps) {
  const [hpaName, setHpaName] = useState('')
  const [targetResourceType, setTargetResourceType] = useState('Deployment')
  const [targetResourceName, setTargetResourceName] = useState('')
  const [minReplicas, setMinReplicas] = useState(1)
  const [maxReplicas, setMaxReplicas] = useState(10)
  const [cpuEnabled, setCpuEnabled] = useState(true)
  const [cpuTarget, setCpuTarget] = useState(80)
  const [memoryEnabled, setMemoryEnabled] = useState(false)
  const [memoryTarget, setMemoryTarget] = useState(80)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const targetResourceTypes = [
    { value: 'Deployment', label: 'Deployment' },
    { value: 'StatefulSet', label: 'StatefulSet' },
    { value: 'ReplicaSet', label: 'ReplicaSet' },
  ]

  // Fetch available resources based on type
  const { data: deployments } = useQuery({
    queryKey: ['deployments', clusterName, namespace],
    queryFn: () => getDeployments(clusterName, namespace),
    enabled: isOpen && targetResourceType === 'Deployment',
  })

  const { data: statefulsets } = useQuery({
    queryKey: ['statefulsets', clusterName, namespace],
    queryFn: () => getStatefulSets(clusterName, namespace),
    enabled: isOpen && targetResourceType === 'StatefulSet',
  })

  const { data: replicasets } = useQuery({
    queryKey: ['replicasets', clusterName, namespace],
    queryFn: () => getReplicaSets(clusterName, namespace),
    enabled: isOpen && targetResourceType === 'ReplicaSet',
  })

  // Get available resource names based on selected type
  const availableResources = (() => {
    if (targetResourceType === 'Deployment') {
      return deployments?.map((d: any) => d.metadata?.name).filter(Boolean) || []
    }
    if (targetResourceType === 'StatefulSet') {
      return statefulsets?.map((s: any) => s.metadata?.name).filter(Boolean) || []
    }
    if (targetResourceType === 'ReplicaSet') {
      return replicasets?.map((r: any) => r.metadata?.name).filter(Boolean) || []
    }
    return []
  })()

  // Reset target resource name when type changes
  useEffect(() => {
    setTargetResourceName('')
  }, [targetResourceType])

  const handleCreate = async () => {
    // Validation
    if (!hpaName.trim()) {
      setError('HPA name is required')
      return
    }

    if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(hpaName)) {
      setError('HPA name must be lowercase alphanumeric with hyphens')
      return
    }

    if (!targetResourceName.trim()) {
      setError('Target resource name is required')
      return
    }

    if (minReplicas < 1) {
      setError('Minimum replicas must be at least 1')
      return
    }

    if (maxReplicas < minReplicas) {
      setError('Maximum replicas must be greater than or equal to minimum replicas')
      return
    }

    if (!cpuEnabled && !memoryEnabled) {
      setError('At least one metric (CPU or Memory) must be enabled')
      return
    }

    if (cpuEnabled && (cpuTarget < 1 || cpuTarget > 100)) {
      setError('CPU target must be between 1 and 100')
      return
    }

    if (memoryEnabled && (memoryTarget < 1 || memoryTarget > 100)) {
      setError('Memory target must be between 1 and 100')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      // Build metrics array
      const metrics: any[] = []
      
      if (cpuEnabled) {
        metrics.push({
          type: 'Resource',
          resource: {
            name: 'cpu',
            target: {
              type: 'Utilization',
              averageUtilization: cpuTarget,
            },
          },
        })
      }

      if (memoryEnabled) {
        metrics.push({
          type: 'Resource',
          resource: {
            name: 'memory',
            target: {
              type: 'Utilization',
              averageUtilization: memoryTarget,
            },
          },
        })
      }

      // Prepare HPA manifest
      const hpa = {
        apiVersion: 'autoscaling/v2',
        kind: 'HorizontalPodAutoscaler',
        metadata: {
          name: hpaName,
          namespace: namespace,
        },
        spec: {
          scaleTargetRef: {
            apiVersion: 'apps/v1',
            kind: targetResourceType,
            name: targetResourceName,
          },
          minReplicas: minReplicas,
          maxReplicas: maxReplicas,
          metrics: metrics,
        },
      }

      await api.post(
        `/clusters/${clusterName}/namespaces/${namespace}/hpas`,
        hpa
      )

      notifyResourceAction.created('HPA', hpaName)
      
      // Reset form
      setHpaName('')
      setTargetResourceType('Deployment')
      setTargetResourceName('')
      setMinReplicas(1)
      setMaxReplicas(10)
      setCpuEnabled(true)
      setCpuTarget(80)
      setMemoryEnabled(false)
      setMemoryTarget(80)
      
      onSuccess()
      onClose()
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create HPA'
      setError(errorMsg)
      notifyResourceAction.failed('create', 'HPA', hpaName, errorMsg)
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    // Reset form
    setHpaName('')
    setTargetResourceType('Deployment')
    setTargetResourceName('')
    setMinReplicas(1)
    setMaxReplicas(10)
    setCpuEnabled(true)
    setCpuTarget(80)
    setMemoryEnabled(false)
    setMemoryTarget(80)
    setError('')
    onClose()
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
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <AdjustmentsHorizontalIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Create Horizontal Pod Autoscaler
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                  {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        HPA Name *
                      </label>
                      <input
                        type="text"
                        value={hpaName}
                        onChange={(e) => setHpaName(e.target.value)}
                        placeholder="my-hpa"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Lowercase alphanumeric with hyphens
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Namespace *
                      </label>
                      <input
                        type="text"
                        value={namespace}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Selected from current context
                      </p>
                    </div>
                  </div>

                  {/* Target Resource */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      Target Resource
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Resource Type *
                        </label>
                        <select
                          value={targetResourceType}
                          onChange={(e) => setTargetResourceType(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          {targetResourceTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Resource Name *
                        </label>
                        <select
                          value={targetResourceName}
                          onChange={(e) => setTargetResourceName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          <option value="">Select {targetResourceType.toLowerCase()}...</option>
                          {availableResources.map((resourceName: string) => (
                            <option key={resourceName} value={resourceName}>
                              {resourceName}
                            </option>
                          ))}
                        </select>
                        {availableResources.length === 0 && (
                          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                            No {targetResourceType.toLowerCase()}s found in this namespace
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Replica Limits */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      Replica Limits
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Minimum Replicas *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={minReplicas}
                          onChange={(e) => setMinReplicas(parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Maximum Replicas *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={maxReplicas}
                          onChange={(e) => setMaxReplicas(parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      Target Metrics
                    </h3>
                    
                    {/* CPU Metric */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={cpuEnabled}
                            onChange={(e) => setCpuEnabled(e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            CPU Utilization
                          </span>
                        </label>
                      </div>
                      {cpuEnabled && (
                        <div className="ml-6">
                          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Target Average Utilization (%)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={cpuTarget}
                            onChange={(e) => setCpuTarget(parseInt(e.target.value) || 80)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Scale when CPU usage exceeds {cpuTarget}%
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Memory Metric */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={memoryEnabled}
                            onChange={(e) => setMemoryEnabled(e.target.checked)}
                            className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Memory Utilization
                          </span>
                        </label>
                      </div>
                      {memoryEnabled && (
                        <div className="ml-6">
                          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Target Average Utilization (%)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={memoryTarget}
                            onChange={(e) => setMemoryTarget(parseInt(e.target.value) || 80)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Scale when memory usage exceeds {memoryTarget}%
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isCreating}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isCreating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <PlusIcon className="h-4 w-4" />
                        Create HPA
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

