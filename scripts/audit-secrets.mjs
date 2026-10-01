// Reports paths/types only, never matching values. Includes every reachable Git blob.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseEnv } from 'node:util';
const values = existsSync('.dev.vars')
  ? parseEnv(readFileSync('.dev.vars', 'utf8'))
  : {};
const secrets = [];
for (const [name, value] of Object.entries(values)) {
  if (
    /SECRET|TOKEN|SERVICE_ROLE|ACCESS_KEY|DB_URL|POOLER_URL|PASSWORD/.test(
      name,
    ) &&
    value.length > 12
  ) {
    secrets.push(value);
    if (name.includes('URL')) {
      try {
        const p = decodeURIComponent(new URL(value).password);
        if (p.length > 8) secrets.push(p);
      } catch {
        /* Not a connection URL. */
      }
    }
  }
}
const findings = new Set();
function scan(data, label) {
  if (secrets.some((v) => data.includes(Buffer.from(v))))
    findings.add(`${label}: configured credential`);
  const text = data.toString('utf8');
  if (/sb_secret_[A-Za-z0-9_-]{24,}/.test(text))
    findings.add(`${label}: Supabase secret pattern`);
  if (/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(text))
    findings.add(`${label}: private key pattern`);
  if (/postgres(?:ql)?:\/\/[^\s:'"/]+:[^\s@'"<>]{12,}@/.test(text))
    findings.add(`${label}: embedded database credential pattern`);
}
if (existsSync('apps/web/dist')) {
  for (const name of readdirSync('apps/web/dist', { recursive: true })) {
    if (/\.(js|css|html|json)$/.test(String(name)))
      scan(readFileSync(`apps/web/dist/${name}`), `build:${name}`);
  }
}
const files = execFileSync('git', [
  'ls-files',
  '--cached',
  '--others',
  '--exclude-standard',
  '-z',
])
  .toString()
  .split('\0')
  .filter(Boolean);
for (const file of files) if (existsSync(file)) scan(readFileSync(file), file);
scan(execFileSync('git', ['log', '--all', '--format=%B']), 'commit messages');
const objects = execFileSync('git', ['rev-list', '--objects', '--all'], {
  maxBuffer: 20 * 1024 * 1024,
})
  .toString()
  .trim()
  .split('\n');
const metadata = execFileSync(
  'git',
  ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
  {
    input: objects.map((line) => line.split(' ')[0]).join('\n') + '\n',
    maxBuffer: 20 * 1024 * 1024,
  },
)
  .toString()
  .trim()
  .split('\n');
let checked = 0;
for (let i = 0; i < metadata.length; i++) {
  const [hash, type, size] = metadata[i].split(' ');
  if (type === 'blob' && Number(size) < 2 * 1024 * 1024) {
    scan(
      execFileSync('git', ['cat-file', 'blob', hash], {
        maxBuffer: 2 * 1024 * 1024,
      }),
      `history:${objects[i].slice(41)}`,
    );
    checked++;
  }
}
console.log(
  `Inspected ${files.length} current files and ${checked} historical text-sized blobs.`,
);
if (findings.size) {
  for (const finding of findings) console.log(finding);
  process.exitCode = 1;
} else
  console.log(
    'PASS: no configured credential values or high-confidence secret patterns detected.',
  );
