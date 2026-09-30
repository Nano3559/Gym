import { cpSync, createReadStream, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const here = dirname(fileURLToPath(import.meta.url))
const WASM_FILES = join(here, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const WASM_MIME = { '.wasm': 'application/wasm', '.js': 'text/javascript' }

// MediaPipe necesita sus binarios .wasm/.js en runtime. En desarrollo los
// servimos desde node_modules y en build los copiamos a dist/mediapipe/wasm,
// así el proyecto no depende de un CDN externo ni versiona binarios en git.
function mediapipeWasm() {
  const copyToDist = {
    name: 'mediapipe-wasm-copy',
    apply: 'build',
    closeBundle() {
      const outDir = join(here, 'dist', 'mediapipe', 'wasm')
      if (!existsSync(WASM_FILES)) return
      cpSync(WASM_FILES, outDir, { recursive: true })
    },
  }

  const devServer = {
    name: 'mediapipe-wasm-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/mediapipe/wasm', (req, res, next) => {
        const name = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '')
        const filePath = join(WASM_FILES, name)
        if (!filePath.startsWith(WASM_FILES) || !existsSync(filePath)) return next()
        const ext = name.slice(name.lastIndexOf('.'))
        res.setHeader('Content-Type', WASM_MIME[ext] || 'application/octet-stream')
        createReadStream(filePath).pipe(res)
      })
    },
  }

  return [devServer, copyToDist]
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), mediapipeWasm()],
})
