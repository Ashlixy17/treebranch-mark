import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: 'src/cli/main.ts',
    outDir: 'dist-cli',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'treebranch.js',
      },
    },
  },
})
