module.exports = {
  purge: {
    content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
    options: {
      safelist: [/^bg-/, /^text-/, /^hover:bg-/, /^hover:text-/, /grid-/, /border-/, /^gap-/, /^w-/, /^h-/, /^m-/, /^p-/, /ring/, /flex/, /sm:/, /md:/, /lg:/, /xl:/ ], 
    },
  },    
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {},
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
