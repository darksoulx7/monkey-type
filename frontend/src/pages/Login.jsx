import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react'
import useAuthStore from '../store/authStore'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Card from '../components/ui/Card'

const Login = () => {
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isLoading, error, isAuthenticated, clearError } = useAuthStore()

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, location])

  // Clear error when component unmounts or form changes
  useEffect(() => {
    return () => clearError()
  }, [clearError])

  useEffect(() => {
    if (formData.identifier || formData.password) {
      clearError()
      setErrors({})
    }
  }, [formData, clearError])

  const validateForm = () => {
    const newErrors = {}

    if (!formData.identifier.trim()) {
      newErrors.identifier = 'Email or username is required'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return

    const result = await login(formData.identifier, formData.password)
    
    if (result.success) {
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    }
  }

  const handleInputChange = (field) => (e) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen bg-theme-primary flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-16 h-16 bg-light-accent dark:bg-dark-accent rounded-2xl flex items-center justify-center mx-auto mb-4"
          >
            <LogIn className="w-8 h-8 text-black" />
          </motion.div>
          <h1 className="heading-2 mb-2">Welcome Back</h1>
          <p className="text-theme-secondary">
            Sign in to track your typing progress
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Global Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 bg-light-error/10 dark:bg-dark-error/10 border border-light-error dark:border-dark-error rounded-lg"
              >
                <p className="error-text text-sm text-center">{error}</p>
              </motion.div>
            )}

            {/* Email/Username Field */}
            <div className="relative">
              <Input
                type="text"
                placeholder="Email or username"
                value={formData.identifier}
                onChange={handleInputChange('identifier')}
                error={errors.identifier}
                className="pl-10"
              />
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-theme-muted" />
            </div>

            {/* Password Field */}
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={formData.password}
                onChange={handleInputChange('password')}
                error={errors.password}
                className="pl-10 pr-10"
              />
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-theme-muted" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-theme-muted hover:text-theme-primary"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              loading={isLoading}
              className="w-full"
              size="lg"
            >
              Sign In
            </Button>

            {/* Forgot Password */}
            <div className="text-center">
              <Link
                to="/forgot-password"
                className="text-sm text-theme-secondary hover:text-light-accent dark:hover:text-dark-accent transition-colors"
              >
                Forgot your password?
              </Link>
            </div>
          </form>
        </Card>

        {/* Sign Up Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-6"
        >
          <p className="text-theme-secondary">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-light-accent dark:text-dark-accent hover:underline font-medium"
            >
              Sign up
            </Link>
          </p>
        </motion.div>

        {/* Guest Mode */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-4"
        >
          <Link
            to="/"
            className="text-sm text-theme-muted hover:text-theme-secondary transition-colors"
          >
            Continue as guest
          </Link>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default Login