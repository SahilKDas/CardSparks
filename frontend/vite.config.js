import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['cardsparks.galakc.com'],
    proxy: {
      // Cloudflare exposes the Vite origin. Forward same-origin API requests
      // to Django instead of letting React Router turn them into a 404 page.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})

