import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
  isDark: boolean
  toggleTheme: () => void
  setTheme: (isDark: boolean) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDark: false, // Light mode by default
      toggleTheme: () => set((state) => {
        const newIsDark = !state.isDark
        // Update document class
        if (newIsDark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
        return { isDark: newIsDark }
      }),
      setTheme: (isDark) => set(() => {
        // Update document class
        if (isDark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
        return { isDark }
      }),
    }),
    {
      name: 'theme-storage',
    }
  )
)

