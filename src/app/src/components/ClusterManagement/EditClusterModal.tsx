import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition, Tab } from '@headlessui/react'
import { XMarkIcon, PencilSquareIcon, ExclamationTriangleIcon, KeyIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'

interface EditClusterModalProps {
  isOpen: boolean
  onClose: () => void
  cluster: any
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function EditClusterModal({ isOpen, onClose, cluster }: EditClusterModalProps) {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  
  // Token auth state
  const [tokenServer, setTokenServer] = useState('')
  const [tokenCA, setTokenCA] = useState('')
  const [tokenValue, setTokenValue] = useState('')
  
  // Kubeconfig auth state
  const [kubeconfigContent, setKubeconfigContent] = useState('')
  const [kubeconfigContext, setKubeconfigContext] = useState('')

  // Determine auth type from cluster data
  const [authType, setAuthType] = useState<'token' | 'kubeconfig'>('token')

  useEffect(() => {
    if (cluster) {
      // Determine auth type based on cluster data
      if (cluster.auth_type === 'kubeconfig' || cluster.kubeconfig) {
        setAuthType('kubeconfig')
        setKubeconfigContent(cluster.kubeconfig || '')
        setKubeconfigContext(cluster.context || '')
      } else {
        setAuthType('token')
        setTokenServer(cluster.server || '')
        // Decode base64 if needed
        try {
          setTokenCA(cluster.ca ? atob(cluster.ca) : '')
          setTokenValue(cluster.token ? atob(cluster.token) : '')
        } catch {
          setTokenCA(cluster.ca || '')
          setTokenValue(cluster.token || '')
        }
      }
    }
  }, [cluster])

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.put(`/clusters/${cluster.name}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      handleClose()
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to update cluster')
    }
  })

  const handleClose = () => {
    setTokenServer('')
    setTokenCA('')
    setTokenValue('')
    setKubeconfigContent('')
    setKubeconfigContext('')
    setError('')
    onClose()
  }

  const handleTokenSubmit = () => {
    setError('')

    if (!tokenServer.trim()) {
      setError('Please enter server address')
      return
    }

    if (!tokenCA.trim()) {
      setError('Please enter certificate authority data')
      return
    }

    if (!tokenValue.trim()) {
      setError('Please enter token')
      return
    }

    // Encode CA and Token to base64 before sending
    const caBase64 = btoa(tokenCA.trim())
    const tokenBase64 = btoa(tokenValue.trim())

    updateMutation.mutate({
      auth_type: 'token',
      auth_config: {
        server: tokenServer.trim(),
        ca: caBase64,
        token: tokenBase64
      },
      is_default: cluster.is_default,
      enabled: cluster.enabled
    })
  }

  const handleKubeconfigSubmit = () => {
    setError('')

    if (!kubeconfigContent.trim()) {
      setError('Please paste kubeconfig content')
      return
    }

    updateMutation.mutate({
      auth_type: 'kubeconfig',
      auth_config: {
        kubeconfig: kubeconfigContent.trim(),
        context: kubeconfigContext.trim() || undefined
      },
      is_default: cluster.is_default,
      enabled: cluster.enabled
    })
  }

  const handleSubmit = () => {
    if (authType === 'token') {
      handleTokenSubmit()
    } else {
      handleKubeconfigSubmit()
    }
  }

  if (!cluster) return null

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
          <div className="fixed inset-0 bg-black bg-opacity-25 dark:bg-opacity-50" />
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
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <PencilSquareIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Edit Cluster: {cluster.name}
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
                        <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tabs */}
                <Tab.Group selectedIndex={authType === 'token' ? 0 : 1} onChange={(index) => setAuthType(index === 0 ? 'token' : 'kubeconfig')}>
                  <Tab.List className="flex space-x-1 bg-gray-100 dark:bg-gray-800 px-6 pt-4">
                    <Tab
                      className={({ selected }) =>
                        classNames(
                          'w-full rounded-t-lg py-2.5 text-sm font-medium leading-5 transition-all',
                          'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-gray-100 dark:ring-offset-gray-800 ring-primary-500',
                          selected
                            ? 'bg-white dark:bg-gray-900 text-primary-700 dark:text-primary-400 shadow'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-white/[0.5] dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
                        )
                      }
                    >
                      <div className="flex items-center justify-center gap-2">
                        <KeyIcon className="h-5 w-5" />
                        <span>Service Account Token</span>
                      </div>
                    </Tab>
                    <Tab
                      className={({ selected }) =>
                        classNames(
                          'w-full rounded-t-lg py-2.5 text-sm font-medium leading-5 transition-all',
                          'focus:outline-none focus:ring-2 ring-offset-2 ring-offset-gray-100 dark:ring-offset-gray-800 ring-primary-500',
                          selected
                            ? 'bg-white dark:bg-gray-900 text-primary-700 dark:text-primary-400 shadow'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-white/[0.5] dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
                        )
                      }
                    >
                      <div className="flex items-center justify-center gap-2">
                        <DocumentTextIcon className="h-5 w-5" />
                        <span>Kubeconfig</span>
                      </div>
                    </Tab>
                  </Tab.List>

                  <Tab.Panels className="px-6 py-4">
                    {/* Token Auth Panel */}
                    <Tab.Panel className="space-y-4 focus:outline-none">
                      {/* Server */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Server <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={tokenServer}
                          onChange={(e) => setTokenServer(e.target.value)}
                          placeholder="https://kubernetes.example.com:6443"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Kubernetes API server address
                        </p>
                      </div>

                      {/* Certificate Authority */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Certificate Authority (CA) <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={tokenCA}
                          onChange={(e) => setTokenCA(e.target.value)}
                          placeholder="Paste certificate-authority-data (base64 encoded)"
                          rows={6}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-xs resize-none"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Base64 encoded certificate authority data
                        </p>
                      </div>

                      {/* Token */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Token <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={tokenValue}
                          onChange={(e) => setTokenValue(e.target.value)}
                          placeholder="Paste service account token or bearer token"
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-xs resize-none"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Service account token or bearer token for authentication
                        </p>
                      </div>
                    </Tab.Panel>

                    {/* Kubeconfig Auth Panel */}
                    <Tab.Panel className="space-y-4 focus:outline-none">
                      {/* Kubeconfig Content */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Kubeconfig Content <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={kubeconfigContent}
                          onChange={(e) => setKubeconfigContent(e.target.value)}
                          placeholder="Paste your kubeconfig YAML content here..."
                          rows={12}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-xs resize-none"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Paste the complete kubeconfig file content (YAML format)
                        </p>
                      </div>

                      {/* Context (Optional) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Context <span className="text-gray-400 text-xs">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={kubeconfigContext}
                          onChange={(e) => setKubeconfigContext(e.target.value)}
                          placeholder="Leave empty to use default context"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Specify a context name if your kubeconfig has multiple contexts
                        </p>
                      </div>
                    </Tab.Panel>
                  </Tab.Panels>
                </Tab.Group>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Updating...
                      </>
                    ) : (
                      <>
                        <PencilSquareIcon className="h-4 w-4" />
                        Update Cluster
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
