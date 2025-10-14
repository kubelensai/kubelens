import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useSearch } from '@/hooks/useSearch'
import clsx from 'clsx'

interface SearchResult {
  id: string
  type: 'cluster' | 'pod' | 'deployment' | 'service' | 'node' | 'event'
  name: string
  cluster?: string
  namespace?: string
  status?: string
  description?: string
}

export default function SearchBar() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  
  // Debounce search query to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Fetch search results from API
  const { data: searchResponse, isLoading } = useSearch(debouncedQuery, isOpen && debouncedQuery.trim().length > 0)

  // Get filtered results from API response
  const filteredResults = useMemo(() => {
    return searchResponse?.results || []
  }, [searchResponse])

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {}
    filteredResults.forEach(result => {
      if (!groups[result.type]) {
        groups[result.type] = []
      }
      groups[result.type].push(result)
    })
    return groups
  }, [filteredResults])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      }

      // Escape to close
      if (e.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
      }

      // Arrow navigation
      if (isOpen && filteredResults.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex(prev => 
            prev < filteredResults.length - 1 ? prev + 1 : 0
          )
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredResults.length - 1
          )
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
          e.preventDefault()
          handleSelectResult(filteredResults[selectedIndex])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredResults, selectedIndex])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectResult = (result: SearchResult) => {
    // Navigate to appropriate page based on result type
    switch (result.type) {
      case 'cluster':
        navigate('/clusters')
        break
      case 'pod':
        navigate('/pods')
        break
      case 'deployment':
        navigate('/deployments')
        break
      case 'service':
        navigate('/services')
        break
      case 'node':
        navigate('/nodes')
        break
      case 'event':
        navigate('/events')
        break
    }
    setIsOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      cluster: '🏢',
      pod: '📦',
      deployment: '🚀',
      service: '🌐',
      node: '💻',
      event: '📢'
    }
    return icons[type] || '📄'
  }

  const getStatusColor = (status?: string) => {
    if (!status) return 'text-gray-500'
    const lower = status.toLowerCase()
    if (lower.includes('running') || lower.includes('ready') || lower.includes('active') || lower.includes('available')) {
      return 'text-green-600 dark:text-green-400'
    }
    if (lower.includes('pending') || lower.includes('waiting')) {
      return 'text-yellow-600 dark:text-yellow-400'
    }
    if (lower.includes('error') || lower.includes('failed') || lower.includes('crash')) {
      return 'text-red-600 dark:text-red-400'
    }
    return 'text-gray-600 dark:text-gray-400'
  }

  return (
    <div className="relative flex-1 max-w-xl">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
            setSelectedIndex(0)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search clusters, pods, nodes... (⌘K)"
          className={clsx(
            "block w-full pl-10 pr-10 py-2 text-sm",
            "bg-gray-50 dark:bg-gray-800/50",
            "border border-gray-200 dark:border-gray-700",
            "rounded-lg",
            "text-gray-900 dark:text-gray-100",
            "placeholder-gray-500 dark:placeholder-gray-400",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
            "transition-all duration-200"
          )}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setIsOpen(false)
            }}
            className="absolute inset-y-0 right-0 flex items-center pr-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-r-lg transition-colors"
            aria-label="Clear search"
          >
            <XMarkIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && query && (
        <div
          ref={dropdownRef}
          className={clsx(
            "absolute top-full left-0 right-0 mt-2 z-50",
            "bg-white dark:bg-[#1a1f2e]",
            "border border-gray-200 dark:border-gray-700",
            "rounded-lg shadow-xl",
            "max-h-96 overflow-y-auto",
            "animate-in fade-in-0 zoom-in-95"
          )}
        >
          {isLoading ? (
            <div className="px-4 py-8 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Searching across all clusters...
              </p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <MagnifyingGlassIcon className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No results found for "{query}"
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Try searching for clusters, pods, deployments, services, or nodes
              </p>
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(groupedResults).map(([type, results]) => (
                <div key={type}>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {type}s ({results.length})
                  </div>
                  {results.map((result, _idx) => {
                    const globalIndex = filteredResults.indexOf(result)
                    const isSelected = globalIndex === selectedIndex
                    
                    return (
                      <button
                        key={result.id}
                        onClick={() => handleSelectResult(result)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                        className={clsx(
                          "w-full px-3 py-2.5 text-left transition-colors",
                          "flex items-start gap-3",
                          isSelected
                            ? "bg-primary-50 dark:bg-primary-900/20 border-l-2 border-primary-500"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/50 border-l-2 border-transparent"
                        )}
                      >
                        <span className="text-xl flex-shrink-0 mt-0.5">{getTypeIcon(result.type)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={clsx(
                              "font-medium text-sm truncate",
                              isSelected ? "text-primary-700 dark:text-primary-300" : "text-gray-900 dark:text-gray-100"
                            )}>
                              {result.name}
                            </span>
                            {result.status && (
                              <span className={clsx(
                                "text-xs font-medium",
                                getStatusColor(result.status)
                              )}>
                                {result.status}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {result.cluster && (
                              <span>📍 {result.cluster}</span>
                            )}
                            {result.namespace && (
                              <span>• {result.namespace}</span>
                            )}
                            {result.description && (
                              <span>• {result.description}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
              
              {/* Keyboard hints */}
              <div className="px-3 py-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>↑↓ Navigate</span>
                  <span>↵ Select</span>
                  <span>ESC Close</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

