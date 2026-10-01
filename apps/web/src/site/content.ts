export type Solution = {
  slug: string;
  short: string;
  title: string;
  tagline: string;
  intro: string;
  icon: 'rocket' | 'compass' | 'satellite' | 'users';
  cta: string;
  benefits: { title: string; body: string }[];
  workflow: string[];
};

export const solutions: Solution[] = [
  {
    slug: 'sales',
    short: 'sales',
    title: 'Sales',
    tagline: 'Close faster with every detail of the call in reach.',
    intro:
      'Upload a discovery or demo call and get a Sales / Customer summary of needs, objections, and value — with every point linked to where the buyer said it.',
    icon: 'rocket',
    cta: 'See Fathom Clone for sales',
    benefits: [
      {
        title: 'A sales-ready summary',
        body: 'Customer needs, value, objections, and commercial follow-up, organized for the next step of the deal.',
      },
      {
        title: 'Follow-ups you can trust',
        body: 'Action items only include real commitments, each with a timestamp you can replay before you send the email.',
      },
      {
        title: 'Clips for your team',
        body: 'Save the moment a buyer named their budget or blocker and share it with a link — no screen recording needed.',
      },
    ],
    workflow: [
      'Export the call recording from Zoom, Meet, or Teams.',
      'Upload it to Fathom Clone.',
      'Open the Sales / Customer view and send the follow-up.',
    ],
  },
  {
    slug: 'customer-success',
    short: 'customer success',
    title: 'Customer Success',
    tagline: 'Hear every customer clearly, and never lose the thread.',
    intro:
      'Turn onboarding sessions, QBRs, and support calls into searchable notes, so the next person on the account starts with full context.',
    icon: 'compass',
    cta: 'See Fathom Clone for CS',
    benefits: [
      {
        title: 'Search every customer call',
        body: 'Find the call where a customer mentioned renewal, a bug, or a competitor — across every recording at once.',
      },
      {
        title: 'Handoffs without the recap meeting',
        body: 'Share a read-only link to the full meeting with the transcript, summaries, and action items.',
      },
      {
        title: 'Evidence, not memory',
        body: 'Every summary point and action item jumps to the exact moment in the recording.',
      },
    ],
    workflow: [
      'Upload customer calls as they happen.',
      'Save key moments like feature requests or risks.',
      'Search across accounts before the next check-in.',
    ],
  },
  {
    slug: 'marketing',
    short: 'marketing',
    title: 'Marketing',
    tagline: 'Find the voice of the customer in every conversation.',
    intro:
      'Customer interviews and win/loss calls are full of the exact words your messaging needs. Fathom Clone makes them searchable and shareable.',
    icon: 'satellite',
    cta: 'See Fathom Clone for marketing',
    benefits: [
      {
        title: 'Quotes on demand',
        body: 'Search transcripts for the phrases customers actually use, and copy any passage with its speaker and timestamp.',
      },
      {
        title: 'Shareable proof',
        body: 'Send a 60-second moment to your team instead of a long recording.',
      },
      {
        title: 'Three ways to read a call',
        body: 'General, Sales / Customer, and Recruiting / Interview summaries of the same conversation.',
      },
    ],
    workflow: [
      'Upload interviews and research calls.',
      'Search for themes across every transcript.',
      'Share the moments that prove the point.',
    ],
  },
  {
    slug: 'teams',
    short: 'teams',
    title: 'Teams',
    tagline: 'One shared source of truth for every conversation.',
    intro:
      'Decisions, owners, and next steps from every meeting, in one place — so follow-through doesn’t depend on who took notes.',
    icon: 'users',
    cta: 'See Fathom Clone for teams',
    benefits: [
      {
        title: 'Action items with owners',
        body: 'Commitments are pulled from the conversation with their owner and timing, and linked to the moment they were made.',
      },
      {
        title: 'Private by default',
        body: 'Recordings stay private to your account until you create a link — and any link can be revoked.',
      },
      {
        title: 'Everything is searchable',
        body: 'Titles, summaries, speakers, and full transcripts across every meeting you have uploaded.',
      },
    ],
    workflow: [
      'Upload the recording after the meeting.',
      'Review summaries and action items.',
      'Share the meeting or a moment with your team.',
    ],
  },
];

export const roleCards = [
  { title: 'Sales', body: 'Capture needs, objections, and follow-ups from every call.', link: '/solutions/sales', icon: 'rocket' },
  { title: 'Customer Success', body: 'Keep every account’s context searchable for the whole team.', link: '/solutions/customer-success', icon: 'compass' },
  { title: 'Marketing', body: 'Pull the exact customer words your messaging needs.', link: '/solutions/marketing', icon: 'satellite' },
  { title: 'Operations', body: 'Turn decisions into owned, timestamped action items.', link: '/solutions/teams', icon: 'users' },
  { title: 'HR & Talent', body: 'Use the Recruiting / Interview view to compare candidates fairly.', link: '/solutions/teams', icon: 'compass' },
  { title: 'Product & Engineering', body: 'Search research calls and share the moment a user hit friction.', link: '/solutions/marketing', icon: 'satellite' },
] as const;

export const featureSlides = [
  {
    key: 'summary',
    label: 'Summary',
    title: 'Summaries in three perspectives',
    body: 'General, Sales / Customer, and Recruiting / Interview views of the same call.',
  },
  {
    key: 'transcript',
    label: 'Transcript',
    title: 'A transcript that follows along',
    body: 'Timestamped turns highlight as the recording plays. Click any line to jump there.',
  },
  {
    key: 'actions',
    label: 'Action items',
    title: 'Action items with receipts',
    body: 'Every commitment links to the moment it was made, with owner and timing.',
  },
  {
    key: 'moments',
    label: 'Moments',
    title: 'Moments worth sharing',
    body: 'Save up to 60 seconds of a meeting and share it with a link you can revoke.',
  },
] as const;

/**
 * Plans shown on the pricing page. Only the free plan exists today; the others
 * are placeholders until billing is added — edit names, prices, and features here.
 */
export const plans = [
  {
    name: 'Free',
    audience: 'FOR INDIVIDUALS',
    price: '$0',
    priceNote: 'forever',
    cta: 'Get started',
    available: true,
    tone: 'yellow',
    features: [
      'Unlimited meetings (25 uploads a day)',
      'Transcripts with clickable timestamps',
      'Three AI summary views',
      'Action items linked to their source',
      'Moments and revocable share links',
      'Search across every meeting',
    ],
  },
  {
    name: 'Pro',
    audience: 'FOR POWER USERS',
    price: '',
    priceNote: 'Coming soon',
    cta: 'Coming soon',
    available: false,
    tone: 'orange',
    features: [
      'Everything in Free',
      'Longer and larger recordings',
      'Speaker identification',
      'Custom summary templates',
    ],
  },
  {
    name: 'Team',
    audience: 'FOR TEAMS',
    price: '',
    priceNote: 'Coming soon',
    cta: 'Coming soon',
    available: false,
    tone: 'violet',
    features: [
      'Everything in Pro',
      'Shared team workspace',
      'Team folders and permissions',
      'Admin controls',
    ],
  },
] as const;

export const planRows: [string, ...(boolean | string)[]][] = [
  ['Upload audio and video recordings', true, true, true],
  ['Timestamped transcript', true, true, true],
  ['General, Sales, and Recruiting summaries', true, true, true],
  ['Action items with owners and sources', true, true, true],
  ['Saved moments', true, true, true],
  ['Share links for meetings and moments', true, true, true],
  ['Search across meetings', true, true, true],
  ['Maximum recording length', '10 min', 'Planned', 'Planned'],
  ['Speaker identification', false, 'Planned', 'Planned'],
  ['Custom summary templates', false, 'Planned', 'Planned'],
  ['Shared team workspace', false, false, 'Planned'],
];
