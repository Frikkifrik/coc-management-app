import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useI18n } from './i18n';
import { ArrowRight, KeyRound, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { apiRequest, jsonBody, setApiSessionToken } from '../api';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      onDone();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  async function tryDemo(role: SessionRole) {
    setBusy(true);
    setError('');
    try {
      await signInDemo(role);
      onDone();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sandbox access could not be opened.');
    } finally {
      setBusy(false);
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

        <form
          onSubmit={submit}
          className="flex flex-col gap-3 rounded-2xl border border-[#27272A]/40 bg-[#0F0F10] p-4"
        >
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
              required
              placeholder="••••••••"
              className="rounded-xl border border-[#27272A]/60 bg-[#18181A] px-3 py-2.5 text-[13px] text-white outline-none placeholder:text-neutral-600 focus:border-[#2563EB]/60"
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-xl border border-[#2563EB]/40 bg-[#0F172A] px-3 py-2 text-[11px] text-[#93C5FD]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="cc-tap mt-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[#2563EB]/50 bg-[#0F172A] px-3 py-2.5 text-[13px] font-bold text-[#93C5FD] disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            {busy ? 'Checking access…' : 'Sign in'}
          </button>
        </form>

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
                  disabled={busy}
                  onClick={() => void tryDemo(role)}
                  className="cc-tap flex items-center justify-between gap-2 rounded-xl border border-[#27272A]/50 bg-[#0F0F10] px-3 py-2.5 text-left disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block text-[12px] font-bold text-white">{ROLE_COPY[role].label}</span>
                    <span className="block text-[9px] text-neutral-500">{ROLE_COPY[role].detail}</span>
                  </span>
                  <ArrowRight size={13} className="shrink-0 text-neutral-600" />
                </button>
              ))}
            </div>
            <p className="mt-2 px-1 text-[10px] leading-relaxed text-neutral-600">
              Demo password is <span className="font-mono text-neutral-400">Clash2026!</span> for{' '}
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
          <Lock size={11} /> Continue without signing in
        </button>
      </div>
    </div>
  );
}
