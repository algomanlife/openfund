import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'

/* cwd-independent absolute output paths (the build must always land in
   the repo-root react/ dir regardless of where npm is invoked from) */
const repoReact = fileURLToPath(new URL('../../react', import.meta.url))
const publishDir = fileURLToPath(new URL('../../publish-openfund', import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: '/react/',
  build: {
    /* default target: repo-root 'react/' — served at http://127.0.0.1:4173/react/
       `vite build --mode publish` targets publish-openfund/ with base '/' */
    outDir: mode === 'publish' ? publishDir : repoReact,
    emptyOutDir: true
  },
  server: { port: 5173 }
}))
