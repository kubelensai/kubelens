/**
 * Cluster and Namespace Fallback Utility
 * 
 * Handles cases where a user navigates to a URL with a non-existent cluster or namespace.
 * Provides fallback logic to redirect to the first available cluster or default namespace.
 * 
 * @module utils/clusterFallback
 */

import api from '@/services/api'

interface Cluster {
  name: string
  enabled: boolean
  status: string
}

interface Namespace {
  name: string
}

/**
 * Get the first connected (enabled) cluster
 * 
 * @returns Promise<string | null> - First connected cluster name or null
 */
export const getFirstConnectedCluster = async (): Promise<string | null> => {
  try {
    console.log('[ClusterFallback] Fetching available clusters...')
    const response = await api.get('/clusters')
    const clusters: Cluster[] = response.data?.clusters || []
    
    // Find first enabled cluster with status "connected"
    const connectedCluster = clusters.find(
      (cluster) => cluster.enabled && cluster.status === 'connected'
    )
    
    if (connectedCluster) {
      console.log('[ClusterFallback] Found connected cluster:', connectedCluster.name)
      return connectedCluster.name
    }
    
    // Fallback: any enabled cluster
    const enabledCluster = clusters.find((cluster) => cluster.enabled)
    if (enabledCluster) {
      console.log('[ClusterFallback] Found enabled cluster:', enabledCluster.name)
      return enabledCluster.name
    }
    
    console.warn('[ClusterFallback] No connected or enabled clusters found')
    return null
  } catch (error) {
    console.error('[ClusterFallback] Error fetching clusters:', error)
    return null
  }
}

/**
 * Check if a cluster exists and is accessible
 * 
 * @param clusterName - Cluster name to check
 * @returns Promise<boolean> - True if cluster exists and is enabled
 */
export const clusterExists = async (clusterName: string): Promise<boolean> => {
  try {
    console.log('[ClusterFallback] Checking if cluster exists:', clusterName)
    const response = await api.get('/clusters')
    const clusters: Cluster[] = response.data?.clusters || []
    
    const cluster = clusters.find((c) => c.name === clusterName && c.enabled)
    const exists = !!cluster
    
    console.log('[ClusterFallback] Cluster exists:', exists)
    return exists
  } catch (error) {
    console.error('[ClusterFallback] Error checking cluster:', error)
    return false
  }
}

/**
 * Check if a namespace exists in a cluster
 * 
 * @param clusterName - Cluster name
 * @param namespaceName - Namespace name to check
 * @returns Promise<boolean> - True if namespace exists
 */
export const namespaceExists = async (
  clusterName: string,
  namespaceName: string
): Promise<boolean> => {
  try {
    console.log('[ClusterFallback] Checking if namespace exists:', clusterName, namespaceName)
    const response = await api.get(`/clusters/${clusterName}/namespaces`)
    const namespaces: Namespace[] = response.data || []
    
    const exists = namespaces.some((ns) => ns.name === namespaceName)
    console.log('[ClusterFallback] Namespace exists:', exists)
    
    return exists
  } catch (error) {
    console.error('[ClusterFallback] Error checking namespace:', error)
    return false
  }
}

/**
 * Build a corrected URL with fallback cluster and namespace
 * 
 * @param originalPath - Original URL path
 * @param fallbackCluster - Fallback cluster name (or null if original is valid)
 * @param fallbackNamespace - Fallback namespace name (or null if original is valid or not needed)
 * @returns string - Corrected URL path
 */
export const buildCorrectedUrl = (
  originalPath: string,
  fallbackCluster: string | null,
  fallbackNamespace: string | null = null
): string => {
  // Parse the original path
  const segments = originalPath.split('/').filter((s) => s)
  
  // Check if path has cluster pattern: /clusters/{cluster}/...
  const clusterIndex = segments.indexOf('clusters')
  if (clusterIndex === -1 || clusterIndex + 1 >= segments.length) {
    // No cluster in path, return as is
    return originalPath
  }
  
  // Replace cluster if fallback provided
  if (fallbackCluster) {
    segments[clusterIndex + 1] = fallbackCluster
    console.log('[ClusterFallback] Replaced cluster with:', fallbackCluster)
  }
  
  // Check if path has namespace pattern: /namespaces/{namespace}/...
  const namespaceIndex = segments.indexOf('namespaces')
  if (namespaceIndex !== -1 && namespaceIndex + 1 < segments.length && fallbackNamespace) {
    segments[namespaceIndex + 1] = fallbackNamespace
    console.log('[ClusterFallback] Replaced namespace with:', fallbackNamespace)
  }
  
  return '/' + segments.join('/')
}

/**
 * Validate and correct a URL path with cluster and namespace
 * 
 * @param path - URL path to validate
 * @returns Promise<string> - Corrected URL path or original if valid
 */
export const validateAndCorrectPath = async (path: string): Promise<string> => {
  console.log('[ClusterFallback] Validating path:', path)
  
  // Parse the path
  const segments = path.split('/').filter((s) => s)
  
  // Check for cluster pattern
  const clusterIndex = segments.indexOf('clusters')
  if (clusterIndex === -1 || clusterIndex + 1 >= segments.length) {
    // No cluster in path, no validation needed
    console.log('[ClusterFallback] No cluster in path, skipping validation')
    return path
  }
  
  const clusterName = segments[clusterIndex + 1]
  const exists = await clusterExists(clusterName)
  
  if (!exists) {
    // Cluster doesn't exist, get fallback
    console.warn('[ClusterFallback] Cluster not found:', clusterName)
    const fallbackCluster = await getFirstConnectedCluster()
    
    if (!fallbackCluster) {
      // No clusters available, redirect to clusters page
      console.warn('[ClusterFallback] No clusters available, redirecting to /clusters')
      return '/clusters'
    }
    
    // Check for namespace pattern
    const namespaceIndex = segments.indexOf('namespaces')
    let fallbackNamespace: string | null = null
    
    if (namespaceIndex !== -1 && namespaceIndex + 1 < segments.length) {
      const namespaceName = segments[namespaceIndex + 1]
      const nsExists = await namespaceExists(fallbackCluster, namespaceName)
      
      if (!nsExists) {
        console.warn('[ClusterFallback] Namespace not found:', namespaceName)
        fallbackNamespace = 'default'
      }
    }
    
    return buildCorrectedUrl(path, fallbackCluster, fallbackNamespace)
  }
  
  // Cluster exists, check namespace if present
  const namespaceIndex = segments.indexOf('namespaces')
  if (namespaceIndex !== -1 && namespaceIndex + 1 < segments.length) {
    const namespaceName = segments[namespaceIndex + 1]
    const nsExists = await namespaceExists(clusterName, namespaceName)
    
    if (!nsExists) {
      console.warn('[ClusterFallback] Namespace not found:', namespaceName)
      return buildCorrectedUrl(path, null, 'default')
    }
  }
  
  // Path is valid
  console.log('[ClusterFallback] Path is valid')
  return path
}

