import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Ensure node_modules resolution works for SDK files outside this directory
    preserveSymlinks: false,
    // Explicitly resolve viem subpath exports to handle dynamic imports in SDK
    alias: {
      // Map viem/accounts to the actual ESM file location for dynamic imports
      // This handles the SDK's dynamic import('viem/accounts') which Vite can't resolve
      // when processing SDK files outside this directory
      'viem/accounts': path.resolve(__dirname, 'node_modules/viem/_esm/accounts/index.js'),
    },
  },
  optimizeDeps: {
    // Pre-bundle viem and its subpath exports to handle dynamic imports in SDK
    include: [
      'viem',
      'viem/accounts',
      'viem/chains',
      'viem/utils',
    ],
    // Force pre-bundling even for dynamic imports
    esbuildOptions: {
      resolveExtensions: ['.js', '.ts', '.tsx', '.mjs'],
    },
  },
  // Ensure dependencies are resolved from this project's node_modules
  server: {
    fs: {
      // Allow serving files from one level up to the project root (for SDK access)
      allow: ['..'],
    },
  },
  build: {
    // Ensure commonjs dependencies are properly handled
    commonjsOptions: {
      include: [/viem/, /node_modules/],
    },
  },
})

