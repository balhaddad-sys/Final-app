import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Use project root, not public folder
  root: '.',
  publicDir: 'public/assets',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/index.html'),
        login: resolve(__dirname, 'public/login.html'),
        landing: resolve(__dirname, 'public/landing.html'),
        dashboard: resolve(__dirname, 'public/dashboard.html'),
        handover: resolve(__dirname, 'public/handover.html'),
        ai_assistant: resolve(__dirname, 'public/ai_assistant.html'),
        monitor: resolve(__dirname, 'public/monitor.html'),
        antibiotic_guide: resolve(__dirname, 'public/antibiotic_guide.html'),
        oncall_assistant: resolve(__dirname, 'public/oncall_assistant.html')
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
      '@': resolve(__dirname, 'src'),
      '@core': resolve(__dirname, 'src/core'),
      '@services': resolve(__dirname, 'src/services'),
      '@features': resolve(__dirname, 'src/features'),
      '@ui': resolve(__dirname, 'src/ui')
    }
  },

  server: {
    port: 3000,
    open: '/public/index.html',
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
