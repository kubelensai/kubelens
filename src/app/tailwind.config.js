/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f1ff',   // Very light purple-blue
          100: '#e0e3ff',  // Light purple-blue
          200: '#c7cdff',  // Lighter purple-blue
          300: '#a5adff',  // Light purple-blue
          400: '#8591ff',  // Medium-light purple-blue
          500: '#465fff',  // Base color rgb(70, 95, 255)
          600: '#3d54e6',  // Medium-dark purple-blue
          700: '#3347cc',  // Dark purple-blue (for dark mode selected menu)
          800: '#293ab3',  // Darker purple-blue
          900: '#1f2d99',  // Very dark purple-blue
        },
        // Custom background colors
        'bg-light': '#f9fafb',    // Light mode background
        'bg-dark': '#0f1828',     // Dark mode background
        stroke: '#E2E8F0',
        strokedark: '#2E3A47',
      },
      backgroundColor: {
        'light': '#f9fafb',
        'dark': '#0f1828',
      },
      borderColor: {
        stroke: '#E2E8F0',
        strokedark: '#2E3A47',
      },
    },
  },
  plugins: [],
}

