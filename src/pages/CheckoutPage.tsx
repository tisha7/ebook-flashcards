import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BUNDLE_NAME, paymentConfig, PRODUCT_NAME, PRODUCT_PRICE, supabaseConfig } from '../config';
import { supabase } from '../lib/supabase';

type PaymentMethod = 'bkash' | 'nagad';
type OrderConfirmation = { order_id: string; status: string };

function isBangladeshiMobile(value: string): boolean {
  const normalized = value.replace(/[\s-]/g, '');
  return /^(?:\+?88)?01[3-9]\d{8}$/.test(normalized);
}

function isTransactionId(value: string): boolean {
  return /^[a-zA-Z0-9-]{6,40}$/.test(value.trim());
}

export function CheckoutPage() {
  const [form, setForm] = useState({
    customer_name: '',
    email: '',
    phone: '',
    payment_method: '' as PaymentMethod | '',
    sender_mobile: '',
    transaction_id: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null);

  function updateField(field: keyof typeof form, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.customer_name.trim()) next.customer_name = 'আপনার নাম লিখুন।';
    if (!form.email.trim()) next.email = 'আপনার ইমেইল লিখুন।';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'সঠিক ইমেইল ঠিকানা দিন।';
    if (!form.phone.trim()) next.phone = 'আপনার WhatsApp/মোবাইল নম্বর লিখুন।';
    else if (!isBangladeshiMobile(form.phone)) next.phone = 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন।';
    if (!form.payment_method) next.payment_method = 'পেমেন্ট পদ্ধতি নির্বাচন করুন।';
    if (!form.sender_mobile.trim()) next.sender_mobile = 'যে নম্বর থেকে টাকা পাঠিয়েছেন সেটি লিখুন।';
    else if (!isBangladeshiMobile(form.sender_mobile)) next.sender_mobile = 'সঠিক বাংলাদেশি প্রেরকের নম্বর দিন।';
    if (!form.transaction_id.trim()) next.transaction_id = 'Transaction ID লিখুন।';
    else if (!isTransactionId(form.transaction_id)) next.transaction_id = 'Transaction ID ৬–৪০ অক্ষরের হতে পারে (ইংরেজি অক্ষর, সংখ্যা বা হাইফেন)।';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage('');
    if (!validate()) return;
    if (!supabase || !supabaseConfig.isConfigured) {
      setErrorMessage('চেকআউট এখনো সক্রিয় নয়। Supabase কনফিগার করার পর আবার চেষ্টা করুন।');
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke<OrderConfirmation>('create-order', {
        body: { ...form, product_name: PRODUCT_NAME },
      });
      if (error) {
        const details = data && typeof data === 'object' && 'error' in data ? String(data.error) : '';
        throw new Error(details || 'অর্ডার জমা দেওয়া যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।');
      }
      if (!data?.order_id || data.status !== 'PENDING_VERIFICATION') {
        throw new Error('সার্ভার থেকে অর্ডার নিশ্চিত করা যায়নি। আবার চেষ্টা করুন বা আমাদের সঙ্গে যোগাযোগ করুন।');
      }
      setConfirmation(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'অর্ডার জমা দেওয়ার সময় সমস্যা হয়েছে।');
    } finally {
      setBusy(false);
    }
  }

  if (confirmation) {
    return (
      <main className="checkout-page">
        <div className="checkout-top"><Link className="brand" to="/"><span className="brand-mark">স</span><span><strong>সহজ প্যারেন্টিং</strong><small>SOHOJ PARENTING</small></span></Link></div>
        <section className="confirmation-card" aria-live="polite">
          <div className="confirmation-icon" aria-hidden="true">✓</div>
          <p className="eyebrow">অর্ডার জমা হয়েছে</p>
          <h1>ধন্যবাদ, আপনার তথ্য পেয়েছি।</h1>
          <p>আপনার পেমেন্ট এখনো যাচাই করা হয়নি। আমাদের টিম প্রাপ্ত পেমেন্টের সঙ্গে আপনার দেওয়া তথ্য মিলিয়ে দেখবে। যাচাইয়ের আগে পণ্য ডেলিভারি হবে না।</p>
          <div className="order-reference"><span>অর্ডার রেফারেন্স</span><strong>{confirmation.order_id}</strong></div>
          <p className="pending-status"><span /> পেমেন্ট যাচাই অপেক্ষমাণ</p>
          <Link className="button" to="/">হোমপেজে ফিরে যান</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <div className="checkout-top">
        <Link className="brand" to="/"><span className="brand-mark">স</span><span><strong>সহজ প্যারেন্টিং</strong><small>SOHOJ PARENTING</small></span></Link>
        <Link className="checkout-back" to="/">← ফিরে যান</Link>
      </div>
      <div className="checkout-layout">
        <section className="checkout-form-column">
          <p className="eyebrow"><span className="eyebrow-line" />নিরাপদ অর্ডার তথ্য</p>
          <h1>আপনার অর্ডার সম্পন্ন করুন</h1>
          <p className="checkout-lead">নিচের তথ্য দিয়ে অর্ডার জমা দিন। পেমেন্ট ম্যানুয়ালি যাচাই হওয়ার পরেই ডিজিটাল পণ্য পাঠানো হবে।</p>
          {!supabaseConfig.isConfigured && (
            <div className="config-warning" role="status">
              <strong>চেকআউট এখনো সক্রিয় নয়</strong>
              <p>Supabase কনফিগার না হওয়ায় এই সাইট এখন অর্ডার জমা নিতে পারবে না। আপনার তথ্য এই ব্রাউজার ছেড়ে কোথাও পাঠানো হচ্ছে না।</p>
            </div>
          )}
          {errorMessage && <div className="form-alert" role="alert">{errorMessage}</div>}
          <form className="checkout-form" onSubmit={submitOrder} noValidate>
            <label>
              <span>আপনার নাম <b>*</b></span>
              <input autoComplete="name" value={form.customer_name} onChange={(e) => updateField('customer_name', e.target.value)} aria-invalid={Boolean(errors.customer_name)} />
              {errors.customer_name && <small className="field-error">{errors.customer_name}</small>}
            </label>
            <label>
              <span>ইমেইল ঠিকানা <b>*</b></span>
              <input type="email" autoComplete="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} aria-invalid={Boolean(errors.email)} />
              {errors.email && <small className="field-error">{errors.email}</small>}
            </label>
            <label>
              <span>WhatsApp / মোবাইল নম্বর <b>*</b></span>
              <input type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} aria-invalid={Boolean(errors.phone)} />
              {errors.phone && <small className="field-error">{errors.phone}</small>}
            </label>
            <fieldset className="payment-choice">
              <legend>পেমেন্ট পদ্ধতি <b>*</b></legend>
              <div className="payment-options">
                {(['bkash', 'nagad'] as const).map((method) => (
                  <label className={form.payment_method === method ? 'payment-option selected' : 'payment-option'} key={method}>
                    <input type="radio" name="payment_method" value={method} checked={form.payment_method === method} onChange={(e) => updateField('payment_method', e.target.value)} />
                    <span className={`payment-logo ${method}`}>{method === 'bkash' ? 'bKash' : 'Nagad'}</span>
                    <span>Send Money</span>
                  </label>
                ))}
              </div>
              {errors.payment_method && <small className="field-error">{errors.payment_method}</small>}
            </fieldset>
            <div className="receiver-details">
              <span>Send Money করুন</span>
              <strong>{paymentConfig.receiverNumber}</strong>
              <small>{paymentConfig.accountType} • অ্যাকাউন্টের ধরন নিশ্চিত না করে টাকা পাঠাবেন না।</small>
            </div>
            <label>
              <span>যে নম্বর থেকে পেমেন্ট করেছেন <b>*</b></span>
              <input type="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={form.sender_mobile} onChange={(e) => updateField('sender_mobile', e.target.value)} aria-invalid={Boolean(errors.sender_mobile)} />
              {errors.sender_mobile && <small className="field-error">{errors.sender_mobile}</small>}
            </label>
            <label>
              <span>Transaction ID <b>*</b></span>
              <input autoCapitalize="characters" value={form.transaction_id} onChange={(e) => updateField('transaction_id', e.target.value)} aria-invalid={Boolean(errors.transaction_id)} />
              {errors.transaction_id && <small className="field-error">{errors.transaction_id}</small>}
              <small>পেমেন্ট সম্পন্ন করার পর প্রাপ্ত Transaction ID দিন। PIN বা OTP কখনো দেবেন না।</small>
            </label>
            <button className="button button-full checkout-submit" type="submit" disabled={busy || !supabaseConfig.isConfigured}>
              {busy ? 'অর্ডার জমা হচ্ছে…' : !supabaseConfig.isConfigured ? 'Supabase সেটআপের পর অর্ডার করা যাবে' : 'অর্ডার জমা দিন'}
              {supabaseConfig.isConfigured && !busy && <span aria-hidden="true">→</span>}
            </button>
            <p className="privacy-note">আপনার তথ্য শুধু অর্ডার যাচাই ও ম্যানুয়াল ডেলিভারির কাজে ব্যবহার করা হবে।</p>
          </form>
        </section>
        <aside className="order-summary">
          <p className="eyebrow">আপনার প্যাকেজ</p>
          <div className="summary-product">
            <img src={`${import.meta.env.BASE_URL}assets/ebook-cover-placeholder.svg`} alt="" />
            <div><strong>{PRODUCT_NAME}</strong><span>ইবুক + ৫০টি ফ্ল্যাশকার্ড</span></div>
          </div>
          <div className="summary-row"><span>{BUNDLE_NAME}</span><strong>৳{PRODUCT_PRICE.toLocaleString('bn-BD')}</strong></div>
          <div className="summary-total"><span>সর্বমোট</span><strong>৳{PRODUCT_PRICE.toLocaleString('bn-BD')}</strong></div>
          <p className="summary-delivery">পেমেন্ট যাচাইয়ের পর WhatsApp বা ইমেইলে ম্যানুয়ালি পাঠানো হবে।</p>
          <div className="summary-lock">◈ আপনার পেমেন্ট তথ্য সুরক্ষিতভাবে জমা হয়</div>
        </aside>
      </div>
    </main>
  );
}
