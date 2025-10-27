import { Fragment, useEffect, useRef, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, CommandLineIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'

interface PodShellModalProps {
  isOpen: boolean
  onClose: () => void
  pod: any
  clusterName: string
}

// Predefined themes for xterm.js
const terminalThemes = {
  // Default Dark Theme (Dracula-inspired)
  dracula: {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    cursorAccent: '#282a36',
    selectionBackground: '#44475a',
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff',
  },
  // Light Theme (Solarized Light)
  solarizedLight: {
    background: '#fdf6e3',
    foreground: '#657b83',
    cursor: '#657b83',
    cursorAccent: '#fdf6e3',
    selectionBackground: '#eee8d5',
    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',
    brightBlack: '#002b36',
    brightRed: '#cb4b16',
    brightGreen: '#586e75',
    brightYellow: '#657b83',
    brightBlue: '#839496',
    brightMagenta: '#6c71c4',
    brightCyan: '#93a1a1',
    brightWhite: '#fdf6e3',
  },
  // Monokai Theme
  monokai: {
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f0',
    cursorAccent: '#272822',
    selectionBackground: '#49483e',
    black: '#272822',
    red: '#f92672',
    green: '#a6e22e',
    yellow: '#f4bf75',
    blue: '#66d9ef',
    magenta: '#ae81ff',
    cyan: '#a1efe4',
    white: '#f8f8f2',
    brightBlack: '#75715e',
    brightRed: '#f92672',
    brightGreen: '#a6e22e',
    brightYellow: '#f4bf75',
    brightBlue: '#66d9ef',
    brightMagenta: '#ae81ff',
    brightCyan: '#a1efe4',
    brightWhite: '#f9f8f5',
  },
  // One Dark Theme (VSCode default dark)
  oneDark: {
    background: '#282c34',
    foreground: '#abb2bf',
    cursor: '#528bff',
    cursorAccent: '#282c34',
    selectionBackground: '#3e4451',
    black: '#282c34',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#e5c07b',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#abb2bf',
    brightBlack: '#5c6370',
    brightRed: '#e06c75',
    brightGreen: '#98c379',
    brightYellow: '#e5c07b',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#ffffff',
  },
}

export default function PodShellModal({ isOpen, onClose, pod, clusterName }: PodShellModalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstance = useRef<Terminal | null>(null)
  const fitAddon = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const { isDark: _isDark } = useThemeStore()
  const { token } = useAuthStore()
  
  const [selectedContainer, setSelectedContainer] = useState<string>('')
  const [selectedTheme, setSelectedTheme] = useState<keyof typeof terminalThemes>('dracula')
  const [selectedShell, setSelectedShell] = useState<string>('/bin/sh')
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  
  const containers = pod?.spec?.containers || []
  
  // Available shell options
  const shellOptions = [
    { value: '/bin/sh', label: 'sh (default)' },
    { value: '/bin/bash', label: 'bash' },
    { value: '/bin/ash', label: 'ash (Alpine)' },
    { value: '/bin/zsh', label: 'zsh' },
    { value: '/bin/dash', label: 'dash' },
  ]

  // Auto-select first container on modal open
  useEffect(() => {
    if (isOpen && containers.length > 0 && !selectedContainer) {
      setSelectedContainer(containers[0].name)
    }
  }, [isOpen, containers, selectedContainer])

  // Cleanup on unmount or modal close
  useEffect(() => {
    if (!isOpen) {
      cleanup()
    }
  }, [isOpen])

  const cleanup = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (terminalInstance.current) {
      terminalInstance.current.dispose()
      terminalInstance.current = null
    }
    if (fitAddon.current) {
      fitAddon.current = null
    }
    setIsConnected(false)
    setErrorMessage('')
  }

  const connectToShell = () => {
    if (!selectedContainer || !terminalRef.current) {
      return
    }

    // Disconnect existing connection if any
    if (terminalInstance.current) {
      cleanup()
    }

    setErrorMessage('')
    setIsConnecting(true)
    setIsConnected(false)

    // Create terminal with selected theme
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Fira Code", Menlo, Monaco, "Courier New", monospace',
      theme: terminalThemes[selectedTheme],
      scrollback: 10000,
      allowTransparency: false,
    })

    // Load addons
    fitAddon.current = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    
    term.loadAddon(fitAddon.current)
    term.loadAddon(webLinksAddon)
    
    // Open terminal in DOM
    term.open(terminalRef.current)
    fitAddon.current.fit()

    terminalInstance.current = term

    // Setup input handler BEFORE WebSocket
    term.onData((data) => {
      console.log('🎹 Terminal input:', JSON.stringify(data), 'charCode:', data.charCodeAt(0))
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('📤 Sending to WebSocket:', JSON.stringify(data))
        wsRef.current.send(data)
      } else {
        console.warn('⚠️ WebSocket not ready. State:', wsRef.current?.readyState)
      }
    })
    
    console.log('✅ Terminal onData handler registered')

    // Focus terminal
    term.focus()

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    let wsUrl = `${protocol}//${window.location.host}/api/v1/clusters/${clusterName}/namespaces/${pod?.metadata?.namespace}/pods/${pod?.metadata?.name}/shell?container=${encodeURIComponent(selectedContainer)}&shell=${encodeURIComponent(selectedShell)}`
    
    // Add authentication token
    if (token) {
      wsUrl += `&token=${encodeURIComponent(token)}`
    }

    console.log('🔌 Connecting to WebSocket:', wsUrl.replace(/token=[^&]+/, 'token=***'))
    console.log('📋 Shell:', selectedShell)
    console.log('📋 Container:', selectedContainer)

    // Show loading animation in terminal
    term.writeln(`\x1b[1;34m🔌 Connecting to pod shell...\x1b[0m`)
    term.writeln(`\x1b[90mContainer: ${selectedContainer}\x1b[0m`)
    term.writeln(`\x1b[90mShell: ${selectedShell}\x1b[0m`)
    term.writeln('')
    
    // Show loading spinner
    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    let spinnerIndex = 0
    const spinnerInterval = setInterval(() => {
      term.write(`\r\x1b[36m${spinnerFrames[spinnerIndex]} Loading shell...\x1b[0m`)
      spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length
    }, 80)

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    // Track if we've received first real message (not just WebSocket open)
    let hasReceivedMessage = false

    ws.onopen = () => {
      console.log('✅ WebSocket opened')
      // Don't show "Connected successfully" yet - wait for first message
    }

    ws.onmessage = (event) => {
      const data = event.data
      console.log('📥 Received from WebSocket:', data.substring(0, 200))
      
      // Stop spinner on first message
      if (!hasReceivedMessage) {
        clearInterval(spinnerInterval)
        term.write('\r\x1b[K') // Clear spinner line
        hasReceivedMessage = true
        
        // Check if first message is an error
        if (data.includes('ERROR:') || data.includes('error:') || data.includes('╔═══')) {
          // This is an error message - show only in error banner, not in terminal
          setErrorMessage(data.replace(/\x1b\[[0-9;]*m/g, '')) // Strip ANSI codes for error banner
          setIsConnecting(false)
          setIsConnected(false)
          // Don't write error to terminal - it will be shown in error banner
          return
        } else {
          // First message is not error - connection successful
          term.writeln('\x1b[1;32m✓ Shell connected successfully!\x1b[0m')
          term.writeln('')
          setIsConnecting(false)
          setIsConnected(true)
          
          // Re-focus terminal after connection
          setTimeout(() => term.focus(), 100)
          setTimeout(() => {
            const textarea = terminalRef.current?.querySelector('textarea')
            if (textarea) textarea.focus()
          }, 150)
        }
      } else {
        // Check if subsequent message contains error
        if (data.includes('ERROR:') || data.includes('error:') || data.includes('╔═══')) {
          setErrorMessage(data.replace(/\x1b\[[0-9;]*m/g, ''))
          setIsConnecting(false)
          setIsConnected(false)
          // Don't write error to terminal - it will be shown in error banner
          return
        }
      }
      
      // Write normal output to terminal
      term.write(data)
    }

    ws.onerror = () => {
      clearInterval(spinnerInterval)
      term.write('\r\x1b[K') // Clear spinner line if still visible
      term.writeln('')
      term.writeln('\x1b[1;31m✗ WebSocket connection error\x1b[0m')
      term.writeln('')
      setErrorMessage('WebSocket connection failed. Please check the backend server.')
      setIsConnecting(false)
      setIsConnected(false)
    }

    ws.onclose = (event) => {
      clearInterval(spinnerInterval)
      if (event.code !== 1000) {
        term.writeln('')
        term.writeln('\x1b[1;33m⚠ Connection closed unexpectedly\x1b[0m')
        if (event.reason) {
          term.writeln(`\x1b[90mReason: ${event.reason}\x1b[0m`)
          setErrorMessage(event.reason)
        }
      }
      setIsConnecting(false)
      setIsConnected(false)
    }

    // Handle window resize
    const handleResize = () => {
      if (fitAddon.current) {
        fitAddon.current.fit()
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }

  const changeTheme = (themeName: keyof typeof terminalThemes) => {
    setSelectedTheme(themeName)
    if (terminalInstance.current) {
      terminalInstance.current.options.theme = terminalThemes[themeName]
    }
  }

  const handleClose = () => {
    cleanup()
    setSelectedContainer('')
    onClose()
  }

  if (!pod) return null

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog 
        as="div" 
        className="relative z-50" 
        onClose={handleClose}
        initialFocus={terminalRef}
      >
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
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <CommandLineIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Shell: {pod.metadata?.name}
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Controls - Always visible */}
                <div className="px-6 py-4 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Container Selection */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Container
                      </label>
                      <select
                        value={selectedContainer}
                        onChange={(e) => setSelectedContainer(e.target.value)}
                        disabled={isConnecting}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {containers.map((container: any) => (
                          <option key={container.name} value={container.name}>
                            {container.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Shell Selection */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Shell
                      </label>
                      <select
                        value={selectedShell}
                        onChange={(e) => setSelectedShell(e.target.value)}
                        disabled={isConnecting}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {shellOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Theme Selection */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Theme
                      </label>
                      <select
                        value={selectedTheme}
                        onChange={(e) => changeTheme(e.target.value as keyof typeof terminalThemes)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="dracula">Dracula</option>
                        <option value="oneDark">One Dark</option>
                        <option value="monokai">Monokai</option>
                        <option value="solarizedLight">Solarized Light</option>
                      </select>
                    </div>

                    {/* Connect/Reconnect Button */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        {isConnected ? 'Reconnect' : 'Connection'}
                      </label>
                      <button
                        onClick={connectToShell}
                        disabled={!selectedContainer || isConnecting}
                        className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                          isConnected 
                            ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                            : 'bg-primary-600 hover:bg-primary-700 text-white'
                        }`}
                      >
                        {isConnecting ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Connecting...
                          </span>
                        ) : isConnected ? (
                          'Reconnect'
                        ) : (
                          'Connect'
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <Transition
                    show={!!errorMessage}
                    enter="transition-all duration-300 ease-out"
                    enterFrom="opacity-0 transform -translate-y-2"
                    enterTo="opacity-100 transform translate-y-0"
                    leave="transition-all duration-200 ease-in"
                    leaveFrom="opacity-100 transform translate-y-0"
                    leaveTo="opacity-0 transform -translate-y-2"
                  >
                    <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-lg shadow-lg">
                      <div className="flex items-start gap-3">
                        <ExclamationTriangleIcon className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                            Shell Connection Error
                          </h3>
                          <pre className="text-xs text-red-700 dark:text-red-400 whitespace-pre-wrap font-mono bg-red-100 dark:bg-red-900/30 p-3 rounded border border-red-200 dark:border-red-800 overflow-x-auto max-h-64 overflow-y-auto">
{errorMessage}
                          </pre>
                        </div>
                        <button
                          onClick={() => setErrorMessage('')}
                          className="text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-colors flex-shrink-0"
                          title="Dismiss error"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </Transition>
                )}

                {/* Terminal */}
                <div className="p-4" style={{ backgroundColor: terminalThemes[selectedTheme].background }}>
                  <div 
                    ref={terminalRef} 
                    className="rounded-lg overflow-hidden cursor-text"
                    style={{ 
                      height: '500px'
                    }}
                    onClick={() => {
                      if (terminalInstance.current) {
                        terminalInstance.current.focus()
                      }
                    }}
                  />
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-gray-900 dark:text-white">{clusterName}</span>
                    {' / '}
                    <span className="font-semibold text-gray-900 dark:text-white">{pod.metadata?.namespace}</span>
                  </div>
                  <button 
                    onClick={handleClose} 
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-sm font-medium rounded-lg transition-colors"
                  >
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

