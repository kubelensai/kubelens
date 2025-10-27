import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { 
  XMarkIcon, 
  UserCircleIcon,
  EnvelopeIcon,
  KeyIcon,
  UserIcon,
  UserGroupIcon as UserGroupIconOutline,
} from '@heroicons/react/24/outline'
import MultiSelect from '@/components/shared/MultiSelect'

interface Group {
  id: number
  name: string
  description: string
  is_system: boolean
}

interface UserFormData {
  email: string
  username: string
  password: string
  full_name: string
  is_admin: boolean
  group_ids: number[]
}

interface UserFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: () => void
  formData: UserFormData
  setFormData: (data: UserFormData) => void
  allGroups: Group[]
  error: string
  setError: (error: string) => void
  isLoading: boolean
  mode: 'create' | 'edit'
}

export default function UserFormModal({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  allGroups,
  error,
  setError,
  isLoading,
  mode,
}: UserFormModalProps) {
  return (
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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
                {/* Header with gradient */}
                <div className="relative bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                      <UserCircleIcon className="h-6 w-6 text-white" />
                    </div>
                    <Dialog.Title className="text-xl font-semibold text-white">
                      {mode === 'create' ? 'Create New User' : 'Edit User'}
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-lg p-1 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-6 py-5">
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

                  <div className="space-y-5">
                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="block w-full rounded-lg border-gray-300 dark:border-gray-600 pl-10 pr-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                          placeholder="user@example.com"
                        />
                      </div>
                    </div>

                    {/* Username */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Username <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <UserIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          className="block w-full rounded-lg border-gray-300 dark:border-gray-600 pl-10 pr-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                          placeholder="username"
                        />
                      </div>
                    </div>

                    {/* Password (only for create) */}
                    {mode === 'create' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <KeyIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="block w-full rounded-lg border-gray-300 dark:border-gray-600 pl-10 pr-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                            placeholder="Minimum 8 characters"
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                          Must be at least 8 characters long
                        </p>
                      </div>
                    )}

                    {/* Full Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Full Name
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <UserCircleIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          className="block w-full rounded-lg border-gray-300 dark:border-gray-600 pl-10 pr-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                          placeholder="John Doe"
                        />
                      </div>
                    </div>

                    {/* Groups */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <UserGroupIconOutline className="h-5 w-5 text-gray-400" />
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Groups <span className="text-red-500">*</span>
                        </label>
                      </div>
                      <MultiSelect
                        label=""
                        options={allGroups.map((g: Group) => g.name)}
                        selected={allGroups
                          .filter((g: Group) => formData.group_ids.includes(g.id))
                          .map((g: Group) => g.name)}
                        onChange={(selected) => {
                          const selectedIds = allGroups
                            .filter((g: Group) => selected.includes(g.name))
                            .map((g: Group) => g.id)
                          setFormData({ ...formData, group_ids: selectedIds })
                          if (selectedIds.length > 0) {
                            setError('')
                          }
                        }}
                        placeholder="Select one or more groups"
                      />
                      <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        User must belong to at least one group. Permissions are managed through group membership.
                      </p>
                    </div>

                    {/* Admin Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                          <svg className="h-5 w-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">Administrator</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Grant full system access</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_admin}
                          onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onSubmit}
                    disabled={
                      isLoading ||
                      !formData.email ||
                      !formData.username ||
                      (mode === 'create' && !formData.password) ||
                      formData.group_ids.length === 0
                    }
                    className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                  >
                    {isLoading && (
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isLoading ? 'Saving...' : mode === 'create' ? 'Create User' : 'Update User'}
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
