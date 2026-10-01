import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const children = new Set();
let stopping = false;

function start(command, args, label) {
  const child = spawn(command, args, { cwd: project, stdio: 'inherit' });
  children.add(child);
  child.once('exit', (code, signal) => {
    children.delete(child);
    if (!stopping) {
      console.error(`${label} stopped (${signal ?? code}).`);
      stop(1);
    }
  });
  return child;
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGINT');
  setTimeout(() => process.exit(code), 250).unref();
}

async function check(url, predicate) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok && (await predicate(response));
  } catch {
    return false;
  }
}

const apiReady = () =>
  check('http://127.0.0.1:8788/api/auth/session', async (response) => {
    const value = await response.json();
    return Object.hasOwn(value, 'user');
  });
const viteReady = () =>
  check('http://127.0.0.1:5173/', async (response) => {
    const html = await response.text();
    return html.includes('/@vite/client') && html.includes('Fathom Clone');
  });

async function runBuild() {
  await new Promise((done, fail) => {
    const build = spawn('npm', ['run', 'build'], {
      cwd: project,
      stdio: 'inherit',
    });
    build.once('error', fail);
    build.once('exit', (code) =>
      code === 0 ? done() : fail(new Error('The Fathom Clone build failed.')),
    );
  });
}

async function main() {
  process.on('SIGINT', () => stop());
  process.on('SIGTERM', () => stop());
  const existingApi = await apiReady();
  if (!existingApi) {
    await runBuild();
    start(
      process.execPath,
      [
        resolve(project, 'node_modules/wrangler/bin/wrangler.js'),
        'pages',
        'dev',
        'apps/web/dist',
        '--port',
        '8788',
      ],
      'Pages API',
    );
    let ready = false;
    for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
      if (await apiReady()) {
        ready = true;
        break;
      }
      await new Promise((done) => setTimeout(done, 1000));
    }
    if (!ready) throw new Error('Pages API did not become ready on port 8788.');
  } else {
    console.log('Using the Fathom Clone Pages API already running on port 8788.');
  }

  const existingVite = await viteReady();
  if (!existingVite) {
    start(
      process.execPath,
      [resolve(project, 'node_modules/vite/bin/vite.js'), '--host', '0.0.0.0'],
      'Vite',
    );
  } else {
    console.log('Using the Fathom Clone Vite server already running on port 5173.');
  }
  console.log('Fathom Clone is available at http://127.0.0.1:5173/');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  stop(1);
});
