import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import fs from 'node:fs'

const hasCapacitor = fs.existsSync('./node_modules/@capacitor/core')

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      external: hasCapacitor ? [] : [/^@capacitor\/.*/],
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-db': ['dexie'],
          ...(hasCapacitor ? { 'vendor-cap': ['@capacitor/core'] } : {}),
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
