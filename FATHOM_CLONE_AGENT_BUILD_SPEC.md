# FATHOM CLONE — 24-Hour Build Specification for Coding Agent

> Goal: Rebuild the highest-value Fathom experience as **Fathom Clone** within a 24-hour assessment window, with a substantially more polished UI and an upload-first capture strategy.
>
> Hard constraint: The MVP must be publicly accessible on the internet, usable by a reviewer who is not signed in as the developer, and run on free-tier services.
>
> Assessment priority: maximize **working product shipped in the time**, show strong **product judgment**, and deliver excellent **UX/UI**. A complete, stable, beautiful product is more valuable than attempting every Fathom feature.
>
> Product positioning:
>
> **"Upload a meeting. Get a searchable transcript, decisions, actions, summaries, and AI answers with timestamp citations."**

---

# HOW TO USE THIS SPEC — SOURCE OF TRUTH AND CONFLICT RESOLUTION

This document is intentionally detailed, but the coding agent must **not** treat every later section as permission to build everything immediately.

When instructions conflict, use this order of authority:

1. **The official assessment brief and capture requirements** supplied by the company.
2. **Observed reference evidence** from the current Fathom product: screenshots, notes, and a permissioned demo recording/transcript.
3. **Showcase priorities in this spec:** Tier S / P0 first, then Tier A, then Tier B / P1, then optional work.
4. Lower sections in this document that describe implementation possibilities.
5. Agent defaults, preferences, or assumptions.

Interpretation rules:

- A later implementation section does **not** override the showcase-first priority order.
- If an optional section conflicts with a Tier S/P0 requirement, skip or simplify the optional work.
- If the current Fathom UI differs from older notes, document the observed version/date and reproduce the **behavioral lesson**, not obsolete visuals.
- If the assessment brief and Fathom behavior differ, the assessment brief wins.
- Do not expand scope merely because a library, API, or integration is available.
- Preserve any already-working reviewer-critical flow. Do not rewrite stable code during polish unless the rewrite fixes a demonstrated problem.

## Agent execution protocol

Work **checkpoint by checkpoint**, not as one giant autonomous build request.

For each checkpoint:

1. Inspect the current repository before editing.
2. Read the relevant reference artifacts for that checkpoint.
3. State a short implementation plan and the files likely to change.
4. Implement the smallest complete vertical slice.
5. Run the acceptance checks for that checkpoint.
6. Fix failures before advancing.
7. Keep the public/deployable path working.
8. Report:
   - files changed;
   - commands/checks run;
   - acceptance results;
   - remaining risks or deliberate deferrals.

Do not claim success from code inspection alone when the behavior can be exercised in the browser.

---

# REFERENCE ARTIFACT INGESTION PROTOCOL

The reviewer may inspect the agent prompts and repository. Treat all supplied reference material as auditable evidence, not as a license to copy Fathom literally.

## A. Screenshots

Store sanitized screenshots under:

```text
docs/reference-research/screenshots/
```

Recommended naming:

```text
01-dashboard.png
02-meeting-detail.png
03-transcript-seek.png
04-summary-template.png
05-action-items.png
06-highlight.png
07-share.png
08-search.png
```

Create or update:

```text
docs/reference-research/fathom-flow-notes.md
```

For every important screenshot, record:

```text
Observed:
Behavior / interaction:
Important state or edge case:
Fathom Clone decision:
What NOT to copy literally:
```

Use screenshots to understand information architecture, hierarchy, state transitions, density, and interaction patterns. **Do not** copy Fathom branding, logos, proprietary illustrations, exact marketing copy, or pixel-for-pixel styling.

## B. Demo recording, transcript, and summary

Only use meeting material that is safe to expose to the coding agent, logs, repository, and public demo.

Preferred evidence order:

1. self-recorded demo meeting created specifically for the assessment;
2. meeting with explicit permission to publish;
3. sanitized transcript/summary fixture;
4. clearly labeled synthetic fixture for load/edge-case testing.

Before the agent receives real meeting material:

- remove secrets, API keys, credentials, private URLs, customer data, internal company information, personal phone numbers, and unnecessary email addresses;
- replace names with neutral demo names when identity is not relevant;
- crop/redact screenshots that expose unrelated account or participant information;
- do not commit raw private recordings or unredacted private transcripts to the public repository;
- do not paste large private transcript sections directly into prompts when a sanitized local fixture/path can be referenced instead.

If the seeded meeting is publicly viewable in Fathom Clone, assume **anyone with the deployment URL can see it**.

## C. Evidence labels

In research notes, distinguish:

- `OBSERVED` — directly visible in Fathom or the supplied reference material;
- `INFERRED` — reasonable interpretation not directly verified;
- `FATHOM CLONE DECISION` — a deliberate implementation choice for this assessment.

Never present an inference as observed reference behavior.

---

# ASSESSMENT PROMPT HYGIENE — PROMPTS ARE REVIEWABLE WORK PRODUCT

Assume every coding-agent prompt and response may be reviewed by the assessment company.

A strong prompt should make the engineering judgment visible. Prefer one milestone or tightly related vertical slice per prompt.

Every implementation prompt should contain:

```text
TASK
What exact reviewer-visible outcome is required?

REFERENCE INPUTS
Which spec section, screenshot(s), transcript fixture, or existing files should the agent inspect?

CONSTRAINTS
What must remain working? What is explicitly out of scope?

ACCEPTANCE CHECKS
What observable behaviors must pass before the task is complete?

REPORT BACK
Files changed, checks run, evidence of success, and unresolved risks.
```

Prompt rules:

- Do not send a vague prompt such as “clone Fathom.” Name the exact behavior to reproduce and the Fathom-Clone-specific design goal.
- Do not ask the agent to copy Fathom pixel-for-pixel.
- Do not paste secrets, environment values, private meeting content, or unnecessary personal data into prompts.
- Do not ask the agent to bypass, disable, rewrite, or hide the assessment capture/logging setup.
- Do not ask the agent to fabricate passing tests, screenshots, seed data, or implementation status.
- Do not hide stubs. Explicitly label simulated or seeded behavior.
- Prefer evidence-producing prompts: ask the agent to run the app/checks and report what actually passed.
- Keep prompts concise enough that the important constraints are not buried under repeated prose.
- If the agent proposes extra infrastructure or scope, require it to explain which Tier S/P0 acceptance criterion it unlocks before accepting the expansion.

---

# ASSESSMENT COMPLIANCE — READ BEFORE WRITING CODE

The assessment brief is part of the product requirements. Do not begin implementation until the following setup/research steps are complete.

## A. Experience the reference product first

Use the **Fathom free plan** and go through the product end-to-end before writing Fathom Clone code. Capture screenshots and concise notes as you go.

At minimum, inspect these Fathom flows:

1. Connect a calendar.
2. Put the Fathom notetaker into a real short meeting (a ~2-minute self-call on Zoom, Meet, or Teams is sufficient for discovery).
3. Let the meeting record and wait for processing.
4. Compare playback against the transcript.
5. Read the AI summary.
6. Switch summary templates.
7. Inspect action items.
8. Highlight a moment during/after the call and observe where it appears.
9. Search across meetings.
10. Share a clip with someone who was not on the call and verify the external experience.
11. Inspect behavior on a long, complex meeting case (target reference: ~8 speakers, ~1 hour) so the Fathom Clone architecture does not assume only tiny recordings.

Store research artifacts in the repository, for example:

```text
docs/reference-research/
├─ fathom-flow-notes.md
└─ screenshots/
```

If the current account uses a different Fathom capture experience or some features are plan-gated, record what was actually observed and continue with the assessment-critical post-meeting flows. Do not block the build trying to force an obsolete reference path.

Do not copy Fathom's visual design. The purpose of research is to understand interaction patterns, information architecture, edge cases, and product behavior.

## B. Agent capture setup is a blocking prerequisite

Before implementation:

1. Open the **8x agent capture setup** link supplied in the assessment brief.
2. Complete its setup exactly as instructed.
3. Run the capture test.
4. **Do not start building until the capture test passes.**
5. Ensure prompts and agent responses are being written to:

```text
.agent-logs/
```

6. Commit `.agent-logs/` throughout development rather than creating one final bulk commit at the end.
7. Do not add `.agent-logs/` to `.gitignore`.
8. Never put secrets, credentials, tokens, private meeting content, or environment-variable values into `.agent-logs/`.

## C. Capture-layer decision

The assessment explicitly allows the recording/notetaker capture layer to be **stubbed or faked** if necessary. If Fathom Clone does not implement a Zoom/Meet/Teams bot:

- state this clearly in the walkthrough;
- do not pretend the bot is functional;
- spend the saved time on playback/transcript quality, summaries, templates, action items, highlights, cross-meeting search, sharing, and UI/UX.

The production Fathom Clone MVP should remain upload-first. Browser recording may be added if time remains.

## D. Required hand-in artifacts

The final submission must include all three:

1. **Live link** — publicly deployed and openable by the reviewer; a localhost recording does not count.
2. **Public repository** — must include the committed `.agent-logs/` directory.
3. **Walkthrough video** — maximum 5 minutes, camera on, using Loom or a similar tool.

Also:

- seed the deployed app with **real usable meeting data** so the reviewer does not land on an empty meeting list;
- label any deliberately synthetic/demo-only data honestly;
- include the live URL and repository URL in the submission fields, clearly labeled.

## E. How the project is judged

Optimize the build around the actual judging criteria:

1. **Speed** — amount of working product shipped within the window.
2. **Product judgment** — what was prioritized, simplified, stubbed, or omitted.
3. **UX and UI** — whether the shipped product is genuinely good to use.

This means Fathom Clone should prefer a polished end-to-end workflow over unfinished breadth.

---


# SHOWCASE-FIRST PRIORITY ORDER — THIS OVERRIDES ALL LOWER-PRIORITY FEATURES

The assessment is judged on **speed, product judgment, and UX/UI**. Therefore, the build order is not “implement every feature in this document.” The build order is:

## TIER S — Submission blockers

These must exist before anything can be considered finished:

1. **8x agent capture setup passes before coding**
2. `.agent-logs/` is generated and committed incrementally
3. **Public live deployment**
4. **Public repository**
5. Live deployment opens from a clean/incognito browser
6. **At least 2 useful seeded meetings** are visible immediately
7. At least 1 seeded meeting uses a real recording/transcript
8. README clearly documents tradeoffs
9. Camera-on walkthrough is **5 minutes or less**
10. Any stubbed capture/bot behavior is disclosed honestly

If any Tier S item is missing, do not spend time on bonus product features.

## TIER A — The product showcase

These are the features the reviewer should see in the walkthrough. They correspond most closely to the behaviors explicitly called out in the assessment brief.

Build these before Ask AI, diarization, live transcription, complex auth, or advanced settings:

### 1. Meeting playback + transcript sync

Must feel excellent.

```text
play recording
→ transcript follows context
→ click transcript timestamp
→ playback seeks immediately
```

### 2. AI summary + summary templates

Minimum working templates:

```text
General
Sales / Customer
Recruiting / Interview
```

Switching templates must visibly change the summary structure or emphasis.

### 3. Action items

Show meaningful tasks extracted from the meeting, preferably with:

- owner when supported by transcript
- due date when supported
- source timestamp

### 4. Highlights / moments

Reviewer must be able to:

```text
choose a transcript moment
→ save highlight
→ see it attached to the meeting
```

### 5. External clip/moment sharing

Do not spend time transcoding clips.

A “clip” can be a public deep link containing a start/end time:

```text
/share/:token?start=742&end=788
```

The shared page should:
- open without login
- start at the correct timestamp
- show relevant transcript context
- stop/end visually at the selected range if practical

### 6. Search across meetings

Search should find:
- meeting titles
- summaries
- transcript content

Show matching context/snippets.

### 7. Premium UI/UX

The meeting detail experience is the visual centerpiece. Prioritize:
- typography
- spacing
- hierarchy
- transcript readability
- player/transcript interaction
- polished states
- fast scanability

This matters more than adding another backend feature.

## TIER B — Supporting functionality

Implement after Tier S + Tier A are stable:

- real upload flow
- real transcription pipeline
- transcript search within a meeting
- full meeting share page
- speaker rename
- copy/export
- delete
- responsive mobile layout
- retry/error states
- optional authentication

Authentication must **not block reviewer evaluation**. Prefer either:
- a public demo/reviewer route, or
- a one-click “View demo” path with seeded data.

## TIER C — Bonus only

Do not start these until the final submission is already viable:

- Ask AI / RAG
- cross-meeting conversational AI
- browser microphone recording
- near-live transcription
- automatic speaker diarization
- calendar integration
- conferencing bot
- OAuth
- theme toggle
- advanced settings
- complex tests beyond critical paths

If there are only 2–3 hours remaining and Tier A is incomplete, **do not implement Tier C**.

## Required product-judgment rule

At every decision point ask:

> “Will this be visible and impressive in the 5-minute walkthrough?”

If the answer is no, and a Tier S/A item is incomplete, defer it.

---


# 0. NON-NEGOTIABLE AGENT RULES

You are the autonomous coding agent responsible for completing this product.

Follow these rules strictly:

1. Do not over-engineer.
2. Do not implement features outside this specification until all P0 and P1 requirements work.
3. Keep the project deployable after every major milestone.
4. Prefer simple, proven libraries over custom infrastructure.
5. No paid services are required for the assessment build.
6. Never commit secrets, tokens, service-role keys, or credentials.
7. Every asynchronous action must have:
   - loading state
   - success state
   - failure state
   - retry path when appropriate
8. Every page must be responsive.
9. Every major interaction must be keyboard accessible.
10. Do not leave placeholder buttons that do nothing.
11. Do not generate fake production data except seeded demo data explicitly marked as demo.
12. Avoid excessive comments, abstractions, and premature design patterns.
13. Keep components small and readable.
14. TypeScript strict mode must stay enabled.
15. Run lint, typecheck, tests, and production build before final deployment.
16. If a feature threatens the 24-hour deadline, simplify it instead of leaving the core product incomplete.
17. Do not spend the assessment window building a Zoom/Google Meet/Teams bot unless every required post-meeting flow is already complete; the brief permits the capture layer to be stubbed.
18. Do not build billing, organizations, enterprise permissions, CRM sync, or production calendar sync in the Fathom Clone MVP unless all assessment-critical flows are already complete.
19. Implement the post-meeting behaviors the assessment explicitly exercises: templates, action items, moments/highlights, cross-meeting search, and external clip sharing.
20. Keep `.agent-logs/` enabled and committed incrementally throughout the build.
21. Seed the deployed app with real usable meeting data before submission.
22. The product must still look premium without live-bot/calendar infrastructure.
23. The UI must feel intentionally designed — not like a default shadcn dashboard.
24. Never claim a stubbed or simulated feature is live. Disclose tradeoffs clearly in README and walkthrough.
25. Before each milestone, inspect the current repo and preserve working reviewer-critical behavior.
26. Do not modify, disable, replace, or work around the assessment capture/logging setup unless the official assessment instructions explicitly require it.
27. Treat screenshots, transcripts, summaries, recordings, and prompt logs as potentially public. Use only sanitized or permissioned material.
28. Do not copy Fathom logos, branding, exact visual styling, or proprietary copy. Reproduce product behaviors with a distinct Fathom Clone design system.
29. End each milestone with evidence: files changed, checks run, acceptance results, and explicit deferrals.
30. If a proposed dependency or architecture change does not unlock a Tier S/P0 requirement, defer it.

---

# 1. DEFINITION OF DONE — SHOWCASE VERSION

A submission is considered successful when the reviewer can open the public URL and understand the product immediately without relying on the developer's local machine.

## Reviewer-visible minimum

The reviewer must be able to:

1. Open the Fathom Clone live HTTPS URL from an incognito/clean browser.
2. Immediately see useful seeded meeting data or enter a one-click demo experience.
3. Open a completed meeting with real usable transcript data.
4. Play the recording.
5. Click transcript timestamps and jump playback to the correct moment.
6. Read a polished AI summary.
7. Switch between at least **3 genuinely different summary templates**.
8. See action items extracted from the meeting.
9. Create or inspect a saved highlight/moment.
10. Open a public shared clip/moment without authentication.
11. Search across meetings and see matching transcript/summary context.
12. See a polished, responsive interface with credible loading/error/processing states.

## Strong supporting flow

If time permits after the above is stable:

13. Upload a new recording.
14. Process it through real transcription.
15. Search within its transcript.
16. Rename speakers.
17. Share the entire meeting.
18. Copy/export summary or transcript.
19. Delete the meeting.

## Bonus only

20. Ask AI about a meeting with timestamp citations.
21. Browser recording.
22. Near-live transcription.
23. Automatic diarization.
24. Cross-meeting conversational AI.

Do not sacrifice the reviewer-visible minimum to implement bonus features.

---

# 2. PRODUCT SCOPE — PRIORITIZED FOR THE ASSESSMENT

## P0 — Must be visible in the final walkthrough

- Public deployed app
- Reviewer-safe/incognito access
- Seeded real meeting data
- Premium dashboard
- Meeting detail page
- Video/audio playback
- Timestamped transcript
- Transcript timestamp → player seek
- AI summary
- At least 3 summary templates
- Action items
- Highlights/moments
- Public time-bounded clip/moment sharing
- Cross-meeting search
- Excellent UI/UX
- `.agent-logs/` committed
- Public repository
- <=5 minute camera-on walkthrough

## P1 — Build immediately after P0 is stable

- Real recording upload
- Real speech-to-text processing
- Processing progress/state
- Transcript search within meeting
- Full meeting sharing
- Speaker rename
- Copy/export actions
- Delete meeting
- Responsive mobile behavior
- Useful failure/retry states

## P2 — Valuable but optional

- Decisions
- Key points
- Topics/chapters
- Follow-up email draft
- Ask AI about current meeting
- Timestamp citations in Ask AI
- Authentication, if not already required by architecture
- Download transcript/summary as Markdown

## P3 — Bonus only

- Browser microphone recording
- Near-live transcription
- Cross-meeting conversational Ask AI
- Automatic diarization
- Calendar integration
- Zoom/Meet/Teams bot
- OAuth
- Theme toggle
- Keyboard shortcut polish beyond basic accessibility

## Explicitly out of scope unless everything above is finished

- Stripe
- Subscription management
- CRM integrations
- Team workspaces
- Enterprise RBAC
- SSO
- Native desktop app
- Browser extension
- Native mobile app
- Complex analytics
- Server-side clip transcoding
- Perfect real-time transcription

---

# 3. FREE-TIER STACK

Use this stack unless a blocker appears.

## Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui primitives
- Radix primitives where needed
- Lucide icons
- TanStack Query
- React Hook Form
- Zod

## Hosting

- Cloudflare Pages

## API

- Cloudflare Workers

## Database

- Supabase PostgreSQL

## Authentication

- **Optional for the assessment build.** Use Supabase Auth only if auth is already stable or explicitly required; reviewer/demo access must never be blocked by signup.

## Vector search

- **Deferred by default.** P0 cross-meeting search should use simple indexed/lexical database search first.
- Add pgvector in Supabase only if Ask AI / semantic retrieval is selected after the reviewer-critical flows are stable.

## Recording storage

- Cloudflare R2

## AI inference

Primary:
- Cloudflare Workers AI, **only after the seeded showcase flow works without depending on live AI latency**

Fallback for local development:
- whisper.cpp using Vulkan
- llama.cpp using Vulkan

Do not let provider integration block the flagship UI. Seeded, precomputed analysis for the reviewer demo is acceptable when clearly labeled and paired with a real ingestion path where required.

## Media processing

Client-side where possible:
- browser APIs
- optional ffmpeg.wasm only when needed

Avoid routing large MP4 files through Workers.

Use direct/signed upload to R2.

---

# 4. REPOSITORY STRUCTURE

Use a monorepo-like structure without unnecessary tooling complexity.

```text
/
├─ apps/
│  ├─ web/
│  │  ├─ src/
│  │  ├─ public/
│  │  └─ ...
│  └─ worker/
│     ├─ src/
│     └─ ...
│
├─ packages/
│  └─ shared/
│     ├─ schemas/
│     ├─ types/
│     └─ utils/
│
├─ supabase/
│  └─ migrations/
│
├─ docs/
│  ├─ architecture.md
│  ├─ demo.md
│  └─ reference-research/
│     ├─ fathom-flow-notes.md
│     └─ screenshots/
│
├─ .agent-logs/
│  └─ ... agent capture output (must be committed)
│
├─ .env.example
├─ README.md
└─ AGENT_BUILD_SPEC.md
```

Do not introduce Nx/Turborepo unless already necessary.

---

# 5. VISUAL DIRECTION

The UI must look more premium, modern, and focused than Fathom.

Do not visually copy Fathom.

The goal is:

- cleaner
- more spacious
- stronger hierarchy
- faster to scan
- more polished motion
- clearer AI output
- less clutter
- stronger transcript usability
- better use of contextual panels

Visual inspiration category:

- Linear
- Raycast
- Arc
- Notion Calendar
- Vercel
- Granola
- modern AI-native SaaS

Avoid:

- generic admin template
- giant gradient blobs
- excessive glassmorphism
- neon cyberpunk styling
- childish rounded cards everywhere
- excessive shadows
- dense borders
- too many pills
- colorful icon overload

---

# 6. DESIGN SYSTEM

## Typography

Preferred:
- Geist / Inter / system fallback

Use:

```text
Display: 32–40px / 700
Page title: 26–30px / 650
Section title: 16–18px / 600
Body: 14–15px / 400
Meta: 12–13px / 450
Transcript: 14–15px / 400
```

Keep line-height generous.

## Layout

Desktop:
- left navigation: 220–240px
- content max width: 1440px
- page gutters: 28–40px
- card radius: 14–18px
- major surfaces: 1px subtle border

Mobile:
- bottom/tab navigation or compact top nav
- no horizontal overflow
- transcript/player layout becomes stacked

## Color

Use a refined neutral-first palette.

Suggested conceptual palette:

```text
Canvas: near-white / very dark charcoal
Surface: subtle neutral elevation
Primary text: high contrast
Secondary text: muted neutral
Accent: one distinctive indigo/violet/blue family
Success: restrained green
Warning: amber
Danger: red
```

Do not use more than one dominant brand accent.

## Motion

Use subtle motion only:

- 150–220ms transitions
- fade/slide for side panels
- skeleton shimmer
- hover elevation
- transcript row active state
- progress animations

No large distracting animations.

---

# 7. APP SHELL

Desktop layout:

```text
┌─────────────────────────────────────────────────────────────┐
│ Sidebar            │ Main content                           │
│                    │                                        │
│ Logo               │                                        │
│ Meetings           │                                        │
│ Ask AI             │                                        │
│                    │                                        │
│ + Upload           │                                        │
│                    │                                        │
│ ------------------ │                                        │
│ User               │                                        │
└─────────────────────────────────────────────────────────────┘
```

Sidebar must feel elegant and compact.

Suggested items:

- Meetings
- Ask AI
- Upload recording
- Settings

Do not add fake nav items.

---

# 8. DASHBOARD

Route:

```text
/app
```

## Header

Show:

```text
Good morning, {firstName}
Your meeting intelligence, organized.
```

Right side:

- Search
- Upload recording button
- Profile menu

## Hero action

Do not use a huge marketing hero.

Use a compact upload command surface:

```text
┌────────────────────────────────────────────────────┐
│ Drop a meeting recording here                      │
│ MP4, MOV, MP3, WAV, M4A, WebM                     │
│                                                    │
│ [ Choose recording ]                               │
└────────────────────────────────────────────────────┘
```

It should look premium and integrated, not like a default file input.

## Recent meetings

Use a clean list/table hybrid.

Columns:

- meeting title
- short summary
- created time
- duration
- participants/speakers
- status
- actions

Meeting row hover:
- subtle background
- reveal quick actions

Quick actions:
- Open
- Copy summary
- Share
- Delete

## Search

Search by:

- title
- summary
- transcript text
- speaker/display names where practical

This is an assessment-critical flow because the reference brief explicitly checks search across meetings. Use debounced search and show useful result context/snippets.

For P0, prefer the simplest reliable implementation (for example title/summary/transcript text search with database indexes). Semantic/vector search is **not required** for this flow.

## Empty state

Must look intentional.

Include:
- elegant icon/illustration using CSS/Lucide
- short explanation
- clear upload CTA

Do not use stock images.

---

# 9. UPLOAD EXPERIENCE

Support:

- drag & drop
- click to upload

Accepted:

```text
video/mp4
video/quicktime
audio/mpeg
audio/wav
audio/x-m4a
video/webm
audio/webm
```

Configurable limits:

```text
MAX_FILE_MB=500
MAX_DURATION_MINUTES=60
```

For demo, show the limit clearly.

Upload steps:

```text
Preparing
Uploading
Processing audio
Transcribing
Analyzing
Complete
```

Use one progress UI with status text.

Never show a spinner with no explanation for long operations.

After upload begins:
- create meeting DB row immediately
- redirect to meeting processing page
- continue polling/querying status

---

# 10. MEETING DETAIL PAGE

Route:

```text
/app/meetings/:id
```

This is the flagship page.

It must be visually stronger than Fathom.

## Desktop layout

Use a flexible three-zone layout:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Meeting header                                                      │
├────────────────────────────────────────┬────────────────────────────┤
│                                        │                            │
│ Player                                 │ AI Intelligence            │
│                                        │                            │
│                                        │ Summary                    │
│                                        │ Actions                    │
│                                        │ Decisions                  │
│                                        │ Chapters                   │
├────────────────────────────────────────┴────────────────────────────┤
│ Transcript / Ask AI                                                │
└─────────────────────────────────────────────────────────────────────┘
```

Or:

```text
┌──────────────────────────────┬──────────────────────────────────────┐
│ Player + metadata            │ Summary / Insights                  │
│                              │                                      │
├──────────────────────────────┴──────────────────────────────────────┤
│ Transcript / Ask AI                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

Do not force an overly narrow transcript column.

## Header

Show:

- editable title
- date/time
- duration
- processing state
- Share
- Copy
- overflow menu

Use compact metadata.

---

# 11. MEDIA PLAYER

Use the native HTML video/audio element wrapped in a custom UI if time allows.

Must support:

- play/pause
- seek
- volume
- current time
- duration
- playback speed: 0.75x, 1x, 1.25x, 1.5x, 2x

Optional:
- ±10 seconds
- keyboard shortcuts

Transcript click must set:

```ts
media.currentTime = timestampSeconds
```

Active transcript row should follow playback if practical.

Do not waste several hours building a fully custom video player.

---

# 12. TRANSCRIPT UX

This must be better than a plain text dump.

Each transcript segment:

```text
[Speaker 1]                  12:47
Around $2,500 per month.
```

Features:

- timestamp button
- speaker label
- text
- hover actions
- active playback highlight
- transcript search
- auto-scroll toggle
- copy segment
- rename speaker

## Speaker rename

Click speaker name:

```text
Speaker 1 → John
```

Update all segments with that speaker ID.

Store speaker identity separately from raw transcript text.

## Search

Transcript search should:
- highlight matches
- show number of matches
- support next/previous result
- jump to segment

---

# 13. AI INTELLIGENCE PANEL

Tabs or segmented navigation:

```text
Overview
Actions
Decisions
Topics
Follow-up
```

Avoid too many tabs.

## Summary templates

Support template switching as an assessment-critical feature.

Minimum templates:

```text
General
Sales / Customer
Recruiting / Interview
```

Behavior:

- The active template changes the structure/emphasis of the summary.
- Reuse/cached AI output where possible; do not trigger wasteful regeneration on every tab switch.
- If generation is on-demand, persist the generated result per meeting + template.
- Template switching must be a real functional behavior, not static tabs containing the same content.

## Overview

Show:

### Executive summary

3–6 concise bullets or short paragraphs.

### Key points

Cards or bullets.

### Risks / blockers

Only if present.

### Sentiment / tone

Optional and low priority.

Do not overstate emotional analysis.

## Actions

Each action:

```text
□ Prepare pricing proposal
  Owner: Sarah
  Due: Friday
  Source: 22:14
```

Click source timestamp → player seeks.

Actions should be editable if easy.

## Decisions

Example:

```text
Decision
Launch new pricing next month.

Source
31:22
```

## Topics / chapters

Example:

```text
00:00 Intro
04:18 Current workflow
12:40 Pricing
23:15 Implementation concerns
37:30 Next steps
```

Click chapter → seek.

## Follow-up

Generate a concise follow-up email draft.

Actions:
- Copy
- Regenerate if practical

Do not include email sending in MVP.

---

# 13A. HIGHLIGHTS / MOMENTS / CLIP SHARING

The assessment explicitly exercises highlighting a moment and sharing a clip externally. Implement this without expensive server-side video editing.

## Create a moment

Allow a user to create a moment from:

- the current player timestamp;
- a transcript segment;
- an optional selected start/end range.

Moment fields:

```text
id
meeting_id
start_ms
end_ms
title
note
created_at
```

Default behavior:

- start at selected timestamp/segment;
- default end 30–60 seconds later, capped by media duration;
- user may adjust start/end if implementation time allows.

## Share a clip without transcoding

Do **not** cut and re-encode the video on the server during the assessment build.

Instead create a share link containing a moment reference. The public clip page should:

1. load the original media securely;
2. seek automatically to `start_ms`;
3. display the relevant transcript excerpt;
4. stop/pause playback at `end_ms`;
5. show the moment title/note;
6. work for a reviewer who is not logged into the owner's account.

This satisfies the core clip-sharing product behavior while staying within free-tier and 24-hour constraints.

---

# 14. ASK AI

This is a major product feature.

Tab:

```text
Ask AI
```

Input placeholder:

```text
Ask anything about this meeting…
```

Suggested questions:

- What did the customer agree to?
- What are the next steps?
- What objections were raised?
- What deadlines were mentioned?
- Summarize the pricing discussion.

## Response format

Always return:

1. direct answer
2. supporting transcript citations
3. clickable timestamps

Example:

```text
The customer was comfortable with approximately $2,500/month.

Sources
12:47 — “Around $2,500 per month.”
14:03 — “That range works for us.”
```

Citation timestamps must seek the media.

## Grounding rule

The LLM must answer only from meeting context.

If evidence is absent:

```text
I couldn't find that information in this meeting.
```

Do not hallucinate.

---

# 15. RAG IMPLEMENTATION — OPTIONAL / ONLY IF ASK AI IS SELECTED

Do not build this while any Tier S/P0 or Tier A flow is incomplete.

If Ask AI is selected as the optional differentiator:

1. Split transcript into chunks.
2. Preserve:
   - meeting ID
   - segment IDs
   - start timestamp
   - end timestamp
   - text
3. Generate embeddings.
4. Store embeddings in pgvector.
5. Embed user question.
6. Retrieve top relevant chunks.
7. Send chunks + question to LLM.
8. Require structured JSON answer.

Suggested chunk size:

```text
400–800 tokens
```

Preserve timestamp metadata.

No need to implement a complex agent framework.

---

# 16. TRANSCRIPTION PIPELINE

The pipeline must be explicit.

Meeting statuses:

```text
created
uploading
uploaded
transcribing
analyzing
complete
failed
```

Store:

```text
processing_stage
processing_progress
processing_error
```

## Flow

```text
recording
↓
R2 upload
↓
transcription API
↓
timestamp normalization
↓
transcript persistence
↓
AI analysis
↓
embeddings
↓
complete
```

If the transcription provider cannot ingest large files directly:
- extract/compress audio
- chunk audio
- transcribe chunks
- merge timestamps

Do not block the browser for the entire workflow if avoidable.

---

# 17. AI ANALYSIS OUTPUT

Use one structured analysis request when possible.

Expected JSON:

```json
{
  "title": "Customer onboarding discussion",
  "summary": [
    "..."
  ],
  "keyPoints": [
    {
      "text": "...",
      "timestamp": 742
    }
  ],
  "decisions": [
    {
      "text": "...",
      "timestamp": 1224
    }
  ],
  "actionItems": [
    {
      "task": "...",
      "owner": "Sarah",
      "dueDate": null,
      "timestamp": 1320
    }
  ],
  "risks": [
    {
      "text": "...",
      "timestamp": 1541
    }
  ],
  "topics": [
    {
      "title": "Pricing",
      "start": 742,
      "summary": "..."
    }
  ],
  "followUpEmail": {
    "subject": "...",
    "body": "..."
  }
}
```

Validate with Zod.

If JSON is invalid:
- retry once with repair prompt
- otherwise mark analysis failed separately from transcription

Transcript should remain usable even if analysis fails.

---

# 18. DATABASE SCHEMA

Keep it minimal.

## profiles

```text
id uuid PK
email text
display_name text
created_at timestamptz
```

## meetings

```text
id uuid PK
user_id uuid FK
title text
original_filename text
media_type text
storage_key text
duration_seconds integer
status text
processing_stage text
processing_progress integer
processing_error text nullable
created_at timestamptz
updated_at timestamptz
```

## speakers

```text
id uuid PK
meeting_id uuid FK
speaker_key text
display_name text
created_at timestamptz
```

## transcript_segments

```text
id uuid PK
meeting_id uuid FK
speaker_id uuid nullable FK
start_ms integer
end_ms integer
text text
sequence integer
created_at timestamptz
```

## meeting_insights

```text
meeting_id uuid PK/FK
summary jsonb
key_points jsonb
decisions jsonb
action_items jsonb
risks jsonb
topics jsonb
follow_up_email jsonb
created_at timestamptz
updated_at timestamptz
```

## transcript_chunks

```text
id uuid PK
meeting_id uuid FK
start_ms integer
end_ms integer
text text
embedding vector(...)
created_at timestamptz
```

## meeting_summary_templates

```text
id uuid PK
meeting_id uuid FK
template_key text
content jsonb
created_at timestamptz
updated_at timestamptz
unique(meeting_id, template_key)
```

## meeting_moments

```text
id uuid PK
meeting_id uuid FK
start_ms integer
end_ms integer
title text
note text nullable
created_at timestamptz
```

## share_links

```text
id uuid PK
meeting_id uuid FK
moment_id uuid nullable FK
token text unique
enabled boolean
expires_at timestamptz nullable
created_at timestamptz
```

Use row-level security.

A user must never access another user's private meetings.

---

# 19. API CONTRACTS

Suggested endpoints.

## Upload

```text
POST /api/meetings
POST /api/meetings/:id/upload-url
```

## Processing

```text
POST /api/meetings/:id/process
GET  /api/meetings/:id/status
```

## Meeting

```text
GET    /api/meetings/:id
PATCH  /api/meetings/:id
DELETE /api/meetings/:id
```

## Transcript

```text
GET   /api/meetings/:id/transcript
PATCH /api/meetings/:id/speakers/:speakerId
```

## AI

```text
POST /api/meetings/:id/ask
```

## Summary templates

```text
GET  /api/meetings/:id/summaries
POST /api/meetings/:id/summaries/:templateKey
```

## Moments / clips

```text
POST   /api/meetings/:id/moments
PATCH  /api/meetings/:id/moments/:momentId
DELETE /api/meetings/:id/moments/:momentId
POST   /api/meetings/:id/moments/:momentId/share
```

## Cross-meeting search

```text
GET /api/search?q=...
```

## Sharing

```text
POST   /api/meetings/:id/share
DELETE /api/meetings/:id/share
GET    /share/:token
```

Keep API response shapes typed and consistent.

Example:

```ts
type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};
```

---

# 20. AUTHENTICATION — CONDITIONAL, MUST NOT BLOCK REVIEW

Authentication is **not a prerequisite for the reviewer-visible showcase** unless the existing scaffold already depends on it or the assessment brief explicitly requires it.

Preferred assessment behavior:

- reviewer can reach seeded Fathom Clone data from a clean/incognito browser with one click or no login;
- public share routes never require authentication;
- private user data, if authentication exists, remains isolated correctly.

If Supabase Auth is already present and stable, keep it simple:

- email/password is sufficient;
- magic link is optional;
- do not add OAuth before P0 is complete.

Possible routes:

```text
/login          optional
/signup         optional
/app            private app when auth exists
/demo           public/read-only reviewer path when needed
/share/:token   public share path
```

If `/app/*` is protected, provide a reliable one-click reviewer/demo path so evaluation is never blocked by account creation, email delivery, or credentials.

If authentication is omitted, do **not** expose arbitrary database rows through an unrestricted anonymous client. Serve only a deliberately public demo dataset or narrowly scoped read-only demo API.

---

# 21. SHARE PAGE

Route:

```text
/share/:token
```

Read-only.

Show:

- meeting title
- summary
- transcript
- timestamps
- media playback if allowed
- if the share token references a moment: seek to the moment start, show the excerpt, and stop at the moment end

Do not expose:
- internal user ID
- private storage keys
- app navigation
- unrelated meetings

Add:

```text
Shared via Fathom Clone
```

Keep branding subtle.

---

# 22. PROCESSING PAGE

During processing, the reviewer should not stare at a spinner.

Show an animated vertical checklist:

```text
✓ Upload complete
✓ Audio prepared
● Transcribing conversation
○ Extracting action items
○ Building searchable intelligence
```

Use real processing state, not fake timers.

If error:

```text
Transcription failed
[ Retry ]
```

Show useful error text.

---

# 23. BROWSER RECORDING — BONUS

Only implement after uploaded recordings work.

Use:

- MediaRecorder API
- microphone permission
- elapsed timer
- pause/resume
- stop

Flow:

```text
Record
↓
MediaRecorder chunks
↓
assemble recording
↓
upload as meeting
↓
same processing pipeline
```

Near-live transcription is optional.

Do not build a complex streaming architecture unless core work is finished.

---

# 24. LOCAL GPU FALLBACK

Development machine:

```text
Ryzen 5 5600
32 GB RAM
RX 6700 XT 12 GB
```

Optional local tools:

```text
whisper.cpp + Vulkan
llama.cpp + Vulkan
```

Use these for local testing if cloud AI quotas block development.

Do not make production depend on the developer's PC.

Production must work while the PC is turned off.

---

# 25. ERROR HANDLING

Handle at minimum:

- unsupported file format
- file too large
- upload interrupted
- R2 upload failure
- transcription failure
- invalid AI response
- embedding failure
- unauthorized meeting access
- expired share link
- deleted meeting
- network timeout

Use user-friendly errors.

Never show raw stack traces.

---

# 26. SECURITY

Required:

- RLS in Supabase
- signed/private recording access
- no service-role key in browser
- no AI/API secret in frontend
- validate all route parameters
- validate request bodies with Zod
- sanitize filenames
- enforce MIME/file limits
- rate limit AI question endpoint if practical
- share tokens must be unguessable
- delete associated transcript/insights/storage on meeting deletion

---

# 27. ACCESSIBILITY

Minimum:

- semantic buttons
- labels on inputs
- visible focus states
- keyboard navigation
- sufficient color contrast
- dialogs trap focus
- tooltips are supplemental, not required for understanding
- icon-only buttons have aria-label

---

# 28. RESPONSIVE BEHAVIOR

Desktop:
- side nav
- side-by-side player and intelligence

Tablet:
- collapsed nav
- stacked or 60/40 content

Mobile:
- top header
- player first
- insight tabs
- transcript below
- sticky Ask AI input where useful

Never make transcript text tiny on mobile.

---

# 29. POLISH DETAILS

Implement these if they cost little:

- skeleton loaders
- optimistic meeting title rename
- copy-to-clipboard toast
- duration formatting
- relative dates
- file size display
- recent search
- hover/active transcript states
- sticky transcript search bar
- smooth seek behavior
- persistent selected tab
- subtle empty states
- useful page titles and meta tags

Avoid:
- overuse of toasts
- giant modal dialogs
- 8 different border radii
- inconsistent spacing

---

# 30. REVIEWER DATA / DEMO SEEDING

The assessment explicitly says an empty meetings list is insufficient. Seed the deployed reviewer experience with **real usable data** before submission.

Minimum target:

- at least 2 completed meetings visible on first meaningful reviewer/demo use;
- at least 1 real recording processed by Fathom Clone end-to-end;
- include varied durations/topics so list/search/detail UI can be evaluated;
- include a meeting with at least one action item, one decision/key point, one highlight, and a shareable moment.

If any intentionally synthetic fixture is included for UI/load testing, label it clearly as:

```text
Demo / synthetic test meeting
```

Do not present synthetic data as a real customer meeting.

For any real seeded recording/transcript, use content created specifically for the assessment or content you have explicit permission to publish. The deployed demo and public repository must not expose confidential customer/company conversations.

The reviewer must still be able to upload a new file and observe the real processing flow.

Long-call resilience target:

- confirm the architecture can handle roughly a one-hour multi-speaker recording;
- if time/data permits, run a real or legitimately sourced long-form test before submission;
- do not architect transcript rendering, chunking, or search around only 2-minute demos.

---

# 31. README REQUIREMENTS

README must contain:

## Project overview

One paragraph.

## Features

Concise list.

## Architecture

Simple diagram.

## Stack

List services.

## Local setup

Exact commands.

## Environment variables

Example names only.

## Deployment

Cloudflare + Supabase setup.

## Free-tier constraints

State:
- file limits
- AI quotas
- storage quotas
- assessment/demo intent

## Assessment implementation decisions

Mention:
- which reference-product flows were reproduced
- capture/notetaker layer status (implemented, browser-recorded, or intentionally stubbed)
- why upload-first was prioritized
- how moments/clip sharing are implemented without transcoding
- how summary templates work
- how cross-meeting search works

## Tradeoffs

Mention:
- live bot integration intentionally omitted/stubbed if applicable
- manual speaker rename if diarization is not complete
- free-tier AI limitations
- upload-first product focus

## Submission

Include placeholders/fields for:

- live deployment URL
- public repository URL
- walkthrough URL

State that `.agent-logs/` is intentionally committed for assessment review.

## Future improvements

Short list.

---

# 32. ENVIRONMENT VARIABLES

Example:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
```

Names may vary based on implementation.

Never expose private variables to Vite client code.

---

# 33. TESTING

Minimum automated tests:

## Unit

- timestamp formatter
- transcript chunker
- AI JSON parser
- meeting status transitions

## Integration

- auth protected endpoint
- create meeting
- ask AI request validation
- share token lookup

## Manual acceptance

Test:

```text
Chrome desktop
Firefox desktop
mobile viewport
```

Test one:
- video upload

Test one:
- audio upload

Test:
- failed upload
- transcript search
- cross-meeting search
- summary template switching
- timestamp seek
- create highlight/moment
- public clip/moment share in incognito
- full share page in incognito
- seeded reviewer data visible
- delete meeting
- logout/login
- public deployment opened from a browser/session not signed in as the developer

---

# 34. PERFORMANCE

Target:

- dashboard first render < 2 sec on normal broadband
- lazy-load media
- paginate meeting list if needed
- do not fetch entire transcript on dashboard
- avoid rendering thousands of transcript rows unnecessarily
- use virtualization only if transcript performance becomes a real issue

Do not prematurely optimize.

---

# 35. 24-HOUR EXECUTION PLAN — SHOWCASE FIRST

The goal is to have something impressive and submittable **well before hour 24**. Do not leave deployment, seeded data, or walkthrough preparation until the final hour.

## Hour 0–1 — Assessment prerequisites

- Complete the 8x agent capture setup.
- Run the capture test.
- Confirm `.agent-logs/` is being written.
- Commit initial agent logs.
- Create reference-research directory.
- Sanitize and index any supplied Fathom screenshots and demo transcript/summary before the coding agent uses them.
- Start Fathom product walkthrough.

Acceptance:

```text
capture passes
+ .agent-logs/ tracked
+ research started
```

## Hour 1–2.5 — Study only the reference flows that matter

Inspect and document:

- playback against transcript
- summary output
- summary template switching
- action items
- highlight/moment behavior
- search across meetings
- external clip sharing
- capture/calendar behavior only enough to understand it
- annotate screenshots/notes with `OBSERVED`, `INFERRED`, and `FATHOM CLONE DECISION`

Do not spend excessive time reverse-engineering internals.

Acceptance:

```text
short product notes
+ screenshots
+ explicit Fathom Clone priority decisions
```

## Hour 2.5–4 — Deploy the shell immediately

Build:

- React/Vite/TypeScript foundation
- premium Fathom Clone visual system
- Cloudflare deployment
- Supabase schema
- seeded reviewer/demo data path

The deployed app should already open from incognito.

Acceptance:

```text
public URL
+ populated dashboard
+ clean visual shell
```

## Hour 4–7 — Build the flagship meeting experience FIRST

Build:

- media player
- timestamped transcript
- transcript row design
- click timestamp → seek
- active playback/transcript state if practical
- meeting metadata/header

Use seeded real meeting data first so UI work is not blocked by transcription infrastructure.

Acceptance:

```text
open meeting
→ play
→ click transcript
→ seek correctly
```

This is the first major demo checkpoint.

## Hour 7–9 — Summary templates + actions

Build:

- General summary
- Sales / Customer summary
- Recruiting / Interview summary
- action items with source timestamps
- compact key points only if cheap

Acceptance:

```text
template switch visibly changes output
+ action items are useful
+ source timestamps work
```

## Hour 9–11 — Highlights + public clip sharing

Build:

- create highlight from transcript/player
- choose start/end
- persist highlight
- public deep-link share
- share page that opens in incognito
- relevant transcript context

Do not transcode/cut video server-side.

Acceptance:

```text
highlight
→ share
→ open incognito
→ starts at correct moment
```

## Hour 11–13 — Cross-meeting search

Build:

- search titles
- search summaries
- search transcript text
- contextual snippets
- click result → open meeting at relevant timestamp when possible

Acceptance:

```text
search phrase
→ multiple meeting results
→ relevant snippets
→ correct meeting/context
```

At **Hour 13**, Fathom Clone should already demonstrate the assessment's most important product behaviors.

## Hour 13–16 — Real upload/transcription pipeline

Only now deepen the ingestion path:

- R2 signed/direct upload
- processing state
- speech-to-text
- timestamp normalization
- transcript persistence
- analysis trigger

Acceptance:

```text
upload real recording
→ process
→ transcript appears
→ existing meeting UI works
```

If free-tier transcription causes delays, preserve the seeded demo path so the reviewer experience remains reliable.

## Hour 16–18 — Supporting product polish

Implement the highest-value remaining items:

- transcript search
- speaker rename
- full meeting share
- copy summary/transcript
- delete
- retry/error handling
- mobile layout

Skip any item that threatens core stability.

## Hour 18–20 — Visual polish pass

Spend dedicated time on UI.

Audit:

- spacing
- font scale
- contrast
- empty states
- processing states
- hover/focus states
- player layout
- transcript density
- summary hierarchy
- responsive behavior
- brand consistency

Do not add backend features during this block unless fixing a broken P0 flow.

## Hour 20–21 — Optional differentiator

Choose **at most one**:

```text
Ask AI with timestamp citations
OR
browser recording
OR
automatic diarization
```

Default choice: **Ask AI with citations** because it is easy to demonstrate and reinforces evidence-first positioning.

Do not attempt conferencing-bot integration.

## Hour 21–22 — Submission hardening

- Chrome test
- Firefox test
- mobile viewport test
- incognito/public link test
- seed at least 2 useful meetings
- verify one real processed recording
- secret scan
- public repo check
- `.agent-logs/` check
- README/tradeoffs update

## Hour 22–23 — Rehearse walkthrough before recording

Run the exact 5-minute path:

```text
dashboard
→ meeting
→ playback/transcript
→ templates
→ actions
→ highlight
→ external clip
→ cross-meeting search
→ upload/processing
```

Fix only bugs that affect this path.

## Hour 23–24 — Record and submit

- Record camera-on walkthrough, <=5 minutes.
- Use the live deployment, not localhost.
- State clearly that conferencing capture/bot was stubbed if applicable.
- Show public repo and committed `.agent-logs/`.
- Add live URL, repository URL, and walkthrough URL.
- Make only emergency fixes after recording.

---

# 36. MILESTONE CHECKPOINTS — DO NOT ADVANCE IF A SHOWCASE CHECKPOINT FAILS

## Checkpoint 0 — Assessment compliance

```text
8x capture test passes
+ .agent-logs/ generated
+ .agent-logs/ committed
+ reference research documented
```

## Checkpoint A — Public reviewer entry

```text
public URL
→ incognito
→ populated Fathom Clone dashboard
```

No login dead-end.

## Checkpoint B — Flagship playback/transcript

```text
open seeded real meeting
→ play recording
→ click transcript timestamp
→ playback seeks correctly
```

## Checkpoint C — AI output

```text
summary
+ 3 meaningful templates
+ action items
+ source timestamps
```

## Checkpoint D — Moment sharing

```text
create/open highlight
→ public share link
→ incognito visitor
→ correct media timestamp/context
```

## Checkpoint E — Cross-meeting search

```text
search transcript/summary phrase
→ useful multi-meeting results
→ contextual snippets
```

At this checkpoint the assessment showcase is viable.

## Checkpoint F — Real ingestion

```text
upload real media
→ process/transcribe
→ transcript stored
→ same meeting UI works
```

## Checkpoint G — Submission readiness

```text
premium UI
+ seeded data
+ public URL
+ public repo
+ .agent-logs/
+ <=5 minute camera-on walkthrough
```

Only after Checkpoint G is safe should bonus AI/live features be attempted.

---

# 37. UI QUALITY BAR

The reviewer should immediately perceive:

- professional hierarchy
- intentional spacing
- strong typography
- minimal clutter
- polished loading states
- polished empty states
- clean transcript interaction
- obvious information architecture
- premium SaaS quality

A good test:

If the page still looks like stock shadcn components placed in a grid, it is not finished.

Customize:
- spacing
- typography
- card composition
- table/list rows
- tabs
- player framing
- transcript row design
- AI panel hierarchy

Do not customize every primitive unnecessarily.

---

# 38. HOME / LOGIN VISUAL QUALITY

The login page should look premium.

Layout:

```text
┌─────────────────────────┬───────────────────────────────┐
│ Brand/product statement │ Login                         │
│                         │                               │
│ Searchable meetings.    │ Email                         │
│ Decisions, actions,     │ Password                      │
│ and context instantly.  │                               │
│                         │ [ Continue ]                  │
└─────────────────────────┴───────────────────────────────┘
```

On mobile:
- form only
- concise brand message

No giant marketing landing page is required.

---

# 39. MICROCOPY

Use concise language.

Good:

```text
Upload recording
Ask this meeting
Processing transcript…
Copy summary
Share meeting
No meetings yet
```

Avoid:

```text
Unlock the power of AI…
Revolutionize your workflow…
Supercharge productivity…
```

Product should feel credible, not promotional.

---

# 40. AI PROMPT — ANALYSIS

Use a system prompt similar to:

```text
You analyze meeting transcripts.

Return only valid JSON matching the provided schema.

Rules:
- Use only information explicitly supported by the transcript.
- Do not invent names, dates, commitments, or deadlines.
- Action items must represent actual commitments or clearly implied next steps.
- Every key point, decision, action item, risk, and topic must include the best supporting timestamp in seconds.
- Keep summaries concise.
- If an owner is unknown, return null.
- If a due date is unknown, return null.
```

Pass transcript in a structured form preserving timestamps.

---

# 41. AI PROMPT — ASK MEETING

System prompt:

```text
Answer questions using only the supplied meeting transcript excerpts.

Rules:
- Do not use outside knowledge.
- If the answer is not supported by the excerpts, say that the information was not found in this meeting.
- Be concise.
- Return supporting citations with timestamps.
- Do not invent quotes.
```

Expected JSON:

```json
{
  "answer": "...",
  "citations": [
    {
      "timestamp": 767,
      "text": "..."
    }
  ]
}
```

Validate before rendering.

---

# 42. PROCESSING RESILIENCE

A meeting must not become permanently stuck.

Implement:
- processing start timestamp
- failure state
- retry action

If AI analysis fails after transcript succeeds:
- preserve transcript
- show:
  `Transcript complete. AI analysis failed.`
- allow retry analysis

Do not require re-upload.

---

# 43. DELETE FLOW

Delete meeting:

1. confirmation dialog
2. delete transcript chunks
3. delete transcript segments
4. delete insights
5. delete share links
6. delete speakers
7. delete R2 media
8. delete meeting row

If R2 deletion fails:
- log it
- do not expose storage key
- prefer retry/background cleanup if simple

---

# 44. PRODUCT DIFFERENTIATORS

The app should not feel like a simple Fathom imitation.

Emphasize:

1. Upload-first workflow
2. Better transcript navigation
3. Stronger source citations
4. Better AI information hierarchy
5. Cleaner meeting detail page
6. Better search
7. Faster scanability
8. More transparent processing state
9. Faster, clearer summary-template switching
10. Evidence-linked highlights and zero-transcode clip sharing

Optional differentiator:

```text
"Evidence-first AI"
```

Every decision/action/answer should link back to source timestamps.

---

# 45. FINAL SUBMISSION CHECKLIST — ORDERED BY IMPORTANCE

## Submission blockers

```text
[ ] 8x agent capture test passed before implementation
[ ] .agent-logs/ exists and was committed incrementally
[ ] Fathom reference-flow notes/screenshots exist and are sanitized
[ ] any real demo recording/transcript is permissioned and safe for public exposure
[ ] prompts/logs contain no secrets or private meeting content
[ ] public HTTPS URL works
[ ] live URL works in incognito/clean browser
[ ] public repository works
[ ] repository contains .agent-logs/
[ ] seeded real meeting data is visible immediately
[ ] walkthrough is <=5 minutes
[ ] camera is on in walkthrough
[ ] live URL, repo URL, walkthrough URL are ready
```

## Must-show product flows

```text
[ ] recording playback works
[ ] timestamped transcript is visible
[ ] transcript timestamp seeks player correctly
[ ] AI summary works
[ ] 3 summary templates work and differ meaningfully
[ ] action items are visible
[ ] highlight/moment works
[ ] external clip/moment share works in incognito
[ ] cross-meeting search works with useful snippets
[ ] UI looks polished on desktop
[ ] critical mobile layout works
```

## Strong supporting flows

```text
[ ] real video/audio upload works
[ ] real transcription works
[ ] processing state is understandable
[ ] transcript search works
[ ] speaker rename works, if implemented
[ ] full meeting share works
[ ] errors/retry states are readable
[ ] secrets are not committed
[ ] production build passes
```

## Bonus — do not delay submission for these

```text
[ ] Ask AI works
[ ] Ask AI citations seek player
[ ] browser recording works
[ ] automatic diarization works
[ ] cross-meeting conversational AI works
```

---

# 45A. WALKTHROUGH SCRIPT — MAXIMUM 5 MINUTES

Camera must be on. Use the **live deployed app**, not localhost.

The walkthrough should focus almost entirely on visible product quality.

```text
0:00–0:15  Fathom Clone: one-sentence positioning + disclose upload-first/stubbed bot choice
0:15–0:35  Populated dashboard with real seeded meetings
0:35–1:20  Open meeting: playback + polished transcript + timestamp seeking
1:20–1:55  Switch summary templates + show action items
1:55–2:35  Create/open highlight + generate public clip/moment share
2:35–2:55  Open shared moment as an external/incognito viewer
2:55–3:30  Search across meetings and open a contextual result
3:30–4:10  Show real upload/processing/transcription flow
4:10–4:35  Show responsive/polished UI and one useful error/processing state
4:35–4:50  Optional: Ask AI with timestamp citation, only if implemented well
4:50–5:00  Public repo + .agent-logs/ + explicit tradeoff statement
```

Do not spend walkthrough time on:

- database schema
- infrastructure diagrams
- environment variables
- unfinished features
- long explanations of libraries
- features that cannot be demonstrated reliably

---

# 46. FINAL AGENT INSTRUCTION

Build for the **5-minute reviewer experience**, not for feature count.

The primary product journey is:

```text
Open public Fathom Clone deployment
→ immediately see useful meetings
→ open a real meeting
→ play recording
→ navigate transcript by timestamp
→ switch summary template
→ inspect action items
→ highlight a moment
→ share that moment publicly
→ search across meetings
```

Then, if time remains:

```text
upload a new recording
→ real transcription
→ transcript appears
→ optional Ask AI citation
```

The priority formula is:

```text
assessment compliance
+ flawless flagship meeting page
+ explicit Fathom-parity showcase flows
+ premium UI/UX
+ reliable public sharing
+ public deployment
```

Do **not** let Ask AI, diarization, live transcription, authentication complexity, or conferencing-bot work delay the must-show flows.

A smaller app that demonstrates the assessment-critical flows beautifully is better than a wider clone with unfinished features.

Execute this specification **milestone by milestone**. After each milestone, prove the acceptance criteria with actual checks before moving on. When asked to work from screenshots or a transcript, inspect those artifacts first, cite the relevant local paths in your work notes, and distinguish observed Fathom behavior from Fathom Clone design choices.
