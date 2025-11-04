import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getLeases } from '@/services/api'
import { useMemo, useState } from 'react'
import { ClockIcon, PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import CreateLeaseModal from '@/components/Leases/CreateLeaseModal'
import EditLeaseYAMLModal from '@/components/Leases/EditLeaseYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import { formatAge } from '@/utils/format'
import { format } from 'date-fns'
import api from '@/services/api'

export default function Leases() {
  const { cluster } = useParams<{ cluster?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedLease, setSelectedLease] = useState<any>(null)

  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch leases from all clusters or specific cluster
  const leaseQueries = useMemo(() => {
    if (!clusters) return []

    if (cluster) {
      return [
        {
          queryKey: ['leases', cluster, 'all'],
          queryFn: () => getLeases(cluster, 'all'),
          refetchInterval: 5000,
        },
      ]
    }

    return clusters.map((c: any) => ({
      queryKey: ['leases', c.name, 'all'],
      queryFn: () => getLeases(c.name, 'all'),
      refetchInterval: 5000,
    }))
  }, [clusters, cluster])

  const leaseResults = useQueries({ queries: leaseQueries })
  const isLoading = leaseResults.some((result) => result.isLoading)

  const allLeases = useMemo(() => {
    return leaseResults.flatMap((result) => result.data || [])
  }, [leaseResults])

  const formatRenewTime = (renewTime: string | null | undefined) => {
    if (!renewTime) return 'Never'
    try {
      const date = new Date(renewTime)
      return format(date, 'MMM dd, HH:mm:ss')
    } catch {
      return 'Invalid'
    }
  }

  const handleDeleteLease = async () => {
    if (!selectedLease) return
    
    try {
      await api.delete(
        `/clusters/${selectedLease.clusterName}/namespaces/${selectedLease.metadata.namespace}/leases/${selectedLease.metadata.name}`
      )
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Lease deleted successfully',
      })
      queryClient.invalidateQueries({ queryKey: ['leases'] })
      setIsDeleteModalOpen(false)
      setSelectedLease(null)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete lease: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const columns = useMemo<Column<any>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (lease) => (
        <button
          onClick={() => navigate(`/clusters/${lease.clusterName}/namespaces/${lease.metadata.namespace}/leases/${lease.metadata.name}`)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-left"
        >
          {lease.metadata.name}
        </button>
      ),
      sortable: true,
      sortValue: (lease) => lease.metadata.name,
      searchValue: (lease) => lease.metadata.name,
    },
    {
      key: 'cluster',
      header: 'Cluster',
      accessor: (lease) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {lease.clusterName}
        </span>
      ),
      sortable: true,
      sortValue: (lease) => lease.clusterName,
      searchValue: (lease) => lease.clusterName,
    },
    {
      key: 'namespace',
      header: 'Namespace',
      accessor: (lease) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {lease.metadata.namespace}
        </span>
      ),
      sortable: true,
      sortValue: (lease) => lease.metadata.namespace,
      searchValue: (lease) => lease.metadata.namespace,
    },
    {
      key: 'holder',
      header: 'Holder Identity',
      accessor: (lease) => (
        <span className="text-sm font-mono text-gray-700 dark:text-gray-300 truncate" title={lease.spec?.holderIdentity}>
          {lease.spec?.holderIdentity || '-'}
        </span>
      ),
      sortable: true,
      sortValue: (lease) => lease.spec?.holderIdentity || '',
      searchValue: (lease) => lease.spec?.holderIdentity || '',
    },
    {
      key: 'duration',
      header: 'Duration (s)',
      accessor: (lease) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {lease.spec?.leaseDurationSeconds || '-'}
        </span>
      ),
      sortable: true,
      sortValue: (lease) => lease.spec?.leaseDurationSeconds || 0,
      searchValue: (lease) => String(lease.spec?.leaseDurationSeconds || ''),
    },
    {
      key: 'renewTime',
      header: 'Renew Time',
      accessor: (lease) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatRenewTime(lease.spec?.renewTime)}
        </span>
      ),
      sortable: true,
      sortValue: (lease) => {
        if (!lease.spec?.renewTime) return 0
        try {
          return new Date(lease.spec.renewTime).getTime()
        } catch {
          return 0
        }
      },
      searchValue: (lease) => formatRenewTime(lease.spec?.renewTime),
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (lease) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(lease.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (lease) => new Date(lease.metadata.creationTimestamp).getTime(),
      searchValue: (lease) => formatAge(lease.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (lease) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedLease(lease)
              setIsEditModalOpen(true)
            }}
            className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedLease(lease)
              setIsDeleteModalOpen(true)
            }}
            className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
      sortable: false,
    },
  ], [navigate])

  const mobileCardRenderer = (lease: any) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <ClockIcon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <button
              onClick={() => navigate(`/clusters/${lease.clusterName}/namespaces/${lease.metadata.namespace}/leases/${lease.metadata.name}`)}
              className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-left truncate block w-full"
            >
              {lease.metadata.name}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {lease.clusterName} / {lease.metadata.namespace}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedLease(lease)
              setIsEditModalOpen(true)
            }}
            className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedLease(lease)
              setIsDeleteModalOpen(true)
            }}
            className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Holder:</span>
          <p className="font-mono text-gray-900 dark:text-white truncate" title={lease.spec?.holderIdentity}>
            {lease.spec?.holderIdentity || '-'}
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Duration:</span>
          <p className="text-gray-900 dark:text-white">
            {lease.spec?.leaseDurationSeconds || '-'}s
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Renew Time:</span>
          <p className="text-gray-900 dark:text-white">
            {formatRenewTime(lease.spec?.renewTime)}
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Age:</span>
          <p className="text-gray-900 dark:text-white">
            {formatAge(lease.metadata.creationTimestamp)}
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 md:space-y-6">
      <Breadcrumb
        items={
          cluster
            ? [
                { name: cluster },
                { name: 'Leases' }
              ]
            : [{ name: 'Leases' }]
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <ClockIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Leases
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Distributed coordination locks across {clusters?.length || 0} cluster(s)
            </p>
          </div>
        </div>

        {cluster && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            <PlusIcon className="h-5 w-5" />
            <span>Create Lease</span>
          </button>
        )}
      </div>

      <DataTable
        data={allLeases}
        columns={columns}
        keyExtractor={(lease) => `${lease.clusterName}-${lease.metadata.namespace}-${lease.metadata.name}`}
        searchPlaceholder="Search leases..."
        isLoading={isLoading}
        emptyMessage="No leases found"
        emptyIcon={<ClockIcon className="w-12 h-12 text-gray-400" />}
        mobileCardRenderer={mobileCardRenderer}
      />

      {cluster && (
        <CreateLeaseModal
          clusterName={cluster}
          namespace="default"
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['leases'] })
            setIsCreateModalOpen(false)
          }}
        />
      )}

      {selectedLease && (
        <>
          <EditLeaseYAMLModal
            lease={selectedLease}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedLease(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['leases'] })
              addNotification({
                type: 'success',
                title: 'Success',
                message: 'Lease updated successfully',
              })
              setIsEditModalOpen(false)
              setSelectedLease(null)
            }}
          />

          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedLease(null)
            }}
            onConfirm={handleDeleteLease}
            title="Delete Lease"
            message={`Are you sure you want to delete lease "${selectedLease.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
