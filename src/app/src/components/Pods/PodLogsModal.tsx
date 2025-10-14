import { Fragment, useState, useEffect, useRef } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, DocumentTextIcon, ArrowDownIcon } from '@heroicons/react/24/outline'
import api from '@/services/api'

interface PodLogsModalProps {
  isOpen: boolean
  onClose: () => void
  pod: any
  clusterName: string
}

export default function PodLogsModal({ isOpen, onClose, pod, clusterName }: PodLogsModalProps) {
  const [logs, setLogs] = useState<string>('')
  const [selectedContainer, setSelectedContainer] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [tailLines, setTailLines] = useState<number>(100)
  const [follow, setFollow] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const containers = pod?.spec?.containers || []

  // Reset container selection when pod changes
  useEffect(() => {
    if (pod && containers.length > 0) {
      // Always reset to first container when pod changes
      setSelectedContainer(containers[0].name)
      setLogs('') // Clear previous logs
    }
  }, [pod?.metadata?.name, containers])

  // Reset when modal opens
  useEffect(() => {
    if (isOpen && containers.length > 0 && !selectedContainer) {
      setSelectedContainer(containers[0].name)
    }
  }, [isOpen, containers, selectedContainer])

  useEffect(() => {
    if (isOpen && selectedContainer) {
      fetchLogs()
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedContainer, tailLines])

  useEffect(() => {
    if (follow && selectedContainer) {
      intervalRef.current = setInterval(() => {
        fetchLogs(true)
      }, 2000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow, selectedContainer])

  const fetchLogs = async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      const response = await api.get(
        `/clusters/${clusterName}/namespaces/${pod.metadata.namespace}/pods/${pod.metadata.name}/logs`,
        {
          params: {
            container: selectedContainer,
            tailLines: tailLines,
          },
        }
      )
      setLogs(response.data.logs || 'No logs available')
      if (follow) {
        scrollToBottom()
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
      setLogs('Error fetching logs')
    } finally {
      if (!silent) setIsLoading(false)
    }
  }

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleDownload = () => {
    const blob = new Blob([logs], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pod.metadata.name}-${selectedContainer}-logs.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleClose = () => {
    // Clear state when closing
    setLogs('')
    setSelectedContainer('')
    setFollow(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    onClose()
  }

  if (!pod) return null

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
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <DocumentTextIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Logs: {pod.metadata?.name}
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-4 px-6 py-4 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Container:
                    </label>
                    <select
                      value={selectedContainer}
                      onChange={(e) => setSelectedContainer(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      {containers.map((container: any) => (
                        <option key={container.name} value={container.name}>
                          {container.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Lines:
                    </label>
                    <select
                      value={tailLines}
                      onChange={(e) => setTailLines(Number(e.target.value))}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    >
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={500}>500</option>
                      <option value={1000}>1000</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={follow}
                      onChange={(e) => setFollow(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    Auto-refresh
                  </label>

                  <button
                    onClick={() => fetchLogs()}
                    className="px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                  >
                    Refresh
                  </button>

                  <button
                    onClick={handleDownload}
                    className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    Download
                  </button>

                  <button
                    onClick={scrollToBottom}
                    className="px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-1"
                  >
                    <ArrowDownIcon className="h-4 w-4" />
                    Scroll to Bottom
                  </button>
                </div>

                {/* Logs Content */}
                <div className="p-4 bg-gray-900">
                  {isLoading ? (
                    <div className="flex justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  ) : (
                    <pre className="text-xs sm:text-sm font-mono text-gray-100 whitespace-pre-wrap overflow-auto max-h-[500px] p-4 bg-black rounded-lg">
                      {logs}
                      <div ref={logsEndRef} />
                    </pre>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {logs.split('\n').length} lines
                  </p>
                  <button onClick={onClose} className="btn-primary">
                    Close
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

