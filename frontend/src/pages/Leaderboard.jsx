import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Medal, Award, Clock, Hash, Users, Globe, TrendingUp } from 'lucide-react'
import { api } from '../utils/api'
import useAuthStore from '../store/authStore'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { clsx } from 'clsx'

const RankIcon = ({ rank }) => {
  if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />
  if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />
  return <span className="w-5 h-5 flex items-center justify-center text-theme-muted font-bold text-sm">#{rank}</span>
}

const LeaderboardEntry = ({ entry, currentUserId, index }) => {
  const isCurrentUser = entry.user.id === currentUserId
  
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={clsx(
        'flex items-center justify-between p-4 rounded-lg transition-all duration-200',
        isCurrentUser 
          ? 'bg-light-accent/10 dark:bg-dark-accent/10 border-2 border-light-accent dark:border-dark-accent' 
          : 'bg-theme-secondary border border-theme hover:border-light-accent/50 dark:hover:border-dark-accent/50'
      )}
    >
      <div className="flex items-center space-x-4">
        <div className="flex items-center justify-center w-8">
          <RankIcon rank={entry.rank} />
        </div>
        
        <div className="w-10 h-10 bg-light-accent dark:bg-dark-accent rounded-full flex items-center justify-center">
          <span className="text-black font-bold text-sm">
            {entry.user.username.charAt(0).toUpperCase()}
          </span>
        </div>
        
        <div>
          <div className={clsx(
            'font-medium',
            isCurrentUser ? 'text-light-accent dark:text-dark-accent' : 'text-theme-primary'
          )}>
            {entry.user.username}
            {isCurrentUser && <span className="ml-2 text-xs">(You)</span>}
          </div>
          <div className="text-sm text-theme-muted">
            {formatDate(entry.testDate)}
          </div>
        </div>
      </div>
      
      <div className="text-right">
        <div className="font-bold text-lg text-theme-primary">
          {Math.round(entry.wpm)} WPM
        </div>
        <div className="text-sm text-theme-secondary">
          {Math.round(entry.accuracy)}% • {Math.round(entry.consistency)}%
        </div>
      </div>
    </motion.div>
  )
}

const FilterButton = ({ active, onClick, children, icon: Icon }) => (
  <Button
    variant={active ? 'primary' : 'ghost'}
    size="sm"
    onClick={onClick}
    className="flex items-center space-x-1"
  >
    {Icon && <Icon className="w-4 h-4" />}
    <span>{children}</span>
  </Button>
)

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    type: 'global', // 'global' | 'friends'
    mode: 'time',   // 'time' | 'words'
    duration: 60,   // for time mode
    wordCount: 25,  // for words mode
    period: 'allTime' // 'daily' | 'weekly' | 'monthly' | 'allTime'
  })

  const { user, isAuthenticated } = useAuthStore()

  useEffect(() => {
    fetchLeaderboard()
  }, [filters])

  const fetchLeaderboard = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = {
        mode: filters.mode,
        period: filters.period,
        limit: 50
      }

      if (filters.mode === 'time') {
        params.duration = filters.duration
      } else {
        params.wordCount = filters.wordCount
      }

      const data = filters.type === 'global' 
        ? await api.getGlobalLeaderboard(params)
        : await api.getFriendsLeaderboard(params)

      setLeaderboard(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const timeOptions = [15, 30, 60, 120]
  const wordOptions = [10, 25, 50, 100]
  const periodOptions = [
    { value: 'daily', label: 'Today' },
    { value: 'weekly', label: 'This Week' },
    { value: 'monthly', label: 'This Month' },
    { value: 'allTime', label: 'All Time' }
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-theme-primary">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="skeleton h-8 w-64" />
            <div className="skeleton h-12 w-full" />
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton h-16 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-theme-primary">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="heading-1 mb-2">Leaderboard</h1>
          <p className="body-large text-theme-secondary">
            Compete with the fastest typists around the world
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <div className="space-y-6">
            {/* Leaderboard Type */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-theme-secondary uppercase tracking-wide">
                Leaderboard Type
              </h3>
              <div className="flex space-x-2">
                <FilterButton
                  active={filters.type === 'global'}
                  onClick={() => updateFilter('type', 'global')}
                  icon={Globe}
                >
                  Global
                </FilterButton>
                {isAuthenticated && (
                  <FilterButton
                    active={filters.type === 'friends'}
                    onClick={() => updateFilter('type', 'friends')}
                    icon={Users}
                  >
                    Friends
                  </FilterButton>
                )}
              </div>
            </div>

            {/* Test Mode */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-theme-secondary uppercase tracking-wide">
                Test Mode
              </h3>
              <div className="flex space-x-2">
                <FilterButton
                  active={filters.mode === 'time'}
                  onClick={() => updateFilter('mode', 'time')}
                  icon={Clock}
                >
                  Time
                </FilterButton>
                <FilterButton
                  active={filters.mode === 'words'}
                  onClick={() => updateFilter('mode', 'words')}
                  icon={Hash}
                >
                  Words
                </FilterButton>
              </div>
            </div>

            {/* Mode Value */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-theme-secondary uppercase tracking-wide">
                {filters.mode === 'time' ? 'Duration' : 'Word Count'}
              </h3>
              <div className="flex space-x-2 flex-wrap">
                {filters.mode === 'time' ? (
                  timeOptions.map((duration) => (
                    <FilterButton
                      key={duration}
                      active={filters.duration === duration}
                      onClick={() => updateFilter('duration', duration)}
                    >
                      {duration}s
                    </FilterButton>
                  ))
                ) : (
                  wordOptions.map((count) => (
                    <FilterButton
                      key={count}
                      active={filters.wordCount === count}
                      onClick={() => updateFilter('wordCount', count)}
                    >
                      {count}
                    </FilterButton>
                  ))
                )}
              </div>
            </div>

            {/* Time Period */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-theme-secondary uppercase tracking-wide">
                Time Period
              </h3>
              <div className="flex space-x-2 flex-wrap">
                {periodOptions.map((period) => (
                  <FilterButton
                    key={period.value}
                    active={filters.period === period.value}
                    onClick={() => updateFilter('period', period.value)}
                  >
                    {period.label}
                  </FilterButton>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="text-center p-8 mb-8">
            <div className="text-light-error dark:text-dark-error mb-4">
              <TrendingUp className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="heading-3 mb-2">Failed to load leaderboard</h3>
            <p className="text-theme-secondary mb-4">{error}</p>
            <Button onClick={fetchLeaderboard}>
              Try Again
            </Button>
          </Card>
        )}

        {/* Current User Position (if not in top list) */}
        {leaderboard?.currentUser && leaderboard.currentUser.rank > 50 && (
          <Card className="mb-6">
            <div className="p-2">
              <div className="text-sm text-theme-muted mb-2 text-center">Your Position</div>
              <LeaderboardEntry 
                entry={leaderboard.currentUser} 
                currentUserId={user?.id}
                index={0}
              />
            </div>
          </Card>
        )}

        {/* Leaderboard Entries */}
        {leaderboard?.entries && (
          <Card>
            <div className="space-y-2">
              <AnimatePresence>
                {leaderboard.entries.map((entry, index) => (
                  <LeaderboardEntry
                    key={`${entry.user.id}-${entry.rank}`}
                    entry={entry}
                    currentUserId={user?.id}
                    index={index}
                  />
                ))}
              </AnimatePresence>
            </div>

            {leaderboard.entries.length === 0 && (
              <div className="text-center py-12">
                <div className="text-theme-muted mb-4">
                  <Trophy className="w-16 h-16 mx-auto opacity-50" />
                </div>
                <h3 className="heading-3 mb-2">No entries found</h3>
                <p className="text-theme-secondary mb-6">
                  {filters.type === 'friends' 
                    ? "Your friends haven't completed any tests yet" 
                    : "No tests completed for this configuration"}
                </p>
                <Button>
                  {isAuthenticated ? 'Complete a Test' : 'Join to Compete'}
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Stats Summary */}
        {leaderboard?.entries && leaderboard.entries.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8"
          >
            <Card>
              <div className="text-center space-y-4">
                <h3 className="heading-4">Leaderboard Stats</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="text-2xl font-bold text-light-accent dark:text-dark-accent">
                      {Math.round(leaderboard.entries[0]?.wpm || 0)}
                    </div>
                    <div className="text-sm text-theme-muted">Highest WPM</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-500">
                      {Math.round(leaderboard.entries.reduce((acc, entry) => acc + entry.wpm, 0) / leaderboard.entries.length)}
                    </div>
                    <div className="text-sm text-theme-muted">Average WPM</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-theme-primary">
                      {leaderboard.entries.length}
                    </div>
                    <div className="text-sm text-theme-muted">Total Entries</div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Call to Action */}
        {!isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="text-center mt-8"
          >
            <Card className="p-8 bg-gradient-to-r from-light-accent/10 to-transparent dark:from-dark-accent/10">
              <h3 className="heading-3 mb-2">Ready to compete?</h3>
              <p className="text-theme-secondary mb-6">
                Sign up to track your progress and compete with others
              </p>
              <div className="space-x-4">
                <Button size="lg">
                  Create Account
                </Button>
                <Button variant="ghost" size="lg">
                  Continue as Guest
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default Leaderboard