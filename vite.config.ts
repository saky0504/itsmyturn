import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: true, // 모바일 접근을 위해 네트워크에 노출
    open: true,
  },
  define: {
    global: 'globalThis',
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
})
