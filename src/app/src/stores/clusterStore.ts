import { useSessionStore } from './sessionStore'

// Re-export session store methods for backward compatibility
export const useClusterStore = () => {
  const session = useSessionStore((state) => state.session)
  const setSelectedCluster = useSessionStore((state) => state.setSelectedCluster)
  
  return {
    selectedCluster: session?.selected_cluster || null,
    setSelectedCluster,
    clearSelectedCluster: () => setSelectedCluster(null),
  }
}

