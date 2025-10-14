import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, PencilSquareIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'

interface EditClusterModalProps {
  isOpen: boolean
  onClose: () => void
  cluster: any
}

export default function EditClusterModal({ isOpen, onClose, cluster }: EditClusterModalProps) {
  const queryClient = useQueryClient()
  const [server, setServer] = useState('')
  const [ca, setCA] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (cluster) {
      setServer(cluster.server || '')
      setCA(cluster.ca || '')
      setToken(cluster.token || '')
    }
  }, [cluster])

  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; server: string; ca: string; token: string; enabled: boolean }) => {
      const response = await api.put(`/clusters/${data.name}`, {
        server: data.server,
        ca: data.ca,
        token: data.token,
        is_default: cluster.is_default,
        enabled: data.enabled
      })
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
    setServer('')
    setCA('')
    setToken('')
    setError('')
    onClose()
  }

  const handleSubmit = () => {
    setError('')

    if (!server.trim()) {
      setError('Please enter server address')
      return
    }

    if (!ca.trim()) {
      setError('Please enter certificate authority data')
      return
    }

    if (!token.trim()) {
      setError('Please enter token')
      return
    }

    // Encode CA and Token to base64 before sending
    const caBase64 = btoa(ca.trim())
    const tokenBase64 = btoa(token.trim())

    updateMutation.mutate({
      name: cluster.name,
      server: server.trim(),
      ca: caBase64,
      token: tokenBase64,
      enabled: cluster.enabled
    })
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
          <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-900 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <PencilSquareIcon className="h-6 w-6 text-primary-600" />
                    Edit Cluster: {cluster.name}
                  </Dialog.Title>
                  <button
                    type="button"
                    className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                    onClick={handleClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-lg">
                    <div className="flex items-start gap-3">
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                    </div>
                  </div>
                )}

                {/* Body */}
                <div className="px-6 py-4 space-y-4">
                  {/* Server */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Server <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={server}
                      onChange={(e) => setServer(e.target.value)}
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
                      value={ca}
                      onChange={(e) => setCA(e.target.value)}
                      placeholder="Paste certificate-authority-data (base64 encoded)"
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-xs"
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
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Paste service account token or bearer token"
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-xs"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Service account token or bearer token for authentication
                    </p>
                  </div>
                </div>

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
