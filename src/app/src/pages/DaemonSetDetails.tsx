import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  ServerStackIcon,
  ArrowPathIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CommandLineIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  CpuChipIcon,
  CircleStackIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import Breadcrumb from '@/components/shared/Breadcrumb'
import YamlEditor from '@/components/shared/YamlEditor'
import Terminal from '@/components/shared/Terminal'
import EnhancedMultiPodLogViewer from '@/components/shared/EnhancedMultiPodLogViewer'
import PodDetailContent from '@/components/shared/PodDetailContent'
import { DataTable, Column } from '@/components/shared/DataTable'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import yaml from 'js-yaml'
import { formatAge } from '@/utils/format'

interface DaemonSetDetailsProps {}

type TabType = 'overview' | 'yaml' | 'pods' | 'terminal' | 'logs' | 'events'

export default function DaemonSetDetails({}: DaemonSetDetailsProps) {
  const { cluster, namespace, daemonsetName } = useParams<{ cluster: string; namespace: string; daemonsetName: string }>()
  const navigate = useNavigate()
  const { addNotification } = useNotificationStore()
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as TabType | null
  const [activeTab, setActiveTab] = useState<TabType>(tabParam || 'overview')
  const [daemonset, setDaemonSet] = useState<any>(null)
  const [pods, setPods] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [yamlContent, setYamlContent] = useState('')
  const [selectedPod, setSelectedPod] = useState<string>('')
  const [selectedContainer, setSelectedContainer] = useState<string>('')
  const [selectedShell, setSelectedShell] = useState<string>('/bin/sh')
  const [expandedSections, setExpandedSections] = useState({
    labels: false,
    annotations: false,
    falseConditions: false,
    nodeSelector: false,
    tolerations: false,
    affinity: false,
  })
  const [podMetrics, setPodMetrics] = useState<Record<string, any>>({})

  // Modal states
  const [isSaveYamlModalOpen, setIsSaveYamlModalOpen] = useState(false)
  const [isRestartModalOpen, setIsRestartModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [podDetailModal, setPodDetailModal] = useState<{ isOpen: boolean; pod: any | null }>({ isOpen: false, pod: null })
  const [podShellModal, setPodShellModal] = useState<{ isOpen: boolean; pod: any | null }>({ isOpen: false, pod: null })
  const [podLogsModal, setPodLogsModal] = useState<{ isOpen: boolean; pod: any | null }>({ isOpen: false, pod: null })
  const [podYamlModal, setPodYamlModal] = useState<{ isOpen: boolean; pod: any | null; yaml: string }>({ isOpen: false, pod: null, yaml: '' })
  const [podDeleteModal, setPodDeleteModal] = useState<{ isOpen: boolean; pod: any | null }>({ isOpen: false, pod: null })

  useEffect(() => {
    if (cluster && namespace && daemonsetName) {
      fetchDaemonSetDetails()
    }
  }, [cluster, namespace, daemonsetName])

  useEffect(() => {
    if (pods && pods.length > 0) {
      fetchPodMetrics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pods])

  const fetchDaemonSetDetails = async () => {
    try {
      setIsLoading(true)
      const [daemonsetRes, podsRes, eventsRes] = await Promise.all([
        api.get(`/clusters/${cluster}/namespaces/${namespace}/daemonsets/${daemonsetName}`),
        api.get(`/clusters/${cluster}/pods?namespace=${namespace}`).catch(() => ({ data: [] })),
        api.get(`/clusters/${cluster}/events`).catch(() => ({ data: { events: [] } })),
      ])

      const daemonsetData = daemonsetRes.data
      const podsData = podsRes.data || []
      const eventsData = eventsRes.data.events || []

      setDaemonSet(daemonsetData)
      
      // Filter pods by daemonset label selector
      const labelSelector = daemonsetData.spec?.selector?.matchLabels || {}
      const filteredPods = podsData.filter((pod: any) => {
        const podLabels = pod.metadata?.labels || {}
        return Object.entries(labelSelector).every(([key, value]) => podLabels[key] === value)
      })
      
      setPods(filteredPods)
      
      // Set default selected pod and container
      if (filteredPods.length > 0) {
        if (!selectedPod || !filteredPods.find((p: any) => p.metadata.name === selectedPod)) {
          setSelectedPod(filteredPods[0].metadata.name)
          if (filteredPods[0].spec?.containers?.length > 0) {
            setSelectedContainer(filteredPods[0].spec.containers[0].name)
          }
        }
      }
      
      // Filter events related to this daemonset
      const daemonsetEvents = eventsData.filter((event: any) => {
        if (!daemonsetName) return false
        
        const involvedObjectMatch = event.involvedObject?.kind === 'DaemonSet' && 
                                    event.involvedObject?.name === daemonsetName &&
                                    event.involvedObject?.namespace === namespace
        const messageMatch = event.message?.toLowerCase().includes(daemonsetName.toLowerCase())
        
        return involvedObjectMatch || messageMatch
      })
      
      setEvents(daemonsetEvents)
      
      // Format as Kubernetes manifest
      const k8sManifest = {
        apiVersion: daemonsetData.apiVersion || 'apps/v1',
        kind: daemonsetData.kind || 'DaemonSet',
        metadata: daemonsetData.metadata,
        spec: daemonsetData.spec,
        status: daemonsetData.status,
      }
      setYamlContent(yaml.dump(k8sManifest, { indent: 2, lineWidth: -1, sortKeys: false }))
    } catch (error) {
      console.error('Failed to fetch daemonset details:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchPodMetrics = async () => {
    if (!pods || !cluster) return
    const metricsMap: Record<string, any> = {}
    
    await Promise.all(
      pods.map(async (pod: any) => {
        try {
          // Calculate requests and limits
          let totalCpuRequests = 0
          let totalMemoryRequests = 0
          let totalCpuLimits = 0
          let totalMemoryLimits = 0
          
          pod.spec?.containers?.forEach((container: any) => {
            if (container.resources?.requests?.cpu) {
              const cpuStr = container.resources.requests.cpu
              if (cpuStr.endsWith('m')) {
                totalCpuRequests += parseInt(cpuStr.replace('m', ''))
              } else {
                totalCpuRequests += parseFloat(cpuStr) * 1000
              }
            }
            
            if (container.resources?.requests?.memory) {
              const memStr = container.resources.requests.memory
              if (memStr.endsWith('Ki')) {
                totalMemoryRequests += parseInt(memStr.replace('Ki', '')) * 1024
              } else if (memStr.endsWith('Mi')) {
                totalMemoryRequests += parseInt(memStr.replace('Mi', '')) * 1024 * 1024
              } else if (memStr.endsWith('Gi')) {
                totalMemoryRequests += parseInt(memStr.replace('Gi', '')) * 1024 * 1024 * 1024
              } else {
                totalMemoryRequests += parseInt(memStr)
              }
            }
            
            if (container.resources?.limits?.cpu) {
              const cpuStr = container.resources.limits.cpu
              if (cpuStr.endsWith('m')) {
                totalCpuLimits += parseInt(cpuStr.replace('m', ''))
              } else {
                totalCpuLimits += parseFloat(cpuStr) * 1000
              }
            }
            
            if (container.resources?.limits?.memory) {
              const memStr = container.resources.limits.memory
              if (memStr.endsWith('Ki')) {
                totalMemoryLimits += parseInt(memStr.replace('Ki', '')) * 1024
              } else if (memStr.endsWith('Mi')) {
                totalMemoryLimits += parseInt(memStr.replace('Mi', '')) * 1024 * 1024
              } else if (memStr.endsWith('Gi')) {
                totalMemoryLimits += parseInt(memStr.replace('Gi', '')) * 1024 * 1024 * 1024
              } else {
                totalMemoryLimits += parseInt(memStr)
              }
            }
          })
          
          // Fetch actual usage
          let totalCpu = 0
          let totalMemory = 0
          
          try {
            const response = await api.get(`/clusters/${cluster}/namespaces/${namespace}/pods/${pod.metadata.name}/metrics`)
            const data = response.data
            
            if (data && data.containers) {
              data.containers.forEach((container: any) => {
                if (container.usage) {
                  const cpuStr = container.usage.cpu || '0'
                  if (cpuStr.endsWith('m')) {
                    totalCpu += parseInt(cpuStr.replace('m', ''))
                  } else if (cpuStr.endsWith('n')) {
                    totalCpu += parseInt(cpuStr.replace('n', '')) / 1000000
                  } else {
                    totalCpu += parseFloat(cpuStr) * 1000
                  }
                  
                  const memStr = container.usage.memory || '0'
                  if (memStr.endsWith('Ki')) {
                    totalMemory += parseInt(memStr.replace('Ki', '')) * 1024
                  } else if (memStr.endsWith('Mi')) {
                    totalMemory += parseInt(memStr.replace('Mi', '')) * 1024 * 1024
                  } else if (memStr.endsWith('Gi')) {
                    totalMemory += parseInt(memStr.replace('Gi', '')) * 1024 * 1024 * 1024
                  } else {
                    totalMemory += parseInt(memStr)
                  }
                }
              })
            }
          } catch (error) {
            // Metrics API might not be available
          }
          
          metricsMap[pod.metadata.name] = {
            cpuUsage: totalCpu,
            memoryUsage: totalMemory,
            cpuRequests: totalCpuRequests,
            memoryRequests: totalMemoryRequests,
            cpuLimits: totalCpuLimits,
            memoryLimits: totalMemoryLimits
          }
        } catch (error) {
          // Silently fail for individual pods
        }
      })
    )
    
    setPodMetrics(metricsMap)
  }

  const formatCPU = (millicores: number): string => {
    if (millicores >= 1000) {
      return `${(millicores / 1000).toFixed(2)} cores`
    }
    return `${millicores.toFixed(0)}m`
  }

  const formatMemory = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    } else if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    }
    return `${(bytes / 1024).toFixed(2)} KB`
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const handleSaveYaml = async () => {
    try {
      const updatedManifest = yaml.load(yamlContent)
      await api.put(`/clusters/${cluster}/namespaces/${namespace}/daemonsets/${daemonsetName}`, updatedManifest)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'DaemonSet updated successfully',
      })
      fetchDaemonSetDetails()
      setIsSaveYamlModalOpen(false)
    } catch (error: any) {
      console.error('Failed to update daemonset:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error'
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to update daemonset: ${errorMessage}`,
      })
    }
  }

  const handleRestartDaemonSet = async () => {
    try {
      await api.post(`/clusters/${cluster}/namespaces/${namespace}/daemonsets/${daemonsetName}/restart`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'DaemonSet restarted successfully',
      })
      fetchDaemonSetDetails()
      setIsRestartModalOpen(false)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to restart daemonset: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleDeleteDaemonSet = async () => {
    try {
      await api.delete(`/clusters/${cluster}/namespaces/${namespace}/daemonsets/${daemonsetName}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'DaemonSet deleted successfully',
      })
      setIsDeleteModalOpen(false)
      navigate(`/clusters/${cluster}/namespaces/${namespace}/daemonsets`)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete daemonset: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handlePodYaml = async (pod: any) => {
    try {
      const response = await api.get(`/clusters/${cluster}/namespaces/${namespace}/pods/${pod.metadata.name}`)
      const podData = response.data
      const k8sManifest = {
        apiVersion: podData.apiVersion || 'v1',
        kind: podData.kind || 'Pod',
        metadata: podData.metadata,
        spec: podData.spec,
        status: podData.status,
      }
      const yamlStr = yaml.dump(k8sManifest, { indent: 2, lineWidth: -1, sortKeys: false })
      setPodYamlModal({ isOpen: true, pod, yaml: yamlStr })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to load pod YAML: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleSavePodYaml = async () => {
    if (!podYamlModal.pod) return
    try {
      const updatedManifest = yaml.load(podYamlModal.yaml)
      await api.put(`/clusters/${cluster}/namespaces/${namespace}/pods/${podYamlModal.pod.metadata.name}`, updatedManifest)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Pod updated successfully',
      })
      fetchDaemonSetDetails()
      setPodYamlModal({ isOpen: false, pod: null, yaml: '' })
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to update pod: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleDeletePod = async () => {
    if (!podDeleteModal.pod) return
    try {
      await api.delete(`/clusters/${cluster}/namespaces/${namespace}/pods/${podDeleteModal.pod.metadata.name}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Pod deleted successfully',
      })
      setPodDeleteModal({ isOpen: false, pod: null })
      fetchDaemonSetDetails()
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete pod: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const getDaemonSetStatus = () => {
    if (!daemonset) return 'Unknown'
    
    const desired = daemonset.status.desiredNumberScheduled || 0
    const ready = daemonset.status.numberReady || 0
    const available = daemonset.status.numberAvailable || 0
    const updated = daemonset.status.updatedNumberScheduled || 0
    const current = daemonset.status.currentNumberScheduled || 0

    if (ready === 0 && desired > 0) {
      return 'Unavailable'
    }

    if (updated < desired) {
      return 'Updating'
    }

    if (ready === desired && available === desired && current === desired) {
      return 'Running'
    }

    return 'Pending'
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return 'text-green-600 dark:text-green-400'
      case 'updating':
      case 'pending':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'unavailable':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getConditionIcon = (status: string) => {
    if (status === 'True') {
      return <CheckCircleIcon className="w-5 h-5 text-green-500" />
    } else if (status === 'False') {
      return <XCircleIcon className="w-5 h-5 text-red-500" />
    }
    return <ExclamationCircleIcon className="w-5 h-5 text-yellow-500" />
  }

  // Pod columns
  const podColumns = useMemo<Column<any>[]>(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (pod) => (
        <button
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/clusters/${cluster}/namespaces/${namespace}/pods/${pod.metadata.name}`)
          }}
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-left"
        >
          {pod.metadata.name}
        </button>
      ),
      sortable: true,
      sortValue: (pod) => pod.metadata.name,
      searchValue: (pod) => pod.metadata.name,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (pod) => {
        const phase = pod.status?.phase || 'Unknown'
        const isRunning = phase === 'Running'
        const isPending = phase === 'Pending'
        const isFailed = phase === 'Failed'
        
        return (
          <span className={clsx(
            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
            isRunning
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : isPending
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
              : isFailed
              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
          )}>
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full',
              isRunning ? 'bg-green-600' :
              isPending ? 'bg-yellow-600' :
              isFailed ? 'bg-red-600' :
              'bg-gray-600'
            )} />
            {phase}
          </span>
        )
      },
      sortable: true,
      sortValue: (pod) => pod.status?.phase || 'Unknown',
      searchValue: (pod) => pod.status?.phase || 'Unknown',
    },
    {
      key: 'cpu',
      header: 'CPU',
      accessor: (pod) => {
        const metrics = podMetrics[pod.metadata.name]
        
        if (!metrics) {
          return <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
        }
        
        const cpuUsage = metrics.cpuUsage || 0
        const cpuLimit = metrics.cpuLimits || 0
        
        const utilization = cpuLimit > 0 
          ? Math.min((cpuUsage / cpuLimit) * 100, 100)
          : 0

        return (
          <div className="w-full min-w-[120px]">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <CpuChipIcon className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 font-mono">
                  {formatCPU(cpuUsage)}
                </span>
              </div>
              {cpuLimit > 0 ? (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {utilization.toFixed(0)}%
                </span>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                  No Limit
                </span>
              )}
            </div>
            {cpuLimit > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 overflow-hidden">
                <div
                  className={clsx(
                    'h-1.5 rounded-full transition-all duration-300',
                    utilization >= 90 ? 'bg-red-600 dark:bg-red-500' :
                    utilization >= 75 ? 'bg-orange-600 dark:bg-orange-500' :
                    'bg-blue-600 dark:bg-blue-500'
                  )}
                  style={{ width: `${utilization}%` }}
                />
              </div>
            )}
          </div>
        )
      },
      sortable: true,
      sortValue: (pod) => {
        const metrics = podMetrics[pod.metadata.name]
        return metrics?.cpuUsage || 0
      },
      searchValue: (pod) => {
        const metrics = podMetrics[pod.metadata.name]
        return metrics ? formatCPU(metrics.cpuUsage) : ''
      },
    },
    {
      key: 'memory',
      header: 'Memory',
      accessor: (pod) => {
        const metrics = podMetrics[pod.metadata.name]
        
        if (!metrics) {
          return <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
        }
        
        const memoryUsage = metrics.memoryUsage || 0
        const memoryLimit = metrics.memoryLimits || 0
        
        const utilization = memoryLimit > 0 
          ? Math.min((memoryUsage / memoryLimit) * 100, 100)
          : 0

        return (
          <div className="w-full min-w-[120px]">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <CircleStackIcon className="w-4 h-4 text-green-500 dark:text-green-400" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 font-mono">
                  {formatMemory(memoryUsage)}
                </span>
              </div>
              {memoryLimit > 0 ? (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {utilization.toFixed(0)}%
                </span>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                  No Limit
                </span>
              )}
            </div>
            {memoryLimit > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 overflow-hidden">
                <div
                  className={clsx(
                    'h-1.5 rounded-full transition-all duration-300',
                    utilization >= 90 ? 'bg-red-600 dark:bg-red-500' :
                    utilization >= 75 ? 'bg-orange-600 dark:bg-orange-500' :
                    'bg-green-600 dark:bg-green-500'
                  )}
                  style={{ width: `${utilization}%` }}
                />
              </div>
            )}
          </div>
        )
      },
      sortable: true,
      sortValue: (pod) => {
        const metrics = podMetrics[pod.metadata.name]
        return metrics?.memoryUsage || 0
      },
      searchValue: (pod) => {
        const metrics = podMetrics[pod.metadata.name]
        return metrics ? formatMemory(metrics.memoryUsage) : ''
      },
    },
    {
      key: 'node',
      header: 'Node',
      accessor: (pod) => {
        const nodeName = pod.spec?.nodeName
        if (!nodeName) {
          return <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
        }
        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/clusters/${cluster}/nodes/${nodeName}`)
            }}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            {nodeName}
          </button>
        )
      },
      sortable: true,
      sortValue: (pod) => pod.spec?.nodeName || '',
      searchValue: (pod) => pod.spec?.nodeName || '',
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (pod) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {formatAge(pod.metadata.creationTimestamp)}
        </span>
      ),
      sortable: true,
      sortValue: (pod) => new Date(pod.metadata.creationTimestamp).getTime(),
      searchValue: (pod) => formatAge(pod.metadata.creationTimestamp),
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (pod) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setPodDetailModal({ isOpen: true, pod })
            }}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="View Details"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setPodShellModal({ isOpen: true, pod })
            }}
            className="p-1.5 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
            title="Shell"
          >
            <CommandLineIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setPodLogsModal({ isOpen: true, pod })
            }}
            className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
            title="Logs"
          >
            <DocumentTextIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handlePodYaml(pod)
            }}
            className="p-1.5 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
            title="Edit YAML"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setPodDeleteModal({ isOpen: true, pod })
            }}
            className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
      sortable: false,
    },
  ], [podMetrics, cluster, namespace, navigate])

  // Event columns
  const eventColumns = useMemo<Column<any>[]>(() => [
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
      key: 'age',
      header: 'Age',
      accessor: (event) => {
        const timestamp = event.lastTimestamp || event.firstTimestamp
        if (!timestamp) return <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
        return (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {formatAge(timestamp)}
          </span>
        )
      },
      sortable: true,
      sortValue: (event) => {
        const timestamp = event.lastTimestamp || event.firstTimestamp
        if (!timestamp) return 0
        return new Date(timestamp).getTime()
      },
      searchValue: (event) => {
        const timestamp = event.lastTimestamp || event.firstTimestamp
        return timestamp ? formatAge(timestamp) : ''
      },
    },
  ], [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!daemonset) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">DaemonSet not found</p>
      </div>
    )
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'yaml', label: 'YAML' },
    { id: 'pods', label: 'Pods' },
    { id: 'terminal', label: 'Terminal' },
    { id: 'logs', label: 'Logs' },
    { id: 'events', label: 'Events' },
  ]

  const trueConditions = daemonset.status?.conditions?.filter((c: any) => c.status === 'True') || []
  const falseConditions = daemonset.status?.conditions?.filter((c: any) => c.status !== 'True') || []
  const selectedPodData = pods.find(p => p.metadata.name === selectedPod)

  return (
    <div className="space-y-4 md:space-y-6">
      <Breadcrumb
        items={[
          { name: cluster || '', href: `/clusters/${cluster}` },
          { name: namespace || '', href: `/clusters/${cluster}/namespaces/${namespace}/daemonsets` },
          { name: 'DaemonSets', href: `/clusters/${cluster}/namespaces/${namespace}/daemonsets` },
          { name: daemonsetName || '' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
            <ServerStackIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              {daemonsetName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              DaemonSet Details
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRestartModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
            title="Restart"
          >
            <ArrowPathIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Restart</span>
          </button>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* DaemonSet Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-white mb-4">DaemonSet Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Name:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{daemonset.metadata.name}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Namespace:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{daemonset.metadata.namespace}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
                  <p className={clsx('text-sm font-medium', getStatusColor(getDaemonSetStatus()))}>
                    {getDaemonSetStatus()}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Strategy:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {daemonset.spec?.updateStrategy?.type || 'RollingUpdate'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Age:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatAge(daemonset.metadata.creationTimestamp)}
                  </p>
                </div>
              </div>

              {/* Labels */}
              {daemonset.metadata.labels && Object.keys(daemonset.metadata.labels).length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => toggleSection('labels')}
                    className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    {expandedSections.labels ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )}
                    Labels ({Object.keys(daemonset.metadata.labels).length})
                  </button>
                  {expandedSections.labels && (
                    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(daemonset.metadata.labels).map(([key, value]) => (
                          <div key={key} className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{key}</span>
                            <span className="text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-1 rounded border border-blue-200 dark:border-blue-700">
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
              {daemonset.metadata.annotations && Object.keys(daemonset.metadata.annotations).length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => toggleSection('annotations')}
                    className="flex items-center gap-2 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                  >
                    {expandedSections.annotations ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )}
                    Annotations ({Object.keys(daemonset.metadata.annotations).length})
                  </button>
                  {expandedSections.annotations && (
                    <div className="mt-3 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 max-h-60 overflow-y-auto">
                      <div className="space-y-3">
                        {Object.entries(daemonset.metadata.annotations).map(([key, value]) => (
                          <div key={key} className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">{key}</span>
                            <p className="text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-1 rounded border border-purple-200 dark:border-purple-700 break-all">
                              {value as string}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Node Selector */}
              {daemonset.spec?.template?.spec?.nodeSelector && Object.keys(daemonset.spec.template.spec.nodeSelector).length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => toggleSection('nodeSelector')}
                    className="flex items-center gap-2 text-sm font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300"
                  >
                    {expandedSections.nodeSelector ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )}
                    Node Selector ({Object.keys(daemonset.spec.template.spec.nodeSelector).length})
                  </button>
                  {expandedSections.nodeSelector && (
                    <div className="mt-3 p-4 bg-cyan-50 dark:bg-cyan-900/10 rounded-lg border border-cyan-200 dark:border-cyan-800">
                      <div className="space-y-2">
                        {Object.entries(daemonset.spec.template.spec.nodeSelector).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">{key}:</span>
                            <span className="text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-1 rounded border border-cyan-200 dark:border-cyan-700">
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
              {daemonset.spec?.template?.spec?.tolerations && daemonset.spec.template.spec.tolerations.length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => toggleSection('tolerations')}
                    className="flex items-center gap-2 text-sm font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
                  >
                    {expandedSections.tolerations ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )}
                    Tolerations ({daemonset.spec.template.spec.tolerations.length})
                  </button>
                  {expandedSections.tolerations && (
                    <div className="mt-3 p-4 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-200 dark:border-orange-800 space-y-2 max-h-60 overflow-y-auto">
                      {daemonset.spec.template.spec.tolerations.map((toleration: any, index: number) => (
                        <div key={index} className="p-3 bg-white dark:bg-gray-800 rounded border border-orange-200 dark:border-orange-700">
                          <div className="space-y-1 text-sm">
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
              {daemonset.spec?.template?.spec?.affinity && (
                <div className="mt-4">
                  <button
                    onClick={() => toggleSection('affinity')}
                    className="flex items-center gap-2 text-sm font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                  >
                    {expandedSections.affinity ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )}
                    Affinity
                  </button>
                  {expandedSections.affinity && (
                    <div className="mt-3 p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800 space-y-3 max-h-60 overflow-y-auto">
                      {daemonset.spec.template.spec.affinity.nodeAffinity && (
                        <div>
                          <h5 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">Node Affinity</h5>
                          <pre className="text-xs font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 p-2 rounded border border-green-200 dark:border-green-700 overflow-x-auto">
                            {JSON.stringify(daemonset.spec.template.spec.affinity.nodeAffinity, null, 2)}
                          </pre>
                        </div>
                      )}
                      {daemonset.spec.template.spec.affinity.podAffinity && (
                        <div>
                          <h5 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">Pod Affinity</h5>
                          <pre className="text-xs font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 p-2 rounded border border-green-200 dark:border-green-700 overflow-x-auto">
                            {JSON.stringify(daemonset.spec.template.spec.affinity.podAffinity, null, 2)}
                          </pre>
                        </div>
                      )}
                      {daemonset.spec.template.spec.affinity.podAntiAffinity && (
                        <div>
                          <h5 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">Pod Anti-Affinity</h5>
                          <pre className="text-xs font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 p-2 rounded border border-green-200 dark:border-green-700 overflow-x-auto">
                            {JSON.stringify(daemonset.spec.template.spec.affinity.podAntiAffinity, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pod Status */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-white mb-4">Pod Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {daemonset.status?.desiredNumberScheduled || 0}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Desired</p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {daemonset.status?.currentNumberScheduled || 0}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Current</p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {daemonset.status?.numberReady || 0}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ready</p>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {daemonset.status?.updatedNumberScheduled || 0}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Updated</p>
                </div>
              </div>
            </div>

            {/* DaemonSet Conditions */}
            {daemonset.status?.conditions && daemonset.status.conditions.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-white mb-4">DaemonSet Conditions</h3>
                <div className="space-y-3">
                  {trueConditions.map((condition: any, index: number) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                      {getConditionIcon(condition.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900 dark:text-white">{condition.type}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatAge(condition.lastTransitionTime)}
                          </span>
                        </div>
                        {condition.message && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{condition.message}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {falseConditions.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={() => toggleSection('falseConditions')}
                        className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                      >
                        {expandedSections.falseConditions ? (
                          <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                        )}
                        Other Conditions ({falseConditions.length})
                      </button>
                      {expandedSections.falseConditions && (
                        <div className="mt-2 space-y-2">
                          {falseConditions.map((condition: any, index: number) => (
                            <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                              {getConditionIcon(condition.status)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-gray-900 dark:text-white">{condition.type}</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatAge(condition.lastTransitionTime)}
                                  </span>
                                </div>
                                {condition.message && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{condition.message}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'yaml' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-white">YAML Manifest</h3>
              <button
                onClick={() => setIsSaveYamlModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
            <YamlEditor 
              value={yamlContent} 
              onChange={(value) => setYamlContent(value)} 
              readOnly={false}
            />
          </div>
        )}

        {activeTab === 'pods' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <DataTable
              data={pods}
              columns={podColumns}
              keyExtractor={(pod) => pod.metadata.uid}
              searchPlaceholder="Search pods..."
              emptyMessage="No pods found for this daemonset"
              pageSize={20}
            />
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-4 flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pod
                </label>
                <select
                  value={selectedPod}
                  onChange={(e) => {
                    setSelectedPod(e.target.value)
                    const pod = pods.find(p => p.metadata.name === e.target.value)
                    if (pod?.spec?.containers?.length > 0) {
                      setSelectedContainer(pod.spec.containers[0].name)
                    }
                  }}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {pods.map((pod: any) => (
                    <option key={pod.metadata.name} value={pod.metadata.name}>
                      {pod.metadata.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Container
                </label>
                <select
                  value={selectedContainer}
                  onChange={(e) => setSelectedContainer(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {selectedPodData?.spec?.containers?.map((container: any) => (
                    <option key={container.name} value={container.name}>
                      {container.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Shell
                </label>
                <select
                  value={selectedShell}
                  onChange={(e) => setSelectedShell(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="/bin/sh">sh (default)</option>
                  <option value="/bin/bash">Bash</option>
                  <option value="/bin/zsh">Zsh</option>
                  <option value="/bin/ash">Ash</option>
                  <option value="/bin/dash">Dash</option>
                </select>
              </div>
            </div>
            {selectedPod && selectedContainer && (
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <Terminal
                  wsUrl={`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/clusters/${cluster}/namespaces/${namespace}/pods/${selectedPod}/shell?container=${selectedContainer}&shell=${encodeURIComponent(selectedShell)}`}
                  key={`${selectedPod}-${selectedContainer}-${selectedShell}`}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <EnhancedMultiPodLogViewer
              cluster={cluster || ''}
              namespace={namespace || ''}
              pods={pods}
              container={selectedContainer}
              containers={pods.length > 0 && pods[0].spec?.containers ? pods[0].spec.containers : []}
              onContainerChange={setSelectedContainer}
            />
          </div>
        )}

        {activeTab === 'events' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <DataTable
              data={events}
              columns={eventColumns}
              keyExtractor={(event) => `${event.metadata?.uid || event.involvedObject?.uid}-${event.lastTimestamp}`}
              searchPlaceholder="Search events..."
              emptyMessage="No events found for this daemonset"
              pageSize={20}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {daemonset && (
        <>
          <ConfirmationModal
            isOpen={isSaveYamlModalOpen}
            onClose={() => setIsSaveYamlModalOpen(false)}
            onConfirm={handleSaveYaml}
            title="Save YAML Changes"
            message="Are you sure you want to save the YAML changes? This will update the daemonset."
            confirmText="Save"
            type="warning"
          />

          <ConfirmationModal
            isOpen={isRestartModalOpen}
            onClose={() => setIsRestartModalOpen(false)}
            onConfirm={handleRestartDaemonSet}
            title="Restart DaemonSet"
            message={`Are you sure you want to restart daemonset "${daemonsetName}"? This will restart all pods.`}
            confirmText="Restart"
            type="warning"
          />

          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleDeleteDaemonSet}
            title="Delete DaemonSet"
            message={`Are you sure you want to delete daemonset "${daemonsetName}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />

          {/* Pod Detail Modal */}
          {podDetailModal.isOpen && podDetailModal.pod && (
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75" onClick={() => setPodDetailModal({ isOpen: false, pod: null })} />
                <div className="inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-lg">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Pod Details: {podDetailModal.pod.metadata.name}
                    </h3>
                  </div>
                  <div className="p-6 max-h-[70vh] overflow-y-auto">
                    <PodDetailContent 
                      pod={podDetailModal.pod} 
                      podMetrics={podMetrics[podDetailModal.pod.metadata.name]}
                    />
                  </div>
                  <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                    <button
                      onClick={() => setPodDetailModal({ isOpen: false, pod: null })}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pod Shell Modal */}
          {podShellModal.isOpen && podShellModal.pod && (
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75" onClick={() => setPodShellModal({ isOpen: false, pod: null })} />
                <div className="inline-block w-full max-w-6xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-lg">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Pod Shell: {podShellModal.pod.metadata.name}
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="mb-4 flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Container
                        </label>
                        <select
                          value={selectedContainer}
                          onChange={(e) => setSelectedContainer(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          {podShellModal.pod.spec?.containers?.map((container: any) => (
                            <option key={container.name} value={container.name}>
                              {container.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Shell
                        </label>
                        <select
                          value={selectedShell}
                          onChange={(e) => setSelectedShell(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="/bin/sh">sh (default)</option>
                          <option value="/bin/bash">Bash</option>
                          <option value="/bin/zsh">Zsh</option>
                          <option value="/bin/ash">Ash</option>
                          <option value="/bin/dash">Dash</option>
                        </select>
                      </div>
                    </div>
                    <div className="bg-gray-900 rounded-lg overflow-hidden">
                      <Terminal
                        wsUrl={`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/clusters/${cluster}/namespaces/${namespace}/pods/${podShellModal.pod.metadata.name}/shell?container=${selectedContainer}&shell=${encodeURIComponent(selectedShell)}`}
                        key={`${podShellModal.pod.metadata.name}-${selectedContainer}-${selectedShell}`}
                      />
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                    <button
                      onClick={() => setPodShellModal({ isOpen: false, pod: null })}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pod Logs Modal */}
          {podLogsModal.isOpen && podLogsModal.pod && (
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75" onClick={() => setPodLogsModal({ isOpen: false, pod: null })} />
                <div className="inline-block w-full max-w-6xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-lg">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Pod Logs: {podLogsModal.pod.metadata.name}
                    </h3>
                  </div>
                  <div className="p-6">
                    <EnhancedMultiPodLogViewer
                      cluster={cluster || ''}
                      namespace={namespace || ''}
                      pods={[podLogsModal.pod]}
                      container={selectedContainer}
                      containers={podLogsModal.pod.spec?.containers || []}
                      onContainerChange={setSelectedContainer}
                    />
                  </div>
                  <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                    <button
                      onClick={() => setPodLogsModal({ isOpen: false, pod: null })}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pod YAML Modal */}
          {podYamlModal.isOpen && podYamlModal.pod && (
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75" onClick={() => setPodYamlModal({ isOpen: false, pod: null, yaml: '' })} />
                <div className="inline-block w-full max-w-6xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-lg">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Edit YAML: {podYamlModal.pod.metadata.name}
                    </h3>
                  </div>
                  <div className="p-6">
                    <YamlEditor 
                      value={podYamlModal.yaml} 
                      onChange={(value) => setPodYamlModal(prev => ({ ...prev, yaml: value }))} 
                      readOnly={false}
                    />
                  </div>
                  <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                    <button
                      onClick={() => setPodYamlModal({ isOpen: false, pod: null, yaml: '' })}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSavePodYaml}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pod Delete Modal */}
          <ConfirmationModal
            isOpen={podDeleteModal.isOpen}
            onClose={() => setPodDeleteModal({ isOpen: false, pod: null })}
            onConfirm={handleDeletePod}
            title="Delete Pod"
            message={`Are you sure you want to delete pod "${podDeleteModal.pod?.metadata.name}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}


