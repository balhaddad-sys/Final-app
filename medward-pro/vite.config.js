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
        app: resolve(__dirname, 'app.html'),
        landing: resolve(__dirname, 'landing.html'),
        login: resolve(__dirname, 'login.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        ai_assistant: resolve(__dirname, 'ai_assistant.html'),
        antibiotic_guide: resolve(__dirname, 'antibiotic_guide.html'),
        oncall_assistant: resolve(__dirname, 'oncall_assistant.html'),
        lab_scanner: resolve(__dirname, 'lab_scanner.html'),
        handover: resolve(__dirname, 'handover.html'),
        monitor: resolve(__dirname, 'monitor.html')
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
