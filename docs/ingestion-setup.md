# Private ingestion setup

Reviewers need no credentials. The server requires Supabase for the seeded library
and private persistence. Private ingestion also requires R2 and Workers AI.

## Configure services

Place the variable names from `.env.example` in ignored `.dev.vars`, with values
supplied locally. Never use browser `VITE_` variables for these credentials.
The R2 S3 token needs **Object Read & Write** access to the configured bucket.
`SUPABASE_DB_URL` is used only for migration administration and is never deployed.
If that direct connection is IPv6-only, provide `SUPABASE_POOLER_URL` for the
IPv4 session pooler. Neither database URL is sent to Pages.

With Node 24, `psql`, and an authorized Wrangler login:

```sh
node scripts/ingestion-admin.mjs migrate
node scripts/ingestion-admin.mjs share-migrate
node scripts/ingestion-admin.mjs speaker-migrate
npm run seed:reviewer
node scripts/ingestion-admin.mjs storage
node scripts/ingestion-admin.mjs secrets
npm run deploy
```

The migration script applies `202609150001_private_ingestion.sql` once, then checks
RLS and restricted browser-role access. Database credentials travel in the child
process environment, and provider output is withheld. Storage setup configures
PUT CORS for the canonical deployment and local development; changing the domain
requires updating that allowlist. Six runtime secrets are sent to Pages via stdin.

For a local full-stack preview run `npm run dev:api` on port 8788. In another
terminal, `npm run dev` serves the UI and proxies `/api` to that Worker. There is
no frontend fixture fallback if the API is unavailable. Workers AI calls use the
remote service.

## Behavior and bounds

- Direct signed R2 PUTs expire after five minutes. The server checks stored size and
  type, then copies the upload into a separate playback object so a reused PUT URL
  cannot overwrite processed media. Media reads require the owner's session.
- An HttpOnly, Secure, SameSite cookie identifies the guest browser for seven days.
  Supabase stores only its SHA-256 digest. Losing cookies loses access; uploads are
  not public fixtures. The API scopes every row read/write to that digest.
- Limits: 25 MB, ten minutes, three uploads per browser per rolling day, twenty
  across the workspace per rolling day, and one hundred rows total. The SQL
  reservation is atomic. Free provider allowances still apply.
- Recordings over two minutes get a private, browser-prepared audio copy in R2.
  The Worker transcribes bounded PCM ranges and saves each range's timestamped
  transcript before continuing; the original media remains available for playback.
- Processing uses an atomic three-minute lease and at most six processing
  attempts per recording. Keep the tab open; this is a bounded request flow,
  without a background job queue. Interrupted requests offer check/resume.
- Whisper creates actual timestamped segments. Speaker identities are not inferred.
  The transcript is stored before Llama generates three summary perspectives and
  sourced actions. An analysis retry reuses the saved transcript. Unsupported
  sections and missing commitments remain empty. Invalid output is rejected.
- Private recordings reuse playback, transcript seeking, Follow Playback, summaries,
  and database-persisted private moments. A completed meeting can publish a separate, revocable full
  meeting link; private moments still do not generate public clip links.
- There is no automatic retention cleanup or account-based recovery in this demo.
  Storage cleanup is an administrator operation; the total-row cap bounds growth.

## Verification

`npm run test:e2e` includes controlled upload-failure, retry, and empty-state tests.
Real provider tests are opt-in to avoid consuming upload/model quotas on every run:

```sh
FATHOM_CLONE_VERIFY_URL=https://fathom-clone.pages.dev FATHOM_CLONE_INGESTION_LIVE=1 \
  npm run test:e2e -- tests/ingestion.spec.ts --project=chromium
```

That test uses the already public sanitized recording and disables traces/video
so guest cookies and signed upload URLs stay out of test artifacts. Test only the
configured canonical origin; preview origins are not on the R2 CORS allowlist.

Provider references: [R2 signed URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/),
[browser CORS](https://developers.cloudflare.com/r2/buckets/cors/),
[Whisper](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/).
