import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { BUNDLE_NAME, PRODUCT_PRICE, supabaseConfig } from '../config';
import { trackVerifiedPurchase } from '../lib/pixel';
import { supabase } from '../lib/supabase';

type OrderStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'DELIVERED';
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

export function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [deliveryReference, setDeliveryReference] = useState('');
  const [deliveryLink, setDeliveryLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [authorized, setAuthorized] = useState(false);

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
      const matchesSearch = !needle || [order.id, order.customer_name, order.email, order.phone, order.sender_mobile, order.transaction_id]
        .some((value) => value.toLowerCase().includes(needle));
      return matchesStatus && matchesSearch;
    });
  }, [orders, filter, search]);
  const selectedOrder = orders.find((order) => order.id === selectedId) ?? null;

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
    try {
      const { data, error } = await supabase.functions.invoke<{ signed_url: string; error?: string }>(
        'create-delivery-link',
        { body: { order_id: selectedOrder.id } },
      );
      if (error) throw new Error(data?.error || error.message);
      if (!data?.signed_url) throw new Error('প্রাইভেট ডেলিভারি লিংক তৈরি করা যায়নি।');
      setDeliveryLink(data.signed_url);
      setMessage('প্রাইভেট ডেলিভারি লিংক তৈরি হয়েছে। এটি শুধু ক্রেতাকে ব্যক্তিগতভাবে পাঠান।');
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

  const stats: [string, number][] = [
    ['মোট অর্ডার', orders.length],
    ['যাচাই অপেক্ষমাণ', orders.filter((order) => order.status === 'PENDING_VERIFICATION').length],
    ['যাচাই হয়েছে', orders.filter((order) => order.status === 'VERIFIED').length],
    ['ডেলিভার হয়েছে', orders.filter((order) => order.status === 'DELIVERED').length],
    ['প্রত্যাখ্যাত', orders.filter((order) => order.status === 'REJECTED').length],
  ];

  if (!supabaseConfig.isConfigured) {
    return (
      <main className="admin-login-page">
        <section className="admin-login-card">
          <Link className="brand" to="/"><span className="brand-mark">স</span><span><strong>সহজ প্যারেন্টিং</strong><small>SOHOJ PARENTING</small></span></Link>
          <h1>অ্যাডমিন ড্যাশবোর্ড</h1>
          <div className="config-warning"><strong>Supabase কনফিগার করা হয়নি</strong><p>অ্যাডমিন লগইন চালু করতে .env.local-এ Supabase URL ও anon key দিন এবং সেটআপ নির্দেশনা অনুসরণ করুন।</p></div>
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
      <header className="admin-header">
        <Link className="brand" to="/"><span className="brand-mark">স</span><span><strong>সহজ প্যারেন্টিং</strong><small>ORDER ADMIN</small></span></Link>
        <div><span className="admin-email">{session.user.email}</span><button className="button button-outline" onClick={signOut}>লগআউট</button></div>
      </header>
      <div className="admin-content">
        <div className="admin-title-row"><div><p className="eyebrow">অর্ডার ম্যানেজমেন্ট</p><h1>ড্যাশবোর্ড</h1></div><button className="button button-outline" onClick={exportCsv} disabled={!authorized}>CSV ডাউনলোড ↓</button></div>
        {errorMessage && <div className="form-alert" role="alert">{errorMessage}</div>}
        {message && <div className="success-alert" role="status">{message}</div>}
        <p className="admin-reminder"><strong>ম্যানুয়াল যাচাই বাধ্যতামূলক:</strong> সংশ্লিষ্ট অ্যাকাউন্টে প্রকৃত পেমেন্ট, ৳{PRODUCT_PRICE}, পেমেন্ট পদ্ধতি, প্রেরক নম্বর এবং Transaction ID মিলিয়ে না দেখে Verify করবেন না।</p>
        <section className="stats-grid" aria-label="অর্ডারের পরিসংখ্যান">
          {stats.map(([label, count]) => <article className="stat-card" key={label}><span>{label}</span><strong>{count}</strong></article>)}
        </section>
        {authorized && (
          <div className="admin-grid">
            <section className="orders-panel">
              <div className="orders-toolbar">
                <input aria-label="অর্ডার খুঁজুন" placeholder="নাম, ইমেইল, নম্বর বা Transaction ID" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select aria-label="স্ট্যাটাস ফিল্টার" value={filter} onChange={(e) => setFilter(e.target.value as 'ALL' | OrderStatus)}>
                  <option value="ALL">সব স্ট্যাটাস</option>
                  {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="order-list">
                {visibleOrders.length === 0 && <p className="empty-orders">এই ফিল্টারে কোনো অর্ডার পাওয়া যায়নি।</p>}
                {visibleOrders.map((order) => (
                  <button className={`order-list-item ${selectedId === order.id ? 'active' : ''}`} key={order.id} onClick={() => { setSelectedId(order.id); setNote(order.admin_note || ''); }}>
                    <span><strong>{order.customer_name}</strong><small>{order.order_ref}</small></span>
                    <span className={`status-pill status-${order.status.toLowerCase()}`}>{statusLabels[order.status]}</span>
                    <b>৳{order.amount_bdt}</b>
                  </button>
                ))}
              </div>
            </section>
            <section className="order-detail">
              {!selectedOrder ? <p>বিস্তারিত দেখতে একটি অর্ডার নির্বাচন করুন।</p> : (
                <>
                  <div className="detail-heading"><div><span className={`status-pill status-${selectedOrder.status.toLowerCase()}`}>{statusLabels[selectedOrder.status]}</span><h2>{selectedOrder.customer_name}</h2><small>{selectedOrder.order_ref} • {new Date(selectedOrder.created_at).toLocaleString('bn-BD')}</small></div></div>
                  <dl className="order-fields">
                    <div><dt>ইমেইল</dt><dd>{selectedOrder.email}<button onClick={() => void copy(selectedOrder.email)}>কপি</button></dd></div>
                    <div><dt>WhatsApp / মোবাইল</dt><dd>{selectedOrder.phone}<button onClick={() => void copy(selectedOrder.phone)}>কপি</button><a href={customerWhatsApp(selectedOrder.phone)} target="_blank" rel="noreferrer">WhatsApp ↗</a></dd></div>
                    <div><dt>পেমেন্ট পদ্ধতি</dt><dd>{selectedOrder.payment_method}</dd></div>
                    <div><dt>প্রেরকের নম্বর</dt><dd>{selectedOrder.sender_mobile}</dd></div>
                    <div><dt>Transaction ID</dt><dd>{selectedOrder.transaction_id}<button onClick={() => void copy(selectedOrder.transaction_id)}>কপি</button></dd></div>
                    <div><dt>অর্ডারের মূল্য</dt><dd>৳{selectedOrder.amount_bdt}</dd></div>
                    {selectedOrder.verified_at && <div><dt>যাচাইয়ের সময়</dt><dd>{new Date(selectedOrder.verified_at).toLocaleString('bn-BD')}</dd></div>}
                    {selectedOrder.delivered_at && <div><dt>ডেলিভারির সময়</dt><dd>{new Date(selectedOrder.delivered_at).toLocaleString('bn-BD')}</dd></div>}
                    {selectedOrder.delivery_reference && <div><dt>ডেলিভারি রেফারেন্স</dt><dd>{selectedOrder.delivery_reference}</dd></div>}
                  </dl>
                  <div className="admin-actions">
                    {selectedOrder.status === 'PENDING_VERIFICATION' && <>
                      <label><span>অ্যাডমিন নোট / প্রত্যাখ্যানের কারণ</span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
                      <div className="action-row"><button className="button" disabled={busy} onClick={() => void runAction('verify')}>পেমেন্ট যাচাই করুন</button><button className="button button-danger" disabled={busy || !note.trim()} onClick={() => void runAction('reject')}>প্রত্যাখ্যান</button></div>
                    </>}
                    {selectedOrder.status === 'VERIFIED' && <>
                      <label><span>ডেলিভারির ব্যক্তিগত রেফারেন্স (ঐচ্ছিক)</span><input value={deliveryReference} onChange={(e) => setDeliveryReference(e.target.value)} placeholder="যেমন: ইমেইলে পাঠানো হয়েছে" /></label>
                      <p className="delivery-instruction">পণ্যটি ব্যক্তিগত WhatsApp/ইমেইল চ্যানেলে পাঠান। এখানে কোনো পাবলিক ফাইল URL দেবেন না।</p>
                      <div className="action-row"><button className="button button-outline" disabled={busy} onClick={() => void generateDeliveryLink()}>প্রাইভেট ৭ দিনের লিংক তৈরি</button><button className="button button-outline" onClick={() => void copy(`আসসালামু আলাইকুম ${selectedOrder.customer_name}, আপনার ${BUNDLE_NAME} অর্ডারটি যাচাই হয়েছে। পণ্যটি এই ব্যক্তিগত চ্যানেলে সংযুক্ত/পাঠানো হলো। ধন্যবাদ — সহজ প্যারেন্টিং`)}>ডেলিভারি মেসেজ কপি</button></div>
                      {deliveryLink && <div className="private-link"><span>প্রাইভেট লিংক — ৭ দিন পর মেয়াদ শেষ হবে</span><a href={deliveryLink} target="_blank" rel="noreferrer">ফাইল খুলুন ↗</a><button className="button button-outline" onClick={() => void copy(deliveryLink)}>লিংক কপি</button></div>}
                      <div className="action-row"><button className="button" disabled={busy || !deliveryReference.trim()} onClick={() => void runAction('delivered')}>ডেলিভার হয়েছে চিহ্নিত করুন</button></div>
                    </>}
                    {selectedOrder.status !== 'REJECTED' && <div className="note-actions"><label><span>অ্যাডমின் নোট</span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label><button className="button button-outline" disabled={busy || !note.trim()} onClick={() => void runAction('note')}>নোট সংরক্ষণ</button></div>}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
        {session && !authorized && !errorMessage && <p role="status">অ্যাডমিন অনুমতি যাচাই হচ্ছে…</p>}
      </div>
    </main>
  );
}
