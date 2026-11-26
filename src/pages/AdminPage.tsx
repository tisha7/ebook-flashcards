import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { BUNDLE_NAME, PRODUCT_PRICE, supabaseConfig } from '../config';
import { trackVerifiedPurchase } from '../lib/pixel';
import { supabase } from '../lib/supabase';

type OrderStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'DELIVERED';
type DashboardView = 'overview' | 'all' | OrderStatus;
type PaymentFilter = 'ALL' | Order['payment_method'];
type Order = {
  id: string;
  order_ref: string;
  customer_name: string;
  email: string;
  phone: string;
  payment_method: 'bkash' | 'nagad';
  sender_mobile: string;
  transaction_id: string;
  amount_bdt: number;
  status: OrderStatus;
  admin_note: string | null;
  created_at: string;
  verified_at: string | null;
  delivered_at: string | null;
  delivery_reference: string | null;
};

const statusLabels: Record<OrderStatus, string> = {
  PENDING_VERIFICATION: 'যাচাই অপেক্ষমাণ',
  VERIFIED: 'পেমেন্ট যাচাই হয়েছে',
  REJECTED: 'প্রত্যাখ্যাত',
  DELIVERED: 'ডেলিভার হয়েছে',
};

const navigationItems: { key: DashboardView; label: string; icon: string }[] = [
  { key: 'overview', label: 'ওভারভিউ', icon: 'M3 3h7v7H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 14h7v7H3z' },
  { key: 'all', label: 'সব অর্ডার', icon: 'M4 5h16 M4 12h16 M4 19h16' },
  { key: 'PENDING_VERIFICATION', label: 'যাচাই অপেক্ষমাণ', icon: 'M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
  { key: 'VERIFIED', label: 'যাচাই হয়েছে', icon: 'm5 12 4 4L19 6' },
  { key: 'DELIVERED', label: 'ডেলিভার হয়েছে', icon: 'M3 7h13v11H3z M16 11h3l2 3v4h-5z M7 18a2 2 0 1 0 4 0 M17 18a2 2 0 1 0 4 0' },
  { key: 'REJECTED', label: 'প্রত্যাখ্যাত', icon: 'm6 6 12 12 M18 6 6 18' },
];

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function customerWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const international = digits.startsWith('880') ? digits : digits.startsWith('0') ? `88${digits}` : digits;
  return `https://wa.me/${international}`;
}

function AdminIcon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`status-pill status-${status.toLowerCase()}`}>{statusLabels[status]}</span>;
}

function StatCard({ label, value, icon, tone }: { label: string; value: string | number; icon: string; tone: string }) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <span className="stat-icon"><AdminIcon path={icon} /></span>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' });
}

function deliveryMessage(order: Order, link: string): string {
  return `আসসালামু আলাইকুম ${order.customer_name}, আপনার ${BUNDLE_NAME} অর্ডারটি যাচাই হয়েছে। আপনার ব্যক্তিগত ডেলিভারি লিংক: ${link} । লিংকটি ৭ দিন পর্যন্ত কার্যকর থাকবে। ধন্যবাদ — সহজ প্যারেন্টিং`;
}

function deliveryEmailMessage(order: Order, link: string): string {
  return `বিষয়: আপনার ${BUNDLE_NAME} অর্ডারের ডেলিভারি\n\nআসসালামু আলাইকুম ${order.customer_name},\n\nআপনার পেমেন্ট যাচাই হয়েছে। আপনার ব্যক্তিগত ডেলিভারি লিংক: ${link}\n\nলিংকটি ৭ দিন পর্যন্ত কার্যকর থাকবে। ধন্যবাদ — সহজ প্যারেন্টিং`;
}

export function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [filter, setFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [deliveryReference, setDeliveryReference] = useState('');
  const [deliveryLink, setDeliveryLink] = useState('');
  const [deliveryExpiresAt, setDeliveryExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) setErrorMessage(error.message);
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthorized(false);
      setOrders([]);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadOrders = useCallback(async () => {
    if (!supabase || !session) return;
    setErrorMessage('');
    const { data: membership, error: membershipError } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (membershipError || !membership) {
      setAuthorized(false);
      setErrorMessage(membershipError?.message || 'এই অ্যাকাউন্টের অ্যাডমিন অনুমতি নেই।');
      return;
    }
    setAuthorized(true);
    const { data, error } = await supabase
      .from('orders')
      .select('id,order_ref,customer_name,email,phone,payment_method,sender_mobile,transaction_id,amount_bdt,status,admin_note,created_at,verified_at,delivered_at,delivery_reference')
      .order('created_at', { ascending: false });
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    const nextOrders = (data ?? []) as Order[];
    setOrders(nextOrders);
    setSelectedId((current) => current || nextOrders[0]?.id || '');
  }, [session]);

  useEffect(() => {
    if (session) void loadOrders();
  }, [session, loadOrders]);

  const visibleOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = filter === 'ALL' || order.status === filter;
      const matchesPayment = paymentFilter === 'ALL' || order.payment_method === paymentFilter;
      const matchesSearch = !needle || [order.customer_name, order.email, order.phone, order.sender_mobile, order.transaction_id]
        .some((value) => value.toLowerCase().includes(needle));
      return matchesStatus && matchesPayment && matchesSearch;
    }).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [orders, filter, paymentFilter, search]);
  const selectedOrder = visibleOrders.find((order) => order.id === selectedId) ?? null;

  function navigateTo(view: DashboardView): void {
    setActiveView(view);
    setFilter(view === 'overview' || view === 'all' ? 'ALL' : view);
    setMobileDetailOpen(false);
  }

  function selectOrder(order: Order): void {
    setSelectedId(order.id);
    setNote(order.admin_note || '');
    setDeliveryReference('');
    setDeliveryLink('');
    setDeliveryExpiresAt('');
    setMessage('');
    setErrorMessage('');
    setMobileDetailOpen(true);
  }

  async function requestAction(action: 'verify' | 'reject'): Promise<void> {
    if (!selectedOrder) return;
    if (action === 'reject' && !note.trim()) {
      setErrorMessage('প্রত্যাখ্যানের কারণ লিখুন।');
      return;
    }
    const confirmed = action === 'verify'
      ? window.confirm(`৳${selectedOrder.amount_bdt}, ${selectedOrder.payment_method}, প্রেরকের নম্বর এবং Transaction ID প্রকৃত ${selectedOrder.payment_method === 'bkash' ? 'bKash' : 'Nagad'} অ্যাকাউন্টে মিলিয়ে দেখেছেন? যাচাই করলে অর্ডারটি অনুমোদিত হবে।`)
      : window.confirm(`এই অর্ডার প্রত্যাখ্যান করবেন? কারণ: ${note.trim()}`);
    if (confirmed) await runAction(action);
  }

  async function signIn(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setErrorMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErrorMessage(error.message);
    setPassword('');
  }

  async function signOut(): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setErrorMessage(error.message);
    setAuthorized(false);
  }

  async function runAction(action: 'verify' | 'reject' | 'note' | 'delivered'): Promise<void> {
    if (!supabase || !selectedOrder) return;
    setBusy(true);
    setErrorMessage('');
    setMessage('');
    try {
      const body: Record<string, string> = { action, order_id: selectedOrder.id };
      if (action === 'note') body.note = note;
      if (action === 'reject') body.note = note;
      if (action === 'delivered') body.delivery_reference = deliveryReference;
      const { data, error } = await supabase.functions.invoke<{
        order?: Order;
        should_track_purchase?: boolean;
        error?: string;
      }>('admin-order-action', { body });
      if (error) {
        const detail = data?.error;
        throw new Error(detail || error.message);
      }
      if (data?.error) throw new Error(data.error);
      if (data?.should_track_purchase) trackVerifiedPurchase(selectedOrder.id);
      setMessage(action === 'verify' ? 'পেমেন্ট যাচাইয়ের অবস্থা সংরক্ষিত হয়েছে।' : action === 'reject' ? 'অর্ডার প্রত্যাখ্যান করা হয়েছে।' : action === 'delivered' ? 'ডেলিভারি চিহ্নিত হয়েছে।' : 'নোট সংরক্ষিত হয়েছে।');
      if (action === 'note' || action === 'reject') setNote('');
      if (action === 'delivered') setDeliveryReference('');
      await loadOrders();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'অর্ডার আপডেট করা যায়নি।');
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('কপি হয়েছে।');
    } catch {
      setErrorMessage('এই ব্রাউজারে ক্লিপবোর্ড ব্যবহার করা যায়নি।');
    }
  }

  async function generateDeliveryLink(): Promise<void> {
    if (!supabase || !selectedOrder) return;
    setBusy(true);
    setErrorMessage('');
    setMessage('');
    setDeliveryLink('');
    setDeliveryExpiresAt('');
    try {
      const { data, error } = await supabase.functions.invoke<{
        claim_url: string;
        expires_at: string;
        error?: string;
      }>(
        'create-delivery-link',
        { body: { order_id: selectedOrder.id, base_path: import.meta.env.BASE_URL } },
      );
      if (error) throw new Error(data?.error || error.message);
      if (!data?.claim_url || !data.expires_at) throw new Error('প্রাইভেট ডেলিভারি লিংক তৈরি করা যায়নি।');
      setDeliveryLink(data.claim_url);
      setDeliveryExpiresAt(data.expires_at);
      setMessage('ক্রেতার ব্যক্তিগত ডেলিভারি লিংক তৈরি হয়েছে। এটি শুধু সংশ্লিষ্ট ক্রেতাকে পাঠান।');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'ডেলিভারি লিংক তৈরি করা যায়নি।');
    } finally {
      setBusy(false);
    }
  }

  function exportCsv(): void {
    const headings = ['Order reference', 'Customer', 'Email', 'Phone', 'Payment method', 'Sender mobile', 'Transaction ID', 'Amount BDT', 'Status', 'Created at', 'Verified at', 'Delivered at', 'Admin note'];
    const rows = visibleOrders.map((order) => [
      order.order_ref, order.customer_name, order.email, order.phone, order.payment_method, order.sender_mobile,
      order.transaction_id, order.amount_bdt, order.status, order.created_at, order.verified_at, order.delivered_at, order.admin_note,
    ]);
    const csv = [headings, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sohoj-parenting-orders.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const verifiedSales = orders.reduce(
    (total, order) => total + (order.status === 'VERIFIED' || order.status === 'DELIVERED' ? order.amount_bdt : 0),
    0,
  );
  const stats: { label: string; value: string | number; icon: string; tone: string }[] = [
    { label: 'মোট অর্ডার', value: orders.length, icon: navigationItems[1].icon, tone: 'burgundy' },
    { label: 'যাচাই অপেক্ষমাণ', value: orders.filter((order) => order.status === 'PENDING_VERIFICATION').length, icon: navigationItems[2].icon, tone: 'amber' },
    { label: 'যাচাই হয়েছে', value: orders.filter((order) => order.status === 'VERIFIED').length, icon: navigationItems[3].icon, tone: 'green' },
    { label: 'ডেলিভার হয়েছে', value: orders.filter((order) => order.status === 'DELIVERED').length, icon: navigationItems[4].icon, tone: 'blue' },
    { label: 'প্রত্যাখ্যাত', value: orders.filter((order) => order.status === 'REJECTED').length, icon: navigationItems[5].icon, tone: 'red' },
    { label: 'যাচাইকৃত বিক্রয়', value: `৳${verifiedSales.toLocaleString('bn-BD')}`, icon: 'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', tone: 'olive' },
  ];

  if (!supabaseConfig.isConfigured) {
    return (
      <main className="admin-login-page">
        <section className="admin-login-card">
          <Link className="brand" to="/"><span className="brand-mark">স</span><span><strong>সহজ প্যারেন্টিং</strong><small>SOHOJ PARENTING</small></span></Link>
          <h1>অ্যাডমিন ড্যাশবোর্ড</h1>
          <div className="config-warning">
            <strong>Supabase কনফিগার করা হয়নি</strong>
            <p>অ্যাডমিন ড্যাশবোর্ড চালাতে নিচের public Supabase configuration দরকার:</p>
            <ul>{supabaseConfig.missingVariables.map((variable) => <li key={variable}><code>{variable}</code></li>)}</ul>
            <p>Local development-এ `.env.local` এবং production-এ GitHub Repository Variables-এ এগুলো সেট করে নতুন build deploy করুন।</p>
          </div>
          <Link className="text-link" to="/">← স্টোরফ্রন্টে ফিরে যান</Link>
        </section>
      </main>
    );
  }

  if (!authReady) return <main className="admin-login-page"><p role="status">অ্যাডমিন সেশন যাচাই হচ্ছে…</p></main>;

  if (!session) {
    return (
      <main className="admin-login-page">
        <form className="admin-login-card" onSubmit={signIn}>
          <Link className="brand" to="/"><span className="brand-mark">স</span><span><strong>সহজ প্যারেন্টিং</strong><small>SOHOJ PARENTING</small></span></Link>
          <p className="eyebrow"><span className="eyebrow-line" />শুধু অনুমোদিত অ্যাডমিন</p>
          <h1>অ্যাডমিন লগইন</h1>
          <label><span>ইমেইল</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label><span>পাসওয়ার্ড</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {errorMessage && <div className="form-alert" role="alert">{errorMessage}</div>}
          <button className="button button-full" disabled={busy}>{busy ? 'লগইন হচ্ছে…' : 'লগইন'}</button>
          <Link className="text-link" to="/">← স্টোরফ্রন্টে ফিরে যান</Link>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <Link className="brand admin-sidebar-brand" to="/">
            <span className="brand-mark">স</span>
            <span><strong>সহজ প্যারেন্টিং</strong><small>ADMIN WORKSPACE</small></span>
          </Link>
          <p className="admin-nav-label">কর্মক্ষেত্র</p>
          <nav className="admin-sidebar-nav" aria-label="ড্যাশবোর্ড নেভিগেশন">
            {navigationItems.map((item) => (
              <button className={activeView === item.key ? 'admin-nav-item active' : 'admin-nav-item'} key={item.key} aria-current={activeView === item.key ? 'page' : undefined} onClick={() => navigateTo(item.key)}>
                <AdminIcon path={item.icon} /><span>{item.label}</span>
                {item.key === 'PENDING_VERIFICATION' && <b>{stats[1].value}</b>}
              </button>
            ))}
          </nav>
          <div className="admin-sidebar-footer">
            <span className="admin-avatar">{session.user.email?.charAt(0).toUpperCase() || 'A'}</span>
            <span><strong>অ্যাডমিন</strong><small>{session.user.email}</small></span>
          </div>
        </aside>
        <div className="admin-workspace">
          <header className="admin-header">
            <Link className="brand admin-mobile-brand" to="/">
              <span className="brand-mark">স</span><span><strong>সহজ প্যারেন্টিং</strong><small>ADMIN DASHBOARD</small></span>
            </Link>
            <div className="admin-header-context"><span className="admin-header-dot" /> নিরাপদ অ্যাডমিন প্যানেল</div>
            <div className="admin-account">
              <span className="admin-email">{session.user.email}</span>
              <button className="button button-outline" onClick={() => void signOut()}><span aria-hidden="true">↪</span> লগআউট</button>
            </div>
          </header>
          <nav className="admin-mobile-nav" aria-label="ড্যাশবোর্ড নেভিগেশন">
            {navigationItems.map((item) => (
              <button className={activeView === item.key ? 'admin-nav-item active' : 'admin-nav-item'} key={item.key} aria-current={activeView === item.key ? 'page' : undefined} onClick={() => navigateTo(item.key)}>
                <AdminIcon path={item.icon} /><span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="admin-content">
        <div className="admin-title-row">
          <div>
            <p className="eyebrow"><span className="eyebrow-line" />অর্ডার ম্যানেজমেন্ট</p>
            <h1>{navigationItems.find((item) => item.key === activeView)?.label || 'ওভারভিউ'}</h1>
            <p className="admin-subtitle">আপনার অর্ডার এবং ম্যানুয়াল পেমেন্ট যাচাই পরিচালনা করুন।</p>
          </div>
          <button className="button button-outline admin-export-button" onClick={exportCsv} disabled={!authorized}><AdminIcon path="M12 3v12 M7 10l5 5 5-5 M5 21h14" /> CSV ডাউনলোড</button>
        </div>
        {errorMessage && <div className="form-alert" role="alert">{errorMessage}</div>}
        {message && <div className="success-alert" role="status">{message}</div>}
        <p className="admin-reminder"><strong>ম্যানুয়াল যাচাই বাধ্যতামূলক:</strong> Verify করার আগে bKash/Nagad অ্যাকাউন্টে প্রকৃত ৳{PRODUCT_PRICE} পেমেন্ট, পদ্ধতি, প্রেরকের নম্বর এবং Transaction ID মিলিয়ে নিন।</p>
        <section className="stats-grid" aria-label="অর্ডারের পরিসংখ্যান">
          {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
        </section>
        {authorized && (
          <section className="orders-section" aria-label="অর্ডার ম্যানেজমেন্ট">
            <div className="orders-section-heading">
              <div><h2>অর্ডারসমূহ</h2><p>{visibleOrders.length.toLocaleString('bn-BD')}টি অর্ডার দেখানো হচ্ছে</p></div>
              {activeView === 'overview' && <span className="orders-newest"><AdminIcon path="M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /> সর্বশেষ অর্ডার আগে</span>}
            </div>
            <div className="orders-toolbar">
              <label className="admin-search">
                <AdminIcon path="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z M21 21l-4.35-4.35" />
                <input aria-label="অর্ডার খুঁজুন" placeholder="নাম, ফোন, ইমেইল বা Transaction ID" value={search} onChange={(event) => setSearch(event.target.value)} />
              </label>
              <select aria-label="স্ট্যাটাস ফিল্টার" value={filter} onChange={(event) => { const next = event.target.value as 'ALL' | OrderStatus; setFilter(next); setActiveView(next === 'ALL' ? 'all' : next); setMobileDetailOpen(false); }}>
                <option value="ALL">সব স্ট্যাটাস</option>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select aria-label="পেমেন্ট পদ্ধতি ফিল্টার" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}>
                <option value="ALL">সব পেমেন্ট</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
              </select>
            </div>
            <div className="admin-grid">
              <section className={`orders-panel${mobileDetailOpen ? ' mobile-panel-hidden' : ''}`} aria-label="অর্ডারের তালিকা">
                <div className="order-list">
                  {visibleOrders.length === 0 && <p className="empty-orders">এই ফিল্টারে কোনো অর্ডার পাওয়া যায়নি।</p>}
                  {visibleOrders.map((order) => (
                    <button className={`order-list-item ${selectedId === order.id ? 'active' : ''}`} key={order.id} onClick={() => selectOrder(order)}>
                      <span className="order-card-heading"><strong>{order.customer_name}</strong><StatusBadge status={order.status} /></span>
                      <span className="order-card-reference">{order.order_ref} · {formatDate(order.created_at)}</span>
                      <span className="order-card-meta"><span>{order.payment_method === 'bkash' ? 'bKash' : 'Nagad'} · {order.phone}</span><b>৳{order.amount_bdt.toLocaleString('bn-BD')}</b></span>
                    </button>
                  ))}
                </div>
              </section>
            <section className={`order-detail${mobileDetailOpen ? ' mobile-detail-open' : ''}`}>
              {!selectedOrder ? <div className="detail-empty"><button className="mobile-back-button" onClick={() => setMobileDetailOpen(false)}><AdminIcon path="m15 18-6-6 6-6 M9 12h12 M3 5v14" /> অর্ডারে ফিরুন</button><strong>বিস্তারিত দেখতে একটি অর্ডার নির্বাচন করুন</strong></div> : (
                <>
                  <div className="detail-heading">
                    <button className="mobile-back-button" onClick={() => setMobileDetailOpen(false)}><AdminIcon path="m15 18-6-6 6-6 M9 12h12 M3 5v14" /> অর্ডারে ফিরুন</button>
                    <div className="detail-customer-heading"><StatusBadge status={selectedOrder.status} /><h2>{selectedOrder.customer_name}</h2><small>{selectedOrder.order_ref} · {formatDate(selectedOrder.created_at)}</small></div>
                    <strong className="detail-amount">৳{selectedOrder.amount_bdt.toLocaleString('bn-BD')}</strong>
                  </div>
                  <dl className="order-fields">
                    <div><dt>ইমেইল</dt><dd>{selectedOrder.email}<button onClick={() => void copy(selectedOrder.email)}>কপি</button></dd></div>
                    <div><dt>WhatsApp / মোবাইল</dt><dd>{selectedOrder.phone}<button onClick={() => void copy(selectedOrder.phone)}>কপি</button><a href={customerWhatsApp(selectedOrder.phone)} target="_blank" rel="noreferrer">WhatsApp ↗</a></dd></div>
                    <div><dt>পেমেন্ট পদ্ধতি</dt><dd>{selectedOrder.payment_method}</dd></div>
                    <div><dt>প্রেরকের নম্বর</dt><dd>{selectedOrder.sender_mobile}</dd></div>
                    <div><dt>Transaction ID</dt><dd>{selectedOrder.transaction_id}<button onClick={() => void copy(selectedOrder.transaction_id)}>কপি</button></dd></div>
                    <div><dt>অর্ডারের মূল্য</dt><dd>৳{selectedOrder.amount_bdt}</dd></div>
                    {selectedOrder.verified_at && <div><dt>যাচাইয়ের সময়</dt><dd>{formatDate(selectedOrder.verified_at)}</dd></div>}
                    {selectedOrder.delivered_at && <div><dt>ডেলিভারির সময়</dt><dd>{formatDate(selectedOrder.delivered_at)}</dd></div>}
                    {selectedOrder.delivery_reference && <div><dt>ডেলিভারি রেফারেন্স</dt><dd>{selectedOrder.delivery_reference}</dd></div>}
                    {selectedOrder.admin_note && <div><dt>অ্যাডমিন নোট</dt><dd>{selectedOrder.admin_note}</dd></div>}
                  </dl>
                  <div className="admin-actions">
                    {selectedOrder.status === 'PENDING_VERIFICATION' && <>
                      <p className="payment-review-note">প্রকৃত bKash/Nagad লেনদেনের সঙ্গে Transaction ID, প্রেরকের নম্বর এবং পরিমাণ নিজে মিলিয়ে নিন।</p>
                      <label><span>প্রত্যাখ্যানের কারণ <b>*</b></span><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="প্রত্যাখ্যান করলে সংক্ষিপ্ত কারণ লিখুন" /></label>
                      <div className="action-row"><button className="button" disabled={busy} onClick={() => void requestAction('verify')}>পেমেন্ট যাচাই করুন</button><button className="button button-danger" disabled={busy || !note.trim()} onClick={() => void requestAction('reject')}>পেমেন্ট প্রত্যাখ্যান</button><button className="button button-outline" disabled={busy || !note.trim()} onClick={() => void runAction('note')}>নোট সংরক্ষণ</button></div>
                    </>}
                    {selectedOrder.status === 'VERIFIED' && <>
                      <div className="delivery-actions-heading"><h3>ডিজিটাল পণ্য ডেলিভারি</h3><p>লিংকটি গ্রাহককে WhatsApp বা ইমেইলে ম্যানুয়ালি পাঠান।</p></div>
                      <label><span>ডেলিভারির রেফারেন্স <b>*</b></span><input value={deliveryReference} onChange={(event) => setDeliveryReference(event.target.value)} maxLength={200} placeholder="যেমন: WhatsApp-এ লিংক পাঠানো হয়েছে" /><small>Delivered চিহ্নিত করতে এই রেফারেন্সটি আবশ্যক।</small></label>
                      <a className="button button-outline customer-whatsapp-link" href={customerWhatsApp(selectedOrder.phone)} target="_blank" rel="noreferrer"><AdminIcon path="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" /> WhatsApp-এ গ্রাহকের সঙ্গে যোগাযোগ</a>
                      <button className="button" disabled={busy} onClick={() => void generateDeliveryLink()}>{busy ? 'লিংক তৈরি হচ্ছে…' : '৭ দিনের নিরাপদ ডেলিভারি লিংক তৈরি'}</button>
                      {deliveryLink && <div className="private-link">
                        <span><strong>ব্যক্তিগত ডেলিভারি লিংক</strong><small>মেয়াদ শেষ: {formatDate(deliveryExpiresAt)}</small></span>
                        <code>{deliveryLink}</code>
                        <div className="delivery-link-buttons">
                          <a className="button button-outline" href={deliveryLink} target="_blank" rel="noreferrer">ডেলিভারি লিংক খুলুন ↗</a>
                          <button className="button button-outline" onClick={() => void copy(deliveryLink)}>লিংক কপি</button>
                          <button className="button button-outline" onClick={() => void copy(deliveryMessage(selectedOrder, deliveryLink))}>WhatsApp মেসেজ কপি</button>
                          <button className="button button-outline" onClick={() => void copy(deliveryEmailMessage(selectedOrder, deliveryLink))}>ইমেইল মেসেজ কপি</button>
                        </div>
                      </div>}
                      <button className="button button-delivered" disabled={busy || !deliveryReference.trim()} onClick={() => void runAction('delivered')}>ডেলিভার হয়েছে চিহ্নিত করুন</button>
                    </>}
                    {selectedOrder.status !== 'REJECTED' && selectedOrder.status !== 'PENDING_VERIFICATION' && <div className="note-actions"><label><span>অ্যাডমின் নোট</span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label><button className="button button-outline" disabled={busy || !note.trim()} onClick={() => void runAction('note')}>নোট সংরক্ষণ</button></div>}
                  </div>
                </>
              )}
            </section>
          </div>
          </section>
        )}
        {session && !authorized && !errorMessage && <p className="admin-auth-status" role="status">অ্যাডমিন অনুমতি যাচাই হচ্ছে…</p>}
      </div>
      </div>
      </div>
    </main>
  );
}
