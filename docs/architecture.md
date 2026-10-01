# Fathom Clone data and application architecture

```text
Browser → Cloudflare Pages public site + React app
        → Worker API → Supabase Auth (server publishable key)
                     → Supabase Postgres (server service role)
                     → Private R2 recordings
                     → Workers AI for new upload processing only
```

The same server-only database adapter serves reviewer content and private uploads.
Public reviewer content uses `reviewer_meetings`; private recordings use
`uploaded_meetings`. Separate tables preserve the explicit public/private boundary.
RLS is enabled and direct anon/authenticated-role access is revoked on every table.
No database, storage, or Supabase Auth key is present in the browser bundle. The Worker verifies access tokens with Supabase Auth and keeps access/refresh tokens in Secure HttpOnly same-site cookies.

## Reviewer seed and ordinary reads

`supabase/seeds/reviewer-meetings.json` is the explicit, publishable seed source:
one permissioned recording with imported transcript/prepared intelligence, plus
three labeled synthetic examples. `npm run seed:reviewer` applies the additive
migration, upserts the data, verifies access isolation, and preserves existing
random share tokens. The application never imports this JSON. Tests may import it
as a deterministic fixture. Missing backend data yields loading, empty, or retry
states; it never falls back to bundled meetings.

`GET /api/meetings` returns metadata only. Details and recording/transcript data
load on opening a meeting. `GET /api/uploads` returns lightweight owner-scoped
rows without transcript/intelligence payloads. Dashboard thumbnails are small
images; the dashboard does not request recording bytes.

Search is a debounced (250ms), abortable `GET /api/search` request. The Worker
searches persisted public metadata/passages plus the current owner's uploaded
transcripts and summaries. It returns matching snippets and timestamps, not full
transcripts. This is bounded lexical search; there is no vector/RAG infrastructure.

## Playback, summaries, and moments

The public sanitized recording remains an intentional Pages media asset. A narrow
Function returns correct byte ranges (206/416, HEAD, If-Range), because plain Pages
asset responses did not support the required seeking behavior. Uploaded media is
private in R2 and streamed through authorized byte-range endpoints. Player elements
preload metadata only and retain native media controls.

Transcript/media/summary source timestamps use seconds. Moment ranges use integer
milliseconds; conversion at the player/API boundary is deliberate. Zod validates
ordering, speaker references, moment bounds, and summary source bounds. Playback
events drive active turns and optional follow-scroll. Seeking before media metadata
loads is queued. Media failure leaves the transcript available.

Three summary perspectives are persisted and switch without model calls. Prepared
reviewer output is explicitly labeled; uploaded recordings use Whisper and Llama.
No backend failure turns into prepared/fake success data.

Saved moments live in `meeting_moments`, scoped to the meeting and guest or account owner.
Saving has a retryable failure state and stable request identity. Seed moments have
no owner. Public-seed moments get random, stored share tokens; title/range/note come
from the database, not URL query parameters. Private moments remain private, and
users may explicitly share their full uploaded meeting. Deleting a meeting also
cleans its moment rows through a database trigger.

Reviewer speaker edits persist in `reviewer_speaker_names` for the visitor's guest or account
session; they cannot change the canonical public recording for other reviewers.
Private speaker edits persist alongside the uploaded recording. Guest ownership lasts seven days; retain the original browser cookie until the data is linked to an account. Sign-in migrates guest-owned uploads, moments, and speaker names to a stable account owner hash. Account API requests revalidate the Supabase session before ownership is used. The assessment deployment disables email confirmation, so signup returns a session immediately. If confirmation is enabled later, the allowlisted `/auth/confirm` callback and a one-hour HttpOnly pending-signup cookie bind the link to the signup browser. A link opened in a different browser confirms the email but asks the user to sign in. Password recovery is not implemented.
Legacy browser-storage data is not used as a production fallback.

## Public sharing

`reviewer_meeting_shares` stores full reviewer-meeting tokens.
`uploaded_meeting_shares` stores owner-created, revocable private-meeting tokens.
Both resolve through `/api/shares/:token`; private share media is independently
authorized on each request. Public moment links resolve through `/api/moments/:token`.
No fixed share token or hardcoded meeting-ID lookup exists in a React share page.
The public seeded media itself is deliberately public; a moment is a timed view,
not a separately transcoded or access-restricted clip.

## Upload pipeline and consistency

```text
Create owner-scoped row → signed R2 PUT → verify/freeze playback object
→ real Whisper segments → persist transcript → real Llama analysis → complete
```

The transcript is saved before analysis. Retry reuses saved work; a three-minute
lease prevents concurrent processing. Polling stops on complete/failed states.
Quotas cap uploads, duration, storage rows, retries, and saved moments per guest.
This is a bounded foreground workflow, not a durable background queue.

Deletion is owner-only and idempotently removes R2 objects before deleting the
row. Database foreign keys/triggers clean associated shares/moments. Distributed
storage/database deletion is not transactional; interrupted cleanup can be retried.
API errors are sanitized and never forward raw provider errors or storage keys.
