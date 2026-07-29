import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // iPhone compatibility: Vite 8's default target is too modern for
    // iOS 14/15 Safari — those devices failed to even parse the bundle
    // ("error de conexión" at room create/join). Transpile down.
    target: ['es2019', 'safari14'],
  },
})
