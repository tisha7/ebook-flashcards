import { errorStatus, publicError, requireAdmin } from '../_shared/admin.ts';
import { jsonResponse } from '../_shared/http.ts';
import { isAllowedOrigin, requestOrigin } from '../_shared/security.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_BUNDLE_PATH = 'bundle/sohoj-parenting.zip';
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

Deno.serve(async (request) => {
  const origin = requestOrigin(request);
  if (request.method === 'OPTIONS') {
    if (!isAllowedOrigin(origin)) return new Response('Forbidden', { status: 403 });
    return new Response('ok', { headers: { ...jsonResponse({}, 200, origin).headers } });
  }
  if (!isAllowedOrigin(origin)) return jsonResponse({ error: 'অনুরোধের উৎস অনুমোদিত নয়।' }, 403, origin);
  if (request.method !== 'POST') return jsonResponse({ error: 'শুধু POST অনুরোধ গ্রহণযোগ্য।' }, 405, origin);

  try {
    const { client } = await requireAdmin(request);
    const input = await request.json() as Record<string, unknown>;
    const orderId = typeof input.order_id === 'string' ? input.order_id : '';
    if (!UUID_PATTERN.test(orderId)) throw new Error('INVALID_REQUEST');

    const { data: order, error: orderError } = await client
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) throw new Error('SERVER_ERROR');
    if (!order) throw new Error('ORDER_NOT_FOUND');
    if (order.status !== 'VERIFIED' && order.status !== 'DELIVERED') throw new Error('INVALID_STATUS');

    const { data, error } = await client.storage
      .from('product-files')
      .createSignedUrl(PRIVATE_BUNDLE_PATH, SIGNED_URL_SECONDS, { download: 'sohoj-parenting-bundle.zip' });
    if (error || !data?.signedUrl) {
      console.error('create-delivery-link: private product file is missing or unavailable');
      return jsonResponse({ error: 'প্রাইভেট প্রোডাক্ট ফাইল পাওয়া যায়নি। অ্যাডমিন Storage সেটআপ দেখুন।' }, 503, origin);
    }
    return jsonResponse({ signed_url: data.signedUrl, expires_in_seconds: SIGNED_URL_SECONDS }, 200, origin);
  } catch (error) {
    if (error instanceof SyntaxError) return jsonResponse({ error: 'অনুরোধের JSON সঠিক নয়।' }, 400, origin);
    const status = errorStatus(error);
    if (status === 500) console.error('create-delivery-link: request failed');
    return jsonResponse({ error: publicError(error) }, status, origin);
  }
});
