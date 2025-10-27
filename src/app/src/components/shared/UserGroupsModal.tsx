import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'

interface Group {
  id: number
  name: string
  description: string
  is_system: boolean
}

interface UserGroupsModalProps {
  isOpen: boolean
  onClose: () => void
  userId: number
  userName: string
}

export default function UserGroupsModal({ isOpen, onClose, userId, userName }: UserGroupsModalProps) {
  const queryClient = useQueryClient()
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([])
  const [error, setError] = useState<string>('')

  // Fetch all groups
  const { data: allGroups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const response = await api.get('/groups')
      return response.data
    },
  })

  // Fetch user's current groups
  const { data: userGroups = [], isLoading } = useQuery({
    queryKey: ['user-groups', userId],
    queryFn: async () => {
      const response = await api.get(`/users/${userId}/groups`)
      return response.data
    },
    enabled: isOpen && userId > 0,
  })

  // Update selected groups when user groups are loaded
  useEffect(() => {
    if (userGroups && userGroups.length > 0) {
      setSelectedGroupIds(userGroups.map((g: Group) => g.id))
    }
  }, [userGroups])

  // Update user groups mutation
  const updateMutation = useMutation({
    mutationFn: async (groupIds: number[]) => {
      await api.put(`/users/${userId}/groups`, { group_ids: groupIds })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-groups', userId] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
      setError('')
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to update user groups')
    },
  })

  const handleToggleGroup = (groupId: number) => {
    setError('')
    setSelectedGroupIds((prev) => {
      if (prev.includes(groupId)) {
        // Don't allow removing the last group
        if (prev.length === 1) {
          setError('User must have at least one group')
          return prev
        }
        return prev.filter((id) => id !== groupId)
      } else {
        return [...prev, groupId]
      }
    })
  }

  const handleSave = () => {
    if (selectedGroupIds.length === 0) {
      setError('User must have at least one group')
      return
    }
    updateMutation.mutate(selectedGroupIds)
  }

  const handleClose = () => {
    setError('')
    setSelectedGroupIds(userGroups.map((g: Group) => g.id))
    onClose()
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
                    Manage Groups for {userName}
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <div className="mt-4">
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {allGroups.map((group: Group) => (
                        <label
                          key={group.id}
                          className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedGroupIds.includes(group.id)
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                              : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedGroupIds.includes(group.id)}
                            onChange={() => handleToggleGroup(group.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <div className="ml-3 flex-1">
                            <div className="flex items-center gap-2">
                              <UserGroupIcon className="h-5 w-5 text-gray-400" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {group.name}
                              </span>
                              {group.is_system && (
                                <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  System
                                </span>
                              )}
                            </div>
                            {group.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {group.description}
                              </p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                    onClick={handleClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSave}
                    disabled={updateMutation.isPending || selectedGroupIds.length === 0}
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
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

