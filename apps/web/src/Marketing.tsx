import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Bookmark,
  Check,
  ChevronDown,
  FileAudio,
  ListChecks,
  Menu,
  Play,
  Search,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import './marketing-next.css';
import './editorial.css';
import './marketing-polish.css';
import './marketing-motion.css';
import './marketing-scroll.css';

const chapters = [
  { id: 'top', label: 'Introduction' },
  { id: 'product', label: 'The workflow' },
  { id: 'playback', label: 'Playback' },
  { id: 'summaries', label: 'Summaries' },
  { id: 'evidence', label: 'Source evidence' },
  { id: 'search', label: 'Search' },
  { id: 'moments', label: 'Moments' },
  { id: 'use-cases', label: 'Use cases' },
  { id: 'how-it-works', label: 'Getting started' },
  { id: 'faq', label: 'Questions' },
  { id: 'start', label: 'Start free' },
] as const;

const waveform = [
  18, 30, 16, 43, 66, 38, 25, 56, 75, 47, 24, 40, 65, 82, 58, 35, 68, 51, 25,
  45, 72, 38, 20, 55, 74, 46, 28, 61, 39, 17, 32, 52, 25, 14,
];
const moments = [
  {
    time: '08:12',
    line: 'We should make the onboarding steps easier to find.',
    speaker: 'Maya',
    point: 18,
  },
  {
    time: '12:47',
    line: 'I’ll send the revised proposal by Friday.',
    speaker: 'Sarah',
    point: 42,
  },
  {
    time: '18:42',
    line: 'Let’s review the customer feedback together next week.',
    speaker: 'Jordan',
    point: 70,
  },
];
const perspectives = [
  {
    key: 'General',
    eyebrow: 'MEETING RECAP',
    title: 'A clear picture of what happened.',
    body: 'The team reviewed onboarding friction, confirmed the proposal needs revision, and agreed to review customer feedback together next week.',
    detail: 'Next step · Send a revised proposal by Friday.',
  },
  {
    key: 'Sales / Customer',
    eyebrow: 'CUSTOMER VIEW',
    title: 'The commitment and the context.',
    body: 'The proposal requires a revision before the customer can evaluate the next step. The conversation also surfaced onboarding clarity as a concern.',
    detail: 'Follow-up · Share the revised proposal by Friday.',
  },
  {
    key: 'Recruiting / Interview',
    eyebrow: 'INTERVIEW VIEW',
    title: 'The discussion, organized for review.',
    body: 'The conversation included how the team approaches onboarding, feedback reviews, and follow-through on commitments.',
    detail: 'Review note · Revisit the responses at their source timestamps.',
  },
] as const;
const searches = [
  {
    meeting: 'Customer conversation',
    time: '08:12',
    text: 'We should make the onboarding steps easier to find.',
  },
  {
    meeting: 'Product planning',
    time: '14:08',
    text: 'The revised proposal should explain onboarding more clearly.',
  },
  {
    meeting: 'Weekly review',
    time: '22:36',
    text: 'Let’s bring customer feedback into next week’s planning.',
  },
];
const useCases = [
  {
    title: 'Customer calls',
    kicker: 'KEEP THE CUSTOMER’S WORDS',
    heading: 'Understand the request without losing the context.',
    body: 'Find the concern, read the surrounding exchange, and bring the right follow-up into the next conversation.',
    tags: [
      'Searchable transcript',
      'Source-linked actions',
      'Shareable moments',
    ],
  },
  {
    title: 'Sales conversations',
    kicker: 'SEE THE NEXT STEP',
    heading: 'Keep commitments connected to what was said.',
    body: 'Switch to the customer summary view, review objections in the transcript, and return to the exact point behind each action.',
    tags: ['Customer summary', 'Action items', 'Evidence timestamps'],
  },
  {
    title: 'Interviews',
    kicker: 'REVISIT THE RESPONSE',
    heading: 'Review the answer, not just a note about it.',
    body: 'Use the interview-oriented summary to organize the conversation, then go back to the timestamped response for nuance.',
    tags: ['Interview summary', 'Timestamped transcript', 'Playback'],
  },
  {
    title: 'Team planning',
    kicker: 'MAKE DECISIONS FINDABLE',
    heading: 'Carry the useful part into the work ahead.',
    body: 'Search previous discussions, keep important moments, and share the precise context a teammate needs.',
    tags: ['Cross-meeting search', 'Highlights', 'Sharing'],
  },
] as const;
const faqs = [
  {
    question: 'What does Fathom Clone do with a recording?',
    answer:
      'Fathom Clone processes a supported meeting file into a timestamped transcript, three summary views, and action items linked to source moments. You can review the result in the same workspace.',
  },
  {
    question: 'Which files can I upload?',
    answer:
      'The current upload flow accepts MP4, MOV, WebM, MP3, M4A, and WAV files. The current limit is 25 MB and 10 minutes per recording.',
  },
  {
    question: 'Can I jump from a summary back to the meeting?',
    answer:
      'Yes. Source timestamps in Fathom Clone take you to the relevant point in the recording and transcript, so you can check the surrounding context.',
  },
  {
    question: 'Can I search across meetings?',
    answer:
      'Yes. Search finds relevant meeting titles, summaries, and transcript passages across the meetings in your workspace.',
  },
  {
    question: 'Can I share just one moment?',
    answer:
      'Yes. Save a highlight and create a focused public link for that moment. Fathom Clone also supports sharing a full meeting when you choose to.',
  },
  {
    question: 'What are the three summary views?',
    answer:
      'General, Sales / Customer, and Recruiting / Interview. They organize the same conversation for different review needs; they do not change the original transcript.',
  },
  {
    question: 'Do I need a credit card to start?',
    answer:
      'No. Fathom Clone is free to use in this assessment experience, and account creation does not ask for payment details.',
  },
];

function Brand() {
  return (
    <Link className="marketing-brand" to="/" aria-label="Fathom Clone home">
      <span className="marketing-brand-mark">
        <AudioLines size={20} strokeWidth={2.2} />
      </span>
      <span>
        fathom<sup>clone</sup>
      </span>
    </Link>
  );
}

function Navigation() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  const close = () => setOpen(false);
  return (
    <header className={`marketing-nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="marketing-container marketing-nav-inner">
        <Brand />
        <nav
          className={`marketing-nav-links ${open ? 'is-open' : ''}`}
          aria-label="Marketing navigation"
        >
          <a href="#product" onClick={close}>
            Product
          </a>
          <a href="#evidence" onClick={close}>
            Why Fathom Clone
          </a>
          <a href="#use-cases" onClick={close}>
            Use cases
          </a>
          <a href="#how-it-works" onClick={close}>
            How it works
          </a>
          <div className="marketing-mobile-actions">
            <Link to="/login" onClick={close}>
              Sign in
            </Link>
            <Link
              className="marketing-button primary"
              to="/signup"
              onClick={close}
            >
              Get started free <ArrowRight size={16} />
            </Link>
          </div>
        </nav>
        <div className="marketing-nav-actions">
          <ThemeToggle />
          <Link to="/login">Sign in</Link>
          <Link className="marketing-button primary" to="/signup">
            Get started free <ArrowRight size={16} />
          </Link>
        </div>
        <ThemeToggle className="marketing-theme-mobile" />
        <button
          className="marketing-menu-toggle"
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
    </header>
  );
}

function SectionRail() {
  const [active, setActive] = useState(0);
  const rail = useRef<HTMLElement>(null);

  useEffect(() => {
    const targets = chapters.map(({ id }) => document.getElementById(id));
    let frame: number | undefined;
    const update = () => {
      frame = undefined;
      const marker = window.innerHeight * 0.38;
      let next = 0;
      targets.forEach((target, index) => {
        if (target && target.getBoundingClientRect().top <= marker)
          next = index;
      });
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 3
      )
        next = chapters.length - 1;
      setActive((current) => (current === next ? current : next));
      const scrollable = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      rail.current?.style.setProperty(
        '--rail-progress',
        String(Math.min(1, window.scrollY / scrollable)),
      );
    };
    const schedule = () => {
      if (frame === undefined) frame = window.requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <nav
      className="marketing-section-rail"
      aria-label="Explore the page"
      ref={rail}
    >
      <span className="section-rail-heading" aria-hidden="true">
        EXPLORE / {String(active + 1).padStart(2, '0')}
      </span>
      <div className="section-rail-list" data-lenis-prevent-wheel>
        <span className="section-rail-track" aria-hidden="true" />
        {chapters.map(({ id, label }, index) => (
          <a
            key={id}
            href={`#${id}`}
            className={active === index ? 'is-active' : undefined}
            aria-label={`${String(index + 1).padStart(2, '0')}. ${label}`}
            aria-current={active === index ? 'location' : undefined}
          >
            <span className="section-rail-number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="section-rail-label" aria-hidden="true">
              {label}
            </span>
          </a>
        ))}
      </div>
      <span className="section-rail-end" aria-hidden="true">
        FATHOM CLONE / AI
      </span>
    </nav>
  );
}

function Waveform({ active = false }: { active?: boolean }) {
  return (
    <div
      className={`source-waveform ${active ? 'is-active' : ''}`}
      aria-hidden="true"
    >
      {waveform.map((height, index) => (
        <i
          key={index}
          style={{ height: `${height}%`, animationDelay: `${index * 28}ms` }}
        />
      ))}
    </div>
  );
}

function useVisibleCycle() {
  const ref = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (
      !ref.current ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting && timer === undefined)
          timer = window.setInterval(
            () => setPhase((value) => (value + 1) % 4),
            1900,
          );
        else if (!entry.isIntersecting && timer !== undefined) {
          window.clearInterval(timer);
          timer = undefined;
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, []);
  return { ref, phase, visible };
}

function useIllustrationCycle(count: number, initial: number, delay: number) {
  const ref = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState(initial);
  const [interacted, setInteracted] = useState(false);
  useEffect(() => {
    if (
      interacted ||
      !ref.current ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    let inView = false;
    let timer: number | undefined;
    const sync = () => {
      if (inView && !document.hidden && timer === undefined)
        timer = window.setInterval(
          () => setSelected((value) => (value + 1) % count),
          delay,
        );
      else if ((!inView || document.hidden) && timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        sync();
      },
      { threshold: 0.2 },
    );
    observer.observe(ref.current);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [count, delay, interacted]);
  const choose = (index: number) => {
    setInteracted(true);
    setSelected(index);
  };
  return { ref, selected, choose, interacted };
}

function HeroArt() {
  const { ref, phase, visible } = useVisibleCycle();
  return (
    <section
      className="hero-workflow"
      ref={ref}
      data-phase={phase}
      data-playing={visible}
      aria-label="Illustration of a Fathom Clone meeting becoming sourced intelligence"
    >
      <div className="hero-workflow-head">
        <span>MEETING / CUSTOMER CONVERSATION</span>
        <span>24:08</span>
      </div>
      <div className="hero-workflow-content">
        <div className="hero-workflow-label">
          <span className="art-live-dot" /> SOURCE THREAD · ILLUSTRATIVE
        </div>
        <div className="hero-workflow-steps">
          <div className="hero-workflow-step">
            <span className="step-node">
              <Check size={12} />
            </span>
            <span>Recording uploaded</span>
            <small>00:00</small>
          </div>
          <div className="hero-workflow-step">
            <span className="step-node">
              <Check size={12} />
            </span>
            <span>Words aligned to time</span>
            <small>12:47</small>
          </div>
          <div className="hero-workflow-step">
            <span className="step-node">
              <Check size={12} />
            </span>
            <span>Summary organized</span>
            <small>READY</small>
          </div>
          <div className="hero-workflow-step">
            <span className="step-node">
              <Check size={12} />
            </span>
            <span>Next step linked to source</span>
            <small>12:47 ↗</small>
          </div>
        </div>
        <div className="hero-workflow-source">
          <span>AT THE SOURCE · 12:47</span>
          <p>“I’ll send the revised proposal by Friday.”</p>
          <strong>
            Action · Send the revised proposal <ArrowUpRight size={13} />
          </strong>
        </div>
      </div>
      <div className="hero-workflow-foot">
        <span>
          <span className="art-live-dot" /> SOURCE PRESERVED
        </span>
        <span>TRANSCRIPT → INTELLIGENCE → ACTION</span>
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section className="marketing-hero" id="top">
      <div className="marketing-container hero-grid">
        <div className="marketing-hero-copy">
          <span className="marketing-eyebrow">
            <i /> MEETING INTELLIGENCE, WITH THE SOURCE ATTACHED
          </span>
          <h1>
            <span>Every meeting</span> <span>leaves something</span>{' '}
            <span>worth keeping.</span>
          </h1>
          <p>
            Upload a conversation. Fathom Clone brings back a searchable transcript,
            focused summaries, and next steps you can trace to the exact moment
            they were said.
          </p>
          <div className="marketing-hero-actions">
            <Link className="marketing-button primary large" to="/signup">
              Get started free <ArrowRight size={18} />
            </Link>
            <a className="marketing-button subtle large" href="#product">
              See how it works <ArrowDown size={17} />
            </a>
          </div>
          <div className="hero-note">
            <span className="hero-note-line" />
            <span>No bot in the call. Start with a recording.</span>
          </div>
        </div>
        <HeroArt />
      </div>
      <div className="marketing-container hero-index">
        <span>CONVERSATIONS, MADE USEFUL</span>
        <span>
          SCROLL TO EXPLORE <ArrowDown size={14} />
        </span>
      </div>
    </section>
  );
}

function CapabilityStrip() {
  return (
    <div className="capability-strip">
      <div className="marketing-container">
        <span>UPLOAD A RECORDING</span>
        <span>TIMESTAMPED WORDS</span>
        <span>THREE SUMMARY VIEWS</span>
        <span>SOURCE-LINKED ACTIONS</span>
        <span>SHAREABLE MOMENTS</span>
      </div>
    </div>
  );
}

function Opening() {
  return (
    <section className="opening-section marketing-section">
      <div className="marketing-container opening-grid">
        <div>
          <span className="marketing-eyebrow">
            <i /> THE PROBLEM
          </span>
          <h2>
            Most meetings
            <br />
            end twice.
          </h2>
        </div>
        <div className="opening-copy">
          <p>
            Once when the call stops. Again when everyone tries to remember what
            was decided, who promised what, and where that detail came from.
          </p>
          <div className="opening-thread">
            <span>“I think we covered that…”</span>
            <i />
            <strong>Find the original moment.</strong>
          </div>
          <p>
            Fathom Clone keeps the recording, the words, and the useful next steps
            connected. You can move from an answer back to its source instead of
            trusting a detached note.
          </p>
        </div>
      </div>
    </section>
  );
}

const stages = [
  {
    label: 'Recording',
    title: 'Bring the conversation.',
    body: 'Upload a supported audio or video recording. Fathom Clone gives the meeting a place in your workspace.',
    icon: UploadCloud,
  },
  {
    label: 'Transcript',
    title: 'Read what was said.',
    body: 'Follow timestamped passages and move directly between the words and their position in the recording.',
    icon: FileAudio,
  },
  {
    label: 'Intelligence',
    title: 'Understand the shape of it.',
    body: 'Review saved summaries in General, Sales / Customer, or Recruiting / Interview views.',
    icon: Sparkles,
  },
  {
    label: 'Action',
    title: 'Keep the next step.',
    body: 'Find action items and jump back to the source timestamp before you move forward.',
    icon: ListChecks,
  },
] as const;
function Transformation() {
  const {
    ref,
    selected: active,
    choose,
    interacted,
  } = useIllustrationCycle(stages.length, 0, 3300);
  return (
    <section
      className="transformation marketing-section"
      id="product"
      ref={ref}
    >
      <div className="marketing-container">
        <div className="section-heading split">
          <span className="marketing-eyebrow">
            <i /> FROM RECORDING TO CLARITY
          </span>
          <h2>
            One conversation.
            <br />
            <em>More than a file.</em>
          </h2>
          <p>
            A single source thread runs through everything Fathom Clone creates.
            Explore the four parts of the workflow.
          </p>
        </div>
        <div className="transform-grid">
          <div className="transform-steps">
            {stages.map((stage, index) => (
              <button
                key={stage.label}
                type="button"
                className={active === index ? 'is-active' : ''}
                aria-pressed={active === index}
                onClick={() => choose(index)}
              >
                <small>
                  0{index + 1} / {stage.label.toUpperCase()}
                </small>
                <strong>{stage.title}</strong>
                <span>{stage.body}</span>
              </button>
            ))}
          </div>
          <div
            className="transform-stage"
            aria-live={interacted ? 'polite' : 'off'}
          >
            <div className="transform-stage-top">
              <span>THE SOURCE THREAD</span>
              <span>0{active + 1} / 04</span>
            </div>
            <p className="transform-stage-description">{stages[active].body}</p>
            <div className="transform-art" key={active}>
              <div
                className={`transform-visual transform-visual-${active}`}
                aria-hidden="true"
              >
                {active === 0 && (
                  <div className="visual-recording">
                    <FileAudio size={29} />
                    <span>
                      <b>Customer conversation.mp4</b>
                      <small>24:08 · ready to process</small>
                    </span>
                    <i>
                      <span />
                    </i>
                  </div>
                )}
                {active === 1 && (
                  <div className="visual-transcript">
                    <span>
                      <small>08:12</small>
                      <i />
                    </span>
                    <span className="is-source">
                      <small>12:47</small>
                      <b>“I’ll send the revised proposal…”</b>
                    </span>
                    <span>
                      <small>18:42</small>
                      <i />
                    </span>
                  </div>
                )}
                {active === 2 && (
                  <div className="visual-summary">
                    <small>MEETING RECAP</small>
                    <b>What mattered</b>
                    <span>
                      01 <i>Onboarding needs clarity</i>
                    </span>
                    <span>
                      02 <i>Proposal needs revision</i>
                    </span>
                  </div>
                )}
                {active === 3 && (
                  <div className="visual-action">
                    <Check size={19} />
                    <span>
                      <b>Send revised proposal</b>
                      <small>Sarah · Friday</small>
                    </span>
                    <em>12:47 ↗</em>
                  </div>
                )}
              </div>
              <div className="transform-object">
                <small>
                  {stages[active].label.toUpperCase()} / ILLUSTRATIVE
                </small>
                <strong>
                  {active === 0
                    ? 'Customer conversation.mp4'
                    : active === 1
                      ? 'Sarah · 12:47'
                      : active === 2
                        ? 'Proposal and next steps'
                        : 'Send revised proposal'}
                </strong>
                <p>
                  {active === 0
                    ? 'A meeting enters Fathom Clone.'
                    : active === 1
                      ? '“I’ll send the revised proposal by Friday.”'
                      : active === 2
                        ? 'The team agreed to revise the proposal and review customer feedback next week.'
                        : 'Owner Sarah · Due Friday · Source 12:47'}
                </p>
              </div>
            </div>
            <div className="transform-stage-bottom">
              <span>RECORDING</span>
              <ArrowRight size={16} />
              <span>TRANSCRIPT</span>
              <ArrowRight size={16} />
              <span>INTELLIGENCE</span>
              <ArrowRight size={16} />
              <span>ACTION</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TranscriptStory() {
  const { ref, selected, choose } = useIllustrationCycle(
    moments.length,
    1,
    3100,
  );
  return (
    <section
      className="transcript-story marketing-section"
      id="playback"
      ref={ref}
    >
      <div className="marketing-container transcript-grid">
        <div className="section-heading">
          <span className="marketing-eyebrow">
            <i /> LISTEN WITH CONTEXT
          </span>
          <h2>The words and the recording stay together.</h2>
          <p>
            Follow the conversation as it unfolds, or select a timestamp to
            return to the exact passage. A long recording becomes something you
            can navigate.
          </p>
          <span className="story-caption">
            ILLUSTRATIVE INTERACTION · SELECT A TIMESTAMP
          </span>
        </div>
        <div className="transcript-demo">
          <div className="transcript-media">
            <div className="transcript-media-meta">
              <span>
                <AudioLines size={16} /> Customer conversation
              </span>
              <span>24:08</span>
            </div>
            <Waveform active />
            <div className="transcript-seek">
              <span>
                <Play size={12} fill="currentColor" /> {moments[selected].time}
              </span>
              <div>
                <i style={{ width: `${moments[selected].point}%` }} />
              </div>
              <span>24:08</span>
            </div>
          </div>
          <div className="transcript-rows">
            {moments.map((moment, index) => (
              <button
                key={moment.time}
                type="button"
                className={selected === index ? 'is-active' : ''}
                aria-pressed={selected === index}
                onClick={() => choose(index)}
              >
                <span>{moment.time}</span>
                <div>
                  <strong>{moment.speaker}</strong>
                  <p>{moment.line}</p>
                </div>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SummaryStory() {
  const { ref, selected, choose, interacted } = useIllustrationCycle(
    perspectives.length,
    0,
    3900,
  );
  const content = perspectives[selected];
  return (
    <section
      className="summary-story marketing-section"
      id="summaries"
      ref={ref}
    >
      <div className="marketing-container summary-grid">
        <div className="section-heading">
          <span className="marketing-eyebrow">
            <i /> THREE WAYS TO READ IT
          </span>
          <h2>
            Same conversation.
            <br />
            <em>The view you need.</em>
          </h2>
          <p>
            Every meeting has more than one useful reading. Switch between
            Fathom Clone’s three saved summary views without changing the original
            words.
          </p>
        </div>
        <div className="summary-demo">
          <div
            className="summary-demo-tabs"
            role="group"
            aria-label="Illustrative summary view"
          >
            {perspectives.map((item, index) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={selected === index}
                onClick={() => choose(index)}
              >
                {item.key}
              </button>
            ))}
          </div>
          <article
            key={content.key}
            className="summary-demo-copy"
            aria-live={interacted ? 'polite' : 'off'}
          >
            <small>{content.eyebrow} / ILLUSTRATIVE</small>
            <h3>{content.title}</h3>
            <p>{content.body}</p>
            <div>
              <Check size={17} />
              <span>{content.detail}</span>
            </div>
          </article>
          <div className="summary-demo-foot">
            <span>GENERAL</span>
            <span>SALES / CUSTOMER</span>
            <span>RECRUITING / INTERVIEW</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function EvidenceStory() {
  const [connected, setConnected] = useState(false);
  return (
    <section className="evidence-story marketing-section" id="evidence">
      <div className="marketing-container">
        <div className="evidence-heading">
          <span className="marketing-eyebrow">
            <i /> CONTEXT, NOT BLACK-BOX ANSWERS
          </span>
          <h2>
            Every useful answer
            <br />
            has a <em>way back.</em>
          </h2>
          <p>
            Source timestamps connect Fathom Clone’s output to the conversation that
            produced it. Select the source below to see how a next step points
            to the original words.
          </p>
        </div>
        <div className={`evidence-scene ${connected ? 'is-connected' : ''}`}>
          <div className="evidence-action">
            <span>
              <ListChecks size={17} /> ACTION ITEM
            </span>
            <h3>Send the revised proposal</h3>
            <p>Sarah · Friday</p>
            <button
              type="button"
              onClick={() => setConnected(!connected)}
              aria-pressed={connected}
            >
              Source · 12:47 <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="evidence-thread" aria-hidden="true">
            <i />
            <span>12:47</span>
            <i />
          </div>
          <div className="evidence-original">
            <span>
              <AudioLines size={17} /> ORIGINAL CONVERSATION
            </span>
            <div>
              <small>Sarah · 12:47</small>
              <p>“I’ll send the revised proposal by Friday.”</p>
            </div>
            <div className="evidence-original-progress">
              <i />
            </div>
          </div>
        </div>
        <p className="evidence-footnote">
          An illustration of source navigation in Fathom Clone. In the app, the
          timestamp seeks the recording and transcript.
        </p>
      </div>
    </section>
  );
}

function highlight(text: string, query: string) {
  const index = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (index < 0 || !query) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}
function SearchStory() {
  const ref = useRef<HTMLElement>(null);
  const [query, setQuery] = useState('onboarding');
  const [interacted, setInteracted] = useState(false);
  useEffect(() => {
    if (
      interacted ||
      !ref.current ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const terms = ['onboarding', 'proposal', 'customer'];
    let current = terms[0];
    let next = 1;
    let mode: 'hold' | 'erase' | 'type' = 'hold';
    let hold = 28;
    let inView = false;
    let timer: number | undefined;
    const sync = () => {
      if (inView && !document.hidden && timer === undefined)
        timer = window.setInterval(() => {
          if (mode === 'hold') {
            if (--hold > 0) return;
            mode = 'erase';
          } else if (mode === 'erase') {
            current = current.slice(0, -1);
            setQuery(current);
            if (!current) mode = 'type';
          } else {
            current = terms[next].slice(0, current.length + 1);
            setQuery(current);
            if (current === terms[next]) {
              next = (next + 1) % terms.length;
              mode = 'hold';
              hold = 32;
            }
          }
        }, 95);
      else if ((!inView || document.hidden) && timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        sync();
      },
      { threshold: 0.2 },
    );
    observer.observe(ref.current);
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [interacted]);
  const filtered = searches.filter((item) =>
    `${item.meeting} ${item.text}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <section className="search-story marketing-section" id="search" ref={ref}>
      <div className="marketing-container search-grid">
        <div className="section-heading">
          <span className="marketing-eyebrow">
            <i /> SEARCH THE CONVERSATION
          </span>
          <h2>
            Find the thought.
            <br />
            <em>Not just the file.</em>
          </h2>
          <p>
            Search across your meetings to find a topic in the title, summary,
            or transcript. Results bring the surrounding words and their
            timestamps into view.
          </p>
          <span className="story-caption">
            ILLUSTRATIVE SEARCH · TRY “PROPOSAL”
          </span>
        </div>
        <div className="search-demo">
          <label htmlFor="marketing-search">
            <Search size={20} />
            <input
              id="marketing-search"
              aria-label="Search conversations"
              value={query}
              maxLength={40}
              onFocus={() => setInteracted(true)}
              onChange={(event) => {
                setInteracted(true);
                setQuery(event.target.value);
              }}
              placeholder="Search conversations"
            />
            <kbd>SEARCH</kbd>
          </label>
          <div
            className="search-demo-results"
            aria-live={interacted ? 'polite' : 'off'}
          >
            {!query.trim() ? (
              <p>Type a topic to explore the example conversations.</p>
            ) : filtered.length ? (
              filtered.map((item) => (
                <article key={item.meeting}>
                  <div>
                    <span>{item.meeting}</span>
                    <small>TRANSCRIPT · {item.time}</small>
                  </div>
                  <p>“{highlight(item.text, query.trim())}”</p>
                </article>
              ))
            ) : (
              <p>
                No example conversations match “{query}”. Try “proposal” or
                “customer”.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function MomentsStory() {
  const [previewShare, setPreviewShare] = useState(false);
  return (
    <section className="moments-story marketing-section" id="moments">
      <div className="marketing-container moments-grid">
        <div className={`moments-art ${previewShare ? 'is-sharing' : ''}`}>
          <div className="moments-line">
            <span>00:00</span>
            <i />
            <b>12:47</b>
            <i />
            <span>24:08</span>
          </div>
          <div
            className="moments-actions"
            role="group"
            aria-label="Illustrative moment view"
          >
            <button
              type="button"
              aria-pressed={!previewShare}
              onClick={() => setPreviewShare(false)}
            >
              Saved moment
            </button>
            <button
              type="button"
              aria-pressed={previewShare}
              onClick={() => setPreviewShare(true)}
            >
              Shared view <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="moments-selection">
            <span>
              <Bookmark size={15} /> SAVED MOMENT
            </span>
            <strong>The proposal commitment</strong>
            <small>12:47–13:14 · From the original meeting</small>
          </div>
          <div className="moments-public">
            <span>
              PUBLIC MOMENT VIEW <ArrowUpRight size={14} />
            </span>
            <p>One focused moment, with its meeting context attached.</p>
            <span className="moments-public-line" />
          </div>
          <small>ILLUSTRATIVE FATHOM CLONE VIEW</small>
        </div>
        <div className="section-heading">
          <span className="marketing-eyebrow">
            <i /> KEEP WHAT MATTERS
          </span>
          <h2>
            Share the moment.
            <br />
            <em>Keep the context.</em>
          </h2>
          <p>
            Save a highlight from the meeting and share a focused public view.
            The recipient can see the relevant moment without searching through
            the whole recording.
          </p>
          <p>
            When the whole conversation is useful, Fathom Clone also lets you share
            the full meeting.
          </p>
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  const [selected, setSelected] = useState(0);
  const item = useCases[selected];
  return (
    <section className="use-cases marketing-section" id="use-cases">
      <div className="marketing-container">
        <div className="section-heading use-cases-heading">
          <span className="marketing-eyebrow">
            <i /> WHERE CONTEXT COUNTS
          </span>
          <h2>
            Different conversations.
            <br />
            <em>One place to return.</em>
          </h2>
          <p>
            Fathom Clone applies the same recording, transcript, search, and
            source-linked review to the conversations your work depends on.
          </p>
        </div>
        <div className="use-cases-grid">
          <div
            className="use-cases-tabs"
            role="group"
            aria-label="Explore use cases"
          >
            {useCases.map((caseItem, index) => (
              <button
                key={caseItem.title}
                type="button"
                aria-pressed={selected === index}
                onClick={() => setSelected(index)}
              >
                <span>0{index + 1}</span>
                {caseItem.title}
                <ArrowUpRight size={17} />
              </button>
            ))}
          </div>
          <div className="use-cases-panel" key={item.title}>
            <span>{item.kicker}</span>
            <h3>{item.heading}</h3>
            <p>{item.body}</p>
            <div>
              {item.tags.map((tag) => (
                <small key={tag}>{tag}</small>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Philosophy() {
  return (
    <section className="philosophy marketing-section">
      <div className="marketing-container philosophy-grid">
        <div>
          <span className="marketing-eyebrow">
            <i /> THE FATHOM CLONE APPROACH
          </span>
          <h2>
            Make the conversation
            <br />
            <em>usable afterward.</em>
          </h2>
        </div>
        <div className="philosophy-list">
          <article>
            <span>01</span>
            <div>
              <h3>The original words matter.</h3>
              <p>
                A summary is a starting point. Timestamps let you inspect what
                was actually said.
              </p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <h3>Clarity beats more notes.</h3>
              <p>
                Three deliberate summary views help you read the same meeting
                for the question at hand.
              </p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <h3>Context should travel.</h3>
              <p>
                Save the useful moment and share it with enough surrounding
                information to be understood.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section className="steps-section marketing-section" id="how-it-works">
      <div className="marketing-container">
        <div className="section-heading">
          <span className="marketing-eyebrow">
            <i /> A SIMPLE WAY IN
          </span>
          <h2>
            From file to
            <br />
            <em>follow-through.</em>
          </h2>
          <p>
            No meeting bot or calendar setup. Start with a supported recording
            and review it in your Fathom Clone workspace.
          </p>
        </div>
        <div className="steps-line">
          {[
            {
              n: '01',
              icon: UploadCloud,
              title: 'Create an account',
              body: 'Get your own Fathom Clone workspace.',
            },
            {
              n: '02',
              icon: FileAudio,
              title: 'Add a recording',
              body: 'Upload supported audio or video.',
            },
            {
              n: '03',
              icon: Sparkles,
              title: 'Review the meeting',
              body: 'Read the transcript and summary views.',
            },
            {
              n: '04',
              icon: ArrowUpRight,
              title: 'Use what matters',
              body: 'Find actions, search, and share context.',
            },
          ].map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.n}>
                <span className="steps-number">{step.n}</span>
                <Icon size={22} />
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            );
          })}
        </div>
        <Link className="marketing-text-link" to="/signup">
          Get started free <ArrowRight size={17} />
        </Link>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section className="faq-section marketing-section" id="faq">
      <div className="marketing-container faq-grid">
        <div className="section-heading">
          <span className="marketing-eyebrow">
            <i /> GOOD TO KNOW
          </span>
          <h2>
            A little more
            <br />
            <em>about Fathom Clone.</em>
          </h2>
          <p>Clear answers before you bring in your first recording.</p>
        </div>
        <div className="faq-list">
          {faqs.map((item) => (
            <details key={item.question}>
              <summary>
                {item.question}
                <ChevronDown size={19} />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="marketing-close" id="start">
      <div className="marketing-container close-grid">
        <div>
          <span className="marketing-eyebrow">
            <i /> FATHOM CLONE
          </span>
          <h2>
            The meeting ends.
            <br />
            <em>The context shouldn’t.</em>
          </h2>
          <p>
            Bring the recording. Keep the words, the decisions, and the next
            step within reach.
          </p>
          <Link className="marketing-button primary large" to="/signup">
            Get started free <ArrowRight size={18} />
          </Link>
        </div>
        <div className="close-art" aria-hidden="true">
          <span className="close-orbit close-orbit-outer" />
          <span className="close-orbit close-orbit-inner" />
          <div className="close-core">
            <small>FROM THE RECORDING</small>
            <strong>12:47</strong>
            <span>“I’ll send the revised proposal.”</span>
          </div>
          <div className="close-trail">
            <span>WORDS</span>
            <i />
            <span>CONTEXT</span>
            <i />
            <strong>WHAT’S NEXT</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-container">
        <div className="footer-top">
          <div>
            <Brand />
            <p>Meeting intelligence with the source attached.</p>
          </div>
          <div className="footer-links">
            <div>
              <strong>Explore</strong>
              <a href="#product">Product</a>
              <a href="#evidence">Why Fathom Clone</a>
              <a href="#use-cases">Use cases</a>
              <a href="#how-it-works">How it works</a>
              <a href="#faq">FAQ</a>
            </div>
            <div>
              <strong>Account</strong>
              <Link to="/signup">Get started free</Link>
              <Link to="/login">Sign in</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Fathom Clone</span>
          <span>From conversation to context.</span>
        </div>
      </div>
    </footer>
  );
}

export function MarketingHome() {
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const precisePointer = window.matchMedia(
      '(hover: hover) and (pointer: fine)',
    );
    let scroller: Lenis | undefined;
    const syncScroller = () => {
      scroller?.destroy();
      scroller = undefined;
      if (reduceMotion.matches || !precisePointer.matches) return;
      scroller = new Lenis({
        autoRaf: true,
        duration: 1.05,
        easing: (progress) => 1 - Math.pow(1 - progress, 3),
        anchors: { offset: -78, duration: 0.88 },
        stopInertiaOnNavigate: true,
        syncTouch: false,
      });
    };
    syncScroller();
    reduceMotion.addEventListener('change', syncScroller);
    precisePointer.addEventListener('change', syncScroller);
    return () => {
      reduceMotion.removeEventListener('change', syncScroller);
      precisePointer.removeEventListener('change', syncScroller);
      scroller?.destroy();
    };
  }, []);
  useEffect(() => {
    document.title = 'Fathom Clone — Keep what the meeting meant';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'Upload a meeting and keep the conversation searchable: timestamped transcript, three summary views, sourced action items, and moments to share.',
      );
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = `${location.origin}/`;
    document.head.append(canonical);
    return () => canonical.remove();
  }, []);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const sections = document.querySelectorAll<HTMLElement>(
      '.marketing-section, .marketing-close',
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle('is-in-view', entry.isIntersecting);
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        }
      },
      { threshold: 0.04, rootMargin: '0px 0px -24px 0px' },
    );
    sections.forEach((section) => observer.observe(section));
    document.querySelector('.marketing-page')?.classList.add('has-motion');
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ink = document.querySelectorAll<HTMLElement>(
      '.marketing-section h2 em, .marketing-close h2 em',
    );
    const story = document.querySelector<HTMLElement>('.transformation');
    let frame: number | undefined;
    const update = () => {
      frame = undefined;
      const viewport = window.innerHeight;
      for (const word of ink) {
        const top = word.getBoundingClientRect().top;
        const fill = Math.max(
          0,
          Math.min(1, (viewport * 0.82 - top) / (viewport * 0.55)),
        );
        word.style.setProperty(
          '--ink-stop',
          String(Math.round(fill * 100)) + '%',
        );
      }
      if (story) {
        const bounds = story.getBoundingClientRect();
        const range = Math.max(1, bounds.height - viewport * 0.2);
        const progress = Math.max(
          0,
          Math.min(1, (viewport * 0.8 - bounds.top) / range),
        );
        story.style.setProperty('--story-progress', String(progress));
      }
    };
    const schedule = () => {
      if (frame === undefined) frame = window.requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="marketing-page">
      <a className="skip-link" href="#marketing-main">
        Skip to content
      </a>
      <Navigation />
      <SectionRail />
      <main id="marketing-main">
        <Hero />
        <CapabilityStrip />
        <Opening />
        <Transformation />
        <TranscriptStory />
        <SummaryStory />
        <EvidenceStory />
        <SearchStory />
        <MomentsStory />
        <UseCases />
        <Philosophy />
        <Steps />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
