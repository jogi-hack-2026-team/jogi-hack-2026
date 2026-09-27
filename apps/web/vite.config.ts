import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.JOGI_WEB_HOST === '0.0.0.0' ? '0.0.0.0' : '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': process.env.JOGI_API_PROXY_TARGET ?? 'http://127.0.0.1:3000',
    },
  },
})
