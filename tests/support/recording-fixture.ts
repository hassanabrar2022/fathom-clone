/** A small, valid meeting used by schema, search, and export unit tests. */
import type { Recording } from '../../packages/shared/recording';
import type { Meeting } from '../../packages/shared/meeting';
import type { MeetingSearchDocument } from '../../packages/shared/search';

const view = (
  key: 'general' | 'sales-customer' | 'recruiting-interview',
  label: string,
  overview: string,
) => ({
  key,
  label,
  descriptor: `${label} view`,
  title: `${label} recap`,
  overview,
  sections: [
    {
      title: 'Key points',
      items: [{ text: 'The team agreed to ship the pilot on Friday.', source: 2 }],
    },
    { title: 'Open questions', items: [] },
  ],
});

export const recording: Recording = {
  id: 'meeting-1',
  mediaUrl: '/api/uploads/meeting-1/media',
  duration: 60,
  speakers: [
    { id: 'host', name: 'Host' },
    { id: 'guest', name: 'Guest' },
  ],
  segments: [
    {
      id: 'host-turn',
      speakerId: 'host',
      start: 2,
      end: 30,
      paragraphs: ['Let’s ship the pilot on Friday.'],
    },
    {
      id: 'guest-turn',
      speakerId: 'guest',
      start: 30,
      end: 55,
      paragraphs: ['I will send the revised proposal before then.'],
    },
  ],
  intelligence: {
    provenance: 'generated',
    templates: [
      view('general', 'General', 'A short planning call about the pilot.'),
      view('sales-customer', 'Sales / Customer', 'No customer is present in this call.'),
      view('recruiting-interview', 'Recruiting / Interview', 'No hiring evidence is present.'),
    ],
    actions: [
      {
        id: 'action-1',
        task: 'Send the revised proposal',
        owner: 'Guest',
        timing: 'Before Friday',
        source: 30,
      },
    ],
  },
};

export const meetings: Meeting[] = [
  {
    id: 'pilot-planning',
    title: 'Pilot planning',
    date: '2026-09-29T10:00:00.000Z',
    duration: 60,
    participants: ['Host', 'Guest'],
    summary: 'The team agreed to ship the pilot on Friday.',
  },
  {
    id: 'customer-check-in',
    title: 'Customer check-in',
    date: '2026-09-30T10:00:00.000Z',
    duration: 120,
    participants: ['Taylor'],
    summary: 'Taylor asked for more context on pricing.',
  },
];

export const searchDocuments: MeetingSearchDocument[] = [
  {
    meetingId: 'pilot-planning',
    transcript: [
      { id: 's1', speaker: 'Host', start: 2, text: 'Let’s ship the pilot on Friday.' },
      { id: 's2', speaker: 'Guest', start: 30, text: 'I need more context first.' },
    ],
  },
  {
    meetingId: 'customer-check-in',
    transcript: [
      { id: 's1', speaker: 'Taylor', start: 57, text: 'Could you stop recording now?' },
    ],
  },
];
