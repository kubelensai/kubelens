import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ClusterState {
  selectedCluster: string | null
  setSelectedCluster: (cluster: string | null) => void
  clearSelectedCluster: () => void
}

export const useClusterStore = create<ClusterState>()(
  persist(
    (set) => ({
      selectedCluster: null,
      setSelectedCluster: (cluster) => set({ selectedCluster: cluster }),
      clearSelectedCluster: () => set({ selectedCluster: null }),
    }),
    {
      name: 'cluster-storage',
    }
  )
)

