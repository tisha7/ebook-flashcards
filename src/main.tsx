import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AdminPage } from './pages/AdminPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { HomePage } from './pages/HomePage';
import { trackPageView } from './lib/pixel';
import './styles.css';

function AnalyticsListener() {
  const location = useLocation();

  React.useEffect(() => {
    trackPageView();
  }, [location.pathname]);

  return null;
}

function App() {
  return (
    <HashRouter>
      <AnalyticsListener />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </HashRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
