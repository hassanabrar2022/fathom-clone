# Fathom Clone

A Fathom-style meeting notetaker. Connect Google Calendar or paste a meeting
link, and a notetaker joins the Google Meet, Zoom, or Teams call, records it,
and produces a speaker-labelled transcript, three AI summary views (General,
Sales / Customer, Recruiting / Interview), and action items linked to the
moment they were said. Highlight moments mid-call, search across every
meeting, and share meetings or clips with revocable public links. Recordings
can also be uploaded.

## Try it

Sign in to the deployed app with the seeded demo account:

```
demo@fathomclone.app
fathom-clone-demo-2026
```

It has eight finished meetings, including a 62 minute call with eight speakers,
each with a speaker-labelled transcript, all three summary templates, action
items linked to the second they were said, saved moments, and public share
links. The recordings behind them are placeholder audio of the correct length,
so playback, transcript-follow, and timestamp jumps all work, but there is no
speech to hear. Everything else is real data.

## Features

- Email/password accounts with email confirmation, password reset, password
  change, and account deletion (removes every recording and row).
- **Notetaker bot** (Recall.ai): paste a Meet/Zoom/Teams link or switch it on
  per calendar event. It joins as a guest, records video, and Recall's
  per-participant transcription names every speaker. A live view follows it
  from scheduled → joining → waiting room → recording → processing.
- **Record from this browser** (no bot, no extra service): captures the
  meeting tab's audio plus your microphone, uploads two-minute parts during
  the call, and transcribes them with Whisper. Used automatically when no
  Recall.ai key is configured; this is the stubbed capture layer the brief
  allows.
- **Google Calendar**: read-only OAuth connection, upcoming meetings with
  their video links, a notetaker switch per event, and auto-record (a cron
  sweep every 5 minutes sends the bot to calls starting soon).
- **Mid-call highlights**: one click (with an optional note) during the
  call; each becomes a saved, shareable clip of the half minute before it.
- **Long, many-person calls**: up to four hours; transcripts keep every
  speaker; analysis condenses long transcripts window by window so an hour
  with eight people stays inside the model's context.
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
| Meeting bot (optional) | Recall.ai bots + `recallai_streaming` transcription |
| Calendar (optional) | Google Calendar API (OAuth, `calendar.events.readonly`) |

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
npm test                 # unit tests (Vitest), including the seed library
npm run build
npx playwright install chromium firefox
npm run test:e2e         # browser tests (Chromium, Firefox, mobile)
# CI runs the Chromium and mobile projects only; Firefox needs 168 MB of system
# codecs on a Linux runner and had never caught anything Chromium did not.
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
- Optional, notetaker bot: `RECALL_API_KEY`, `RECALL_REGION` (e.g.
  `us-west-2`). Without them the app offers browser recording only.
- Optional, Google Calendar: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `TOKEN_ENCRYPTION_KEY` (32 random bytes, base64; encrypts stored tokens).

### Setting up Google Calendar

1. Google Cloud console → create a project → **APIs & Services → Library** →
   enable **Google Calendar API**.
2. **OAuth consent screen**: External, add your email as a test user, add the
   scopes `openid`, `email`, and `.../auth/calendar.events.readonly`.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
   Authorized redirect URIs: `http://127.0.0.1:5173/api/calendar/callback`
   (local) and `https://<your-app>/api/calendar/callback` (deployed).
4. Put the client ID and secret in `.dev.vars`, generate
   `TOKEN_ENCRYPTION_KEY` (command in `.dev.vars.example`), then
   `node scripts/setup.mjs secrets` for the deployed Worker.

While the consent screen is in "Testing", only listed test users can connect.

### Setting up the notetaker bot

Create a Recall.ai workspace, copy an API key and its region into
`.dev.vars`. No webhook is needed: a durable Workflow polls each bot, so it
works locally and deployed alike. Google Meet bots join as guests, so someone
in the call must admit "Fathom Clone Notetaker".

Nothing secret is bundled into the browser; the browser only talks to the
Worker and to R2 through short-lived presigned upload URLs.

## Deploying

One-time setup:

1. **Database:** apply `supabase/migrations/*.sql` in order (Supabase SQL
   editor, Supabase CLI, or the Supabase MCP). Requires the `pg_cron`
   extension (enabled by the second migration).
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

5. **Demo data:** `npm run seed` creates the demo account and its eight
   meetings. It needs only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in
   `.dev.vars`; with `R2_BUCKET_NAME` set but no R2 access keys it uploads the
   recordings through the wrangler CLI, so a `wrangler login` session is enough
   and no bucket keys need to be stored. Re-running replaces the library and
   keeps every share link, because ids and tokens are derived from the account
   id and the meeting key. Pass `--no-media` to skip the audio upload (about
   170 MB of silence across the library) and `--clear` to remove the seeded
   meetings again.

Each release: `npm run deploy`.

## Limits

- Uploads: 25 MB, 10 minutes, 25 per user per day, 5 processing at once.
  Recorded calls (bot or browser): up to 4 hours.
- Notetakers: 20 scheduled or live at once per user; 100 highlights per call.
- Moments: 60 seconds each, 200 per meeting.
- Rate limits: 10 auth attempts per minute per address and route; 120 changes
  per minute per account.
- Bot recordings name each participant. Uploads and browser recordings have
  a single speaker label (rename it on the meeting page); speaker separation
  is not inferred from audio.
- Browser recording needs desktop Chrome or Edge, the meeting open in a tab
  of the same browser, and this app's tab left open until the call ends.
- Calendar changes after a bot is scheduled (moved or cancelled events) are
  not followed; switch the notetaker off and on again.
- Seeded demo recordings are silence of the right length, not real audio. The
  transcripts, summaries, action items, and moments are real content; the sound
  is not. `scripts/seed-data.mjs` is the whole library in one file.
