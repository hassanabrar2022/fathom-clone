// Production setup helpers. Reads .dev.vars and .env; never prints secret values.
//
//   node scripts/setup.mjs storage <https://your-app-origin> [...more origins]
//     Browser-upload CORS for those origins plus local dev, and a lifecycle
//     rule that removes uploads abandoned in staging/ after a day.
//   node scripts/setup.mjs secrets
//     Copies the Worker's runtime secrets from .dev.vars to Cloudflare.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';

const values = {
  ...(existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {}),
  ...parseEnv(readFileSync('.dev.vars', 'utf8')),
};
const runtimeSecrets = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'R2_ACCOUNT_ID',
  'R2_BUCKET_NAME',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
];
const localOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8788',
  'http://127.0.0.1:8788',
];

function wrangler(args, input) {
  const result = spawnSync('npx', ['wrangler', ...args], {
    input,
    encoding: 'utf8',
    env: { ...process.env, ...values },
  });
  if (result.status !== 0) {
    // Wrangler errors can echo request details; keep only the first line.
    const reason = (result.stderr || result.stdout).trim().split('\n')[0];
    throw new Error(`wrangler ${args.slice(0, 3).join(' ')} failed: ${reason}`);
  }
}

const [mode, ...rest] = process.argv.slice(2);
try {
  if (mode === 'storage') {
    const origins = rest.map((value) => new URL(value).origin);
    if (!origins.length)
      throw new Error('Pass the production origin, e.g. https://app.example.com');
    const bucket = values.R2_BUCKET_NAME;
    mkdirSync('.wrangler', { recursive: true });
    writeFileSync(
      '.wrangler/upload-cors.json',
      JSON.stringify({
        rules: [
          {
            allowed: {
              origins: [...origins, ...localOrigins],
              methods: ['PUT'],
              headers: ['Content-Type'],
            },
            exposeHeaders: ['ETag'],
            maxAgeSeconds: 3600,
          },
        ],
      }),
    );
    wrangler([
      'r2', 'bucket', 'cors', 'set', bucket,
      '--file', '.wrangler/upload-cors.json', '--force',
    ]);
    console.log(`Upload CORS allows: ${origins.join(', ')} (+ local dev).`);
    // Browser uploads wait under staging/ until processing verifies them.
    wrangler([
      'r2', 'bucket', 'lifecycle', 'add', bucket,
      'expire-abandoned-staging', 'staging/',
      '--expire-days', '1',
      '--abort-multipart-days', '1',
      '--force',
    ]);
    console.log('Lifecycle rule set: abandoned uploads in staging/ expire after 1 day.');
  } else if (mode === 'secrets') {
    const missing = runtimeSecrets.filter((name) => !values[name]);
    if (missing.length)
      throw new Error(`Fill these in .dev.vars first: ${missing.join(', ')}`);
    wrangler(
      ['secret', 'bulk'],
      JSON.stringify(
        Object.fromEntries(runtimeSecrets.map((name) => [name, values[name]])),
      ),
    );
    console.log(`${runtimeSecrets.length} runtime secrets set on the Worker.`);
  } else {
    throw new Error('Usage: node scripts/setup.mjs storage <origin...> | secrets');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Setup failed.');
  process.exitCode = 1;
}
