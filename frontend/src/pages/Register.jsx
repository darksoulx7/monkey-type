import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, User, Eye, EyeOff, UserPlus } from 'lucide-react'
import useAuthStore from '../store/authStore'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Card from '../components/ui/Card'

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState({})
  
  const navigate = useNavigate()
  const { register, isLoading, error, isAuthenticated, clearError } = useAuthStore()

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  // Clear error when component unmounts or form changes
  useEffect(() => {
    return () => clearError()
  }, [clearError])

  useEffect(() => {
    if (Object.values(formData).some(value => value)) {
      clearError()
      setErrors({})
    }
  }, [formData, clearError])

  const validateForm = () => {
    const newErrors = {}

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required'
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters'
    } else if (formData.username.length > 30) {
      newErrors.username = 'Username must be less than 30 characters'
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, hyphens, and underscores'
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, number, and special character'
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return

    const result = await register(formData.username, formData.email, formData.password)
    
    if (result.success) {
      navigate('/', { replace: true })
    }
  }

  const handleInputChange = (field) => (e) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }))
  }

  const getPasswordStrength = (password) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/\d/.test(password)) strength++
    if (/[@$!%*?&]/.test(password)) strength++
    return strength
  }

  const passwordStrength = getPasswordStrength(formData.password)
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong']
  const strengthColors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-green-600']

  return (
    <div className="min-h-screen bg-theme-primary flex items-center justify-center px-4 py-8">
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
            <UserPlus className="w-8 h-8 text-black" />
          </motion.div>
          <h1 className="heading-2 mb-2">Create Account</h1>
          <p className="text-theme-secondary">
            Join the community and track your typing journey
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

            {/* Username Field */}
            <div className="relative">
              <Input
                type="text"
                placeholder="Username"
                value={formData.username}
                onChange={handleInputChange('username')}
                error={errors.username}
                className="pl-10"
              />
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-theme-muted" />
            </div>

            {/* Email Field */}
            <div className="relative">
              <Input
                type="email"
                placeholder="Email address"
                value={formData.email}
                onChange={handleInputChange('email')}
                error={errors.email}
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

              {/* Password Strength Indicator */}
              {formData.password && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 h-1 bg-theme-secondary rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full transition-all duration-300 ${strengthColors[passwordStrength]}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${(passwordStrength / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-theme-muted">
                      {strengthLabels[passwordStrength]}
                    </span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="relative">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={handleInputChange('confirmPassword')}
                error={errors.confirmPassword}
                className="pl-10 pr-10"
              />
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-theme-muted" />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-theme-muted hover:text-theme-primary"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Terms and Conditions */}
            <div className="text-xs text-theme-muted text-center">
              By creating an account, you agree to our{' '}
              <Link to="/terms" className="text-light-accent dark:text-dark-accent hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-light-accent dark:text-dark-accent hover:underline">
                Privacy Policy
              </Link>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              loading={isLoading}
              className="w-full"
              size="lg"
            >
              Create Account
            </Button>
          </form>
        </Card>

        {/* Sign In Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-6"
        >
          <p className="text-theme-secondary">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-light-accent dark:text-dark-accent hover:underline font-medium"
            >
              Sign in
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

export default Register