import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NamespaceState {
  selectedNamespace: string | null
  setSelectedNamespace: (namespace: string | null) => void
  clearSelectedNamespace: () => void
}

export const useNamespaceStore = create<NamespaceState>()(
  persist(
    (set) => ({
      selectedNamespace: null,
      setSelectedNamespace: (namespace) => set({ selectedNamespace: namespace }),
      clearSelectedNamespace: () => set({ selectedNamespace: null }),
    }),
    {
      name: 'namespace-storage',
    }
  )
)

