export interface Cluster {
  name: string
  context: string
  version: string
  status: 'connected' | 'error' | 'unknown'
  is_default: boolean
  metadata?: {
    nodes_count?: number
    namespaces_count?: number
  }
}

export interface Pod {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec: {
    containers: Container[]
    nodeName?: string
  }
  status: {
    phase: string
    podIP?: string
    conditions?: PodCondition[]
    containerStatuses?: ContainerStatus[]
  }
}

export interface Container {
  name: string
  image: string
  ports?: ContainerPort[]
}

export interface ContainerPort {
  containerPort: number
  protocol?: string
}

export interface PodCondition {
  type: string
  status: string
  lastTransitionTime?: string
  reason?: string
  message?: string
}

export interface ContainerStatus {
  name: string
  ready: boolean
  restartCount: number
  state?: Record<string, unknown>
}

export interface Deployment {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
    labels?: Record<string, string>
  }
  spec: {
    replicas?: number
    selector: {
      matchLabels?: Record<string, string>
    }
    template: {
      spec: {
        containers: Container[]
      }
    }
  }
  status: {
    replicas?: number
    readyReplicas?: number
    updatedReplicas?: number
    availableReplicas?: number
  }
}

export interface Service {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
    labels?: Record<string, string>
  }
  spec: {
    type: string
    clusterIP?: string
    ports?: ServicePort[]
    selector?: Record<string, string>
  }
  status?: {
    loadBalancer?: {
      ingress?: Array<{ ip?: string; hostname?: string }>
    }
  }
}

export interface ServicePort {
  name?: string
  protocol?: string
  port: number
  targetPort?: number | string
  nodePort?: number
}

export interface Node {
  metadata: {
    name: string
    creationTimestamp: string
    labels?: Record<string, string>
  }
  status: {
    conditions?: NodeCondition[]
    addresses?: NodeAddress[]
    nodeInfo?: {
      kubeletVersion: string
      osImage: string
      architecture: string
    }
    capacity?: Record<string, string>
    allocatable?: Record<string, string>
  }
}

export interface NodeCondition {
  type: string
  status: string
  lastHeartbeatTime?: string
  lastTransitionTime?: string
  reason?: string
  message?: string
}

export interface NodeAddress {
  type: string
  address: string
}

export interface Event {
  metadata: {
    name: string
    namespace: string
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
  firstTimestamp?: string
  lastTimestamp?: string
  count?: number
}

export interface Namespace {
  metadata: {
    name: string
    creationTimestamp: string
  }
  status: {
    phase: string
  }
}

