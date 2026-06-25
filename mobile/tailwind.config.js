/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          bg:        '#0D0D1A',
          surface:   '#13132A',
          card:      '#1A1A35',
          border:    '#2A2A50',
          primary:   '#7C3AED',
          secondary: '#4F46E5',
          accent:    '#A78BFA',
          neon:      '#8B5CF6',
          text:      '#F8FAFC',
          muted:     '#94A3B8',
          success:   '#22C55E',
          warning:   '#F59E0B',
          danger:    '#EF4444',
        },
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
