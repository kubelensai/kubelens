import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ServerIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useClusters } from '@/hooks/useClusters'

interface RequireEnabledClusterProps {
  children: ReactNode
}

export default function RequireEnabledCluster({ children }: RequireEnabledClusterProps) {
  const { data: enabledClusters, isLoading } = useClusters(true)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!enabledClusters || enabledClusters.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
            <ExclamationTriangleIcon className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            No Enabled Clusters
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            You need to enable at least one cluster to access this page. Please go to Cluster Management to enable a cluster or import a new one.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              to="/clusters"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
            >
              <ServerIcon className="h-4 w-4" />
              Go to Cluster Management
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

