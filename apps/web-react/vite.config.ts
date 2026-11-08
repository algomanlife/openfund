import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'

/* cwd-independent absolute output paths (the build must always land in
   the repo-root react/ dir regardless of where npm is invoked from) */
const repoReact = fileURLToPath(new URL('../../react', import.meta.url))
const publishDir = fileURLToPath(new URL('../../publish-openfund', import.meta.url))

export default defineConfig(({ mode }) => ({
  plugins: [react(), {
    name: 'local-runtime-config',
    configureServer(server) {
      const serve = (_req: unknown, res: {setHeader: (key: string, value: string) => void; end: (value: string) => void}) => {
        const cmsUrl = process.env.VITE_DIRECTUS_URL || 'http://localhost:8055'
        res.setHeader('Content-Type', 'application/javascript')
        res.setHeader('Cache-Control', 'no-store')
        res.end(`window.__OPENFUND_RUNTIME_CONFIG__=${JSON.stringify({cmsUrl})};\n`)
      }
      server.middlewares.use('/runtime-config.js', serve)
      server.middlewares.use('/react/runtime-config.js', serve)
      server.middlewares.use('/react/react/runtime-config.js', serve)
    }
  }],
  define: { __OPENFUND_BUILD__: JSON.stringify({
    version: process.env.RELEASE_VERSION || 'development',
    commit: process.env.RELEASE_SOURCE_COMMIT || process.env.RENDER_GIT_COMMIT || execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
  }) },
  base: '/',
  build: {
    /* default target: repo-root 'react/' — the backend serves it at the site
       root (/) for clean history-routed URLs; `vite build --mode publish`
       targets publish-openfund/ */
    outDir: mode === 'publish' ? publishDir : repoReact,
    emptyOutDir: true
  },
  server: { port: 5173 }
}))
