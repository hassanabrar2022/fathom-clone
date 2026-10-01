# Demo walkthrough

A five-minute, camera-on walkthrough of the live app, in the order the brief
lists things. Each step says what to click and what to say.

- Live app: https://fathom-clone.hassanabrar2022.workers.dev
- Code: https://github.com/hassanabrar2022/fathom-clone
- Demo sign-in: `demo@fathomclone.app` / `fathom-clone-demo-2026` — eight
  seeded meetings, including the 62 minute eight-speaker call

---

## Before you hit record (do this 30 minutes ahead)

1. **Use desktop Chrome.** Browser recording does not work in Safari or Firefox.
2. **Sign in** to the live app with your own account.
3. **Have one finished meeting ready.** Processing takes a minute or two, and
   you don't want viewers watching a progress bar. Record a 2–3 minute Meet
   call with yourself ahead of time (steps in part 3), talk about something
   concrete ("ship the pilot Friday, Grace sends release notes"), and add one
   highlight while you talk.
4. **The long, many-speaker meeting is already seeded.** "Q4 roadmap review" is
   62 minutes with eight named speakers, 60 transcript segments, nine action
   items, and three moments. Use it for part 9 rather than recording one. Its
   audio is silence of the right length, so scrub and click timestamps rather
   than playing it with sound up.
5. **Open a Google Meet** in a second tab (meet.new) so it's ready to record.
6. **Open an Incognito window** for the share-link step, so viewers see that
   someone who wasn't on the call can open it.
7. Close other tabs and notifications. Turn on the camera.

---

## The script (about 5 minutes)

### 1. Intro (0:00–0:20)

> "This is a Fathom-style meeting notetaker. It gets a call recorded, then
> gives you a transcript, AI notes in three templates, action items linked to
> the moment they were said, highlights you can share, and search across every
> meeting. It's live on Cloudflare Workers with Supabase."

Show: the dashboard (**Meetings**). Point at **Live and upcoming calls** and
the meeting library.

### 2. Connect a calendar (0:20–0:45)

Click **Record** in the sidebar and scroll to **Calendar**.

- If Google Calendar is set up: show your upcoming meetings, the **Notetaker
  on/off** switch on each, and **Auto-record meetings with a video link**.
- If it isn't: say so in one line.

> "Calendar connects with read-only Google OAuth. Tokens are encrypted at rest.
> Each meeting with a Meet, Zoom, or Teams link gets a notetaker switch, and
> auto-record sends the notetaker to every call on its own."

### 3. Get the notetaker into a real meeting (0:45–1:45)

This is where you say what you stubbed. Be direct:

> "The brief said the recording bot could be faked. The bot integration is
> built for Recall.ai — it joins the call, records, and names every speaker —
> but Recall needs a work email, so for this demo I'm using the fallback I
> built: recording from the browser. It captures the meeting tab's audio plus
> my microphone, and uploads two-minute pieces during the call, so a crash
> mid-call doesn't lose the recording."

Show it live:

1. On **Record**, paste your Meet link, click **Record from this browser**.
2. On the live page, click **Start recording**, choose the **Meet tab**, and
   keep **Share tab audio** on.
3. Talk for 20–30 seconds in the Meet.

### 4. Highlight a moment mid-call (1:45–2:10)

While recording, type a note (e.g. "pricing decision") and click
**Highlight**.

> "Highlighting during the call saves the half minute before the click, because
> by the time you realise something mattered, it's already been said. It lands
> as a saved clip on the finished meeting."

Click **Stop and save**.

> "Processing takes a minute, so let me open one I recorded earlier."

Go to **Meetings** and open your prepared meeting.

### 5. Playback against the transcript (2:10–2:40)

- Press play; the transcript **follows playback** and highlights the line
  being spoken.
- Click a **timestamp** in the transcript; playback jumps there.
- Show **Find in transcript**, **Copy**, and **Download .txt**.
- Rename the speaker (pencil icon next to the name).

### 6. AI summary, templates, action items (2:40–3:15)

- Read the **General** summary for a second.
- Switch to **Sales / Customer**, then **Recruiting / Interview**.

> "Same meeting, three lenses. When a template doesn't fit — no customer on
> the call — it says what evidence is missing instead of inventing it."

- Under **Action items**, click the timestamp on one; it jumps to where it was
  said.

> "Every summary point and action item cites the second it came from, so you
> can check it."

### 7. Where the highlight landed and sharing a clip (3:15–3:45)

- Open **Moments** on the meeting: your mid-call highlight is there.
- Click **Share** on the moment and copy the link.
- Paste it into the **Incognito window**: it opens with no sign-in.

> "Someone who wasn't on the call gets just that clip and its transcript.
> Links can be revoked at any time."

### 8. Search across meetings (3:45–4:05)

Back on **Meetings**, search a phrase that was said (e.g. "release notes").
Click the result; it opens the meeting **at that moment**.

### 9. The eight-person, one-hour call (4:05–4:40)

Open **Q4 roadmap review** from the seeded library.

> "This is the case that matters. An hour with eight people breaks the naive
> approach. Here's what I did:
> - Recording is uploaded in pieces during the call, so length doesn't depend
>   on one huge upload, and calls can run up to four hours.
> - The bot path gets each participant's own audio from Recall, so every
>   speaker is named.
> - An hour of transcript is too long for the model in one go, so it's
>   condensed in windows first, keeping every timestamp, then the summaries are
>   written from those notes.
> - Everything runs in durable background workflows, so closing the tab or a
>   failed step doesn't lose work; each step retries and resumes."

### 10. Trade-offs and what's next (4:40–5:00)

> "What I'd do next: turn on the Recall bot with a real account, add
> per-speaker separation for browser recordings, and use a larger model for
> sharper action-item owners."

---

## Things to say plainly (don't let a reviewer find them first)

- **Capture is stubbed** with browser recording. The Recall.ai bot is built and
  tested against a mock, not a real call.
- **The seeded library's audio is silence** of the correct length, so playback,
  transcript following, and timestamp links work but there is nothing to hear.
  The transcripts and summaries are real written content. Say this when you open
  the Q4 roadmap review.
- **Browser recordings have one speaker label** ("Speaker", renameable). Only
  the bot path names each participant.
- **The AI model is small** (Cloudflare's free tier). It can get an action-item
  owner wrong; every item cites its source time so you can check.
- **Calendar changes after scheduling** (a moved meeting) aren't followed
  automatically.
- **Uploads** are capped at 25 MB / 10 minutes; recorded calls go up to 4
  hours.

## If something goes wrong while filming

| Problem | What to do |
|---|---|
| "No meeting audio was shared" | Start again and tick **Share tab audio** in Chrome's picker. |
| Microphone blocked | Allow the mic in Chrome's address bar; the tab audio still records without it. |
| Processing is slow | Cut to the meeting you prepared earlier; that's why it exists. |
| Sign-up email doesn't arrive | Supabase's built-in email is rate-limited; use the account you already signed in with. |
| Anything else | Say what happened, move to the prepared meeting, keep going. |
