/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FFF5F0',
          100: '#FFE8DC',
          200: '#FFD0B8',
          300: '#FFB088',
          400: '#FF8B52',
          500: '#FF6B35',
          600: '#E85A2A',
          700: '#C24A22',
          800: '#9C3B1B',
          900: '#7D3017',
        },
        dark: {
          50: '#2A2A35',
          100: '#22222C',
          200: '#1A1A24',
          300: '#14141C',
          400: '#0F0F16',
          500: '#0A0A0F',
          600: '#080810',
          700: '#05050A',
          800: '#030306',
          900: '#000000',
        },
        accent: {
          cyan: '#00F5FF',
          purple: '#A855F7',
          green: '#22C55E',
          yellow: '#FACC15',
        }
      },
      fontFamily: {
        display: ['Bebas Neue', 'sans-serif'],
        sans: ['Outfit', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.5s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'bounce-subtle': 'bounce-subtle 2s infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 107, 53, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(255, 107, 53, 0.6)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(-2%)' },
          '50%': { transform: 'translateY(0)' },
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-pattern': 'linear-gradient(135deg, #0A0A0F 0%, #14141C 50%, #0A0A0F 100%)',
      }
    },
  },
  plugins: [],
}

