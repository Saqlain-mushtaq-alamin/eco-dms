/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Main colors
        primary: '#abca2f',
        secondary: '#ffffff',
        accent: '#010203',

        // Backgrounds
        bgLight: '#ffffff',
        bgDark: '#010203',

        // Surfaces and neutrals
        neutral: {
          light: '#f1f1f1',
          medium: '#1d1e1f',
          dark: '#0e0e0e',
        },

        // Glass effect colors
        glass: {
          light: 'rgba(241, 241, 241, 0.5)',
          dark: 'rgba(29, 30, 31, 0.5)',
          border: 'rgba(255, 255, 255, 0.18)',
        },
      },
      backdropBlur: {
        glass: '10px',
      },
      borderRadius: {
        glass: '16px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
        'glass-hover': '0 8px 32px 0 rgba(171, 202, 47, 0.2)',
      },
    },
  },
  plugins: []
}