import axios from 'axios'
import type { Cluster, Pod, Deployment, Service, Node, Event } from '@/types'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

// Clusters
export const getClusters = async (): Promise<Cluster[]> => {
  const { data } = await api.get('/clusters')
  return data.clusters || []
}

export const addCluster = async (cluster: {
  name: string
  kubeconfig: string
  context?: string
  is_default?: boolean
}) => {
  const { data } = await api.post('/clusters', cluster)
  return data
}

export const removeCluster = async (name: string) => {
  const { data } = await api.delete(`/clusters/${name}`)
  return data
}

export const getClusterStatus = async (name: string): Promise<Cluster> => {
  const { data } = await api.get(`/clusters/${name}/status`)
  return data
}

// Namespaces (cluster-scoped)
export const getNamespaces = async (clusterName: string) => {
  const { data } = await api.get(`/clusters/${clusterName}/namespaces`)
  return data
}

export const getNamespace = async (clusterName: string, namespaceName: string) => {
  const { data } = await api.get(`/clusters/${clusterName}/namespaces/${namespaceName}`)
  return data
}

export const deleteNamespace = async (clusterName: string, namespaceName: string) => {
  const { data } = await api.delete(`/clusters/${clusterName}/namespaces/${namespaceName}`)
  return data
}

// Pods
export const getPods = async (clusterName: string, namespace?: string): Promise<Pod[]> => {
  const params = namespace ? { namespace } : {}
  const { data } = await api.get(`/clusters/${clusterName}/pods`, { params })
  return data.pods || []
}

export const getPod = async (
  clusterName: string,
  namespace: string,
  podName: string
): Promise<Pod> => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/pods/${podName}`
  )
  return data
}

export const deletePod = async (clusterName: string, namespace: string, podName: string) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/namespaces/${namespace}/pods/${podName}`
  )
  return data
}

export const getPodLogs = async (
  clusterName: string,
  namespace: string,
  podName: string,
  container?: string,
  tail?: number
): Promise<string> => {
  const params: Record<string, string | number> = {}
  if (container) params.container = container
  if (tail) params.tail = tail.toString()

  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/pods/${podName}/logs`,
    { params }
  )
  return data.logs || ''
}

// Deployments
export const getDeployments = async (
  clusterName: string,
  namespace?: string
): Promise<Deployment[]> => {
  const params = namespace ? { namespace } : {}
  const { data } = await api.get(`/clusters/${clusterName}/deployments`, { params })
  return data.deployments || []
}

export const getDeployment = async (
  clusterName: string,
  namespace: string,
  deploymentName: string
): Promise<Deployment> => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/deployments/${deploymentName}`
  )
  return data
}

export const deleteDeployment = async (
  clusterName: string,
  namespace: string,
  deploymentName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/namespaces/${namespace}/deployments/${deploymentName}`
  )
  return data
}

export const scaleDeployment = async (
  clusterName: string,
  namespace: string,
  deploymentName: string,
  replicas: number
) => {
  const { data } = await api.patch(
    `/clusters/${clusterName}/namespaces/${namespace}/deployments/${deploymentName}/scale`,
    { replicas }
  )
  return data
}

// DaemonSets
export const getDaemonSets = async (
  clusterName: string,
  namespace?: string
): Promise<any[]> => {
  const params = namespace ? { namespace } : {}
  const { data } = await api.get(`/clusters/${clusterName}/daemonsets`, { params })
  return data.daemonsets || []
}

export const getDaemonSet = async (
  clusterName: string,
  namespace: string,
  daemonsetName: string
): Promise<any> => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/daemonsets/${daemonsetName}`
  )
  return data
}

export const deleteDaemonSet = async (
  clusterName: string,
  namespace: string,
  daemonsetName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/namespaces/${namespace}/daemonsets/${daemonsetName}`
  )
  return data
}

export const restartDaemonSet = async (
  clusterName: string,
  namespace: string,
  daemonsetName: string
) => {
  const { data } = await api.post(
    `/clusters/${clusterName}/namespaces/${namespace}/daemonsets/${daemonsetName}/restart`
  )
  return data
}

// StatefulSets
export const getStatefulSets = async (
  clusterName: string,
  namespace?: string
): Promise<any[]> => {
  const params = namespace ? { namespace } : {}
  const { data } = await api.get(`/clusters/${clusterName}/statefulsets`, { params })
  return data.statefulsets || []
}

export const getStatefulSet = async (
  clusterName: string,
  namespace: string,
  statefulsetName: string
): Promise<any> => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/statefulsets/${statefulsetName}`
  )
  return data
}

export const deleteStatefulSet = async (
  clusterName: string,
  namespace: string,
  statefulsetName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/namespaces/${namespace}/statefulsets/${statefulsetName}`
  )
  return data
}

export const scaleStatefulSet = async (
  clusterName: string,
  namespace: string,
  statefulsetName: string,
  replicas: number
) => {
  const { data } = await api.patch(
    `/clusters/${clusterName}/namespaces/${namespace}/statefulsets/${statefulsetName}/scale`,
    { replicas }
  )
  return data
}

export const restartStatefulSet = async (
  clusterName: string,
  namespace: string,
  statefulsetName: string
) => {
  const { data } = await api.post(
    `/clusters/${clusterName}/namespaces/${namespace}/statefulsets/${statefulsetName}/restart`
  )
  return data
}

// ReplicaSets
export const getReplicaSets = async (
  clusterName: string,
  namespace?: string
): Promise<any[]> => {
  const params = namespace ? { namespace } : {}
  const { data } = await api.get(`/clusters/${clusterName}/replicasets`, { params })
  return data.replicasets || []
}

export const getReplicaSet = async (
  clusterName: string,
  namespace: string,
  replicasetName: string
): Promise<any> => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/replicasets/${replicasetName}`
  )
  return data
}

export const deleteReplicaSet = async (
  clusterName: string,
  namespace: string,
  replicasetName: string
) => {
  const { data} = await api.delete(
    `/clusters/${clusterName}/namespaces/${namespace}/replicasets/${replicasetName}`
  )
  return data
}

export const scaleReplicaSet = async (
  clusterName: string,
  namespace: string,
  replicasetName: string,
  replicas: number
) => {
  const { data } = await api.patch(
    `/clusters/${clusterName}/namespaces/${namespace}/replicasets/${replicasetName}/scale`,
    { replicas }
  )
  return data
}

// Jobs
export const getJobs = async (
  clusterName: string,
  namespace?: string
): Promise<any[]> => {
  const params = namespace ? { namespace } : {}
  const { data } = await api.get(`/clusters/${clusterName}/jobs`, { params })
  return data.jobs || []
}

export const getJob = async (
  clusterName: string,
  namespace: string,
  jobName: string
): Promise<any> => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/jobs/${jobName}`
  )
  return data
}

export const deleteJob = async (
  clusterName: string,
  namespace: string,
  jobName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/namespaces/${namespace}/jobs/${jobName}`
  )
  return data
}

// CronJobs
export const getCronJobs = async (
  clusterName: string,
  namespace?: string
): Promise<any[]> => {
  const params = namespace ? { namespace } : {}
  const { data } = await api.get(`/clusters/${clusterName}/cronjobs`, { params })
  return data.cronjobs || []
}

export const getCronJob = async (
  clusterName: string,
  namespace: string,
  cronjobName: string
): Promise<any> => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/cronjobs/${cronjobName}`
  )
  return data
}

export const deleteCronJob = async (
  clusterName: string,
  namespace: string,
  cronjobName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/namespaces/${namespace}/cronjobs/${cronjobName}`
  )
  return data
}

// Services
export const getServices = async (
  clusterName: string,
  namespace?: string
): Promise<Service[]> => {
  const params = namespace ? { namespace } : {}
  const { data } = await api.get(`/clusters/${clusterName}/services`, { params })
  return data.services || []
}

export const getService = async (
  clusterName: string,
  namespace: string,
  serviceName: string
): Promise<Service> => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/services/${serviceName}`
  )
  return data
}

export const deleteService = async (
  clusterName: string,
  namespace: string,
  serviceName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/namespaces/${namespace}/services/${serviceName}`
  )
  return data
}

// Endpoints
export const getEndpoints = async (
  clusterName: string,
  namespace?: string
): Promise<any[]> => {
  const params = namespace ? { namespace } : {}
  const { data } = await api.get(`/clusters/${clusterName}/endpoints`, { params })
  return data.endpoints || []
}

export const getEndpoint = async (
  clusterName: string,
  namespace: string,
  endpointName: string
): Promise<any> => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/endpoints/${endpointName}`
  )
  return data
}

// ConfigMaps
export const getConfigMaps = async (
  clusterName: string,
  namespace?: string
): Promise<any[]> => {
  const params = namespace ? { namespace } : {}
  const { data } = await api.get(`/clusters/${clusterName}/configmaps`, { params })
  return data.configMaps || []
}

export const getConfigMap = async (
  clusterName: string,
  namespace: string,
  configMapName: string
): Promise<any> => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/configmaps/${configMapName}`
  )
  return data
}

export const createConfigMap = async (
  clusterName: string,
  namespace: string,
  configMap: any
) => {
  const { data } = await api.post(
    `/clusters/${clusterName}/namespaces/${namespace}/configmaps`,
    configMap
  )
  return data
}

export const deleteConfigMap = async (
  clusterName: string,
  namespace: string,
  configMapName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/namespaces/${namespace}/configmaps/${configMapName}`
  )
  return data
}

// Secrets
export const getSecrets = async (
  clusterName: string,
  namespace?: string
): Promise<any[]> => {
  const params = namespace ? { namespace } : {}
  const { data } = await api.get(`/clusters/${clusterName}/secrets`, { params })
  return data.secrets || []
}

export const getSecret = async (
  clusterName: string,
  namespace: string,
  secretName: string
): Promise<any> => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/secrets/${secretName}`
  )
  return data
}

export const createSecret = async (
  clusterName: string,
  namespace: string,
  secret: any
) => {
  const { data } = await api.post(
    `/clusters/${clusterName}/namespaces/${namespace}/secrets`,
    secret
  )
  return data
}

export const deleteSecret = async (
  clusterName: string,
  namespace: string,
  secretName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/namespaces/${namespace}/secrets/${secretName}`
  )
  return data
}

// Nodes
export const getNodes = async (clusterName: string): Promise<Node[]> => {
  const { data } = await api.get(`/clusters/${clusterName}/nodes`)
  return data.nodes || []
}

export const getNode = async (clusterName: string, nodeName: string): Promise<Node> => {
  const { data } = await api.get(`/clusters/${clusterName}/nodes/${nodeName}`)
  return data
}

export const cordonNode = async (clusterName: string, nodeName: string) => {
  const { data } = await api.post(`/clusters/${clusterName}/nodes/${nodeName}/cordon`)
  return data
}

export const uncordonNode = async (clusterName: string, nodeName: string) => {
  const { data } = await api.post(`/clusters/${clusterName}/nodes/${nodeName}/uncordon`)
  return data
}

export const drainNode = async (clusterName: string, nodeName: string) => {
  const { data } = await api.post(`/clusters/${clusterName}/nodes/${nodeName}/drain`)
  return data
}

export const deleteNode = async (clusterName: string, nodeName: string) => {
  const { data } = await api.delete(`/clusters/${clusterName}/nodes/${nodeName}`)
  return data
}

// Events
export const getEvents = async (clusterName: string, namespace?: string): Promise<Event[]> => {
  const params = namespace ? { namespace } : {}
  const { data } = await api.get(`/clusters/${clusterName}/events`, { params })
  return data.events || []
}

// HPA
export const getHPAs = async (clusterName: string, namespace?: string) => {
  const params = namespace ? { namespace } : {}
  const { data } = await api.get(`/clusters/${clusterName}/hpas`, { params })
  return data || []
}

export const getHPA = async (
  clusterName: string,
  namespace: string,
  hpaName: string
) => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/hpas/${hpaName}`
  )
  return data
}

export const createHPA = async (
  clusterName: string,
  namespace: string,
  hpa: any
) => {
  const { data } = await api.post(
    `/clusters/${clusterName}/namespaces/${namespace}/hpas`,
    hpa
  )
  return data
}

export const deleteHPA = async (
  clusterName: string,
  namespace: string,
  hpaName: string
) => {
  const { data} = await api.delete(
    `/clusters/${clusterName}/namespaces/${namespace}/hpas/${hpaName}`
  )
  return data
}

// Pod Disruption Budgets
export const getPDBs = async (clusterName: string, namespace?: string) => {
  const params = namespace ? { namespace } : { namespace: 'all' }
  const { data } = await api.get(`/clusters/${clusterName}/pdbs`, { params })
  return data
}

export const getPDB = async (
  clusterName: string,
  namespace: string,
  pdbName: string
) => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/pdbs/${pdbName}`
  )
  return data
}

export const createPDB = async (
  clusterName: string,
  namespace: string,
  pdb: any
) => {
  const { data } = await api.post(
    `/clusters/${clusterName}/namespaces/${namespace}/pdbs`,
    pdb
  )
  return data
}

export const deletePDB = async (
  clusterName: string,
  namespace: string,
  pdbName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/namespaces/${namespace}/pdbs/${pdbName}`
  )
  return data
}

// Priority Classes (cluster-scoped)
export const getPriorityClasses = async (clusterName: string) => {
  const { data } = await api.get(`/clusters/${clusterName}/priorityclasses`)
  return data
}

export const getPriorityClass = async (
  clusterName: string,
  priorityClassName: string
) => {
  const { data } = await api.get(
    `/clusters/${clusterName}/priorityclasses/${priorityClassName}`
  )
  return data
}

export const createPriorityClass = async (
  clusterName: string,
  priorityClass: any
) => {
  const { data } = await api.post(
    `/clusters/${clusterName}/priorityclasses`,
    priorityClass
  )
  return data
}

export const deletePriorityClass = async (
  clusterName: string,
  priorityClassName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/priorityclasses/${priorityClassName}`
  )
  return data
}

// Runtime Classes (cluster-scoped)
export const getRuntimeClasses = async (clusterName: string) => {
  const { data } = await api.get(`/clusters/${clusterName}/runtimeclasses`)
  return data
}

export const getRuntimeClass = async (
  clusterName: string,
  runtimeClassName: string
) => {
  const { data } = await api.get(
    `/clusters/${clusterName}/runtimeclasses/${runtimeClassName}`
  )
  return data
}

export const createRuntimeClass = async (
  clusterName: string,
  runtimeClass: any
) => {
  const { data } = await api.post(
    `/clusters/${clusterName}/runtimeclasses`,
    runtimeClass
  )
  return data
}

export const deleteRuntimeClass = async (
  clusterName: string,
  runtimeClassName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/runtimeclasses/${runtimeClassName}`
  )
  return data
}

// Leases (namespaced)
export const getLeases = async (clusterName: string, namespace: string) => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/leases`
  )
  return data
}

export const getLease = async (
  clusterName: string,
  namespace: string,
  leaseName: string
) => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/leases/${leaseName}`
  )
  return data
}

export const createLease = async (
  clusterName: string,
  namespace: string,
  lease: any
) => {
  const { data } = await api.post(
    `/clusters/${clusterName}/namespaces/${namespace}/leases`,
    lease
  )
  return data
}

export const deleteLease = async (
  clusterName: string,
  namespace: string,
  leaseName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/namespaces/${namespace}/leases/${leaseName}`
  )
  return data
}

// Mutating Webhook Configurations (cluster-scoped)
export const getMutatingWebhookConfigurations = async (clusterName: string) => {
  const { data } = await api.get(
    `/clusters/${clusterName}/mutatingwebhookconfigurations`
  )
  return data
}

export const getMutatingWebhookConfiguration = async (
  clusterName: string,
  webhookName: string
) => {
  const { data } = await api.get(
    `/clusters/${clusterName}/mutatingwebhookconfigurations/${webhookName}`
  )
  return data
}

export const createMutatingWebhookConfiguration = async (
  clusterName: string,
  webhook: any
) => {
  const { data } = await api.post(
    `/clusters/${clusterName}/mutatingwebhookconfigurations`,
    webhook
  )
  return data
}

export const deleteMutatingWebhookConfiguration = async (
  clusterName: string,
  webhookName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/mutatingwebhookconfigurations/${webhookName}`
  )
  return data
}

// Validating Webhook Configurations (cluster-scoped)
export const getValidatingWebhookConfigurations = async (clusterName: string) => {
  const { data } = await api.get(
    `/clusters/${clusterName}/validatingwebhookconfigurations`
  )
  return data
}

export const getValidatingWebhookConfiguration = async (
  clusterName: string,
  webhookName: string
) => {
  const { data } = await api.get(
    `/clusters/${clusterName}/validatingwebhookconfigurations/${webhookName}`
  )
  return data
}

export const createValidatingWebhookConfiguration = async (
  clusterName: string,
  webhook: any
) => {
  const { data } = await api.post(
    `/clusters/${clusterName}/validatingwebhookconfigurations`,
    webhook
  )
  return data
}

export const deleteValidatingWebhookConfiguration = async (
  clusterName: string,
  webhookName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/validatingwebhookconfigurations/${webhookName}`
  )
  return data
}

// Ingresses (namespaced)
export const getIngresses = async (clusterName: string, namespace?: string) => {
  const url = namespace
    ? `/clusters/${clusterName}/namespaces/${namespace}/ingresses`
    : `/clusters/${clusterName}/ingresses`
  const { data } = await api.get(url)
  return data
}

export const getIngress = async (
  clusterName: string,
  namespace: string,
  ingressName: string
) => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/ingresses/${ingressName}`
  )
  return data
}

export const createIngress = async (
  clusterName: string,
  namespace: string,
  ingress: any
) => {
  const { data } = await api.post(
    `/clusters/${clusterName}/namespaces/${namespace}/ingresses`,
    ingress
  )
  return data
}

export const deleteIngress = async (
  clusterName: string,
  namespace: string,
  ingressName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/namespaces/${namespace}/ingresses/${ingressName}`
  )
  return data
}

// Ingress Classes (cluster-scoped)
export const getIngressClasses = async (clusterName: string) => {
  const { data } = await api.get(`/clusters/${clusterName}/ingressclasses`)
  return data
}

export const getIngressClass = async (
  clusterName: string,
  ingressClassName: string
) => {
  const { data } = await api.get(
    `/clusters/${clusterName}/ingressclasses/${ingressClassName}`
  )
  return data
}

export const createIngressClass = async (
  clusterName: string,
  ingressClass: any
) => {
  const { data } = await api.post(
    `/clusters/${clusterName}/ingressclasses`,
    ingressClass
  )
  return data
}

export const deleteIngressClass = async (
  clusterName: string,
  ingressClassName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/ingressclasses/${ingressClassName}`
  )
  return data
}

// Network Policies (namespaced)
export const getNetworkPolicies = async (clusterName: string, namespace?: string) => {
  const url = namespace
    ? `/clusters/${clusterName}/namespaces/${namespace}/networkpolicies`
    : `/clusters/${clusterName}/networkpolicies`
  const { data } = await api.get(url)
  return data
}

export const getNetworkPolicy = async (
  clusterName: string,
  namespace: string,
  networkPolicyName: string
) => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/networkpolicies/${networkPolicyName}`
  )
  return data
}

export const deleteNetworkPolicy = async (
  clusterName: string,
  namespace: string,
  networkPolicyName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/namespaces/${namespace}/networkpolicies/${networkPolicyName}`
  )
  return data
}

// Storage Classes (cluster-scoped)
export const getStorageClasses = async (clusterName: string) => {
  const { data } = await api.get(`/clusters/${clusterName}/storageclasses`)
  return data
}

export const getStorageClass = async (clusterName: string, scName: string) => {
  const { data } = await api.get(`/clusters/${clusterName}/storageclasses/${scName}`)
  return data
}

export const deleteStorageClass = async (clusterName: string, scName: string) => {
  const { data } = await api.delete(`/clusters/${clusterName}/storageclasses/${scName}`)
  return data
}

// Persistent Volumes (cluster-scoped)
export const getPersistentVolumes = async (clusterName: string) => {
  const { data } = await api.get(`/clusters/${clusterName}/persistentvolumes`)
  return data
}

export const getPersistentVolume = async (clusterName: string, pvName: string) => {
  const { data } = await api.get(`/clusters/${clusterName}/persistentvolumes/${pvName}`)
  return data
}

export const deletePersistentVolume = async (clusterName: string, pvName: string) => {
  const { data } = await api.delete(`/clusters/${clusterName}/persistentvolumes/${pvName}`)
  return data
}

// Persistent Volume Claims (namespaced)
export const getPersistentVolumeClaims = async (clusterName: string, namespace?: string) => {
  const url = namespace
    ? `/clusters/${clusterName}/namespaces/${namespace}/persistentvolumeclaims`
    : `/clusters/${clusterName}/persistentvolumeclaims`
  const { data } = await api.get(url)
  return data
}

export const getPersistentVolumeClaim = async (
  clusterName: string,
  namespace: string,
  pvcName: string
) => {
  const { data } = await api.get(
    `/clusters/${clusterName}/namespaces/${namespace}/persistentvolumeclaims/${pvcName}`
  )
  return data
}

export const deletePersistentVolumeClaim = async (
  clusterName: string,
  namespace: string,
  pvcName: string
) => {
  const { data} = await api.delete(
    `/clusters/${clusterName}/namespaces/${namespace}/persistentvolumeclaims/${pvcName}`
  )
  return data
}

// ==================== ServiceAccount APIs ====================

export const getServiceAccounts = async (clusterName: string, namespace?: string) => {
  const url = namespace && namespace !== 'all'
    ? `/clusters/${clusterName}/namespaces/${namespace}/serviceaccounts`
    : `/clusters/${clusterName}/serviceaccounts?namespace=all`
  const { data } = await api.get(url)
  return data
}

export const getServiceAccount = async (clusterName: string, namespace: string, saName: string) => {
  const { data } = await api.get(`/clusters/${clusterName}/namespaces/${namespace}/serviceaccounts/${saName}`)
  return data
}

export const updateServiceAccount = async (clusterName: string, namespace: string, saName: string, yaml: string) => {
  const { data } = await api.put(`/clusters/${clusterName}/namespaces/${namespace}/serviceaccounts/${saName}`, yaml, {
    headers: {
      'Content-Type': 'application/yaml',
    },
  })
  return data
}

export const deleteServiceAccount = async (clusterName: string, namespace: string, saName: string) => {
  const { data } = await api.delete(`/clusters/${clusterName}/namespaces/${namespace}/serviceaccounts/${saName}`)
  return data
}

export const createServiceAccount = async (clusterName: string, namespace: string, yaml: string) => {
  const { data } = await api.post(`/clusters/${clusterName}/namespaces/${namespace}/serviceaccounts`, yaml, {
    headers: {
      'Content-Type': 'application/yaml',
    },
  })
  return data
}

// ==================== ClusterRole APIs ====================

export const getClusterRoles = async (clusterName: string) => {
  const { data } = await api.get(`/clusters/${clusterName}/clusterroles`)
  return data
}

export const getClusterRole = async (clusterName: string, crName: string) => {
  const { data } = await api.get(`/clusters/${clusterName}/clusterroles/${crName}`)
  return data
}

export const updateClusterRole = async (clusterName: string, crName: string, yaml: string) => {
  const { data } = await api.put(`/clusters/${clusterName}/clusterroles/${crName}`, yaml, {
    headers: {
      'Content-Type': 'application/yaml',
    },
  })
  return data
}

export const deleteClusterRole = async (clusterName: string, crName: string) => {
  const { data } = await api.delete(`/clusters/${clusterName}/clusterroles/${crName}`)
  return data
}

export const createClusterRole = async (clusterName: string, yaml: string) => {
  const { data } = await api.post(`/clusters/${clusterName}/clusterroles`, yaml, {
    headers: {
      'Content-Type': 'application/yaml',
    },
  })
  return data
}

// ==================== Role APIs ====================

export const getRoles = async (clusterName: string, namespace?: string) => {
  const url = namespace && namespace !== 'all'
    ? `/clusters/${clusterName}/namespaces/${namespace}/roles`
    : `/clusters/${clusterName}/roles?namespace=all`
  const { data } = await api.get(url)
  return data
}

export const getRole = async (clusterName: string, namespace: string, roleName: string) => {
  const { data} = await api.get(`/clusters/${clusterName}/namespaces/${namespace}/roles/${roleName}`)
  return data
}

export const updateRole = async (clusterName: string, namespace: string, roleName: string, yaml: string) => {
  const { data } = await api.put(`/clusters/${clusterName}/namespaces/${namespace}/roles/${roleName}`, yaml, {
    headers: {
      'Content-Type': 'application/yaml',
    },
  })
  return data
}

export const deleteRole = async (clusterName: string, namespace: string, roleName: string) => {
  const { data } = await api.delete(`/clusters/${clusterName}/namespaces/${namespace}/roles/${roleName}`)
  return data
}

export const createRole = async (clusterName: string, namespace: string, yaml: string) => {
  const { data } = await api.post(`/clusters/${clusterName}/namespaces/${namespace}/roles`, yaml, {
    headers: {
      'Content-Type': 'application/yaml',
    },
  })
  return data
}

// ==================== ClusterRoleBinding APIs ====================

export const getClusterRoleBindings = async (clusterName: string) => {
  const { data } = await api.get(`/clusters/${clusterName}/clusterrolebindings`)
  return data
}

export const getClusterRoleBinding = async (clusterName: string, crbName: string) => {
  const { data } = await api.get(`/clusters/${clusterName}/clusterrolebindings/${crbName}`)
  return data
}

export const updateClusterRoleBinding = async (clusterName: string, crbName: string, yaml: string) => {
  const { data } = await api.put(`/clusters/${clusterName}/clusterrolebindings/${crbName}`, yaml, {
    headers: {
      'Content-Type': 'application/yaml',
    },
  })
  return data
}

export const deleteClusterRoleBinding = async (clusterName: string, crbName: string) => {
  const { data } = await api.delete(`/clusters/${clusterName}/clusterrolebindings/${crbName}`)
  return data
}

export const createClusterRoleBinding = async (clusterName: string, yaml: string) => {
  const { data } = await api.post(`/clusters/${clusterName}/clusterrolebindings`, yaml, {
    headers: {
      'Content-Type': 'application/yaml',
    },
  })
  return data
}

// ==================== RoleBinding APIs ====================

export const getRoleBindings = async (clusterName: string, namespace?: string) => {
  const url = namespace && namespace !== 'all'
    ? `/clusters/${clusterName}/namespaces/${namespace}/rolebindings`
    : `/clusters/${clusterName}/rolebindings?namespace=all`
  const { data } = await api.get(url)
  return data
}

export const getRoleBinding = async (clusterName: string, namespace: string, rbName: string) => {
  const { data } = await api.get(`/clusters/${clusterName}/namespaces/${namespace}/rolebindings/${rbName}`)
  return data
}

export const updateRoleBinding = async (clusterName: string, namespace: string, rbName: string, yaml: string) => {
  const { data } = await api.put(`/clusters/${clusterName}/namespaces/${namespace}/rolebindings/${rbName}`, yaml, {
    headers: {
      'Content-Type': 'application/yaml',
    },
  })
  return data
}

export const deleteRoleBinding = async (clusterName: string, namespace: string, rbName: string) => {
  const { data } = await api.delete(`/clusters/${clusterName}/namespaces/${namespace}/rolebindings/${rbName}`)
  return data
}

export const createRoleBinding = async (clusterName: string, namespace: string, yaml: string) => {
  const { data } = await api.post(`/clusters/${clusterName}/namespaces/${namespace}/rolebindings`, yaml, {
    headers: {
      'Content-Type': 'application/yaml',
    },
  })
  return data
}

export default api


// Custom Resource Definitions (cluster-scoped)
export const getCustomResourceDefinitions = async (clusterName: string) => {
  const { data } = await api.get(
    `/clusters/${clusterName}/customresourcedefinitions`
  )
  return data
}

export const getCustomResourceDefinition = async (
  clusterName: string,
  crdName: string
) => {
  const { data } = await api.get(
    `/clusters/${clusterName}/customresourcedefinitions/${crdName}`
  )
  return data
}

export const updateCustomResourceDefinition = async (
  clusterName: string,
  crdName: string,
  yaml: string
) => {
  const { data } = await api.put(
    `/clusters/${clusterName}/customresourcedefinitions/${crdName}`,
    yaml,
    { headers: { 'Content-Type': 'application/x-yaml' } }
  )
  return data
}

export const deleteCustomResourceDefinition = async (
  clusterName: string,
  crdName: string
) => {
  const { data } = await api.delete(
    `/clusters/${clusterName}/customresourcedefinitions/${crdName}`
  )
  return data
}

// Custom Resources (Dynamic)
export const getCustomResources = async (
  clusterName: string,
  group: string,
  version: string,
  resource: string,
  namespace?: string
) => {
  const url = namespace
    ? `/clusters/${clusterName}/namespaces/${namespace}/customresources`
    : `/clusters/${clusterName}/customresources`
  const { data } = await api.get(url, {
    params: { group, version, resource },
  })
  return data
}

export const getCustomResource = async (
  clusterName: string,
  group: string,
  version: string,
  resource: string,
  resourceName: string,
  namespace?: string
) => {
  const url = namespace
    ? `/clusters/${clusterName}/namespaces/${namespace}/customresources/${resourceName}`
    : `/clusters/${clusterName}/customresources/${resourceName}`
  const { data} = await api.get(url, {
    params: { group, version, resource },
  })
  return data
}

export const updateCustomResource = async (
  clusterName: string,
  group: string,
  version: string,
  resource: string,
  resourceName: string,
  yaml: string,
  namespace?: string
) => {
  const url = namespace
    ? `/clusters/${clusterName}/namespaces/${namespace}/customresources/${resourceName}`
    : `/clusters/${clusterName}/customresources/${resourceName}`
  const { data } = await api.put(url, yaml, {
    params: { group, version, resource },
    headers: { 'Content-Type': 'text/plain' },
  })
  return data
}

export const deleteCustomResource = async (
  clusterName: string,
  group: string,
  version: string,
  resource: string,
  resourceName: string,
  namespace?: string
) => {
  const url = namespace
    ? `/clusters/${clusterName}/namespaces/${namespace}/customresources/${resourceName}`
    : `/clusters/${clusterName}/customresources/${resourceName}`
  const { data } = await api.delete(url, {
    params: { group, version, resource },
  })
  return data
}
