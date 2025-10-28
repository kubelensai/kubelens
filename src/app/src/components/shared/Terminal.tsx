import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'
import { useThemeStore } from '@/stores/themeStore'
import { useAuthStore } from '@/stores/authStore'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface TerminalProps {
  wsUrl: string
  onClose?: () => void
  title?: string
  subtitle?: string
}

// Predefined themes for xterm.js
const terminalThemes = {
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
  light: {
    background: '#ffffff',
    foreground: '#24292e',
    cursor: '#24292e',
    cursorAccent: '#ffffff',
    selectionBackground: '#0366d625',
    black: '#24292e',
    red: '#d73a49',
    green: '#22863a',
    yellow: '#b08800',
    blue: '#0366d6',
    magenta: '#6f42c1',
    cyan: '#1b7c83',
    white: '#6a737d',
    brightBlack: '#959da5',
    brightRed: '#cb2431',
    brightGreen: '#22863a',
    brightYellow: '#b08800',
    brightBlue: '#0366d6',
    brightMagenta: '#6f42c1',
    brightCyan: '#1b7c83',
    brightWhite: '#d1d5da',
  },
}

export default function Terminal({ wsUrl, onClose, title = 'Terminal', subtitle }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const { isDark } = useThemeStore()
  const { token } = useAuthStore()
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!terminalRef.current) return

    // Initialize terminal with enhanced settings for Powerlevel10k/Zsh
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      // Use fonts that support Powerline glyphs and ligatures
      fontFamily: '"MesloLGS NF", "Cascadia Code PL", "Fira Code", "JetBrains Mono", "Courier New", monospace',
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      letterSpacing: 0,
      lineHeight: 1.0,
      theme: isDark ? terminalThemes.dracula : terminalThemes.light,
      allowProposedApi: true,
      scrollback: 10000,
      convertEol: true,
      // Enable proper rendering for Unicode characters (emojis, powerline symbols)
      allowTransparency: false,
      drawBoldTextInBrightColors: true,
      fastScrollModifier: 'shift',
      fastScrollSensitivity: 5,
      scrollSensitivity: 1,
      // Enable proper cursor rendering
      cursorStyle: 'block',
      cursorWidth: 1,
      // Improve rendering for complex characters
      windowsMode: false,
      macOptionIsMeta: true,
      // Enable proper alt key handling for Zsh
      altClickMovesCursor: true,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    const unicode11Addon = new Unicode11Addon()

    // Load addons
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.loadAddon(unicode11Addon)

    term.open(terminalRef.current)

    // Enable Unicode 11 for better emoji and powerline symbol support
    term.unicode.activeVersion = '11'

    // Try to load WebGL addon for better performance (fallback to canvas if fails)
    try {
      const webglAddon = new WebglAddon()
      webglAddon.onContextLoss(() => {
        webglAddon.dispose()
      })
      term.loadAddon(webglAddon)
    } catch (e) {
      console.warn('WebGL addon failed to load, using canvas renderer:', e)
    }

    fitAddon.fit()

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Handle terminal resize
    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    // Handle terminal input
    term.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(data)
      }
    })

    // Focus terminal
    term.focus()

    // Connect WebSocket
    connectWebSocket(term)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (wsRef.current) {
        wsRef.current.close()
      }
      term.dispose()
    }
  }, [])

  // Update theme when dark mode changes
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = isDark ? terminalThemes.dracula : terminalThemes.light
    }
  }, [isDark])

  const connectWebSocket = (term: XTerm) => {
    // Show loading animation
    term.writeln(`\x1b[1;34m🔌 Connecting to shell...\x1b[0m`)
    if (subtitle) {
      term.writeln(`\x1b[90m${subtitle}\x1b[0m`)
    }
    term.writeln('')

    // Show loading spinner
    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    let spinnerIndex = 0
    const spinnerInterval = setInterval(() => {
      term.write(`\r\x1b[36m${spinnerFrames[spinnerIndex]} Loading shell...\x1b[0m`)
      spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length
    }, 80)

    // Add token to WebSocket URL as query parameter
    const separator = wsUrl.includes('?') ? '&' : '?'
    const authenticatedWsUrl = token ? `${wsUrl}${separator}token=${encodeURIComponent(token)}` : wsUrl

    const ws = new WebSocket(authenticatedWsUrl)
    wsRef.current = ws

    let hasReceivedMessage = false

    ws.onopen = () => {
      console.log('✅ WebSocket opened')
    }

    ws.onmessage = (event) => {
      const data = event.data

      if (!hasReceivedMessage) {
        hasReceivedMessage = true
        clearInterval(spinnerInterval)
        term.write('\r\x1b[K') // Clear spinner line
        term.writeln('\x1b[1;32m✓ Connected successfully\x1b[0m')
        term.writeln('')
        setIsConnected(true)
      }

      if (typeof data === 'string') {
        term.write(data)
      } else if (data instanceof ArrayBuffer) {
        const text = new TextDecoder().decode(data)
        term.write(text)
      } else if (data instanceof Blob) {
        data.text().then((text) => {
          term.write(text)
        })
      }
    }

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error)
      clearInterval(spinnerInterval)
      term.write('\r\x1b[K')
      term.writeln('\x1b[1;31m✗ Connection error\x1b[0m')
      term.writeln('\x1b[90mFailed to connect to shell\x1b[0m')
      setIsConnected(false)
    }

    ws.onclose = () => {
      console.log('🔌 WebSocket closed')
      clearInterval(spinnerInterval)
      if (hasReceivedMessage) {
        term.write('\r\x1b[K')
        term.writeln('')
        term.writeln('\x1b[1;33m⚠ Connection closed\x1b[0m')
      }
      setIsConnected(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          </div>
          {subtitle && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        )}
      </div>

      {/* Terminal */}
      <div className="flex-1 p-4 bg-gray-900 dark:bg-gray-950">
        <div ref={terminalRef} className="h-full" />
      </div>
    </div>
  )
}

