import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jsonResponse } from '../_shared/http.ts';
import { isAllowedOrigin, requestOrigin } from '../_shared/security.ts';

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const INVALID_CLAIM_MESSAGE = 'ডেলিভারি লিংকটি সঠিক নয়, মেয়াদ শেষ হয়েছে, অথবা বাতিল করা হয়েছে।';

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

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
    if (raw.length > 2000) return jsonResponse({ error: 'অনুরোধের তথ্য অনেক বড়।' }, 413, origin);
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonResponse({ error: 'অনুরোধের JSON সঠিক নয়।' }, 400, origin);
    }
    const input = body as Record<string, unknown>;
    const token = typeof input.token === 'string' ? input.token : '';
    if (!TOKEN_PATTERN.test(token)) {
      return jsonResponse({ error: INVALID_CLAIM_MESSAGE }, 404, origin);
    }

    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      return jsonResponse({ error: 'ডেলিভারি সার্ভিস সাময়িকভাবে অনুপলব্ধ।' }, 503, origin);
    }
    const client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const tokenHash = await hashToken(token);
    const { data: claim, error: claimError } = await client
      .from('delivery_claims')
      .select('order_id,expires_at,revoked_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (claimError) return jsonResponse({ error: 'ডেলিভারি সার্ভিসে সমস্যা হয়েছে।' }, 500, origin);
    const expiresAt = claim ? new Date(claim.expires_at).getTime() : 0;
    if (!claim || claim.revoked_at !== null || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return jsonResponse({ error: INVALID_CLAIM_MESSAGE }, 404, origin);
    }

    const { data: order, error: orderError } = await client
      .from('orders')
      .select('status')
      .eq('id', claim.order_id)
      .maybeSingle();
    if (orderError) return jsonResponse({ error: 'ডেলিভারি সার্ভিসে সমস্যা হয়েছে।' }, 500, origin);
    if (!order || (order.status !== 'VERIFIED' && order.status !== 'DELIVERED')) {
      return jsonResponse({ error: INVALID_CLAIM_MESSAGE }, 404, origin);
    }

    const folderUrl = Deno.env.get('DRIVE_FOLDER_URL') ?? '';
    const ebookPdfUrl = Deno.env.get('DRIVE_EBOOK_URL') ?? '';
    const flashcardsPdfUrl = Deno.env.get('DRIVE_FLASHCARDS_URL') ?? '';
    if (![folderUrl, ebookPdfUrl, flashcardsPdfUrl].every(isHttpsUrl)) {
      return jsonResponse({ error: 'ডেলিভারি সার্ভিস সাময়িকভাবে অনুপলব্ধ।' }, 503, origin);
    }

    return jsonResponse({
      folder_url: folderUrl,
      ebook_pdf_url: ebookPdfUrl,
      flashcards_pdf_url: flashcardsPdfUrl,
      expires_at: claim.expires_at,
    }, 200, origin);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse({ error: 'অনুরোধের JSON সঠিক নয়।' }, 400, origin);
    }
    return jsonResponse({ error: 'ডেলিভারি সার্ভিসে সমস্যা হয়েছে।' }, 500, origin);
  }
});
