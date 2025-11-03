import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Square3Stack3DIcon, CheckIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import { useClusterStore } from '@/stores/clusterStore'
import { useNamespaceStore } from '@/stores/namespaceStore'

// Fetch namespaces from API
const fetchNamespaces = async (cluster: string) => {
  const response = await api.get(`/clusters/${cluster}/namespaces`)
  return response.data
}

export default function NamespaceSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const selectedItemRef = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { namespace: namespaceParam } = useParams()
  
  const { selectedCluster } = useClusterStore()
  const { selectedNamespace, setSelectedNamespace } = useNamespaceStore()

  // Fetch namespaces for the selected cluster
  const { data: namespaces, isLoading } = useQuery({
    queryKey: ['namespaces', selectedCluster],
    queryFn: () => selectedCluster ? fetchNamespaces(selectedCluster) : Promise.resolve([]),
    enabled: !!selectedCluster,
  })

  // Sync URL param with store
  useEffect(() => {
    if (namespaceParam && namespaceParam !== selectedNamespace) {
      setSelectedNamespace(namespaceParam)
    }
  }, [namespaceParam, selectedNamespace, setSelectedNamespace])

  // Focus search input and scroll to selected item when dropdown opens
  useEffect(() => {
    if (isOpen) {
      if (searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 100)
      }
      // Auto-scroll to selected item
      if (selectedItemRef.current) {
        setTimeout(() => {
          selectedItemRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          })
        }, 150)
      }
    } else {
      setSearchQuery('')
    }
  }, [isOpen])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('.namespace-dropdown-toggle')
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleDropdown = () => {
    setIsOpen(!isOpen)
  }

  const handleSelectNamespace = (namespaceName: string | null) => {
    setSelectedNamespace(namespaceName)
    setIsOpen(false)
    setSearchQuery('')

    // Capacitor-safe navigation (isNativePlatform check done internally)
    // Navigate to the same resource type with new namespace
    const path = location.pathname
    const pathParts = path.split('/')
    
    if (pathParts.includes('clusters') && selectedCluster) {
      const clusterIndex = pathParts.indexOf('clusters')
      const namespaceIndex = pathParts.indexOf('namespaces')
      
      if (namespaceIndex !== -1) {
        // Has namespace in URL - update it
        if (namespaceName) {
          pathParts[namespaceIndex + 1] = namespaceName
          const newPath = pathParts.join('/')
          navigate(newPath)
        } else {
          // Remove namespace from URL (show all namespaces)
          const resourceType = pathParts[namespaceIndex + 2] || ''
          if (resourceType) {
            navigate(`/clusters/${selectedCluster}/${resourceType}`)
          } else {
            navigate(`/clusters/${selectedCluster}`)
          }
        }
      } else if (namespaceName) {
        // No namespace in URL - add it
        const resourceType = pathParts[clusterIndex + 2] || ''
        if (resourceType) {
          navigate(`/clusters/${selectedCluster}/namespaces/${namespaceName}/${resourceType}`)
        }
      }
    }
  }

  const filteredNamespaces = (namespaces || []).filter((ns: { metadata: { name: string } }) =>
    ns.metadata.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const displayName = selectedNamespace || 'All Namespaces'

  if (!selectedCluster) {
    return null
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
        <span>Loading...</span>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="namespace-dropdown-toggle flex items-center gap-2 text-gray-500 transition-colors bg-white border border-gray-200 rounded-full px-3 lg:px-4 py-2 h-11 hover:text-gray-700 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        aria-label={`Selected namespace: ${displayName}`}
      >
        <Square3Stack3DIcon className="h-5 w-5 flex-shrink-0" />
        {/* Text - hidden on mobile, visible on desktop */}
        <span className="hidden lg:inline truncate max-w-[150px]">{displayName}</span>
        <svg
          className={`hidden lg:block h-4 w-4 transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 z-40 mt-2 flex h-auto max-h-[400px] w-[280px] sm:w-[320px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-gray-900"
        >
          {/* Header with search */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
            <h5 className="text-base font-semibold text-gray-800 dark:text-gray-200">
              Select Namespace
            </h5>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Search input */}
          <div className="relative mb-3">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search namespaces..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:border-primary-600"
            />
          </div>

          {/* Namespace list */}
          <ul className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
            {/* All Namespaces option */}
            <li>
              <button
                ref={selectedNamespace === null ? selectedItemRef : null}
                onClick={() => handleSelectNamespace(null)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Square3Stack3DIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  {/* Issue #3 & #4: Selected item has different text color and smaller text size */}
                  <span className={`text-sm truncate ${
                    selectedNamespace === null 
                      ? 'font-semibold text-primary-600 dark:text-primary-400' 
                      : 'font-medium text-gray-800 dark:text-white'
                  }`}>
                    All Namespaces
                  </span>
                </div>
                {selectedNamespace === null && (
                  <CheckIcon className="h-5 w-5 text-primary-600 dark:text-primary-500 flex-shrink-0" />
                )}
              </button>
            </li>

            {filteredNamespaces.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No namespaces found
              </li>
            ) : (
              filteredNamespaces.map((ns: { metadata: { name: string } }) => {
                const isSelected = selectedNamespace === ns.metadata.name
                return (
                  <li key={ns.metadata.name}>
                    <button
                      ref={isSelected ? selectedItemRef : null}
                      onClick={() => handleSelectNamespace(ns.metadata.name)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Square3Stack3DIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                        {/* Issue #3 & #4: Selected item has different text color and smaller text size */}
                        <span className={`text-sm truncate ${
                          isSelected 
                            ? 'font-semibold text-primary-600 dark:text-primary-400' 
                            : 'font-medium text-gray-800 dark:text-white'
                        }`}>
                          {ns.metadata.name}
                        </span>
                      </div>
                      {isSelected && (
                        <CheckIcon className="h-5 w-5 text-primary-600 dark:text-primary-500 flex-shrink-0" />
                      )}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
