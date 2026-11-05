import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Túneles de ngrok para abrir el servidor de desarrollo desde fuera de este equipo.
    // El punto inicial acepta cualquier subdominio.
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.dev', '.ngrok.app', '.ngrok.io'],
    // Desde un túnel, el navegador llama a /api en el mismo dominio y Vite lo reenvía al backend local.
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000', rewrite: path => path.replace(/^\/api/, '') },
    },
  },
})
