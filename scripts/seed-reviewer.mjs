// Idempotent administrative seed. No credentials or provider bodies are logged.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const values = parseEnv(readFileSync('.dev.vars', 'utf8'));
try {
  const url = new URL(values.SUPABASE_POOLER_URL || values.SUPABASE_DB_URL);
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1) || 'postgres',
    PGSSLMODE: 'require',
    PGCONNECT_TIMEOUT: '15',
  };
  const result = spawnSync(
    'psql',
    [
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      'supabase/migrations/202609230001_persist_reviewer_content.sql',
    ],
    { env, encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error('Migration could not be applied');
  const rows = JSON.parse(
    readFileSync('supabase/seeds/reviewer-meetings.json', 'utf8'),
  );
  const request = async (path, method, body) => {
    const r = await fetch(`${values.SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: values.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${values.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('Seed write failed');
  };
  await request('reviewer_meetings?on_conflict=id', 'POST', rows);
  for (const row of rows.filter((r) => r.recording)) {
    // Preserve existing tokens on reruns; tokens are never frontend constants.
    const r = await fetch(
      `${values.SUPABASE_URL}/rest/v1/reviewer_meeting_shares?meeting_id=eq.${row.id}`,
      {
        headers: {
          apikey: values.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${values.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    if (!r.ok) throw new Error('Seed lookup failed');
    if (!(await r.json()).length)
      await request('reviewer_meeting_shares', 'POST', { meeting_id: row.id });
    for (const moment of row.recording.moments) {
      const response = await fetch(
        `${values.SUPABASE_URL}/rest/v1/meeting_moments?id=eq.${moment.id}`,
        {
          headers: {
            apikey: values.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${values.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        },
      );
      if (!response.ok) throw new Error('Moment lookup failed');
      if (!(await response.json()).length)
        await request('meeting_moments', 'POST', {
          id: moment.id,
          meeting_key: row.id,
          owner_hash: null,
          data: moment,
          share_token: randomBytes(32).toString('hex'),
        });
    }
  }
  const security = spawnSync(
    'psql',
    [
      '-X',
      '-tAc',
      "select bool_and(relrowsecurity and not has_table_privilege('anon',oid,'SELECT') and not has_table_privilege('authenticated',oid,'SELECT')) from pg_class where relname in ('reviewer_meetings','reviewer_meeting_shares','meeting_moments','reviewer_speaker_names')",
    ],
    { env, encoding: 'utf8' },
  );
  if (security.status !== 0 || security.stdout.trim() !== 't')
    throw new Error('Isolation verification failed');
  console.log(
    `Seeded ${rows.length} reviewer meetings; database isolation verified. Existing share tokens preserved.`,
  );
} catch {
  console.error(
    'Reviewer seed failed; provider details withheld. Check local database and service-role configuration.',
  );
  process.exitCode = 1;
}
