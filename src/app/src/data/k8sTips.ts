/**
 * Kubernetes Tips Database
 * 
 * Curated collection of Kubernetes tips, best practices, and fun facts
 * Displayed on loading screen to educate users while authentication loads
 * 
 * @module data/k8sTips
 */

export type TipCategory = 'best-practice' | 'performance' | 'security' | 'troubleshooting' | 'fun-fact'

export interface K8sTip {
  id: string
  category: TipCategory
  icon: string
  title: string
  tip: string
}

/**
 * Kubernetes tips organized by category
 */
export const k8sTips: K8sTip[] = [
  // ========== BEST PRACTICES (40%) ==========
  {
    id: 'bp-001',
    category: 'best-practice',
    icon: '💡',
    title: 'Health Checks',
    tip: 'Always configure liveness and readiness probes to ensure your applications are healthy and ready to serve traffic',
  },
  {
    id: 'bp-002',
    category: 'best-practice',
    icon: '💡',
    title: 'Resource Limits',
    tip: 'Set resource requests and limits for all containers to prevent resource starvation and ensure fair scheduling',
  },
  {
    id: 'bp-003',
    category: 'best-practice',
    icon: '💡',
    title: 'Namespaces',
    tip: 'Use namespaces to organize and isolate resources for different teams, projects, or environments',
  },
  {
    id: 'bp-004',
    category: 'best-practice',
    icon: '💡',
    title: 'Labels & Selectors',
    tip: 'Use meaningful labels and selectors to organize resources and enable powerful querying and grouping',
  },
  {
    id: 'bp-005',
    category: 'best-practice',
    icon: '💡',
    title: 'ConfigMaps & Secrets',
    tip: 'Separate configuration from code using ConfigMaps for non-sensitive data and Secrets for sensitive data',
  },
  {
    id: 'bp-006',
    category: 'best-practice',
    icon: '💡',
    title: 'Immutable Infrastructure',
    tip: 'Treat containers as immutable. Instead of updating, replace them with new versions',
  },
  {
    id: 'bp-007',
    category: 'best-practice',
    icon: '💡',
    title: 'Rolling Updates',
    tip: 'Use rolling updates with proper readiness probes to achieve zero-downtime deployments',
  },
  {
    id: 'bp-008',
    category: 'best-practice',
    icon: '💡',
    title: 'Pod Disruption Budgets',
    tip: 'Define Pod Disruption Budgets (PDB) to maintain availability during voluntary disruptions like node upgrades',
  },
  {
    id: 'bp-009',
    category: 'best-practice',
    icon: '💡',
    title: 'Multi-Container Pods',
    tip: 'Use sidecar containers for cross-cutting concerns like logging, monitoring, and service mesh proxies',
  },
  {
    id: 'bp-010',
    category: 'best-practice',
    icon: '💡',
    title: 'Service Mesh',
    tip: 'Consider using a service mesh like Istio or Linkerd for advanced traffic management and observability',
  },
  {
    id: 'bp-011',
    category: 'best-practice',
    icon: '💡',
    title: 'GitOps',
    tip: 'Adopt GitOps practices to manage cluster configuration declaratively using Git as the source of truth',
  },
  {
    id: 'bp-012',
    category: 'best-practice',
    icon: '💡',
    title: 'Helm Charts',
    tip: 'Use Helm charts to package and deploy complex applications with templating and version management',
  },

  // ========== PERFORMANCE (20%) ==========
  {
    id: 'perf-001',
    category: 'performance',
    icon: '⚡',
    title: 'Node Affinity',
    tip: 'Use node affinity and anti-affinity to optimize pod placement based on hardware capabilities',
  },
  {
    id: 'perf-002',
    category: 'performance',
    icon: '⚡',
    title: 'Horizontal Pod Autoscaling',
    tip: 'Configure HPA to automatically scale pods based on CPU, memory, or custom metrics',
  },
  {
    id: 'perf-003',
    category: 'performance',
    icon: '⚡',
    title: 'Vertical Pod Autoscaling',
    tip: 'Use VPA to automatically adjust CPU and memory requests based on actual usage patterns',
  },
  {
    id: 'perf-004',
    category: 'performance',
    icon: '⚡',
    title: 'Container Image Optimization',
    tip: 'Use multi-stage builds and minimal base images to reduce container size and startup time',
  },
  {
    id: 'perf-005',
    category: 'performance',
    icon: '⚡',
    title: 'Caching Strategies',
    tip: 'Implement caching layers (Redis, Memcached) to reduce database load and improve response times',
  },
  {
    id: 'perf-006',
    category: 'performance',
    icon: '⚡',
    title: 'Resource Quotas',
    tip: 'Set namespace resource quotas to prevent resource exhaustion and ensure fair sharing',
  },
  {
    id: 'perf-007',
    category: 'performance',
    icon: '⚡',
    title: 'Network Policies',
    tip: 'Use network policies to reduce unnecessary traffic and improve security and performance',
  },
  {
    id: 'perf-008',
    category: 'performance',
    icon: '⚡',
    title: 'Persistent Volume Claims',
    tip: 'Choose the right storage class for your workload (SSD for databases, HDD for backups)',
  },

  // ========== SECURITY (20%) ==========
  {
    id: 'sec-001',
    category: 'security',
    icon: '🔒',
    title: 'Non-Root Containers',
    tip: 'Never run containers as root. Use SecurityContext to enforce non-root users and drop capabilities',
  },
  {
    id: 'sec-002',
    category: 'security',
    icon: '🔒',
    title: 'Pod Security Standards',
    tip: 'Implement Pod Security Standards (Restricted, Baseline, Privileged) to enforce security policies',
  },
  {
    id: 'sec-003',
    category: 'security',
    icon: '🔒',
    title: 'RBAC',
    tip: 'Use Role-Based Access Control (RBAC) to grant least-privilege access to users and service accounts',
  },
  {
    id: 'sec-004',
    category: 'security',
    icon: '🔒',
    title: 'Network Policies',
    tip: 'Implement network policies to control traffic between pods and enforce microsegmentation',
  },
  {
    id: 'sec-005',
    category: 'security',
    icon: '🔒',
    title: 'Secret Management',
    tip: 'Use external secret managers (Vault, AWS Secrets Manager) instead of storing secrets in etcd',
  },
  {
    id: 'sec-006',
    category: 'security',
    icon: '🔒',
    title: 'Image Scanning',
    tip: 'Scan container images for vulnerabilities before deployment using tools like Trivy or Clair',
  },
  {
    id: 'sec-007',
    category: 'security',
    icon: '🔒',
    title: 'Admission Controllers',
    tip: 'Use admission controllers to enforce policies and validate resources before they are persisted',
  },
  {
    id: 'sec-008',
    category: 'security',
    icon: '🔒',
    title: 'TLS Everywhere',
    tip: 'Enable TLS for all communication between components and use cert-manager for certificate automation',
  },

  // ========== TROUBLESHOOTING (15%) ==========
  {
    id: 'ts-001',
    category: 'troubleshooting',
    icon: '🔧',
    title: 'Pod Logs',
    tip: 'Use kubectl logs -f to stream pod logs in real-time. Add --previous for crashed containers',
  },
  {
    id: 'ts-002',
    category: 'troubleshooting',
    icon: '🔧',
    title: 'Pod Describe',
    tip: 'kubectl describe pod shows events, conditions, and configuration - essential for debugging',
  },
  {
    id: 'ts-003',
    category: 'troubleshooting',
    icon: '🔧',
    title: 'Exec Into Pods',
    tip: 'Debug running pods with kubectl exec -it <pod> -- sh to inspect the container filesystem',
  },
  {
    id: 'ts-004',
    category: 'troubleshooting',
    icon: '🔧',
    title: 'Resource Events',
    tip: 'Check kubectl get events --sort-by=.metadata.creationTimestamp to see recent cluster activity',
  },
  {
    id: 'ts-005',
    category: 'troubleshooting',
    icon: '🔧',
    title: 'ImagePullBackOff',
    tip: 'ImagePullBackOff means the image cannot be pulled. Check image name, registry auth, and network',
  },
  {
    id: 'ts-006',
    category: 'troubleshooting',
    icon: '🔧',
    title: 'CrashLoopBackOff',
    tip: 'CrashLoopBackOff means the container is crashing repeatedly. Check logs and application health',
  },

  // ========== FUN FACTS (5%) ==========
  {
    id: 'ff-001',
    category: 'fun-fact',
    icon: '🎯',
    title: 'Etymology',
    tip: 'Kubernetes (K8s) means "helmsman" or "pilot" in Greek - steering your containers!',
  },
  {
    id: 'ff-002',
    category: 'fun-fact',
    icon: '🎯',
    title: 'K8s Abbreviation',
    tip: 'K8s is a numeronym: K + 8 letters (ubernete) + s = Kubernetes',
  },
  {
    id: 'ff-003',
    category: 'fun-fact',
    icon: '🎯',
    title: 'Logo Design',
    tip: 'The Kubernetes logo wheel has seven spokes, referencing the original project name "Project Seven"',
  },
  {
    id: 'ff-004',
    category: 'fun-fact',
    icon: '🎯',
    title: 'CNCF Project',
    tip: 'Kubernetes was the first project donated to the Cloud Native Computing Foundation (CNCF) in 2015',
  },
  {
    id: 'ff-005',
    category: 'fun-fact',
    icon: '🎯',
    title: 'Google Origins',
    tip: 'Kubernetes is based on Google\'s internal Borg system, which manages billions of containers',
  },
  {
    id: 'ff-006',
    category: 'fun-fact',
    icon: '🎯',
    title: 'Container Orchestration',
    tip: 'Kubernetes can orchestrate containers across multiple cloud providers and on-premises infrastructure',
  },
]

/**
 * Category weights for random selection
 * Ensures educational content is prioritized
 */
const categoryWeights: Record<TipCategory, number> = {
  'best-practice': 0.4,    // 40% - Most important
  'performance': 0.2,      // 20%
  'security': 0.2,         // 20%
  'troubleshooting': 0.15, // 15%
  'fun-fact': 0.05,        // 5% - Entertainment
}

/**
 * Get a random K8s tip using weighted category selection
 * 
 * @returns Random K8sTip object
 */
export const getRandomTip = (): K8sTip => {
  // Weighted random category selection
  const random = Math.random()
  let cumulativeWeight = 0
  let selectedCategory: TipCategory = 'best-practice'

  for (const [category, weight] of Object.entries(categoryWeights)) {
    cumulativeWeight += weight
    if (random <= cumulativeWeight) {
      selectedCategory = category as TipCategory
      break
    }
  }

  // Get all tips from selected category
  const categoryTips = k8sTips.filter((tip) => tip.category === selectedCategory)

  // Return random tip from category
  const randomIndex = Math.floor(Math.random() * categoryTips.length)
  return categoryTips[randomIndex]
}

/**
 * Get tips by specific category
 * 
 * @param category - Tip category to filter by
 * @returns Array of K8sTip objects
 */
export const getTipsByCategory = (category: TipCategory): K8sTip[] => {
  return k8sTips.filter((tip) => tip.category === category)
}

/**
 * Get total number of tips
 * 
 * @returns Total tip count
 */
export const getTipCount = (): number => {
  return k8sTips.length
}

/**
 * Get tip statistics by category
 * 
 * @returns Object with category counts
 */
export const getTipStats = (): Record<TipCategory, number> => {
  return {
    'best-practice': getTipsByCategory('best-practice').length,
    'performance': getTipsByCategory('performance').length,
    'security': getTipsByCategory('security').length,
    'troubleshooting': getTipsByCategory('troubleshooting').length,
    'fun-fact': getTipsByCategory('fun-fact').length,
  }
}

