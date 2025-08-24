import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

const useRaceStore = create(
  subscribeWithSelector((set, get) => ({
    // Race state
    currentRace: null,
    availableRaces: [],
    isInRace: false,
    raceStatus: 'waiting', // 'waiting' | 'countdown' | 'active' | 'completed'
    countdownTime: 0,
    
    // Players
    players: [],
    currentUser: null,
    
    // Race configuration
    raceConfig: {
      name: '',
      mode: 'time',
      duration: 60,
      wordCount: 25,
      maxPlayers: 5,
      isPrivate: false,
      wordListId: null,
    },
    
    // Race progress
    words: [],
    playerProgress: {},
    
    // UI state
    isLoading: false,
    error: null,
    showCreateRaceModal: false,
    showJoinRaceModal: false,

    // Actions
    setRaceConfig: (config) => {
      set((state) => ({
        raceConfig: { ...state.raceConfig, ...config }
      }))
    },

    fetchAvailableRaces: async () => {
      set({ isLoading: true, error: null })
      
      try {
        const response = await fetch('/api/v1/races?status=waiting', {
          headers: {
            // Add auth headers if needed
          }
        })

        if (!response.ok) {
          throw new Error('Failed to fetch races')
        }

        const data = await response.json()
        
        set({
          availableRaces: data.races || [],
          isLoading: false,
        })
      } catch (error) {
        set({
          error: error.message,
          isLoading: false,
        })
      }
    },

    createRace: async (config) => {
      set({ isLoading: true, error: null })
      
      try {
        const response = await fetch('/api/v1/races', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Add auth headers
          },
          body: JSON.stringify(config),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to create race')
        }

        const race = await response.json()
        
        set({
          currentRace: race,
          isInRace: true,
          raceStatus: 'waiting',
          players: race.players || [],
          isLoading: false,
          showCreateRaceModal: false,
        })

        return { success: true, race }
      } catch (error) {
        set({
          error: error.message,
          isLoading: false,
        })
        return { success: false, error: error.message }
      }
    },

    joinRace: async (raceId) => {
      set({ isLoading: true, error: null })
      
      try {
        const response = await fetch(`/api/v1/races/${raceId}/join`, {
          method: 'POST',
          headers: {
            // Add auth headers
          }
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to join race')
        }

        const race = await response.json()
        
        set({
          currentRace: race,
          isInRace: true,
          raceStatus: race.status,
          players: race.players || [],
          words: race.words || [],
          isLoading: false,
          showJoinRaceModal: false,
        })

        return { success: true, race }
      } catch (error) {
        set({
          error: error.message,
          isLoading: false,
        })
        return { success: false, error: error.message }
      }
    },

    leaveRace: async () => {
      const { currentRace } = get()
      if (!currentRace) return

      try {
        await fetch(`/api/v1/races/${currentRace.id}/leave`, {
          method: 'POST',
          headers: {
            // Add auth headers
          }
        })
      } catch (error) {
        console.warn('Failed to leave race:', error)
      }

      set({
        currentRace: null,
        isInRace: false,
        raceStatus: 'waiting',
        players: [],
        words: [],
        playerProgress: {},
        countdownTime: 0,
      })
    },

    // WebSocket event handlers
    handlePlayerJoined: (player) => {
      set((state) => ({
        players: [...state.players, player],
      }))
    },

    handlePlayerLeft: (playerId) => {
      set((state) => ({
        players: state.players.filter(p => p.user.id !== playerId),
        playerProgress: Object.fromEntries(
          Object.entries(state.playerProgress).filter(([id]) => id !== playerId)
        ),
      }))
    },

    handleRaceStart: (data) => {
      set({
        raceStatus: 'countdown',
        countdownTime: data.countdown,
        words: data.words || [],
      })
    },

    handleCountdown: (seconds) => {
      set({ countdownTime: seconds })
    },

    handleRaceBegin: (data) => {
      set({
        raceStatus: 'active',
        words: data.words,
        countdownTime: 0,
      })
    },

    handleProgressUpdate: (players) => {
      const progress = {}
      players.forEach(player => {
        progress[player.id] = {
          position: player.position,
          wpm: player.wpm,
          accuracy: player.accuracy,
          rank: player.rank,
          isFinished: player.isFinished,
        }
      })
      
      set({
        playerProgress: progress,
        players: players,
      })
    },

    handlePlayerFinished: (data) => {
      set((state) => ({
        players: state.players.map(player => 
          player.user.id === data.playerId
            ? { ...player, isFinished: true, rank: data.rank, finishTime: data.finishTime }
            : player
        ),
      }))
    },

    handleRaceCompleted: (results) => {
      set({
        raceStatus: 'completed',
        players: results.rankings || get().players,
      })
    },

    // UI actions
    setShowCreateRaceModal: (show) => set({ showCreateRaceModal: show }),
    setShowJoinRaceModal: (show) => set({ showJoinRaceModal: show }),

    // Utility functions
    getCurrentUserProgress: () => {
      const { playerProgress, currentUser } = get()
      return currentUser ? playerProgress[currentUser.id] : null
    },

    getRankedPlayers: () => {
      const { players, playerProgress } = get()
      return players
        .map(player => ({
          ...player,
          progress: playerProgress[player.user.id] || { position: 0, wpm: 0, accuracy: 0 }
        }))
        .sort((a, b) => {
          if (a.progress.isFinished && !b.progress.isFinished) return -1
          if (!a.progress.isFinished && b.progress.isFinished) return 1
          return b.progress.position - a.progress.position
        })
    },

    isRaceCreator: () => {
      const { currentRace, currentUser } = get()
      return currentRace && currentUser && currentRace.createdBy === currentUser.id
    },

    canStartRace: () => {
      const { currentRace, players, raceStatus } = get()
      return currentRace && 
             players.length >= 2 && 
             raceStatus === 'waiting' && 
             get().isRaceCreator()
    },

    clearError: () => set({ error: null }),

    reset: () => {
      set({
        currentRace: null,
        availableRaces: [],
        isInRace: false,
        raceStatus: 'waiting',
        countdownTime: 0,
        players: [],
        currentUser: null,
        words: [],
        playerProgress: {},
        error: null,
        showCreateRaceModal: false,
        showJoinRaceModal: false,
      })
    },
  }))
)

export default useRaceStore