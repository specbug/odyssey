import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        background: resolve(__dirname, 'src/background/index.js'),
        content: resolve(__dirname, 'src/content/index.js'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep original paths for background and content scripts
          if (chunkInfo.name === 'background') {
            return 'src/background/index.js';
          }
          if (chunkInfo.name === 'content') {
            return 'src/content/index.js';
          }
          return '[name].[hash].js';
        },
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          // Keep CSS in src/content for content scripts
          if (assetInfo.name === 'index.css' || assetInfo.name === 'styles.css') {
            return 'src/content/styles.css';
          }
          return '[name].[ext]';
        },
      },
    },
  },
});
