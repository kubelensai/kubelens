import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, UserIcon } from '@heroicons/react/24/outline'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'

interface User {
  id: number
  email: string
  username: string
  full_name: string
}

interface GroupUsersModalProps {
  isOpen: boolean
  onClose: () => void
  groupId: number
  groupName: string
}

export default function GroupUsersModal({ isOpen, onClose, groupId, groupName }: GroupUsersModalProps) {
  const queryClient = useQueryClient()
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // Fetch all users
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users')
      return response.data
    },
  })

  // Fetch group's current users
  const { data: groupUsersData, isLoading } = useQuery({
    queryKey: ['group-users', groupId],
    queryFn: async () => {
      const response = await api.get(`/groups/${groupId}/users`)
      return response.data
    },
    enabled: isOpen && groupId > 0,
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

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25 dark:bg-opacity-50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 dark:text-white"
                  >
                    Manage Users in {groupName}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div className="mt-4">
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {filteredUsers.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                          No users found
                        </p>
                      ) : (
                        filteredUsers.map((user: User) => (
                          <label
                            key={user.id}
                            className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                              selectedUserIds.includes(user.id)
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                                : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(user.id)}
                              onChange={() => handleToggleUser(user.id)}
                              disabled={addUserMutation.isPending || removeUserMutation.isPending}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div className="ml-3 flex-1">
                              <div className="flex items-center gap-2">
                                <UserIcon className="h-5 w-5 text-gray-400" />
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
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    onClick={onClose}
                  >
                    Close
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

