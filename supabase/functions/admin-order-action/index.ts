import { errorStatus, publicError, requireAdmin } from '../_shared/admin.ts';
import { jsonResponse } from '../_shared/http.ts';
import { isAllowedOrigin, requestOrigin } from '../_shared/security.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const action = input.action;
    const note = typeof input.note === 'string' ? input.note.trim() : '';
    const deliveryReference = typeof input.delivery_reference === 'string' ? input.delivery_reference.trim() : '';
    if (!UUID_PATTERN.test(orderId) || !['verify', 'reject', 'note', 'delivered'].includes(String(action))) {
      throw new Error('INVALID_REQUEST');
    }

    const { data: existing, error: fetchError } = await client
      .from('orders')
      .select('id,status')
      .eq('id', orderId)
      .maybeSingle();
    if (fetchError) throw new Error('SERVER_ERROR');
    if (!existing) throw new Error('ORDER_NOT_FOUND');

    if (action === 'note') {
      if (note.length > 1000) throw new Error('INVALID_REQUEST');
      const { error } = await client.from('orders').update({ admin_note: note }).eq('id', orderId);
      if (error) throw new Error('SERVER_ERROR');
      return jsonResponse({ ok: true }, 200, origin);
    }

    if (action === 'verify') {
      if (existing.status !== 'PENDING_VERIFICATION') throw new Error('INVALID_STATUS');
      const { data, error } = await client
        .from('orders')
        .update({ status: 'VERIFIED', verified_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('status', 'PENDING_VERIFICATION')
        .select('id,status')
        .maybeSingle();
      if (error) throw new Error('SERVER_ERROR');
      if (!data) throw new Error('INVALID_STATUS');
      return jsonResponse({ ok: true, should_track_purchase: true }, 200, origin);
    }

    if (action === 'reject') {
      if (existing.status !== 'PENDING_VERIFICATION' || !note || note.length > 1000) {
        throw new Error(existing.status !== 'PENDING_VERIFICATION' ? 'INVALID_STATUS' : 'INVALID_REQUEST');
      }
      const { data, error } = await client
        .from('orders')
        .update({ status: 'REJECTED', admin_note: note })
        .eq('id', orderId)
        .eq('status', 'PENDING_VERIFICATION')
        .select('id')
        .maybeSingle();
      if (error) throw new Error('SERVER_ERROR');
      if (!data) throw new Error('INVALID_STATUS');
      return jsonResponse({ ok: true }, 200, origin);
    }

    if (existing.status !== 'VERIFIED') throw new Error('INVALID_STATUS');
    if (!deliveryReference || deliveryReference.length > 200) throw new Error('DELIVERY_REFERENCE_REQUIRED');
    const { data, error } = await client
      .from('orders')
      .update({
        status: 'DELIVERED',
        delivered_at: new Date().toISOString(),
        delivery_reference: deliveryReference,
      })
      .eq('id', orderId)
      .eq('status', 'VERIFIED')
      .select('id')
      .maybeSingle();
    if (error) throw new Error('SERVER_ERROR');
    if (!data) throw new Error('INVALID_STATUS');
    return jsonResponse({ ok: true }, 200, origin);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse({ error: 'অনুরোধের JSON সঠিক নয়।' }, 400, origin);
    }
    const status = errorStatus(error);
    if (status === 500) console.error('admin-order-action: request failed');
    return jsonResponse({ error: publicError(error) }, status, origin);
  }
});
