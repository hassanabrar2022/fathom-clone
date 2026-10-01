import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth-state';

const Marketing = lazy(() =>
  import('./Marketing').then((module) => ({ default: module.MarketingHome })),
);
const Login = lazy(() =>
  import('./Auth').then((module) => ({ default: module.AuthPage })),
);
const Confirm = lazy(() =>
  import('./Auth').then((module) => ({ default: module.AuthCallback })),
);
const Forgot = lazy(() =>
  import('./Auth').then((module) => ({ default: module.ForgotPassword })),
);
const Reset = lazy(() =>
  import('./Auth').then((module) => ({ default: module.ResetPassword })),
);
const Product = lazy(() =>
  import('./App').then((module) => ({ default: module.App })),
);
const Shared = lazy(() =>
  import('./App').then((module) => ({ default: module.ShareRoute })),
);

function RouteLoading() {
  return (
    <div className="route-loading" role="status">
      Opening Fathom Clone…
    </div>
  );
}

/** The workspace is for signed-in users; send everyone else to sign in. */
function RequireAccount({ children }: { children: React.ReactNode }) {
  const { user, loading, leaving } = useAuth();
  const location = useLocation();
  if (loading) return <RouteLoading />;
  if (!user && leaving) return <Navigate to="/" replace />;
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return children;
}

export function Root() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<Marketing />} />
        <Route path="/login" element={<Login mode="login" />} />
        <Route path="/signup" element={<Login mode="signup" />} />
        <Route path="/forgot-password" element={<Forgot />} />
        <Route path="/auth/confirm" element={<Confirm />} />
        <Route path="/auth/reset" element={<Reset />} />
        <Route path="/share/:token" element={<Shared />} />
        <Route
          path="/app/*"
          element={
            <RequireAccount>
              <Product />
            </RequireAccount>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
