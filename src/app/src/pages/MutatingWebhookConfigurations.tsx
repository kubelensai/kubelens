import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getMutatingWebhookConfigurations } from '@/services/api'
import { useMemo, useState } from 'react'
import { ShieldCheckIcon, PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import CreateMutatingWebhookModal from '@/components/MutatingWebhookConfigurations/CreateMutatingWebhookModal'
import EditMutatingWebhookYAMLModal from '@/components/MutatingWebhookConfigurations/EditMutatingWebhookYAMLModal'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import { formatAge } from '@/utils/format'
import api from '@/services/api'

export default function MutatingWebhookConfigurations() {
  const { cluster } = useParams<{ cluster?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addNotification } = useNotificationStore()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedWebhook, setSelectedWebhook] = useState<any>(null)

  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch webhook configurations from all clusters or specific cluster
  const webhookQueries = useMemo(() => {
    if (!clusters) return []

    if (cluster) {
      return [
        {
          queryKey: ['mutatingwebhooks', cluster],
          queryFn: () => getMutatingWebhookConfigurations(cluster),
          refetchInterval: 5000,
        },
      ]
    }

    return clusters.map((c: any) => ({
      queryKey: ['mutatingwebhooks', c.name],
      queryFn: () => getMutatingWebhookConfigurations(c.name),
      refetchInterval: 5000,
    }))
  }, [clusters, cluster])

  const webhookResults = useQueries({ queries: webhookQueries })
  const isLoading = webhookResults.some((result) => result.isLoading)

  const allWebhooks = useMemo(() => {
    return webhookResults.flatMap((result) => result.data || [])
  }, [webhookResults])

  const handleDeleteWebhook = async () => {
    if (!selectedWebhook) return
    
    try {
      await api.delete(
        `/clusters/${selectedWebhook.clusterName}/mutatingwebhookconfigurations/${selectedWebhook.metadata.name}`
      )
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Mutating webhook configuration deleted successfully',
      })
      queryClient.invalidateQueries({ queryKey: ['mutatingwebhooks'] })
      setIsDeleteModalOpen(false)
      setSelectedWebhook(null)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete mutating webhook configuration: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const columns = useMemo<Column<any>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (wh) => (
        <button
          onClick={() => navigate(`/clusters/${wh.clusterName}/mutatingwebhookconfigurations/${wh.metadata.name}`)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-left"
        >
          {wh.metadata.name}
        </button>
      ),
      sortable: true,
      sortValue: (wh) => wh.metadata.name,
      searchValue: (wh) => wh.metadata.name,
    },
    {
      key: 'cluster',
      header: 'Cluster',
      accessor: (wh) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {wh.clusterName}
        </span>
      ),
      sortable: true,
      sortValue: (wh) => wh.clusterName,
      searchValue: (wh) => wh.clusterName,
    },
    {
      key: 'webhooks',
      header: 'Webhooks',
      accessor: (wh) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {wh.webhooks ? wh.webhooks.length : 0}
        </span>
      ),
      sortable: true,
      sortValue: (wh) => (wh.webhooks ? wh.webhooks.length : 0),
      searchValue: (wh) => String(wh.webhooks ? wh.webhooks.length : 0),
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (wh) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(wh.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (wh) => new Date(wh.metadata.creationTimestamp).getTime(),
      searchValue: (wh) => formatAge(wh.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (wh) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedWebhook(wh)
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
              setSelectedWebhook(wh)
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

  const mobileCardRenderer = (wh: any) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheckIcon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <button
              onClick={() => navigate(`/clusters/${wh.clusterName}/mutatingwebhookconfigurations/${wh.metadata.name}`)}
              className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-left truncate block w-full"
            >
              {wh.metadata.name}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {wh.clusterName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedWebhook(wh)
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
              setSelectedWebhook(wh)
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
          <span className="text-gray-500 dark:text-gray-400">Webhooks:</span>
          <p className="text-gray-900 dark:text-white">
            {wh.webhooks ? wh.webhooks.length : 0}
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Age:</span>
          <p className="text-gray-900 dark:text-white">
            {formatAge(wh.metadata.creationTimestamp)}
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
                { name: 'Mutating Webhooks' }
              ]
            : [{ name: 'Mutating Webhooks' }]
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <ShieldCheckIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Mutating Webhook Configurations
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Admission webhooks that mutate resources across {clusters?.length || 0} cluster(s)
            </p>
          </div>
        </div>

        {cluster && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            <PlusIcon className="h-5 w-5" />
            <span>Create</span>
          </button>
        )}
      </div>

      <DataTable
        data={allWebhooks}
        columns={columns}
        keyExtractor={(wh) => `${wh.clusterName}-${wh.metadata.name}`}
        searchPlaceholder="Search mutating webhook configurations..."
        isLoading={isLoading}
        emptyMessage="No mutating webhook configurations found"
        emptyIcon={<ShieldCheckIcon className="w-12 h-12 text-gray-400" />}
        mobileCardRenderer={mobileCardRenderer}
      />

      {cluster && (
        <CreateMutatingWebhookModal
          clusterName={cluster}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['mutatingwebhooks'] })
            setIsCreateModalOpen(false)
          }}
        />
      )}

      {selectedWebhook && (
        <>
          <EditMutatingWebhookYAMLModal
            webhook={selectedWebhook}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false)
              setSelectedWebhook(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['mutatingwebhooks'] })
              addNotification({
                type: 'success',
                title: 'Success',
                message: 'Mutating webhook configuration updated successfully',
              })
              setIsEditModalOpen(false)
              setSelectedWebhook(null)
            }}
          />

          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedWebhook(null)
            }}
            onConfirm={handleDeleteWebhook}
            title="Delete Mutating Webhook Configuration"
            message={`Are you sure you want to delete mutating webhook configuration "${selectedWebhook.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}
