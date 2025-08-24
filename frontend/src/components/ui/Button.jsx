import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'

const Button = forwardRef(({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  disabled = false,
  loading = false,
  className = '',
  onClick,
  ...props 
}, ref) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus-ring disabled:opacity-50 disabled:cursor-not-allowed'
  
  const variants = {
    primary: 'bg-light-accent dark:bg-dark-accent text-black hover:bg-opacity-90 active:bg-opacity-80',
    secondary: 'bg-theme-secondary border border-theme text-theme-primary hover:bg-opacity-80',
    ghost: 'text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary',
    danger: 'bg-light-error dark:bg-dark-error text-white hover:bg-opacity-90',
    success: 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600'
  }
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
    xl: 'px-8 py-4 text-xl'
  }
  
  const classes = clsx(
    baseClasses,
    variants[variant],
    sizes[size],
    className
  )

  const handleClick = (e) => {
    if (disabled || loading) return
    onClick?.(e)
  }

  return (
    <motion.button
      ref={ref}
      className={classes}
      onClick={handleClick}
      disabled={disabled || loading}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.1 }}
      {...props}
    >
      {loading && (
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </motion.button>
  )
})

Button.displayName = 'Button'

export default Button