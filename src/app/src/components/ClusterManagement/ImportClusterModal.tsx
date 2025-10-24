import { Fragment, useState } from 'react'
import { Dialog, Transition, Tab } from '@headlessui/react'
import { XMarkIcon, ArrowDownTrayIcon, ExclamationTriangleIcon, DocumentTextIcon, KeyIcon, CloudIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
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

  // GCP integration state
  const [selectedGCPClusters, setSelectedGCPClusters] = useState<string[]>([])
  const [gcpProject, setGcpProject] = useState('')

  // Fetch enabled integrations
  const { data: integrations = [] } = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const response = await api.get('/integrations')
      return response.data || []
    }
  })

  // Check if GCP is enabled
  const gcpIntegration = integrations?.find((i: any) => i.type === 'gcp' && i.enabled)

  // Fetch GCP clusters if GCP integration is enabled and project is selected
  const { data: gcpClusters = [], isLoading: isLoadingGCPClusters } = useQuery({
    queryKey: ['gcp-clusters', gcpProject],
    queryFn: async () => {
      if (!gcpIntegration || !gcpProject) return []
      const response = await api.post(`/modules/gcp/clusters`, {
        project_id: gcpProject
      })
      return response.data.clusters || []
    },
    enabled: !!gcpIntegration && !!gcpIntegration.is_configured && !!gcpProject
  })

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
    // Reset GCP state
    setSelectedGCPClusters([])
    setGcpProject('')
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

  const handleGCPImport = async () => {
    setError('')

    if (selectedGCPClusters.length === 0) {
      setError('Please select at least one cluster')
      return
    }

    try {
      // Call the GCP import API
      const response = await api.post('/modules/gcp/import', {
        project_id: gcpProject,
        clusters: selectedGCPClusters
      })

      if (response.data.errors && response.data.errors.length > 0) {
        setError(`Imported ${response.data.imported}/${response.data.total} clusters. Errors: ${response.data.errors.join(', ')}`)
      } else {
        // Refresh cluster list
        queryClient.invalidateQueries({ queryKey: ['clusters'] })
        handleClose()
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to import clusters')
    }
  }

  const toggleGCPCluster = (clusterName: string) => {
    setSelectedGCPClusters(prev =>
      prev.includes(clusterName)
        ? prev.filter(n => n !== clusterName)
        : [...prev, clusterName]
    )
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
                    <Tab
                      disabled={!gcpIntegration}
                      className={({ selected }) =>
                        classNames(
                          'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors',
                          gcpIntegration
                            ? classNames(
                                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
                                selected
                                  ? 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-sm'
                                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                              )
                            : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        )
                      }
                    >
                      <CloudIcon className="h-5 w-5" />
                      From GCP
                      {!gcpIntegration && (
                        <span className="ml-1 text-xs bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                          Enable in Integrations
                        </span>
                      )}
                    </Tab>
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

                    {/* GCP Integration Panel */}
                    <Tab.Panel className="space-y-4">
                      {!gcpIntegration?.is_configured ? (
                        /* OAuth2 Setup */
                        <div className="text-center py-12">
                          <CloudIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            Connect your Google Account
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                            To import GKE clusters, you need to connect your Google account first. 
                            This will allow Kubelens to discover and import your clusters.
                          </p>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const response = await api.get(`/integrations/gcp/oauth/start`)
                                window.location.href = response.data.authorize_url
                              } catch (error) {
                                console.error('Failed to start OAuth2:', error)
                                alert('Failed to start OAuth2 flow. Please try again.')
                              }
                            }}
                            className="inline-flex items-center px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Sign in with Google
                          </button>
                        </div>
                      ) : (
                        /* GCP Cluster Import */
                        <>
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                              <strong>💡 Tip:</strong> Select clusters from your connected GCP account. 
                              We'll automatically configure the credentials for you.
                            </p>
                          </div>

                          {/* GCP Project ID */}
                          <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          GCP Project ID <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={gcpProject}
                          onChange={(e) => setGcpProject(e.target.value)}
                          placeholder="my-gcp-project"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Enter your GCP project ID to discover GKE clusters
                        </p>
                      </div>

                      {/* Clusters List */}
                      {gcpProject && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Available Clusters
                          </label>
                          {isLoadingGCPClusters ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                            </div>
                          ) : gcpClusters.length > 0 ? (
                            <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                              {gcpClusters.map((cluster: any) => (
                                <label
                                  key={cluster.name}
                                  className="flex items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedGCPClusters.includes(cluster.name)}
                                    onChange={() => toggleGCPCluster(cluster.name)}
                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                  />
                                  <div className="ml-3 flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {cluster.name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {cluster.location} • {cluster.status}
                                    </p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 border border-gray-300 dark:border-gray-600 rounded-lg">
                              <CloudIcon className="mx-auto h-12 w-12 text-gray-400" />
                              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                No clusters found in this project
                              </p>
                            </div>
                          )}
                        </div>
                      )}

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
                              onClick={handleGCPImport}
                              disabled={importMutation.isPending || selectedGCPClusters.length === 0}
                              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {importMutation.isPending ? 'Importing...' : `Import ${selectedGCPClusters.length} Cluster(s)`}
                            </button>
                          </div>
                        </>
                      )}
                    </Tab.Panel>
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
