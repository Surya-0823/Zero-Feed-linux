import { defineConfig } from 'vite';
import { resolve } from 'path';

const rootDir = import.meta.dirname;

export default defineConfig({
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(rootDir, 'src/popup/popup.html'),
        'background/service-worker': resolve(rootDir, 'src/background/service-worker.js'),
        'content/content': resolve(rootDir, 'src/content/content.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
