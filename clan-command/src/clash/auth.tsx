import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useI18n } from './i18n';
import { ArrowRight, KeyRound, Loader2, Lock, Mail, Server, ShieldCheck } from 'lucide-react';
import { apiRequest, jsonBody, setApiSessionToken } from '../api';
import {
  signInWithDiscord,
  signInWithEmail,
  signInWithMagicLink,
  supabaseConfigured,
  watchAuth,
} from './supabase-auth';
import { FanContentNotice } from './components';

export type SessionRole = 'leader' | 'co_leader' | 'elder' | 'member';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: SessionRole;
  playerId: string | null;
  isActive: boolean;
}

type SessionReply = { user: SessionUser | null; demoMode: boolean };
type AuthReply = { user: SessionUser; demoMode: boolean; sessionToken?: string };

const ROLE_COPY: Record<SessionRole, { label: string; detail: string }> = {
  leader: { label: 'Leader', detail: 'Full command' },
  co_leader: { label: 'Co-Leader', detail: 'War & roster' },
  elder: { label: 'Elder', detail: 'Readiness tools' },
  member: { label: 'Member', detail: 'Player view' },
};

interface AuthValue {
  user: SessionUser | null;
  demoMode: boolean;
  checking: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInDemo: (role: SessionRole) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await apiRequest<SessionReply>('/api/auth/session');
        if (cancelled) return;
        setUser(session.user);
        setDemoMode(session.demoMode);
        // No token here: an existing session rides on the HttpOnly cookie.
      } catch {
        /* No session: the app still runs on the local dataset. */
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const accept = useCallback((session: AuthReply) => {
    setUser(session.user);
    setDemoMode(Boolean(session.demoMode));
    setApiSessionToken(session.sessionToken);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      demoMode,
      checking,
      signIn: async (email, password) => {
        accept(await apiRequest<AuthReply>('/api/auth/login', { method: 'POST', body: jsonBody({ email, password }) }));
      },
      signInDemo: async (role) => {
        accept(await apiRequest<AuthReply>('/api/auth/demo-login', { method: 'POST', body: jsonBody({ role }) }));
      },
      signOut: async () => {
        try {
          await apiRequest('/api/auth/logout', { method: 'POST' });
        } catch {
          /* local sign-out still wins */
        }
        setApiSessionToken(undefined);
        setUser(null);
      },
    }),
    [user, demoMode, checking, accept],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}

/** Returns null when no provider is mounted, so screens render fine standalone. */
export function useOptionalAuth(): AuthValue | null {
  return useContext(AuthContext);
}

/* ------------------------------------------------------------------ */

export function SignInScreen({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const { signIn, signInDemo, demoMode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'' | 'password' | 'magic' | 'discord' | 'server' | 'demo'>('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  /**
   * Supabase is the account provider; the clan server is what issues the session
   * the Supercell proxy checks. Both are offered because they do different jobs.
   */
  const [mode, setMode] = useState<'supabase' | 'server'>(supabaseConfigured ? 'supabase' : 'server');

  // Completes the Discord round trip: Supabase parses the redirect fragment on
  // load and fires SIGNED_IN, at which point the app can be entered.
  useEffect(() => {
    const unsubscribe = watchAuth((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        setBusy('');
        onDone();
      }
      if (event === 'SIGNED_OUT') setBusy('');
    });
    return unsubscribe;
  }, [onDone]);

  function fail(reason: unknown, fallback: string) {
    setBusy('');
    setError(reason instanceof Error ? reason.message : fallback);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (mode === 'server') {
      setBusy('server');
      try {
        await signIn(email, password);
        onDone();
      } catch (reason) {
        fail(reason, 'Sign-in could not be completed.');
      }
      return;
    }

    setBusy('password');
    const result = await signInWithEmail(email, password);
    if (!result.ok) {
      setError(result.error ?? 'Sign-in could not be completed.');
      setBusy('');
      return;
    }
    // The linked player tag lives in localStorage and is untouched by sign-in,
    // so it is still there when the tracker remounts.
    onDone();
  }

  async function magicLink() {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError(t('Enter your email address first.'));
      return;
    }
    setBusy('magic');
    const result = await signInWithMagicLink(email);
    if (!result.ok) {
      setError(result.error ?? 'The magic link could not be sent.');
      setBusy('');
      return;
    }
    setBusy('');
    setNotice(t('Check your inbox for the sign-in link.'));
  }

  async function discord() {
    setError('');
    setNotice('');
    setBusy('discord');
    const result = await signInWithDiscord();
    if (!result.ok) {
      setError(result.error ?? 'Discord sign-in could not start.');
      setBusy('');
      return;
    }
    // Supabase redirects to Discord; `busy` clears via the auth watcher.
  }

  async function tryDemo(role: SessionRole) {
    setBusy('demo');
    setError('');
    try {
      await signInDemo(role);
      onDone();
    } catch (reason) {
      fail(reason, 'Sandbox access could not be opened.');
    }
  }

  return (
    <div className="clash-app">
      <div className="cc-header-gradient mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-black px-5 py-10">
        <div className="mb-7 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[#2563EB]/40 bg-[#0F172A] text-[#60A5FA]">
            <ShieldCheck size={26} />
          </span>
          <h1 className="mt-4 text-[22px] font-bold leading-tight tracking-tight text-white">Clash Command</h1>
          <p className="mt-1 text-[12px] text-neutral-500">{t('Sign in to run live Supercell lookups.')}</p>
        </div>

        {/* ---------------- Supabase: Discord ---------------- */}
        <button
          type="button"
          onClick={() => void discord()}
          disabled={Boolean(busy)}
          className="cc-tap mb-3 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#5865F2] px-3 py-3 text-[13px] font-bold text-white disabled:opacity-50"
        >
          {busy === 'discord' ? <Loader2 size={16} className="animate-spin" /> : <DiscordMark />}
          {busy === 'discord' ? t('Opening Discord…') : t('Continue with Discord')}
        </button>

        <div className="mb-3 flex items-center gap-3">
          <span className="h-px flex-1 bg-[#27272A]/60" />
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-600">{t('or')}</span>
          <span className="h-px flex-1 bg-[#27272A]/60" />
        </div>

        {/* ---------------- email / password ---------------- */}
        <form
          onSubmit={submit}
          className="flex flex-col gap-3 rounded-2xl border border-[#27272A]/40 bg-[#0F0F10] p-4"
        >
          <div className="flex items-center gap-0.5 rounded-full border border-[#27272A]/60 bg-[#18181A] p-0.5">
            {(['supabase', 'server'] as const).map((option) => {
              const active = mode === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  aria-pressed={active}
                  className={`cc-tap flex-1 rounded-full px-2.5 py-1.5 text-[10px] font-bold tracking-tight transition-colors ${
                    active ? 'bg-[#2563EB] text-white' : 'text-neutral-500 hover:text-neutral-200'
                  }`}
                >
                  {option === 'supabase' ? t('Supabase account') : t('Clan server')}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] leading-relaxed text-neutral-500">
            {mode === 'supabase'
              ? t('Signs you into your account. Live Supercell lookups still need a clan-server session.')
              : t('Issues the session the Supercell proxy checks, which unlocks live lookups.')}
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">{t('Email')}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
              placeholder="leader@yourclan.com"
              className="rounded-xl border border-[#27272A]/60 bg-[#18181A] px-3 py-2.5 text-[13px] text-white outline-none placeholder:text-neutral-600 focus:border-[#2563EB]/60"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">{t('Password')}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required={mode === 'server'}
              placeholder="••••••••"
              className="rounded-xl border border-[#27272A]/60 bg-[#18181A] px-3 py-2.5 text-[13px] text-white outline-none placeholder:text-neutral-600 focus:border-[#2563EB]/60"
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-xl border border-[#2563EB]/40 bg-[#0F172A] px-3 py-2 text-[11px] text-[#93C5FD]">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p role="status" className="rounded-xl border border-[#10B981]/35 bg-[#0d1f19] px-3 py-2 text-[11px] text-[#86EFAC]">
              {notice}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={Boolean(busy)}
            className="cc-tap mt-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[#2563EB]/50 bg-[#0F172A] px-3 py-2.5 text-[13px] font-bold text-[#93C5FD] disabled:opacity-50"
          >
            {busy === 'password' || busy === 'server' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : mode === 'server' ? (
              <Server size={14} />
            ) : (
              <KeyRound size={14} />
            )}
            {busy === 'password' || busy === 'server' ? t('Checking access…') : t('Sign in')}
          </button>

          {mode === 'supabase' ? (
            <button
              type="button"
              onClick={() => void magicLink()}
              disabled={Boolean(busy)}
              className="cc-tap inline-flex items-center justify-center gap-2 text-[11px] font-bold text-neutral-500 hover:text-white disabled:opacity-50"
            >
              {busy === 'magic' ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
              {t('Email me a sign-in link instead')}
            </button>
          ) : null}
        </form>

        {!supabaseConfigured ? (
          <p className="mt-3 rounded-xl border border-[#27272A]/40 bg-[#0F0F10] px-3 py-2.5 text-[10px] leading-relaxed text-neutral-500">
            {t('Supabase is not configured on this build.')}{' '}
            <span className="font-mono text-neutral-400">VITE_SUPABASE_URL</span> and{' '}
            <span className="font-mono text-neutral-400">VITE_SUPABASE_ANON_KEY</span> are unset, so Discord and
            Supabase sign-in are unavailable. {t('The clan server below still works.')}
          </p>
        ) : null}

        {demoMode ? (
          <div className="mt-4">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">{t('Sandbox access')}</span>
              <span className="text-[10px] text-neutral-600">{t('Fictional demo data')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ROLE_COPY) as SessionRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void tryDemo(role)}
                  className="cc-tap flex items-center justify-between gap-2 rounded-xl border border-[#27272A]/50 bg-[#0F0F10] px-3 py-2.5 text-left disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block text-[12px] font-bold text-white">{ROLE_COPY[role].label}</span>
                    <span className="block text-[9px] text-neutral-500">{t(ROLE_COPY[role].detail)}</span>
                  </span>
                  <ArrowRight size={13} className="shrink-0 text-neutral-600" />
                </button>
              ))}
            </div>
            <p className="mt-2 px-1 text-[10px] leading-relaxed text-neutral-600">
              {t('Demo password is')} <span className="font-mono text-neutral-400">Clash2026!</span> for{' '}
              <span className="font-mono text-neutral-400">leader@clan.demo</span>,{' '}
              <span className="font-mono text-neutral-400">coleader@clan.demo</span>,{' '}
              <span className="font-mono text-neutral-400">elder@clan.demo</span> and{' '}
              <span className="font-mono text-neutral-400">member@clan.demo</span>.
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onDone}
          className="cc-tap mt-5 inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-neutral-500 hover:text-white"
        >
          <Lock size={11} /> {t('Continue without signing in')}
        </button>

        <FanContentNotice />
      </div>
    </div>
  );
}

/** Discord's own mark, drawn at the size the button needs. */
function DiscordMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037 13.78 13.78 0 0 0-.608 1.25 18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}
