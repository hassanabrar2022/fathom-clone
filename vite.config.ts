import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Writes dist/_headers with a Content Security Policy that allows the page's
 * inline scripts by hash, so editing one can't silently break or loosen it.
 */
function securityHeaders(): Plugin {
  let outDir = '';
  return {
    name: 'fathom-clone-security-headers',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const html = readFileSync(resolve(outDir, 'index.html'), 'utf8');
      const hashes = [
        ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
      ].map(
        ([, body]) =>
          `'sha256-${createHash('sha256').update(body).digest('base64')}'`,
      );
      const policy = [
        "default-src 'self'",
        `script-src 'self' ${hashes.join(' ')}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "media-src 'self' blob:",
        "font-src 'self'",
        // Recordings upload straight to R2 with presigned URLs.
        "connect-src 'self' https://*.r2.cloudflarestorage.com",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join('; ');
      writeFileSync(
        resolve(outDir, '_headers'),
        `/*
  Content-Security-Policy: ${policy}
  Strict-Transport-Security: max-age=63072000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`,
      );
    },
  };
}

export default defineConfig({
  root: 'apps/web',
  plugins: [react(), tailwindcss(), securityHeaders()],
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
