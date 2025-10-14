import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { getClusters, getCustomResourceDefinitions } from '@/services/api'
import { useQuery } from '@tanstack/react-query'

export interface CRDResource {
  kind: string
  plural: string
  singular: string
  version: string
  scope: 'Namespaced' | 'Cluster'
  group: string
  listKind: string
  shortNames?: string[]
}

export interface CRDGroup {
  name: string
  resources: CRDResource[]
}

export function useCRDGroups(clusterName?: string, enabled: boolean = true) {
  // Fetch all clusters
  const { data: clusters = [] } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
    enabled,
    select: (data) => data || [],
  })

  // Fetch CRDs for all clusters (or specific cluster)
  const crdQueries = clusters.map((cluster: any) => ({
    queryKey: ['customresourcedefinitions', cluster.name],
    queryFn: () => getCustomResourceDefinitions(cluster.name),
    enabled: enabled && clusters.length > 0,
  }))

  const crdResults = useQueries({ queries: crdQueries })

  // Group CRDs by API group
  const groups = useMemo(() => {
    // Flatten all CRDs from all clusters
    const allCRDs = crdResults.flatMap((result) => result.data || [])

    // Filter by cluster if specified
    const filteredCRDs = clusterName
      ? allCRDs.filter((crd: any) => crd.ClusterName === clusterName)
      : allCRDs

    // Group by API group
    const groupMap = new Map<string, CRDResource[]>()

    filteredCRDs.forEach((crd: any) => {
      const group = crd.spec?.group || crd.group || ''
      if (!group) return

      // Find storage version or first served version
      const versions = crd.spec?.versions || []
      const storageVersion = versions.find((v: any) => v.storage)
      const servedVersion = versions.find((v: any) => v.served)
      const version = (storageVersion || servedVersion || versions[0])?.name || ''

      if (!version) return

      const resource: CRDResource = {
        kind: crd.spec?.names?.kind || '',
        plural: crd.spec?.names?.plural || '',
        singular: crd.spec?.names?.singular || '',
        version,
        scope: crd.spec?.scope || 'Namespaced',
        group,
        listKind: crd.spec?.names?.listKind || '',
        shortNames: crd.spec?.names?.shortNames || [],
      }

      if (!groupMap.has(group)) {
        groupMap.set(group, [])
      }

      // Check if resource already exists (avoid duplicates from multiple clusters)
      const existing = groupMap.get(group)!
      const isDuplicate = existing.some(
        (r) => r.kind === resource.kind && r.group === resource.group
      )

      if (!isDuplicate) {
        existing.push(resource)
      }
    })

    // Convert to array and sort by group name (A-Z)
    const sortedGroups: CRDGroup[] = Array.from(groupMap.entries())
      .map(([name, resources]) => ({
        name,
        resources: resources.sort((a, b) => a.kind.localeCompare(b.kind)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return sortedGroups
  }, [crdResults, clusterName])

  const isLoading = crdResults.some((result) => result.isLoading || result.isFetching)

  const refetch = () => {
    crdResults.forEach((result) => {
      if (result.refetch) {
        result.refetch()
      }
    })
  }

  return { groups, isLoading, refetch }
}

