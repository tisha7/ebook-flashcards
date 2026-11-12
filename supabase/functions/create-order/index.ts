import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAllowedOrigin, requestOrigin } from '../_shared/security.ts';
import { jsonResponse } from '../_shared/http.ts';

const MOBILE_PATTERN = /^(?:\+?88)?01[3-9]\d{8}$/;
const TRANSACTION_PATTERN = /^[a-zA-Z0-9-]{6,40}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (request) => {
  const origin = requestOrigin(request);
  if (request.method === 'OPTIONS') {
    if (!isAllowedOrigin(origin)) return new Response('Forbidden', { status: 403 });
    return new Response('ok', { headers: { ...jsonResponse({}, 200, origin).headers } });
  }
  if (!isAllowedOrigin(origin)) return jsonResponse({ error: 'অনুরোধের উৎস অনুমোদিত নয়।' }, 403, origin);
  if (request.method !== 'POST') return jsonResponse({ error: 'শুধু POST অনুরোধ গ্রহণযোগ্য।' }, 405, origin);

  try {
    const raw = await request.text();
    if (raw.length > 10_000) return jsonResponse({ error: 'অনুরোধের তথ্য অনেক বড়।' }, 413, origin);
    const input = JSON.parse(raw) as Record<string, unknown>;
    const customerName = typeof input.customer_name === 'string' ? input.customer_name.trim() : '';
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
    const senderMobile = typeof input.sender_mobile === 'string' ? input.sender_mobile.trim() : '';
    const paymentMethod = input.payment_method;
    const transactionId = typeof input.transaction_id === 'string' ? input.transaction_id.trim() : '';

    if (
      customerName.length < 2 || customerName.length > 120 ||
      !EMAIL_PATTERN.test(email) || email.length > 254 ||
      !MOBILE_PATTERN.test(phone.replace(/[\s-]/g, '')) ||
      !MOBILE_PATTERN.test(senderMobile.replace(/[\s-]/g, '')) ||
      (paymentMethod !== 'bkash' && paymentMethod !== 'nagad') ||
      !TRANSACTION_PATTERN.test(transactionId)
    ) {
      return jsonResponse({ error: 'দেওয়া তথ্য যাচাই করুন এবং প্রয়োজনীয় সব ঘর পূরণ করুন।' }, 400, origin);
    }

    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      console.error('create-order: Supabase server environment is incomplete');
      return jsonResponse({ error: 'অর্ডার সার্ভিস কনফিগার করা হয়নি।' }, 503, origin);
    }
    const client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const dateStamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const orderRef = `SP-${dateStamp}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { error } = await client.from('orders').insert({
      order_ref: orderRef,
      customer_name: customerName,
      email,
      phone,
      payment_method: paymentMethod,
      sender_mobile: senderMobile,
      transaction_id: transactionId,
      amount_bdt: 249,
      status: 'PENDING_VERIFICATION',
    });

    if (error) {
      if (error.code === '23505' && error.message.includes('orders_transaction_id_unique_ci')) {
        return jsonResponse({ error: 'এই Transaction ID দিয়ে আগে একটি অর্ডার জমা হয়েছে। তথ্য যাচাই করে আমাদের সঙ্গে যোগাযোগ করুন।' }, 409, origin);
      }
      console.error('create-order: database insert failed', { code: error.code });
      return jsonResponse({ error: 'অর্ডার জমা দেওয়া যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।' }, 500, origin);
    }
    return jsonResponse({ order_id: orderRef, status: 'PENDING_VERIFICATION' }, 201, origin);
  } catch (error) {
    if (error instanceof SyntaxError) return jsonResponse({ error: 'অনুরোধের JSON সঠিক নয়।' }, 400, origin);
    console.error('create-order: unexpected request failure');
    return jsonResponse({ error: 'অর্ডার জমা দেওয়ার সময় সমস্যা হয়েছে।' }, 500, origin);
  }
});
