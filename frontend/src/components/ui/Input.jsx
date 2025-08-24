import { forwardRef } from 'react'
import { clsx } from 'clsx'

const Input = forwardRef(({ 
  label,
  error,
  helperText,
  className = '',
  containerClassName = '',
  ...props 
}, ref) => {
  const inputClasses = clsx(
    'input',
    error && 'border-light-error dark:border-dark-error focus:ring-light-error dark:focus:ring-dark-error',
    className
  )

  return (
    <div className={clsx('space-y-1', containerClassName)}>
      {label && (
        <label className="block text-sm font-medium text-theme-primary">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={inputClasses}
        {...props}
      />
      {(error || helperText) && (
        <p className={clsx(
          'text-sm',
          error ? 'error-text' : 'text-theme-muted'
        )}>
          {error || helperText}
        </p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input