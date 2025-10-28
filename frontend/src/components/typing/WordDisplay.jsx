import { memo, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import useTypingStore from '../../store/typingStore'

const WordDisplay = memo(() => {
  const {
    words,
    currentWordIndex,
    currentCharIndex,
    typedText,
    isTestActive
  } = useTypingStore()


  const processedWords = useMemo(() => {
    if (!words || words.length === 0) return []

    const fullText = words.join(' ')
    let typedIndex = 0

    return words.map((word, wordIndex) => {
      const wordStart = typedIndex
      const wordEnd = wordStart + word.length
      const isCurrentWord = wordIndex === currentWordIndex
      
      const chars = word.split('').map((char, charIndex) => {
        const absoluteIndex = wordStart + charIndex
        const isTyped = absoluteIndex < typedText.length
        const typedChar = isTyped ? typedText[absoluteIndex] : ''
        const isCurrent = isCurrentWord && charIndex === currentCharIndex
        
        let status = 'untyped'
        if (isTyped) {
          status = typedChar === char ? 'correct' : 'incorrect'
        } else if (isCurrent && isTestActive) {
          status = 'current'
        }

        return {
          char,
          status,
          absoluteIndex,
          isCurrent
        }
      })

      // Handle extra characters in current word
      if (isCurrentWord && typedText.length > wordEnd) {
        const extraChars = typedText.slice(wordEnd, typedText.length)
        extraChars.split('').forEach((char, index) => {
          chars.push({
            char,
            status: 'extra',
            absoluteIndex: wordEnd + index,
            isCurrent: false
          })
        })
      }

      typedIndex = wordEnd + 1 // +1 for space
      return {
        word,
        chars,
        wordIndex,
        isCurrentWord,
        isCompleted: wordIndex < currentWordIndex
      }
    })
  }, [words, currentWordIndex, currentCharIndex, typedText, isTestActive])

  const getCharacterClasses = (status, isCurrent) => {
    return clsx(
      'relative inline-block transition-colors duration-75',
      {
        'text-theme-secondary': status === 'correct',
        'bg-light-error dark:bg-dark-error text-white rounded-sm px-0.5': status === 'incorrect',
        'text-theme-muted': status === 'untyped',
        'bg-light-accent dark:bg-dark-accent text-black rounded-sm px-0.5': status === 'current',
        'bg-red-600 text-white rounded-sm px-0.5': status === 'extra'
      }
    )
  }

  const getWordClasses = (isCurrentWord, isCompleted) => {
    return clsx(
      'inline-block mr-3 mb-2',
      {
        'opacity-60': !isCurrentWord && !isCompleted,
        'opacity-100': isCurrentWord || isCompleted
      }
    )
  }

  if (!words || words.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-theme-muted">
          <div className="skeleton h-4 w-96 mb-2" />
          <div className="skeleton h-4 w-80 mb-2" />
          <div className="skeleton h-4 w-72" />
        </div>
      </div>
    )
  }

  return (
    <div className="typing-container">
      <div className="typing-text p-6 max-h-48 overflow-hidden relative">
        {/* Fade overlay for non-visible words */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-theme-secondary to-transparent z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-theme-secondary to-transparent z-10 pointer-events-none" />
        
        <div className="leading-relaxed">
          <AnimatePresence>
            {processedWords.map((wordData) => (
              <motion.span
                key={wordData.wordIndex}
                className={getWordClasses(wordData.isCurrentWord, wordData.isCompleted)}
                initial={wordData.wordIndex > currentWordIndex + 10 ? { opacity: 0, y: 10 } : false}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {wordData.chars.map((charData, charIndex) => (
                  <span
                    key={`${wordData.wordIndex}-${charIndex}`}
                    className={getCharacterClasses(charData.status, charData.isCurrent)}
                  >
                    {charData.char}
                    {charData.isCurrent && (
                      <span className="typing-caret absolute left-0 top-0 w-0.5 h-full bg-light-accent dark:bg-dark-accent" />
                    )}
                  </span>
                ))}
                
                {/* Space after word */}
                {wordData.wordIndex < words.length - 1 && (
                  <span className="text-theme-muted"> </span>
                )}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="h-1 bg-theme-secondary rounded-full mt-4 overflow-hidden">
        <motion.div
          className="h-full bg-light-accent dark:bg-dark-accent rounded-full"
          initial={{ width: 0 }}
          animate={{ 
            width: words.length > 0 
              ? `${(currentWordIndex / words.length) * 100}%` 
              : '0%' 
          }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  )
})

WordDisplay.displayName = 'WordDisplay'

export default WordDisplay