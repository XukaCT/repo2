import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Directs the build output to Frappe's public directory
    outDir: '../warroom_app/public/frontend',
    emptyOutDir: true,
    target: 'es2015',
    rollupOptions: {
      output: {
        // Ensures predictable filenames for Frappe to render
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    }
  },
  // Aligns React's asset requests with Frappe's internal routing
  base: '/assets/warroom_app/frontend/', 
});