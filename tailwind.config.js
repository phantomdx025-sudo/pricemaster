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
        // Warm amber-based primary — textile/fabric feel
        brand: {
          50:  '#fdf8f0',
          100: '#faefd9',
          200: '#f4dbb0',
          300: '#ecc07e',
          400: '#e2a04a',
          500: '#d4842a',
          600: '#b86820',
          700: '#95501e',
          800: '#7a4020',
          900: '#65351d',
          950: '#361a0c',
        },
        // Deep warm brown for surfaces
        surface: {
          50:  '#faf7f5',
          100: '#f3ede7',
          200: '#e6d9cf',
          300: '#d4bfb0',
          400: '#bc9d8a',
          500: '#a6816c',
          600: '#8f6858',
          700: '#775549',
          800: '#62463e',
          900: '#523c35',
          950: '#2b1e1a',
        },
        // Off-white / cream for bg
        cream: {
          50: '#fffef9',
          100: '#fffbf0',
          200: '#fdf5e0',
          300: '#f9eccc',
        },
      },
      boxShadow: {
        'warm-sm': '0 1px 3px rgba(100,50,20,0.12)',
        'warm':    '0 4px 12px rgba(100,50,20,0.15)',
        'warm-lg': '0 8px 32px rgba(100,50,20,0.18)',
        'warm-xl': '0 16px 48px rgba(100,50,20,0.22)',
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
