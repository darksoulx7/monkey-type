import { useEffect } from 'react'
import TypingArea from '../components/typing/TypingArea'
import useThemeStore from '../store/themeStore'

const Home = () => {
  const { initializeTheme } = useThemeStore()

  // Initialize theme on mount
  useEffect(() => {
    const cleanup = initializeTheme()
    return cleanup
  }, [initializeTheme])

  return (
    <div className="min-h-screen bg-theme-primary">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="heading-1 mb-2">
            Test Your Typing Speed
          </h1>
          <p className="body-large text-theme-secondary max-w-2xl mx-auto">
            Improve your typing skills with our minimalist typing test. 
            Track your WPM, accuracy, and consistency in real-time.
          </p>
        </div>
        
        <TypingArea />
      </div>
    </div>
  )
}

export default Home