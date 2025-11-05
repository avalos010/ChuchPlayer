/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./index.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        'dark': '#0d1117',
        'darker': '#010409',
        'card': '#161b22',
        'card-hover': '#1f2937',
        'subtle': '#21262d',
        'accent': '#00d4ff',
        'accent-dark': '#00a8cc',
        'accent-light': '#33dfff',
        'border': '#30363d',
        'border-light': '#3d444d',
        'text': {
          'primary': '#f0f6fc',
          'secondary': '#c9d1d9',
          'muted': '#8b949e',
          'accent': '#00d4ff',
        },
      },
      backgroundImage: {
        'gradient-dark': 'linear-gradient(180deg, #0d1117 0%, #010409 100%)',
        'gradient-card': 'linear-gradient(135deg, #161b22 0%, #0d1117 100%)',
      },
    },
  },
  plugins: [],
}
