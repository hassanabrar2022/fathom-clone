import { build } from 'esbuild';

await build({
  entryPoints: ['apps/worker/src/index.ts'],
  outfile: 'apps/web/dist/_worker.js',
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
});
