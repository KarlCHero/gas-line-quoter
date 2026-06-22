import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    // Pinned port so previews never collide with other CheckHero apps (see STANDARDS.md).
    port: Number(process.env.PORT) || 5174,
    strictPort: true
  }
});
