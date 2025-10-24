import api from '@/services/api'
import { moduleRegistry } from './registry'
import { ModuleMetadataResponse } from './types'

/**
 * Dynamically loads enabled modules from the backend
 * and registers their frontend components
 */
export async function loadEnabledModules() {
  try {
    console.log('🔄 Loading enabled modules from backend...')
    
    const response = await api.get<ModuleMetadataResponse>('/modules')
    const { modules, count } = response.data

    console.log(`📦 Found ${count} enabled module(s)`)

    // For each enabled module, dynamically import its frontend component
    for (const moduleMeta of modules) {
      try {
        // Dynamic import based on module name
        const moduleExport = await import(`./${moduleMeta.name}/index.ts`)
        const module = moduleExport.default

        if (module) {
          moduleRegistry.register(module)
          console.log(`✅ Loaded module: ${moduleMeta.name}`)
        } else {
          console.warn(`⚠️  Module ${moduleMeta.name} has no default export`)
        }
      } catch (err) {
        console.warn(`⚠️  Module ${moduleMeta.name} frontend component not found:`, err)
        console.info(`   The backend module is enabled but the frontend component is missing`)
      }
    }

    console.log(`✅ Module loading complete. ${moduleRegistry.list().length} modules registered.`)
    return moduleRegistry.list()
  } catch (error) {
    console.error('❌ Failed to load modules:', error)
    throw error
  }
}

