/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        // Electric violet — ANKxIOUS brand
        brand: {
          50:  '#f0eeff',
          100: '#e0dcff',
          200: '#c4bcff',
          300: '#a89ef9',
          400: '#9d94f9',
          500: '#7c6ff7',
          600: '#6358e0',
          700: '#4d43c0',
          800: '#3d3680',
          900: '#2a2560',
          950: '#16133a',
        },
        // Deep space surface tones
        surface: {
          50:  '#e8eaf5',
          100: '#c0c4df',
          200: '#9098c0',
          300: '#6068a0',
          400: '#4a5078',
          500: '#3e4468',
          600: '#2e3560',
          700: '#1e2440',
          800: '#151a2e',
          900: '#0e1220',
          950: '#080b14',
        },
        // Deep space backgrounds
        space: {
          50: '#e8eaf5',
          100: '#151a2e',
          200: '#0e1220',
          300: '#080b14',
          400: '#04060d',
        },
      },
      boxShadow: {
        'space-sm': '0 1px 3px rgba(0,0,0,0.40)',
        'space':    '0 4px 12px rgba(0,0,0,0.50)',
        'space-lg': '0 8px 32px rgba(0,0,0,0.60)',
        'space-xl': '0 16px 48px rgba(0,0,0,0.70)',
      },
      borderRadius: {
        'xl':  '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16,1,0.3,1)',
        'spin-slow': 'spin 1.5s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
