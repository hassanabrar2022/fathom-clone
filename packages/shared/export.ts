import { formatTime } from './meeting';
import type { MeetingIntelligence, Recording } from './recording';

type SummaryTemplate = MeetingIntelligence['templates'][number];

export function summaryText(
  meetingTitle: string,
  template: SummaryTemplate,
  actions: MeetingIntelligence['actions'],
) {
  const sections = template.sections.flatMap((section) => [
    section.title,
    ...(section.items.length
      ? section.items.map(
          (item) => `- ${item.text} [${formatTime(item.source)}]`,
        )
      : ['- No supported findings in this conversation.']),
    '',
  ]);
  const actionLines = actions.length
    ? actions.flatMap((action, index) => [
        `${index + 1}. ${action.task}`,
        `   Owner: ${action.owner ?? 'Not identified'}`,
        `   Timing: ${action.timing ?? 'Not stated'}`,
        `   Source: ${formatTime(action.source)}`,
      ])
    : ['No supported action items were identified.'];
  return [
    meetingTitle,
    `Fathom Clone summary · ${template.label}`,
    '',
    template.title,
    template.overview,
    '',
    ...sections,
    'Action items',
    ...actionLines,
  ]
    .join('\n')
    .trim();
}

export function transcriptText(
  meetingTitle: string,
  segments: Recording['segments'],
  speakers: Recording['speakers'],
) {
  const names = new Map(speakers.map((speaker) => [speaker.id, speaker.name]));
  const turns = segments.map((segment) =>
    [
      `[${formatTime(segment.start)}] ${names.get(segment.speakerId) ?? 'Speaker'}`,
      segment.paragraphs.join('\n\n'),
    ].join('\n'),
  );
  return [meetingTitle, 'Fathom Clone transcript', '', ...turns]
    .join('\n\n')
    .trim();
}

export function transcriptSegmentText(
  segment: Recording['segments'][number],
  speakerName: string,
) {
  return [
    `[${formatTime(segment.start)}] ${speakerName}`,
    segment.paragraphs.join('\n\n'),
  ].join('\n');
}

export function transcriptFilename(meetingTitle: string) {
  const slug = meetingTitle
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
  return `${slug || 'meeting'}-transcript.txt`;
}
