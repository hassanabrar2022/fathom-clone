# Reference research — 13 September 2026

All six supplied PNG screenshots and both Markdown exports in the local
`fathom-ui-and-meeting-summary/` directory were inspected before implementation.
Raw assets are excluded from Git: they contain account identity, a participant
image, and recording links. A recording was supplied later in direct response to
the request for public-demo media; only its sanitized derivative is published.
No screenshots are republished.

| Local screenshot (timestamp suffix) | OBSERVED | Interaction / edge case | FATHOM CLONE DECISION | Do not copy |
| --- | --- | --- | --- | --- |
| 17-24-30 | Player above summary; actions beside it; action owner and source time | Summary and actions remain separate; copy/share controls visible | Give actions clear source links and preserve context beside media | Branding, dark/cyan palette, personal identity |
| 17-24-37 | Transcript tab, speaker label, paragraph blocks, search field, copy button | Hovered paragraph exposes plus and overflow controls | Readable timestamped rows, explicit save-moment control | Narrow bubble layout and exact wording |
| 17-24-44 | Meeting question field and suggested prompts | Screenshot shows initial state, not an answered question | Defer Ask AI until showcase is safe | Proprietary name and suggested questions |
| 17-25-44 | Template menu with general, sales, customer and interview choices | Selected template indicated; menu scrolls | Three distinct cached summary structures | Named sales methodologies and menu copy |
| 17-25-52 | Summary template customization tooltip | Gear is adjacent to active template | Defer advanced customization | Exact affordance placement |
| 17-25-56 | Customization dialog with text input and regeneration control | Character count visible; no generated result evidenced | Avoid live regeneration dependency for demo templates | Dialog styling and helper text |

## Text reference findings

OBSERVED: `test-call-transcript.md` contains speaker/time anchors and a marked
action with a playback source. `test-call-summary.md` organizes purpose,
takeaways, topics, next steps, and action items; output links to source times.
The content is a product onboarding demonstration rather than a customer meeting.

INFERRED: Source links likely seek playback. Screenshots and exported links alone
do not establish playback synchronization, persistence, or share authorization.

FATHOM CLONE DECISION: Keep summary claims tied to transcript evidence. The supplied
summary export provides the best available 0:02, 0:14, 0:33, 0:50, 1:04, and
1:14 source anchors; the transcript provides the final 1:37 speaker anchor. Do not
invent sales commitments or recruiting conclusions when a template does not apply.
Use three cached structures and disclose that no live model generated them.

## Evidence gaps (not represented as completed research)

Calendar connection, live capture, external clip playback, saved highlights,
cross-meeting search results and a one-hour /
eight-speaker recording were not directly exercised in supplied evidence.
Only the capture workflow described in the transcript is observed as a statement;
it is not independent verification. No Fathom login or interaction was performed.

## Implementation order

0. Verify capture and incrementally commit safe research and logs.
A. Deploy populated reviewer entry; synthetic fixtures clearly labeled.
B. Permissioned recording, transcript, actual seeking and playback.
C. Three summary templates and sourced actions.
D. Persist moments; externally usable bounded playback links.
E. Search title, summary, and transcript with contextual results.
F. Real ingestion after the showcase works.
G. Cross-browser, mobile, secrets, deployment, repository and walkthrough checks.

No bot, calendar, authentication, vector database, or Ask AI work before showcase.
