#!/usr/bin/env node
// Appends the verbatim prompt and the final response of every turn to
// .agent-logs/<timestamp>_<session-id>.md.
//
// Wired to the UserPromptSubmit and Stop hook events in .claude/settings.json,
// so it fires on its own in every session in this repo. Nothing in between a
// prompt and its final response is recorded: no thinking, no tool calls, no
// intermediate text.
//
// Usage (from the hook): node capture.mjs prompt | response   (hook JSON on stdin)

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MODE = process.argv[2];
const AUTHOR = 'hassanabrar2022';
const PROJECT = 'fathom-clone';
const TOOL = 'claude-code';

function main() {
  if (MODE !== 'prompt' && MODE !== 'response') {
    throw new Error(
      `expected "prompt" or "response", got ${JSON.stringify(MODE)}`,
    );
  }
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const sessionId = input.session_id;
  if (!sessionId) return;

  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const dir = join(root, '.agent-logs');
  mkdirSync(dir, { recursive: true });

  // The Stop event hands over the final response directly. The transcript's
  // last line is not reliably flushed by the time this fires, so reading the
  // response from the file would lose it (and did -- see CAPTURE-TEST.md).
  const text =
    MODE === 'prompt'
      ? typeof input.prompt === 'string'
        ? input.prompt
        : ''
      : typeof input.last_assistant_message === 'string' &&
          input.last_assistant_message.trim()
        ? input.last_assistant_message
        : finalResponse(readTranscript(input.transcript_path));
  // An empty turn (an interrupt before any text) leaves no entry rather than a
  // blank one.
  if (!text.trim()) return;

  const timestamp = new Date().toISOString();
  const file = join(dir, logFileName(dir, sessionId, timestamp));
  const body = existingBody(file);
  const model = resolveModel(
    input.transcript_path,
    MODE === 'response' ? text : null,
    body,
  );
  const entry = renderEntry({
    type: MODE === 'prompt' ? 'PROMPT' : 'RESPONSE',
    // A response carries the number of the prompt it answers.
    num: countPrompts(body) + (MODE === 'prompt' ? 1 : 0),
    session: sessionId.slice(0, 8),
    timestamp,
    model,
    text,
  });
  const next = body + entry;
  writeFileSync(file, renderFile(sessionId, next, model), 'utf8');
}

// --- transcript -------------------------------------------------------------

function readTranscript(path) {
  if (!path) return [];
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return [];
  }
  const entries = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      // Subagent transcripts are a different conversation; they are not this
      // session's prompts and responses.
      if (!entry.isSidechain) entries.push(entry);
    } catch {
      // A half-written final line is normal while the session is live.
    }
  }
  return entries;
}

// The last thing the assistant actually said, which is the final response for
// the turn. Thinking blocks and tool calls are not text blocks, so they drop
// out here.
function finalResponse(transcript) {
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    const entry = transcript[i];
    if (entry.type !== 'assistant') continue;
    const text = textBlocks(entry.message?.content);
    if (text.trim()) return text;
  }
  return '';
}

// The hook payloads carry no model name, so it comes from the transcript. On a
// Stop the entry for this turn may still be in flight, so wait briefly for the
// entry whose text matches the response we were handed -- that one's model is
// the model that actually answered, which is what makes a switch mid-build
// visible.
function resolveModel(transcriptPath, responseText, body) {
  const deadline = Date.now() + 1000;
  for (;;) {
    const transcript = readTranscript(transcriptPath);
    if (responseText) {
      const model = modelForText(transcript, responseText);
      if (model) return model;
    } else {
      const model = latestModel(transcript);
      if (model !== 'unknown') return model;
    }
    if (Date.now() >= deadline) break;
    sleep(100);
  }
  // Nothing has been flushed yet. A model already recorded for this session is
  // better than nothing; the first prompt of a session has neither.
  return (
    newestRecordedModel(body) ?? latestModel(readTranscript(transcriptPath))
  );
}

function modelForText(transcript, text) {
  const wanted = text.trim();
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    const entry = transcript[i];
    if (entry.type !== 'assistant') continue;
    const blocks = textBlocks(entry.message?.content).trim();
    if (!blocks) continue;
    return blocks === wanted ? (entry.message?.model ?? 'unknown') : null;
  }
  return null;
}

function newestRecordedModel(body) {
  const models = [...body.matchAll(/^model: (\S+)$/gm)]
    .map((match) => match[1])
    .filter((model) => model !== 'unknown');
  return models.at(-1) ?? null;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function textBlocks(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n\n');
}

// The model that answered most recently. On the very first prompt of a session
// nothing has answered yet, so the prompt entry reads "unknown" and the
// response entry that follows it carries the real name.
function latestModel(transcript) {
  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    const model = transcript[i]?.message?.model;
    if (typeof model === 'string' && model) return model;
  }
  return 'unknown';
}

// --- log file ---------------------------------------------------------------

// One file per session. The name keeps the time of the session's first entry,
// so an existing file for this session wins over a fresh name.
function logFileName(dir, sessionId, timestamp) {
  const suffix = `_${sessionId}.md`;
  const existing = readdirSync(dir).find((name) => name.endsWith(suffix));
  if (existing) return existing;
  return `${timestamp.slice(0, 19).replace('T', '_').replaceAll(':', '-')}${suffix}`;
}

const BODY_START = '[LOG_ENTRY ';

// Entries are only ever appended. The frontmatter and header are derived from
// them, so nothing already written is rewritten.
function existingBody(file) {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return '';
  }
  const start = raw.indexOf(BODY_START);
  return start === -1 ? '' : raw.slice(start);
}

function renderEntry({ type, num, session, timestamp, model, text }) {
  return (
    `[LOG_ENTRY type=${type} num=${num} session=${session}]\n` +
    `timestamp: ${timestamp}\n` +
    `model: ${model}\n` +
    `\n${text.replace(/\s+$/, '')}\n\n\n`
  );
}

function promptTimes(body) {
  const pattern =
    /^\[LOG_ENTRY type=PROMPT num=\d+ session=\S+\]\ntimestamp: (\S+)$/gm;
  return [...body.matchAll(pattern)].map((match) => match[1]);
}

function countPrompts(body) {
  return promptTimes(body).length;
}

function renderFile(sessionId, body, fallbackModel) {
  const times = promptTimes(body);
  const first = times[0] ?? '';
  const last = times.at(-1) ?? '';
  // The frontmatter names the newest model seen, so a switch mid-build shows up
  // here as well as on the entries themselves.
  const model = newestRecordedModel(body) ?? fallbackModel;
  const date = first.slice(0, 10);
  return (
    `---\n` +
    `session_id: ${sessionId}\n` +
    `date: ${date}\n` +
    `author: ${AUTHOR}\n` +
    `model: ${model}\n` +
    `tool: ${TOOL}\n` +
    `project: ${PROJECT}\n` +
    `total_exchanges: ${times.length}\n` +
    `first_prompt_time: ${first}\n` +
    `last_prompt_time: ${last}\n` +
    `---\n\n` +
    `# Session Log - ${date}\n\n` +
    `Session: \`${sessionId.slice(0, 8)}\` | Project: \`${PROJECT}\` | ` +
    `Author: \`${AUTHOR}\`\n\n---\n\n` +
    body
  );
}

// A hook that crashes must never block the session, so everything is wrapped
// and every failure goes to stderr.
try {
  main();
} catch (error) {
  process.stderr.write(`[capture] ${error?.stack || error}\n`);
}
