import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import useAuthStore from './store/authStore'
import useThemeStore from './store/themeStore'

// Pages
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register' 
import Dashboard from './pages/Dashboard'
import Leaderboard from './pages/Leaderboard'

// Components
import Header from './components/layout/Header'

function App() {
  const { user } = useAuthStore()
  const { theme } = useThemeStore()

  // Apply theme to document
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <Router>
      <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300`}>
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={user ? <Dashboard /> : <Login />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App