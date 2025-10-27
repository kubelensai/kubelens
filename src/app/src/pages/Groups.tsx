import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import api from '@/services/api'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import GroupFormModal from '@/components/Groups/GroupFormModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'
import { notifyResourceAction } from '@/utils/notifications'

interface Permission {
  resource: string
  actions: string[]
  clusters?: string[]
  namespaces?: string[]
}

interface Group {
  id: number
  name: string
  description: string
  is_system: boolean
  permissions: Permission[]
  created_at: string
}

interface CreateGroupFormData {
  name: string
  description: string
  permissions: Permission[]
}

export default function Groups() {
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [formData, setFormData] = useState<CreateGroupFormData>({
    name: '',
    description: '',
    permissions: [],
  })
  const [error, setError] = useState<string>('')

  // Resizable columns
  const { columnWidths, handleMouseDown } = useResizableColumns({
    name: 200,
    description: 300,
    permissions: 250,
    system: 100,
    created_at: 150,
    actions: 120,
  }, 'groups-column-widths')

  // Fetch groups
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const response = await api.get('/groups')
      return response.data
    },
  })

  // Fetch permission options
  const { data: permissionOptions } = useQuery({
    queryKey: ['permission-options'],
    queryFn: async () => {
      const response = await api.get('/permissions/options')
      return response.data
    },
  })

  // Create group mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateGroupFormData) => {
      await api.post('/groups', data)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      setIsCreateModalOpen(false)
      resetForm()
      setError('')
      notifyResourceAction.created('Group', data.name)
    },
    onError: (err: any) => {
      const errorMsg = err.response?.data?.error || 'Failed to create group'
      setError(errorMsg)
      notifyResourceAction.failed('create', 'Group', formData.name, errorMsg)
    },
  })

  // Update group mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CreateGroupFormData> }) => {
      await api.put(`/groups/${id}`, data)
      return { id, data }
    },
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      
      const groupName = selectedGroup?.name || data.name || 'Group'
      notifyResourceAction.updated('Group', groupName)
      
      setIsEditModalOpen(false)
      setSelectedGroup(null)
      resetForm()
      setError('')
    },
    onError: (err: any) => {
      const errorMsg = err.response?.data?.error || 'Failed to update group'
      setError(errorMsg)
      const groupName = selectedGroup?.name || 'Group'
      notifyResourceAction.failed('update', 'Group', groupName, errorMsg)
    },
  })

  // Delete group mutation
  const deleteMutation = useMutation({
    mutationFn: async (groupId: number) => {
      await api.delete(`/groups/${groupId}`)
      return groupId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      
      const groupName = selectedGroup?.name || 'Group'
      notifyResourceAction.deleted('Group', groupName)
      
      setIsDeleteModalOpen(false)
      setSelectedGroup(null)
    },
    onError: (err: any) => {
      const errorMsg = err.response?.data?.error || 'Failed to delete group'
      const groupName = selectedGroup?.name || 'Group'
      notifyResourceAction.failed('delete', 'Group', groupName, errorMsg)
    },
  })

  // Filtering
  const filteredGroups = useMemo(() => {
    if (!groups) return []
    if (!filterText) return groups
    const lowerFilter = filterText.toLowerCase()
    return groups.filter((group: Group) =>
      group.name.toLowerCase().includes(lowerFilter) ||
      group.description?.toLowerCase().includes(lowerFilter)
    )
  }, [groups, filterText])

  // Sorting
  const { sortedData, sortConfig, requestSort } = useTableSort<Group>(filteredGroups, {
    key: 'created_at',
    direction: 'desc'
  })

  // Pagination
  const {
    paginatedData: paginatedGroups,
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
  } = usePagination(sortedData, 10, 'groups')

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      permissions: [],
    })
    setError('')
  }

  const handleCreateGroup = () => {
    createMutation.mutate(formData)
  }

  const handleEditGroup = (group: Group) => {
    setSelectedGroup(group)
    setFormData({
      name: group.name,
      description: group.description,
      permissions: group.permissions || [],
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateGroup = () => {
    if (selectedGroup) {
      updateMutation.mutate({ id: selectedGroup.id, data: formData })
    }
  }

  const handleDeleteGroup = (group: Group, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedGroup(group)
    setIsDeleteModalOpen(true)
  }

  const confirmDelete = () => {
    if (!selectedGroup) return
    deleteMutation.mutate(selectedGroup.id)
  }

  const addPermission = () => {
    setFormData({
      ...formData,
      permissions: [
        ...formData.permissions,
        { resource: '*', actions: ['read'], clusters: ['*'], namespaces: ['*'] },
      ],
    })
  }

  const updatePermission = (index: number, field: keyof Permission, value: any) => {
    const newPermissions = [...formData.permissions]
    newPermissions[index] = { ...newPermissions[index], [field]: value }
    setFormData({ ...formData, permissions: newPermissions })
  }

  const removePermission = (index: number) => {
    setFormData({
      ...formData,
      permissions: formData.permissions.filter((_, i) => i !== index),
    })
  }

  const formatPermissions = (permissions: Permission[]) => {
    if (!permissions || permissions.length === 0) return 'No permissions'
    return permissions.map(p => `${p.resource}: ${p.actions.join(", ")}`).join("; ")
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <div>
        <Breadcrumb items={[{ name: 'Groups Management', href: '/groups' }]} />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Groups Management</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage user groups and permissions
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:w-64">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search groups..."
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
            <span>Create Group</span>
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
                  label="Name"
                  columnKey="name"
                  sortKey="name"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.name}
                />
                <ResizableTableHeader
                  label="Description"
                  columnKey="description"
                  sortKey="description"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.description}
                />
                <ResizableTableHeader
                  label="Permissions"
                  columnKey="permissions"
                  width={columnWidths.permissions}
                  onResizeStart={handleMouseDown}
                />
                <ResizableTableHeader
                  label="System"
                  columnKey="system"
                  sortKey="is_system"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.system}
                />
                <ResizableTableHeader
                  label="Created"
                  columnKey="created_at"
                  sortKey="created_at"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleMouseDown}
                  width={columnWidths.created_at}
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
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  </td>
                </tr>
              ) : paginatedGroups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                      {filterText ? 'No groups found matching your search.' : 'No groups found.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedGroups.map((group: Group) => (
                  <tr key={group.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    {/* Name */}
                    <td className="px-6 py-4" style={{ width: columnWidths.name }}>
                      <div className="flex items-center gap-2">
                        <UserGroupIcon className="h-5 w-5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {group.name}
                        </span>
                      </div>
                    </td>

                    {/* Description */}
                    <td className="px-6 py-4" style={{ width: columnWidths.description }}>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {group.description || '-'}
                      </span>
                    </td>

                    {/* Permissions */}
                    <td className="px-6 py-4" style={{ width: columnWidths.permissions }}>
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate" title={formatPermissions(group.permissions)}>
                        {formatPermissions(group.permissions)}
                      </div>
                    </td>

                    {/* System */}
                    <td className="px-6 py-4" style={{ width: columnWidths.system }}>
                      {group.is_system ? (
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          System
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          Custom
                        </span>
                      )}
                    </td>

                    {/* Created */}
                    <td className="px-6 py-4" style={{ width: columnWidths.created_at }}>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(group.created_at).toLocaleDateString()}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4" style={{ width: columnWidths.actions }}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditGroup(group)}
                          className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                          title="Edit group"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        {!group.is_system && (
                          <button
                            onClick={(e) => handleDeleteGroup(group, e)}
                            className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete group"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && paginatedGroups.length > 0 && (
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

      {/* Create/Edit Group Modal */}
      <GroupFormModal
        isOpen={isCreateModalOpen || isEditModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          setIsEditModalOpen(false)
          setSelectedGroup(null)
          resetForm()
        }}
        onSubmit={isEditModalOpen ? handleUpdateGroup : handleCreateGroup}
        formData={formData}
        setFormData={setFormData}
        permissionOptions={permissionOptions}
        error={error}
        isLoading={createMutation.isPending || updateMutation.isPending}
        mode={isEditModalOpen ? 'edit' : 'create'}
        groupId={selectedGroup?.id}
        groupName={selectedGroup?.name}
        addPermission={addPermission}
        updatePermission={updatePermission}
        removePermission={removePermission}
      />

      {/* Delete Confirmation */}
      {selectedGroup && (
        <ConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false)
            setSelectedGroup(null)
          }}
          onConfirm={confirmDelete}
          title="Delete Group"
          message={`Are you sure you want to delete the group "${selectedGroup.name}"?\n\nThis action cannot be undone. Users in this group will lose their associated permissions.`}
          confirmText="Delete"
          type="danger"
          isLoading={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
