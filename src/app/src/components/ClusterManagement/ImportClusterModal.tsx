import { Fragment, useState } from 'react'
import { Dialog, Transition, Tab } from '@headlessui/react'
import { XMarkIcon, ArrowDownTrayIcon, ExclamationTriangleIcon, DocumentTextIcon, KeyIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'

interface ImportClusterModalProps {
  isOpen: boolean
  onClose: () => void
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function ImportClusterModal({ isOpen, onClose }: ImportClusterModalProps) {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')

  // Token auth state
  const [tokenName, setTokenName] = useState('')
  const [tokenServer, setTokenServer] = useState('')
  const [tokenCA, setTokenCA] = useState('')
  const [tokenValue, setTokenValue] = useState('')

  // Kubeconfig auth state
  const [kubeconfigName, setKubeconfigName] = useState('')
  const [kubeconfigContent, setKubeconfigContent] = useState('')
  const [kubeconfigContext, setKubeconfigContext] = useState('')

  // [Removed GCP State and Queries]

  const importMutation = useMutation({
    mutationFn: async (data: {
      name: string
      auth_type: string
      auth_config: any
    }) => {
      const response = await api.post('/clusters', {
        name: data.name,
        auth_type: data.auth_type,
        auth_config: data.auth_config,
        is_default: false,
        enabled: true
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clusters'] })
      handleClose()
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to import cluster')
    }
  })

  const handleClose = () => {
    // Reset token state
    setTokenName('')
    setTokenServer('')
    setTokenCA('')
    setTokenValue('')
    // Reset kubeconfig state
    setKubeconfigName('')
    setKubeconfigContent('')
    setKubeconfigContext('')
    // [Removed GCP State Reset]
    setError('')
    onClose()
  }

  const handleTokenSubmit = () => {
    setError('')

    if (!tokenName.trim()) {
      setError('Please enter a cluster name')
      return
    }

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

    importMutation.mutate({
      name: tokenName.trim(),
      auth_type: 'token',
      auth_config: {
        server: tokenServer.trim(),
        ca: tokenCA.trim(),
        token: tokenValue.trim()
      }
    })
  }

  const handleKubeconfigSubmit = () => {
    setError('')

    if (!kubeconfigName.trim()) {
      setError('Please enter a cluster name')
      return
    }

    if (!kubeconfigContent.trim()) {
      setError('Please paste kubeconfig content')
      return
    }

    importMutation.mutate({
      name: kubeconfigName.trim(),
      auth_type: 'kubeconfig',
      auth_config: {
        kubeconfig: kubeconfigContent.trim(),
        context: kubeconfigContext.trim() || undefined
      }
    })
  }

// [Removed GCP Handlers]

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
                    <ArrowDownTrayIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Import Cluster
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
                <Tab.Group>
                  <Tab.List className="flex space-x-1 bg-gray-100 dark:bg-gray-800 px-6 pt-4">
                    <Tab
                      className={({ selected }) =>
                        classNames(
                          'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
                          selected
                            ? 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        )
                      }
                    >
                      <DocumentTextIcon className="h-5 w-5" />
                      Kubeconfig
                    </Tab>
                    <Tab
                      className={({ selected }) =>
                        classNames(
                          'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
                          selected
                            ? 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        )
                      }
                    >
                      <KeyIcon className="h-5 w-5" />
                      Service Account Token
                    </Tab>
                    {/* [Removed GCP Tab] */}
                  </Tab.List>

                  <Tab.Panels className="px-6 py-4">
                    {/* Kubeconfig Panel */}
                    <Tab.Panel className="space-y-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          <strong>💡 Tip:</strong> You can paste your entire kubeconfig file content here. 
                          We'll automatically extract the cluster configuration and credentials.
                        </p>
                      </div>

                      {/* Cluster Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Cluster Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={kubeconfigName}
                          onChange={(e) => setKubeconfigName(e.target.value)}
                          placeholder="e.g., production, staging, dev"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          A friendly name to identify this cluster in Kubelens
                        </p>
                      </div>

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
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-xs"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Full kubeconfig file content (YAML format)
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
                          placeholder="Leave empty to use current-context"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Specify a context name if your kubeconfig has multiple contexts
                        </p>
                      </div>

                      {/* Submit Button */}
                      <div className="flex justify-end gap-3 pt-4">
                        <button
                          type="button"
                          onClick={handleClose}
                          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleKubeconfigSubmit}
                          disabled={importMutation.isPending}
                          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {importMutation.isPending ? 'Importing...' : 'Import Cluster'}
                        </button>
                      </div>
                    </Tab.Panel>

                    {/* Service Account Token Panel */}
                    <Tab.Panel className="space-y-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          <strong>💡 Tip:</strong> Use service account tokens for programmatic access. 
                          You'll need the cluster server URL, CA certificate, and bearer token.
                        </p>
                      </div>

                  {/* Cluster Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cluster Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                          value={tokenName}
                          onChange={(e) => setTokenName(e.target.value)}
                      placeholder="e.g., production, staging, dev"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                      {/* Server URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Server URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                          value={tokenServer}
                          onChange={(e) => setTokenServer(e.target.value)}
                      placeholder="https://kubernetes.example.com:6443"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                      {/* CA Certificate */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Certificate Authority (Base64) <span className="text-red-500">*</span>
                    </label>
                    <textarea
                          value={tokenCA}
                          onChange={(e) => setTokenCA(e.target.value)}
                          placeholder="LS0tLS1CRUdJTi..."
                          rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-xs"
                    />
                  </div>

                  {/* Token */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Bearer Token <span className="text-red-500">*</span>
                    </label>
                    <textarea
                          value={tokenValue}
                          onChange={(e) => setTokenValue(e.target.value)}
                          placeholder="eyJhbGciOiJSUzI1NiIs..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-xs"
                    />
                </div>

                      {/* Submit Button */}
                      <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleClose}
                          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                          onClick={handleTokenSubmit}
                    disabled={importMutation.isPending}
                          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {importMutation.isPending ? 'Importing...' : 'Import Cluster'}
                        </button>
                      </div>
                    </Tab.Panel>

                    {/* [Removed GCP Integration Panel] */}
                  </Tab.Panels>
                </Tab.Group>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
