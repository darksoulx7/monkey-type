import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

const useTypingStore = create(
  subscribeWithSelector((set, get) => ({
    // Test configuration
    mode: 'time', // 'time' | 'words'
    duration: 60, // in seconds for time mode
    wordCount: 25, // for words mode
    language: 'english',
    wordListId: null,
    
    // Test state
    testId: null,
    words: [],
    currentWordIndex: 0,
    currentCharIndex: 0,
    typedText: '',
    isTestActive: false,
    isTestCompleted: false,
    startTime: null,
    endTime: null,
    
    // Real-time statistics
    wpm: 0,
    rawWpm: 0,
    accuracy: 100,
    consistency: 100,
    correctChars: 0,
    incorrectChars: 0,
    totalChars: 0,
    errors: 0,
    
    // Keystroke tracking
    keystrokes: [],
    
    // Test results
    results: null,
    isLoading: false,
    error: null,

    // Actions
    setTestMode: (mode, value) => {
      set((state) => ({
        mode,
        [mode === 'time' ? 'duration' : 'wordCount']: value,
        // Reset test state when mode changes
        isTestActive: false,
        isTestCompleted: false,
        results: null,
      }))
    },

    setLanguage: (language) => set({ language }),
    setWordListId: (wordListId) => set({ wordListId }),

    startTest: async () => {
      set({ isLoading: true, error: null })
      
      const { mode, duration, wordCount, language, wordListId } = get()
      
      try {
        const response = await fetch('/api/v1/tests/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Add auth headers if needed
          },
          body: JSON.stringify({
            mode,
            ...(mode === 'time' ? { duration } : { wordCount }),
            language,
            ...(wordListId && { wordListId }),
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to start test')
        }

        const testData = await response.json()
        const testSession = testData.data.testSession

        console.log('API Response:', testData)
        console.log('Test Session:', testSession)
        console.log('Words:', testSession.words)

        set({
          testId: testSession.id,
          words: testSession.words,
          currentWordIndex: 0,
          currentCharIndex: 0,
          typedText: '',
          isTestActive: true,
          isTestCompleted: false,
          startTime: Date.now(),
          endTime: null,
          wpm: 0,
          rawWpm: 0,
          accuracy: 100,
          consistency: 100,
          correctChars: 0,
          incorrectChars: 0,
          totalChars: 0,
          errors: 0,
          keystrokes: [],
          results: null,
          isLoading: false,
          error: null,
        })
      } catch (error) {
        set({
          error: error.message,
          isLoading: false,
        })
      }
    },

    processKeystroke: (key, timestamp) => {
      const state = get()
      if (!state.isTestActive || state.isTestCompleted) return

      const { words, currentWordIndex, currentCharIndex, typedText } = state
      
      if (currentWordIndex >= words.length) return

      const currentWord = words[currentWordIndex]
      const targetText = words.slice(0, currentWordIndex + 1).join(' ')
      
      let newTypedText = typedText
      let newCurrentCharIndex = currentCharIndex
      let newCurrentWordIndex = currentWordIndex
      let newCorrectChars = state.correctChars
      let newIncorrectChars = state.incorrectChars
      let newErrors = state.errors

      // Handle different key types
      if (key === 'Backspace') {
        if (newTypedText.length > 0) {
          const removedChar = newTypedText[newTypedText.length - 1]
          newTypedText = newTypedText.slice(0, -1)
          
          // Adjust character and word indices
          if (newCurrentCharIndex > 0) {
            newCurrentCharIndex--
          } else if (newCurrentWordIndex > 0) {
            newCurrentWordIndex--
            newCurrentCharIndex = words[newCurrentWordIndex].length
          }
          
          // Adjust stats (simplified - in real implementation, track more detailed history)
          if (removedChar === targetText[newTypedText.length]) {
            newCorrectChars = Math.max(0, newCorrectChars - 1)
          } else {
            newIncorrectChars = Math.max(0, newIncorrectChars - 1)
          }
        }
      } else if (key === ' ') {
        // Space key - move to next word if current word is complete
        if (newCurrentCharIndex === currentWord.length) {
          newTypedText += ' '
          newCurrentWordIndex++
          newCurrentCharIndex = 0
          newCorrectChars++
        } else {
          // Incorrect space - count as error
          newTypedText += ' '
          newIncorrectChars++
          newErrors++
        }
      } else if (key.length === 1) {
        // Regular character
        const targetChar = targetText[newTypedText.length]
        newTypedText += key
        
        if (key === targetChar) {
          newCorrectChars++
          newCurrentCharIndex++
          
          // If word is complete, prepare for next word
          if (newCurrentCharIndex === currentWord.length) {
            // Wait for space to move to next word
          }
        } else {
          newIncorrectChars++
          newErrors++
          newCurrentCharIndex++
        }
      }

      // Calculate statistics
      const timeElapsed = (timestamp || Date.now()) - state.startTime
      const timeInMinutes = timeElapsed / 60000
      const totalChars = newCorrectChars + newIncorrectChars
      
      const newWpm = timeInMinutes > 0 ? Math.round((newCorrectChars / 5) / timeInMinutes) : 0
      const newRawWpm = timeInMinutes > 0 ? Math.round((totalChars / 5) / timeInMinutes) : 0
      const newAccuracy = totalChars > 0 ? Math.round((newCorrectChars / totalChars) * 100) : 100

      // Record keystroke
      const keystroke = {
        key,
        timestamp: timestamp || Date.now(),
        correct: key === targetText[typedText.length],
        position: typedText.length,
        wpm: newWpm,
        accuracy: newAccuracy,
      }

      // Check if test is complete
      const isComplete = state.mode === 'words' 
        ? newCurrentWordIndex >= words.length
        : timeElapsed >= state.duration * 1000

      set({
        typedText: newTypedText,
        currentWordIndex: newCurrentWordIndex,
        currentCharIndex: newCurrentCharIndex,
        correctChars: newCorrectChars,
        incorrectChars: newIncorrectChars,
        totalChars: totalChars,
        errors: newErrors,
        wpm: newWpm,
        rawWpm: newRawWpm,
        accuracy: newAccuracy,
        keystrokes: [...state.keystrokes, keystroke],
        isTestCompleted: isComplete,
        endTime: isComplete ? (timestamp || Date.now()) : null,
      })

      // If test is complete, calculate final results
      if (isComplete) {
        get().completeTest()
      }
    },

    completeTest: async () => {
      const state = get()
      if (!state.isTestActive || !state.testId) return

      set({ isTestActive: false, isLoading: true })

      try {
        const finalStats = {
          wpm: state.wpm,
          accuracy: state.accuracy,
          consistency: state.consistency,
          errors: state.errors,
          duration: state.endTime - state.startTime,
        }

        const response = await fetch(`/api/v1/tests/${state.testId}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Add auth headers if needed
          },
          body: JSON.stringify({
            completedText: state.typedText,
            keystrokes: state.keystrokes,
            duration: finalStats.duration,
            wpm: finalStats.wpm,
            accuracy: finalStats.accuracy,
            consistency: finalStats.consistency,
            errors: finalStats.errors,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to submit test results')
        }

        const results = await response.json()
        
        set({
          results,
          isLoading: false,
        })
      } catch (error) {
        set({
          error: error.message,
          isLoading: false,
        })
      }
    },

    resetTest: () => {
      set({
        testId: null,
        words: [],
        currentWordIndex: 0,
        currentCharIndex: 0,
        typedText: '',
        isTestActive: false,
        isTestCompleted: false,
        startTime: null,
        endTime: null,
        wpm: 0,
        rawWpm: 0,
        accuracy: 100,
        consistency: 100,
        correctChars: 0,
        incorrectChars: 0,
        totalChars: 0,
        errors: 0,
        keystrokes: [],
        results: null,
        error: null,
      })
    },

    // Utility functions
    getCurrentWord: () => {
      const { words, currentWordIndex } = get()
      return words[currentWordIndex] || ''
    },

    getProgress: () => {
      const { mode, words, currentWordIndex, startTime, duration } = get()
      
      if (mode === 'words') {
        return (currentWordIndex / words.length) * 100
      } else {
        const elapsed = Date.now() - startTime
        return Math.min((elapsed / (duration * 1000)) * 100, 100)
      }
    },

    getTimeRemaining: () => {
      const { mode, startTime, duration } = get()
      
      if (mode === 'words') return null
      
      const elapsed = Date.now() - startTime
      return Math.max(0, duration - elapsed / 1000)
    },

    clearError: () => set({ error: null }),
  }))
)

export default useTypingStore