import useAuthStore from '../store/authStore'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1'

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    
    // Get auth headers
    const authHeaders = useAuthStore.getState().getAuthHeaders()
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)
      
      // Handle 401 unauthorized - try to refresh token
      if (response.status === 401 && authHeaders.Authorization) {
        const refreshed = await useAuthStore.getState().refreshAccessToken()
        
        if (refreshed) {
          // Retry request with new token
          const newAuthHeaders = useAuthStore.getState().getAuthHeaders()
          config.headers = {
            ...config.headers,
            ...newAuthHeaders,
          }
          
          const retryResponse = await fetch(url, config)
          return this.handleResponse(retryResponse)
        } else {
          // Refresh failed, redirect to login
          throw new ApiError('Authentication failed', 401)
        }
      }
      
      return this.handleResponse(response)
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      
      // Network or other errors
      throw new ApiError(
        error.message || 'Network error occurred',
        0,
        'NETWORK_ERROR'
      )
    }
  }

  async handleResponse(response) {
    const contentType = response.headers.get('content-type')
    const isJson = contentType && contentType.includes('application/json')
    
    const data = isJson ? await response.json() : await response.text()
    
    if (!response.ok) {
      throw new ApiError(
        data.message || data.error || `HTTP ${response.status}`,
        response.status,
        data.code || 'API_ERROR',
        data.details
      )
    }
    
    return data
  }

  // Auth endpoints
  async login(identifier, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    })
  }

  async register(username, email, password) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    })
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    })
  }

  async refreshToken(refreshToken) {
    return this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    })
  }

  // User endpoints
  async getUserProfile() {
    return this.request('/users/profile')
  }

  async updateUserProfile(updates) {
    return this.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async getUserById(userId) {
    return this.request(`/users/${userId}`)
  }

  async getFriends(limit = 20, offset = 0) {
    return this.request(`/users/friends?limit=${limit}&offset=${offset}`)
  }

  async sendFriendRequest(userId) {
    return this.request('/users/friends', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
  }

  // Test endpoints
  async startTest(config) {
    return this.request('/tests/start', {
      method: 'POST',
      body: JSON.stringify(config),
    })
  }

  async submitTest(testId, results) {
    return this.request(`/tests/${testId}/submit`, {
      method: 'POST',
      body: JSON.stringify(results),
    })
  }

  async recordKeystroke(testId, keystrokeData) {
    return this.request(`/tests/${testId}/keystroke`, {
      method: 'POST',
      body: JSON.stringify(keystrokeData),
    })
  }

  async getTestHistory(params = {}) {
    const queryString = new URLSearchParams(params).toString()
    return this.request(`/tests/history${queryString ? `?${queryString}` : ''}`)
  }

  async getTestById(testId) {
    return this.request(`/tests/${testId}`)
  }

  // Leaderboard endpoints
  async getGlobalLeaderboard(params = {}) {
    const queryString = new URLSearchParams(params).toString()
    return this.request(`/leaderboard/global${queryString ? `?${queryString}` : ''}`)
  }

  async getFriendsLeaderboard(params = {}) {
    const queryString = new URLSearchParams(params).toString()
    return this.request(`/leaderboard/friends${queryString ? `?${queryString}` : ''}`)
  }

  // Word list endpoints
  async getWordLists(params = {}) {
    const queryString = new URLSearchParams(params).toString()
    return this.request(`/wordlists${queryString ? `?${queryString}` : ''}`)
  }

  async getWordListById(listId) {
    return this.request(`/wordlists/${listId}`)
  }

  async createWordList(wordList) {
    return this.request('/wordlists', {
      method: 'POST',
      body: JSON.stringify(wordList),
    })
  }

  async updateWordList(listId, updates) {
    return this.request(`/wordlists/${listId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async deleteWordList(listId) {
    return this.request(`/wordlists/${listId}`, {
      method: 'DELETE',
    })
  }

  // Statistics endpoints
  async getStatisticsOverview(period = 'allTime') {
    return this.request(`/stats/overview?period=${period}`)
  }

  async getProgressData(params = {}) {
    const queryString = new URLSearchParams(params).toString()
    return this.request(`/stats/progress${queryString ? `?${queryString}` : ''}`)
  }

  async exportStatistics(format, options = {}) {
    return this.request('/stats/export', {
      method: 'POST',
      body: JSON.stringify({ format, ...options }),
    })
  }

  // Race endpoints
  async getRaces(params = {}) {
    const queryString = new URLSearchParams(params).toString()
    return this.request(`/races${queryString ? `?${queryString}` : ''}`)
  }

  async createRace(raceConfig) {
    return this.request('/races', {
      method: 'POST',
      body: JSON.stringify(raceConfig),
    })
  }

  async getRaceById(raceId) {
    return this.request(`/races/${raceId}`)
  }

  async joinRace(raceId) {
    return this.request(`/races/${raceId}/join`, {
      method: 'POST',
    })
  }

  async leaveRace(raceId) {
    return this.request(`/races/${raceId}/leave`, {
      method: 'POST',
    })
  }
}

class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  isNetworkError() {
    return this.code === 'NETWORK_ERROR'
  }

  isAuthError() {
    return this.status === 401 || this.status === 403
  }

  isValidationError() {
    return this.status === 400
  }

  isNotFoundError() {
    return this.status === 404
  }

  isServerError() {
    return this.status >= 500
  }
}

// Create singleton instance
const api = new ApiClient()

export { api, ApiError }