import { useState, useEffect, useRef } from 'react'
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import Editor from '@monaco-editor/react'

interface LogViewerProps {
  cluster: string
  namespace: string
  resourceType: 'pods' | 'deployments' | 'daemonsets'
  resourceName: string
  container?: string
  containers?: any[]
  onContainerChange?: (container: string) => void
}

export default function LogViewer({
  cluster,
  namespace,
  resourceType,
  resourceName,
  container,
  containers = [],
  onContainerChange,
}: LogViewerProps) {
  const [logs, setLogs] = useState<string>('Loading logs...')
  const [isLoading, setIsLoading] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const [showPrevious, setShowPrevious] = useState(false)
  const [timeFilter, setTimeFilter] = useState<string>('')
  const [lineCount, setLineCount] = useState(0)
  const editorRef = useRef<any>(null)

  const timeOptions = [
    { value: '', label: 'All' },
    { value: '1m', label: '1m' },
    { value: '5m', label: '5m' },
    { value: '30m', label: '30m' },
    { value: '1h', label: '1h' },
    { value: '2h', label: '2h' },
    { value: '5h', label: '5h' },
    { value: '8h', label: '8h' },
    { value: '1d', label: '1d' },
  ]

  const fetchLogs = async (previous = false, since = '') => {
    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      let url = `/api/v1/clusters/${cluster}/namespaces/${namespace}/${resourceType}/${resourceName}/logs?tailLines=5000`
      
      if (container) {
        url += `&container=${container}`
      }
      
      if (previous) {
        url += '&previous=true'
      }
      
      if (since) {
        // Convert relative time to sinceTime
        const now = new Date()
        const match = since.match(/^(\d+)([mhd])$/)
        
        if (match) {
          const value = parseInt(match[1])
          const unit = match[2]
          
          if (unit === 'm') {
            now.setMinutes(now.getMinutes() - value)
          } else if (unit === 'h') {
            now.setHours(now.getHours() - value)
          } else if (unit === 'd') {
            now.setDate(now.getDate() - value)
          }
          
          url += `&sinceTime=${encodeURIComponent(now.toISOString())}`
        }
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const contentType = response.headers.get('content-type')
      let logText = ''
      
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json()
        logText = data.logs || 'No logs available'
      } else {
        logText = await response.text()
      }
      
      setLogs(logText || 'No logs available')
      setLineCount(logText.split('\n').length)
    } catch (error: any) {
      setLogs(`Error fetching logs: ${error.message || 'Unknown error'}`)
      setLineCount(1)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs(showPrevious, timeFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cluster, namespace, resourceType, resourceName, container, showPrevious, timeFilter])

  useEffect(() => {
    if (autoScroll && editorRef.current && !isLoading) {
      const editor = editorRef.current
      const lineCount = editor.getModel()?.getLineCount() || 0
      editor.revealLine(lineCount)
    }
  }, [logs, autoScroll, isLoading])

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor
    
    editor.updateOptions({
      readOnly: true,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      lineNumbers: 'on',
      renderLineHighlight: 'all',
      scrollbar: {
        vertical: 'visible',
        horizontal: 'visible',
        useShadows: false,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
    })
  }

  const handleDownload = () => {
    const blob = new Blob([logs], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${resourceName}-${container || 'logs'}-${new Date().toISOString()}.log`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleSearch = () => {
    if (editorRef.current) {
      editorRef.current.trigger('', 'actions.find')
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        {/* Container Selector (if applicable) */}
        {containers.length > 0 && onContainerChange && (
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Container
            </label>
            <select
              value={container}
              onChange={(e) => onContainerChange(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              {containers.map((c: any) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Time Filter Selector */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <ClockIcon className="w-4 h-4 inline-block mr-1" />
            Time Range
          </label>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            {timeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Action Icons */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <button
            onClick={handleSearch}
            title="Search (Ctrl+F)"
            className="p-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <MagnifyingGlassIcon className="w-5 h-5" />
          </button>

          {/* Auto-scroll Toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            title={`Auto-scroll: ${autoScroll ? 'On' : 'Off'}`}
            className={clsx(
              'p-2 rounded-md transition-colors',
              autoScroll
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            )}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>

          {/* Previous Container Toggle */}
          <button
            onClick={() => {
              setShowPrevious(!showPrevious)
              setTimeFilter('')
            }}
            title={showPrevious ? 'Current Logs' : 'Previous Container'}
            className={clsx(
              'p-2 rounded-md transition-colors',
              showPrevious
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            )}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            title="Download Logs"
            className="p-2 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
          </button>

          {/* Refresh */}
          <button
            onClick={() => fetchLogs(showPrevious, timeFilter)}
            title="Refresh"
            className="p-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>

          {/* Clear Time Filter (if active) */}
          {timeFilter && (
            <button
              onClick={() => setTimeFilter('')}
              title="Clear Time Filter"
              className="p-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Line Count */}
      <div className="flex justify-end">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {lineCount.toLocaleString()} {lineCount === 1 ? 'line' : 'lines'}
        </span>
      </div>

      {/* Monaco Editor for Logs */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-[600px] bg-white dark:bg-gray-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading logs...</p>
            </div>
          </div>
        ) : (
          <Editor
            height="600px"
            defaultLanguage="log"
            value={logs}
            theme="vs-dark"
            onMount={handleEditorDidMount}
            options={{
              readOnly: true,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              lineNumbers: 'on',
              renderLineHighlight: 'all',
              fontSize: 12,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              scrollbar: {
                vertical: 'visible',
                horizontal: 'visible',
                useShadows: false,
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10,
              },
            }}
          />
        )}
      </div>
    </div>
  )
}

