import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { HomePage } from './pages/HomePage';
import { trackPageView } from './lib/pixel';
import './styles.css';
import './premium.css';

const AdminPage = lazy(() => import('./pages/AdminPage').then(({ AdminPage: page }) => ({ default: page })));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage').then(({ CheckoutPage: page }) => ({ default: page })));
const CustomerDeliveryPage = lazy(() => import('./pages/CustomerDeliveryPage').then(({ CustomerDeliveryPage: page }) => ({ default: page })));

function AnalyticsListener() {
  const location = useLocation();

  React.useEffect(() => {
    if (location.pathname.startsWith('/delivery/')) return;
    trackPageView();
  }, [location.pathname]);

  return null;
}

function App() {
  return (
    <HashRouter>
      <AnalyticsListener />
      <Suspense fallback={<main className="route-loading" aria-live="polite">লোড হচ্ছে…</main>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/delivery/:token" element={<CustomerDeliveryPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
