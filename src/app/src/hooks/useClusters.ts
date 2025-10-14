import { useQuery } from '@tanstack/react-query'
import { getClusters } from '@/services/api'
import api from '@/services/api'

export function useClusters(enabledOnly: boolean = false) {
  return useQuery({
    queryKey: enabledOnly ? ['clusters', 'enabled'] : ['clusters'],
    queryFn: async () => {
      if (enabledOnly) {
        const response = await api.get('/clusters?enabled=true')
        return response.data.clusters || []
      }
      return getClusters()
    },
  })
}

