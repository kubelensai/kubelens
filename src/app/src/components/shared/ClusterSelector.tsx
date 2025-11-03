import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { CheckIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useClusters } from '@/hooks/useClusters'
import { useClusterStore } from '@/stores/clusterStore'

export default function ClusterSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { cluster: clusterParam } = useParams()
  
  // Only show enabled clusters in selector
  const { data: clusters, isLoading } = useClusters(true)
  const { selectedCluster, setSelectedCluster } = useClusterStore()

  // Auto-select first enabled cluster if none selected
  useEffect(() => {
    if (!isLoading && clusters && clusters.length > 0) {
      if (!clusterParam && !selectedCluster) {
        const firstCluster = clusters[0]
        setSelectedCluster(firstCluster.name)
      }
    }
  }, [isLoading, clusters, clusterParam, selectedCluster, setSelectedCluster])

  // Sync URL param with store
  useEffect(() => {
    if (clusterParam && clusterParam !== selectedCluster) {
      setSelectedCluster(clusterParam)
    }
  }, [clusterParam, selectedCluster, setSelectedCluster])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
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
        !(event.target as HTMLElement).closest('.cluster-dropdown-toggle')
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

  const handleSelectCluster = (clusterName: string) => {
    setSelectedCluster(clusterName)
    setIsOpen(false)
    setSearchQuery('')

    // Capacitor-safe navigation (isNativePlatform check done internally)
    const path = location.pathname
    const pathParts = path.split('/')
    
    // Check if we're on a page that needs special handling
    const isClusterManagementPage = path === '/clusters' || path === '/clusters/'
    const isDashboardPage = path === '/' || path === '/dashboard' || path === '/dashboard/'
    const isUsersPage = path.includes('/users')
    const isGroupsPage = path.includes('/groups')
    const isIntegrationsPage = path.includes('/integrations')
    
    // If on non-resource pages (dashboard, clusters, users, groups, integrations), go to dashboard
    if (isDashboardPage || isClusterManagementPage || isUsersPage || isGroupsPage || isIntegrationsPage) {
      navigate('/')
      return
    }
    
    // If on a cluster resource page (pods, deployments, etc.), update the cluster in URL
    if (pathParts.includes('clusters') && pathParts.length >= 3) {
      const resourceIndex = pathParts.findIndex((part, idx) => 
        part === 'clusters' && idx + 2 < pathParts.length
      )
      
      if (resourceIndex !== -1) {
        pathParts[resourceIndex + 1] = clusterName
        const newPath = pathParts.join('/')
        navigate(newPath)
        return
      }
    }
    
    // Default: go to dashboard
    navigate('/')
  }

  const filteredClusters = (clusters || []).filter((cluster: { name: string }) =>
    cluster.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Get connection status for selected cluster
  const selectedClusterData = (clusters || []).find((c: { name: string }) => c.name === selectedCluster)
  const isConnected = selectedClusterData?.status === 'connected'

  const displayName = selectedCluster || 'Select Cluster'

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
        <span>Loading...</span>
      </div>
    )
  }

  if (!clusters || clusters.length === 0) {
    return null
  }

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="cluster-dropdown-toggle flex items-center gap-2 text-gray-500 transition-colors bg-white border border-gray-200 rounded-full px-3 lg:px-4 py-2 h-11 hover:text-gray-700 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        aria-label={`Selected cluster: ${displayName}`}
      >
        {/* Database/Server Icon (better than K8s hexagon for clarity) */}
        <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
          <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
        </svg>
        
        {/* Connection status indicator - show only when connected */}
        {isConnected && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-white dark:border-gray-900">
            <span className="absolute inline-flex w-full h-full bg-green-500 rounded-full opacity-75 animate-ping"></span>
          </span>
        )}
        
        {/* Text - hidden on mobile, visible on desktop */}
        <span className="hidden lg:inline truncate max-w-[150px]">{displayName}</span>
        
        {/* Chevron - always visible on desktop */}
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

      {/* Always show dropdown for all clusters (even if only 1) */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 z-40 mt-2 flex h-auto max-h-[400px] w-[280px] sm:w-[320px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-gray-900"
        >
          {/* Header with search */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
            <h5 className="text-base font-semibold text-gray-800 dark:text-gray-200">
              Select Cluster
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
              placeholder="Search clusters..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:border-primary-600"
            />
          </div>

          {/* Cluster list */}
          <ul className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
            {filteredClusters.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No clusters found
              </li>
            ) : (
              filteredClusters.map((cluster: { name: string; status?: string }) => {
                const isSelected = selectedCluster === cluster.name
                return (
                  <li key={cluster.name}>
                    <button
                      onClick={() => handleSelectCluster(cluster.name)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Database icon */}
                        <svg className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <ellipse cx="12" cy="5" rx="9" ry="3"/>
                          <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
                          <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
                        </svg>
                        
                        <div className="flex-1 min-w-0">
                          {/* Issue #3: Selected item has different text color (primary blue) */}
                          <span className={`text-sm truncate block ${
                            isSelected 
                              ? 'font-semibold text-primary-600 dark:text-primary-400' 
                              : 'font-medium text-gray-800 dark:text-white'
                          }`}>
                            {cluster.name}
                          </span>
                          {/* Issue #2: Connected status is GREEN, not gray */}
                          <span className={`text-xs truncate block ${
                            cluster.status === 'connected' 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-gray-400 dark:text-gray-500'
                          }`}>
                            {cluster.status === 'connected' ? '● Connected' : '○ Disconnected'}
                          </span>
                        </div>
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
