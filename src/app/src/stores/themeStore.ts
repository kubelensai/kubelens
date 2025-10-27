import { useSessionStore } from './sessionStore'

// Re-export session store methods for backward compatibility
export const useThemeStore = () => {
  const session = useSessionStore((state) => state.session)
  const setTheme = useSessionStore((state) => state.setTheme)
  
  const isDark = session?.selected_theme === 'dark'
  
  return {
    isDark,
    toggleTheme: async () => {
      const newTheme = isDark ? 'light' : 'dark'
      await setTheme(newTheme)
    },
    setTheme: async (isDark: boolean) => {
      await setTheme(isDark ? 'dark' : 'light')
    },
  }
}

