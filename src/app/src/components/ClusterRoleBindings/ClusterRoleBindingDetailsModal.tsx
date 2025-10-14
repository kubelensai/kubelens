import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, ShieldCheckIcon, PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateClusterRoleBinding } from '@/services/api'
import { useNotificationStore } from '@/stores/notificationStore'
import yaml from 'js-yaml'

interface ClusterRoleBindingDetailsModalProps {
  clusterRoleBinding: any
  isOpen: boolean
  onClose: () => void
}

export default function ClusterRoleBindingDetailsModal({
  clusterRoleBinding,
  isOpen,
  onClose,
}: ClusterRoleBindingDetailsModalProps) {
  const [isEditingRole, setIsEditingRole] = useState(false)
  const [isEditingSubjects, setIsEditingSubjects] = useState(false)
  const [editedRoleRef, setEditedRoleRef] = useState<any>(null)
  const [editedSubjects, setEditedSubjects] = useState<any[]>([])
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()

  if (!clusterRoleBinding) return null

  const roleRef = clusterRoleBinding.roleRef || {}
  const subjects = clusterRoleBinding.subjects || []

  const startEditingRole = () => {
    setEditedRoleRef({ ...roleRef })
    setIsEditingRole(true)
  }

  const startEditingSubjects = () => {
    setEditedSubjects(JSON.parse(JSON.stringify(subjects)))
    setIsEditingSubjects(true)
  }

  const addSubject = () => {
    setEditedSubjects([
      ...editedSubjects,
      {
        kind: 'User',
        name: '',
        apiGroup: 'rbac.authorization.k8s.io',
      },
    ])
  }

  const removeSubject = (index: number) => {
    setEditedSubjects(editedSubjects.filter((_, i) => i !== index))
  }

  const updateSubject = (index: number, field: string, value: string) => {
    const updated = [...editedSubjects]
    updated[index] = { ...updated[index], [field]: value }
    setEditedSubjects(updated)
  }

  const updateMutation = useMutation({
    mutationFn: async (updatedBinding: any) => {
      const yamlContent = yaml.dump(updatedBinding, { indent: 2, lineWidth: -1 })
      return updateClusterRoleBinding(
        clusterRoleBinding.ClusterName,
        clusterRoleBinding.metadata?.name,
        yamlContent
      )
    },
    onSuccess: () => {
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Cluster Role Binding updated successfully',
      })
      queryClient.invalidateQueries({ queryKey: ['clusterrolebindings'] })
      setIsEditingRole(false)
      setIsEditingSubjects(false)
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.error || 'Failed to update cluster role binding',
      })
    },
  })

  const saveRole = () => {
    const updated = {
      ...clusterRoleBinding,
      roleRef: editedRoleRef,
    }
    updateMutation.mutate(updated)
  }

  const saveSubjects = () => {
    const updated = {
      ...clusterRoleBinding,
      subjects: editedSubjects,
    }
    updateMutation.mutate(updated)
  }

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
                        {clusterRoleBinding.metadata?.name}
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Cluster Role Binding Details
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                        <div className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">
                          Cluster
                        </div>
                        <div className="text-lg font-bold text-blue-900 dark:text-blue-300 truncate">
                          {clusterRoleBinding.ClusterName}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                        <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                          Subjects Count
                        </div>
                        <div className="text-2xl font-bold text-green-900 dark:text-green-300">
                          {subjects.length}
                        </div>
                      </div>
                    </div>

                    {/* Role Reference Section */}
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-300">
                          Role Reference
                        </h3>
                        {!isEditingRole && (
                          <button
                            onClick={startEditingRole}
                            className="p-1 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded transition-colors"
                          >
                            <PencilIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          </button>
                        )}
                      </div>

                      {isEditingRole ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Kind
                            </label>
                            <select
                              value={editedRoleRef.kind || 'ClusterRole'}
                              onChange={(e) =>
                                setEditedRoleRef({ ...editedRoleRef, kind: e.target.value })
                              }
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                            >
                              <option value="ClusterRole">ClusterRole</option>
                              <option value="Role">Role</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Name
                            </label>
                            <input
                              type="text"
                              value={editedRoleRef.name || ''}
                              onChange={(e) =>
                                setEditedRoleRef({ ...editedRoleRef, name: e.target.value })
                              }
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={saveRole}
                              disabled={updateMutation.isPending}
                              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
                            >
                              {updateMutation.isPending ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => setIsEditingRole(false)}
                              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-purple-700 dark:text-purple-400">
                              Kind:
                            </span>
                            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 rounded text-xs font-mono text-purple-900 dark:text-purple-300">
                              {roleRef.kind || '-'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-purple-700 dark:text-purple-400">
                              Name:
                            </span>
                            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 rounded text-xs font-mono text-purple-900 dark:text-purple-300">
                              {roleRef.name || '-'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Subjects Section */}
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-green-900 dark:text-green-300">
                          Bindings ({subjects.length})
                        </h3>
                        {!isEditingSubjects && (
                          <button
                            onClick={startEditingSubjects}
                            className="p-1 hover:bg-green-100 dark:hover:bg-green-900/40 rounded transition-colors"
                          >
                            <PencilIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </button>
                        )}
                      </div>

                      {isEditingSubjects ? (
                        <div className="space-y-3">
                          {editedSubjects.map((subject, index) => (
                            <div
                              key={index}
                              className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-700 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                  Subject #{index + 1}
                                </span>
                                <button
                                  onClick={() => removeSubject(index)}
                                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors"
                                >
                                  <TrashIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Kind
                                  </label>
                                  <select
                                    value={subject.kind || 'User'}
                                    onChange={(e) => updateSubject(index, 'kind', e.target.value)}
                                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs"
                                  >
                                    <option value="User">User</option>
                                    <option value="Group">Group</option>
                                    <option value="ServiceAccount">ServiceAccount</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Name
                                  </label>
                                  <input
                                    type="text"
                                    value={subject.name || ''}
                                    onChange={(e) => updateSubject(index, 'name', e.target.value)}
                                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs"
                                  />
                                </div>
                              </div>
                              {subject.kind === 'ServiceAccount' && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Namespace
                                  </label>
                                  <input
                                    type="text"
                                    value={subject.namespace || ''}
                                    onChange={(e) => updateSubject(index, 'namespace', e.target.value)}
                                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs"
                                  />
                                </div>
                              )}
                            </div>
                          ))}

                          <button
                            onClick={addSubject}
                            className="w-full px-3 py-2 border-2 border-dashed border-green-300 dark:border-green-700 rounded-lg text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center justify-center gap-2"
                          >
                            <PlusIcon className="h-4 w-4" />
                            Add Subject
                          </button>

                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={saveSubjects}
                              disabled={updateMutation.isPending}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              {updateMutation.isPending ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => setIsEditingSubjects(false)}
                              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {subjects.length > 0 ? (
                            subjects.map((subject: any, index: number) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg"
                              >
                                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded text-xs font-medium text-green-800 dark:text-green-400">
                                  {subject.kind}
                                </span>
                                <span className="text-sm font-mono text-gray-900 dark:text-white">
                                  {subject.name}
                                </span>
                                {subject.namespace && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    ({subject.namespace})
                                  </span>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                              No subjects defined
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Labels & Annotations */}
                    {(clusterRoleBinding.metadata?.labels ||
                      clusterRoleBinding.metadata?.annotations) && (
                      <div className="space-y-4">
                        {clusterRoleBinding.metadata?.labels && (
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                              Labels
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(clusterRoleBinding.metadata.labels).map(
                                ([key, value]) => (
                                  <span
                                    key={key}
                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono text-gray-700 dark:text-gray-300"
                                  >
                                    {key}: {String(value)}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        )}

                        {clusterRoleBinding.metadata?.annotations && (
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                              Annotations
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(clusterRoleBinding.metadata.annotations).map(
                                ([key, value]) => (
                                  <span
                                    key={key}
                                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono text-gray-700 dark:text-gray-300"
                                  >
                                    {key}: {String(value)}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
