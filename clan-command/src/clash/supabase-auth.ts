import { getSupabaseClient, supabaseConfigured } from '../lib/supabase';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

/**
 * SUPABASE AUTH
 *
 * Supabase is the account provider for the sign-in screen: email + password, an
 * email magic link, and Discord OAuth. It is optional by design — when
 * `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are unset, every entry point
 * here reports that honestly instead of failing silently.
 *
 * The client is loaded on first use (see `src/lib/supabase.ts`) so the ~230 kB
 * SDK stays out of the initial bundle.
 *
 * IMPORTANT, and worth stating plainly: Supabase sign-in is NOT what unlocks live
 * Supercell lookups. Those go through this app's own server (`/api/supercell/*`),
 * which gates on a session cookie issued by `POST /api/auth/login` against the
 * local SQLite user table. The server does not verify Supabase tokens. So a
 * Supabase-only sign-in gives you an identity, while the "Clan server" tab on the
 * same screen is what raises the session the Supercell proxy checks for. Both are
 * offered, and the UI says which is which.
 *
 * Linking a Supabase session to the local server would mean adding token
 * verification server-side; that is a separate change and has not been made.
 */

/** Where Discord sends the user back to after consenting. */
function redirectTo(): string {
  if (typeof window === 'undefined') return '/';
  return `${window.location.origin}/`;
}

export interface SupabaseAuthResult {
  ok: boolean;
  /** Set when `ok` is false: a message safe to show the user. */
  error?: string;
  /** True when nothing happened because Supabase is not configured. */
  unconfigured?: boolean;
  /** True when the flow leaves the page (OAuth) or waits on an inbox (magic link). */
  pending?: boolean;
  session?: Session | null;
}

function unconfigured(): SupabaseAuthResult {
  return {
    ok: false,
    unconfigured: true,
    error:
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable this sign-in.',
  };
}

/** Email + password against the Supabase project. */
export async function signInWithEmail(email: string, password: string): Promise<SupabaseAuthResult> {
  if (!supabaseConfigured) return unconfigured();
  const supabase = await getSupabaseClient();
  if (!supabase) return unconfigured();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, session: data.session };
}

/** Passwordless: Supabase emails a one-time link. */
export async function signInWithMagicLink(email: string): Promise<SupabaseAuthResult> {
  if (!supabaseConfigured) return unconfigured();
  const supabase = await getSupabaseClient();
  if (!supabase) return unconfigured();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectTo() },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, pending: true };
}

/**
 * Discord OAuth. Hands off to Discord and Supabase, which redirects back to the
 * app root with the session in the URL fragment — `detectSessionInUrl` in the
 * client config turns that into a session, which `watchAuth` reports.
 */
export async function signInWithDiscord(): Promise<SupabaseAuthResult> {
  if (!supabaseConfigured) return unconfigured();
  const supabase = await getSupabaseClient();
  if (!supabase) return unconfigured();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo: redirectTo(), queryParams: { prompt: 'consent' } },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, pending: true };
}

export async function signOutOfSupabase(): Promise<void> {
  const supabase = await getSupabaseClient();
  await supabase?.auth.signOut();
}

export async function currentSession(): Promise<Session | null> {
  const supabase = await getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Subscribe to auth changes. This is how the Discord round trip completes: the
 * page reloads on `/`, `detectSessionInUrl` consumes the fragment, and this
 * fires `SIGNED_IN` so the caller can route into the app.
 *
 * The client loads asynchronously, so the returned unsubscribe also cancels a
 * subscription that has not been attached yet.
 */
export function watchAuth(handler: (event: AuthChangeEvent, session: Session | null) => void): () => void {
  let unsubscribe: (() => void) | null = null;
  let cancelled = false;

  if (supabaseConfigured) {
    void getSupabaseClient()
      .then((supabase) => {
        if (cancelled || !supabase) return;
        const { data } = supabase.auth.onAuthStateChange(handler);
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch(() => {
        /* Nothing to watch without a client; sign-in reports its own errors. */
      });
  }

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

/** Display name for a Supabase session, falling back to the email. */
export function displayNameFor(session: Session | null): string {
  if (!session) return '';
  const meta = session.user.user_metadata as Record<string, unknown> | undefined;
  const fromMeta =
    (typeof meta?.full_name === 'string' && meta.full_name) ||
    (typeof meta?.user_name === 'string' && meta.user_name) ||
    (typeof meta?.name === 'string' && meta.name);
  return fromMeta || session.user.email || 'Signed in';
}

export { supabaseConfigured };
