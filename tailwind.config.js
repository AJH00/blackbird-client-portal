/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        black: '#09090b',
        surface: '#18181b',
        'surface-2': '#1f1f23',
        border: '#27272a',
        purple: {
          DEFAULT: '#7c3aed',
          light: '#a78bfa',
          dark: '#5b21b6',
          muted: '#4c1d95',
        },
        zinc: {
          50: '#fafafa', 100: '#f4f4f5', 300: '#d4d4d8',
          400: '#a1a1aa', 500: '#71717a', 600: '#52525b',
          700: '#3f3f46', 800: '#27272a', 900: '#18181b', 950: '#09090b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
