# Fathom Clone

## Project overview

Fathom Clone turns uploaded conversations into searchable, source-linked meeting intelligence. The public landing page leads through free email/password signup to the existing workspace: meetings → playback and transcript → summaries → sourced actions → moments → sharing → search.

The complete P0 and P1 product path is live at https://fathom-clone.pages.dev.
The public landing uses clearly labeled, fictional interface illustrations to explain the real product; no marketing example is presented as a persisted customer meeting.
The only excluded assessment artifact is the candidate-directed omission of the
camera-on walkthrough, disclosed under [Submission](#submission).

## Features

Working features:

- Premium light/dark public landing page, email/password sign-in and signup, and a directly accessible reviewer library featuring one real reference recording. Synthetic seed records are excluded from meeting discovery.
- Real video/audio playback, native seek/volume controls, five playback speeds.
- Timestamped speaker turns that seek the player, active-turn highlighting, optional follow-scroll.
- In-meeting transcript search with highlighted passages, next/previous navigation, and source-turn seeking,
  shared by public and private recordings.
- Three cached summary templates with materially different General, Sales / Customer,
  and Recruiting / Interview structures.
- Two transcript-supported action items with owner, timing, and media source links.
- Saved moments from the current player position or a transcript turn, with editable
  title, note, and a bounded range persisted in Supabase for the guest owner.
- Public, no-login moment links that seek the real recording, show transcript context,
  and pause at the shared range end without transcoding.
- Read-only full-meeting links with playback, transcript, summaries, and sourced actions.
  Uploaded meetings require an explicit owner action; their unguessable links can be revoked.
- Loading, buffering, failure/retry, and empty-transcript states.
- Search titles, summaries, participants, and transcript content across meetings,
  with highlighted contextual passages and source-specific destination links.
- Meeting overview routes, copy overview, missing-meeting recovery, keyboard-accessible help.
- Persistent manual speaker rename, transcript and summary copy/download actions,
  and complete private-meeting deletion across database and object storage.
- Explicit synthetic data labels and no reference account information in fixtures.

Private uploads go directly to R2, receive live Whisper transcription and Llama analysis,
and persist in Supabase behind a guest or authenticated account owner. Failed analysis can
retry using its saved transcript. Uploads remain private unless their owner creates a
full-meeting link. See [ingestion setup and limits](docs/ingestion-setup.md).
No live bot, calendar connection, automatic diarization, or password-recovery flow is represented as functional. Guest sessions protect private uploads before sign-in; signing in moves that browser’s private data to the account for access across browsers.

## Local setup

Requires Node 22.12+ (validated here using Node 24).

```sh
npm ci
npm run dev # starts the real Pages Worker API and Vite together using ignored .dev.vars
```

Open http://127.0.0.1:5173 after configuring the server and applying the seed. `npm run dev:web` starts only Vite for isolated frontend work and browser tests; account login requires the Pages API on port 8788.
The landing page is `/`, with `/login`, `/signup`, and the guest-accessible `/app`. Reviewers need no account; local development needs the ignored server variables
described in [ingestion setup](docs/ingestion-setup.md).

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium firefox
npm run test:e2e
```

Build output: `apps/web/dist`. `npm run preview` previews static assets only; use
`npm run dev:api` for the complete Worker-backed application.

## Environment variables

Reviewers need no credentials. The deployed public showcase requires server-side
Supabase configuration; private ingestion additionally requires R2 and Workers AI.
Server-side names are listed in [.env.example](.env.example):

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for persisted reviewer and private meeting data.
- `SUPABASE_PUBLISHABLE_KEY` for Supabase email/password Auth through the server Worker. It is never substituted for the service-role credential or bundled into the client.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and
  `R2_BUCKET_NAME` for direct private uploads.
- `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` for deployment automation.
- `SUPABASE_DB_URL` or `SUPABASE_POOLER_URL` only for migration administration;
  neither belongs in the deployed Worker.

Store values in ignored `.dev.vars` for local administration. Never use browser
`VITE_` variables for credentials or commit secret values.

Run the base migrations documented in [service setup](docs/ingestion-setup.md),
then `npm run seed:reviewer` before starting the app. Browser regression tests use
fixtures only inside `tests/fixtures.ts`; setting `FATHOM_CLONE_VERIFY_URL` disables that
fixture adapter for deployed checks.

## Architecture

The React client loads both reviewer content and private recordings through the
Worker API and server-only Supabase data layer. The explicit reviewer seed lives
in `supabase/seeds/reviewer-meetings.json`; it is not bundled into React. Run
`npm run seed:reviewer` after the base migrations to populate the database.

```text
Browser → Pages marketing/auth + React app → Worker API → Supabase Auth and persisted meetings/search
                                     → R2 private upload/playback
                                     → Workers AI transcription/analysis
```

The permissioned public video remains a static media asset with byte-range support.
Moments, speaker edits, account ownership, and random share tokens are persisted. API failures render
explicit retry states instead of silently substituting fixtures. Dashboard reads
omit full transcripts; search fetches persisted snippets only after typing pauses.
Details: [architecture](docs/architecture.md).

## Stack

- React, Vite, strict TypeScript, Tailwind CSS, and custom CSS.
- Radix Dialog, Lucide icons, and Zod runtime validation.
- Cloudflare Pages/Functions, R2, and Workers AI Whisper/Llama models.
- Supabase Postgres with row-level security for private meeting metadata.
- Vitest, Playwright, ESLint, and Prettier for verification.

## Deployment

Authenticate locally with `npx wrangler login`, then:

```sh
npx wrangler pages project create fathom-clone --production-branch mvp
npm run deploy
```

The deployment command builds first and uploads only `apps/web/dist`.
For a new project, Wrangler 4.131's default Pages delegation may fail to detect
the nested build directory. In that case use `--force` only on the project-create
command to select Pages directly; do not add it to deployment commands.
Cloudflare Pages supplies SPA route fallback when no top-level 404.html is present.
Verify `/`, `/login`, `/signup`, `/app`, `/app/meetings/recording-walkthrough`, and a public `/share/:token` route in a fresh browser context. The assessment deployment has **Confirm email disabled** in Supabase Auth, so signup creates a session and enters `/app` immediately. The confirmation callback and pending-email state remain implemented for a later production setting. Before enabling confirmation, set Supabase Auth’s Site URL and redirect allowlist to `https://fathom-clone.pages.dev/auth/confirm`, and configure [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) for public email delivery. The open reviewer demo remains available without an account.

Alternatively connect this repository through Pages Git integration with build
command `npm run build` and output directory `apps/web/dist`.

Official deployment reference:
[Cloudflare React guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/).

`.env.example` lists server-side deployment variable names only. Prefer Wrangler's
local login; never paste tokens into chat or put secrets in browser variables.

## Free-tier constraints

- Uploads are capped at 25 MB and ten minutes, with three uploads per browser and
  twenty workspace uploads per rolling day, one hundred stored rows, and six
  processing attempts per recording.
- Processing runs in the foreground and depends on available Workers AI, R2, and
  Supabase allowances. There is no background queue or automatic retention job.
- Guest ownership lasts seven days. Losing the browser cookie before linking an account loses owner access to private guest meetings. Account sessions use server-issued HttpOnly cookies; password reset is not implemented.
- The public demo media is approximately 3.4 MB. Its byte-range Function and all
  private processing are bounded for an assessment/demo deployment, not production scale.

## Assessment implementation decisions

- Capture uses real file upload; conferencing bots are intentionally omitted.
- Upload-first was prioritized because it demonstrates a complete capture-to-insight
  flow without risking the reviewer path on meeting-platform integration.
- The recorded demo uses a supplied real recording and imported reference transcript.
  It is not synthetic, but it is also not Fathom-Clone-generated transcription. End-to-end
  ingestion is independently available through Upload recording. Three older synthetic seed records remain in the database but are excluded from meeting discovery.
- Its three summaries and action items are prepared, transcript-grounded demo output.
  Template switching does not call a model or imply live generation.
- Moments use stored time ranges against the original media, so sharing requires
  no clip transcoding. Both public moment and full-meeting links resolve stored
  random tokens; uploaded full-meeting links can be revoked.
- Cross-meeting search is a small, typed lexical index over titles, summaries,
  participants, and transcript passages; it does not claim semantic retrieval.
- Raw Fathom materials remain excluded from Git. A sanitized, permissioned video
  derivative and neutral-speaker transcript are included for the real playback demo.
  See [media provenance](docs/reference-research/recording-provenance.md).
- [Research notes](docs/reference-research/fathom-flow-notes.md) distinguish observed
  evidence, inference, and Fathom Clone decisions. Screenshots are not publicly republished.
- `.agent-logs/` is intentionally committed incrementally for assessment review.
  See [capture verification](CAPTURE-TEST.md). Historical entries remain untouched.
- The public showcase requires Supabase reads but no live AI calls. The ~3.4 MB public demo video is
  served through a media-only Pages Function because plain Pages assets do not
  return partial HTTP responses. Media requests consume the Functions free-tier
  quota; app pages remain static. The handler is capped at 12 MB and is not intended
  for arbitrary uploads. Private uploads use R2 and live Workers AI within bounded
  demo quotas; provider free-tier limits still apply.

## Tradeoffs

- Live conferencing bots, calendar integration, OAuth, and mandatory authentication are omitted so reviewer access stays immediate. Email/password accounts are optional and immediate for this assessment. Email confirmation is disabled until custom SMTP is configured; the callback is retained for that future setting.
- Whisper provides timestamps but not trusted speaker identities. Private meetings
  use neutral labels with persistent manual rename instead of pretending diarization.
- Private processing is a bounded foreground request. Interrupted requests can
  resume, but a production version would use a durable job queue and retention policy.
- The public seeded recording uses an imported transcript and prepared summaries;
  the separate upload path is the proof of live transcription and model analysis.
- Browser/mobile verification uses emulated viewports; Safari and physical-device
  testing are not claimed.

## Submission

- Live URL: https://fathom-clone.pages.dev

The candidate chose to omit the camera-on walkthrough. The assessment brief
still lists it as a required artifact, so formal hand-in completeness is not claimed.

Current acceptance evidence: [final hardening audit](docs/final-audit.md) and
[checkpoint report](docs/checkpoints.md). Production
browser checks can be repeated with
`FATHOM_CLONE_VERIFY_URL=https://fathom-clone.pages.dev npm run test:e2e`.
If browser downloads are unavailable, `FATHOM_CLONE_CHROMIUM_EXECUTABLE` optionally selects
an already-installed Chromium executable. Mobile checks emulate a viewport;
they do not constitute testing on a physical iPhone or in Safari.

## Future improvements

- Move ingestion to a durable queue with progress events and automated retention.
- Add password recovery and custom SMTP before enabling email confirmation for broader public use.
- Add reviewed speaker diarization with merge/split controls.
- Add evidence-linked Ask AI only after evaluating citation accuracy on longer calls.
- Test long recordings on Safari and physical mobile devices.
