import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, ShieldCheckIcon, PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateRoleBinding } from '@/services/api'
import { useNotificationStore } from '@/stores/notificationStore'


interface RoleBindingDetailsModalProps {
  roleBinding: any
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

interface RoleRef {
  apiGroup: string
  kind: string
  name: string
}

interface Subject {
  apiGroup: string
  kind: string
  name: string
  namespace?: string
}

export default function RoleBindingDetailsModal({
  roleBinding,
  isOpen,
  onClose,
  onSuccess,
}: RoleBindingDetailsModalProps) {
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()

  const [isEditingRoleRef, setIsEditingRoleRef] = useState(false)
  const [editedRoleRef, setEditedRoleRef] = useState<RoleRef | null>(null)

  const [isEditingSubjects, setIsEditingSubjects] = useState(false)
  const [editedSubjects, setEditedSubjects] = useState<Subject[]>([])

  useEffect(() => {
    if (isOpen && roleBinding) {
      setEditedRoleRef(roleBinding.roleRef || { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: '' })
      setEditedSubjects(roleBinding.subjects || [])
    }
  }, [isOpen, roleBinding])

  const updateMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      return updateRoleBinding(
        roleBinding.ClusterName,
        roleBinding.metadata?.namespace,
        roleBinding.metadata?.name,
        updatedData
      )
    },
    onSuccess: () => {
      addNotification({
        type: 'success',
        title: 'Updated',
        message: 'Role Binding updated successfully',
      })
      queryClient.invalidateQueries({ queryKey: ['rolebindings'] })
      setIsEditingRoleRef(false)
      setIsEditingSubjects(false)
      if (onSuccess) onSuccess()
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.error || 'Failed to update role binding',
      })
    },
  })

  const handleSaveRoleRef = () => {
    if (!editedRoleRef || !editedRoleRef.name) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Role name is required',
      })
      return
    }
    const updated = {
      ...roleBinding,
      roleRef: editedRoleRef,
    }
    updateMutation.mutate(updated)
  }

  const handleSaveSubjects = () => {
    const hasEmptyName = editedSubjects.some((s) => !s.name)
    if (hasEmptyName) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'All subjects must have a name',
      })
      return
    }
    const updated = {
      ...roleBinding,
      subjects: editedSubjects,
    }
    updateMutation.mutate(updated)
  }

  const handleAddSubject = () => {
    setEditedSubjects([
      ...editedSubjects,
      {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: 'User',
        name: '',
      },
    ])
  }

  const handleRemoveSubject = (index: number) => {
    setEditedSubjects(editedSubjects.filter((_, i) => i !== index))
  }

  const handleUpdateSubject = (index: number, field: string, value: string) => {
    const updated = [...editedSubjects]
    updated[index] = { ...updated[index], [field]: value }
    setEditedSubjects(updated)
  }

  if (!roleBinding) return null

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
          <div className="fixed inset-0 bg-black/25 dark:bg-black/50 backdrop-blur-sm" />
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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-gray-800/50 dark:to-gray-800/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                      <ShieldCheckIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
                        {roleBinding.metadata?.name}
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Role Binding Details
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 hover:bg-white/50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                        <div className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">
                          Name
                        </div>
                        <div className="text-lg font-bold text-blue-900 dark:text-blue-300 truncate">
                          {roleBinding.metadata?.name}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                        <div className="text-sm font-medium text-purple-700 dark:text-purple-400 mb-1">
                          Namespace
                        </div>
                        <div className="text-lg font-bold text-purple-900 dark:text-purple-300 truncate">
                          {roleBinding.metadata?.namespace}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                        <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                          Cluster
                        </div>
                        <div className="text-lg font-bold text-green-900 dark:text-green-300 truncate">
                          {roleBinding.ClusterName}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
                        <div className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-1">
                          Bindings
                        </div>
                        <div className="text-2xl font-bold text-orange-900 dark:text-orange-300">
                          {roleBinding.subjects?.length || 0}
                        </div>
                      </div>
                    </div>

                    {/* Role Reference Section */}
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-xl p-5 border border-indigo-200 dark:border-indigo-800">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                          <ShieldCheckIcon className="h-5 w-5" />
                          Role Reference
                        </h3>
                        {!isEditingRoleRef && (
                          <button
                            onClick={() => setIsEditingRoleRef(true)}
                            className="p-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-all"
                            title="Edit Role Reference"
                          >
                            <PencilSquareIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>

                      {!isEditingRoleRef ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase mb-1">
                              Kind
                            </div>
                            <div className="text-sm font-mono text-indigo-900 dark:text-indigo-300">
                              {roleBinding.roleRef?.kind || '-'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase mb-1">
                              Name
                            </div>
                            <div className="text-sm font-mono text-indigo-900 dark:text-indigo-300">
                              {roleBinding.roleRef?.name || '-'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase mb-2">
                                Kind
                              </label>
                              <select
                                value={editedRoleRef?.kind || 'Role'}
                                onChange={(e) =>
                                  setEditedRoleRef({ ...editedRoleRef!, kind: e.target.value })
                                }
                                className="w-full px-3 py-2 text-sm border border-indigo-300 dark:border-indigo-700 rounded-lg bg-white dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="Role">Role</option>
                                <option value="ClusterRole">ClusterRole</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase mb-2">
                                Name
                              </label>
                              <input
                                type="text"
                                value={editedRoleRef?.name || ''}
                                onChange={(e) =>
                                  setEditedRoleRef({ ...editedRoleRef!, name: e.target.value })
                                }
                                className="w-full px-3 py-2 text-sm border border-indigo-300 dark:border-indigo-700 rounded-lg bg-white dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-500"
                                placeholder="Enter role name"
                              />
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <button
                              onClick={handleSaveRoleRef}
                              disabled={updateMutation.isPending}
                              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {updateMutation.isPending ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => setIsEditingRoleRef(false)}
                              disabled={updateMutation.isPending}
                              className="px-4 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-white dark:bg-indigo-950/30 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 border border-indigo-300 dark:border-indigo-700 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bindings (Subjects) Section */}
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-xl p-5 border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                          Bindings ({editedSubjects.length})
                        </h3>
                        {!isEditingSubjects && (
                          <button
                            onClick={() => setIsEditingSubjects(true)}
                            className="p-2 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-lg transition-all"
                            title="Edit Bindings"
                          >
                            <PencilSquareIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>

                      {!isEditingSubjects ? (
                        <div className="space-y-3">
                          {editedSubjects.length === 0 ? (
                            <p className="text-sm text-emerald-700 dark:text-emerald-400 text-center py-4">
                              No bindings defined
                            </p>
                          ) : (
                            editedSubjects.map((subject, idx) => (
                              <div
                                key={idx}
                                className="bg-white dark:bg-emerald-950/30 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800"
                              >
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase mb-1">
                                      Kind
                                    </div>
                                    <div className="font-mono text-emerald-900 dark:text-emerald-300">
                                      {subject.kind}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase mb-1">
                                      Name
                                    </div>
                                    <div className="font-mono text-emerald-900 dark:text-emerald-300">
                                      {subject.name}
                                    </div>
                                  </div>
                                  {subject.namespace && (
                                    <div>
                                      <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase mb-1">
                                        Namespace
                                      </div>
                                      <div className="font-mono text-emerald-900 dark:text-emerald-300">
                                        {subject.namespace}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {editedSubjects.map((subject, idx) => (
                            <div
                              key={idx}
                              className="bg-white dark:bg-emerald-950/30 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 relative"
                            >
                              <button
                                onClick={() => handleRemoveSubject(idx)}
                                className="absolute top-2 right-2 p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                title="Remove"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>

                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <label className="block text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase mb-2">
                                    Kind
                                  </label>
                                  <select
                                    value={subject.kind}
                                    onChange={(e) => handleUpdateSubject(idx, 'kind', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-emerald-300 dark:border-emerald-700 rounded-lg bg-white dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 focus:ring-2 focus:ring-emerald-500"
                                  >
                                    <option value="User">User</option>
                                    <option value="Group">Group</option>
                                    <option value="ServiceAccount">ServiceAccount</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase mb-2">
                                    Name
                                  </label>
                                  <input
                                    type="text"
                                    value={subject.name}
                                    onChange={(e) => handleUpdateSubject(idx, 'name', e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-emerald-300 dark:border-emerald-700 rounded-lg bg-white dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 focus:ring-2 focus:ring-emerald-500"
                                    placeholder="Enter name"
                                  />
                                </div>
                                {subject.kind === 'ServiceAccount' && (
                                  <div>
                                    <label className="block text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase mb-2">
                                      Namespace
                                    </label>
                                    <input
                                      type="text"
                                      value={subject.namespace || ''}
                                      onChange={(e) => handleUpdateSubject(idx, 'namespace', e.target.value)}
                                      className="w-full px-3 py-2 text-sm border border-emerald-300 dark:border-emerald-700 rounded-lg bg-white dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 focus:ring-2 focus:ring-emerald-500"
                                      placeholder="Namespace"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}

                          <button
                            onClick={handleAddSubject}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-white dark:bg-emerald-950/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 border-2 border-dashed border-emerald-300 dark:border-emerald-700 rounded-lg transition-all"
                          >
                            <PlusIcon className="h-5 w-5" />
                            Add Subject
                          </button>

                          <div className="flex gap-3 pt-2">
                            <button
                              onClick={handleSaveSubjects}
                              disabled={updateMutation.isPending}
                              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {updateMutation.isPending ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => {
                                setEditedSubjects(roleBinding.subjects || [])
                                setIsEditingSubjects(false)
                              }}
                              disabled={updateMutation.isPending}
                              className="px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-white dark:bg-emerald-950/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Labels */}
                    {roleBinding.metadata?.labels && Object.keys(roleBinding.metadata.labels).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                          Labels
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(roleBinding.metadata.labels).map(([key, value]) => (
                            <span
                              key={key}
                              className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-mono bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400"
                            >
                              <span className="font-semibold">{key}:</span>
                              <span className="ml-1">{String(value)}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Annotations */}
                    {roleBinding.metadata?.annotations && Object.keys(roleBinding.metadata.annotations).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                          Annotations
                        </h3>
                        <div className="space-y-2">
                          {Object.entries(roleBinding.metadata.annotations).map(([key, value]) => (
                            <div key={key} className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                              <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                {key}
                              </div>
                              <div className="text-sm font-mono text-gray-800 dark:text-gray-300 break-all">
                                {String(value)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
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
