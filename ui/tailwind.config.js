/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        healthy: '#22c55e',
        warning: '#f59e0b',
        critical: '#ef4444',
      },
    },
  },
  plugins: [],
};
