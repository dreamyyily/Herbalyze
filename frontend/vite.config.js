import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // To add only polyfills for specific globals, configure them here
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
})
