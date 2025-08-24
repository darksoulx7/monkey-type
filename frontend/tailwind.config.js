/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light theme colors
        light: {
          bg: '#f5f5f5',
          'bg-secondary': '#ffffff',
          text: '#323437',
          'text-secondary': '#646669',
          'text-muted': '#9ca0a5',
          accent: '#e2b714',
          error: '#ca4754',
          correct: '#d1d0c5',
          border: '#d1d0c5',
        },
        // Dark theme colors (Monkeytype inspired)
        dark: {
          bg: '#323437',
          'bg-secondary': '#2c2e31',
          text: '#d1d0c5',
          'text-secondary': '#646669',
          'text-muted': '#525252',
          accent: '#e2b714',
          error: '#ca4754',
          correct: '#d1d0c5',
          border: '#646669',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'SF Mono', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        '6xl': '3.75rem',
        // Typing specific sizes
        'typing-sm': '1.25rem',
        'typing-md': '1.5rem',
        'typing-lg': '1.75rem',
        'typing-xl': '2rem',
      },
      spacing: {
        '18': '4.5rem',
        '72': '18rem',
        '84': '21rem',
        '96': '24rem',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'fade-out': 'fadeOut 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'caret': 'caret 1s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        caret: {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'glow': '0 0 20px rgba(226, 183, 20, 0.4)',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [
    // Custom plugin for theme-specific utilities
    function({ addUtilities, theme }) {
      const newUtilities = {
        '.text-theme-primary': {
          '@apply text-light-text dark:text-dark-text': {},
        },
        '.text-theme-secondary': {
          '@apply text-light-text-secondary dark:text-dark-text-secondary': {},
        },
        '.text-theme-muted': {
          '@apply text-light-text-muted dark:text-dark-text-muted': {},
        },
        '.bg-theme-primary': {
          '@apply bg-light-bg dark:bg-dark-bg': {},
        },
        '.bg-theme-secondary': {
          '@apply bg-light-bg-secondary dark:bg-dark-bg-secondary': {},
        },
        '.border-theme': {
          '@apply border-light-border dark:border-dark-border': {},
        },
        '.typing-caret': {
          '@apply animate-caret': {},
        },
        '.typing-error': {
          '@apply bg-light-error dark:bg-dark-error text-white': {},
        },
        '.typing-correct': {
          '@apply text-light-correct dark:text-dark-correct': {},
        },
        '.typing-accent': {
          '@apply text-light-accent dark:text-dark-accent': {},
        },
      }
      addUtilities(newUtilities)
    }
  ],
}