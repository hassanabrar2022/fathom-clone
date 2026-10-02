// Fills the database with the demo library so the deployed app is not an empty
// meetings list. Reads .dev.vars and .env the same way scripts/setup.mjs does,
// and never prints a secret value.
//
//   node scripts/seed.mjs                 create the demo account and 8 meetings
//   node scripts/seed.mjs --no-media      skip the placeholder audio upload
//   node scripts/seed.mjs --clear         remove the demo account's meetings
//
// Re-running is safe: meeting ids and share tokens are derived from the account
// id and the meeting key, so a second run replaces the same rows and every
// share link keeps working.
//
// The audio is silence of the recording's real length, so the player, the
// transcript following playback, and the timestamp links all behave. The words
// are in the transcript, not in the audio. scripts/seed-data.mjs is the library.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';

import { AwsClient } from 'aws4fetch';

import { buildSeedMeetings, demoAccount } from './seed-data.mjs';

/**
 * Stable ids from stable inputs, so a second run replaces the same rows instead
 * of growing the library, and shared links stay valid across re-seeds.
 */
export function derivedUuid(...parts) {
  const bytes = createHash('sha256').update(parts.join(':')).digest();
  // Shape it as a v4 UUID so Postgres accepts it in a uuid column.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/** Share tokens the schema accepts: exactly 64 lowercase hex characters. */
export function derivedToken(...parts) {
  return createHash('sha256')
    .update(`token:${parts.join(':')}`)
    .digest('hex');
}

/**
 * A WAV of silence at the recording's real length. 8 kHz 8-bit mono is the
 * smallest shape every browser still plays, which keeps an hour under 30 MB.
 */
export function silentWav(durationSeconds) {
  const rate = 8000;
  const samples = Math.max(1, Math.round(durationSeconds * rate));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + samples, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate, 28); // byte rate
  header.writeUInt16LE(1, 32); // block align
  header.writeUInt16LE(8, 34); // bits per sample
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(samples, 40);
  // Unsigned 8-bit PCM silence sits at the midpoint, not at zero.
  return Buffer.concat([header, Buffer.alloc(samples, 0x80)]);
}

/** The rows for one seeded meeting, ready to POST. */
export function meetingRows(meeting, userId, mediaSize) {
  const id = derivedUuid(userId, meeting.key);
  return {
    id,
    meeting: {
      id,
      user_id: userId,
      title: meeting.title,
      original_filename: meeting.filename,
      media_type: meeting.mediaType,
      storage_key: `uploads/${id}`,
      // The row has to describe real bytes. Without media it claims the single
      // byte the column's check constraint demands, and playback stays absent.
      media_size: mediaSize ?? 1,
      duration_seconds: meeting.durationSeconds,
      status: 'complete',
      processing_progress: 100,
      // Nullable but not optional in the schema the Worker parses rows with.
      processing_error: null,
      source: meeting.source,
      transcript: meeting.segments,
      intelligence: meeting.intelligence,
      speaker_names: meeting.speakerNames,
      media_uploaded_at: mediaSize ? meeting.createdAt : null,
      created_at: meeting.createdAt,
      updated_at: meeting.createdAt,
    },
    moments: meeting.moments.map((moment, index) => ({
      id: derivedUuid(userId, meeting.key, `moment-${index}`),
      meeting_id: id,
      user_id: userId,
      start_ms: moment.startMs,
      end_ms: moment.endMs,
      title: moment.title,
      note: moment.note,
      // The first moment of each meeting is shared, so there is always a clip a
      // signed-out visitor can open.
      share_token:
        index === 0 ? derivedToken(userId, meeting.key, 'moment') : null,
      created_at: moment.createdAt ?? meeting.createdAt,
    })),
    share: meeting.share
      ? {
          meeting_id: id,
          token: derivedToken(userId, meeting.key, 'meeting'),
          enabled: true,
          created_at: meeting.createdAt,
        }
      : null,
  };
}

/** True when .dev.vars carries a full set of R2 S3 credentials. */
function hasS3Credentials(values) {
  return [
    'R2_ACCOUNT_ID',
    'R2_BUCKET_NAME',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
  ].every((name) => values[name]);
}

export function readCredentials(withMedia) {
  if (!existsSync('.dev.vars')) {
    throw new Error(
      'No .dev.vars found. Copy .dev.vars.example and fill in the Supabase values first.',
    );
  }
  const values = {
    ...(existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {}),
    ...parseEnv(readFileSync('.dev.vars', 'utf8')),
  };
  // Only Supabase genuinely has to be pasted in: its URL and service role key
  // cannot be read back out of Cloudflare, because Worker secrets are
  // write-only. The bucket can be reached either way -- see uploaderFor.
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter(
    (name) => !values[name] || values[name].includes('<'),
  );
  if (missing.length) {
    throw new Error(
      `Missing or still a placeholder in .dev.vars: ${missing.join(', ')}`,
    );
  }
  if (withMedia && !hasS3Credentials(values) && !values.R2_BUCKET_NAME) {
    throw new Error(
      'Media upload needs R2_BUCKET_NAME in .dev.vars (or pass --no-media).',
    );
  }
  return values;
}

/**
 * Two ways into the bucket. R2 S3 credentials when .dev.vars has them, and
 * otherwise the wrangler CLI, which uses the OAuth session from `wrangler login`
 * and so needs no keys pasted anywhere.
 */
function uploaderFor(values) {
  if (hasS3Credentials(values)) {
    const client = new AwsClient({
      accessKeyId: values.R2_ACCESS_KEY_ID,
      secretAccessKey: values.R2_SECRET_ACCESS_KEY,
      service: 's3',
      region: 'auto',
    });
    return {
      how: 'R2 S3 credentials',
      async put(key, body) {
        const url =
          `https://${values.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/` +
          `${values.R2_BUCKET_NAME}/${key}`;
        const response = await client.fetch(url, {
          method: 'PUT',
          body,
          headers: {
            'Content-Type': 'audio/wav',
            'Content-Length': String(body.length),
          },
        });
        if (!response.ok) {
          throw new Error(`R2 upload failed (${response.status}) for ${key}`);
        }
      },
      done() {},
    };
  }
  const scratch = mkdtempSync(join(tmpdir(), 'fathom-seed-'));
  return {
    how: 'the wrangler CLI (no R2 keys needed)',
    async put(key, body) {
      // wrangler takes a file rather than stdin, so the bytes sit on disk for
      // exactly as long as the upload takes.
      const file = join(scratch, 'media.wav');
      writeFileSync(file, body);
      try {
        const result = spawnSync(
          'npx',
          [
            'wrangler',
            'r2',
            'object',
            'put',
            `${values.R2_BUCKET_NAME}/${key}`,
            '--file',
            file,
            '--content-type',
            'audio/wav',
            '--remote',
          ],
          { encoding: 'utf8', env: process.env },
        );
        if (result.status !== 0) {
          const reason = (result.stderr || result.stdout || '')
            .trim()
            .split('\n')
            .filter(Boolean)
            .pop();
          throw new Error(`wrangler upload failed for ${key}: ${reason}`);
        }
      } finally {
        rmSync(file, { force: true });
      }
    },
    done() {
      rmSync(scratch, { recursive: true, force: true });
    },
  };
}

function supabaseClient(values) {
  const origin = values.SUPABASE_URL.replace(/\/$/, '');
  return async (path, { method = 'GET', body, prefer } = {}) => {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        apikey: values.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${values.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) {
      // Supabase errors can echo the request; keep the message, drop the rest.
      let problem;
      try {
        problem = JSON.parse(text);
      } catch {
        problem = null;
      }
      throw new Error(
        `${method} ${path.split('?')[0]} failed (${response.status}): ` +
          (problem?.message ?? problem?.msg ?? text.slice(0, 200)),
      );
    }
    return text ? JSON.parse(text) : null;
  };
}

/** Finds the demo account, creating it already confirmed if it is not there. */
async function demoUser(supabase) {
  const found = await supabase(
    `/auth/v1/admin/users?per_page=200&filter=${encodeURIComponent(demoAccount.email)}`,
  );
  const existing = (found?.users ?? []).find(
    (candidate) =>
      candidate.email?.toLowerCase() === demoAccount.email.toLowerCase(),
  );
  if (existing) {
    // Reset the password so the credentials in the README are always the ones
    // that work, even if the account has been changed by hand since.
    await supabase(`/auth/v1/admin/users/${existing.id}`, {
      method: 'PUT',
      body: { password: demoAccount.password, email_confirm: true },
    });
    return { id: existing.id, created: false };
  }
  const created = await supabase('/auth/v1/admin/users', {
    method: 'POST',
    body: {
      email: demoAccount.email,
      password: demoAccount.password,
      email_confirm: true,
    },
  });
  return { id: created.id, created: true };
}

async function main() {
  const flags = new Set(process.argv.slice(2));
  const clearOnly = flags.has('--clear');
  const withMedia = !flags.has('--no-media') && !clearOnly;
  const values = readCredentials(withMedia);
  const supabase = supabaseClient(values);
  const uploader = withMedia ? uploaderFor(values) : null;
  if (uploader) console.log(`Uploading recordings with ${uploader.how}.`);

  const user = await demoUser(supabase);
  console.log(
    `Demo account ${demoAccount.email} ${user.created ? 'created' : 'already existed'}.`,
  );

  // Clear first so a re-run replaces the library rather than appending to it.
  // Moments and shares go with it through the cascade on meetings.
  await supabase(`/rest/v1/meetings?user_id=eq.${user.id}`, {
    method: 'DELETE',
  });
  if (clearOnly) {
    console.log("Cleared the demo account's meetings. Nothing seeded.");
    return;
  }

  const library = buildSeedMeetings();
  const links = [];
  let uploadedBytes = 0;

  for (const meeting of library) {
    const media = withMedia ? silentWav(meeting.durationSeconds) : null;
    const rows = meetingRows(meeting, user.id, media?.length);
    if (media) {
      await uploader.put(`${rows.meeting.storage_key}/media`, media);
      uploadedBytes += media.length;
    }

    await supabase('/rest/v1/meetings', {
      method: 'POST',
      prefer: 'return=minimal',
      body: rows.meeting,
    });
    if (rows.moments.length) {
      await supabase('/rest/v1/meeting_moments', {
        method: 'POST',
        prefer: 'return=minimal',
        body: rows.moments,
      });
      links.push(
        `  /share/moment-${rows.moments[0].share_token}  ${rows.moments[0].title}`,
      );
    }
    if (rows.share) {
      await supabase('/rest/v1/meeting_shares', {
        method: 'POST',
        prefer: 'return=minimal',
        body: rows.share,
      });
      links.push(`  /share/${rows.share.token}  ${meeting.title}`);
    }

    console.log(
      `  ${meeting.title} — ${Math.round(meeting.durationSeconds / 60)} min, ` +
        `${Object.keys(meeting.speakerNames).length} speakers, ` +
        `${meeting.segments.length} segments, ` +
        `${meeting.intelligence.actions.length} actions`,
    );
  }

  console.log(`\nSeeded ${library.length} meetings for ${demoAccount.email}.`);
  console.log(
    withMedia
      ? `Uploaded ${(uploadedBytes / 1_048_576).toFixed(1)} MB of placeholder audio to R2.`
      : 'No media uploaded (--no-media), so playback is unavailable.',
  );
  uploader?.done?.();
  console.log('\nPublic links (append to the app origin):');
  console.log(links.join('\n'));
}

// Importable for tests; only seeds when run as a script.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
