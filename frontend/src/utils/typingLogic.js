/**
 * Typing test logic and calculations
 * Handles WPM, accuracy, consistency, and other typing statistics
 */

export class TypingCalculator {
  constructor() {
    this.keystrokes = []
    this.errors = []
    this.corrections = []
    this.startTime = null
    this.currentTime = null
  }

  reset() {
    this.keystrokes = []
    this.errors = []
    this.corrections = []
    this.startTime = null
    this.currentTime = null
  }

  setStartTime(time = Date.now()) {
    this.startTime = time
    this.currentTime = time
  }

  updateTime(time = Date.now()) {
    this.currentTime = time
  }

  recordKeystroke(key, isCorrect, position, timestamp = Date.now()) {
    const keystroke = {
      key,
      isCorrect,
      position,
      timestamp,
      timeFromStart: this.startTime ? timestamp - this.startTime : 0
    }

    this.keystrokes.push(keystroke)

    if (!isCorrect && key !== 'Backspace') {
      this.errors.push({
        position,
        timestamp,
        expectedChar: null, // Will be set by caller
        actualChar: key
      })
    }

    if (key === 'Backspace') {
      this.corrections.push({
        position,
        timestamp
      })
    }

    return keystroke
  }

  // Calculate Words Per Minute (WPM)
  // Standard: 1 word = 5 characters including spaces
  calculateWPM(correctChars, timeElapsed) {
    if (timeElapsed <= 0) return 0
    const minutes = timeElapsed / 60000 // Convert ms to minutes
    return Math.round((correctChars / 5) / minutes)
  }

  // Calculate Raw WPM (including errors)
  calculateRawWPM(totalChars, timeElapsed) {
    if (timeElapsed <= 0) return 0
    const minutes = timeElapsed / 60000
    return Math.round((totalChars / 5) / minutes)
  }

  // Calculate accuracy percentage
  calculateAccuracy(correctChars, totalChars) {
    if (totalChars === 0) return 100
    return Math.round((correctChars / totalChars) * 100)
  }

  // Calculate consistency (based on WPM variance over time)
  calculateConsistency(timeWindows = 10) {
    if (this.keystrokes.length < timeWindows) return 100

    const windowSize = Math.max(1, Math.floor(this.keystrokes.length / timeWindows))
    const wpmSamples = []

    for (let i = 0; i < timeWindows; i++) {
      const startIdx = i * windowSize
      const endIdx = Math.min((i + 1) * windowSize, this.keystrokes.length)
      const windowKeystrokes = this.keystrokes.slice(startIdx, endIdx)

      if (windowKeystrokes.length === 0) continue

      const correctInWindow = windowKeystrokes.filter(k => k.isCorrect).length
      const windowTimespan = windowKeystrokes[windowKeystrokes.length - 1].timeFromStart - 
                             windowKeystrokes[0].timeFromStart
      
      const wpm = this.calculateWPM(correctInWindow, windowTimespan)
      wpmSamples.push(wpm)
    }

    if (wpmSamples.length < 2) return 100

    // Calculate coefficient of variation (std dev / mean)
    const mean = wpmSamples.reduce((a, b) => a + b, 0) / wpmSamples.length
    const variance = wpmSamples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / wpmSamples.length
    const standardDeviation = Math.sqrt(variance)
    const coefficientOfVariation = mean > 0 ? (standardDeviation / mean) : 0

    // Convert to consistency percentage (lower CV = higher consistency)
    const consistency = Math.max(0, 100 - (coefficientOfVariation * 100))
    return Math.round(consistency)
  }

  // Get current statistics
  getCurrentStats(correctChars, totalChars, timeElapsed = null) {
    const elapsed = timeElapsed || (this.currentTime - this.startTime)
    
    return {
      wpm: this.calculateWPM(correctChars, elapsed),
      rawWpm: this.calculateRawWPM(totalChars, elapsed),
      accuracy: this.calculateAccuracy(correctChars, totalChars),
      consistency: this.calculateConsistency(),
      errors: this.errors.length,
      corrections: this.corrections.length,
      timeElapsed: elapsed
    }
  }

  // Advanced statistics
  getAdvancedStats() {
    if (this.keystrokes.length === 0) {
      return {
        keystrokesPerMinute: 0,
        averageKeyTime: 0,
        peakWPM: 0,
        lowestWPM: 0,
        burstiness: 0,
        errorRate: 0
      }
    }

    const totalTime = this.keystrokes[this.keystrokes.length - 1].timeFromStart
    const keystrokesPerMinute = (this.keystrokes.length / totalTime) * 60000

    // Calculate average time between keystrokes
    let totalKeyTime = 0
    for (let i = 1; i < this.keystrokes.length; i++) {
      totalKeyTime += this.keystrokes[i].timeFromStart - this.keystrokes[i - 1].timeFromStart
    }
    const averageKeyTime = totalKeyTime / (this.keystrokes.length - 1)

    // Calculate peak and lowest WPM in 5-second windows
    let peakWPM = 0
    let lowestWPM = Infinity
    const windowSize = 5000 // 5 seconds

    for (let i = 0; i < this.keystrokes.length; i++) {
      const windowStart = this.keystrokes[i].timeFromStart
      const windowEnd = windowStart + windowSize
      
      const windowKeystrokes = this.keystrokes.filter(k => 
        k.timeFromStart >= windowStart && k.timeFromStart <= windowEnd
      )
      
      const correctInWindow = windowKeystrokes.filter(k => k.isCorrect).length
      const wpm = this.calculateWPM(correctInWindow, windowSize)
      
      peakWPM = Math.max(peakWPM, wpm)
      if (wpm > 0) lowestWPM = Math.min(lowestWPM, wpm)
    }

    if (lowestWPM === Infinity) lowestWPM = 0

    // Calculate burstiness (typing rhythm consistency)
    let burstiness = 0
    if (this.keystrokes.length > 1) {
      const intervals = []
      for (let i = 1; i < this.keystrokes.length; i++) {
        intervals.push(this.keystrokes[i].timeFromStart - this.keystrokes[i - 1].timeFromStart)
      }
      
      const meanInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const variance = intervals.reduce((a, b) => a + Math.pow(b - meanInterval, 2), 0) / intervals.length
      const stdDev = Math.sqrt(variance)
      
      burstiness = meanInterval > 0 ? (stdDev - meanInterval) / (stdDev + meanInterval) : 0
      burstiness = Math.max(-1, Math.min(1, burstiness)) // Normalize to [-1, 1]
    }

    const errorRate = this.keystrokes.length > 0 ? (this.errors.length / this.keystrokes.length) * 100 : 0

    return {
      keystrokesPerMinute: Math.round(keystrokesPerMinute),
      averageKeyTime: Math.round(averageKeyTime),
      peakWPM,
      lowestWPM,
      burstiness: Math.round(burstiness * 100), // Convert to percentage
      errorRate: Math.round(errorRate)
    }
  }
}

// Text analysis utilities
export class TextAnalyzer {
  static analyzeText(text) {
    const words = text.trim().split(/\s+/)
    const characters = text.length
    const charactersNoSpaces = text.replace(/\s/g, '').length
    const uniqueChars = new Set(text.toLowerCase().replace(/\s/g, '')).size
    
    return {
      wordCount: words.length,
      characterCount: characters,
      characterCountNoSpaces: charactersNoSpaces,
      averageWordLength: words.length > 0 ? charactersNoSpaces / words.length : 0,
      uniqueCharacters: uniqueChars,
      difficulty: this.calculateDifficulty(text)
    }
  }

  static calculateDifficulty(text) {
    let score = 0
    const factors = {
      // Character variety
      uniqueChars: new Set(text.toLowerCase()).size,
      // Special characters
      specialChars: (text.match(/[^\w\s]/g) || []).length,
      // Numbers
      numbers: (text.match(/\d/g) || []).length,
      // Capital letters
      capitals: (text.match(/[A-Z]/g) || []).length,
      // Average word length
      avgWordLength: text.split(/\s+/).reduce((acc, word) => acc + word.length, 0) / text.split(/\s+/).length
    }

    // Score based on various factors
    score += Math.min(factors.uniqueChars * 2, 50) // Max 50 points for character variety
    score += Math.min(factors.specialChars * 5, 30) // Max 30 points for special chars
    score += Math.min(factors.numbers * 3, 20) // Max 20 points for numbers
    score += Math.min(factors.capitals * 2, 20) // Max 20 points for capitals
    score += Math.min(factors.avgWordLength * 5, 30) // Max 30 points for word length

    // Normalize to 1-100 scale
    return Math.min(100, Math.max(1, Math.round(score)))
  }

  static getWordList(category = 'common', count = 100) {
    // This would typically fetch from an API or predefined lists
    // For now, return a simple common word list
    const commonWords = [
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
      'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
      'this', 'but', 'his', 'by', 'from', 'they', 'she', 'or', 'an', 'will',
      'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out',
      'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can',
      'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year',
      'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now',
      'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use',
      'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want',
      'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'water', 'long'
    ]

    // Shuffle and return requested count
    const shuffled = [...commonWords].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.min(count, shuffled.length))
  }
}

// Character comparison utilities
export class CharacterMatcher {
  static compare(typed, target) {
    if (typed === target) return 'correct'
    if (typed === '') return 'untyped'
    return 'incorrect'
  }

  static getCharacterStatus(typedText, targetText) {
    const result = []
    const maxLength = Math.max(typedText.length, targetText.length)

    for (let i = 0; i < maxLength; i++) {
      const typedChar = typedText[i] || ''
      const targetChar = targetText[i] || ''

      if (i < typedText.length && i < targetText.length) {
        result.push({
          char: targetChar,
          status: this.compare(typedChar, targetChar),
          position: i
        })
      } else if (i >= typedText.length) {
        result.push({
          char: targetChar,
          status: 'untyped',
          position: i
        })
      } else {
        // Extra characters typed
        result.push({
          char: typedChar,
          status: 'extra',
          position: i
        })
      }
    }

    return result
  }

  static findCurrentPosition(typedText, targetText) {
    let position = 0
    for (let i = 0; i < Math.min(typedText.length, targetText.length); i++) {
      if (typedText[i] === targetText[i]) {
        position = i + 1
      } else {
        break
      }
    }
    return Math.min(position, targetText.length)
  }
}

// Keyboard shortcuts handler
export class KeyboardHandler {
  constructor() {
    this.shortcuts = new Map()
    this.isListening = false
  }

  addShortcut(key, callback, options = {}) {
    const shortcutKey = this.normalizeKey(key, options)
    this.shortcuts.set(shortcutKey, { callback, options })
  }

  removeShortcut(key, options = {}) {
    const shortcutKey = this.normalizeKey(key, options)
    this.shortcuts.delete(shortcutKey)
  }

  normalizeKey(key, options) {
    let normalized = key.toLowerCase()
    if (options.ctrl) normalized = 'ctrl+' + normalized
    if (options.alt) normalized = 'alt+' + normalized
    if (options.shift) normalized = 'shift+' + normalized
    if (options.meta) normalized = 'meta+' + normalized
    return normalized
  }

  handleKeyDown = (event) => {
    const key = event.key.toLowerCase()
    let shortcutKey = key

    if (event.ctrlKey) shortcutKey = 'ctrl+' + shortcutKey
    if (event.altKey) shortcutKey = 'alt+' + shortcutKey
    if (event.shiftKey && key.length > 1) shortcutKey = 'shift+' + shortcutKey // Only for special keys
    if (event.metaKey) shortcutKey = 'meta+' + shortcutKey

    const shortcut = this.shortcuts.get(shortcutKey)
    if (shortcut) {
      const { callback, options } = shortcut
      
      if (options.preventDefault !== false) {
        event.preventDefault()
      }
      
      if (options.stopPropagation !== false) {
        event.stopPropagation()
      }

      callback(event)
    }
  }

  startListening() {
    if (!this.isListening) {
      document.addEventListener('keydown', this.handleKeyDown)
      this.isListening = true
    }
  }

  stopListening() {
    if (this.isListening) {
      document.removeEventListener('keydown', this.handleKeyDown)
      this.isListening = false
    }
  }

  destroy() {
    this.stopListening()
    this.shortcuts.clear()
  }
}

// Export instances for convenience
export const typingCalculator = new TypingCalculator()
export const keyboardHandler = new KeyboardHandler()