import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useEffect } from 'react'
import api from '@/services/api'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  PowerIcon,
  KeyIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import UserFormModal from '@/components/Users/UserFormModal'
import ResetPasswordModal from '@/components/Users/ResetPasswordModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'
import { notifyResourceAction } from '@/utils/notifications'

interface User {
  id: number
  email: string
  username: string
  full_name: string
  auth_provider: 'local' | 'google'
  is_admin: boolean
  is_active: boolean
  mfa_enabled?: boolean
  last_login: string
  created_at: string
}

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

export default function Users() {
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false)
  const [isResetMFAModalOpen, setIsResetMFAModalOpen] = useState(false)
  const [isToggleActiveModalOpen, setIsToggleActiveModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    username: '',
    password: '',
    full_name: '',
    is_admin: false,
    group_ids: [],
  })
  const [error, setError] = useState<string>('')

  // Resizable columns
  const { columnWidths, handleMouseDown } = useResizableColumns({
    email: 250,
    username: 150,
    full_name: 200,
    provider: 120,
    groups: 200,
    status: 100,
    last_login: 150,
    actions: 150,
  }, 'users-column-widths')

  // Fetch users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users')
      return response.data
    },
  })

  // Fetch all groups
  const { data: allGroups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const response = await api.get('/groups')
      return response.data
    },
  })

  // Fetch user groups when editing
  const { data: userGroups = [] } = useQuery({
    queryKey: ['user-groups', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser) return []
      const response = await api.get(`/users/${selectedUser.id}/groups`)
      return response.data
    },
    enabled: isEditModalOpen && !!selectedUser,
  })

  // Fetch groups for all users
  const { data: allUserGroups = {} } = useQuery({
    queryKey: ['all-user-groups'],
    queryFn: async () => {
      const groupsMap: Record<number, Group[]> = {}
      for (const user of users) {
        try {
          const response = await api.get(`/users/${user.id}/groups`)
          groupsMap[user.id] = response.data
        } catch (error) {
          groupsMap[user.id] = []
        }
      }
      return groupsMap
    },
    enabled: users.length > 0,
  })

  // Update form data when user groups are loaded
  useEffect(() => {
    if (isEditModalOpen && userGroups.length > 0) {
      setFormData(prev => ({
        ...prev,
        group_ids: userGroups.map((g: Group) => g.id)
      }))
    }
  }, [userGroups, isEditModalOpen])

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      await api.post('/users', data)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['all-user-groups'] })
      setIsCreateModalOpen(false)
      resetForm()
      setError('')
      notifyResourceAction.created('User', data.email)
    },
    onError: (err: any) => {
      const errorMsg = err.response?.data?.error || 'Failed to create user'
      setError(errorMsg)
      notifyResourceAction.failed('create', 'User', formData.email, errorMsg)
    },
  })

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<UserFormData> }) => {
      await api.patch(`/users/${id}`, data)
      return { id, data }
    },
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user-groups'] })
      queryClient.invalidateQueries({ queryKey: ['all-user-groups'] })
      
      const userName = selectedUser?.email || data.email || 'User'
      notifyResourceAction.updated('User', userName)
      
      setIsEditModalOpen(false)
      setSelectedUser(null)
      resetForm()
      setError('')
    },
    onError: (err: any) => {
      const errorMsg = err.response?.data?.error || 'Failed to update user'
      setError(errorMsg)
      const userName = selectedUser?.email || 'User'
      notifyResourceAction.failed('update', 'User', userName, errorMsg)
    },
  })

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.delete(`/users/${userId}`)
      return userId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['all-user-groups'] })
      
      const userName = selectedUser?.email || 'User'
      notifyResourceAction.deleted('User', userName)
      
      setIsDeleteModalOpen(false)
      setSelectedUser(null)
    },
    onError: (err: any) => {
      const errorMsg = err.response?.data?.error || 'Failed to delete user'
      const userName = selectedUser?.email || 'User'
      notifyResourceAction.failed('delete', 'User', userName, errorMsg)
    },
  })

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: number; newPassword: string }) => {
      await api.post(`/users/${userId}/reset-password`, { new_password: newPassword })
    },
    onSuccess: () => {
      const userName = selectedUser?.email || 'User'
      notifyResourceAction.updated('User Password', userName)
      
      setIsResetPasswordModalOpen(false)
      setSelectedUser(null)
    },
    onError: (err: any) => {
      const errorMsg = err.response?.data?.error || 'Failed to reset password'
      const userName = selectedUser?.email || 'User'
      notifyResourceAction.failed('reset password for', 'User', userName, errorMsg)
    },
  })

  // Filtering
  const filteredUsers = useMemo(() => {
    if (!users) return []
    if (!filterText) return users
    const lowerFilter = filterText.toLowerCase()
    return users.filter((user: User) =>
      user.email.toLowerCase().includes(lowerFilter) ||
      user.username.toLowerCase().includes(lowerFilter) ||
      user.full_name?.toLowerCase().includes(lowerFilter)
    )
  }, [users, filterText])

  // Sorting
  const { sortedData, sortConfig, requestSort } = useTableSort<User>(filteredUsers, {
    key: 'created_at',
    direction: 'desc'
  })

  // Pagination
  const {
    paginatedData: paginatedUsers,
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    changePageSize,
    hasNextPage,
    hasPreviousPage,
  } = usePagination(sortedData, 10, 'users')

  const resetForm = () => {
    setFormData({
      email: '',
      username: '',
      password: '',
      full_name: '',
      is_admin: false,
      group_ids: [],
    })
    setError('')
  }

  const handleCreateUser = () => {
    if (formData.group_ids.length === 0) {
      setError('User must have at least one group')
      return
    }
    createMutation.mutate(formData)
  }

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setFormData({
      email: user.email,
      username: user.username,
      password: '',
      full_name: user.full_name,
      is_admin: user.is_admin,
      group_ids: [],
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateUser = () => {
    if (!selectedUser) return
    
    if (formData.group_ids.length === 0) {
      setError('User must have at least one group')
      return
    }

    const updateData: any = {
      email: formData.email,
      username: formData.username,
      full_name: formData.full_name,
      is_admin: formData.is_admin,
      group_ids: formData.group_ids,
    }

    updateMutation.mutate({ id: selectedUser.id, data: updateData })
  }

  const handleToggleActive = (user: User, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedUser(user)
    setIsToggleActiveModalOpen(true)
  }

  const confirmToggleActive = () => {
    if (!selectedUser) return
    const newStatus = !selectedUser.is_active
    updateMutation.mutate({
      id: selectedUser.id,
      data: { is_active: newStatus } as any,
    })
    setIsToggleActiveModalOpen(false)
    setSelectedUser(null)
  }

  const handleDelete = (user: User, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedUser(user)
    setIsDeleteModalOpen(true)
  }

  const confirmDelete = () => {
    if (!selectedUser) return
    deleteMutation.mutate(selectedUser.id)
  }

  const handleResetPassword = (user: User, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedUser(user)
    setIsResetPasswordModalOpen(true)
  }

  const handleResetMFA = (user: User, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedUser(user)
    setIsResetMFAModalOpen(true)
  }

  // MFA Reset mutation
  const resetMFAMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.post(`/users/${userId}/reset-mfa`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      notifyResourceAction.updated('User MFA', selectedUser?.email || '')
      setIsResetMFAModalOpen(false)
      setSelectedUser(null)
    },
    onError: (error: any) => {
      notifyResourceAction.failed('reset MFA for', selectedUser?.email || '', error.response?.data?.error)
    },
  })

  const confirmResetPassword = (newPassword: string) => {
    if (!selectedUser) return
    resetPasswordMutation.mutate({ userId: selectedUser.id, newPassword })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <div>
        <Breadcrumb items={[{ name: 'User Management' }]} />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">User Management</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage users, roles, and permissions
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:w-64">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-11 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-primary inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <PlusIcon className="h-5 w-5" />
            <span>Create User</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <ResizableTableHeader 
                  label="Email"
                  columnKey="email"
                  sortKey="email"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.email}
                />
                <ResizableTableHeader 
                  label="Username"
                  columnKey="username"
                  sortKey="username"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.username}
                />
                <ResizableTableHeader 
                  label="Full Name"
                  columnKey="full_name"
                  sortKey="full_name"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.full_name}
                />
                <ResizableTableHeader 
                  label="Provider"
                  columnKey="provider"
                  sortKey="auth_provider"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.provider}
                />
                <ResizableTableHeader 
                  label="Groups"
                  columnKey="groups"
                  width={columnWidths.groups}
                  onResizeStart={handleMouseDown}
                />
                <ResizableTableHeader 
                  label="Status"
                  columnKey="status"
                  sortKey="is_active"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.status}
                />
                <ResizableTableHeader 
                  label="MFA"
                  columnKey="mfa"
                  sortKey="mfa_enabled"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.mfa || 100}
                />
                <ResizableTableHeader 
                  label="Last Login"
                  columnKey="last_login"
                  sortKey="last_login"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.last_login}
                />
                <ResizableTableHeader 
                  label="Actions"
                  columnKey="actions"
                  width={columnWidths.actions}
                  onResizeStart={handleMouseDown}
                  align="right"
                />
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                      {filterText ? 'No users found matching your search.' : 'No users found.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user: User) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    {/* Email */}
                    <td className="px-6 py-4" style={{ width: columnWidths.email }}>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.email}
                      </span>
                      {user.is_admin && (
                        <span className="ml-2 inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          Admin
                        </span>
                      )}
                    </td>

                    {/* Username */}
                    <td className="px-6 py-4" style={{ width: columnWidths.username }}>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {user.username}
                      </span>
                    </td>

                    {/* Full Name */}
                    <td className="px-6 py-4" style={{ width: columnWidths.full_name }}>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {user.full_name || '-'}
                      </span>
                    </td>

                    {/* Provider */}
                    <td className="px-6 py-4" style={{ width: columnWidths.provider }}>
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                        {user.auth_provider}
                      </span>
                    </td>

                    {/* Groups */}
                    <td className="px-6 py-4" style={{ width: columnWidths.groups }}>
                      <div className="flex flex-wrap gap-1">
                        {allUserGroups[user.id]?.map((group: Group) => (
                          <span
                            key={group.id}
                            className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          >
                            {group.name}
                          </span>
                        )) || (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4" style={{ width: columnWidths.status }}>
                      {user.is_active ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800 dark:bg-red-900 dark:text-red-200">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* MFA Status */}
                    <td className="px-6 py-4" style={{ width: columnWidths.mfa || 100 }}>
                      {user.auth_provider === 'local' ? (
                        user.mfa_enabled ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">
                            <ShieldCheckIcon className="h-3 w-3" />
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                            Disabled
                          </span>
                        )
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>

                    {/* Last Login */}
                    <td className="px-6 py-4" style={{ width: columnWidths.last_login }}>
                      {user.last_login ? (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(user.last_login).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Never</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4" style={{ width: columnWidths.actions }}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                          title="Edit user"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        {/* Reset password - only for local users */}
                        {user.auth_provider === 'local' && (
                          <button
                            onClick={(e) => handleResetPassword(user, e)}
                            className="p-1.5 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Reset password"
                          >
                            <KeyIcon className="h-4 w-4" />
                          </button>
                        )}
                        {/* Reset MFA - only for local users with MFA enabled */}
                        {user.auth_provider === 'local' && user.mfa_enabled && (
                          <button
                            onClick={(e) => handleResetMFA(user, e)}
                            className="p-1.5 text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                            title="Reset MFA"
                          >
                            <ShieldCheckIcon className="h-4 w-4" />
                          </button>
                        )}
                        {/* Disable/Enable - for all users */}
                        <button
                          onClick={(e) => handleToggleActive(user, e)}
                          className={`p-1.5 ${
                            user.is_active
                              ? 'text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                              : 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20'
                          } rounded transition-colors`}
                          title={user.is_active ? 'Disable user' : 'Enable user'}
                        >
                          <PowerIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(user, e)}
                          className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Delete user"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && paginatedUsers.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={goToPage}
            onNextPage={goToNextPage}
            onPreviousPage={goToPreviousPage}
            onPageSizeChange={changePageSize}
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
          />
        )}
      </div>

      {/* Create/Edit User Modal */}
      <UserFormModal
        isOpen={isCreateModalOpen || isEditModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          setIsEditModalOpen(false)
          setSelectedUser(null)
          resetForm()
        }}
        onSubmit={isEditModalOpen ? handleUpdateUser : handleCreateUser}
        formData={formData}
        setFormData={setFormData}
        allGroups={allGroups}
        error={error}
        setError={setError}
        isLoading={createMutation.isPending || updateMutation.isPending}
        mode={isEditModalOpen ? 'edit' : 'create'}
      />

      {/* Reset Password Modal */}
      {selectedUser && (
        <ResetPasswordModal
          isOpen={isResetPasswordModalOpen}
          onClose={() => {
            setIsResetPasswordModalOpen(false)
            setSelectedUser(null)
          }}
          onConfirm={confirmResetPassword}
          userEmail={selectedUser.email}
          isLoading={resetPasswordMutation.isPending}
        />
      )}

      {/* Reset MFA Modal */}
      {selectedUser && (
        <ConfirmationModal
          isOpen={isResetMFAModalOpen}
          onClose={() => {
            setIsResetMFAModalOpen(false)
            setSelectedUser(null)
          }}
          onConfirm={() => resetMFAMutation.mutate(selectedUser.id)}
          title="Reset Multi-Factor Authentication"
          message={`Are you sure you want to reset MFA for user "${selectedUser.email}"? They will need to set up MFA again on their next login.`}
          confirmText="Reset MFA"
          isLoading={resetMFAMutation.isPending}
          type="warning"
        />
      )}

      {/* Toggle Active Confirmation */}
      {selectedUser && (
        <ConfirmationModal
          isOpen={isToggleActiveModalOpen}
          onClose={() => {
            setIsToggleActiveModalOpen(false)
            setSelectedUser(null)
          }}
          onConfirm={confirmToggleActive}
          title={selectedUser.is_active ? 'Deactivate User' : 'Activate User'}
          message={`Are you sure you want to ${selectedUser.is_active ? 'deactivate' : 'activate'} "${selectedUser.email}"?\n\n${
            selectedUser.is_active 
              ? 'The user will no longer be able to sign in.' 
              : 'The user will be able to sign in again.'
          }`}
          confirmText={selectedUser.is_active ? 'Deactivate' : 'Activate'}
          type={selectedUser.is_active ? 'warning' : 'info'}
          isLoading={updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation */}
      {selectedUser && (
        <ConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false)
            setSelectedUser(null)
          }}
          onConfirm={confirmDelete}
          title="Delete User"
          message={`Are you sure you want to delete "${selectedUser.email}"?\n\nThis action cannot be undone. All user data and permissions will be permanently removed.`}
          confirmText="Delete"
          type="danger"
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  )
}

