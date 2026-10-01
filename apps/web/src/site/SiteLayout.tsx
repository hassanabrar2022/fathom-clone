import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AudioLines, ChevronDown, Menu, X } from 'lucide-react';
import { useAuth } from '../auth-state';
import { solutions } from './content';
import '@fontsource-variable/sora';
import './site.css';

export function SiteBrand() {
  return (
    <Link to="/" className="site-brand" aria-label="Fathom Clone home">
      <span className="site-brand-mark" aria-hidden="true">
        <AudioLines size={18} strokeWidth={2.5} />
      </span>
      <span>FATHOM CLONE</span>
    </Link>
  );
}

/** Twinkling star field drawn behind dark sections. */
export function Starfield({ density = 0.00012 }: { density?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let stars: { x: number; y: number; r: number; phase: number }[] = [];
    let frame = 0;
    const size = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = element.getBoundingClientRect();
      element.width = width * ratio;
      element.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      stars = Array.from(
        { length: Math.round(width * height * density) },
        () => ({
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 1.1 + 0.25,
          phase: Math.random() * Math.PI * 2,
        }),
      );
    };
    const draw = (time: number) => {
      const { width, height } = element.getBoundingClientRect();
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        const glow = still ? 0.8 : 0.45 + 0.55 * Math.abs(Math.sin(time / 1400 + star.phase));
        context.globalAlpha = glow;
        context.fillStyle = '#fff';
        context.beginPath();
        context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        context.fill();
      }
      if (!still) frame = requestAnimationFrame(draw);
    };
    size();
    frame = requestAnimationFrame(draw);
    const observer = new ResizeObserver(size);
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [density]);
  return <canvas ref={canvas} className="site-stars" aria-hidden="true" />;
}

function SolutionsMenu() {
  // Remember which page the menu was opened on so navigating closes it.
  const { pathname } = useLocation();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean | ((value: boolean) => boolean)) =>
    setOpenOn(
      (typeof next === 'function' ? next(open) : next) ? pathname : null,
    );
  return (
    <div
      className="site-nav-menu"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="site-nav-link"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Solutions <ChevronDown size={14} />
      </button>
      {open && (
        <div className="site-dropdown">
          {solutions.map((solution) => (
            <Link key={solution.slug} to={`/solutions/${solution.slug}`}>
              For {solution.short}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SiteHeader() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(() => window.scrollY > 24);
  const { pathname } = useLocation();
  const [mobileOn, setMobileOn] = useState<string | null>(null);
  const mobile = mobileOn === pathname;
  const setMobile = (toggle: (value: boolean) => boolean) =>
    setMobileOn(toggle(mobile) ? pathname : null);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return (
    <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="site-header-inner">
        <SiteBrand />
        <nav className="site-nav" aria-label="Main">
          <NavLink to="/overview" className="site-nav-link">
            Overview
          </NavLink>
          <SolutionsMenu />
          <NavLink to="/pricing" className="site-nav-link">
            Pricing
          </NavLink>
          <NavLink to="/about" className="site-nav-link">
            About
          </NavLink>
        </nav>
        <div className="site-header-actions">
          {user ? (
            <Link to="/app" className="site-pill site-pill-cyan">
              Open app
            </Link>
          ) : (
            <>
              <Link to="/login" className="site-login">
                Log In
              </Link>
              <Link
                to="/signup"
                className={`site-pill ${scrolled ? 'site-pill-cyan' : 'site-pill-outline-cyan'}`}
              >
                Sign up free
              </Link>
            </>
          )}
          <button
            type="button"
            className="site-menu-toggle"
            aria-label={mobile ? 'Close menu' : 'Open menu'}
            aria-expanded={mobile}
            onClick={() => setMobile((value) => !value)}
          >
            {mobile ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {mobile && (
        <nav className="site-mobile-nav" aria-label="Mobile">
          <Link to="/overview">Overview</Link>
          {solutions.map((solution) => (
            <Link key={solution.slug} to={`/solutions/${solution.slug}`}>
              For {solution.short}
            </Link>
          ))}
          <Link to="/pricing">Pricing</Link>
          <Link to="/about">About</Link>
          {!user && <Link to="/login">Log In</Link>}
        </nav>
      )}
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-container">
        <div className="site-footer-grid">
          <div>
            <SiteBrand />
          </div>
          <div>
            <h4>Product</h4>
            <Link to="/overview">Overview</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/signup">Sign up</Link>
            <Link to="/login">Log in</Link>
          </div>
          <div>
            <h4>Solutions</h4>
            {solutions.map((solution) => (
              <Link key={solution.slug} to={`/solutions/${solution.slug}`}>
                For {solution.short}
              </Link>
            ))}
          </div>
          <div>
            <h4>Company</h4>
            <Link to="/about">About us</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </div>
          <div>
            <h4>Account</h4>
            <Link to="/forgot-password">Reset password</Link>
            <Link to="/app/settings">Settings</Link>
          </div>
          <div className="site-footer-cta">
            <Link to="/signup" className="site-pill site-pill-cyan site-pill-sm">
              Try Fathom Clone today
            </Link>
          </div>
        </div>
        <div className="site-footer-bottom">
          <div>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </div>
          <span>Fathom Clone © {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}

export function SiteLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="site">
      <a href="#site-main" className="site-skip">
        Skip to content
      </a>
      <div className="site-announcement">
        <span className="site-announcement-badge">NEW</span>
        Share any moment of a meeting with one link.
        <Link to="/overview">Learn more →</Link>
      </div>
      <SiteHeader />
      <main id="site-main">{children}</main>
      <SiteFooter />
    </div>
  );
}

/** Adds .is-visible when an element scrolls into view, for reveal animations. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, visible] as const;
}
