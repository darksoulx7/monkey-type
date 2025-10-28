import { useEffect, useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useTypingStore from '../../store/typingStore'
import { keyboardHandler } from '../../utils/typingLogic'
import websocketManager from '../../utils/websocket'
import WordDisplay from './WordDisplay'
import Statistics from './Statistics'
import TestModeSelector from './TestModeSelector'
import Button from '../ui/Button'
import Card from '../ui/Card'

const TypingArea = () => {
  const hiddenInputRef = useRef(null)
  const [showStats, setShowStats] = useState(false)
  const [isCapturingInput, setIsCapturingInput] = useState(false)
  
  const {
    words,
    isTestActive,
    isTestCompleted,
    testId,
    processKeystroke,
    startTest,
    resetTest,
    completeTest,
    error,
    isLoading
  } = useTypingStore()


  // Focus management
  useEffect(() => {
    const focusInput = () => {
      if (hiddenInputRef.current && !isTestCompleted) {
        hiddenInputRef.current.focus()
        setIsCapturingInput(true)
      }
    }

    // Focus on mount
    focusInput()

    // Refocus on click anywhere
    const handleGlobalClick = () => focusInput()
    document.addEventListener('click', handleGlobalClick)

    return () => {
      document.removeEventListener('click', handleGlobalClick)
    }
  }, [isTestCompleted])

  // Keyboard shortcuts
  useEffect(() => {
    keyboardHandler.addShortcut('tab', handleRestart)
    keyboardHandler.addShortcut('enter', handleRestart)
    keyboardHandler.addShortcut('escape', () => {
      if (isTestActive) {
        resetTest()
      }
    })
    keyboardHandler.startListening()

    return () => {
      keyboardHandler.stopListening()
      keyboardHandler.destroy()
    }
  }, [isTestActive])

  // WebSocket integration
  useEffect(() => {
    try {
      if (testId && websocketManager && typeof websocketManager.isConnected === 'function' && websocketManager.isConnected()) {
        websocketManager.joinTest(testId)
      }
    } catch (error) {
      console.warn('WebSocket not available:', error)
    }
  }, [testId])

  const handleRestart = useCallback(() => {
    if (isTestCompleted || !isTestActive) {
      resetTest()
      startTest()
    } else {
      resetTest()
    }
  }, [isTestActive, isTestCompleted, resetTest, startTest])

  const handleKeyDown = useCallback((event) => {
    // Prevent default behavior for most keys during typing
    if (isTestActive && !isTestCompleted) {
      // Allow specific keys
      const allowedKeys = ['Tab', 'Enter', 'Escape', 'F5', 'F12']
      if (!allowedKeys.includes(event.key)) {
        event.preventDefault()
      }
    }

    // Handle special keys
    if (event.key === 'Tab' || event.key === 'Enter') {
      event.preventDefault()
      handleRestart()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      if (isTestActive) {
        resetTest()
      }
      return
    }

    // Process typing if test is active
    if (isTestActive && !isTestCompleted) {
      const timestamp = Date.now()
      processKeystroke(event.key, timestamp)

      // Send to WebSocket for real-time updates
      try {
        if (testId && websocketManager && typeof websocketManager.isConnected === 'function' && websocketManager.isConnected()) {
          websocketManager.sendKeystroke(testId, {
            key: event.key,
            timestamp,
            correct: true, // This would be calculated
            position: useTypingStore.getState().typedText.length
          })
        }
      } catch (error) {
        console.warn('WebSocket keystroke failed:', error)
      }
    }
  }, [isTestActive, isTestCompleted, processKeystroke, testId, handleRestart, resetTest])

  const handleInputFocus = () => {
    setIsCapturingInput(true)
  }

  const handleInputBlur = () => {
    setIsCapturingInput(false)
    // Refocus after a short delay
    setTimeout(() => {
      if (hiddenInputRef.current && !isTestCompleted) {
        hiddenInputRef.current.focus()
      }
    }, 100)
  }

  const handleStartTest = async () => {
    await startTest()
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus()
    }
  }

  // Prevent text selection and context menu during typing
  useEffect(() => {
    const preventSelection = (e) => {
      if (isTestActive && !isTestCompleted) {
        e.preventDefault()
      }
    }

    const preventContextMenu = (e) => {
      if (isTestActive && !isTestCompleted) {
        e.preventDefault()
      }
    }

    document.addEventListener('selectstart', preventSelection)
    document.addEventListener('contextmenu', preventContextMenu)

    return () => {
      document.removeEventListener('selectstart', preventSelection)
      document.removeEventListener('contextmenu', preventContextMenu)
    }
  }, [isTestActive, isTestCompleted])

  // Disable paste during typing
  useEffect(() => {
    const preventPaste = (e) => {
      if (isTestActive && !isTestCompleted) {
        e.preventDefault()
      }
    }

    document.addEventListener('paste', preventPaste)
    return () => document.removeEventListener('paste', preventPaste)
  }, [isTestActive, isTestCompleted])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hidden input for capturing keystrokes */}
      <input
        ref={hiddenInputRef}
        type="text"
        className="absolute -left-full opacity-0 pointer-events-none"
        value=""
        onChange={() => {}} // Prevent controlled input warnings
        onKeyDown={handleKeyDown}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />

      {/* Test Mode Selector */}
      {!isTestActive && !isTestCompleted && (
        <TestModeSelector />
      )}

      {/* Main Typing Interface */}
      <Card className="relative">
        {(!words || words.length === 0) ? (
          <div className="text-center py-16">
            <h2 className="heading-2 mb-4">Ready to start typing?</h2>
            <p className="body text-theme-secondary mb-8">
              Press the button below or use Tab/Enter to begin your test
            </p>
            <Button
              onClick={handleStartTest}
              loading={isLoading}
              size="lg"
              className="mb-4"
            >
              Start Test
            </Button>
            {error && (
              <p className="error-text text-sm">{error}</p>
            )}
          </div>
        ) : (
          <WordDisplay />
        )}

        {/* Input status indicator */}
        {!isCapturingInput && isTestActive && !isTestCompleted && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 right-4 px-3 py-1 bg-yellow-500 text-black text-xs rounded-full"
          >
            Click to focus
          </motion.div>
        )}
      </Card>

      {/* Statistics */}
      <AnimatePresence>
        {(isTestActive || isTestCompleted) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Statistics showAdvanced={showStats} />
            
            <div className="flex justify-center mt-4">
              <Button
                variant="ghost"
                onClick={() => setShowStats(!showStats)}
                size="sm"
              >
                {showStats ? 'Hide' : 'Show'} Advanced Stats
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex justify-center space-x-4">
        {(isTestActive || isTestCompleted) && (
          <Button
            onClick={handleRestart}
            variant="secondary"
          >
            {isTestCompleted ? 'Try Again' : 'Restart'} (Tab)
          </Button>
        )}
        
        {isTestCompleted && (
          <Button
            onClick={() => setShowStats(true)}
            variant="ghost"
          >
            View Details
          </Button>
        )}
      </div>

      {/* Keyboard shortcuts help */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="text-center text-sm text-theme-muted"
      >
        <p>
          Press <kbd className="px-2 py-1 bg-theme-secondary rounded text-theme-primary">Tab</kbd> or{' '}
          <kbd className="px-2 py-1 bg-theme-secondary rounded text-theme-primary">Enter</kbd> to restart •{' '}
          <kbd className="px-2 py-1 bg-theme-secondary rounded text-theme-primary">Esc</kbd> to reset
        </p>
      </motion.div>
    </div>
  )
}

export default TypingArea