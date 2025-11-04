import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getClusters, getEvents } from '@/services/api'
import { useMemo } from 'react'
import { BellAlertIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { DataTable, Column } from '@/components/shared/DataTable'
import { formatAge } from '@/utils/format'
import clsx from 'clsx'

interface EventData {
  metadata: {
    name: string
    namespace?: string
    creationTimestamp: string
  }
  type: string
  reason: string
  message: string
  involvedObject: {
    kind: string
    name: string
    namespace?: string
  }
  clusterName: string
}

export default function Events() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const navigate = useNavigate()
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch events from all clusters or specific cluster/namespace
  const { data: allEvents, isLoading } = useQuery({
    queryKey: namespace 
      ? ['events', cluster, namespace]
      : cluster 
        ? ['events', cluster] 
        : ['all-events', clusters?.map(c => c.name).sort().join(',')],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const events = await getEvents(cluster, namespace)
        return events.map((event: any) => ({ ...event, clusterName: cluster }))
      }
      
      // If specific cluster requested (all namespaces)
      if (cluster) {
        const events = await getEvents(cluster)
        return events.map((event: any) => ({ ...event, clusterName: cluster }))
      }
      
      // Otherwise fetch from all clusters
      if (!clusters || clusters.length === 0) return []
      
      const allEvents = await Promise.all(
        clusters.map(async (cluster) => {
          try {
            const events = await getEvents(cluster.name)
            return events.map((event: any) => ({ ...event, clusterName: cluster.name }))
          } catch (error) {
            console.error(`Error fetching events from ${cluster.name}:`, error)
            return []
          }
        })
      )
      
      return allEvents.flat()
    },
    enabled: (cluster && namespace) ? true : cluster ? true : (!!clusters && clusters.length > 0),
    refetchInterval: 5000,
  })

  // Helper function to navigate to object detail page
  const navigateToObject = (event: EventData) => {
    const { kind, name, namespace: objNamespace } = event.involvedObject
    const targetCluster = event.clusterName
    const targetNamespace = objNamespace || namespace || 'default'
    
    // Map kind to route
    const kindToRoute: Record<string, string> = {
      'Pod': 'pods',
      'Deployment': 'deployments',
      'StatefulSet': 'statefulsets',
      'DaemonSet': 'daemonsets',
      'ReplicaSet': 'replicasets',
      'Job': 'jobs',
      'CronJob': 'cronjobs',
      'Service': 'services',
      'Ingress': 'ingresses',
      'ConfigMap': 'configmaps',
      'Secret': 'secrets',
      'PersistentVolumeClaim': 'persistentvolumeclaims',
      'PersistentVolume': 'persistentvolumes',
      'StorageClass': 'storageclasses',
      'ServiceAccount': 'serviceaccounts',
      'Role': 'roles',
      'RoleBinding': 'rolebindings',
      'ClusterRole': 'clusterroles',
      'ClusterRoleBinding': 'clusterrolebindings',
      'Node': 'nodes',
      'Namespace': 'namespaces',
    }

    const route = kindToRoute[kind]
    if (!route) return // Don't navigate if we don't have a route for this kind

    // Cluster-scoped resources
    const clusterScopedResources = ['Node', 'Namespace', 'PersistentVolume', 'StorageClass', 'ClusterRole', 'ClusterRoleBinding']
    
    if (clusterScopedResources.includes(kind)) {
      navigate(`/clusters/${targetCluster}/${route}/${name}`)
    } else {
      navigate(`/clusters/${targetCluster}/namespaces/${targetNamespace}/${route}/${name}`)
    }
  }

  // Define columns
  const columns = useMemo<Column<EventData>[]>(() => [
    {
      key: 'type',
      header: 'Type',
      accessor: (event) => (
        <span className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
          event.type === 'Normal'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
        )}>
          {event.type || 'Unknown'}
        </span>
      ),
      sortable: true,
      sortValue: (event) => event.type || '',
      searchValue: (event) => event.type || '',
      filterable: true,
      filterOptions: () => ['Normal', 'Warning'],
      filterValue: (event) => event.type || '',
    },
    {
      key: 'reason',
      header: 'Reason',
      accessor: (event) => (
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {event.reason || '-'}
        </span>
      ),
      sortable: true,
      sortValue: (event) => event.reason || '',
      searchValue: (event) => event.reason || '',
      filterable: true,
      filterOptions: (data: EventData[]) => {
        const reasons = new Set(data.map(e => e.reason).filter(Boolean))
        return Array.from(reasons).sort()
      },
      filterValue: (event) => event.reason || '',
    },
    {
      key: 'object',
      header: 'Object',
      accessor: (event) => (
        <div className="flex flex-col gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigateToObject(event)
            }}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-left"
          >
            {event.involvedObject.name}
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {event.involvedObject.kind}
            {event.involvedObject.namespace && ` · ${event.involvedObject.namespace}`}
          </span>
        </div>
      ),
      sortable: true,
      sortValue: (event) => event.involvedObject.name,
      searchValue: (event) => `${event.involvedObject.kind} ${event.involvedObject.name} ${event.involvedObject.namespace || ''}`,
    },
    {
      key: 'message',
      header: 'Message',
      accessor: (event) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {event.message || '-'}
        </span>
      ),
      sortable: false,
      searchValue: (event) => event.message || '',
    },
    {
      key: 'cluster',
      header: 'Cluster',
      accessor: (event) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {event.clusterName}
        </span>
      ),
      sortable: true,
      sortValue: (event) => event.clusterName,
      searchValue: (event) => event.clusterName,
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (event) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(event.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (event) => new Date(event.metadata.creationTimestamp).getTime(),
      searchValue: (event) => formatAge(event.metadata.creationTimestamp),
    },
  ], [navigate, namespace])

  return (
    <div className="space-y-4 md:space-y-6">
      <Breadcrumb
        items={[
          ...(cluster ? [{ name: cluster }] : []),
          { name: 'Events' }
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
            Events
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {namespace 
              ? `Events in ${cluster} / ${namespace}`
              : cluster 
                ? `All events in ${cluster}`
                : `All events across ${clusters?.length || 0} cluster(s)`
            }
          </p>
        </div>
      </div>
      
      <DataTable
        data={allEvents || []}
        columns={columns}
        keyExtractor={(event: EventData) => `${event.clusterName}-${event.metadata.name}-${event.metadata.creationTimestamp}`}
        searchPlaceholder="Search events by type, reason, object, message..."
        isLoading={isLoading}
        emptyMessage="No events found"
        emptyIcon={
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <BellAlertIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
        }
        mobileCardRenderer={(event) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={clsx(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
                    event.type === 'Normal'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                  )}>
                    {event.type || 'Unknown'}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {event.reason}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigateToObject(event)
                  }}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  {event.involvedObject.kind}/{event.involvedObject.name}
                </button>
                {event.involvedObject.namespace && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {event.involvedObject.namespace}
                  </div>
                )}
                {!cluster && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {event.clusterName}
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {event.message}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAge(event.metadata.creationTimestamp)}
              </span>
            </div>
          </div>
        )}
      />
    </div>
  )
}
