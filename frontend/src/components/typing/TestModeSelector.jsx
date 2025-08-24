import { memo } from 'react'
import { motion } from 'framer-motion'
import { Clock, Hash } from 'lucide-react'
import useTypingStore from '../../store/typingStore'
import Card from '../ui/Card'
import { clsx } from 'clsx'

const ModeButton = memo(({ 
  children, 
  isActive, 
  onClick, 
  icon: Icon 
}) => (
  <motion.button
    onClick={onClick}
    className={clsx(
      'flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200',
      isActive 
        ? 'bg-light-accent dark:bg-dark-accent text-black' 
        : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary'
    )}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
  >
    {Icon && <Icon className="w-4 h-4" />}
    <span>{children}</span>
  </motion.button>
))

ModeButton.displayName = 'ModeButton'

const ValueButton = memo(({ 
  value, 
  isActive, 
  onClick, 
  suffix = '' 
}) => (
  <motion.button
    onClick={onClick}
    className={clsx(
      'px-3 py-1.5 rounded-md font-medium transition-all duration-200',
      isActive 
        ? 'bg-light-accent dark:bg-dark-accent text-black' 
        : 'text-theme-muted hover:text-theme-primary hover:bg-theme-secondary'
    )}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
  >
    {value}{suffix}
  </motion.button>
))

ValueButton.displayName = 'ValueButton'

const TestModeSelector = memo(() => {
  const {
    mode,
    duration,
    wordCount,
    language,
    setTestMode,
    setLanguage
  } = useTypingStore()

  const timeOptions = [15, 30, 60, 120]
  const wordOptions = [10, 25, 50, 100]
  const languageOptions = [
    { value: 'english', label: 'English' },
    { value: 'spanish', label: 'Spanish' },
    { value: 'french', label: 'French' },
    { value: 'german', label: 'German' }
  ]

  const handleModeChange = (newMode) => {
    if (newMode === 'time') {
      setTestMode('time', duration)
    } else {
      setTestMode('words', wordCount)
    }
  }

  return (
    <Card className="space-y-6">
      {/* Mode Selection */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-theme-secondary uppercase tracking-wide">
          Test Mode
        </h3>
        <div className="flex space-x-2">
          <ModeButton
            isActive={mode === 'time'}
            onClick={() => handleModeChange('time')}
            icon={Clock}
          >
            Time
          </ModeButton>
          <ModeButton
            isActive={mode === 'words'}
            onClick={() => handleModeChange('words')}
            icon={Hash}
          >
            Words
          </ModeButton>
        </div>
      </div>

      {/* Value Selection */}
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-3"
      >
        <h3 className="text-sm font-medium text-theme-secondary uppercase tracking-wide">
          {mode === 'time' ? 'Duration' : 'Word Count'}
        </h3>
        <div className="flex space-x-2 flex-wrap">
          {mode === 'time' ? (
            timeOptions.map((time) => (
              <ValueButton
                key={time}
                value={time}
                suffix="s"
                isActive={duration === time}
                onClick={() => setTestMode('time', time)}
              />
            ))
          ) : (
            wordOptions.map((count) => (
              <ValueButton
                key={count}
                value={count}
                isActive={wordCount === count}
                onClick={() => setTestMode('words', count)}
              />
            ))
          )}
        </div>
      </motion.div>

      {/* Language Selection */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-theme-secondary uppercase tracking-wide">
          Language
        </h3>
        <div className="flex space-x-2 flex-wrap">
          {languageOptions.map((lang) => (
            <ValueButton
              key={lang.value}
              value={lang.label}
              isActive={language === lang.value}
              onClick={() => setLanguage(lang.value)}
            />
          ))}
        </div>
      </div>

      {/* Current Selection Summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="pt-4 border-t border-theme"
      >
        <div className="text-center text-sm text-theme-muted">
          <span className="text-theme-primary font-medium">
            {mode === 'time' ? `${duration} second` : `${wordCount} word`}
          </span>
          {' '}test in{' '}
          <span className="text-theme-primary font-medium capitalize">
            {language}
          </span>
        </div>
      </motion.div>

      {/* Tips */}
      <div className="text-xs text-theme-muted text-center space-y-1">
        <p>💡 <strong>Tip:</strong> Focus on accuracy first, speed will follow</p>
        <p>🎯 Try to maintain 95%+ accuracy for the best results</p>
      </div>
    </Card>
  )
})

TestModeSelector.displayName = 'TestModeSelector'

export default TestModeSelector