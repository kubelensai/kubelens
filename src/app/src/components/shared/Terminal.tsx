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

    // Detect if mobile device
    const isMobile = window.innerWidth < 640
    
    console.log('🖥️ Terminal initialization:', {
      isMobile,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      containerWidth: terminalRef.current.clientWidth,
      containerHeight: terminalRef.current.clientHeight
    })
    
    // Initialize terminal with enhanced settings for Powerlevel10k/Zsh
    const term = new XTerm({
      cursorBlink: true,
      fontSize: isMobile ? 12 : 14,
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
      // Responsive settings for mobile
      rows: isMobile ? 20 : undefined,
      cols: isMobile ? 80 : undefined,
      // CRITICAL: Enable screen keyboard for mobile devices
      screenReaderMode: false, // Keep false for better performance
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
    // Skip WebGL on mobile devices as it can cause issues
    if (!isMobile) {
      try {
        const webglAddon = new WebglAddon()
        webglAddon.onContextLoss(() => {
          webglAddon.dispose()
        })
        term.loadAddon(webglAddon)
      } catch (e) {
        console.warn('WebGL addon failed to load, using canvas renderer:', e)
      }
    }

    // Fit terminal to container
    try {
      fitAddon.fit()
    } catch (e) {
      console.warn('FitAddon failed, using default size:', e)
    }

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
    
    // For mobile: ensure the internal textarea is accessible
    if (isMobile && terminalRef.current) {
      // xterm.js creates an internal textarea for input
      // We need to make sure it's properly configured for mobile
      const xtermTextarea = terminalRef.current.querySelector('textarea')
      if (xtermTextarea) {
        // Ensure it's not readonly and can receive input
        xtermTextarea.removeAttribute('readonly')
        xtermTextarea.setAttribute('autocomplete', 'off')
        xtermTextarea.setAttribute('autocorrect', 'off')
        xtermTextarea.setAttribute('autocapitalize', 'off')
        xtermTextarea.setAttribute('spellcheck', 'false')
        // Make sure it's not hidden
        xtermTextarea.style.opacity = '0'
        xtermTextarea.style.position = 'absolute'
        xtermTextarea.style.left = '0'
        xtermTextarea.style.top = '0'
        xtermTextarea.style.width = '0'
        xtermTextarea.style.height = '0'
        xtermTextarea.style.zIndex = '-10'
      }
    }

    // Connect WebSocket
    connectWebSocket(term)

    // Add click handler to ensure terminal gets focus (especially important on mobile)
    const handleTerminalClick = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      
      if (termRef.current) {
        termRef.current.focus()
        
        // On mobile, also focus the internal textarea directly
        if (isMobile && terminalRef.current) {
          const xtermTextarea = terminalRef.current.querySelector('textarea') as HTMLTextAreaElement
          if (xtermTextarea) {
            // Small delay to ensure the terminal is ready
            setTimeout(() => {
              xtermTextarea.focus()
              // Trigger click on textarea to ensure keyboard appears
              xtermTextarea.click()
            }, 50)
          }
        }
      }
    }

    if (terminalRef.current) {
      terminalRef.current.addEventListener('click', handleTerminalClick)
      terminalRef.current.addEventListener('touchstart', handleTerminalClick)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      if (terminalRef.current) {
        terminalRef.current.removeEventListener('click', handleTerminalClick as any)
        terminalRef.current.removeEventListener('touchstart', handleTerminalClick as any)
      }
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
    console.log('🔌 Starting WebSocket connection...', {
      wsUrl,
      token: token ? 'present' : 'missing'
    })
    
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
      console.log('✅ WebSocket opened successfully')
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
        
        // Ensure terminal is focused and ready for input
        setTimeout(() => {
          term.focus()
        }, 100)
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
      console.error('❌ WebSocket error:', error, {
        readyState: ws.readyState,
        url: authenticatedWsUrl.replace(/token=[^&]+/, 'token=***')
      })
      clearInterval(spinnerInterval)
      term.write('\r\x1b[K')
      term.writeln('\x1b[1;31m✗ Connection error\x1b[0m')
      term.writeln('\x1b[90mFailed to connect to shell\x1b[0m')
      term.writeln(`\x1b[90mURL: ${wsUrl}\x1b[0m`)
      setIsConnected(false)
    }

    ws.onclose = (event) => {
      console.log('🔌 WebSocket closed', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      })
      clearInterval(spinnerInterval)
      if (hasReceivedMessage) {
        term.write('\r\x1b[K')
        term.writeln('')
        term.writeln('\x1b[1;33m⚠ Connection closed\x1b[0m')
      } else {
        term.write('\r\x1b[K')
        term.writeln('\x1b[1;33m⚠ Connection closed before data received\x1b[0m')
        term.writeln(`\x1b[90mCode: ${event.code}, Reason: ${event.reason || 'No reason provided'}\x1b[0m`)
      }
      setIsConnected(false)
    }
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
            <h3 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">{title}</h3>
          </div>
          {subtitle && (
            <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400 truncate">{subtitle}</span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            aria-label="Close terminal"
          >
            <XMarkIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 dark:text-gray-400" />
          </button>
        )}
      </div>

      {/* Terminal */}
      <div className="flex-1 p-2 sm:p-4 bg-gray-900 dark:bg-gray-950 overflow-hidden">
        <div 
          ref={terminalRef} 
          className="h-full w-full cursor-text" 
          role="textbox"
          aria-label="Terminal"
          tabIndex={0}
        />
      </div>
    </div>
  )
}

