/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        red: { accent: '#E8131C' },
        dark: { bg: '#0A0A0A', card: '#111111', border: '#1A1A1A' },
        text: { dim: '#888888', muted: '#555555', white: '#FFFFFF' },
      },
      fontFamily: {
        hero: ['"Anton"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Fira Code', 'monospace'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 0.8s ease-in-out infinite',
        'flash-white': 'flashWhite 0.6s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'bit-flip': 'bitFlip 0.3s ease-out',
        'blink': 'blink 1s step-end infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 4px rgba(232,19,28,0.3)' },
          '50%': { boxShadow: '0 0 16px rgba(232,19,28,0.7)' },
        },
        flashWhite: {
          '0%': { color: '#ffffff', textShadow: '0 0 8px rgba(255,255,255,0.6)' },
          '100%': { color: '#cccccc', textShadow: 'none' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bitFlip: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '50%': { opacity: '1', transform: 'translateY(2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
