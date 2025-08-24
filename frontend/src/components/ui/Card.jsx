import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'

const Card = forwardRef(({ 
  children, 
  className = '',
  hover = false,
  padding = true,
  ...props 
}, ref) => {
  const classes = clsx(
    'bg-theme-secondary rounded-xl border border-theme shadow-soft',
    padding && 'p-6',
    className
  )

  if (hover) {
    return (
      <motion.div
        ref={ref}
        className={classes}
        whileHover={{ y: -2, boxShadow: '0 8px 25px -3px rgba(0, 0, 0, 0.1)' }}
        transition={{ duration: 0.2 }}
        {...props}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div ref={ref} className={classes} {...props}>
      {children}
    </div>
  )
})

Card.displayName = 'Card'

export default Card