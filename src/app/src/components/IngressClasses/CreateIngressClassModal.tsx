import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, RectangleGroupIcon, PlusIcon } from '@heroicons/react/24/outline'
import { createIngressClass } from '@/services/api'
import { notifyResourceAction } from '@/utils/notifications'
import { useQueryClient } from '@tanstack/react-query'

interface CreateIngressClassModalProps {
  clusterName: string
  isOpen: boolean
  onClose: () => void
}

export default function CreateIngressClassModal({ clusterName, isOpen, onClose }: CreateIngressClassModalProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [controller, setController] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    // Validation
    if (!name.trim()) {
      setError('IngressClass name is required')
      return
    }

    if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)) {
      setError('IngressClass name must be lowercase alphanumeric with hyphens')
      return
    }

    if (!controller.trim()) {
      setError('Controller is required')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      // Prepare ingress class manifest
      const ingressClass: any = {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'IngressClass',
        metadata: {
          name: name,
        },
        spec: {
          controller: controller,
        },
      }

      // Add default annotation if checked
      if (isDefault) {
        ingressClass.metadata.annotations = {
          'ingressclass.kubernetes.io/is-default-class': 'true',
        }
      }

      await createIngressClass(clusterName, ingressClass)

      notifyResourceAction.created('IngressClass', name)
      
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['ingressclasses'] })
      
      // Reset form
      handleReset()
      onClose()
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create ingress class'
      setError(errorMsg)
      notifyResourceAction.failed('create', 'IngressClass', name, errorMsg)
    } finally {
      setIsCreating(false)
    }
  }

  const handleReset = () => {
    setName('')
    setController('')
    setIsDefault(false)
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <RectangleGroupIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Create IngressClass
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

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      IngressClass Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="nginx"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Lowercase alphanumeric with hyphens (cluster-scoped)
                    </p>
                  </div>

                  {/* Controller */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Controller *
                    </label>
                    <input
                      type="text"
                      value={controller}
                      onChange={(e) => setController(e.target.value)}
                      placeholder="k8s.io/ingress-nginx"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      The controller name that will handle Ingresses with this class
                    </p>
                    <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      <p className="font-medium">Common controllers:</p>
                      <p>• <code className="text-primary-600 dark:text-primary-400">k8s.io/ingress-nginx</code> - NGINX Ingress Controller</p>
                      <p>• <code className="text-primary-600 dark:text-primary-400">traefik.io/ingress-controller</code> - Traefik</p>
                      <p>• <code className="text-primary-600 dark:text-primary-400">ingress.k8s.aws/alb</code> - AWS ALB Ingress Controller</p>
                      <p>• <code className="text-primary-600 dark:text-primary-400">networking.gke.io/ingress-gce</code> - GCE Ingress Controller</p>
                    </div>
                  </div>

                  {/* Default Class */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="isDefault"
                        checked={isDefault}
                        onChange={(e) => setIsDefault(e.target.checked)}
                        className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <label htmlFor="isDefault" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                          Set as Default IngressClass
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          If enabled, Ingresses without an <code className="text-primary-600 dark:text-primary-400">ingressClassName</code> will use this class by default.
                          Only one IngressClass can be set as default in a cluster.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                      What is an IngressClass?
                    </h4>
                    <p className="text-xs text-blue-800 dark:text-blue-400">
                      IngressClass defines which controller implementation should handle Ingress resources. 
                      When you create an Ingress and specify <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">ingressClassName: nginx</code>, 
                      Kubernetes uses the corresponding IngressClass to determine which controller processes that Ingress.
                    </p>
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
                        Create IngressClass
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
