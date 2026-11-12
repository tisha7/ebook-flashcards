export function corsHeaders(origin = ''): Record<string, string> {
  const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://localhost:4173',
    ...[Deno.env.get('SITE_URL')].filter(Boolean).map((value) => {
      try {
        return new URL(value!).origin;
      } catch {
        return '';
      }
    }),
  ]);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  if (allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function requestOrigin(request: Request): string {
  return request.headers.get('origin') ?? '';
}

export function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://localhost:4173',
    ...[Deno.env.get('SITE_URL')].filter(Boolean).map((value) => {
      try {
        return new URL(value!).origin;
      } catch {
        return '';
      }
    }),
  ]);
  return allowedOrigins.has(origin);
}
