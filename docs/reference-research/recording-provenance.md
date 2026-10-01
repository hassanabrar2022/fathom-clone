# Recorded demo provenance — Checkpoint B

The user supplied `Test call - Sep 13 2026.mp4` in the local reference folder in
direct response to a request for a recording approved for public demo use.
The raw source remains ignored. It is a Fathom onboarding demonstration, not a
Fathom Clone customer conversation or evidence of Fathom Clone live-bot functionality.

## Observed

- Source media: 1280 × 720 MP4, duration 103.8 seconds.
- Local Firefox decoded the video. Frames sampled at 3, 30, 60, 90, 98, and
  103 seconds showed the presenter, then a participant avatar; name labels were
  visible in the bottom strip. The supplied transcript also included an email
  address and source-sharing links.
- The supplied transcript contains two original speaker anchors: 2.7 and 97.17
  seconds. It does not supply verified timestamps for each individual paragraph.

## Fathom Clone decisions

- Retain both source anchors and format each turn into readable paragraphs.
  Do not invent word-level or paragraph-level alignment.
- Use neutral labels (Presenter / Participant). Remove email, personal names,
  private links, and the inserted AI action annotation from the public transcript.
  Spoken reference-product names remain in the genuine transcript.
- Prepare a derivative at 960 × 540 with the bottom 30 pixels masked for the
  full duration (equivalent to the source's bottom 40 pixels). Preserve audio.
- Browser canvas capture with Firefox MediaRecorder produced VP8 + Opus WebM;
  stream-copy remux with FFmpeg 7 / libavformat 61 added duration and seek indexing.
  First derivative duration: 103.827 seconds. Audio track: Opus, 48 kHz, mono.
- Production network tests exposed buffering with that ~10 MB initial derivative.
  The final file is ~3.4 MB, encoded to 640 × 360 / 24 fps, 220 kbps target VP8,
  with a maximum 48-frame keyframe interval and the WebM index moved to the front.
  Audio is copied unchanged. The scaled privacy mask covers the bottom 20 pixels.
  The distinct optimized filename avoids stale cached versions.
- Poster is a PNG extracted from the sanitized video at 10 seconds. The first
  and final participant views were visually checked after redaction.
- Public assets live under `apps/web/public/media/`; the imported transcript lives
  under `apps/web/public/recordings/`. No raw source or private reference link is
  shipped. App source and build scans found no reference email/name/link matches.

## Limits

This is an imported reference transcript with a real, sanitized recording.
It does not satisfy the later requirement for a recording transcribed end-to-end
by Fathom Clone. There are only two verified turn timestamps; finer alignment awaits
the real transcription checkpoint. No long-meeting or diarization claim is made.

The temporary FFmpeg package download was canceled because it was slow. The
already-installed Playwright FFmpeg could remux WebM and extract PNG frames,
but could not decode MP4; local browser decoding supplied that step.
