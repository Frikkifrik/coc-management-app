/**
 * Supabase, loaded lazily.
 *
 * `@supabase/supabase-js` is ~230 kB of bundle. The sign-in screen is the only
 * thing that touches it, so the client is created on first use behind a dynamic
 * import rather than at module load — otherwise every visitor pays for it on
 * first paint whether or not they ever sign in.
 *
 * `supabaseConfigured` stays synchronous because the UI needs it immediately to
 * decide whether the Discord and Supabase buttons are even offered; it reads the
 * build-time env vars, which costs nothing.
 *
 * `import.meta.env` is a Vite injection. This module is also bundled by esbuild
 * for the headless smoke harness, where `import.meta.env` is undefined — reading
 * it unguarded throws at import time and takes the whole test run down.
 */

const env: Record<string, string | undefined> =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

const url = env.VITE_SUPABASE_URL?.trim();
const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigured = Boolean(url && anonKey);

type Client = import('@supabase/supabase-js').SupabaseClient;

let cached: Client | null = null;
let pending: Promise<Client | null> | null = null;

/** Resolve the client, creating it once. Null when Supabase is not configured. */
export function getSupabaseClient(): Promise<Client | null> {
  if (cached) return Promise.resolve(cached);
  if (!supabaseConfigured) return Promise.resolve(null);
  if (!pending) {
    pending = import('@supabase/supabase-js')
      .then(({ createClient }) => {
        cached = createClient(url as string, anonKey as string, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        return cached;
      })
      .catch((error) => {
        // A failed load must not wedge the sign-in screen; report it and retry later.
        pending = null;
        throw error instanceof Error ? error : new Error('Supabase could not be loaded.');
      });
  }
  return pending;
}

/**
 * Synchronous peek for callers that must not await (render paths). Returns null
 * until the client has been created, so treat null as "not ready yet" rather
 * than "not configured" — check `supabaseConfigured` for that.
 */
export function peekSupabaseClient(): Client | null {
  return cached;
}
