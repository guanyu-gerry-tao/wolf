// PostCSS pipeline is wired in S1 so dependencies resolve, but the Tailwind
// directives are not imported anywhere yet. They land alongside the React
// rewrite in S2/S3.
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
