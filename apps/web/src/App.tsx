import { useEffect, useState } from 'react';
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import {
  ArrowRight,
  AudioLines,
  CalendarDays,
  ChevronRight,
  FileText,
  LayoutGrid,
  LogOut,
  Search,
  Settings,
  Upload,
  X,
} from 'lucide-react';
import { useMeetingSearch } from './data/meetings';
import { MeetingSearchResults } from './components/MeetingSearch';
import { SharedMoment } from './components/SharedMoment';
import { SharedMeeting } from './components/SharedMeeting';
import { AccountSettings } from './components/AccountSettings';
import { ActiveNotetakers, RecordMeeting } from './components/RecordMeeting';
import { LiveMeeting } from './components/LiveMeeting';
import { useAuth } from './auth-state';
import {
  MeetingLibrary,
  UploadMeeting,
  UploadedMeetingDetail,
} from './components/UploadMeeting';
import './editorial.css';

function Brand() {
  return (
    <Link className="brand" to="/app" aria-label="Fathom Clone home">
      <span className="brand-mark">
        <AudioLines size={22} />
      </span>
      <span>
        fathom<span className="brand-ai">clone</span>
      </span>
    </Link>
  );
}

const pageNames: [RegExp, string][] = [
  [/^\/app\/upload/, 'Upload recording'],
  [/^\/app\/record/, 'Record'],
  [/^\/app\/live\//, 'Live call'],
  [/^\/app\/settings/, 'Settings'],
  [/^\/app\/meetings\//, 'Meeting detail'],
];

function Shell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const [logoutError, setLogoutError] = useState('');
  const pageName =
    pageNames.find(([pattern]) => pattern.test(pathname))?.[1] ?? 'Meetings';
  const signOut = () => {
    setLogoutError('');
    void auth
      .signOut()
      .then(() => navigate('/'))
      .catch(() => setLogoutError('Could not sign out. Please retry.'));
  };
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          <NavLink
            to="/app"
            end
            className={() =>
              `nav-link ${pageName === 'Meetings' || pageName === 'Meeting detail' ? 'active' : ''}`
            }
          >
            <LayoutGrid size={18} /> Meetings
          </NavLink>
          <NavLink
            to="/app/record"
            className={() =>
              `nav-link ${pageName === 'Record' || pageName === 'Live call' ? 'active' : ''}`
            }
            aria-label="Record"
          >
            <CalendarDays size={18} /> Record
          </NavLink>
          <NavLink
            to="/app/upload"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            aria-label="Upload"
          >
            <Upload size={18} /> Upload
          </NavLink>
          <NavLink
            to="/app/settings"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            aria-label="Settings"
          >
            <Settings size={18} /> Settings
          </NavLink>
        </nav>
        <button
          className="mobile-signout"
          type="button"
          aria-label="Sign out"
          title="Sign out"
          onClick={signOut}
        >
          <LogOut size={18} />
        </button>
        <div className="sidebar-bottom">
          {logoutError && (
            <p role="alert" className="sidebar-logout-error">
              {logoutError}
            </p>
          )}
          <div className="workspace-user">
            <span className="avatar guest">
              {auth.user?.email?.[0]?.toUpperCase()}
            </span>
            <div>
              <strong>Your account</strong>
              <small title={auth.user?.email}>{auth.user?.email}</small>
            </div>
            <span className="online-dot" />
          </div>
          <button className="sidebar-signout" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="page-column">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <span>{pageName}</span>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </header>
        {logoutError && (
          <div className="mobile-logout-error" role="alert">
            {logoutError}
          </div>
        )}
        <main id="main">{children}</main>
        <footer>Made for the moments that matter.</footer>
      </div>
    </div>
  );
}

function Dashboard() {
  const [query, setQuery] = useState('');
  useEffect(() => {
    document.title = 'Meetings · Fathom Clone';
  }, []);
  const normalizedQuery = query.trim();
  const search = useMeetingSearch(normalizedQuery);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A LITTLE CLARITY, AFTER EVERY CALL</div>
          <h1>
            Your conversations.
            <br className="mobile-break" /> All connected.
          </h1>
          <p>The ideas, decisions, and next steps worth coming back to.</p>
        </div>
        <div className="page-heading-actions">
          <Link className="primary-button" to="/app/record">
            <CalendarDays size={16} /> Record a meeting
          </Link>
          <Link className="secondary-button" to="/app/upload">
            <Upload size={16} /> Upload
          </Link>
        </div>
      </div>
      <ActiveNotetakers compact />
      <section className="library" aria-labelledby="library-title">
        <div className="section-heading">
          <h2 id="library-title">Meeting library</h2>
          <span className="muted">A little context goes a long way.</span>
        </div>
        <div className="library-toolbar">
          <div className="library-controls">
            <div className="search-input">
              <Search size={17} />
              <input
                aria-label="Search meetings"
                placeholder="Search titles, summaries, transcripts…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button
                  aria-label="Clear search"
                  className="clear-search"
                  onClick={() => setQuery('')}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
        {normalizedQuery ? (
          <div className="meeting-list" aria-live="polite">
            {search.loading ? (
              <div className="empty-state" role="status">
                <h3>Searching your meetings…</h3>
                <div className="loading-lines" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : search.error ? (
              <div className="empty-state" role="alert">
                <h3>Search couldn’t finish</h3>
                <p>{search.error}</p>
                <button className="secondary-button" onClick={search.retry}>
                  Retry search
                </button>
              </div>
            ) : search.data?.length ? (
              <MeetingSearchResults
                results={search.data}
                query={normalizedQuery}
              />
            ) : (
              <div className="empty-state">
                <Search size={30} />
                <h3>No meetings found</h3>
                <p>Try a different title, summary phrase, or transcript quote.</p>
                <button
                  className="secondary-button"
                  onClick={() => setQuery('')}
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        ) : (
          <MeetingLibrary />
        )}
      </section>
    </>
  );
}

function LiveRoute() {
  const { id } = useParams();
  return id && /^[0-9a-f-]{36}$/.test(id) ? (
    <LiveMeeting key={id} id={id} />
  ) : (
    <NotFound />
  );
}

function MeetingRoute() {
  const { id } = useParams();
  return id && /^[0-9a-f-]{36}$/.test(id) ? (
    <UploadedMeetingDetail key={id} id={id} />
  ) : (
    <NotFound />
  );
}

function NotFound() {
  return (
    <div className="empty-state not-found">
      <FileText size={34} />
      <h1>Meeting not found</h1>
      <p>This link doesn’t point to a meeting in your workspace.</p>
      <Link className="primary-button" to="/app">
        Back to meetings <ArrowRight size={16} />
      </Link>
    </div>
  );
}

export function ShareRoute() {
  const { token } = useParams();
  return token?.startsWith('meeting-') ? (
    <SharedMeeting key={token} />
  ) : (
    <SharedMoment key={token} />
  );
}

export function App() {
  return (
    <Shell>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="upload" element={<UploadMeeting />} />
        <Route path="record" element={<RecordMeeting />} />
        <Route path="live/:id" element={<LiveRoute />} />
        <Route path="settings" element={<AccountSettings />} />
        <Route path="meetings/:id" element={<MeetingRoute />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Shell>
  );
}
