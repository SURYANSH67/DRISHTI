import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // Listen on all local interfaces
    allowedHosts: ["drishti.local", "localhost", "127.0.0.1"] // Whitelist domains to bypass Vite DNS security
  }
})

