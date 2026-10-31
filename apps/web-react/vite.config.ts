import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/react/',
  /* build into the repo root 'react/' so the existing static server
     (127.0.0.1:4173) serves it at /react/ */
  build: { outDir: '../../react', emptyOutDir: true },
  server: { port: 5173 }
})
