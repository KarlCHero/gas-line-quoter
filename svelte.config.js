import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    // Static SPA build (the app is client-only — see src/routes/+layout.js).
    // `fallback` emits the app shell so the single-page tool loads at the root.
    adapter: adapter({ fallback: 'index.html' }),
    // GitHub Pages serves a project site under /<repo>/. The deploy workflow
    // sets BASE_PATH; local dev/build leave it empty (served at root).
    paths: { base: process.env.BASE_PATH ?? '' }
  }
};

export default config;
