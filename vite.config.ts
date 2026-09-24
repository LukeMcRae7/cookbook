/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base keeps the build portable: it works at the domain root and at any
// GitHub Pages subpath (https://user.github.io/cookbook/) without rebuilding.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
