import { createClient, type SupabaseClient, type User } from 'https://esm.sh/@supabase/supabase-js@2';

type AdminContext = { client: SupabaseClient; user: User };

export async function requireAdmin(request: Request): Promise<AdminContext> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('UNAUTHORIZED');
  const token = authorization.slice('Bearer '.length);
  if (!token) throw new Error('UNAUTHORIZED');

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) throw new Error('SERVER_CONFIGURATION');

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) throw new Error('UNAUTHORIZED');

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: membership, error: membershipError } = await client
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (membershipError) throw new Error('SERVER_ERROR');
  if (!membership) throw new Error('FORBIDDEN');
  return { client, user: userData.user };
}

export function errorStatus(error: unknown): number {
  if (!(error instanceof Error)) return 500;
  if (error.message === 'UNAUTHORIZED') return 401;
  if (error.message === 'FORBIDDEN') return 403;
  if (error.message === 'INVALID_REQUEST' || error.message === 'DELIVERY_REFERENCE_REQUIRED') return 400;
  if (error.message === 'INVALID_STATUS') return 409;
  if (error.message === 'ORDER_NOT_FOUND') return 404;
  if (error.message === 'SERVER_CONFIGURATION') return 500;
  return 500;
}

export function publicError(error: unknown): string {
  if (!(error instanceof Error)) return 'অনুরোধ সম্পন্ন করা যায়নি।';
  if (error.message === 'UNAUTHORIZED') return 'অনুমোদিত লগইন প্রয়োজন।';
  if (error.message === 'FORBIDDEN') return 'এই কাজের জন্য অ্যাডমিন অনুমতি প্রয়োজন।';
  if (error.message === 'SERVER_CONFIGURATION') return 'সার্ভার কনফিগারেশন অসম্পূর্ণ।';
  if (error.message === 'INVALID_REQUEST') return 'অনুরোধের তথ্য সঠিক নয়।';
  if (error.message === 'ORDER_NOT_FOUND') return 'অর্ডার পাওয়া যায়নি।';
  if (error.message === 'INVALID_STATUS') return 'এই অর্ডারের বর্তমান অবস্থায় কাজটি করা যাবে না।';
  if (error.message === 'DELIVERY_REFERENCE_REQUIRED') return 'ডেলিভারির ব্যক্তিগত রেফারেন্স লিখুন।';
  return 'সার্ভারে সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।';
}
