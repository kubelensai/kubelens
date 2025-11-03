import { useState, useEffect, useRef, useMemo } from 'react'
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import Editor from '@monaco-editor/react'
import MultiSelect from './MultiSelect'
import { DataTable, Column } from './DataTable'
import { formatDateTime } from '@/utils/dateFormat'

interface EnhancedMultiPodLogViewerProps {
  cluster: string
  namespace: string
  pods: any[]
  container?: string
  containers?: any[]
  onContainerChange?: (container: string) => void
}

interface LogEntry {
  id: string
  podName: string
  timestamp: string
  message: string
  rawLine: string
}

export default function EnhancedMultiPodLogViewer({
  cluster,
  namespace,
  pods,
  container,
  containers = [],
  onContainerChange,
}: EnhancedMultiPodLogViewerProps) {
  const [selectedPods, setSelectedPods] = useState<string[]>([])
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [showPrevious, setShowPrevious] = useState(false)
  const [timeFilter, setTimeFilter] = useState<string>('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingEnabled, setStreamingEnabled] = useState(true) // Enable by default
  
  // New features state
  const [showTimestamps, setShowTimestamps] = useState(true) // Show timestamps by default
  const [timezone, setTimezone] = useState<string>('Local') // Default timezone
  const [exportFormat, setExportFormat] = useState<'txt' | 'json' | 'csv'>('txt')
  const [viewMode, setViewMode] = useState<'raw' | 'table'>('raw') // Default to raw view
  
  const editorRef = useRef<any>(null)
  const wsRef = useRef<WebSocket | null>(null)

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

  const timezoneOptions = [
    { value: 'UTC', label: 'UTC' },
    { value: 'Local', label: 'Local' },
    { value: 'America/New_York', label: 'New York (EST)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
  ]

  // Format timestamp based on selected timezone with explicit timezone display
  const formatTimestamp = (timestamp: string): string => {
    if (!timestamp) return timestamp
    
    try {
      const date = new Date(timestamp)
      
      if (timezone === 'Local') {
        // Use centralized formatter for local time with timezone display
        return formatDateTime(timestamp)
      } else if (timezone === 'UTC') {
        // Format UTC with explicit label
        return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
      } else {
        // Format with specific timezone and show timezone name
        return date.toLocaleString('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZoneName: 'short' // Shows timezone like "EST", "JST", etc.
        })
      }
    } catch (error) {
      return timestamp // Return original if parsing fails
    }
  }

  // Strip ANSI escape codes from text (comprehensive)
  const stripAnsiCodes = (text: string): string => {
    if (!text) return text
    // eslint-disable-next-line no-control-regex
    return text
      // Remove all ANSI escape sequences (ESC[...m format)
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      // Remove literal ANSI codes that appear as text
      .replace(/\[[0-9;]*m/g, '')
      // Remove other control characters
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
  }

  // Parse log line into structured LogEntry
  const parseLogLine = (line: string, index: number, defaultPodName?: string): LogEntry | null => {
    if (!line.trim()) return null
    
    // Format 1: [pod-name] timestamp message
    // Example: [feeds-reco-910-6d9cbbf6b4-sfrcz] 2025-10-27T02:25:38.877723355Z {"level":"warn"...}
    const matchWithPod = line.match(/^\[([^\]]+)\]\s+(\S+)\s+(.*)$/)
    
    if (matchWithPod) {
      const [, podName, timestamp, message] = matchWithPod
      return {
        id: `${index}-${Date.now()}-${Math.random()}`,
        podName: podName.trim(),
        timestamp: timestamp.trim(),
        message: message.trim(),
        rawLine: line,
      }
    }
    
    // Format 2: timestamp message (no pod name prefix)
    // Example: 2025-10-27T02:25:38.877723355Z {"level":"warn"...}
    const matchWithoutPod = line.match(/^(\d{4}-\d{2}-\d{2}T\S+)\s+(.*)$/)
    
    if (matchWithoutPod) {
      const [, timestamp, message] = matchWithoutPod
      return {
        id: `${index}-${Date.now()}-${Math.random()}`,
        podName: defaultPodName || 'unknown',
        timestamp: timestamp.trim(),
        message: message.trim(),
        rawLine: line,
      }
    }
    
    // Fallback: treat entire line as message
    return {
      id: `${index}-${Date.now()}-${Math.random()}`,
      podName: defaultPodName || 'unknown',
      timestamp: new Date().toISOString(),
      message: line,
      rawLine: line,
    }
  }

  // Convert log entries to raw text for Monaco Editor with formatted timestamps
  const logEntriesToRawText = useMemo(() => {
    if (!showTimestamps) {
      // If timestamps are hidden, just show pod name and message
      return logEntries.map(entry => {
        const match = entry.rawLine.match(/^\[([^\]]+)\]\s+\S+\s+(.*)$/)
        if (match) {
          return `[${match[1]}] ${match[2]}`
        }
        return entry.rawLine
      }).join('\n')
    }
    
    // Format timestamps in raw view with brackets
    return logEntries.map(entry => {
      const formattedTimestamp = formatTimestamp(entry.timestamp)
      return `[${entry.podName}] [${formattedTimestamp}] ${entry.message}`
    }).join('\n')
  }, [logEntries, showTimestamps, timezone, formatTimestamp])

  // Initialize with all pods selected and start streaming
  useEffect(() => {
    if (pods.length > 0 && selectedPods.length === 0) {
      setSelectedPods(pods.map(p => p.metadata.name))
    }
  }, [pods, selectedPods.length])

  // Auto-start streaming when pods are selected and streaming is enabled
  // Also restart streaming when container or timeFilter changes
  useEffect(() => {
    if (selectedPods.length > 0 && streamingEnabled) {
      // Stop existing stream if any
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      // Start new stream
      startStreaming()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPods, container, timeFilter, streamingEnabled])

  // No filtering needed - use all log entries
  const filteredLogEntries = logEntries

  const startStreaming = () => {
    if (selectedPods.length === 0) return
    
    setIsStreaming(true)
    setStreamingEnabled(true)
    
    const token = localStorage.getItem('token')
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const params = new URLSearchParams()
    
    selectedPods.forEach(pod => params.append('pods', pod))
    if (container) params.append('container', container)
    params.append('tailLines', '100')
    params.append('timestamps', showTimestamps.toString())
    
    const wsUrl = `${protocol}//${window.location.host}/api/v1/clusters/${cluster}/namespaces/${namespace}/pods/logs/stream?${params.toString()}&token=${token}`
    
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    
    ws.onopen = () => {
      console.log('WebSocket connected for log streaming')
      setLogEntries([]) // Clear logs when starting stream
    }
    
    ws.onmessage = (event) => {
      const cleanData = stripAnsiCodes(event.data)
      const lines = cleanData.split('\n').filter(line => line.trim())
      
      setLogEntries(prev => {
        const newEntries = lines.map((line, idx) => {
          // Try to extract pod name from the line, or use 'multiple' if streaming from multiple pods
          const podNameMatch = line.match(/^\[([^\]]+)\]/)
          const defaultPod = podNameMatch ? undefined : (selectedPods.length === 1 ? selectedPods[0] : 'multiple')
          return parseLogLine(line, prev.length + idx, defaultPod)
        }).filter(Boolean) as LogEntry[]
        return [...prev, ...newEntries]
      })
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setIsStreaming(false)
    }
    
    ws.onclose = () => {
      console.log('WebSocket closed')
      setIsStreaming(false)
    }
  }

  const stopStreaming = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsStreaming(false)
    setStreamingEnabled(false)
  }

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const fetchLogs = async (previous = false, since = '') => {
    if (selectedPods.length === 0) {
      setLogEntries([])
      return
    }

    setIsLoading(true)
    try {
      const token = localStorage.getItem('token')
      
      const params = new URLSearchParams()
      selectedPods.forEach(pod => params.append('pods', pod))
      
      if (container) params.append('container', container)
      params.append('tailLines', '5000')
      params.append('timestamps', showTimestamps.toString())
      
      if (previous) params.append('previous', 'true')
      
      if (since) {
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
          
          params.append('sinceTime', now.toISOString())
        }
      }
      
      const url = `/api/v1/clusters/${cluster}/namespaces/${namespace}/pods/logs?${params.toString()}`
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      const entries: LogEntry[] = []
      let index = 0
      
      data.forEach((podLog: any) => {
        if (podLog.error) {
          entries.push({
            id: `${index++}`,
            podName: podLog.podName,
            timestamp: new Date().toISOString(),
            message: `ERROR: ${podLog.error}`,
            rawLine: `[${podLog.podName}] ${new Date().toISOString()} ERROR: ${podLog.error}`,
          })
        } else if (podLog.logs) {
          const lines = podLog.logs.split('\n').filter((line: string) => line.trim())
          lines.forEach((line: string) => {
            const cleanLine = stripAnsiCodes(line)
            // Pass podLog.podName as default for lines without pod name prefix
            const entry = parseLogLine(cleanLine, index++, podLog.podName)
            if (entry) entries.push(entry)
          })
        }
      })
      
      setLogEntries(entries)
    } catch (error: any) {
      setLogEntries([{
        id: '0',
        podName: 'error',
        timestamp: new Date().toISOString(),
        message: `Error fetching logs: ${error.message || 'Unknown error'}`,
        rawLine: `Error fetching logs: ${error.message || 'Unknown error'}`,
      }])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (selectedPods.length > 0 && !streamingEnabled) {
      fetchLogs(showPrevious, timeFilter)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPods, container, showPrevious, timeFilter])

  // Auto-scroll for Monaco Editor (raw view)
  useEffect(() => {
    if (viewMode === 'raw' && autoScroll && editorRef.current && !isLoading) {
      const editor = editorRef.current
      const lineCount = editor.getModel()?.getLineCount() || 0
      editor.revealLine(lineCount)
      editor.setScrollTop(editor.getScrollHeight())
    }
  }, [logEntriesToRawText, autoScroll, isLoading, viewMode])

  // Auto-scroll for DataTable (table view)
  useEffect(() => {
    if (viewMode === 'table' && autoScroll && !isLoading && filteredLogEntries.length > 0) {
      const container = document.getElementById('log-table-container')
      if (container) {
        // Scroll to bottom
        container.scrollTop = container.scrollHeight
      }
    }
  }, [filteredLogEntries, autoScroll, isLoading, viewMode])

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

  // Define DataTable columns
  const columns = useMemo<Column<LogEntry>[]>(() => {
    const cols: Column<LogEntry>[] = [
      {
        key: 'podName',
        header: 'Pod Name',
        accessor: (entry) => (
          <span className="font-mono text-xs">{entry.podName}</span>
        ),
        sortable: true,
        sortValue: (entry) => entry.podName,
        filterable: true,
        filterOptions: (data) => [...new Set(data.map(d => d.podName))].sort(),
        className: 'font-mono text-xs',
      },
    ]

    // Only add timestamp column if timestamps are shown
    if (showTimestamps) {
      cols.push({
        key: 'timestamp',
        header: 'Timestamp',
        accessor: (entry) => (
          <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
            {formatTimestamp(entry.timestamp)}
          </span>
        ),
        sortable: true,
        sortValue: (entry) => entry.timestamp,
        className: 'font-mono text-xs text-gray-600 dark:text-gray-400',
      })
    }

    cols.push({
      key: 'message',
      header: 'Message',
      accessor: (entry) => (
        <span className="font-mono text-xs whitespace-pre-wrap break-all">
          {entry.message}
        </span>
      ),
      sortable: true,
      sortValue: (entry) => entry.message,
      className: 'font-mono text-xs whitespace-pre-wrap break-all',
    })

    return cols
  }, [showTimestamps, timezone, formatTimestamp])

  const handleDownload = () => {
    let content = ''
    let filename = `deployment-logs-${new Date().toISOString()}`
    let mimeType = 'text/plain'
    
    if (exportFormat === 'json') {
      content = JSON.stringify(logEntries, null, 2)
      filename += '.json'
      mimeType = 'application/json'
    } else if (exportFormat === 'csv') {
      content = 'Pod Name,Timestamp,Message\n' + logEntries.map(entry => 
        `"${entry.podName}","${entry.timestamp}","${entry.message.replace(/"/g, '""')}"`
      ).join('\n')
      filename += '.csv'
      mimeType = 'text/csv'
    } else {
      content = logEntriesToRawText
      filename += '.log'
    }
    
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
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
      <div className="flex flex-col gap-3">
        {/* First Row: Pod Selector, Container, and Time Filter */}
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          {/* Pod Selector */}
          <div className="flex-1">
            <MultiSelect
              options={pods.map(p => p.metadata.name)}
              selected={selectedPods}
              onChange={setSelectedPods}
              placeholder="Select pods..."
              label={`Pods (${selectedPods.length} of ${pods.length} selected)`}
            />
          </div>

          {/* Container Selector */}
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
        </div>

        {/* Second Row: Action Icons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              title="Table View"
              className={clsx(
                'px-3 py-2 text-xs font-medium transition-colors',
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
              )}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('raw')}
              title="Raw View"
              className={clsx(
                'px-3 py-2 text-xs font-medium transition-colors',
                viewMode === 'raw'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
              )}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </button>
          </div>

          {/* Streaming Toggle */}
          {isStreaming ? (
            <button
              onClick={stopStreaming}
              title="Stop Streaming"
              className="p-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              <PauseIcon className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={startStreaming}
              title="Start Real-time Streaming"
              className="p-2 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              <PlayIcon className="w-5 h-5" />
            </button>
          )}

          {/* Search (only for raw view) */}
          {viewMode === 'raw' && (
            <button
              onClick={handleSearch}
              title="Search (Ctrl+F)"
              className="p-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
            </button>
          )}

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

          {/* Export Format Selector */}
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'txt' | 'json' | 'csv')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="txt">TXT</option>
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>

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

          {/* Timestamp Toggle */}
          <button
            onClick={() => setShowTimestamps(!showTimestamps)}
            title={showTimestamps ? 'Hide Timestamps' : 'Show Timestamps'}
            className={clsx(
              'p-2 rounded-md transition-colors',
              showTimestamps
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            )}
          >
            <ClockIcon className="w-5 h-5" />
          </button>

          {/* Timezone Selector (only visible when timestamps are shown) */}
          {showTimestamps && (
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              title="Select Timezone"
            >
              {timezoneOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}

          {/* Clear Time Filter (if active) */}
          {timeFilter && (
            <button
              onClick={() => setTimeFilter('')}
              title="Clear Time Filter"
              className="p-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Bookmarks Panel */}
      {/* Log Count and Status */}
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {logEntries.length.toLocaleString()} {logEntries.length === 1 ? 'log entry' : 'log entries'}
        </span>
        {isStreaming && (
          <span className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
            <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
            Streaming...
          </span>
        )}
      </div>

      {/* Log Viewer */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-[600px] bg-white dark:bg-gray-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading logs...</p>
            </div>
          </div>
        ) : viewMode === 'table' ? (
          /* DataTable View */
          <div id="log-table-container" className="h-[600px] overflow-auto">
            <DataTable
              data={filteredLogEntries}
              columns={columns}
              keyExtractor={(entry) => entry.id}
              isLoading={isLoading}
              emptyMessage={selectedPods.length === 0 ? 'Select pods to view logs...' : 'No logs available'}
              showPagination={false}
              showSearch={false}
            />
          </div>
        ) : (
          /* Raw View (Monaco Editor) */
          <Editor
            height="600px"
            defaultLanguage="log"
            value={logEntriesToRawText}
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

