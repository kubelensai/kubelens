import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition, Listbox } from '@headlessui/react'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/20/solid'
import { 
  XMarkIcon, 
  Cog6ToothIcon,
  PlusIcon, 
  TrashIcon,
  PencilIcon,
  GlobeAltIcon,
  KeyIcon,
  ServerIcon,
  TagIcon,
} from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'

interface UIMetadata {
  assets_url: string
  root_id: string
}

interface Extension {
  name: string
  version: string
  description: string
  author: string
  min_server_version: string
  permissions?: string[]
  status: 'running' | 'stopped' | 'error'
  enabled: boolean
  config?: Record<string, string>
  ui?: UIMetadata
}

interface ExtensionConfigModalProps {
  extension: Extension
  isOpen: boolean
  onClose: () => void
}

// Provider config interface for multi-provider support
interface ProviderConfig {
  id: string
  type: string
  name: string
  client_id: string
  client_secret: string
  allowed_domain?: string
  allowed_org?: string
  base_url?: string
  tenant?: string
  issuer_url?: string
}

// Provider SVG Icons
const ProviderIcons = {
  github: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
    </svg>
  ),
  google: (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  ),
  gitlab: (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z" fill="#E24329"/>
    </svg>
  ),
  microsoft: (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#f25022" d="M1 1h10v10H1z"/>
      <path fill="#00a4ef" d="M1 13h10v10H1z"/>
      <path fill="#7fba00" d="M13 1h10v10H13z"/>
      <path fill="#ffb900" d="M13 13h10v10H13z"/>
    </svg>
  ),
  oidc: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  ),
}

// Provider types with their display names
const PROVIDER_TYPES = [
  { value: 'github', label: 'GitHub' },
  { value: 'google', label: 'Google' },
  { value: 'gitlab', label: 'GitLab' },
  { value: 'microsoft', label: 'Microsoft' },
  { value: 'oidc', label: 'Generic OIDC' },
]

// Helper to get provider icon component
const getProviderIcon = (type: string) => {
  return ProviderIcons[type as keyof typeof ProviderIcons] || ProviderIcons.oidc
}

// Get config schema based on extension name
const isOAuth2Extension = (extensionName: string) => extensionName === 'kubelens-oauth2'

// Parse providers from config
const parseProviders = (config: Record<string, string> | undefined): ProviderConfig[] => {
  if (!config?.providers) return []
  try {
    return JSON.parse(config.providers)
  } catch {
    return []
  }
}

// Serialize providers to config
const serializeProviders = (providers: ProviderConfig[]): Record<string, string> => {
  return { providers: JSON.stringify(providers) }
}

// Generate unique provider ID (name + random string)
const generateProviderId = (name: string) => {
  const sanitizedName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 20)
  const randomStr = Math.random().toString(36).substring(2, 8)
  return `${sanitizedName}-${randomStr}`
}

// Provider Form Modal Component
interface ProviderFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (provider: ProviderConfig) => void
  provider?: ProviderConfig
}

function ProviderFormModal({ isOpen, onClose, onSave, provider }: ProviderFormModalProps) {
  const [formData, setFormData] = useState<ProviderConfig>({
    id: '',
    type: 'github',
    name: '',
    client_id: '',
    client_secret: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (provider) {
      setFormData(provider)
    } else {
      setFormData({
        id: '',
        type: 'github',
        name: '',
        client_id: '',
        client_secret: '',
      })
    }
    setErrors({})
  }, [provider, isOpen])

  const handleTypeChange = (type: string) => {
    const providerLabel = PROVIDER_TYPES.find(p => p.value === type)?.label || type
    setFormData(prev => ({
      ...prev,
      type,
      // Auto-update display name when type changes (only if empty or was auto-generated)
      name: prev.name && !prev.name.startsWith('Login with ') ? prev.name : `Login with ${providerLabel}`,
    }))
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.type) newErrors.type = 'Provider type is required'
    if (!formData.name?.trim()) newErrors.name = 'Display name is required'
    if (!formData.client_id?.trim()) newErrors.client_id = 'Client ID is required'
    if (!formData.client_secret?.trim()) newErrors.client_secret = 'Client Secret is required'
    if (formData.type === 'oidc' && !formData.issuer_url?.trim()) {
      newErrors.issuer_url = 'Issuer URL is required for OIDC provider'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validate()) {
      // Generate ID from name if creating new provider
      const finalData = {
        ...formData,
        id: provider?.id || generateProviderId(formData.name),
      }
      onSave(finalData)
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={onClose}>
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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
                {/* Header */}
                <div className="relative bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4">
                  <Dialog.Title className="text-lg font-semibold text-white">
                    {provider ? 'Edit Provider' : 'Add Provider'}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-lg p-1 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Form */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                  {/* Provider Type - Custom Dropdown with Icons */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Provider Type <span className="text-red-500">*</span>
                    </label>
                    <Listbox value={formData.type} onChange={handleTypeChange}>
                      <div className="relative">
                        <Listbox.Button className="relative w-full cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2.5 pl-3 pr-10 text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                          <span className="flex items-center gap-3">
                            <span className="flex-shrink-0">{getProviderIcon(formData.type)}</span>
                            <span className="block truncate text-gray-900 dark:text-white">
                              {PROVIDER_TYPES.find(t => t.value === formData.type)?.label}
                            </span>
                          </span>
                          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                            <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                          </span>
                        </Listbox.Button>
                        <Transition
                          as={Fragment}
                          leave="transition ease-in duration-100"
                          leaveFrom="opacity-100"
                          leaveTo="opacity-0"
                        >
                          <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                            {PROVIDER_TYPES.map((type) => (
                              <Listbox.Option
                                key={type.value}
                                value={type.value}
                                className={({ active }) =>
                                  `relative cursor-pointer select-none py-2.5 pl-3 pr-10 ${
                                    active ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-900 dark:text-primary-100' : 'text-gray-900 dark:text-white'
                                  }`
                                }
                              >
                                {({ selected }) => (
                                  <>
                                    <span className="flex items-center gap-3">
                                      <span className="flex-shrink-0">{getProviderIcon(type.value)}</span>
                                      <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                        {type.label}
                                      </span>
                                    </span>
                                    {selected && (
                                      <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-primary-600 dark:text-primary-400">
                                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                      </span>
                                    )}
                                  </>
                                )}
                              </Listbox.Option>
                            ))}
                          </Listbox.Options>
                        </Transition>
                      </div>
                    </Listbox>
                    {errors.type && <p className="mt-1 text-sm text-red-500">{errors.type}</p>}
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Display Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <TagIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Login with GitHub"
                        className="block w-full rounded-lg border-gray-300 dark:border-gray-600 pl-10 pr-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Text shown on the login button</p>
                    {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                  </div>

                  {/* Client ID */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Client ID <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <KeyIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={formData.client_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
                        placeholder="OAuth App Client ID"
                        className="block w-full rounded-lg border-gray-300 dark:border-gray-600 pl-10 pr-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    {errors.client_id && <p className="mt-1 text-sm text-red-500">{errors.client_id}</p>}
                  </div>

                  {/* Client Secret */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Client Secret <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <KeyIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="password"
                        value={formData.client_secret}
                        onChange={(e) => setFormData(prev => ({ ...prev, client_secret: e.target.value }))}
                        placeholder="••••••••"
                        className="block w-full rounded-lg border-gray-300 dark:border-gray-600 pl-10 pr-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    {errors.client_secret && <p className="mt-1 text-sm text-red-500">{errors.client_secret}</p>}
                  </div>

                  {/* Type-specific fields */}
                  {formData.type === 'oidc' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Issuer URL <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <GlobeAltIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={formData.issuer_url || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, issuer_url: e.target.value }))}
                          placeholder="https://your-idp.com"
                          className="block w-full rounded-lg border-gray-300 dark:border-gray-600 pl-10 pr-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                      {errors.issuer_url && <p className="mt-1 text-sm text-red-500">{errors.issuer_url}</p>}
                    </div>
                  )}

                  {(formData.type === 'google' || formData.type === 'microsoft') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Allowed Domain / Tenant (Optional)
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <GlobeAltIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={formData.type === 'microsoft' ? (formData.tenant || '') : (formData.allowed_domain || '')}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            [formData.type === 'microsoft' ? 'tenant' : 'allowed_domain']: e.target.value 
                          }))}
                          placeholder={formData.type === 'microsoft' ? 'your-tenant-id' : 'company.com'}
                          className="block w-full rounded-lg border-gray-300 dark:border-gray-600 pl-10 pr-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {formData.type === 'microsoft' ? 'Azure AD tenant ID' : 'Restrict to specific domain'}
                      </p>
                    </div>
                  )}

                  {(formData.type === 'github' || formData.type === 'gitlab') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Allowed Organization (Optional)
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <ServerIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={formData.allowed_org || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, allowed_org: e.target.value }))}
                          placeholder="my-organization"
                          className="block w-full rounded-lg border-gray-300 dark:border-gray-600 pl-10 pr-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">Restrict login to organization members</p>
                    </div>
                  )}

                  {formData.type === 'gitlab' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Base URL (Optional)
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <GlobeAltIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={formData.base_url || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, base_url: e.target.value }))}
                          placeholder="https://gitlab.company.com"
                          className="block w-full rounded-lg border-gray-300 dark:border-gray-600 pl-10 pr-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">For self-hosted GitLab instances</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    {provider ? 'Update Provider' : 'Add Provider'}
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

// Provider List Component for OAuth2 Extension
interface ProviderListProps {
  providers: ProviderConfig[]
  onAdd: () => void
  onEdit: (provider: ProviderConfig) => void
  onDelete: (providerId: string) => void
}

function ProviderList({ providers, onAdd, onEdit, onDelete }: ProviderListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          Identity Providers ({providers.length})
        </h3>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Provider
        </button>
      </div>

      {providers.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/30 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <ServerIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No providers configured</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Add an identity provider to enable SSO login
          </p>
          <button
            onClick={onAdd}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Add Provider
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between p-4 bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-600">
                  {getProviderIcon(provider.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{provider.name}</span>
                    <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded capitalize">
                      {provider.type}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEdit(provider)}
                  className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                  title="Edit provider"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(provider.id)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete provider"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ExtensionConfigModal({ extension, isOpen, onClose }: ExtensionConfigModalProps) {
  const [config, setConfig] = useState<Record<string, string>>(extension.config || {})
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showProviderForm, setShowProviderForm] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | undefined>()
  
  const queryClient = useQueryClient()
  const isOAuth2 = isOAuth2Extension(extension.name)

  useEffect(() => {
    setConfig(extension.config || {})
    if (isOAuth2) {
      setProviders(parseProviders(extension.config))
    }
    setError(null)
  }, [extension, isOAuth2])

  const updateConfigMutation = useMutation({
    mutationFn: async (newConfig: Record<string, string>) => {
      await api.put(`/extensions/${extension.name}/config`, newConfig)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions'] })
      onClose()
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to update configuration')
    },
  })

  const handleSave = () => {
    setError(null)
    if (isOAuth2) {
      updateConfigMutation.mutate(serializeProviders(providers))
    } else {
      updateConfigMutation.mutate(config)
    }
  }

  const handleSchemaFieldChange = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  const handleAddCustomField = () => {
    if (!newKey.trim()) return
    setConfig(prev => ({ ...prev, [newKey]: newValue }))
    setNewKey('')
    setNewValue('')
  }

  const handleRemoveField = (key: string) => {
    setConfig(prev => {
      const newConfig = { ...prev }
      delete newConfig[key]
      return newConfig
    })
  }

  // Provider management for OAuth2
  const handleAddProvider = () => {
    setEditingProvider(undefined)
    setShowProviderForm(true)
  }

  const handleEditProvider = (provider: ProviderConfig) => {
    setEditingProvider(provider)
    setShowProviderForm(true)
  }

  const handleDeleteProvider = (providerId: string) => {
    setProviders(prev => prev.filter(p => p.id !== providerId))
  }

  const handleSaveProvider = (provider: ProviderConfig) => {
    if (editingProvider) {
      // Update existing
      setProviders(prev => prev.map(p => p.id === editingProvider.id ? provider : p))
    } else {
      // Add new
      setProviders(prev => [...prev, provider])
    }
    setShowProviderForm(false)
    setEditingProvider(undefined)
  }

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          {/* Backdrop with blur */}
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
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all max-h-[90vh] flex flex-col">
                  {/* Header with gradient */}
                  <div className="relative bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800 px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                        <Cog6ToothIcon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <Dialog.Title className="text-xl font-semibold text-white">
                          Configure {extension.name}
                        </Dialog.Title>
                        <p className="text-sm text-white/80 mt-0.5">
                          v{extension.version}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={onClose}
                      className="absolute right-4 top-4 rounded-lg p-1 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Description */}
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {extension.description}
                    </p>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    {error && (
                      <div className="mb-5 rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border-l-4 border-red-500">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-red-800 dark:text-red-400">{error}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {isOAuth2 ? (
                      // Multi-provider configuration for OAuth2
                      <ProviderList
                        providers={providers}
                        onAdd={handleAddProvider}
                        onEdit={handleEditProvider}
                        onDelete={handleDeleteProvider}
                      />
                    ) : (
                      // Generic key-value editor for other extensions
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Configuration Values</h3>
                          <div className="space-y-2">
                            {Object.entries(config).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <TagIcon className="h-5 w-5 text-gray-400" />
                                  </div>
                                  <input
                                    type="text"
                                    value={key}
                                    readOnly
                                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white"
                                  />
                                </div>
                                <div className="relative flex-1">
                                  <input
                                    type="text"
                                    value={value}
                                    onChange={(e) => handleSchemaFieldChange(key, e.target.value)}
                                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                                  />
                                </div>
                                <button
                                  onClick={() => handleRemoveField(key)}
                                  className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                  <TrashIcon className="h-5 w-5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        {/* Add new field */}
                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Add New Field</h4>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <TagIcon className="h-5 w-5 text-gray-400" />
                              </div>
                              <input
                                type="text"
                                value={newKey}
                                onChange={(e) => setNewKey(e.target.value)}
                                placeholder="Key"
                                className="block w-full rounded-lg border-gray-300 dark:border-gray-600 pl-10 pr-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                              />
                            </div>
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={newValue}
                                onChange={(e) => setNewValue(e.target.value)}
                                placeholder="Value"
                                className="block w-full rounded-lg border-gray-300 dark:border-gray-600 px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                              />
                            </div>
                            <button
                              onClick={handleAddCustomField}
                              disabled={!newKey.trim()}
                              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <PlusIcon className="h-5 w-5" />
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={updateConfigMutation.isPending}
                      className="px-4 py-2.5 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                    >
                      {updateConfigMutation.isPending && (
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {updateConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Provider Form Modal */}
      {isOAuth2 && (
        <ProviderFormModal
          isOpen={showProviderForm}
          onClose={() => {
            setShowProviderForm(false)
            setEditingProvider(undefined)
          }}
          onSave={handleSaveProvider}
          provider={editingProvider}
        />
      )}
    </>
  )
}
