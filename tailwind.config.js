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
        'dark': '#1a1a1a',
        'card': '#2a2a2a',
        'subtle': '#3a3a3a',
        'accent': '#00aaff',
        'text': {
          'primary': '#ffffff',
          'muted': '#aaaaaa',
        },
      },
    },
  },
  plugins: [],
}
