// Exercise the public API using the deliberately public recording only.
// Print statuses and counts, never cookies, signed URLs, or transcript content.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const origin = 'https://fathom-clone.pages.dev';
try {
  const session = await fetch(`${origin}/api/session`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const cookie = session.headers.get('Set-Cookie')?.split(';')[0];
  if (!cookie) throw new Error('session');
  const headers = {
    Cookie: cookie,
    Origin: origin,
    'Content-Type': 'application/json',
  };
  const file = readFileSync(
    'apps/web/public/media/recording-walkthrough-optimized.webm',
  );
  const created = await fetch(`${origin}/api/uploads`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Private API verification',
      filename: 'verification.webm',
      contentType: 'video/webm',
      size: file.length,
      duration: 103.827,
    }),
  });
  console.log('Create HTTP:', created.status);
  if (!created.ok) process.exit(1);
  const meeting = await created.json();
  const signing = await fetch(
    `${origin}/api/uploads/${meeting.id}/upload-url`,
    { method: 'POST', headers, body: '{}' },
  );
  console.log('Signing HTTP:', signing.status);
  if (!signing.ok) process.exit(1);
  const signed = await signing.json();
  const put = await fetch(signed.url, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/webm', Origin: origin },
    body: file,
    signal: AbortSignal.timeout(120000),
  });
  console.log(
    'Direct PUT HTTP:',
    put.status,
    'CORS allowed:',
    put.headers.get('Access-Control-Allow-Origin') === origin,
  );
  if (!put.ok) {
    const code = (await put.text()).match(/<Code>([A-Za-z]+)<\/Code>/)?.[1];
    console.log('Storage error category:', code ?? 'unknown');
    process.exit(1);
  }
  // Save only inside the ignored runtime directory for follow-up verification.
  mkdirSync('.wrangler', { recursive: true });
  writeFileSync(
    '.wrangler/verification-session.json',
    JSON.stringify({ cookie, id: meeting.id }),
    { mode: 0o600 },
  );
  const processing = await fetch(
    `${origin}/api/uploads/${meeting.id}/process`,
    {
      method: 'POST',
      headers,
      body: '{}',
      signal: AbortSignal.timeout(175000),
    },
  );
  console.log('Processing HTTP:', processing.status);
  const result = await processing.json();
  console.log(
    'Result:',
    result.status,
    result.processing_error,
    'segments:',
    result.transcript?.length ?? 0,
    'analysis:',
    !!result.intelligence,
  );
} catch {
  console.error('Verification request failed; sensitive details withheld.');
  process.exitCode = 1;
}
