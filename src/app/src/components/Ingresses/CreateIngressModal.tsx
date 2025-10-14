import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, GlobeAltIcon, PlusIcon } from '@heroicons/react/24/outline'
import { createIngress } from '@/services/api'
import { notifyResourceAction } from '@/utils/notifications'
import { useQueryClient } from '@tanstack/react-query'

interface CreateIngressModalProps {
  clusterName: string
  namespace: string
  isOpen: boolean
  onClose: () => void
}

export default function CreateIngressModal({ clusterName, namespace, isOpen, onClose }: CreateIngressModalProps) {
  const queryClient = useQueryClient()
  const [ingressName, setIngressName] = useState('')
  const [ingressClassName, setIngressClassName] = useState('nginx')
  const [host, setHost] = useState('')
  const [path, setPath] = useState('/')
  const [pathType, setPathType] = useState('Prefix')
  const [serviceName, setServiceName] = useState('')
  const [servicePort, setServicePort] = useState('80')
  const [enableTLS, setEnableTLS] = useState(false)
  const [tlsSecretName, setTlsSecretName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    // Validation
    if (!ingressName.trim()) {
      setError('Ingress name is required')
      return
    }

    if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(ingressName)) {
      setError('Ingress name must be lowercase alphanumeric with hyphens')
      return
    }

    if (!host.trim()) {
      setError('Host is required')
      return
    }

    if (!serviceName.trim()) {
      setError('Service name is required')
      return
    }

    if (!servicePort.trim()) {
      setError('Service port is required')
      return
    }

    if (enableTLS && !tlsSecretName.trim()) {
      setError('TLS secret name is required when TLS is enabled')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      // Prepare ingress manifest
      const ingress: any = {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
          name: ingressName,
          namespace: namespace,
        },
        spec: {
          ingressClassName: ingressClassName,
          rules: [
            {
              host: host,
              http: {
                paths: [
                  {
                    path: path,
                    pathType: pathType,
                    backend: {
                      service: {
                        name: serviceName,
                        port: {
                          number: parseInt(servicePort),
                        },
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      }

      // Add TLS if enabled
      if (enableTLS) {
        ingress.spec.tls = [
          {
            hosts: [host],
            secretName: tlsSecretName,
          },
        ]
      }

      await createIngress(clusterName, namespace, ingress)

      notifyResourceAction.created('Ingress', ingressName)
      
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['ingresses'] })
      
      // Reset form
      handleReset()
      onClose()
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create ingress'
      setError(errorMsg)
      notifyResourceAction.failed('create', 'Ingress', ingressName, errorMsg)
    } finally {
      setIsCreating(false)
    }
  }

  const handleReset = () => {
    setIngressName('')
    setIngressClassName('nginx')
    setHost('')
    setPath('/')
    setPathType('Prefix')
    setServiceName('')
    setServicePort('80')
    setEnableTLS(false)
    setTlsSecretName('')
    setError('')
  }

  const handleClose = () => {
    handleReset()
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
                    <GlobeAltIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Create Ingress
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                  {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Ingress Name *
                      </label>
                      <input
                        type="text"
                        value={ingressName}
                        onChange={(e) => setIngressName(e.target.value)}
                        placeholder="my-ingress"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
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
                    </div>
                  </div>

                  {/* Ingress Class */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ingress Class *
                    </label>
                    <input
                      type="text"
                      value={ingressClassName}
                      onChange={(e) => setIngressClassName(e.target.value)}
                      placeholder="nginx"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Common values: nginx, traefik, alb
                    </p>
                  </div>

                  {/* Host and Path */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Host *
                      </label>
                      <input
                        type="text"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        placeholder="example.com"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Path *
                      </label>
                      <input
                        type="text"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        placeholder="/"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Path Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Path Type *
                    </label>
                    <select
                      value={pathType}
                      onChange={(e) => setPathType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="Prefix">Prefix</option>
                      <option value="Exact">Exact</option>
                      <option value="ImplementationSpecific">ImplementationSpecific</option>
                    </select>
                  </div>

                  {/* Backend Service */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Backend Service</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Service Name *
                        </label>
                        <input
                          type="text"
                          value={serviceName}
                          onChange={(e) => setServiceName(e.target.value)}
                          placeholder="my-service"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Service Port *
                        </label>
                        <input
                          type="text"
                          value={servicePort}
                          onChange={(e) => setServicePort(e.target.value)}
                          placeholder="80"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* TLS Configuration */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="checkbox"
                        id="enableTLS"
                        checked={enableTLS}
                        onChange={(e) => setEnableTLS(e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
                      />
                      <label htmlFor="enableTLS" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Enable TLS/HTTPS
                      </label>
                    </div>
                    {enableTLS && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          TLS Secret Name *
                        </label>
                        <input
                          type="text"
                          value={tlsSecretName}
                          onChange={(e) => setTlsSecretName(e.target.value)}
                          placeholder="my-tls-secret"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Secret must contain tls.crt and tls.key
                        </p>
                      </div>
                    )}
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
                        Create Ingress
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
