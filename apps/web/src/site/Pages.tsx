import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  Compass,
  FileAudio,
  FileVideo,
  Link2,
  Lock,
  Minus,
  Rocket,
  Satellite,
  Search,
  Sparkles,
  Timer,
  Trash2,
  Users,
} from 'lucide-react';
import { SiteLayout, Starfield } from './SiteLayout';
import { CtaBand } from './Home';
import { MockActions, MockCall, MockMoments, MockSummary, MockTranscript } from './Mockups';
import { plans, planRows, solutions } from './content';
import './home.css';
import './pages.css';

const icons = { rocket: Rocket, compass: Compass, satellite: Satellite, users: Users };

function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Fathom Clone`;
  }, [title]);
}

function Faq({ items }: { items: [string, string][] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="page-faq">
      {items.map(([question, answer], index) => (
        <div key={question} className={`page-faq-item ${open === index ? 'is-open' : ''}`}>
          <button
            type="button"
            aria-expanded={open === index}
            onClick={() => setOpen(open === index ? null : index)}
          >
            {question}
            <ChevronDown size={18} />
          </button>
          {open === index && <p>{answer}</p>}
        </div>
      ))}
    </div>
  );
}

const faqs: [string, string][] = [
  [
    'Does Fathom Clone join my meetings?',
    'No. There is no bot and nothing to install. Record your meeting the way you already do — in Zoom, Google Meet, Teams, or on your phone — then upload the file.',
  ],
  [
    'What files can I upload?',
    'MP4, MOV, WebM, MP3, WAV, and M4A recordings up to 25 MB and 10 minutes each.',
  ],
  [
    'How long does processing take?',
    'Usually a minute or two. Processing runs in the background, so you can close the tab and come back.',
  ],
  [
    'Who can see my recordings?',
    'Only you. Recordings are private to your account until you create a share link for a meeting or a moment, and any link can be revoked.',
  ],
  [
    'Does it identify speakers?',
    'Transcripts use a single speaker label that you can rename. Automatic speaker separation is not available yet.',
  ],
  [
    'Is Fathom Clone free?',
    'Yes. The individual plan is free, with no credit card required.',
  ],
  [
    'Can I delete my data?',
    'Yes. Delete any meeting at any time, or delete your account from Settings to permanently remove every recording, transcript, and link.',
  ],
];

export function OverviewPage() {
  usePageTitle('Overview');
  const [mode, setMode] = useState(0);
  const modes = [
    {
      title: 'Audio only',
      badge: 'SMALLEST FILES',
      body: 'Upload an MP3, M4A, or WAV. Perfect for phone calls, voice memos, or when you only need the conversation.',
      icon: FileAudio,
    },
    {
      title: 'Audio + video',
      badge: 'MOST POPULAR',
      body: 'Upload the MP4, MOV, or WebM from your meeting platform. Play it back beside the transcript.',
      icon: FileVideo,
    },
    {
      title: 'Longer recordings',
      badge: 'AUTOMATIC',
      body: 'Recordings over two minutes are prepared in your browser and transcribed in parts, with timestamps kept accurate end to end.',
      icon: Timer,
    },
  ];
  const features = [
    {
      title: 'Instant AI summaries for every recording',
      body: 'Summaries, takeaways, and action items in three perspectives: General, Sales / Customer, and Recruiting / Interview.',
      visual: <MockSummary />,
    },
    {
      title: 'Transcription built for real conversations',
      body: 'Every line is timestamped. Click to jump to that moment, search inside the transcript, copy a passage, or download it all.',
      visual: <MockTranscript />,
    },
    {
      title: 'Action items you can verify',
      body: 'Only real commitments become action items, each with its owner, timing, and a link to the moment it was made.',
      visual: <MockActions />,
    },
  ];
  return (
    <SiteLayout>
      <section className="overview-hero site-dark">
        <Starfield />
        <div className="overview-planet" aria-hidden="true" />
        <div className="site-container page-hero">
          <h1>
            Meeting intelligence <strong>built around you</strong>
          </h1>
          <p>
            Upload a recording, uncover what mattered, and share the exact
            moment with your team. Fathom Clone turns meetings into momentum in
            minutes.
          </p>
          <Link to="/signup" className="site-pill site-pill-yellow">
            Get started. It’s free.
          </Link>
          <div className="overview-badges">
            <span>
              <Lock size={13} /> Private by default
            </span>
            <span>
              <Link2 size={13} /> Revocable links
            </span>
            <span>
              <Trash2 size={13} /> Delete anytime
            </span>
          </div>
        </div>
      </section>

      <section className="overview-features">
        <div className="site-container">
          <h2 className="site-h2">
            Never miss <strong>what matters</strong>
          </h2>
          {features.map((feature, index) => (
            <div key={feature.title} className={`overview-feature ${index % 2 ? 'is-flipped' : ''}`}>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </div>
              <div className="overview-feature-visual">{feature.visual}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="page-section site-dark">
        <Starfield />
        <div className="site-container">
          <h2 className="site-h2">Capture on your terms</h2>
          <p className="page-lede">
            Audio or video, short or long: upload whatever you recorded and get
            the same transcript, summaries, and action items.
          </p>
          <div className="overview-modes">
            <div className="overview-mode-list">
              {modes.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  className={index === mode ? 'is-active' : ''}
                  onClick={() => setMode(index)}
                >
                  <span>
                    {item.title} <em>{item.badge}</em>
                  </span>
                  {index === mode && <p>{item.body}</p>}
                </button>
              ))}
            </div>
            <div className="overview-mode-visual">
              <MockCall />
              <MockSummary compact />
            </div>
          </div>
        </div>
      </section>

      <section className="page-section site-dark">
        <Starfield />
        <div className="site-container">
          <h2 className="site-h2">Stay fully present in every meeting</h2>
          <div className="page-grid-3 page-gap-top">
            {[
              [Search, 'Search everything', 'Find any phrase across every transcript and summary you have uploaded.'],
              [Sparkles, 'Three summary views', 'Read the same call as a general recap, a sales conversation, or an interview.'],
              [Link2, 'Share the moment', 'Send a 60-second moment or the full meeting with a link you control.'],
            ].map(([Icon, title, body]) => {
              const I = Icon as typeof Search;
              return (
                <div key={title as string} className="page-card">
                  <I size={24} />
                  <h3>{title as string}</h3>
                  <p>{body as string}</p>
                </div>
              );
            })}
          </div>
          <div className="page-moments-shot">
            <MockMoments />
          </div>
        </div>
      </section>

      <section className="page-section site-dark">
        <Starfield />
        <div className="site-container">
          <h2 className="site-h2">FAQs</h2>
          <Faq items={faqs} />
        </div>
      </section>
      <CtaBand />
    </SiteLayout>
  );
}

export function PricingPage() {
  usePageTitle('Pricing');
  return (
    <SiteLayout>
      <section className="page-section site-dark pricing-top">
        <Starfield />
        <div className="site-container">
          <h1 className="pricing-title">
            Pricing to <strong>supercharge every meeting</strong>
          </h1>
          <div className="pricing-free-bar">
            <strong>Free plan</strong>
            <span>Unlimited meetings, AI summaries, action items, moments, and sharing.</span>
            <Link to="/signup">Sign up. Free forever. →</Link>
          </div>
          <div className="pricing-cards">
            {plans.map((plan) => (
              <article key={plan.name} className={`pricing-card tone-${plan.tone}`}>
                <span className="pricing-for">{plan.audience}</span>
                <h2>{plan.name}</h2>
                <div className="pricing-price">
                  {plan.price ? (
                    <>
                      <strong>{plan.price}</strong>
                      <span>{plan.priceNote}</span>
                    </>
                  ) : (
                    <strong className="is-text">{plan.priceNote}</strong>
                  )}
                </div>
                {plan.available ? (
                  <Link to="/signup" className="site-pill site-pill-yellow pricing-cta">
                    {plan.cta}
                  </Link>
                ) : (
                  <span className="site-pill site-pill-outline pricing-cta" aria-disabled="true">
                    {plan.cta}
                  </span>
                )}
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={14} /> {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="page-section site-dark">
        <Starfield />
        <div className="site-container">
          <span className="site-kicker is-center">✦ Compare plans</span>
          <h2 className="site-h2">Meet your AI meeting partner</h2>
          <div className="pricing-table" role="table">
            <div className="pricing-row is-head" role="row">
              <span role="columnheader" />
              {plans.map((plan) => (
                <span key={plan.name} role="columnheader" className={`tone-${plan.tone}`}>
                  {plan.name}
                </span>
              ))}
            </div>
            {planRows.map(([label, ...values]) => (
              <div key={label as string} className="pricing-row" role="row">
                <span role="rowheader">{label}</span>
                {values.map((value, index) => (
                  <span key={index} role="cell" className={`tone-${plans[index].tone}`}>
                    {value === true ? (
                      <Check size={16} aria-label="Included" />
                    ) : value === false ? (
                      <Minus size={16} aria-label="Not included" />
                    ) : (
                      value
                    )}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
      <CtaBand />
    </SiteLayout>
  );
}

export function SolutionPage() {
  const { slug } = useParams();
  const solution = solutions.find((item) => item.slug === slug);
  usePageTitle(solution ? `For ${solution.short}` : 'Solutions');
  if (!solution) return <Navigate to="/" replace />;
  const Icon = icons[solution.icon];
  return (
    <SiteLayout>
      <section className="site-dark solution-hero">
        <Starfield />
        <div className="site-container solution-hero-grid">
          <div>
            <span className="site-kicker">✦ Fathom Clone for {solution.short}</span>
            <h1>{solution.tagline}</h1>
            <p>{solution.intro}</p>
            <Link to="/signup" className="site-pill site-pill-cyan">
              Get started – free forever
            </Link>
          </div>
          <div className="solution-art" aria-hidden="true">
            <Icon size={140} strokeWidth={0.9} />
          </div>
        </div>
      </section>
      <section className="page-section site-dark">
        <Starfield />
        <div className="site-container">
          <h2 className="site-h2">Built for how {solution.short} works</h2>
          <div className="page-grid-3 page-gap-top">
            {solution.benefits.map((benefit, index) => (
              <div key={benefit.title} className="page-card">
                <span className="solution-step">0{index + 1}</span>
                <h3>{benefit.title}</h3>
                <p>{benefit.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="page-section solution-flow">
        <div className="site-container solution-flow-grid">
          <div>
            <h2 className="site-h2 is-left is-dark">Three steps after every call</h2>
            <ol>
              {solution.workflow.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <MockSummary />
        </div>
      </section>
      <CtaBand />
    </SiteLayout>
  );
}

export function AboutPage() {
  usePageTitle('About us');
  return (
    <SiteLayout>
      <section className="site-dark">
        <Starfield />
        <div className="site-container page-hero">
          <h1>
            We think meetings should <strong>move work forward</strong>
          </h1>
          <p>
            Fathom Clone exists so people can stay present in conversations and
            still keep everything that mattered — with every note tied to the
            moment it came from.
          </p>
        </div>
      </section>
      <section className="page-section site-dark">
        <Starfield />
        <div className="site-container page-grid-3">
          {[
            [Lock, 'Private by default', 'Your recordings belong to you. Nothing is shared until you create a link, and every link can be revoked.'],
            [Search, 'Evidence first', 'Summaries are only useful if you can check them. Every point leads back to the transcript and the recording.'],
            [Trash2, 'Easy to leave', 'Delete a meeting or your whole account at any time, and the data goes with it.'],
          ].map(([Icon, title, body]) => {
            const I = Icon as typeof Lock;
            return (
              <div key={title as string} className="page-card">
                <I size={24} />
                <h3>{title as string}</h3>
                <p>{body as string}</p>
              </div>
            );
          })}
        </div>
      </section>
      <CtaBand />
    </SiteLayout>
  );
}

function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  usePageTitle(title);
  return (
    <SiteLayout>
      <section className="site-dark page-section">
        <Starfield density={0.00005} />
        <div className="site-container">
          <div className="page-hero">
            <h1>{title}</h1>
            <p>Last updated {updated}</p>
          </div>
          <div className="page-prose">{children}</div>
        </div>
      </section>
    </SiteLayout>
  );
}

const legalNote = (
  <p className="page-note">
    This is a starting template that describes how the service works today. Have
    it reviewed by a qualified lawyer and add your company’s legal name, address,
    and contact details before relying on it.
  </p>
);

export function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="October 1, 2026">
      {legalNote}
      <h2>Using the service</h2>
      <p>
        You need an account to upload recordings. You are responsible for
        keeping your password secure and for activity under your account.
      </p>
      <h2>Your content</h2>
      <p>
        You keep ownership of the recordings you upload and the transcripts and
        notes generated from them. You must have permission from everyone
        recorded to upload and process a recording.
      </p>
      <h2>Sharing</h2>
      <p>
        Recordings are private until you create a link. Anyone with a link can
        view what it shares until you revoke it.
      </p>
      <h2>Acceptable use</h2>
      <ul>
        <li>No unlawful recordings or content you do not have rights to.</li>
        <li>No attempts to access other users’ data or disrupt the service.</li>
        <li>No automated use that exceeds the published limits.</li>
      </ul>
      <h2>Limits and availability</h2>
      <p>
        Uploads are limited in size, length, and daily volume. AI-generated
        summaries can contain mistakes; check the cited transcript before acting
        on them.
      </p>
      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time from Settings, which permanently
        removes your recordings and data.
      </p>
    </LegalPage>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 1, 2026">
      {legalNote}
      <h2>What we collect</h2>
      <ul>
        <li>Your email address and a securely hashed password.</li>
        <li>Recordings you upload, and the transcripts, summaries, moments, and speaker names created from them.</li>
        <li>Basic technical logs needed to run and secure the service.</li>
      </ul>
      <h2>How it is processed</h2>
      <p>
        Recordings are stored privately in Cloudflare R2. Transcription and
        summaries are generated with Cloudflare Workers AI. Account and meeting
        data are stored in Supabase.
      </p>
      <h2>Sharing</h2>
      <p>
        We do not sell your data. A meeting or moment is visible to others only
        through a link you create, until you revoke it.
      </p>
      <h2>Cookies</h2>
      <p>
        We use only essential, secure cookies to keep you signed in. No
        advertising or tracking cookies.
      </p>
      <h2>Deletion</h2>
      <p>
        Deleting a meeting removes its recording and data. Deleting your account
        removes everything associated with it.
      </p>
    </LegalPage>
  );
}
