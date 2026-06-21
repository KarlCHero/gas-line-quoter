import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Fixed dev port so previews never collide with sibling apps (see checkhero-standards).
    port: Number(process.env.PORT) || 5174,
    strictPort: true,
  },
})
