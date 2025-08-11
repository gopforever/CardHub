import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        soft: '0 10px 30px -10px rgba(0,0,0,0.2)'
      }
    },
  },
  plugins: [],
} satisfies Config
