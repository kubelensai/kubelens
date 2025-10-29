import { useState, useMemo } from 'react'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CpuChipIcon,
  CircleStackIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { formatAge } from '@/utils/format'
import { DataTable, Column } from '@/components/shared/DataTable'

interface PodDetailContentProps {
  pod: any
  podMetrics?: any
}

// Helper function to get source type
function getEnvSource(env: any): string {
  if (env.value) return 'Direct'
  if (env.valueFrom?.configMapKeyRef) return 'ConfigMap'
  if (env.valueFrom?.secretKeyRef) return 'Secret'
  if (env.valueFrom?.fieldRef) return 'Field'
  return 'Other'
}

export default function PodDetailContent({ pod, podMetrics }: PodDetailContentProps) {
  const [expandedSections, setExpandedSections] = useState({
    basicInfo: false, // Collapsed by default
    containers: false, // Collapsed by default
    labels: false,
    annotations: false,
    nodeSelector: false,
    tolerations: false,
    affinity: false,
    volumes: false,
    initContainers: false,
    securityContext: false,
    dnsConfig: false,
  })
  const [expandedContainers, setExpandedContainers] = useState<Record<string, boolean>>({})
  const [expandedEnvVars, setExpandedEnvVars] = useState<Record<string, boolean>>({})

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const toggleContainer = (containerName: string) => {
    setExpandedContainers((prev) => ({ ...prev, [containerName]: !prev[containerName] }))
  }

  const toggleEnvVars = (containerName: string) => {
    setExpandedEnvVars((prev) => ({ ...prev, [containerName]: !prev[containerName] }))
  }

  // Define environment variables columns (outside of render to avoid hooks issues)
  const envVarColumns = useMemo<Column<any>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (env) => (
        <span className="font-mono font-semibold text-gray-900 dark:text-white text-xs">
          {env.name}
        </span>
      ),
      sortable: true,
      sortValue: (env) => env.name,
      searchValue: (env) => env.name, // Enable search
      className: 'font-mono text-xs',
      headerClassName: 'text-left',
    },
    {
      key: 'value',
      header: 'Value',
      accessor: (env) => (
        <span className="font-mono text-gray-600 dark:text-gray-400 text-xs break-all">
          {env.value || <span className="text-gray-400 dark:text-gray-500 italic">-</span>}
        </span>
      ),
      sortable: true,
      sortValue: (env) => env.value || '',
      searchValue: (env) => env.value || '', // Enable search
      className: 'font-mono text-xs',
      headerClassName: 'text-left',
    },
    {
      key: 'source',
      header: 'Source',
      accessor: (env) => {
        const source = getEnvSource(env)
        const colorMap: Record<string, string> = {
          Direct: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
          ConfigMap: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
          Secret: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
          Field: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
          Other: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
        }
        return (
          <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-xs', colorMap[source])}>
            {source}
          </span>
        )
      },
      sortable: true,
      sortValue: (env) => getEnvSource(env),
      searchValue: (env) => getEnvSource(env), // Enable search
      filterable: true,
      filterOptions: (data) => [...new Set(data.map(getEnvSource))].sort(),
      filterValue: (env) => getEnvSource(env), // For column filtering
      headerClassName: 'text-left',
    },
  ], [])

  const parseK8sResource = (value: string): number => {
    if (!value) return 0
    if (value.endsWith('m')) {
      return parseInt(value.replace('m', ''))
    }
    if (value.endsWith('n')) {
      return parseInt(value.replace('n', '')) / 1000000
    }
    if (value.endsWith('Ki')) {
      return parseInt(value.replace('Ki', '')) * 1024
    }
    if (value.endsWith('Mi')) {
      return parseInt(value.replace('Mi', '')) * 1024 * 1024
    }
    if (value.endsWith('Gi')) {
      return parseInt(value.replace('Gi', '')) * 1024 * 1024 * 1024
    }
    const num = parseFloat(value)
    return isNaN(num) ? 0 : num * 1000
  }

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const formatCPU = (millicores: number) => {
    if (!millicores || millicores === 0) return '0m'
    if (millicores < 1000) return `${millicores}m`
    return `${(millicores / 1000).toFixed(2)} cores`
  }

  const calculatePercentage = (used: number, total: number) => {
    if (!total || total === 0) return 0
    return Math.min((used / total) * 100, 100)
  }

  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <div>
        <button
          onClick={() => toggleSection('basicInfo')}
          className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-300"
        >
          {expandedSections.basicInfo ? (
            <ChevronUpIcon className="w-4 h-4 flex-shrink-0" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
          )}
          <span>Basic Information & Configuration</span>
        </button>
        {expandedSections.basicInfo && (
          <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Status:</span>
                <p className="font-medium text-gray-900 dark:text-white">{pod.status?.phase || 'Unknown'}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Node:</span>
                <p className="font-medium text-gray-900 dark:text-white">{pod.spec?.nodeName || 'N/A'}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">QoS Class:</span>
                <p className="font-medium text-gray-900 dark:text-white">{pod.status?.qosClass || 'N/A'}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Age:</span>
                <p className="font-medium text-gray-900 dark:text-white">{formatAge(pod.metadata.creationTimestamp)}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Service Account:</span>
                <p className="font-medium text-gray-900 dark:text-white">{pod.spec?.serviceAccountName || 'default'}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Restart Policy:</span>
                <p className="font-medium text-gray-900 dark:text-white">{pod.spec?.restartPolicy || 'Always'}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">DNS Policy:</span>
                <p className="font-medium text-gray-900 dark:text-white">{pod.spec?.dnsPolicy || 'ClusterFirst'}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Termination Grace:</span>
                <p className="font-medium text-gray-900 dark:text-white">{pod.spec?.terminationGracePeriodSeconds || 30}s</p>
              </div>
              {pod.spec?.priorityClassName && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Priority Class:</span>
                  <p className="font-medium text-gray-900 dark:text-white">{pod.spec.priorityClassName}</p>
                </div>
              )}
              {pod.spec?.priority !== undefined && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Priority:</span>
                  <p className="font-medium text-gray-900 dark:text-white">{pod.spec.priority}</p>
                </div>
              )}
              {pod.spec?.hostNetwork && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Host Network:</span>
                  <p className="font-medium text-green-600 dark:text-green-400">Enabled</p>
                </div>
              )}
              {pod.spec?.hostPID && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Host PID:</span>
                  <p className="font-medium text-green-600 dark:text-green-400">Enabled</p>
                </div>
              )}
              {pod.spec?.hostIPC && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Host IPC:</span>
                  <p className="font-medium text-green-600 dark:text-green-400">Enabled</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Containers */}
      <div>
        <button
          onClick={() => toggleSection('containers')}
          className="flex items-center gap-2 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
        >
          {expandedSections.containers ? (
            <ChevronUpIcon className="w-4 h-4 flex-shrink-0" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
          )}
          <span>Containers ({pod.spec?.containers?.length || 0})</span>
        </button>
        {expandedSections.containers && (
          <div className="space-y-4">
            {pod.spec?.containers?.map((container: any, index: number) => {
              const containerStatus = pod.status?.containerStatuses?.find((cs: any) => cs.name === container.name)
              const containerMetrics = podMetrics?.containers?.find((cm: any) => cm.name === container.name)
              
              const cpuLimit = container.resources?.limits?.cpu ? parseK8sResource(container.resources.limits.cpu) : 0
              const memLimit = container.resources?.limits?.memory ? parseK8sResource(container.resources.limits.memory) : 0
              const cpuRequest = container.resources?.requests?.cpu ? parseK8sResource(container.resources.requests.cpu) : 0
              const memRequest = container.resources?.requests?.memory ? parseK8sResource(container.resources.requests.memory) : 0
              
              let cpuUsage = 0
              let memUsage = 0
              if (containerMetrics?.usage) {
                const cpuStr = containerMetrics.usage.cpu || '0'
                if (cpuStr.endsWith('m')) {
                  cpuUsage = parseInt(cpuStr.replace('m', ''))
                } else if (cpuStr.endsWith('n')) {
                  cpuUsage = parseInt(cpuStr.replace('n', '')) / 1000000
                } else {
                  cpuUsage = parseFloat(cpuStr) * 1000
                }
                
                const memStr = containerMetrics.usage.memory || '0'
                if (memStr.endsWith('Ki')) {
                  memUsage = parseInt(memStr.replace('Ki', '')) * 1024
                } else if (memStr.endsWith('Mi')) {
                  memUsage = parseInt(memStr.replace('Mi', '')) * 1024 * 1024
                } else if (memStr.endsWith('Gi')) {
                  memUsage = parseInt(memStr.replace('Gi', '')) * 1024 * 1024 * 1024
                } else {
                  memUsage = parseInt(memStr)
                }
              }

              const isExpanded = expandedContainers[container.name]

              return (
                <div key={index} className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                  {/* Header */}
                  <div className="relative">
                    {/* Status indicator bar */}
                    <div className={clsx(
                      'absolute top-0 left-0 right-0 h-1',
                      containerStatus?.state?.running
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                        : containerStatus?.state?.waiting
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                        : containerStatus?.state?.terminated
                        ? 'bg-gradient-to-r from-red-500 to-pink-500'
                        : 'bg-gradient-to-r from-gray-400 to-gray-500'
                    )} />
                    
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Container name and toggle */}
                        <button
                          onClick={() => toggleContainer(container.name)}
                          className="flex items-center gap-3 flex-1 text-left group/btn"
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                            {container.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate group-hover/btn:text-blue-600 dark:group-hover/btn:text-blue-400 transition-colors">
                              {container.name}
                            </h5>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                              {container.image.split('/').pop()}
                            </p>
                          </div>
                          {isExpanded ? (
                            <ChevronUpIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronDownIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          )}
                        </button>
                        
                        {/* Status badge */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={clsx(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                            containerStatus?.state?.running
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : containerStatus?.state?.waiting
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : containerStatus?.state?.terminated
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                          )}>
                            <span className={clsx(
                              'w-1.5 h-1.5 rounded-full',
                              containerStatus?.state?.running ? 'bg-green-500 animate-pulse' :
                              containerStatus?.state?.waiting ? 'bg-yellow-500' :
                              containerStatus?.state?.terminated ? 'bg-red-500' :
                              'bg-gray-400'
                            )} />
                            {containerStatus?.state?.running ? 'Running' : 
                             containerStatus?.state?.waiting ? 'Waiting' : 
                             containerStatus?.state?.terminated ? 'Terminated' : 'Unknown'}
                          </span>
                          {containerStatus && containerStatus.restartCount > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                              {containerStatus.restartCount} restart{containerStatus.restartCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Resource metrics - Always visible */}
                      {(cpuUsage > 0 || memUsage > 0) && (
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* CPU */}
                          {cpuUsage > 0 && (
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg p-3 border border-blue-100 dark:border-blue-900/50">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-blue-500 dark:bg-blue-600 flex items-center justify-center">
                                    <CpuChipIcon className="w-4 h-4 text-white" />
                                  </div>
                                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">CPU</span>
                                </div>
                                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                  {formatCPU(cpuUsage)}
                                  {cpuLimit > 0 && ` / ${formatCPU(cpuLimit)}`}
                                </span>
                              </div>
                              {cpuLimit > 0 && (
                                <>
                                  <div className="relative w-full h-2 bg-blue-200 dark:bg-blue-900/50 rounded-full overflow-hidden">
                                    <div
                                      className={clsx(
                                        'absolute top-0 left-0 h-full rounded-full transition-all duration-300',
                                        calculatePercentage(cpuUsage, cpuLimit) >= 90 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                                        calculatePercentage(cpuUsage, cpuLimit) >= 75 ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                                        'bg-gradient-to-r from-blue-500 to-indigo-600'
                                      )}
                                      style={{ width: `${calculatePercentage(cpuUsage, cpuLimit)}%` }}
                                    />
                                  </div>
                                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                    {calculatePercentage(cpuUsage, cpuLimit).toFixed(1)}% utilized
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                          
                          {/* Memory */}
                          {memUsage > 0 && (
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg p-3 border border-green-100 dark:border-green-900/50">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-green-500 dark:bg-green-600 flex items-center justify-center">
                                    <CircleStackIcon className="w-4 h-4 text-white" />
                                  </div>
                                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Memory</span>
                                </div>
                                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                  {formatBytes(memUsage)}
                                  {memLimit > 0 && ` / ${formatBytes(memLimit)}`}
                                </span>
                              </div>
                              {memLimit > 0 && (
                                <>
                                  <div className="relative w-full h-2 bg-green-200 dark:bg-green-900/50 rounded-full overflow-hidden">
                                    <div
                                      className={clsx(
                                        'absolute top-0 left-0 h-full rounded-full transition-all duration-300',
                                        calculatePercentage(memUsage, memLimit) >= 90 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                                        calculatePercentage(memUsage, memLimit) >= 75 ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                                        'bg-gradient-to-r from-green-500 to-emerald-600'
                                      )}
                                      style={{ width: `${calculatePercentage(memUsage, memLimit)}%` }}
                                    />
                                  </div>
                                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                    {calculatePercentage(memUsage, memLimit).toFixed(1)}% utilized
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      <div className="p-4 sm:p-5 space-y-4">
                      {/* Basic Info */}
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <h6 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">Basic Information</h6>
                        <div className="space-y-2.5 text-sm">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-1">
                            <span className="text-gray-500 dark:text-gray-400 text-xs font-medium min-w-[100px]">Image:</span>
                            <p className="font-mono text-gray-900 dark:text-white break-all text-xs flex-1">{container.image}</p>
                          </div>
                          {container.imagePullPolicy && (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                              <span className="text-gray-500 dark:text-gray-400 text-xs font-medium min-w-[100px]">Pull Policy:</span>
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white w-fit">{container.imagePullPolicy}</span>
                            </div>
                          )}
                          {container.workingDir && (
                            <div className="flex flex-col sm:flex-row sm:items-start gap-1">
                              <span className="text-gray-500 dark:text-gray-400 text-xs font-medium min-w-[100px]">Working Dir:</span>
                              <p className="font-mono text-gray-900 dark:text-white text-xs">{container.workingDir}</p>
                            </div>
                          )}
                          {container.command && container.command.length > 0 && (
                            <div className="flex flex-col gap-1">
                              <span className="text-gray-500 dark:text-gray-400 text-xs font-medium">Command:</span>
                              <div className="p-2.5 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 font-mono text-xs text-gray-900 dark:text-white overflow-x-auto">
                                {container.command.join(' ')}
                              </div>
                            </div>
                          )}
                          {container.args && container.args.length > 0 && (
                            <div className="flex flex-col gap-1">
                              <span className="text-gray-500 dark:text-gray-400 text-xs font-medium">Arguments:</span>
                              <div className="p-2.5 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 font-mono text-xs text-gray-900 dark:text-white overflow-x-auto">
                                {container.args.join(' ')}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Resources Details */}
                      {(cpuRequest > 0 || cpuLimit > 0 || memRequest > 0 || memLimit > 0) && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                          <h6 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">Resource Allocation</h6>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            {(cpuRequest > 0 || cpuLimit > 0) && (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
                                  <CpuChipIcon className="w-4 h-4 text-blue-500" />
                                  <span>CPU</span>
                                </div>
                                {cpuRequest > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-500 dark:text-gray-400">Request:</span>
                                    <span className="font-mono text-gray-900 dark:text-white">{formatCPU(cpuRequest)}</span>
                                  </div>
                                )}
                                {cpuLimit > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-500 dark:text-gray-400">Limit:</span>
                                    <span className="font-mono text-gray-900 dark:text-white">{formatCPU(cpuLimit)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            {(memRequest > 0 || memLimit > 0) && (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
                                  <CircleStackIcon className="w-4 h-4 text-green-500" />
                                  <span>Memory</span>
                                </div>
                                {memRequest > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-500 dark:text-gray-400">Request:</span>
                                    <span className="font-mono text-gray-900 dark:text-white">{formatBytes(memRequest)}</span>
                                  </div>
                                )}
                                {memLimit > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-500 dark:text-gray-400">Limit:</span>
                                    <span className="font-mono text-gray-900 dark:text-white">{formatBytes(memLimit)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Ports */}
                      {container.ports && container.ports.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                          <h6 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">Exposed Ports</h6>
                          <div className="flex flex-wrap gap-2">
                            {container.ports.map((port: any, i: number) => (
                              <div key={i} className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                                {port.name && <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{port.name}:</span>}
                                <span className="text-xs font-mono font-semibold text-gray-900 dark:text-white">{port.containerPort}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">/{port.protocol || 'TCP'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Environment Variables */}
                      {container.env && container.env.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <button
                            onClick={() => toggleEnvVars(container.name)}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                          >
                            <h6 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                              Environment Variables ({container.env.length})
                            </h6>
                            {expandedEnvVars[container.name] ? (
                              <ChevronUpIcon className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                          {expandedEnvVars[container.name] && (
                            <div className="border-t border-gray-200 dark:border-gray-700">
                              <DataTable
                                data={container.env}
                                columns={envVarColumns}
                                keyExtractor={(env: any) => env.name}
                                searchPlaceholder="Search environment variables..."
                                emptyMessage="No environment variables found"
                                showPagination={false}
                                pageSize={50}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Volume Mounts */}
                      {container.volumeMounts && container.volumeMounts.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                          <h6 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">Volume Mounts ({container.volumeMounts.length})</h6>
                          <div className="max-h-48 overflow-y-auto space-y-2">
                            {container.volumeMounts.map((mount: any, i: number) => (
                              <div key={i} className="p-2.5 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                                <div className="font-mono text-gray-900 dark:text-white text-xs font-semibold mb-1">{mount.name}</div>
                                <div className="text-gray-600 dark:text-gray-400 text-xs flex items-center gap-1">
                                  <span>→</span>
                                  <span className="font-mono">{mount.mountPath}</span>
                                </div>
                                {(mount.readOnly || mount.subPath) && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {mount.readOnly && (
                                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">read-only</span>
                                    )}
                                    {mount.subPath && (
                                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-mono">subPath: {mount.subPath}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Probes */}
                      {(container.livenessProbe || container.readinessProbe || container.startupProbe) && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                          <h6 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">Health Probes</h6>
                          <div className="space-y-3">
                            {container.livenessProbe && (
                              <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border border-green-200 dark:border-green-800">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                  <div className="font-semibold text-green-700 dark:text-green-300 text-xs">Liveness Probe</div>
                                </div>
                                <div className="space-y-1.5 text-xs">
                                  <div className="font-mono text-gray-900 dark:text-white">
                                    {container.livenessProbe.httpGet && `HTTP GET ${container.livenessProbe.httpGet.path}:${container.livenessProbe.httpGet.port}`}
                                    {container.livenessProbe.exec && `Exec: ${container.livenessProbe.exec.command?.join(' ')}`}
                                    {container.livenessProbe.tcpSocket && `TCP ${container.livenessProbe.tcpSocket.port}`}
                                    {container.livenessProbe.grpc && `gRPC ${container.livenessProbe.grpc.port}${container.livenessProbe.grpc.service ? ` (${container.livenessProbe.grpc.service})` : ''}`}
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                    {container.livenessProbe.initialDelaySeconds !== undefined && (
                                      <div className="text-gray-600 dark:text-gray-400">
                                        <span className="font-medium">Delay:</span> {container.livenessProbe.initialDelaySeconds}s
                                      </div>
                                    )}
                                    {container.livenessProbe.periodSeconds !== undefined && (
                                      <div className="text-gray-600 dark:text-gray-400">
                                        <span className="font-medium">Period:</span> {container.livenessProbe.periodSeconds}s
                                      </div>
                                    )}
                                    {container.livenessProbe.timeoutSeconds !== undefined && (
                                      <div className="text-gray-600 dark:text-gray-400">
                                        <span className="font-medium">Timeout:</span> {container.livenessProbe.timeoutSeconds}s
                                      </div>
                                    )}
                                    {container.livenessProbe.failureThreshold !== undefined && (
                                      <div className="text-gray-600 dark:text-gray-400">
                                        <span className="font-medium">Failures:</span> {container.livenessProbe.failureThreshold}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            {container.readinessProbe && (
                              <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  <div className="font-semibold text-blue-700 dark:text-blue-300 text-xs">Readiness Probe</div>
                                </div>
                                <div className="space-y-1.5 text-xs">
                                  <div className="font-mono text-gray-900 dark:text-white">
                                    {container.readinessProbe.httpGet && `HTTP GET ${container.readinessProbe.httpGet.path}:${container.readinessProbe.httpGet.port}`}
                                    {container.readinessProbe.exec && `Exec: ${container.readinessProbe.exec.command?.join(' ')}`}
                                    {container.readinessProbe.tcpSocket && `TCP ${container.readinessProbe.tcpSocket.port}`}
                                    {container.readinessProbe.grpc && `gRPC ${container.readinessProbe.grpc.port}${container.readinessProbe.grpc.service ? ` (${container.readinessProbe.grpc.service})` : ''}`}
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                    {container.readinessProbe.initialDelaySeconds !== undefined && (
                                      <div className="text-gray-600 dark:text-gray-400">
                                        <span className="font-medium">Delay:</span> {container.readinessProbe.initialDelaySeconds}s
                                      </div>
                                    )}
                                    {container.readinessProbe.periodSeconds !== undefined && (
                                      <div className="text-gray-600 dark:text-gray-400">
                                        <span className="font-medium">Period:</span> {container.readinessProbe.periodSeconds}s
                                      </div>
                                    )}
                                    {container.readinessProbe.timeoutSeconds !== undefined && (
                                      <div className="text-gray-600 dark:text-gray-400">
                                        <span className="font-medium">Timeout:</span> {container.readinessProbe.timeoutSeconds}s
                                      </div>
                                    )}
                                    {container.readinessProbe.failureThreshold !== undefined && (
                                      <div className="text-gray-600 dark:text-gray-400">
                                        <span className="font-medium">Failures:</span> {container.readinessProbe.failureThreshold}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            {container.startupProbe && (
                              <div className="p-3 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                  <div className="font-semibold text-yellow-700 dark:text-yellow-300 text-xs">Startup Probe</div>
                                </div>
                                <div className="space-y-1.5 text-xs">
                                  <div className="font-mono text-gray-900 dark:text-white">
                                    {container.startupProbe.httpGet && `HTTP GET ${container.startupProbe.httpGet.path}:${container.startupProbe.httpGet.port}`}
                                    {container.startupProbe.exec && `Exec: ${container.startupProbe.exec.command?.join(' ')}`}
                                    {container.startupProbe.tcpSocket && `TCP ${container.startupProbe.tcpSocket.port}`}
                                    {container.startupProbe.grpc && `gRPC ${container.startupProbe.grpc.port}${container.startupProbe.grpc.service ? ` (${container.startupProbe.grpc.service})` : ''}`}
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                    {container.startupProbe.initialDelaySeconds !== undefined && (
                                      <div className="text-gray-600 dark:text-gray-400">
                                        <span className="font-medium">Delay:</span> {container.startupProbe.initialDelaySeconds}s
                                      </div>
                                    )}
                                    {container.startupProbe.periodSeconds !== undefined && (
                                      <div className="text-gray-600 dark:text-gray-400">
                                        <span className="font-medium">Period:</span> {container.startupProbe.periodSeconds}s
                                      </div>
                                    )}
                                    {container.startupProbe.timeoutSeconds !== undefined && (
                                      <div className="text-gray-600 dark:text-gray-400">
                                        <span className="font-medium">Timeout:</span> {container.startupProbe.timeoutSeconds}s
                                      </div>
                                    )}
                                    {container.startupProbe.failureThreshold !== undefined && (
                                      <div className="text-gray-600 dark:text-gray-400">
                                        <span className="font-medium">Failures:</span> {container.startupProbe.failureThreshold}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Security Context */}
                      {container.securityContext && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                          <h6 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">Security Context</h6>
                          <div className="p-3 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/30 dark:to-pink-950/30 rounded-lg border border-red-200 dark:border-red-800 space-y-2 text-xs">
                            {container.securityContext.runAsUser !== undefined && (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 dark:text-gray-400">Run As User:</span>
                                <span className="font-mono font-semibold text-gray-900 dark:text-white">{container.securityContext.runAsUser}</span>
                              </div>
                            )}
                            {container.securityContext.runAsGroup !== undefined && (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 dark:text-gray-400">Run As Group:</span>
                                <span className="font-mono font-semibold text-gray-900 dark:text-white">{container.securityContext.runAsGroup}</span>
                              </div>
                            )}
                            {container.securityContext.privileged && (
                              <div className="px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded text-red-700 dark:text-red-400 font-semibold">⚠️ Privileged Mode Enabled</div>
                            )}
                            {container.securityContext.allowPrivilegeEscalation !== undefined && (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 dark:text-gray-400">Privilege Escalation:</span>
                                <span className={container.securityContext.allowPrivilegeEscalation ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-green-600 dark:text-green-400 font-semibold'}>
                                  {container.securityContext.allowPrivilegeEscalation ? 'Allowed' : 'Blocked'}
                                </span>
                              </div>
                            )}
                            {container.securityContext.readOnlyRootFilesystem && (
                              <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded text-green-700 dark:text-green-400 font-semibold">✓ Read-Only Root Filesystem</div>
                            )}
                            {container.securityContext.capabilities && (
                              <div className="space-y-1">
                                {container.securityContext.capabilities.add && container.securityContext.capabilities.add.length > 0 && (
                                  <div>
                                    <span className="text-gray-600 dark:text-gray-400 block mb-1">Added Capabilities:</span>
                                    <div className="flex flex-wrap gap-1">
                                      {container.securityContext.capabilities.add.map((cap: string, i: number) => (
                                        <span key={i} className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded font-mono text-xs">{cap}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {container.securityContext.capabilities.drop && container.securityContext.capabilities.drop.length > 0 && (
                                  <div>
                                    <span className="text-gray-600 dark:text-gray-400 block mb-1">Dropped Capabilities:</span>
                                    <div className="flex flex-wrap gap-1">
                                      {container.securityContext.capabilities.drop.map((cap: string, i: number) => (
                                        <span key={i} className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded font-mono text-xs">{cap}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Lifecycle */}
                      {container.lifecycle && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                          <h6 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">Lifecycle Hooks</h6>
                          <div className="space-y-2">
                            {container.lifecycle.postStart && (
                              <div className="p-3 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="font-semibold text-blue-700 dark:text-blue-300 text-xs mb-1">PostStart</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                                  {container.lifecycle.postStart.exec && `Exec: ${container.lifecycle.postStart.exec.command?.join(' ')}`}
                                  {container.lifecycle.postStart.httpGet && `HTTP GET ${container.lifecycle.postStart.httpGet.path}`}
                                </div>
                              </div>
                            )}
                            {container.lifecycle.preStop && (
                              <div className="p-3 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                                <div className="font-semibold text-orange-700 dark:text-orange-300 text-xs mb-1">PreStop</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                                  {container.lifecycle.preStop.exec && `Exec: ${container.lifecycle.preStop.exec.command?.join(' ')}`}
                                  {container.lifecycle.preStop.httpGet && `HTTP GET ${container.lifecycle.preStop.httpGet.path}`}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Labels */}
      {pod.metadata?.labels && Object.keys(pod.metadata.labels).length > 0 && (
        <div>
          <button
            onClick={() => toggleSection('labels')}
            className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            {expandedSections.labels ? (
              <ChevronUpIcon className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
            )}
            <span>Labels ({Object.keys(pod.metadata.labels).length})</span>
          </button>
          {expandedSections.labels && (
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {Object.entries(pod.metadata.labels).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{key}</span>
                    <span className="text-xs font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-700">
                      {value as string}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Annotations */}
      {pod.metadata?.annotations && Object.keys(pod.metadata.annotations).length > 0 && (
        <div>
          <button
            onClick={() => toggleSection('annotations')}
            className="flex items-center gap-2 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
          >
            {expandedSections.annotations ? (
              <ChevronUpIcon className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
            )}
            <span>Annotations ({Object.keys(pod.metadata.annotations).length})</span>
          </button>
          {expandedSections.annotations && (
            <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(pod.metadata.annotations).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">{key}</span>
                  <p className="text-xs font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-700 break-all">
                    {value as string}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Init Containers */}
      {pod.spec?.initContainers && pod.spec.initContainers.length > 0 && (
        <div>
          <button
            onClick={() => toggleSection('initContainers')}
            className="flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
          >
            {expandedSections.initContainers ? (
              <ChevronUpIcon className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
            )}
            <span>Init Containers ({pod.spec.initContainers.length})</span>
          </button>
          {expandedSections.initContainers && (
            <div className="mt-2 p-3 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg border border-indigo-200 dark:border-indigo-800 space-y-2">
              {pod.spec.initContainers.map((container: any, index: number) => {
                const containerStatus = pod.status?.initContainerStatuses?.find((cs: any) => cs.name === container.name)
                return (
                  <div key={index} className="p-2 bg-white dark:bg-gray-800 rounded border border-indigo-200 dark:border-indigo-700">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">{container.name}</span>
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded-full',
                        containerStatus?.state?.terminated?.reason === 'Completed'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                      )}>
                        {containerStatus?.state?.terminated?.reason || containerStatus?.state?.waiting?.reason || 'Unknown'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-mono break-all">{container.image}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Volumes */}
      {pod.spec?.volumes && pod.spec.volumes.length > 0 && (
        <div>
          <button
            onClick={() => toggleSection('volumes')}
            className="flex items-center gap-2 text-sm font-semibold text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300"
          >
            {expandedSections.volumes ? (
              <ChevronUpIcon className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
            )}
            <span>Volumes ({pod.spec.volumes.length})</span>
          </button>
          {expandedSections.volumes && (
            <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800 space-y-2 max-h-48 overflow-y-auto">
              {pod.spec.volumes.map((volume: any, index: number) => {
                const volumeType = Object.keys(volume).find(k => k !== 'name') || 'unknown'
                return (
                  <div key={index} className="p-2 bg-white dark:bg-gray-800 rounded border border-yellow-200 dark:border-yellow-700">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">{volume.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                        {volumeType}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {volume.configMap && <span>ConfigMap: {volume.configMap.name}</span>}
                      {volume.secret && <span>Secret: {volume.secret.secretName}</span>}
                      {volume.persistentVolumeClaim && <span>PVC: {volume.persistentVolumeClaim.claimName}</span>}
                      {volume.emptyDir && <span>EmptyDir</span>}
                      {volume.hostPath && <span>HostPath: {volume.hostPath.path}</span>}
                      {volume.projected && <span>Projected ({volume.projected.sources?.length || 0} sources)</span>}
                      {volume.downwardAPI && <span>DownwardAPI</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Security Context */}
      {pod.spec?.securityContext && (
        <div>
          <button
            onClick={() => toggleSection('securityContext')}
            className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
          >
            {expandedSections.securityContext ? (
              <ChevronUpIcon className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
            )}
            <span>Security Context</span>
          </button>
          {expandedSections.securityContext && (
            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {pod.spec.securityContext.runAsUser !== undefined && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Run As User:</span>
                    <p className="font-mono text-gray-900 dark:text-white">{pod.spec.securityContext.runAsUser}</p>
                  </div>
                )}
                {pod.spec.securityContext.runAsGroup !== undefined && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Run As Group:</span>
                    <p className="font-mono text-gray-900 dark:text-white">{pod.spec.securityContext.runAsGroup}</p>
                  </div>
                )}
                {pod.spec.securityContext.fsGroup !== undefined && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">FS Group:</span>
                    <p className="font-mono text-gray-900 dark:text-white">{pod.spec.securityContext.fsGroup}</p>
                  </div>
                )}
                {pod.spec.securityContext.runAsNonRoot !== undefined && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Run As Non-Root:</span>
                    <p className="font-medium text-gray-900 dark:text-white">{pod.spec.securityContext.runAsNonRoot ? 'Yes' : 'No'}</p>
                  </div>
                )}
                {pod.spec.securityContext.fsGroupChangePolicy && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">FS Group Policy:</span>
                    <p className="font-medium text-gray-900 dark:text-white">{pod.spec.securityContext.fsGroupChangePolicy}</p>
                  </div>
                )}
                {pod.spec.securityContext.seccompProfile && (
                  <div className="col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">Seccomp Profile:</span>
                    <p className="font-mono text-gray-900 dark:text-white">
                      {pod.spec.securityContext.seccompProfile.type}
                      {pod.spec.securityContext.seccompProfile.localhostProfile && ` (${pod.spec.securityContext.seccompProfile.localhostProfile})`}
                    </p>
                  </div>
                )}
                {pod.spec.securityContext.seLinuxOptions && (
                  <div className="col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">SELinux:</span>
                    <p className="font-mono text-gray-900 dark:text-white text-xs">
                      {JSON.stringify(pod.spec.securityContext.seLinuxOptions)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DNS Config */}
      {pod.spec?.dnsConfig && (
        <div>
          <button
            onClick={() => toggleSection('dnsConfig')}
            className="flex items-center gap-2 text-sm font-semibold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300"
          >
            {expandedSections.dnsConfig ? (
              <ChevronUpIcon className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
            )}
            <span>DNS Configuration</span>
          </button>
          {expandedSections.dnsConfig && (
            <div className="mt-2 p-3 bg-pink-50 dark:bg-pink-900/10 rounded-lg border border-pink-200 dark:border-pink-800 space-y-2">
              {pod.spec.dnsConfig.nameservers && pod.spec.dnsConfig.nameservers.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-pink-700 dark:text-pink-300">Nameservers:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {pod.spec.dnsConfig.nameservers.map((ns: string, i: number) => (
                      <span key={i} className="text-xs font-mono bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-pink-200 dark:border-pink-700">
                        {ns}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {pod.spec.dnsConfig.searches && pod.spec.dnsConfig.searches.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-pink-700 dark:text-pink-300">Search Domains:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {pod.spec.dnsConfig.searches.map((search: string, i: number) => (
                      <span key={i} className="text-xs font-mono bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-pink-200 dark:border-pink-700">
                        {search}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {pod.spec.dnsConfig.options && pod.spec.dnsConfig.options.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-pink-700 dark:text-pink-300">Options:</span>
                  <div className="space-y-1 mt-1">
                    {pod.spec.dnsConfig.options.map((opt: any, i: number) => (
                      <div key={i} className="text-xs font-mono bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-pink-200 dark:border-pink-700">
                        {opt.name}{opt.value && `: ${opt.value}`}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Node Selector */}
      {pod.spec?.nodeSelector && Object.keys(pod.spec.nodeSelector).length > 0 && (
        <div>
          <button
            onClick={() => toggleSection('nodeSelector')}
            className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            {expandedSections.nodeSelector ? (
              <ChevronUpIcon className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
            )}
            <span>Node Selector ({Object.keys(pod.spec.nodeSelector).length})</span>
          </button>
          {expandedSections.nodeSelector && (
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="space-y-2">
                {Object.entries(pod.spec.nodeSelector).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{key}:</span>
                    <span className="text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-700">
                      {value as string}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tolerations */}
      {pod.spec?.tolerations && pod.spec.tolerations.length > 0 && (
        <div>
          <button
            onClick={() => toggleSection('tolerations')}
            className="flex items-center gap-2 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
          >
            {expandedSections.tolerations ? (
              <ChevronUpIcon className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
            )}
            <span>Tolerations ({pod.spec.tolerations.length})</span>
          </button>
          {expandedSections.tolerations && (
            <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 space-y-2 max-h-48 overflow-y-auto">
              {pod.spec.tolerations.map((toleration: any, index: number) => (
                <div key={index} className="p-2 bg-white dark:bg-gray-800 rounded border border-purple-200 dark:border-purple-700">
                  <div className="space-y-1 text-xs">
                    {toleration.key && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Key:</span>
                        <span className="ml-2 font-mono text-gray-900 dark:text-white">{toleration.key}</span>
                      </div>
                    )}
                    {toleration.operator && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Operator:</span>
                        <span className="ml-2 font-mono text-gray-900 dark:text-white">{toleration.operator}</span>
                      </div>
                    )}
                    {toleration.value && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Value:</span>
                        <span className="ml-2 font-mono text-gray-900 dark:text-white">{toleration.value}</span>
                      </div>
                    )}
                    {toleration.effect && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Effect:</span>
                        <span className="ml-2 font-mono text-gray-900 dark:text-white">{toleration.effect}</span>
                      </div>
                    )}
                    {toleration.tolerationSeconds !== undefined && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Toleration Seconds:</span>
                        <span className="ml-2 font-mono text-gray-900 dark:text-white">{toleration.tolerationSeconds}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Affinity */}
      {pod.spec?.affinity && (
        <div>
          <button
            onClick={() => toggleSection('affinity')}
            className="flex items-center gap-2 text-sm font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
          >
            {expandedSections.affinity ? (
              <ChevronUpIcon className="w-4 h-4 flex-shrink-0" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
            )}
            <span>Affinity</span>
          </button>
          {expandedSections.affinity && (
            <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800 space-y-3 max-h-48 overflow-y-auto">
              {pod.spec.affinity.nodeAffinity && (
                <div>
                  <h5 className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Node Affinity</h5>
                  <pre className="text-xs font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 p-2 rounded border border-green-200 dark:border-green-700 overflow-x-auto">
                    {JSON.stringify(pod.spec.affinity.nodeAffinity, null, 2)}
                  </pre>
                </div>
              )}
              {pod.spec.affinity.podAffinity && (
                <div>
                  <h5 className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Pod Affinity</h5>
                  <pre className="text-xs font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 p-2 rounded border border-green-200 dark:border-green-700 overflow-x-auto">
                    {JSON.stringify(pod.spec.affinity.podAffinity, null, 2)}
                  </pre>
                </div>
              )}
              {pod.spec.affinity.podAntiAffinity && (
                <div>
                  <h5 className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Pod Anti-Affinity</h5>
                  <pre className="text-xs font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 p-2 rounded border border-green-200 dark:border-green-700 overflow-x-auto">
                    {JSON.stringify(pod.spec.affinity.podAntiAffinity, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

