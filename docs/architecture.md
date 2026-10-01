# Architecture

```text
Browser ──► Cloudflare Worker ──► Supabase Auth      (sign-in, sessions)
   │          │  (static app +  ──► Supabase Postgres (service role, server only)
   │          │   /api/*)       ──► R2 (S3 API)       (recordings)
   │          └─► Workflow ─────► Workers AI          (Whisper, Llama)
   └──────────── presigned PUT ─► R2 staging/
```

## Request flow

- `apps/worker/src/index.ts` serves the built React app from Workers static
  assets and routes `/api/*` through the Worker. Every API response gets
  security headers; static responses get the CSP generated at build time
  (`vite.config.ts` hashes the inline theme script).
- `/api/auth/*` (`auth.ts`) proxies Supabase Auth. Access and refresh tokens
  live only in `__Host-` `HttpOnly; Secure; SameSite=Lax` cookies. Writes must
  come from the app's own origin.
- Every other API request first resolves the session (`prepareAccountRequest`).
  Access tokens are verified locally against the project's ES256 signing keys
  (`jwt.ts`, JWKS cached 10 minutes); other tokens fall back to Supabase's
  `/auth/v1/user`. Expired access tokens are refreshed transparently. The
  verified user id is passed internally in `X-Fathom-Clone-Verified-User`,
  which is stripped from incoming requests.
- `ingestion.ts` handles uploads, playback, deletion, speaker names, and meeting
  share links; `library.ts` handles moments, moment links, and search.
- `security.ts` applies Workers rate limiting: auth attempts per address and
  route, changes per account, and public link lookups per address.

## Data model

All tables have RLS enabled with no policies and no `anon`/`authenticated`
grants: only the Worker's service role can reach them, and every query is
filtered by the signed-in `user_id`.

| Table | Purpose |
| --- | --- |
| `meetings` | One upload: media metadata, status/progress, processing lease and attempts, transcript and AI notes (jsonb), speaker names. `user_id → auth.users on delete cascade`. |
| `meeting_shares` | One revocable public token per meeting. |
| `meeting_moments` | Saved ranges with an optional public token. Cascades with its meeting and user. |

`reserve_upload()` creates a meeting row while enforcing the per-user daily and
in-progress limits under an advisory lock. `expire_stalled_meetings()` runs
every 15 minutes (pg_cron) and marks processing that stopped writing for 45
minutes, or uploads that never arrived within a day, as failed so the owner can
retry.

Deleting an account removes every R2 object first, then the Supabase user;
the database cascades remove all rows.

## Upload and processing

1. `POST /api/uploads` reserves a row (validated type, size, duration).
2. The browser uploads to `staging/<id>/media` with a 5-minute presigned PUT.
   Recordings over two minutes also get a browser-made 16 kHz mono WAV at
   `staging/<id>/audio`. Anything left in `staging/` expires after a day.
3. `POST /api/uploads/:id/process` claims the meeting (new lease, attempt + 1,
   guarded by the previous attempt count) and starts a
   `ProcessMeetingWorkflow` instance, then returns immediately. The page polls
   `GET /api/uploads/:id` for progress.
4. The workflow (`workflow.ts` → `processing.ts`) runs these steps, each retried
   on its own:
   - **store upload:** verify size/type and copy staging into
     `uploads/<id>/media`, so a still-valid upload URL can't change the media;
   - **transcribe:** whole file, or one step per two-minute WAV chunk, saving
     the transcript after each chunk;
   - **analyze:** Llama returns JSON for three summary views and action items,
     validated with zod (every cited timestamp must fall inside the recording);
   - **finish** or **record failure** (`upload_failed`, `transcription_failed`,
     `analysis_failed`).

   Every write is filtered by the run's lease, so a superseded run can't
   overwrite a newer one. A failed meeting can be retried and resumes from the
   last saved step (up to 6 attempts).

## Sharing

`/share/meeting-<token>` and `/share/moment-<token>` are public pages. Their
APIs (`/api/shares/:token`, `/api/moments/:token`) return only that meeting's
title, transcript, and AI notes, and stream its media through the Worker with
byte ranges. Revoking a link disables the token immediately.
