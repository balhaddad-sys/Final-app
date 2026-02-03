import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'icons',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html')
      },
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions']
        }
      }
    },
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },

  resolve: {
    alias: {
      '@core': resolve(__dirname, 'core'),
      '@services': resolve(__dirname, 'services'),
      '@ui': resolve(__dirname, 'ui'),
      '@data': resolve(__dirname, 'data'),
      '@utils': resolve(__dirname, 'utils')
    }
  },

  server: {
    port: 3000,
    open: '/app.html',
    cors: true
  },

  preview: {
    port: 4173
  },

  optimizeDeps: {
    include: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions']
  },

  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
  }
});
