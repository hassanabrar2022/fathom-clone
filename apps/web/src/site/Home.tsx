import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Compass,
  FileAudio,
  Lock,
  Rocket,
  Satellite,
  Search,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import { SiteLayout, Starfield, useReveal } from './SiteLayout';
import {
  MockActions,
  MockCall,
  MockMoments,
  MockSummary,
  MockTranscript,
} from './Mockups';
import { featureSlides, roleCards } from './content';

const icons = { rocket: Rocket, compass: Compass, satellite: Satellite, users: Users };

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
      <div className="site-container home-hero-grid">
        <div className="home-hero-copy">
          <h1>
            <Typewriter text="AI notetaking that keeps you in the moment" />
          </h1>
          <p>
            Fathom Clone summarizes your meetings so you can focus on the
            conversation. <strong>Just upload the recording.</strong>
          </p>
          <Link to="/signup" className="site-pill site-pill-cyan site-pill-lg">
            Get started – free forever
          </Link>
          <div className="home-trust">
            <Lock size={12} /> Private by default <i>|</i> Revocable share
            links <i>|</i> Delete anytime
          </div>
        </div>
        <div className="home-collage" aria-hidden="true">
          <div className="capsule capsule-menu">
            <div className="capsule-menu-card">
              <span>Recording</span>
              <b>
                <FileAudio size={11} /> Video &amp; audio
              </b>
              <b className="is-on">
                <AudioLines size={11} /> Audio only
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
              {Array.from({ length: 28 }, (_, index) => (
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
      </div>
      <div className="site-container home-proof">
        <div className="home-proof-label">
          Upload recordings
          <br />
          from any platform
        </div>
        {['Zoom', 'Google Meet', 'Microsoft Teams', 'Loom', 'Voice memos', 'Webex'].map(
          (name) => (
            <span key={name} className="home-proof-chip">
              {name}
            </span>
          ),
        )}
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

function CaptureCarousel() {
  const [active, setActive] = useState(0);
  const total = featureSlides.length;
  useEffect(() => {
    const timer = window.setInterval(
      () => setActive((value) => (value + 1) % total),
      6000,
    );
    return () => window.clearInterval(timer);
  }, [active, total]);
  return (
    <section className="home-capture">
      <div className="home-capture-intro site-container">
        <p>
          Capture notes your way – <strong>any recording</strong> – so you can
          stay focused on the meeting
        </p>
        <p className="is-faint">
          {featureSlides[active].title}.{' '}
          <span>{featureSlides[active].body}</span>
        </p>
      </div>
      <div className="home-capture-track">
        <div
          className="home-capture-slides"
          style={{ transform: `translateX(calc(${-active} * (min(860px, 78vw) + 32px)))` }}
        >
          {featureSlides.map((slide, index) => (
            <div
              key={slide.key}
              className={`home-capture-slide ${index === active ? 'is-active' : ''}`}
              aria-hidden={index !== active}
            >
              <MockCall />
              {slideVisuals[slide.key]}
            </div>
          ))}
        </div>
      </div>
      <div className="home-capture-controls">
        <button
          type="button"
          aria-label="Previous feature"
          onClick={() => setActive((active - 1 + total) % total)}
        >
          <ArrowLeft size={16} />
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
          aria-label="Next feature"
          onClick={() => setActive((active + 1) % total)}
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}

function Marquee() {
  const item = (
    <span className="marquee-item">
      Move <em>work</em> forward faster
      <span className="marquee-ship" aria-hidden="true">
        <Rocket size={46} />
      </span>
    </span>
  );
  return (
    <section className="home-marquee site-dark" aria-label="Move work forward faster">
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
            'Fathom Clone gives teams a shared source of truth across every customer conversation, internal sync, and strategy call – so decisions are visible, follow-through is consistent, and nothing gets lost.',
            'Search conversations, share the moments that matter, and keep work moving without the manual notes.',
          ],
          items: [
            [Zap, 'Automatic transcripts, summaries, and action items reduce follow-up admin.'],
            [Rocket, 'Turn conversations into clear next steps with owners and timing.'],
            [FileAudio, 'Keep decisions and commitments searchable across every meeting.'],
            [Sparkles, 'Share a full meeting or a single moment with a revocable link.'],
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
            [Search, 'Search every meeting you have ever uploaded.'],
            [Lock, 'Private to your account until you choose to share.'],
          ],
        };
  return (
    <section className="home-teams site-dark">
      <Starfield />
      <div className="site-container">
        <h2 className="site-h2 home-teams-title">
          Whether you’re a team of 1 or 1,000, Fathom Clone’s got your back
        </h2>
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
              <Link to="/pricing" className="site-pill site-pill-cyan site-pill-sm">
                See our pricing
              </Link>
            </div>
            <div className="home-teams-items">
              {content.items.map(([Icon, text]) => (
                <div key={text as string}>
                  <Icon size={20} />
                  <p>{text as string}</p>
                </div>
              ))}
            </div>
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
    body: 'Accurate transcripts, instant summaries, and action items with consistent quality across every call.',
    visual: <MockSummary />,
  },
  {
    title: 'Momentum',
    kicker: 'From conversation to next step',
    body: 'Every commitment is captured with its owner and timing, and links back to the moment it was made.',
    visual: <MockActions />,
  },
  {
    title: 'Ease',
    kicker: 'Nothing to install, nothing to invite',
    body: 'Upload a recording from any platform. No bot joins your call, and nothing changes for the people you meet with.',
    visual: <MockTranscript />,
  },
];

function Pillars() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting)
            setActive(Number((entry.target as HTMLElement).dataset.index));
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    refs.current.forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, []);
  return (
    <section className="home-pillars site-dark">
      <Starfield />
      <div className="site-container home-pillars-grid">
        <div className="home-pillars-copy">
          {pillars.map((pillar, index) => (
            <div
              key={pillar.title}
              ref={(element) => {
                refs.current[index] = element;
              }}
              data-index={index}
              className={`home-pillar ${index === active ? 'is-active' : ''}`}
            >
              <h3>{pillar.title}</h3>
              <span className="site-kicker">✦ {pillar.kicker}</span>
              <p>{pillar.body}</p>
              <Link to="/signup" className="site-pill site-pill-cyan site-pill-sm">
                Get started. It’s free.
              </Link>
            </div>
          ))}
        </div>
        <div className="home-pillars-visual">
          <div className="home-pillars-backdrop" />
          <div className="home-pillars-circle">
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

function Stats() {
  const [ref, visible] = useReveal<HTMLDivElement>();
  const stats = [
    ['3 views', 'of every meeting: General, Sales, and Recruiting', 'tone-orange'],
    ['1 click', 'from any summary point back to the moment it was said', 'tone-pink'],
    ['60 sec', 'moments you can share with a revocable link', 'tone-blue'],
  ];
  return (
    <section className="home-stats">
      <div className="site-container">
        <h2 className="site-h2 is-dark">
          Fathom Clone teams
          <br />
          work smarter
        </h2>
        <div ref={ref} className={`home-stats-row ${visible ? 'is-visible' : ''}`}>
          {stats.map(([value, label, tone], index) => (
            <div
              key={value}
              className="home-stat"
              style={{ transitionDelay: `${index * 180}ms` }}
            >
              <div className={`home-stat-bubble ${tone}`}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
              <div className={`home-stat-beam ${tone}`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RevealLine({ children }: { children: React.ReactNode }) {
  const [ref, visible] = useReveal<HTMLParagraphElement>();
  return (
    <p ref={ref} className={`home-statement ${visible ? 'is-visible' : ''}`}>
      {children}
    </p>
  );
}

function Unstoppable() {
  return (
    <section className="home-unstoppable site-dark">
      <Starfield />
      <div className="site-container">
        <span className="site-kicker is-center">✦ Better meetings. Better results.</span>
        <h2 className="site-h2">
          Make your team
          <br />
          unstoppable
        </h2>
        <div className="home-app-shot" aria-hidden="true">
          <div className="home-app-shot-bar">
            <span />
            <span />
            <span />
            <b>Quarterly planning · Oct 1</b>
          </div>
          <div className="home-app-shot-body">
            <MockSummary />
            <div className="home-app-shot-side">
              <MockCall />
              <MockActions />
            </div>
          </div>
        </div>
        <RevealLine>
          Accurate meeting notes, call summaries, and{' '}
          <em className="grad-cyan">action items mean your team stays aligned</em>{' '}
          on every conversation.
        </RevealLine>
        <RevealLine>
          Every summary point and action item{' '}
          <em className="grad-violet">links back to the exact moment</em> it was
          said, so nobody has to take anyone’s word for it.
        </RevealLine>
        <RevealLine>
          Saved moments and shared meetings{' '}
          <em className="grad-orange">put the right context in front of your team</em>,
          without another meeting about the meeting.
        </RevealLine>
        <div className="site-center">
          <Link to="/signup" className="site-pill site-pill-cyan site-pill-sm">
            Try Fathom Clone for your team
          </Link>
        </div>
      </div>
    </section>
  );
}

function Orbit() {
  const platforms = ['Zoom', 'Google Meet', 'Microsoft Teams', 'Loom', 'Webex', 'Voice memos'];
  return (
    <section className="home-orbit site-dark">
      <Starfield />
      <div className="site-container">
        <span className="site-kicker is-center">✦ No bot. No install. No invite.</span>
        <h2 className="site-h2">Works with any recording</h2>
        <div className="orbit" aria-hidden="true">
          <div className="orbit-grid" />
          <div className="orbit-core">
            <AudioLines size={34} />
          </div>
          {platforms.map((name, index) => (
            <span key={name} className={`orbit-chip orbit-chip-${index}`}>
              {name}
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
    track.current?.scrollBy({ left: direction * 340, behavior: 'smooth' });
  return (
    <section className="home-roles site-dark">
      <Starfield />
      <div className="site-container">
        <span className="site-kicker is-center">
          ✦ Every team works better with accurate notes
        </span>
        <h2 className="site-h2">Every team in flow</h2>
        <div className="site-center">
          <Link to="/signup" className="site-pill site-pill-cyan site-pill-sm">
            Get started. It’s free.
          </Link>
        </div>
        <div className="home-roles-arrows">
          <button type="button" aria-label="Previous team" onClick={() => scroll(-1)}>
            <ArrowLeft size={15} />
          </button>
          <button type="button" aria-label="Next team" onClick={() => scroll(1)}>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
      <div className="home-roles-track" ref={track}>
        {roleCards.map((role) => {
          const Icon = icons[role.icon];
          return (
            <article key={role.title} className="home-role">
              <span className="home-role-spark">✦</span>
              <h3>{role.title}</h3>
              <p>{role.body}</p>
              <div className="home-role-art">
                <Icon size={92} strokeWidth={1} />
              </div>
              <Link to={role.link} className="site-pill site-pill-violet site-pill-sm">
                See Fathom Clone for {role.title.split(' ')[0].toLowerCase()}
              </Link>
            </article>
          );
        })}
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
        <span className="site-kicker is-dark">✦ Free forever for individuals</span>
        <h2 className="site-h2">{title}</h2>
        <Link to="/signup" className="site-pill site-pill-yellow site-pill-sm">
          Get started. It’s free.
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
