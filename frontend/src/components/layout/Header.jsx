import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Moon, 
  Sun, 
  User, 
  Trophy, 
  BarChart3, 
  Settings,
  LogOut,
  Menu,
  X,
  Zap,
  Users
} from 'lucide-react'
import useThemeStore from '../../store/themeStore'
import useAuthStore from '../../store/authStore'
import Button from '../ui/Button'
import { clsx } from 'clsx'

const NavLink = ({ to, children, icon: Icon, mobile = false }) => {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <Link
      to={to}
      className={clsx(
        'flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-all duration-200',
        mobile ? 'w-full' : '',
        isActive 
          ? 'bg-light-accent dark:bg-dark-accent text-black' 
          : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary'
      )}
    >
      {Icon && <Icon className="w-4 h-4" />}
      <span>{children}</span>
    </Link>
  )
}

const UserMenu = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary transition-colors"
      >
        <User className="w-4 h-4" />
        <span className="hidden md:block">{user.username}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute right-0 mt-2 w-48 bg-theme-secondary border border-theme rounded-lg shadow-soft py-2 z-20"
          >
            <Link
              to="/profile"
              className="flex items-center space-x-2 px-4 py-2 text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <User className="w-4 h-4" />
              <span>Profile</span>
            </Link>
            <Link
              to="/settings"
              className="flex items-center space-x-2 px-4 py-2 text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </Link>
            <hr className="my-2 border-theme" />
            <button
              onClick={() => {
                onLogout()
                setIsOpen(false)
              }}
              className="flex items-center space-x-2 w-full px-4 py-2 text-left text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </motion.div>
        </>
      )}
    </div>
  )
}

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { theme, toggleTheme, isDark } = useThemeStore()
  const { user, isAuthenticated, logout } = useAuthStore()

  const navigation = [
    { to: '/', label: 'Test', icon: Zap },
    { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { to: '/multiplayer', label: 'Multiplayer', icon: Users },
    ...(isAuthenticated ? [
      { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    ] : [])
  ]

  const handleLogout = async () => {
    await logout()
    setIsMobileMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 bg-theme-primary/80 backdrop-blur-sm border-b border-theme">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link 
            to="/" 
            className="flex items-center space-x-3 text-theme-primary font-bold text-xl"
          >
            <motion.div
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.3 }}
              className="w-8 h-8 bg-light-accent dark:bg-dark-accent rounded-lg flex items-center justify-center"
            >
              <Zap className="w-5 h-5 text-black" />
            </motion.div>
            <span className="hidden sm:block">MonkeyType</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navigation.map((item) => (
              <NavLink key={item.to} to={item.to} icon={item.icon}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="p-2"
            >
              {isDark() ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>

            {/* User Actions */}
            {isAuthenticated && user ? (
              <UserMenu user={user} onLogout={handleLogout} />
            ) : (
              <div className="hidden md:flex items-center space-x-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Login
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2"
            >
              {isMobileMenuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden py-4 border-t border-theme"
          >
            <nav className="space-y-2">
              {navigation.map((item) => (
                <NavLink 
                  key={item.to} 
                  to={item.to} 
                  icon={item.icon} 
                  mobile
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
              
              {!isAuthenticated && (
                <>
                  <hr className="my-4 border-theme" />
                  <div className="space-y-2">
                    <Link 
                      to="/login" 
                      className="block w-full"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Button variant="ghost" className="w-full justify-start">
                        Login
                      </Button>
                    </Link>
                    <Link 
                      to="/register" 
                      className="block w-full"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Button className="w-full justify-start">
                        Sign Up
                      </Button>
                    </Link>
                  </div>
                </>
              )}

              {isAuthenticated && user && (
                <>
                  <hr className="my-4 border-theme" />
                  <Link
                    to="/profile"
                    className="flex items-center space-x-2 w-full px-3 py-2 text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary rounded-lg"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </Link>
                  <Link
                    to="/settings"
                    className="flex items-center space-x-2 w-full px-3 py-2 text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary rounded-lg"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 w-full px-3 py-2 text-left text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary rounded-lg"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </>
              )}
            </nav>
          </motion.div>
        )}
      </div>
    </header>
  )
}

export default Header