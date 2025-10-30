import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition, Listbox } from '@headlessui/react'
import { XMarkIcon, PlusIcon, TrashIcon, ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createRoleBinding, getRoles, getClusterRoles, getServiceAccounts } from '@/services/api'
import yaml from 'js-yaml'
import { useNotificationStore } from '@/stores/notificationStore'
import clsx from 'clsx'

interface CreateRoleBindingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  cluster: string
  namespace: string
}

interface Subject {
  kind: string
  name: string
  namespace?: string
}

export default function CreateRoleBindingModal({
  isOpen,
  onClose,
  onSuccess,
  cluster,
  namespace,
}: CreateRoleBindingModalProps) {
  const [name, setName] = useState('')
  const [roleRefKind, setRoleRefKind] = useState('Role')
  const [roleRefName, setRoleRefName] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([
    { kind: 'User', name: '' }
  ])
  const [labels, setLabels] = useState<Array<{ key: string; value: string }>>([])
  const [annotations, setAnnotations] = useState<Array<{ key: string; value: string }>>([])
  const { addNotification } = useNotificationStore()

  // Fetch available roles based on selected kind
  const { data: roles = [] } = useQuery({
    queryKey: ['roles', cluster, namespace],
    queryFn: () => getRoles(cluster, namespace),
    enabled: isOpen && roleRefKind === 'Role' && !!cluster && !!namespace,
  })

  const { data: clusterRoles = [] } = useQuery({
    queryKey: ['clusterroles', cluster],
    queryFn: () => getClusterRoles(cluster),
    enabled: isOpen && roleRefKind === 'ClusterRole' && !!cluster,
  })

  // Fetch service accounts for subject dropdown
  const { data: serviceAccounts = [] } = useQuery({
    queryKey: ['serviceaccounts', cluster, namespace],
    queryFn: () => getServiceAccounts(cluster, namespace),
    enabled: isOpen && !!cluster && !!namespace,
  })

  // Reset roleRefName when kind changes
  useEffect(() => {
    setRoleRefName('')
  }, [roleRefKind])

  const createMutation = useMutation({
    mutationFn: ({ clusterName, namespace, yaml }: { clusterName: string; namespace: string; yaml: string }) =>
      createRoleBinding(clusterName, namespace, yaml),
    onSuccess: () => {
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Role Binding created successfully',
      })
      onSuccess?.()
      handleClose()
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.error || 'Failed to create role binding',
      })
    },
  })

  const handleClose = () => {
    setName('')
    setRoleRefKind('Role')
    setRoleRefName('')
    setSubjects([{ kind: 'User', name: '' }])
    setLabels([])
    setAnnotations([])
    onClose()
  }

  const handleCreate = () => {
    if (!name.trim()) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Role Binding name is required',
      })
      return
    }

    if (!roleRefName.trim()) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Role reference name is required',
      })
      return
    }

    const validSubjects = subjects.filter(s => s.name.trim())
    if (validSubjects.length === 0) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'At least one subject with a name is required',
      })
      return
    }

    // Build RoleBinding object
    const roleBinding: any = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: {
        name: name.trim(),
        namespace: namespace,
      },
      roleRef: {
        apiGroup: 'rbac.authorization.k8s.io',
        kind: roleRefKind,
        name: roleRefName.trim(),
      },
      subjects: validSubjects.map(s => {
        const subject: any = {
          kind: s.kind,
          name: s.name.trim(),
          apiGroup: s.kind === 'ServiceAccount' ? '' : 'rbac.authorization.k8s.io',
        }
        if (s.kind === 'ServiceAccount' && s.namespace) {
          subject.namespace = s.namespace.trim()
        }
        return subject
      })
    }

    // Add labels
    if (labels.length > 0) {
      const labelsObj: Record<string, string> = {}
      labels.forEach(({ key, value }) => {
        if (key.trim() && value.trim()) {
          labelsObj[key.trim()] = value.trim()
        }
      })
      if (Object.keys(labelsObj).length > 0) {
        roleBinding.metadata.labels = labelsObj
      }
    }

    // Add annotations
    if (annotations.length > 0) {
      const annotationsObj: Record<string, string> = {}
      annotations.forEach(({ key, value }) => {
        if (key.trim() && value.trim()) {
          annotationsObj[key.trim()] = value.trim()
        }
      })
      if (Object.keys(annotationsObj).length > 0) {
        roleBinding.metadata.annotations = annotationsObj
      }
    }

    const yamlString = yaml.dump(roleBinding)
    createMutation.mutate({ clusterName: cluster, namespace, yaml: yamlString })
  }

  const addSubject = () => {
    setSubjects([...subjects, { kind: 'User', name: '' }])
  }

  const removeSubject = (index: number) => {
    setSubjects(subjects.filter((_, i) => i !== index))
  }

  const updateSubject = (index: number, field: keyof Subject, value: string) => {
    const newSubjects = [...subjects]
    newSubjects[index] = { ...newSubjects[index], [field]: value }
    setSubjects(newSubjects)
  }

  // Get available role names based on selected kind
  const availableRoleNames = roleRefKind === 'Role' 
    ? roles.map((r: any) => r.metadata?.name).filter(Boolean)
    : clusterRoles.map((r: any) => r.metadata?.name).filter(Boolean)

  // Get available service account names
  const availableServiceAccounts = serviceAccounts.map((sa: any) => sa.metadata?.name).filter(Boolean)

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
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <PlusIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Create Role Binding
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    disabled={createMutation.isPending}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
                  <div className="space-y-6">
                    {/* Name & Namespace */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Binding Name *
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g., read-pods"
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Namespace
                        </label>
                        <input
                          type="text"
                          value={namespace}
                          readOnly
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Role Reference */}
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                      <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-3">
                        Role Reference *
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-400 mb-2">
                            Kind
                          </label>
                          <select
                            value={roleRefKind}
                            onChange={(e) => setRoleRefKind(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-300 focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="Role">Role</option>
                            <option value="ClusterRole">ClusterRole</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-indigo-700 dark:text-indigo-400 mb-2">
                            Name
                          </label>
                          <Listbox value={roleRefName} onChange={setRoleRefName}>
                            <div className="relative">
                              <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-white dark:bg-indigo-950/30 py-2 pl-3 pr-10 text-left border border-indigo-300 dark:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <span className={clsx(
                                  "block truncate text-sm",
                                  roleRefName ? "text-indigo-900 dark:text-indigo-300" : "text-gray-400 dark:text-gray-500"
                                )}>
                                  {roleRefName || `Select ${roleRefKind}...`}
                                </span>
                                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                  <ChevronUpDownIcon className="h-5 w-5 text-indigo-400" aria-hidden="true" />
                                </span>
                              </Listbox.Button>
                              <Transition
                                as={Fragment}
                                leave="transition ease-in duration-100"
                                leaveFrom="opacity-100"
                                leaveTo="opacity-0"
                              >
                                <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                                  {availableRoleNames.length === 0 ? (
                                    <div className="relative cursor-default select-none py-2 px-4 text-gray-500 dark:text-gray-400">
                                      No {roleRefKind}s found
                                    </div>
                                  ) : (
                                    availableRoleNames.map((roleName: string) => (
                                      <Listbox.Option
                                        key={roleName}
                                        className={({ active }) =>
                                          clsx(
                                            'relative cursor-pointer select-none py-2 pl-10 pr-4',
                                            active ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-300' : 'text-gray-900 dark:text-gray-300'
                                          )
                                        }
                                        value={roleName}
                                      >
                                        {({ selected }) => (
                                          <>
                                            <span className={clsx('block truncate', selected ? 'font-medium' : 'font-normal')}>
                                              {roleName}
                                            </span>
                                            {selected && (
                                              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600 dark:text-indigo-400">
                                                <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </Listbox.Option>
                                    ))
                                  )}
                                </Listbox.Options>
                              </Transition>
                            </div>
                          </Listbox>
                        </div>
                      </div>
                    </div>

                    {/* Subjects */}
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">
                          Bindings (Subjects) *
                        </h3>
                        <button
                          type="button"
                          onClick={addSubject}
                          className="text-xs flex items-center gap-1 px-3 py-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg transition-colors"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Add Subject
                        </button>
                      </div>
                      <div className="space-y-3">
                        {subjects.map((subject, index) => (
                          <div
                            key={index}
                            className="relative bg-white dark:bg-emerald-950/30 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800"
                          >
                            {subjects.length > 1 && (
                              <button
                                onClick={() => removeSubject(index)}
                                className="absolute top-2 right-2 p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                                  Kind
                                </label>
                                <select
                                  value={subject.kind}
                                  onChange={(e) => {
                                    updateSubject(index, 'kind', e.target.value)
                                    updateSubject(index, 'name', '') // Reset name when kind changes
                                  }}
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 focus:ring-2 focus:ring-emerald-500"
                                >
                                  <option value="User">User</option>
                                  <option value="Group">Group</option>
                                  <option value="ServiceAccount">ServiceAccount</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                                  Name
                                </label>
                                {subject.kind === 'ServiceAccount' ? (
                                  <Listbox value={subject.name} onChange={(value) => updateSubject(index, 'name', value)}>
                                    <div className="relative">
                                      <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-white dark:bg-emerald-950/50 py-2 pl-3 pr-10 text-left border border-emerald-300 dark:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                        <span className={clsx(
                                          "block truncate text-sm",
                                          subject.name ? "text-emerald-900 dark:text-emerald-300" : "text-gray-400 dark:text-gray-500"
                                        )}>
                                          {subject.name || "Select..."}
                                        </span>
                                        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                          <ChevronUpDownIcon className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                                        </span>
                                      </Listbox.Button>
                                      <Transition
                                        as={Fragment}
                                        leave="transition ease-in duration-100"
                                        leaveFrom="opacity-100"
                                        leaveTo="opacity-0"
                                      >
                                        <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                                          {availableServiceAccounts.length === 0 ? (
                                            <div className="relative cursor-default select-none py-2 px-4 text-gray-500 dark:text-gray-400">
                                              No ServiceAccounts found
                                            </div>
                                          ) : (
                                            availableServiceAccounts.map((saName: string) => (
                                              <Listbox.Option
                                                key={saName}
                                                className={({ active }) =>
                                                  clsx(
                                                    'relative cursor-pointer select-none py-2 pl-10 pr-4',
                                                    active ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-300' : 'text-gray-900 dark:text-gray-300'
                                                  )
                                                }
                                                value={saName}
                                              >
                                                {({ selected }) => (
                                                  <>
                                                    <span className={clsx('block truncate', selected ? 'font-medium' : 'font-normal')}>
                                                      {saName}
                                                    </span>
                                                    {selected && (
                                                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-emerald-600 dark:text-emerald-400">
                                                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                                      </span>
                                                    )}
                                                  </>
                                                )}
                                              </Listbox.Option>
                                            ))
                                          )}
                                        </Listbox.Options>
                                      </Transition>
                                    </div>
                                  </Listbox>
                                ) : (
                                  <input
                                    type="text"
                                    value={subject.name}
                                    onChange={(e) => updateSubject(index, 'name', e.target.value)}
                                    placeholder="Enter name"
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 focus:ring-2 focus:ring-emerald-500"
                                  />
                                )}
                              </div>
                              {subject.kind === 'ServiceAccount' && (
                                <div>
                                  <label className="block text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                                    Namespace
                                  </label>
                                  <input
                                    type="text"
                                    value={subject.namespace || namespace}
                                    onChange={(e) => updateSubject(index, 'namespace', e.target.value)}
                                    placeholder="Namespace"
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 focus:ring-2 focus:ring-emerald-500"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Labels */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Labels (Optional)
                        </label>
                        <button
                          type="button"
                          onClick={() => setLabels([...labels, { key: '', value: '' }])}
                          className="text-xs flex items-center gap-1 px-2 py-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Add
                        </button>
                      </div>
                      <div className="space-y-2">
                        {labels.map((label, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={label.key}
                              onChange={(e) => {
                                const newLabels = [...labels]
                                newLabels[index].key = e.target.value
                                setLabels(newLabels)
                              }}
                              placeholder="Key"
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <input
                              type="text"
                              value={label.value}
                              onChange={(e) => {
                                const newLabels = [...labels]
                                newLabels[index].value = e.target.value
                                setLabels(newLabels)
                              }}
                              placeholder="Value"
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <button
                              onClick={() => setLabels(labels.filter((_, i) => i !== index))}
                              className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Annotations */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Annotations (Optional)
                        </label>
                        <button
                          type="button"
                          onClick={() => setAnnotations([...annotations, { key: '', value: '' }])}
                          className="text-xs flex items-center gap-1 px-2 py-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Add
                        </button>
                      </div>
                      <div className="space-y-2">
                        {annotations.map((annotation, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={annotation.key}
                              onChange={(e) => {
                                const newAnnotations = [...annotations]
                                newAnnotations[index].key = e.target.value
                                setAnnotations(newAnnotations)
                              }}
                              placeholder="Key"
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <input
                              type="text"
                              value={annotation.value}
                              onChange={(e) => {
                                const newAnnotations = [...annotations]
                                newAnnotations[index].value = e.target.value
                                setAnnotations(newAnnotations)
                              }}
                              placeholder="Value"
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <button
                              onClick={() => setAnnotations(annotations.filter((_, i) => i !== index))}
                              className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={createMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {createMutation.isPending ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <PlusIcon className="h-4 w-4" />
                        Create
                      </>
                    )}
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
