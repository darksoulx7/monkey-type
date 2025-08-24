import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const useThemeStore = create(
  persist(
    (set, get) => ({
      // State
      theme: 'dark', // 'light' | 'dark' | 'system'
      effectiveTheme: 'dark', // The actual theme being applied
      
      // Actions
      setTheme: (theme) => {
        set({ theme })
        
        // Apply theme immediately
        const effectiveTheme = theme === 'system' 
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : theme
          
        get().applyTheme(effectiveTheme)
      },

      applyTheme: (effectiveTheme) => {
        set({ effectiveTheme })
        
        // Update document classes
        const root = document.documentElement
        root.classList.remove('light', 'dark')
        root.classList.add(effectiveTheme)
        
        // Update meta theme-color for mobile browsers
        const metaThemeColor = document.querySelector('meta[name="theme-color"]')
        if (metaThemeColor) {
          const color = effectiveTheme === 'dark' ? '#323437' : '#f5f5f5'
          metaThemeColor.setAttribute('content', color)
        }
      },

      toggleTheme: () => {
        const { theme } = get()
        const newTheme = theme === 'light' ? 'dark' : 'light'
        get().setTheme(newTheme)
      },

      initializeTheme: () => {
        const { theme, applyTheme } = get()
        
        // Set up system theme listener
        if (theme === 'system') {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
          const effectiveTheme = mediaQuery.matches ? 'dark' : 'light'
          applyTheme(effectiveTheme)
          
          // Listen for system theme changes
          const handleChange = (e) => {
            if (get().theme === 'system') {
              applyTheme(e.matches ? 'dark' : 'light')
            }
          }
          
          mediaQuery.addEventListener('change', handleChange)
          
          // Return cleanup function
          return () => mediaQuery.removeEventListener('change', handleChange)
        } else {
          applyTheme(theme)
        }
      },

      // Utility functions
      isDark: () => get().effectiveTheme === 'dark',
      isLight: () => get().effectiveTheme === 'light',
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
      }),
    }
  )
)

export default useThemeStore