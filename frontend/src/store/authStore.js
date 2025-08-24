import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      login: async (identifier, password) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ identifier, password }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || 'Login failed')
          }

          const data = await response.json()
          
          set({
            user: data.user,
            accessToken: data.tokens.accessToken,
            refreshToken: data.tokens.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })

          return { success: true, user: data.user }
        } catch (error) {
          set({
            error: error.message,
            isLoading: false,
          })
          return { success: false, error: error.message }
        }
      },

      register: async (username, email, password) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await fetch('/api/v1/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || 'Registration failed')
          }

          const data = await response.json()
          
          set({
            user: data.user,
            accessToken: data.tokens.accessToken,
            refreshToken: data.tokens.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })

          return { success: true, user: data.user }
        } catch (error) {
          set({
            error: error.message,
            isLoading: false,
          })
          return { success: false, error: error.message }
        }
      },

      logout: async () => {
        try {
          const { accessToken } = get()
          if (accessToken) {
            await fetch('/api/v1/auth/logout', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            })
          }
        } catch (error) {
          console.warn('Logout request failed:', error)
        } finally {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            error: null,
          })
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get()
        
        if (!refreshToken) {
          set({ isAuthenticated: false })
          return false
        }

        try {
          const response = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          })

          if (!response.ok) {
            throw new Error('Token refresh failed')
          }

          const data = await response.json()
          
          set({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken || refreshToken,
          })

          return true
        } catch (error) {
          console.error('Token refresh failed:', error)
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          })
          return false
        }
      },

      updateProfile: async (updates) => {
        set({ isLoading: true, error: null })
        
        try {
          const { accessToken } = get()
          const response = await fetch('/api/v1/users/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify(updates),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || 'Profile update failed')
          }

          const updatedUser = await response.json()
          
          set({
            user: updatedUser,
            isLoading: false,
            error: null,
          })

          return { success: true, user: updatedUser }
        } catch (error) {
          set({
            error: error.message,
            isLoading: false,
          })
          return { success: false, error: error.message }
        }
      },

      clearError: () => set({ error: null }),

      // Utility functions
      getAuthHeaders: () => {
        const { accessToken } = get()
        return accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}
      },

      isTokenExpired: () => {
        const { accessToken } = get()
        if (!accessToken) return true
        
        try {
          const payload = JSON.parse(atob(accessToken.split('.')[1]))
          return Date.now() >= payload.exp * 1000
        } catch {
          return true
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

export default useAuthStore