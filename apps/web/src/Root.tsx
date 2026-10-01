import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

const Marketing = lazy(() =>
  import('./Marketing').then((module) => ({ default: module.MarketingHome })),
);
const Login = lazy(() =>
  import('./Auth').then((module) => ({ default: module.AuthPage })),
);
const Confirm = lazy(() =>
  import('./Auth').then((module) => ({ default: module.AuthCallback })),
);
const Product = lazy(() =>
  import('./App').then((module) => ({ default: module.App })),
);

function RouteLoading() {
  return (
    <div className="route-loading" role="status">
      Opening Fathom Clone…
    </div>
  );
}
export function Root() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<Marketing />} />
        <Route path="/login" element={<Login mode="login" />} />
        <Route path="/signup" element={<Login mode="signup" />} />
        <Route path="/auth/confirm" element={<Confirm />} />
        <Route path="/app/*" element={<Product />} />
        <Route path="/share/:token" element={<Product />} />
        <Route path="*" element={<Product />} />
      </Routes>
    </Suspense>
  );
}
