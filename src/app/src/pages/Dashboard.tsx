import { Link } from 'react-router-dom'
import { useClusterStore } from '@/stores/clusterStore'
import { useNamespaceStore } from '@/stores/namespaceStore'
import {
  ServerIcon,
  CubeIcon,
  RocketLaunchIcon,
  GlobeAltIcon,
  Cog6ToothIcon,
  CircleStackIcon,
  ShieldCheckIcon,
  PuzzlePieceIcon,
  BellAlertIcon,
  ChevronRightIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/outline'
import Breadcrumb from '@/components/shared/Breadcrumb'

interface CategoryCard {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  color: string
  gradient: string
  stats?: string
}

export default function Dashboard() {
  const { selectedCluster } = useClusterStore()
  const { selectedNamespace } = useNamespaceStore()

  const getHref = (basePath: string) => {
    if (selectedCluster && selectedNamespace) {
      return `/clusters/${selectedCluster}/namespaces/${selectedNamespace}${basePath}`
    } else if (selectedCluster) {
      return `/clusters/${selectedCluster}${basePath}`
    }
    return basePath
  }

  const categories: CategoryCard[] = [
    {
      title: 'Nodes',
      description: 'View and manage cluster nodes',
      icon: ServerIcon,
      href: getHref('/nodes'),
      color: 'blue',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Namespaces',
      description: 'Organize and isolate resources',
      icon: ViewColumnsIcon,
      href: getHref('/namespaces'),
      color: 'purple',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Workloads',
      description: 'Pods, Deployments, StatefulSets & more',
      icon: RocketLaunchIcon,
      href: getHref('/pods'),
      color: 'green',
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      title: 'Network',
      description: 'Services, Ingresses & Network Policies',
      icon: GlobeAltIcon,
      href: getHref('/services'),
      color: 'indigo',
      gradient: 'from-indigo-500 to-blue-500',
    },
    {
      title: 'Config',
      description: 'ConfigMaps, Secrets & HPAs',
      icon: Cog6ToothIcon,
      href: getHref('/configmaps'),
      color: 'orange',
      gradient: 'from-orange-500 to-amber-500',
    },
    {
      title: 'Storage',
      description: 'Volumes, Claims & Storage Classes',
      icon: CircleStackIcon,
      href: getHref('/persistentvolumeclaims'),
      color: 'rose',
      gradient: 'from-rose-500 to-red-500',
    },
    {
      title: 'Access Control',
      description: 'RBAC, Service Accounts & Roles',
      icon: ShieldCheckIcon,
      href: getHref('/serviceaccounts'),
      color: 'teal',
      gradient: 'from-teal-500 to-cyan-500',
    },
    {
      title: 'Custom Resources',
      description: 'CRDs and custom resources',
      icon: PuzzlePieceIcon,
      href: getHref('/customresourcedefinitions'),
      color: 'violet',
      gradient: 'from-violet-500 to-purple-500',
    },
    {
      title: 'Events',
      description: 'Cluster events and activities',
      icon: BellAlertIcon,
      href: getHref('/events'),
      color: 'amber',
      gradient: 'from-amber-500 to-yellow-500',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb items={[]} />
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold gradient-text">
            Dashboard
          </h1>
        </div>
      </div>

      {/* Welcome Section */}
      <div className="card p-6 sm:p-8 bg-gradient-to-br from-primary-50 via-white to-purple-50 dark:from-gray-800 dark:via-gray-800 dark:to-purple-900/20 border-primary-100 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome to Kubelens! 👋
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-2xl">
              Manage your Kubernetes resources with ease. Select a category below to get started.
            </p>
            {selectedCluster && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <CubeIcon className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedCluster}
                </span>
                {selectedNamespace && selectedNamespace !== 'all' && (
                  <>
                    <span className="text-gray-400">/</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedNamespace}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
        {categories.map((category) => (
          <Link
            key={category.title}
            to={category.href}
            className="group card p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden"
          >
            {/* Background Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
            
            {/* Content */}
            <div className="relative">
              {/* Icon */}
              <div className={`p-3 rounded-xl bg-gradient-to-br ${category.gradient} w-fit mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                <category.icon className="h-7 w-7 text-white" />
              </div>

              {/* Title & Description */}
              <div className="mb-3">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {category.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {category.description}
                </p>
              </div>

              {/* Arrow Icon */}
              <div className="flex items-center justify-end">
                <div className="p-1 rounded-full bg-gray-100 dark:bg-gray-800 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-colors">
                  <ChevronRightIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transform group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            to="/clusters"
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group"
          >
            <ServerIcon className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Cluster Management
            </span>
          </Link>
          <Link
            to={getHref('/pods')}
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group"
          >
            <RocketLaunchIcon className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              View Pods
            </span>
          </Link>
          <Link
            to={getHref('/events')}
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all group"
          >
            <BellAlertIcon className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-amber-600 dark:group-hover:text-amber-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Check Events
            </span>
          </Link>
          <Link
            to={getHref('/customresourcedefinitions')}
            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-violet-500 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all group"
          >
            <PuzzlePieceIcon className="h-5 w-5 text-gray-600 dark:text-gray-400 group-hover:text-violet-600 dark:group-hover:text-violet-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              CRDs
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
