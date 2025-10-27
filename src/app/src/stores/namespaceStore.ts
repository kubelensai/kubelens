import { useSessionStore } from './sessionStore'

// Re-export session store methods for backward compatibility
export const useNamespaceStore = () => {
  const session = useSessionStore((state) => state.session)
  const setSelectedNamespace = useSessionStore((state) => state.setSelectedNamespace)
  
  return {
    selectedNamespace: session?.selected_namespace || null,
    setSelectedNamespace,
    clearSelectedNamespace: () => setSelectedNamespace(null),
  }
}

