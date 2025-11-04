import { useEffect, useState } from 'react'
import { loadEnabledModules } from '@/integrations/loader'
import { moduleRegistry } from '@/integrations/registry'
import { IntegrationModule } from '@/integrations/types'
import { Cog6ToothIcon as CogIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import api from '@/services/api'

export default function IntegrationsPage() {
  const [modules, setModules] = useState<IntegrationModule[]>([])
  const [loading, setLoading] = useState(true)
  const [integrations, setIntegrations] = useState<Record<string, any>>({})

  useEffect(() => {
    async function init() {
      try {
        await loadEnabledModules()
        setModules(moduleRegistry.list())
        await loadIntegrations()
      } catch (error) {
        console.error('Failed to load modules:', error)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const loadIntegrations = async () => {
    try {
      const response = await api.get('/integrations')
      const integrationsMap: Record<string, any> = {}
      response.data.forEach((integration: any) => {
        integrationsMap[integration.type] = integration
      })
      setIntegrations(integrationsMap)
    } catch (error) {
      console.error('Failed to load integrations:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <div>
        <Breadcrumb items={[{ name: 'Integrations' }]} />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Integrations</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            Connect with cloud providers, monitoring tools, and services
          </p>
        </div>
      </div>

      {/* Modules Grid */}
      {modules.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <ModuleCard 
              key={module.name} 
              module={module} 
              integration={integrations[module.name]}
              onRefresh={loadIntegrations}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <CogIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No integrations available</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Integration modules need to be enabled during build time.
          </p>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Build with: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">docker-compose build --build-arg BUILD_TAGS="gcp aws azure"</code>
          </p>
        </div>
      )}
    </div>
  )
}

// Module Card Component
function ModuleCard({ 
  module, 
  integration,
  onRefresh 
}: { 
  module: IntegrationModule
  integration?: any
  onRefresh: () => void
}) {
  const [isToggling, setIsToggling] = useState(false)
  const isEnabled = integration?.enabled || false

  const categoryColors = {
    cloud: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    monitoring: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    alerts: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    cost: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  }

  const handleToggle = async () => {
    setIsToggling(true)
    try {
      if (!isEnabled) {
        // Enable module (no OAuth2 yet - that happens in Import Cluster modal)
        if (integration) {
          await api.patch(`/integrations/${integration.id}`, { enabled: true })
        } else {
          // Create integration entry
          await api.post('/integrations', {
            name: `${module.name}-integration`,
            type: module.name,
            config: '{}',
            enabled: true,
            auth_method: 'oauth2'
          })
        }
        await onRefresh()
      } else {
        // Disable module
        await api.patch(`/integrations/${integration.id}`, { enabled: false })
        await onRefresh()
      }
    } catch (error) {
      console.error('Failed to toggle integration:', error)
      alert('Failed to toggle integration. Please try again.')
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-transparent hover:border-blue-500/20">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          <img src={module.icon} alt={module.displayName} className="w-12 h-12 mr-4" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{module.displayName}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${categoryColors[module.category]}`}>
                {module.category}
              </span>
              {isEnabled && (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900 dark:text-green-200 rounded">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Enabled
                </span>
              )}
              {!isEnabled && (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded">
                  Disabled
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Enable/Disable Toggle */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={isToggling}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            isEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
          }`}
          title={isEnabled ? 'Disconnect' : 'Connect with OAuth2'}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{module.description}</p>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {isEnabled ? (
            <span className="text-green-600 dark:text-green-400 font-medium">● Enabled</span>
          ) : (
            <span>Toggle to enable</span>
          )}
        </div>
        {isEnabled && (
          <div className="text-xs text-gray-400">
            Configure in Import Cluster
          </div>
        )}
      </div>
    </div>
  )
}
