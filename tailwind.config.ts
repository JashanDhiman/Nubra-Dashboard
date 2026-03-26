import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ["'IBM Plex Mono'", 'monospace'],
        sans: ["'DM Sans'", 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#0a0e14',
          1: '#0f1520',
          2: '#141d2b',
          3: '#1a2436',
          4: '#202d42',
        },
        accent: {
          green: '#00d97e',
          red: '#ff4560',
          blue: '#2d9cf0',
          amber: '#f59e0b',
          muted: '#3d5a80',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.07)',
          bright: 'rgba(255,255,255,0.14)',
        },
        text: {
          primary: '#e8edf5',
          secondary: '#7a8fa6',
          muted: '#3d5570',
        },
      },
      animation: {
        'flash-green': 'flashGreen 0.4s ease-out',
        'flash-red': 'flashRed 0.4s ease-out',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
      },
      keyframes: {
        flashGreen: {
          '0%': { backgroundColor: 'rgba(0,217,126,0.3)' },
          '100%': { backgroundColor: 'transparent' },
        },
        flashRed: {
          '0%': { backgroundColor: 'rgba(255,69,96,0.25)' },
          '100%': { backgroundColor: 'transparent' },
        },
        pulseDot: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.2' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-4px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
