/**
 * Clean and reorder Kubernetes manifest to standard format
 * Order: apiVersion, kind, metadata, spec, status
 * Removes verbose system-generated fields
 */
export function cleanKubernetesManifest(obj: any, resourceType?: string): any {
  // Create a clean copy
  const cleaned: any = {}
  
  // Add apiVersion and kind if missing (based on resource type)
  const apiVersion = obj.apiVersion || getApiVersion(resourceType)
  const kind = obj.kind || getKind(resourceType)
  
  // Standard Kubernetes manifest field order
  if (apiVersion) cleaned.apiVersion = apiVersion
  if (kind) cleaned.kind = kind
  
  // Clean metadata - remove verbose system-generated fields
  if (obj.metadata) {
    const cleanedMetadata: any = {
      name: obj.metadata.name,
    }
    if (obj.metadata.namespace) cleanedMetadata.namespace = obj.metadata.namespace
    if (obj.metadata.labels) cleanedMetadata.labels = obj.metadata.labels
    if (obj.metadata.annotations) {
      // Filter out verbose annotations
      const filteredAnnotations: any = {}
      Object.keys(obj.metadata.annotations).forEach(key => {
        // Keep useful annotations, skip verbose system ones
        if (!key.includes('objectset.rio.cattle.io/applied') &&
            !key.includes('kubectl.kubernetes.io/last-applied-configuration') &&
            !key.includes('field.cattle.io/publicEndpoints')) {
          filteredAnnotations[key] = obj.metadata.annotations[key]
        }
      })
      if (Object.keys(filteredAnnotations).length > 0) {
        cleanedMetadata.annotations = filteredAnnotations
      }
    }
    cleaned.metadata = cleanedMetadata
  }
  
  // Add spec (for most resources)
  if (obj.spec) cleaned.spec = obj.spec
  
  // Add ConfigMap/Secret specific fields
  if (obj.data) cleaned.data = obj.data
  if (obj.binaryData) cleaned.binaryData = obj.binaryData
  if (obj.immutable !== undefined) cleaned.immutable = obj.immutable
  if (obj.stringData) cleaned.stringData = obj.stringData
  if (obj.type) cleaned.type = obj.type  // For Secrets
  
  // Add ServiceAccount specific fields
  if (obj.secrets) cleaned.secrets = obj.secrets
  if (obj.imagePullSecrets) cleaned.imagePullSecrets = obj.imagePullSecrets
  if (obj.automountServiceAccountToken !== undefined) cleaned.automountServiceAccountToken = obj.automountServiceAccountToken

  // Add ClusterRole specific fields
  if (obj.rules) cleaned.rules = obj.rules
  if (obj.aggregationRule) cleaned.aggregationRule = obj.aggregationRule

  // Add Role specific fields (same as ClusterRole but typically no aggregationRule)
  if (resourceType === 'role' && obj.rules) cleaned.rules = obj.rules

  // Add RoleBinding and ClusterRoleBinding specific fields
  if (obj.roleRef) cleaned.roleRef = obj.roleRef
  if (obj.subjects) cleaned.subjects = obj.subjects
  
  // Add StorageClass specific fields (these are at root level, not in spec)
  if (obj.provisioner) cleaned.provisioner = obj.provisioner
  if (obj.parameters) cleaned.parameters = obj.parameters
  if (obj.reclaimPolicy) cleaned.reclaimPolicy = obj.reclaimPolicy
  if (obj.volumeBindingMode) cleaned.volumeBindingMode = obj.volumeBindingMode
  if (obj.allowVolumeExpansion !== undefined) cleaned.allowVolumeExpansion = obj.allowVolumeExpansion
  if (obj.mountOptions) cleaned.mountOptions = obj.mountOptions
  if (obj.allowedTopologies) cleaned.allowedTopologies = obj.allowedTopologies
  
  // Add status (optional, but useful for viewing current state)
  if (obj.status) cleaned.status = obj.status
  
  return cleaned
}

/**
 * Get the Kubernetes apiVersion for a resource type
 */
function getApiVersion(resourceType?: string): string {
  const apiVersionMap: Record<string, string> = {
    'deployment': 'apps/v1',
    'daemonset': 'apps/v1',
    'statefulset': 'apps/v1',
    'replicaset': 'apps/v1',
    'job': 'batch/v1',
    'cronjob': 'batch/v1',
    'service': 'v1',
    'pod': 'v1',
    'configmap': 'v1',
    'secret': 'v1',
    'namespace': 'v1',
    'node': 'v1',
    'persistentvolume': 'v1',
    'persistentvolumeclaim': 'v1',
    'storageclass': 'storage.k8s.io/v1',
    'horizontalpodautoscaler': 'autoscaling/v2',
    'poddisruptionbudget': 'policy/v1',
    'priorityclass': 'scheduling.k8s.io/v1',
    'runtimeclass': 'node.k8s.io/v1',
    'lease': 'coordination.k8s.io/v1',
    'mutatingwebhookconfiguration': 'admissionregistration.k8s.io/v1',
    'validatingwebhookconfiguration': 'admissionregistration.k8s.io/v1',
    'ingress': 'networking.k8s.io/v1',
    'ingressclass': 'networking.k8s.io/v1',
    'networkpolicy': 'networking.k8s.io/v1',
    'serviceaccount': 'v1',
    'clusterrole': 'rbac.authorization.k8s.io/v1',
    'role': 'rbac.authorization.k8s.io/v1',
    'clusterrolebinding': 'rbac.authorization.k8s.io/v1',
    'rolebinding': 'rbac.authorization.k8s.io/v1',
    'customresourcedefinition': 'apiextensions.k8s.io/v1',
  }
  return resourceType ? apiVersionMap[resourceType.toLowerCase()] || '' : ''
}

/**
 * Get the Kubernetes kind for a resource type
 */
function getKind(resourceType?: string): string {
  const kindMap: Record<string, string> = {
    'deployment': 'Deployment',
    'daemonset': 'DaemonSet',
    'statefulset': 'StatefulSet',
    'replicaset': 'ReplicaSet',
    'job': 'Job',
    'cronjob': 'CronJob',
    'service': 'Service',
    'pod': 'Pod',
    'configmap': 'ConfigMap',
    'secret': 'Secret',
    'namespace': 'Namespace',
    'node': 'Node',
    'horizontalpodautoscaler': 'HorizontalPodAutoscaler',
    'poddisruptionbudget': 'PodDisruptionBudget',
    'priorityclass': 'PriorityClass',
    'runtimeclass': 'RuntimeClass',
    'lease': 'Lease',
    'mutatingwebhookconfiguration': 'MutatingWebhookConfiguration',
    'validatingwebhookconfiguration': 'ValidatingWebhookConfiguration',
    'ingress': 'Ingress',
    'ingressclass': 'IngressClass',
    'networkpolicy': 'NetworkPolicy',
    'persistentvolume': 'PersistentVolume',
    'persistentvolumeclaim': 'PersistentVolumeClaim',
    'storageclass': 'StorageClass',
    'serviceaccount': 'ServiceAccount',
    'clusterrole': 'ClusterRole',
    'role': 'Role',
    'clusterrolebinding': 'ClusterRoleBinding',
    'rolebinding': 'RoleBinding',
    'customresourcedefinition': 'CustomResourceDefinition',
  }
  return resourceType ? kindMap[resourceType.toLowerCase()] || '' : ''
}
