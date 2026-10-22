// api/keepalive.ts
//
// Vercel Cron target (see "crons" in vercel.json): one harmless request a day
// so the free Supabase project never reaches 7 days without activity and gets
// paused. Setup: supabase/README.md → "Pausa por inactividad".
//
// Required Vercel environment variables (Production):
//   SUPABASE_URL                Project URL, e.g. https://abcd.supabase.co
//   SUPABASE_PUBLISHABLE_KEY    Publishable (anon) key — never the secret key.
//   CRON_SECRET                 Random string; Vercel sends it as a Bearer token.

declare const process: { env: Record<string, string | undefined> };

export async function GET(request: Request): Promise<Response> {
  const secret = process.env['CRON_SECRET'];
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = process.env['SUPABASE_URL']?.replace(/\/+$/, '');
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) {
    console.error('keepalive: SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not set');
    return new Response('Not configured', { status: 500 });
  }

  // schema_version() is granted to anon and reads nothing: a pure ping.
  const res = await fetch(`${url}/rest/v1/rpc/schema_version`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`keepalive: Supabase answered ${res.status}: ${body}`);
    return new Response(`Supabase answered ${res.status}`, { status: 502 });
  }
  console.log(`keepalive: ok (schema version ${body})`);
  return new Response(`ok (schema version ${body})`);
}
