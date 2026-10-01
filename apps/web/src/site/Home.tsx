import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  FileAudio,
  Lock,
  Rocket,
  ScanSearch,
  Search,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { SiteLayout, Starfield } from './SiteLayout';
import {
  MockActions,
  MockCall,
  MockMoments,
  MockSummary,
  MockTranscript,
} from './Mockups';
import { Ship, SwirlPlanet, roleArt } from './Art';
import { featureSlides, roleCards } from './content';
import './home.css';

/** 0 when the element's top reaches the viewport top, 1 when its end does. */
function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const element = ref.current;
      if (!element) return;
      const box = element.getBoundingClientRect();
      const travel = box.height - window.innerHeight;
      setProgress(
        travel > 0 ? Math.min(1, Math.max(0, -box.top / travel)) : box.top < 0 ? 1 : 0,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);
  return [ref, progress] as const;
}

function Typewriter({ text }: { text: string }) {
  const [still] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [count, setCount] = useState(still ? text.length : 0);
  useEffect(() => {
    if (still) return;
    const timer = window.setInterval(
      () =>
        setCount((value) => {
          if (value >= text.length) window.clearInterval(timer);
          return Math.min(value + 1, text.length);
        }),
      55,
    );
    return () => window.clearInterval(timer);
  }, [text, still]);
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, count)}
        <span className="site-caret" />
      </span>
    </>
  );
}

function Hero() {
  return (
    <section className="home-hero site-dark">
      <Starfield />
      <div className="site-container">
        <div className="home-hero-copy">
          <h1>
            <Typewriter text="AI notetaking for every recording" />
          </h1>
          <p>
            Fathom Clone summarizes your meetings so you can focus on the
            conversation. <strong>Now from any recording.</strong>
          </p>
          <Link to="/signup" className="site-pill site-pill-cyan">
            Get started - free forever
          </Link>
          <div className="home-trust">
            <Lock size={12} /> Private by default <i>|</i> Revocable links{' '}
            <i>|</i> No bot <i>|</i> Delete anytime
          </div>
        </div>
        <div className="home-collage" aria-hidden="true">
          <div className="capsule capsule-menu">
            <div className="capsule-menu-card">
              <span>Recording</span>
              <b>
                <FileAudio size={11} /> Audio &amp; video
              </b>
              <b className="is-on">
                <AudioLines size={11} /> Audio
              </b>
              <b>
                <Sparkles size={11} /> Transcript + notes
              </b>
            </div>
          </div>
          <div className="capsule capsule-word">
            <Search size={20} /> SEARCH
          </div>
          <div className="capsule capsule-wave">
            <div className="wave-bars">
              {Array.from({ length: 30 }, (_, index) => (
                <span key={index} style={{ animationDelay: `${index * 70}ms` }} />
              ))}
            </div>
          </div>
          <div className="capsule capsule-ask">
            <div className="capsule-ask-box">
              Which follow-ups did I commit to in my meetings this week?
              <span>
                <Search size={11} /> All meetings
                <ArrowRight size={12} />
              </span>
            </div>
          </div>
          <div className="capsule capsule-summary">
            <div className="capsule-summary-card">
              <strong>Project check-in</strong>
              <div className="mini-avatars">
                <i className="tone-1" />
                <i className="tone-2" />
                <i className="tone-3" />
              </div>
              <div className="mini-tabs">
                <span className="is-active">
                  <Sparkles size={10} /> Summary
                </span>
                <span>Transcript</span>
              </div>
            </div>
          </div>
          <div className="capsule capsule-planet">
            <span className="planet" />
          </div>
        </div>
        <div className="home-proof">
          <div className="home-proof-badge">
            <b>✦</b>
            <span>
              Free forever
              <br />
              for individuals
            </span>
          </div>
          <div className="home-proof-label">Upload from any platform</div>
          {['Zoom', 'Google Meet', 'Teams', 'Loom', 'Webex', 'Voice'].map(
            (name) => (
              <span key={name} className="home-proof-chip">
                {name}
              </span>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

const slideVisuals = {
  summary: <MockSummary />,
  transcript: <MockTranscript />,
  actions: <MockActions />,
  moments: <MockMoments />,
};
const slideCaptions = {
  summary: (
    <>
      Capture notes your way – <strong>any recording</strong> –
      <br />
      so you can stay focused on the meeting
    </>
  ),
  transcript: (
    <>
      A transcript that follows along,
      <br />
      line by line
    </>
  ),
  actions: (
    <>
      Action items with owners,
      <br />
      linked to the moment
    </>
  ),
  moments: (
    <>
      Share the moment that matters
      <br />
      with one link
    </>
  ),
};

function CaptureCarousel() {
  const [active, setActive] = useState(0);
  const total = featureSlides.length;
  useEffect(() => {
    const timer = window.setTimeout(
      () => setActive((value) => (value + 1) % total),
      6000,
    );
    return () => window.clearTimeout(timer);
  }, [active, total]);
  return (
    <section className="home-capture site-dark" aria-label="Product tour">
      <Starfield />
      <div className="home-capture-track">
        <div
          className="home-capture-slides"
          style={{ transform: `translateX(${-active * 552}px)` }}
        >
          {featureSlides.map((slide, index) => (
            <div
              key={slide.key}
              className={`home-capture-slide ${index === active ? 'is-active' : ''}`}
              aria-hidden={index !== active}
            >
              <p>{slideCaptions[slide.key]}</p>
              <div className="capture-visual">
                <MockCall />
                {slideVisuals[slide.key]}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="home-capture-controls">
        <button
          type="button"
          aria-label="Previous slide"
          onClick={() => setActive((active - 1 + total) % total)}
        >
          <ArrowLeft size={18} />
        </button>
        {featureSlides.map((slide, index) => (
          <button
            key={slide.key}
            type="button"
            className={`dot ${index === active ? 'is-active' : ''}`}
            aria-label={`Show ${slide.label}`}
            onClick={() => setActive(index)}
          />
        ))}
        <button
          type="button"
          aria-label="Next slide"
          onClick={() => setActive((active + 1) % total)}
        >
          <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}

function Marquee() {
  const item = (
    <span className="marquee-item">
      Move <em>work</em> forward faster
      <Ship className="marquee-ship" />
    </span>
  );
  return (
    <section className="home-marquee site-dark" aria-label="Move work forward faster">
      <Starfield />
      <div className="marquee-track" aria-hidden="true">
        {item}
        {item}
        {item}
        {item}
      </div>
    </section>
  );
}

function TeamsCard() {
  const [tab, setTab] = useState<'teams' | 'individuals'>('teams');
  const content =
    tab === 'teams'
      ? {
          title: (
            <>
              Shared visibility.
              <br />
              Smarter execution.
            </>
          ),
          body: [
            'Fathom Clone gives teams a shared source of truth across every customer conversation, internal sync, and strategy call – so decisions are visible, follow-through is consistent, and nothing gets lost between meetings.',
            'Search conversations, share the moments that matter, and keep work moving without the manual notes.',
          ],
          items: [
            [Zap, 'Automatic transcripts, summaries, and action items reduce follow-up admin.'],
            [Rocket, 'Turn conversations into clear next steps with owners and timing.'],
            [ScanSearch, 'Keep decisions and commitments searchable across every meeting.'],
            [Sparkles, 'Share a full meeting or a single moment with a link you can revoke.'],
          ],
        }
      : {
          title: (
            <>
              Be present.
              <br />
              Remember everything.
            </>
          ),
          body: [
            'Stop splitting your attention between the conversation and your notes. Upload the recording afterwards and get everything back, organized.',
            'Free forever for individuals, with no credit card.',
          ],
          items: [
            [Zap, 'Accurate transcripts with timestamps you can click.'],
            [Target, 'Summaries in three perspectives for the same call.'],
            [Search, 'Search every meeting you have uploaded.'],
            [Lock, 'Private to your account until you choose to share.'],
          ],
        };
  return (
    <section className="home-teams site-dark">
      <Starfield />
      <SwirlPlanet className="home-teams-planet" />
      <div className="site-container">
        <h2 className="site-h2 home-teams-title">
          Whether you’re a team of 1 or 1,000, we’ve got your back
        </h2>
      </div>
      <div className="home-teams-card">
        <div className="home-teams-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'teams'}
            onClick={() => setTab('teams')}
          >
            Fathom Clone for teams
          </button>
          <button
            role="tab"
            aria-selected={tab === 'individuals'}
            onClick={() => setTab('individuals')}
          >
            Fathom Clone for individuals
          </button>
        </div>
        <div className="home-teams-body">
          <div>
            <h3>{content.title}</h3>
            {content.body.map((text) => (
              <p key={text}>{text}</p>
            ))}
            <Link to="/pricing" className="site-pill site-pill-cyan">
              See our pricing
            </Link>
          </div>
          <div className="home-teams-items">
            {content.items.map(([Icon, text]) => {
              const I = Icon as typeof Zap;
              return (
                <div key={text as string}>
                  <I strokeWidth={1.6} />
                  <p>{text as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

const pillars = [
  {
    title: 'Clarity',
    kicker: 'Unforgettable meetings, without the notes',
    tone: '',
    pill: 'site-pill-cyan',
    body: 'Accurate transcripts, instant summaries, and action items with consistent quality across every call – ready the moment processing finishes.',
    visual: <MockSummary />,
  },
  {
    title: 'Momentum',
    kicker: 'From conversation to next step',
    tone: 'is-yellow',
    pill: 'site-pill-yellow',
    body: 'Every commitment is captured with its owner and timing, and links back to the moment it was made – so follow-through never depends on memory.',
    visual: <MockActions />,
  },
  {
    title: 'Ease',
    kicker: 'Works wherever you record',
    tone: 'is-pink',
    pill: 'site-pill-pink',
    body: 'Upload a recording from any platform. No bot joins your call, nothing to install, and nothing changes for the people you meet with.',
    visual: <MockTranscript />,
  },
];

function Pillars() {
  const [ref, progress] = useScrollProgress<HTMLElement>();
  const active = Math.min(pillars.length - 1, Math.floor(progress * pillars.length));
  return (
    <section className="home-pillars site-dark" ref={ref}>
      <Starfield />
      <div className="home-pillars-stage site-container">
        <div className="home-pillars-copy">
          {pillars.map((pillar, index) => (
            <div
              key={pillar.title}
              className={`home-pillar ${index === active ? 'is-active' : ''}`}
            >
              <h3>{pillar.title}</h3>
              <div className="home-pillar-body">
                <div>
                  <span className={`site-kicker ${pillar.tone}`}>✦ {pillar.kicker}</span>
                  <p>{pillar.body}</p>
                  <Link to="/signup" className={`site-pill ${pillar.pill}`}>
                    Get Started. It’s Free.
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="home-pillars-visual" aria-hidden="true">
          <div className="home-pillars-backdrop" />
          <div
            className={`home-pillars-circle is-${pillars[active].title.toLowerCase()}`}
          >
            <span className="ring ring-1" />
            <span className="ring ring-2" />
            <span className="ring ring-3" />
            <div className="home-pillars-panel" key={active}>
              {pillars[active].visual}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const stats = [
  ['3 views', 'of every meeting: General, Sales, and Recruiting', 'tone-orange', 0, 0],
  ['1 click', 'from any summary point back to where it was said', 'tone-pink', 0.08, 118],
  ['60 sec', 'moments you can share with a link you control', 'tone-blue', 0.16, 222],
] as const;

function Stats() {
  const [ref, progress] = useScrollProgress<HTMLElement>();
  return (
    <section className="home-stats" ref={ref}>
      <div className="home-stats-stage">
        <h2 className="site-h2 is-dark">
          Fathom Clone teams
          <br />
          work smarter
        </h2>
        <div className="home-stats-row">
          {stats.map(([value, label, tone, start, lift], index) => {
            const rise = Math.min(1, Math.max(0, (progress - start) / 0.25));
            return (
              <div
                key={value}
                className="home-stat"
                style={
                  {
                    '--rise': rise,
                    '--lift': `${lift}px`,
                    '--beam': `${260 + index * 110}px`,
                  } as React.CSSProperties
                }
              >
                <div className={`home-stat-bubble ${tone}`}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
                <div className={`home-stat-beam ${tone}`} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type Phrase = string | { accent: string; text: string };
const statements: Phrase[][] = [
  [
    'Accurate meeting notes, call summaries, and action items mean your team stays perfectly aligned without the extra overhead – ',
    { accent: 'grad-orange', text: 'even if they couldn’t attend live.' },
  ],
  [
    'Every summary point and action item links back to the exact moment it was said, ',
    { accent: 'grad-violet', text: 'so nobody has to take anyone’s word for it.' },
  ],
  [
    'Saved moments and shared meetings put the right context in front of the right people, ',
    { accent: 'grad-cyan', text: 'without another meeting about the meeting.' },
  ],
];

function words(phrases: Phrase[]) {
  return phrases.flatMap((phrase) => {
    const text = typeof phrase === 'string' ? phrase : phrase.text;
    const accent = typeof phrase === 'string' ? null : phrase.accent;
    return text.split(/(\s+)/).filter(Boolean).map((word) => ({ word, accent }));
  });
}

function Statements() {
  const [ref, progress] = useScrollProgress<HTMLDivElement>();
  const scaled = progress * statements.length;
  const index = Math.min(statements.length - 1, Math.floor(scaled));
  const list = words(statements[index]);
  const lit = Math.ceil(Math.min(1, (scaled - index) * 1.5) * list.length);
  return (
    <div className="home-statements" ref={ref}>
      <div className="home-statements-stage">
        <p key={index} className="home-statement">
          {list.map(({ word, accent }, position) =>
            /^\s+$/.test(word) ? (
              <Fragment key={position}>{word}</Fragment>
            ) : (
              <span
                key={position}
                className={`word ${position < lit ? 'is-lit' : ''}`}
              >
                {accent ? <em className={accent}>{word}</em> : word}
              </span>
            ),
          )}
        </p>
        <Link to="/signup" className="site-pill site-pill-cyan">
          Try Fathom Clone for your team
        </Link>
      </div>
    </div>
  );
}

function Unstoppable() {
  return (
    <section className="home-unstoppable site-dark">
      <Starfield />
      <div className="site-container">
        <span className="site-kicker is-center">
          ✦ Shared understanding. Faster execution. Better results.
        </span>
        <h2 className="site-h2">Make your team unstoppable</h2>
        <div className="home-app-shot" aria-hidden="true">
          <div className="home-app-shot-bar">
            <span />
            <span />
            <span />
            <b>Quarterly planning</b>
          </div>
          <div className="home-app-shot-body">
            <MockSummary />
            <div className="home-app-shot-side">
              <MockCall />
              <MockActions />
            </div>
          </div>
        </div>
        <Statements />
      </div>
    </section>
  );
}

// Positions measured on a 1328x480 stage; the core sits at (664, 240).
const orbitChips = [
  { name: 'Google Meet', x: 356, y: 80, side: 'left', color: '#34a853' },
  { name: 'Zoom', x: 266, y: 240, side: 'left', color: '#2d8cff' },
  { name: 'Voice memos', x: 326, y: 423, side: 'left', color: '#ff3b30' },
  { name: 'Loom', x: 1052, y: 17, side: 'right', color: '#625df5' },
  { name: 'Microsoft Teams', x: 1092, y: 222, side: 'right', color: '#5059c9' },
  { name: 'Webex', x: 999, y: 433, side: 'right', color: '#00bceb' },
] as const;
const core = { x: 664, y: 240, r: 112 };

function Orbit() {
  return (
    <section className="home-orbit site-dark">
      <Starfield />
      <div className="site-container">
        <span className="site-kicker is-center is-yellow">
          ✦ Zero friction, maximum flexibility.
        </span>
        <h2 className="site-h2 is-md">Works with any recording</h2>
        <div className="orbit" aria-hidden="true">
          <div className="orbit-grid" />
          <svg className="orbit-lines" viewBox="0 0 1328 480">
            <path
              d="M454 -10 L874 240 L662 488 Z"
              fill="none"
              stroke="#f55200"
              strokeOpacity="0.7"
              strokeWidth="2"
            />
            {orbitChips.map((chip) => {
              const dx = chip.x - core.x;
              const dy = chip.y - core.y;
              const length = Math.hypot(dx, dy);
              const px = core.x + (dx / length) * core.r;
              const py = core.y + (dy / length) * core.r;
              const ex = chip.x + (chip.side === 'left' ? 70 : -60);
              return (
                <g key={chip.name}>
                  <line x1={ex} y1={chip.y} x2={px} y2={py} stroke="#faf5f5" strokeWidth="1.5" />
                  <circle cx={px} cy={py} r="4" fill="#faf5f5" />
                  <circle cx={ex} cy={chip.y} r="3" fill="#faf5f5" />
                </g>
              );
            })}
          </svg>
          <div className="orbit-core">
            <AudioLines size={84} strokeWidth={2.4} />
          </div>
          {orbitChips.map((chip) => (
            <span
              key={chip.name}
              className="orbit-chip"
              style={{
                left: `${(chip.x / 1328) * 100}%`,
                top: `${(chip.y / 480) * 100}%`,
              }}
            >
              <i style={{ background: chip.color }} />
              {chip.name}
            </span>
          ))}
        </div>
        <p className="home-orbit-copy">
          Fathom Clone adapts to your workflow,
          <br />
          not the other way around.
        </p>
      </div>
    </section>
  );
}

function Roles() {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (direction: number) =>
    track.current?.scrollBy({ left: direction * 512, behavior: 'smooth' });
  return (
    <section className="home-roles site-dark">
      <Starfield />
      <div className="site-container">
        <span className="site-kicker is-center is-yellow">
          ✦ Empower your team’s best work with seriously accurate AI notetaking
        </span>
        <h2 className="site-h2 is-md">Every team in flow</h2>
        <div className="site-center">
          <Link to="/signup" className="site-pill site-pill-cyan">
            Get Started. It’s Free.
          </Link>
        </div>
        <div className="home-roles-arrows">
          <button type="button" aria-label="Previous team" onClick={() => scroll(-1)}>
            <ArrowLeft size={18} />
          </button>
          <button type="button" aria-label="Next team" onClick={() => scroll(1)}>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
      <div className="home-roles-track" ref={track}>
        {roleCards.map((role) => (
          <article key={role.title} className="home-role">
            {roleArt[role.icon]}
            <span className="home-role-spark">✦</span>
            <h3>{role.title}</h3>
            <span className="site-kicker is-pink">✦ {role.kicker}</span>
            <p>{role.body}</p>
            <Link to={role.link} className="site-pill site-pill-violet">
              See Fathom Clone for {role.short}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export function CtaBand({
  title = (
    <>
      Stop searching your notes.
      <br />
      Start today, for free.
    </>
  ),
}: {
  title?: React.ReactNode;
}) {
  return (
    <section className="site-cta-band">
      <div className="site-cta-arcs" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => (
          <span key={index} style={{ ['--i' as string]: index }} />
        ))}
      </div>
      <div className="site-cta-content">
        <span className="site-kicker is-dark">✦ Never take meeting notes again</span>
        <h2 className="site-h2 is-md">{title}</h2>
        <Link to="/signup" className="site-pill site-pill-yellow">
          Get Started. It’s Free.
        </Link>
      </div>
    </section>
  );
}

export function SiteHome() {
  useEffect(() => {
    document.title = 'Fathom Clone – AI meeting notes from any recording';
  }, []);
  return (
    <SiteLayout>
      <Hero />
      <CaptureCarousel />
      <Marquee />
      <TeamsCard />
      <Pillars />
      <Stats />
      <Unstoppable />
      <Orbit />
      <Roles />
      <CtaBand />
    </SiteLayout>
  );
}
