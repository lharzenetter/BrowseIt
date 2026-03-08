import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Use jsdom for DOM APIs (window, document, performance.now, etc.)
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Increase timeout for performance tests that build 1M entries
    testTimeout: 120_000,
    // Run in a single fork so timings are more deterministic
    pool: 'forks',
    forks: {
      singleFork: true,
    },
  },
} as Parameters<typeof defineConfig>[0])
