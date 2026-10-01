# Fathom Clone

A Fathom-style meeting notetaker. Upload a recording and get a timestamped
transcript, three AI summary views (General, Sales / Customer, Recruiting /
Interview), action items linked to the moment they were said, saved moments,
and search across every meeting. Meetings and individual moments can be shared
with revocable public links.

## Features

- Email/password accounts with email confirmation, password reset, password
  change, and account deletion (removes every recording and row).
- Direct browser uploads to private R2 storage (MP4, MOV, WebM, MP3, WAV, M4A;
  up to 25 MB and 10 minutes).
- Background processing in a Cloudflare Workflow: Whisper transcription
  (recordings over two minutes are transcribed in two-minute chunks) and Llama
  analysis. Processing continues if the tab is closed and each step retries on
  its own.
- Player with transcript sync, follow-scroll, in-transcript search, playback
  speed, speaker renaming, and transcript copy/download.
- Saved moments (up to 60 s), private until shared; each moment or the full
  meeting can get a public link that its owner can revoke.
- Search across titles, summaries, speakers, and transcripts.
- Light and dark themes.

## Stack

| Part | Technology |
| --- | --- |
| Web app | React 19, React Router, Vite, Tailwind |
| API + hosting | One Cloudflare Worker serving the built app as static assets |
| Processing | Cloudflare Workflows + Workers AI (`whisper-large-v3-turbo`, `llama-3.1-8b-instruct-fp8`) |
| Storage | Cloudflare R2 (S3 API, presigned uploads) |
| Database + auth | Supabase Postgres and Supabase Auth |

See [docs/architecture.md](docs/architecture.md) for the data model, security
model, and processing pipeline.

## Local development

Requires Node 22.12+.

```sh
npm ci
cp .env.example .env            # Cloudflare account ID + API token
cp .dev.vars.example .dev.vars  # Supabase + R2 values
npm run dev                     # Worker API on :8788 + Vite on :5173
```

Open http://127.0.0.1:5173. `npm run dev:web` starts only Vite (the API is not
available), which is what the Playwright tests use with mocked responses.

Workers AI always runs on Cloudflare, even locally, so `npm run dev` needs a
valid `CLOUDFLARE_API_TOKEN` in `.env`.

### Checks

```sh
npm run lint
npm run typecheck
npm test                 # unit tests (Vitest)
npm run build
npx playwright install chromium
npm run test:e2e         # browser tests (Playwright)
npm run audit:secrets    # scans the repo and build for leaked credentials
```

## Environment

`.env` (Wrangler and setup scripts only):

- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`: the token needs Workers AI
  Edit, Workers R2 Storage Edit, Workers Scripts Edit, Account Settings Read,
  and User Memberships / User Details Read.

`.dev.vars` (Worker runtime; the same values are pushed as Worker secrets):

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
  (an R2 API token limited to Object Read & Write on the bucket)

Nothing secret is bundled into the browser; the browser only talks to the
Worker and to R2 through short-lived presigned upload URLs.

## Deploying

One-time setup:

1. **Database:** apply `supabase/migrations/*.sql` in order (Supabase SQL
   editor, Supabase CLI, or the Supabase MCP).
2. **Supabase Auth** (dashboard → Authentication → URL Configuration): set the
   Site URL to the app origin and add `<origin>/auth/confirm` and
   `<origin>/auth/reset` to the redirect allow list. For real traffic,
   configure custom SMTP (Authentication → Emails); Supabase's built-in sender
   is limited to a few emails per hour.
3. **Storage:** create the bucket, then
   `node scripts/setup.mjs storage https://<your-app-origin>` to set upload
   CORS and the rule that expires abandoned uploads.
4. **Secrets:** `npx wrangler deploy` once to create the Worker, then
   `node scripts/setup.mjs secrets`.

Each release: `npm run deploy`.

## Limits

- Uploads: 25 MB, 10 minutes, 25 per user per day, 5 processing at once.
- Moments: 60 seconds each, 200 per meeting.
- Rate limits: 10 auth attempts per minute per address and route; 120 changes
  per minute per account.
- Transcripts have a single speaker label; speaker separation is not inferred.
