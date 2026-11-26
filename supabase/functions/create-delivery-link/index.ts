import { errorStatus, publicError, requireAdmin } from '../_shared/admin.ts';
import { jsonResponse } from '../_shared/http.ts';
import { isAllowedOrigin, requestOrigin } from '../_shared/security.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_BYTES = 32;
const CLAIM_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const CUSTOMER_SITE_ORIGIN = 'https://tisha7.github.io';

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validBasePath(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\/(?:[A-Za-z0-9._~-]+\/)*$/.test(value) ||
    /[?#\\]/.test(value)
  ) {
    return false;
  }
  try {
    const parsed = new URL(value, CUSTOMER_SITE_ORIGIN);
    return parsed.origin === CUSTOMER_SITE_ORIGIN && parsed.pathname === value;
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
    const { client, user } = await requireAdmin(request);
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('INVALID_REQUEST');
    const input = body as Record<string, unknown>;
    const orderId = typeof input.order_id === 'string' ? input.order_id : '';
    const basePath = input.base_path;
    if (!UUID_PATTERN.test(orderId) || !validBasePath(basePath)) throw new Error('INVALID_REQUEST');

    const { data: order, error: orderError } = await client
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) throw new Error('SERVER_ERROR');
    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (order.status !== 'VERIFIED' && order.status !== 'DELIVERED') throw new Error('INVALID_STATUS');

    const token = randomToken();
    const tokenHash = await hashToken(token);
    const createdAt = new Date();
    const createdAtIso = createdAt.toISOString();
    const expiresAt = new Date(createdAt.getTime() + CLAIM_LIFETIME_MS).toISOString();

    const { error: revokeError } = await client
      .from('delivery_claims')
      .update({ revoked_at: createdAtIso, revoked_by: user.id })
      .eq('order_id', orderId)
      .is('revoked_at', null);
    if (revokeError) throw new Error('SERVER_ERROR');

    const { error: insertError } = await client.from('delivery_claims').insert({
      order_id: orderId,
      token_hash: tokenHash,
      created_at: createdAtIso,
      expires_at: expiresAt,
      issued_by: user.id,
    });
    if (insertError) throw new Error('SERVER_ERROR');

    const claimUrl = `${CUSTOMER_SITE_ORIGIN}${basePath}#/delivery/${token}`;
    return jsonResponse({ claim_url: claimUrl, expires_at: expiresAt }, 200, origin);
  } catch (error) {
    if (error instanceof SyntaxError) return jsonResponse({ error: 'অনুরোধের JSON সঠিক নয়।' }, 400, origin);
    const status = errorStatus(error);
    if (status === 500) console.error('create-delivery-link: request failed');
    return jsonResponse({ error: publicError(error) }, status, origin);
  }
});
