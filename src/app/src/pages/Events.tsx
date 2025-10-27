import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getEvents } from '@/services/api'
import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'

export default function Events() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const [filterText, setFilterText] = useState('')

  // Resizable columns
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    cluster: 120,
    type: 100,
    reason: 130,
    object: 180,
    message: 400,
    age: 100,
  }, 'events-column-widths')
  
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // Fetch events from all clusters or specific cluster/namespace
  const eventQueries = useQuery({
    queryKey: namespace 
      ? ['events', cluster, namespace]
      : cluster 
        ? ['events', cluster] 
        : ['all-events', clusters?.map(c => c.name)],
    queryFn: async () => {
      // If specific cluster and namespace requested
      if (cluster && namespace) {
        const events = await getEvents(cluster, namespace)
        return events.map((event: any) => ({ ...event, clusterName: cluster, namespace }))
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
  })

  const isLoading = eventQueries.isLoading
  const allEvents = eventQueries.data || []

  // Filter events by name, reason, or message
  const filteredEvents = useMemo(() => {
    if (!filterText) return allEvents
    const lowerFilter = filterText.toLowerCase()
    return allEvents.filter((event: any) =>
      event.metadata?.name?.toLowerCase().includes(lowerFilter) ||
      event.reason?.toLowerCase().includes(lowerFilter) ||
      event.message?.toLowerCase().includes(lowerFilter)
    )
  }, [allEvents, filterText])

  // Apply sorting (default: most recent first)
  const { sortedData: sortedEvents, sortConfig, requestSort } = useTableSort(filteredEvents, {
    key: 'metadata.creationTimestamp',
    direction: 'desc'
  })

  // Apply pagination
  const {
    paginatedData: events,
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
  } = usePagination(sortedEvents, 10, 'events')

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Breadcrumb 
              items={
                cluster
                  ? [
                      { name: cluster, href: "/dashboard" },
                      { name: 'Events' }
                    ]
                  : [{ name: 'Events' }]
              }
        />
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Events</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            All events across {clusters?.length || 0} cluster(s)
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by name, reason, message..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-11 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <ResizableTableHeader
                  label="Cluster"
                  columnKey="cluster"
                  sortKey="clusterName"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.cluster}
                />
                <ResizableTableHeader
                  label="Type"
                  columnKey="type"
                  sortKey="type"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.type}
                />
                <ResizableTableHeader
                  label="Reason"
                  columnKey="reason"
                  sortKey="reason"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.reason}
                />
                <ResizableTableHeader
                  label="Object"
                  columnKey="object"
                  sortKey="involvedObject.name"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.object}
                />
                <ResizableTableHeader
                  label="Message"
                  columnKey="message"
                  sortable={false}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.message}
                />
                <ResizableTableHeader
                  label="Age"
                  columnKey="age"
                  sortKey="metadata.creationTimestamp"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  onResizeStart={handleResizeStart}
                  width={columnWidths.age}
                />
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600"></div>
                      <span className="ml-3 text-gray-500 dark:text-gray-400">Loading events...</span>
                    </div>
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No events found</p>
                  </td>
                </tr>
              ) : (
                events.map((event, idx) => (
                  <tr key={`${event.clusterName}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-primary-600 dark:text-primary-400">
                      {event.clusterName}
                    </td>
                    <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                      <span
                        className={clsx(
                          'badge text-xs',
                          event.type === 'Normal' && 'badge-info',
                          event.type === 'Warning' && 'badge-warning'
                        )}
                      >
                        {event.type}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      {event.reason}
                    </td>
                    <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      <div className="truncate max-w-[150px] sm:max-w-none">
                        {event.involvedObject.kind}/{event.involvedObject.name}
                      </div>
                    </td>
                    <td 
                      className="px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400"
                      style={{ maxWidth: `${columnWidths.message}px` }}
                    >
                      <div className="break-words">
                        {event.message}
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      {formatAge(event.metadata.creationTimestamp)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={goToPage}
          onPageSizeChange={changePageSize}
          onNextPage={goToNextPage}
          onPreviousPage={goToPreviousPage}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
        />
      </div>
    </div>
  )
}

