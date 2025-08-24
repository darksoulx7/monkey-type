import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Target, Zap, Calendar, Award, Clock } from 'lucide-react'
import { api } from '../utils/api'
import useAuthStore from '../store/authStore'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'

const StatCard = ({ icon: Icon, label, value, change, color = 'accent' }) => {
  const colorClasses = {
    accent: 'text-light-accent dark:text-dark-accent',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-light-error dark:text-dark-error'
  }

  return (
    <Card hover className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className={`text-2xl font-bold ${colorClasses[color]} mb-1`}>
            {value}
          </div>
          <div className="text-sm text-theme-muted">{label}</div>
          {change && (
            <div className={`text-xs mt-2 flex items-center ${
              change > 0 ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-theme-muted'
            }`}>
              <TrendingUp className="w-3 h-3 mr-1" />
              {change > 0 ? '+' : ''}{change}% from last week
            </div>
          )}
        </div>
        <div className={`p-3 rounded-full bg-theme-secondary ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  )
}

const RecentTestCard = ({ test }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getAccuracyColor = (accuracy) => {
    if (accuracy >= 95) return 'text-green-500'
    if (accuracy >= 85) return 'text-light-accent dark:text-dark-accent'
    if (accuracy >= 70) return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <motion.div
      whileHover={{ x: 4 }}
      className="flex items-center justify-between p-4 bg-theme-secondary rounded-lg border border-theme hover:border-light-accent dark:hover:border-dark-accent transition-all"
    >
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 bg-light-accent dark:bg-dark-accent rounded-lg flex items-center justify-center">
          <span className="text-black font-bold text-sm">
            {test.mode === 'time' ? `${test.duration}s` : `${test.wordCount}w`}
          </span>
        </div>
        <div>
          <div className="font-medium text-theme-primary">
            {test.wpm} WPM
          </div>
          <div className="text-sm text-theme-muted">
            {formatDate(test.completedAt)}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className={`font-medium ${getAccuracyColor(test.accuracy)}`}>
          {test.accuracy}%
        </div>
        <div className="text-sm text-theme-muted">
          {test.errors} errors
        </div>
      </div>
    </motion.div>
  )
}

const Dashboard = () => {
  const [stats, setStats] = useState(null)
  const [recentTests, setRecentTests] = useState([])
  const [achievements, setAchievements] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState('allTime')

  const { user } = useAuthStore()

  useEffect(() => {
    fetchDashboardData()
  }, [period])

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [statsData, testsData] = await Promise.all([
        api.getStatisticsOverview(period),
        api.getTestHistory({ limit: 10 })
      ])

      setStats(statsData.summary)
      setRecentTests(testsData.tests || [])
      setAchievements(statsData.achievements || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const periods = [
    { value: 'allTime', label: 'All Time' },
    { value: 'monthly', label: 'This Month' },
    { value: 'weekly', label: 'This Week' },
    { value: 'daily', label: 'Today' }
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-theme-primary">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="skeleton h-8 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-32 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-theme-primary flex items-center justify-center">
        <Card className="text-center p-8">
          <div className="text-light-error dark:text-dark-error mb-4">
            <BarChart3 className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="heading-3 mb-2">Failed to load dashboard</h2>
          <p className="text-theme-secondary mb-4">{error}</p>
          <Button onClick={fetchDashboardData}>
            Try Again
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-theme-primary">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="heading-2 mb-2">
              Welcome back, {user?.username}!
            </h1>
            <p className="text-theme-secondary">
              Here's your typing performance overview
            </p>
          </div>
          
          {/* Period Selector */}
          <div className="flex space-x-2 mt-4 sm:mt-0">
            {periods.map((p) => (
              <Button
                key={p.value}
                variant={period === p.value ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          >
            <StatCard
              icon={Zap}
              label="Average WPM"
              value={Math.round(stats.averageWpm)}
              change={stats.wpmChange}
              color="accent"
            />
            <StatCard
              icon={Target}
              label="Best WPM"
              value={Math.round(stats.bestWpm)}
              color="success"
            />
            <StatCard
              icon={BarChart3}
              label="Accuracy"
              value={`${Math.round(stats.averageAccuracy)}%`}
              change={stats.accuracyChange}
              color="success"
            />
            <StatCard
              icon={Clock}
              label="Tests Completed"
              value={stats.totalTests}
              change={stats.testsChange}
              color="accent"
            />
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Tests */}
          <div className="lg:col-span-2">
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="heading-3">Recent Tests</h3>
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </div>
              
              {recentTests.length > 0 ? (
                <div className="space-y-3">
                  {recentTests.map((test) => (
                    <RecentTestCard key={test.id} test={test} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-theme-muted mb-4">
                    <BarChart3 className="w-12 h-12 mx-auto opacity-50" />
                  </div>
                  <p className="text-theme-muted">No tests completed yet</p>
                  <Button className="mt-4" size="sm">
                    Start Your First Test
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* Achievements & Progress */}
          <div className="space-y-6">
            {/* Progress Summary */}
            <Card>
              <h3 className="heading-4 mb-4">Progress Summary</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-theme-secondary">Consistency</span>
                    <span className="text-theme-primary">{stats?.consistency || 0}%</span>
                  </div>
                  <div className="h-2 bg-theme-secondary rounded-full">
                    <motion.div
                      className="h-full bg-light-accent dark:bg-dark-accent rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${stats?.consistency || 0}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-theme-secondary">Time Typed</span>
                    <span className="text-theme-primary">
                      {Math.round((stats?.totalTimeTyped || 0) / 3600)}h
                    </span>
                  </div>
                  <div className="h-2 bg-theme-secondary rounded-full">
                    <motion.div
                      className="h-full bg-green-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(((stats?.totalTimeTyped || 0) / 36000) * 100, 100)}%` }}
                      transition={{ duration: 1, delay: 0.7 }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Recent Achievements */}
            <Card>
              <h3 className="heading-4 mb-4">Achievements</h3>
              {achievements.length > 0 ? (
                <div className="space-y-3">
                  {achievements.slice(0, 3).map((achievement) => (
                    <motion.div
                      key={achievement.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center space-x-3 p-3 bg-theme-secondary rounded-lg"
                    >
                      <div className="w-10 h-10 bg-light-accent dark:bg-dark-accent rounded-full flex items-center justify-center">
                        <Award className="w-5 h-5 text-black" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-theme-primary text-sm">
                          {achievement.name}
                        </div>
                        <div className="text-xs text-theme-muted">
                          {new Date(achievement.unlockedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="text-theme-muted mb-2">
                    <Award className="w-8 h-8 mx-auto opacity-50" />
                  </div>
                  <p className="text-sm text-theme-muted">
                    Complete tests to unlock achievements
                  </p>
                </div>
              )}
            </Card>

            {/* Quick Actions */}
            <Card>
              <h3 className="heading-4 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button variant="secondary" className="w-full justify-start">
                  <Calendar className="w-4 h-4 mr-2" />
                  View Test History
                </Button>
                <Button variant="secondary" className="w-full justify-start">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Export Statistics
                </Button>
                <Button variant="secondary" className="w-full justify-start">
                  <Target className="w-4 h-4 mr-2" />
                  Set Goals
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard