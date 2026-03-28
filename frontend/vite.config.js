import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        kitchen: resolve(__dirname, 'kitchen.html'),
        student: resolve(__dirname, 'student.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true
  }
});
