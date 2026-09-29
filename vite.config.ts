import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

// In production the server fills in %SITE_URL% per request (server.ts). The dev
// server and the single-file demo have no such step, so do it here.
const siteUrl = (mode: string): Plugin => ({
  name: 'site-url',
  apply: (_config, env) => env.command === 'serve' || mode === 'demo',
  transformIndexHtml: (html) =>
    html.replaceAll('%SITE_URL%', (process.env.APP_URL || (mode === 'demo' ? '' : 'http://localhost:3000')).replace(/\/+$/, '')),
});

export default defineConfig(({mode}) => {
  return {
    plugins: [react(), tailwindcss(), siteUrl(mode)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
