import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { 
  XMarkIcon, 
  UserIcon, 
  UserGroupIcon,
  ShieldCheckIcon,
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import MultiSelect from '@/components/shared/MultiSelect'

interface Permission {
  resource: string
  actions: string[]
  clusters?: string[]
  namespaces?: string[]
}

interface GroupFormData {
  name: string
  description: string
  permissions: Permission[]
}

interface User {
  id: number
  email: string
  username: string
  full_name: string
}

interface GroupFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: () => void
  formData: GroupFormData
  setFormData: (data: GroupFormData) => void
  permissionOptions: any
  error: string
  isLoading: boolean
  mode: 'create' | 'edit'
  groupId?: number
  groupName?: string
  addPermission: () => void
  updatePermission: (index: number, field: keyof Permission, value: any) => void
  removePermission: (index: number) => void
}

export default function GroupFormModal({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  permissionOptions,
  error,
  isLoading,
  mode,
  groupId,
  groupName,
  addPermission,
  updatePermission,
  removePermission,
}: GroupFormModalProps) {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [activeTab, setActiveTab] = useState<'details' | 'permissions' | 'users'>('details')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Fetch all users
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users')
      return response.data
    },
    enabled: mode === 'edit' && isOpen,
  })

  // Fetch group's current users
  const { data: groupUsersData } = useQuery({
    queryKey: ['group-users', groupId],
    queryFn: async () => {
      if (!groupId) return { users: [] }
      const response = await api.get(`/groups/${groupId}/users`)
      return response.data
    },
    enabled: mode === 'edit' && isOpen && !!groupId,
  })

  // Update selected users when group users are loaded
  useEffect(() => {
    if (groupUsersData && groupUsersData.users) {
      setSelectedUserIds(groupUsersData.users.map((u: User) => u.id))
    }
  }, [groupUsersData])

  // Add user to group mutation
  const addUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.post(`/groups/${groupId}/users`, { user_id: userId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-users', groupId] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  // Remove user from group mutation
  const removeUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.delete(`/groups/${groupId}/users/${userId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-users', groupId] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const handleToggleUser = async (userId: number) => {
    if (selectedUserIds.includes(userId)) {
      // Check if user has other groups before removing
      try {
        const response = await api.get(`/users/${userId}/groups`)
        const userGroups = response.data
        
        if (userGroups.length === 1 && userGroups[0].id === groupId) {
          alert('Cannot remove user from this group. User must have at least one group.')
          return
        }
        
        await removeUserMutation.mutateAsync(userId)
        setSelectedUserIds((prev) => prev.filter((id) => id !== userId))
      } catch (error) {
        console.error('Failed to remove user:', error)
      }
    } else {
      await addUserMutation.mutateAsync(userId)
      setSelectedUserIds((prev) => [...prev, userId])
    }
  }

  const filteredUsers = allUsers.filter((user: User) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      user.email.toLowerCase().includes(searchLower) ||
      user.username.toLowerCase().includes(searchLower) ||
      user.full_name?.toLowerCase().includes(searchLower)
    )
  })

  // Pagination calculations
  const totalUsers = filteredUsers.length
  const totalPages = Math.ceil(totalUsers / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

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
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all max-h-[90vh] flex flex-col">
                {/* Header with gradient */}
                <div className="relative bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                      <UserGroupIcon className="h-6 w-6 text-white" />
                    </div>
                    <Dialog.Title className="text-xl font-semibold text-white">
                      {mode === 'create' ? 'Create New Group' : `Edit Group: ${groupName}`}
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-lg p-1 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <nav className="flex px-6" aria-label="Tabs">
                    <button
                      onClick={() => setActiveTab('details')}
                      className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'details'
                          ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      Details
                    </button>
                    <button
                      onClick={() => setActiveTab('permissions')}
                      className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'permissions'
                          ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      Permissions
                      {formData.permissions.length > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-purple-100 bg-purple-600 rounded-full">
                          {formData.permissions.length}
                        </span>
                      )}
                    </button>
                    {mode === 'edit' && (
                      <button
                        onClick={() => setActiveTab('users')}
                        className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === 'users'
                            ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                      >
                        Users
                        {selectedUserIds.length > 0 && (
                          <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-purple-100 bg-purple-600 rounded-full">
                            {selectedUserIds.length}
                          </span>
                        )}
                      </button>
                    )}
                  </nav>
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

                  {/* Details Tab */}
                  {activeTab === 'details' && (
                    <div className="space-y-5">
                      {/* Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Group Name <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <UserGroupIcon className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="block w-full rounded-lg border-gray-300 dark:border-gray-600 pl-10 pr-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                            placeholder="e.g., Developers, Admins, Viewers"
                          />
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Description
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={4}
                          className="block w-full rounded-lg border-gray-300 dark:border-gray-600 px-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                          placeholder="Describe the purpose and scope of this group..."
                        />
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                          Help other admins understand when to assign users to this group
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Permissions Tab */}
                  {activeTab === 'permissions' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Access Permissions</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Define what resources and actions this group can access
                          </p>
                        </div>
                        <button
                          onClick={addPermission}
                          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Add Permission
                        </button>
                      </div>

                      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {formData.permissions.map((permission, index) => (
                          <div key={index} className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <ShieldCheckIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  Permission #{index + 1}
                                </span>
                              </div>
                              <button
                                onClick={() => removePermission(index)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                                Remove
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <MultiSelect
                                label="Resource *"
                                options={permissionOptions?.resources || ['*']}
                                selected={[permission.resource]}
                                onChange={(selected) => updatePermission(index, 'resource', selected[0] || '*')}
                                placeholder="Select resource"
                              />
                              <MultiSelect
                                label="Actions *"
                                options={permissionOptions?.actions || ['*', 'read', 'create', 'update', 'delete']}
                                selected={permission.actions}
                                onChange={(selected) => updatePermission(index, 'actions', selected)}
                                placeholder="Select actions"
                              />
                              <MultiSelect
                                label="Clusters"
                                options={permissionOptions?.clusters || ['*']}
                                selected={permission.clusters || ['*']}
                                onChange={(selected) => updatePermission(index, 'clusters', selected)}
                                placeholder="All clusters"
                              />
                              <MultiSelect
                                label="Namespaces"
                                options={permissionOptions?.namespaces || ['*']}
                                selected={permission.namespaces || ['*']}
                                onChange={(selected) => updatePermission(index, 'namespaces', selected)}
                                placeholder="All namespaces"
                              />
                            </div>
                          </div>
                        ))}
                        {formData.permissions.length === 0 && (
                          <div className="text-center py-12">
                            <ShieldCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No permissions</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                              Get started by adding a permission rule
                            </p>
                            <button
                              onClick={addPermission}
                              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                            >
                              <PlusIcon className="h-4 w-4" />
                              Add First Permission
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Users Tab */}
                  {activeTab === 'users' && mode === 'edit' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Group Members</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Manage which users belong to this group ({totalUsers} total)
                          </p>
                        </div>
                        {totalUsers > 0 && (
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-500 dark:text-gray-400">Show:</label>
                            <select
                              value={pageSize}
                              onChange={(e) => {
                                setPageSize(Number(e.target.value))
                                setCurrentPage(1)
                              }}
                              className="text-xs rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-purple-500 focus:border-purple-500"
                            >
                              <option value={5}>5</option>
                              <option value={10}>10</option>
                              <option value={20}>20</option>
                              <option value={50}>50</option>
                            </select>
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          placeholder="Search users by email, username, or name..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="block w-full rounded-lg border-gray-300 dark:border-gray-600 pl-10 pr-3 py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                        />
                      </div>

                      <div className="space-y-2 min-h-[400px]">
                        {filteredUsers.length === 0 ? (
                          <div className="text-center py-12">
                            <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No users found</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                              {searchTerm ? 'Try adjusting your search' : 'No users available'}
                            </p>
                          </div>
                        ) : (
                          paginatedUsers.map((user: User) => (
                            <label
                              key={user.id}
                              className={`flex items-center p-4 rounded-lg border cursor-pointer transition-all ${
                                selectedUserIds.includes(user.id)
                                  ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 shadow-sm'
                                  : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(user.id)}
                                onChange={() => handleToggleUser(user.id)}
                                disabled={addUserMutation.isPending || removeUserMutation.isPending}
                                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                              />
                              <div className="ml-3 flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                                    <UserIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white block">
                                      {user.email}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {user.username} {user.full_name && `• ${user.full_name}`}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </label>
                          ))
                        )}
                      </div>

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Showing {startIndex + 1} to {Math.min(endIndex, totalUsers)} of {totalUsers} users
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                              className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Previous
                            </button>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum
                                if (totalPages <= 5) {
                                  pageNum = i + 1
                                } else if (currentPage <= 3) {
                                  pageNum = i + 1
                                } else if (currentPage >= totalPages - 2) {
                                  pageNum = totalPages - 4 + i
                                } else {
                                  pageNum = currentPage - 2 + i
                                }
                                return (
                                  <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                                      currentPage === pageNum
                                        ? 'bg-purple-600 text-white'
                                        : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                    }`}
                                  >
                                    {pageNum}
                                  </button>
                                )
                              })}
                            </div>
                            <button
                              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={currentPage === totalPages}
                              className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onSubmit}
                    disabled={isLoading || !formData.name || formData.permissions.length === 0}
                    className="px-4 py-2.5 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                  >
                    {isLoading && (
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isLoading ? 'Saving...' : mode === 'create' ? 'Create Group' : 'Update Group'}
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
