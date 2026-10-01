// Local-only setup. Never forward provider responses or credentials to stdout.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { AwsClient } from 'aws4fetch';

const values = parseEnv(readFileSync('.dev.vars', 'utf8'));
const mode = process.argv[2];
try {
  if (mode === 'migrate') {
    if (!values.SUPABASE_POOLER_URL && !values.SUPABASE_DB_URL)
      throw new Error('SUPABASE_DB_URL is missing');
    const connection = new URL(
      values.SUPABASE_POOLER_URL || values.SUPABASE_DB_URL,
    );
    const env = {
      ...process.env,
      PGHOST: connection.hostname,
      PGPORT: connection.port || '5432',
      PGUSER: decodeURIComponent(connection.username),
      PGPASSWORD: decodeURIComponent(connection.password),
      PGDATABASE: connection.pathname.slice(1) || 'postgres',
      PGSSLMODE: 'require',
      PGCONNECT_TIMEOUT: '15',
    };
    const check = spawnSync(
      'psql',
      [
        '-X',
        '-tAc',
        "select to_regclass('public.uploaded_meetings') is not null",
      ],
      { env, encoding: 'utf8' },
    );
    if (check.status !== 0)
      throw new Error(
        'Database connection failed; verify the connection string and network access',
      );
    if (check.stdout.trim() === 't') {
      console.log('Migration table already exists; not applying it twice.');
    } else {
      const result = spawnSync(
        'psql',
        [
          '-X',
          '-v',
          'ON_ERROR_STOP=1',
          '-f',
          'supabase/migrations/202609150001_private_ingestion.sql',
        ],
        { env, encoding: 'utf8' },
      );
      if (result.status !== 0)
        throw new Error('Migration failed; provider details withheld');
      console.log('Private ingestion migration applied.');
    }
    const security = spawnSync(
      'psql',
      [
        '-X',
        '-tAc',
        "select relrowsecurity and not has_table_privilege('anon', oid, 'SELECT') and not has_table_privilege('authenticated', oid, 'SELECT') from pg_class where oid='public.uploaded_meetings'::regclass",
      ],
      { env, encoding: 'utf8' },
    );
    if (security.status !== 0 || security.stdout.trim() !== 't')
      throw new Error('Database access isolation check failed');
    console.log('RLS and restricted browser-role access verified.');
  } else if (mode === 'share-migrate') {
    if (!values.SUPABASE_POOLER_URL && !values.SUPABASE_DB_URL)
      throw new Error('SUPABASE_DB_URL is missing');
    const connection = new URL(
      values.SUPABASE_POOLER_URL || values.SUPABASE_DB_URL,
    );
    const env = {
      ...process.env,
      PGHOST: connection.hostname,
      PGPORT: connection.port || '5432',
      PGUSER: decodeURIComponent(connection.username),
      PGPASSWORD: decodeURIComponent(connection.password),
      PGDATABASE: connection.pathname.slice(1) || 'postgres',
      PGSSLMODE: 'require',
      PGCONNECT_TIMEOUT: '15',
    };
    const check = spawnSync(
      'psql',
      [
        '-X',
        '-tAc',
        "select to_regclass('public.uploaded_meeting_shares') is not null",
      ],
      { env, encoding: 'utf8' },
    );
    if (check.status !== 0)
      throw new Error(
        'Database connection failed; verify the connection string and network access',
      );
    if (check.stdout.trim() === 't') {
      console.log('Meeting-share migration already exists.');
    } else {
      const result = spawnSync(
        'psql',
        [
          '-X',
          '-v',
          'ON_ERROR_STOP=1',
          '-f',
          'supabase/migrations/202609210001_meeting_shares.sql',
        ],
        { env, encoding: 'utf8' },
      );
      if (result.status !== 0)
        throw new Error('Migration failed; provider details withheld');
      console.log('Meeting-share migration applied.');
    }
    const security = spawnSync(
      'psql',
      [
        '-X',
        '-tAc',
        "select relrowsecurity and not has_table_privilege('anon', oid, 'SELECT') and not has_table_privilege('authenticated', oid, 'SELECT') from pg_class where oid='public.uploaded_meeting_shares'::regclass",
      ],
      { env, encoding: 'utf8' },
    );
    if (security.status !== 0 || security.stdout.trim() !== 't')
      throw new Error('Database access isolation check failed');
    console.log('Meeting-share RLS and browser-role isolation verified.');
  } else if (mode === 'speaker-migrate') {
    if (!values.SUPABASE_POOLER_URL && !values.SUPABASE_DB_URL)
      throw new Error('SUPABASE_DB_URL is missing');
    const connection = new URL(
      values.SUPABASE_POOLER_URL || values.SUPABASE_DB_URL,
    );
    const env = {
      ...process.env,
      PGHOST: connection.hostname,
      PGPORT: connection.port || '5432',
      PGUSER: decodeURIComponent(connection.username),
      PGPASSWORD: decodeURIComponent(connection.password),
      PGDATABASE: connection.pathname.slice(1) || 'postgres',
      PGSSLMODE: 'require',
      PGCONNECT_TIMEOUT: '15',
    };
    const exists = spawnSync(
      'psql',
      [
        '-X',
        '-tAc',
        "select count(*) from information_schema.columns where table_schema='public' and table_name='uploaded_meetings' and column_name='speaker_names'",
      ],
      { env, encoding: 'utf8' },
    );
    if (exists.status !== 0) throw new Error('Database connection failed');
    if (exists.stdout.trim() === '0') {
      const result = spawnSync(
        'psql',
        [
          '-X',
          '-v',
          'ON_ERROR_STOP=1',
          '-f',
          'supabase/migrations/202609210002_speaker_names.sql',
        ],
        { env, encoding: 'utf8' },
      );
      if (result.status !== 0) throw new Error('Migration failed');
      console.log('Speaker-label migration applied.');
    } else console.log('Speaker-label migration already exists.');
    const security = spawnSync(
      'psql',
      [
        '-X',
        '-tAc',
        "select relrowsecurity and not has_table_privilege('anon', oid, 'SELECT') and not has_table_privilege('authenticated', oid, 'SELECT') from pg_class where oid='public.uploaded_meetings'::regclass",
      ],
      { env, encoding: 'utf8' },
    );
    if (security.status !== 0 || security.stdout.trim() !== 't')
      throw new Error('Database access isolation check failed');
    console.log(
      'Private speaker-label storage and browser-role isolation verified.',
    );
  } else if (mode === 'storage') {
    const s3 = new AwsClient({
      accessKeyId: values.R2_ACCESS_KEY_ID,
      secretAccessKey: values.R2_SECRET_ACCESS_KEY,
      service: 's3',
      region: 'auto',
    });
    const endpoint = `https://${values.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${values.R2_BUCKET_NAME}`;
    const head = await s3.fetch(endpoint, { method: 'HEAD' });
    if (!head.ok)
      throw new Error(`Storage access check failed (${head.status})`);
    console.log('Private bucket access verified.');
    const body =
      '<CORSConfiguration><CORSRule><AllowedOrigin>https://fathom-clone.pages.dev</AllowedOrigin><AllowedOrigin>http://localhost:8788</AllowedOrigin><AllowedOrigin>http://127.0.0.1:8788</AllowedOrigin><AllowedOrigin>http://127.0.0.1:5173</AllowedOrigin><AllowedOrigin>http://localhost:5173</AllowedOrigin><AllowedMethod>PUT</AllowedMethod><AllowedHeader>Content-Type</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>';
    const cors = await s3.fetch(`${endpoint}?cors`, {
      method: 'PUT',
      body,
      headers: { 'Content-Type': 'application/xml' },
    });
    if (!cors.ok) {
      mkdirSync('.wrangler', { recursive: true });
      writeFileSync(
        '.wrangler/upload-cors.json',
        JSON.stringify({
          rules: [
            {
              allowed: {
                origins: [
                  'https://fathom-clone.pages.dev',
                  'http://localhost:8788',
                  'http://127.0.0.1:8788',
                  'http://localhost:5173',
                  'http://127.0.0.1:5173',
                ],
                methods: ['PUT'],
                headers: ['Content-Type'],
              },
              exposeHeaders: ['ETag'],
              maxAgeSeconds: 3600,
            },
          ],
        }),
      );
      const configured = spawnSync(
        'npx',
        [
          'wrangler',
          'r2',
          'bucket',
          'cors',
          'set',
          values.R2_BUCKET_NAME,
          '--file',
          '.wrangler/upload-cors.json',
          '--force',
        ],
        { encoding: 'utf8' },
      );
      if (configured.status !== 0)
        throw new Error(
          'Bucket CORS configuration failed using Cloudflare login',
        );
    }
    console.log('Direct-upload browser CORS configured.');
  } else if (mode === 'secrets') {
    const names = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'R2_ACCOUNT_ID',
      'R2_BUCKET_NAME',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
    ];
    if (names.some((name) => !values[name]))
      throw new Error('Required deployment value is missing');
    const result = spawnSync(
      'npx',
      ['wrangler', 'pages', 'secret', 'bulk', '--project-name', 'fathom-clone'],
      {
        input: JSON.stringify(
          Object.fromEntries(names.map((name) => [name, values[name]])),
        ),
        encoding: 'utf8',
      },
    );
    if (result.status !== 0)
      throw new Error(
        'Pages secret configuration failed; provider details withheld',
      );
    console.log(
      'Six runtime secrets configured; database administration credentials remain local.',
    );
  } else
    throw new Error(
      'Choose migrate, share-migrate, speaker-migrate, storage, or secrets',
    );
} catch (error) {
  // Only our deliberately non-sensitive messages may be logged.
  const message = error instanceof Error ? error.message : '';
  const safe =
    /^(SUPABASE_DB_URL is missing|Database connection failed|Migration failed|Database access isolation check failed|Storage access check failed|Bucket CORS configuration failed|Required deployment value is missing|Pages secret configuration failed|Choose migrate)/.test(
      message,
    );
  console.error(
    safe
      ? message
      : 'Setup request failed; details withheld to protect credentials.',
  );
  process.exitCode = 1;
}
