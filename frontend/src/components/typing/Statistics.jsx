import { memo } from 'react'
import { motion } from 'framer-motion'
import useTypingStore from '../../store/typingStore'
import Card from '../ui/Card'

const StatCard = memo(({ label, value, suffix = '', icon, color = 'accent' }) => {
  const colorClasses = {
    accent: 'text-light-accent dark:text-dark-accent',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-light-error dark:text-dark-error'
  }

  return (
    <Card className="stat-card min-h-20" hover>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {icon && (
          <div className="mb-2">
            {icon}
          </div>
        )}
        <div className={`stat-value ${colorClasses[color]}`}>
          {typeof value === 'number' ? Math.round(value) : value}
          <span className="text-sm ml-1">{suffix}</span>
        </div>
        <div className="stat-label mt-1">
          {label}
        </div>
      </motion.div>
    </Card>
  )
})

StatCard.displayName = 'StatCard'

const Statistics = memo(({ showAdvanced = false }) => {
  const {
    wpm,
    rawWpm,
    accuracy,
    consistency,
    errors,
    correctChars,
    incorrectChars,
    totalChars,
    isTestActive,
    isTestCompleted,
    startTime,
    duration,
    mode
  } = useTypingStore()

  // Calculate time remaining for time mode
  const getTimeRemaining = () => {
    if (mode !== 'time' || !isTestActive || !startTime) return duration
    const elapsed = (Date.now() - startTime) / 1000
    return Math.max(0, duration - elapsed)
  }

  const timeRemaining = getTimeRemaining()
  const progress = mode === 'time' 
    ? ((duration - timeRemaining) / duration) * 100
    : 0 // Word mode progress is handled in WordDisplay

  const getAccuracyColor = (acc) => {
    if (acc >= 95) return 'success'
    if (acc >= 85) return 'accent'
    if (acc >= 70) return 'warning'
    return 'error'
  }

  const getWpmColor = (wpm) => {
    if (wpm >= 80) return 'success'
    if (wpm >= 60) return 'accent'
    if (wpm >= 40) return 'warning'
    return 'error'
  }

  return (
    <div className="space-y-6">
      {/* Time progress (for time mode) */}
      {mode === 'time' && isTestActive && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-theme-secondary">Time Remaining</span>
            <span className="text-lg font-mono text-theme-primary">
              {Math.ceil(timeRemaining)}s
            </span>
          </div>
          <div className="h-2 bg-theme-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-light-accent dark:bg-dark-accent rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </Card>
      )}

      {/* Main statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="WPM"
          value={wpm}
          color={getWpmColor(wpm)}
        />
        <StatCard
          label="Accuracy"
          value={accuracy}
          suffix="%"
          color={getAccuracyColor(accuracy)}
        />
        <StatCard
          label="Errors"
          value={errors}
          color={errors > 5 ? 'error' : errors > 2 ? 'warning' : 'success'}
        />
        <StatCard
          label="Consistency"
          value={consistency}
          suffix="%"
          color={consistency >= 80 ? 'success' : consistency >= 60 ? 'accent' : 'warning'}
        />
      </div>

      {/* Advanced statistics */}
      {showAdvanced && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-semibold text-theme-primary">Advanced Stats</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard
              label="Raw WPM"
              value={rawWpm}
              color="accent"
            />
            <StatCard
              label="Correct Chars"
              value={correctChars}
              color="success"
            />
            <StatCard
              label="Incorrect Chars"
              value={incorrectChars}
              color="error"
            />
            <StatCard
              label="Total Chars"
              value={totalChars}
              color="accent"
            />
            <StatCard
              label="Error Rate"
              value={totalChars > 0 ? ((incorrectChars / totalChars) * 100) : 0}
              suffix="%"
              color="warning"
            />
            <StatCard
              label="Keystrokes"
              value={correctChars + incorrectChars}
              color="accent"
            />
          </div>
        </motion.div>
      )}

      {/* Test completion status */}
      {isTestCompleted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="text-center p-8 bg-gradient-to-r from-light-accent/10 to-transparent dark:from-dark-accent/10">
            <div className="text-3xl font-bold text-light-accent dark:text-dark-accent mb-2">
              Test Complete!
            </div>
            <div className="text-theme-secondary mb-4">
              Final Score: {wpm} WPM at {accuracy}% accuracy
            </div>
            <div className="flex justify-center space-x-4 text-sm text-theme-muted">
              <span>Errors: {errors}</span>
              <span>•</span>
              <span>Characters: {totalChars}</span>
              <span>•</span>
              <span>Consistency: {consistency}%</span>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Real-time feedback */}
      {isTestActive && !isTestCompleted && (
        <div className="text-center">
          <div className="inline-flex items-center space-x-4 text-sm text-theme-muted">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
              Test in progress
            </div>
            <span>Characters typed: {totalChars}</span>
            {mode === 'words' && (
              <span>Words remaining: {Math.max(0, useTypingStore.getState().words.length - useTypingStore.getState().currentWordIndex)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

Statistics.displayName = 'Statistics'

export default Statistics