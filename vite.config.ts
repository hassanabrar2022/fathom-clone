import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'apps/web',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (forwarded, incoming) => {
            // Preserve the production same-origin rule through the local dev proxy.
            if (
              ['http://localhost:5173', 'http://127.0.0.1:5173'].includes(
                incoming.headers.origin || '',
              )
            )
              forwarded.setHeader('Origin', 'http://127.0.0.1:8788');
          });
        },
      },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
