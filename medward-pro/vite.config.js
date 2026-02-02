import { defineConfig } from 'vite';
import { resolve } from 'path';
import { rename, readdir, unlink, rmdir, cp } from 'fs/promises';
import { existsSync } from 'fs';

// Plugin to flatten HTML output from dist/public/ to dist/ and copy styles
function flattenHtmlOutput() {
  return {
    name: 'flatten-html-output',
    closeBundle: async () => {
      const publicDir = resolve(__dirname, 'dist/public');
      const distDir = resolve(__dirname, 'dist');
      const stylesSource = resolve(__dirname, 'public/styles');
      const stylesDest = resolve(__dirname, 'dist/styles');

      // Copy styles folder
      if (existsSync(stylesSource)) {
        await cp(stylesSource, stylesDest, { recursive: true });
      }

      if (existsSync(publicDir)) {
        const files = await readdir(publicDir);
        for (const file of files) {
          if (file.endsWith('.html')) {
            await rename(resolve(publicDir, file), resolve(distDir, file));
          }
        }
        // Remove empty public folder
        const remaining = await readdir(publicDir);
        if (remaining.length === 0) {
          await rmdir(publicDir);
        }
      }
    }
  };
}

export default defineConfig({
  // Use project root, not public folder
  root: '.',
  publicDir: 'public/assets',

  plugins: [flattenHtmlOutput()],

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
