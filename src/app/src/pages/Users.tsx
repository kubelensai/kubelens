import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import api from '@/services/api'
import {
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

interface User {
  id: number
  email: string
  username: string
  full_name: string
  auth_provider: 'local' | 'google'
  is_admin: boolean
  is_active: boolean
  last_login: string
  created_at: string
}

export default function Users() {
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')

  // Resizable columns
  const { columnWidths, handleMouseDown } = useResizableColumns({
    email: 250,
    username: 150,
    full_name: 200,
    provider: 120,
    role: 100,
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

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.delete(`/users/${userId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<User> }) => {
      await api.patch(`/users/${id}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
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
  const { sortedData, sortConfig, requestSort } = useTableSort(filteredUsers, {
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

  const handleToggleActive = (user: User) => {
    const newStatus = !user.is_active
    if (confirm(`Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} this user?`)) {
      updateMutation.mutate({
        id: user.id,
        data: { is_active: newStatus },
      })
    }
  }

  const handleDelete = (user: User) => {
    if (confirm(`Are you sure you want to delete user "${user.email}"? This action cannot be undone.`)) {
      deleteMutation.mutate(user.id)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <div>
        <Breadcrumb items={[{ name: 'User Management', href: '/users' }]} />
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
                  label="Role"
                  columnKey="role"
                  sortKey="is_admin"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.role}
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
                paginatedUsers.map((user: any) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    {/* Email */}
                    <td className="px-6 py-4" style={{ width: columnWidths.email }}>
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                            <span className="text-primary-600 dark:text-primary-400 font-medium text-sm">
                              {user.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Username */}
                    <td className="px-6 py-4" style={{ width: columnWidths.username }}>
                      <span className="text-sm text-gray-900 dark:text-white">{user.username}</span>
                    </td>

                    {/* Full Name */}
                    <td className="px-6 py-4" style={{ width: columnWidths.full_name }}>
                      <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {user.full_name || '-'}
                      </span>
                    </td>

                    {/* Provider */}
                    <td className="px-6 py-4" style={{ width: columnWidths.provider }}>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          user.auth_provider === 'google'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {user.auth_provider}
                      </span>
                    </td>

                    {/* Role */}
                    <td className="px-6 py-4" style={{ width: columnWidths.role }}>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          user.is_admin
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {user.is_admin ? 'Admin' : 'User'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4" style={{ width: columnWidths.status }}>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          user.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Disabled'}
                      </span>
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleActive(user)}
                          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                        >
                          {user.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium"
                        >
                          Delete
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
    </div>
  )
}
