import { IntegrationModule } from './types'

class ModuleRegistry {
  private modules: Map<string, IntegrationModule> = new Map()

  register(module: IntegrationModule) {
    this.modules.set(module.name, module)
    console.log(`✅ Registered frontend module: ${module.name}`)
  }

  get(name: string): IntegrationModule | undefined {
    return this.modules.get(name)
  }

  list(): IntegrationModule[] {
    return Array.from(this.modules.values())
  }

  listByCategory(category: string): IntegrationModule[] {
    return this.list().filter((m) => m.category === category)
  }

  has(name: string): boolean {
    return this.modules.has(name)
  }

  clear() {
    this.modules.clear()
  }
}

export const moduleRegistry = new ModuleRegistry()

