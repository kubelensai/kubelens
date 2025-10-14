import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'

interface SearchResult {
  id: string
  type: 'cluster' | 'pod' | 'deployment' | 'service' | 'node' | 'event'
  name: string
  cluster?: string
  namespace?: string
  status?: string
  description?: string
}

interface SearchResponse {
  query: string
  results: SearchResult[]
  count: number
}

export function useSearch(query: string, enabled: boolean = true) {
  return useQuery<SearchResponse>({
    queryKey: ['search', query],
    queryFn: async () => {
      if (!query || query.trim().length === 0) {
        return { query: '', results: [], count: 0 }
      }
      const response = await api.get(`/search?q=${encodeURIComponent(query)}`)
      return response.data
    },
    enabled: enabled && query.trim().length > 0,
    staleTime: 5000, // Consider data fresh for 5 seconds
    refetchOnWindowFocus: false,
  })
}

