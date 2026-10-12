import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CATALOG, CATALOG_INDEX, entriesFor, slug, type CategoryId } from './catalog';
import { tt, useI18n } from './i18n';
import { STATE_VERSION, createDemoState, isoDay } from './demo';
import type { ClashState, IntegrationSettings, PlanItem, UpgradeTask, ViewId, RouteId } from './types';

const STORAGE_KEY = 'clash-command:state:v1';
const VIEW_KEY = 'clash-command:view';
const ROUTE_KEY = 'clash-command:route';

export const VIEWS: Array<{ id: ViewId; label: string; hint: string }> = [
  { id: 'home-village', label: 'Home Village', hint: 'Tracker, heroes, equipment' },
  { id: 'builder-base', label: 'Builder Base', hint: 'Builder Hall progression' },
  { id: 'calendar', label: 'Calendar', hint: 'Multi-slot builder schedule' },
  { id: 'plan', label: 'Plan', hint: 'Upgrade queue & budget' },
  { id: 'collection', label: 'Collection', hint: 'Every asset, one grid' },
];

export const ROUTES: Array<{ id: RouteId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'profile', label: 'Profile' },
  { id: 'clan', label: 'Clan' },
  { id: 'war', label: 'War' },
];

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

export function compactNumber(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(value % 1_000_000_000 === 0 ? 0 : 1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
  return String(Math.round(value));
}

export function normaliseTag(value: string): string {
  const clean = value.trim().toUpperCase().replace(/\s+/g, '').replace(/^#/, '');
  return clean ? `#${clean}` : '';
}

export function hoursLabel(hours: number): string {
  if (hours <= 0) return '—';
  // Afrikaans abbreviates uur as "u"; minutes and days match English.
  const h = tt('h');
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) return `${Math.round(hours)}${h}`;
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours % 24);
  return rest ? `${days}d ${rest}${h}` : `${days}d`;
}

/* ------------------------------------------------------------------ */

function load(): ClashState {
  const fresh = createDemoState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as ClashState;
    if (!parsed || parsed.version !== STATE_VERSION) return fresh;
    return { ...fresh, ...parsed };
  } catch {
    return fresh;
  }
}

function save(state: ClashState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Private-mode browsers: the in-memory state still works for this tab. */
  }
}

function readRoute(): RouteId {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  const match = ROUTES.find((route) => route.id === hash);
  if (match) return match.id;
  try {
    const stored = window.localStorage.getItem(ROUTE_KEY) as RouteId | null;
    if (stored && ROUTES.some((route) => route.id === stored)) return stored;
  } catch {
    /* ignore */
  }
  return 'profile';
}

export interface Notice {
  id: string;
  text: string;
  tone: 'info' | 'error' | 'success';
}

interface ClashContextValue {
  state: ClashState;
  route: RouteId;
  view: ViewId;
  notices: Notice[];
  syncing: boolean;
  selectedCategory: CategoryId | null;
  setRoute: (route: RouteId) => void;
  setView: (view: ViewId) => void;
  setSelectedCategory: (category: CategoryId | null) => void;
  notify: (text: string, tone?: Notice['tone']) => void;
  dismissNotice: (id: string) => void;
  setLevel: (key: string, level: number) => void;
  toggleSupercharge: (key: string) => void;
  setWallSegments: (village: 'home' | 'builder', level: number, count: number) => void;
  addPlanItem: (item: Omit<PlanItem, 'id'>) => void;
  removePlanItem: (id: string) => void;
  setPlanPriority: (id: string, priority: 1 | 2 | 3) => void;
  addTask: (task: Omit<UpgradeTask, 'id'>) => void;
  removeTask: (id: string) => void;
  moveTask: (id: string, slot: number, shiftDays: number) => void;
  setScheduleStart: (iso: string) => void;
  linkTag: (tag: string, label: string, token: string) => void;
  unlinkTag: (tag: string) => void;
  verifyTag: (tag: string) => Promise<void>;
  setIntegrations: (patch: Partial<IntegrationSettings>) => void;
  exportJson: () => void;
  importJson: (raw: string) => Promise<void>;
  syncLive: () => Promise<void>;
  resetDemo: () => void;
}

const ClashContext = createContext<ClashContextValue | null>(null);

export function ClashProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [state, setState] = useState<ClashState>(() => load());
  const [view, setViewState] = useState<ViewId>(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_KEY) as ViewId | null;
      if (stored && VIEWS.some((item) => item.id === stored)) return stored;
    } catch {
      /* ignore */
    }
    return 'home-village';
  });
  const [route, setRouteState] = useState<RouteId>(() => readRoute());
  const [notices, setNotices] = useState<Notice[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((handle) => window.clearTimeout(handle)), []);

  useEffect(() => {
    save(state);
  }, [state]);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, view);
      window.localStorage.setItem(ROUTE_KEY, route);
    } catch {
      /* ignore */
    }
    try {
      window.history.replaceState(null, '', `#/${route}`);
    } catch {
      /* ignore */
    }
  }, [view, route]);

  const dismissNotice = useCallback((id: string) => {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);

  const notify = useCallback(
    (text: string, tone: Notice['tone'] = 'info') => {
      const id = `notice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setNotices((current) => [...current.slice(-2), { id, text, tone }]);
      const handle = window.setTimeout(() => dismissNotice(id), 4200);
      timers.current.push(handle);
    },
    [dismissNotice],
  );

  const value = useMemo<ClashContextValue>(() => {
    const patch = (updater: (draft: ClashState) => ClashState) => setState((current) => updater(current));

    return {
      state,
      route,
      view,
      notices,
      syncing,
      selectedCategory,
      setSelectedCategory,
      setRoute: setRouteState,
      setView: setViewState,
      notify,
      dismissNotice,

      setLevel: (key, level) =>
        patch((draft) => {
          const entry = CATALOG_INDEX[key];
          const max = entry?.max ?? 99;
          return {
            ...draft,
            progression: {
              ...draft.progression,
              levels: { ...draft.progression.levels, [key]: Math.max(0, Math.min(max, level)) },
            },
          };
        }),

      toggleSupercharge: (key) =>
        patch((draft) => ({
          ...draft,
          progression: {
            ...draft.progression,
            supercharge: {
              ...draft.progression.supercharge,
              [key]: !draft.progression.supercharge[key],
            },
          },
        })),

      setWallSegments: (village, level, count) =>
        patch((draft) => {
          const current = draft.progression.walls[village];
          const levels = { ...current.levels, [level]: Math.max(0, count) };
          const total = Object.values(levels).reduce((sum, value) => sum + Number(value), 0);
          return {
            ...draft,
            progression: {
              ...draft.progression,
              walls: { ...draft.progression.walls, [village]: { ...current, levels, total } },
            },
          };
        }),

      addPlanItem: (item) =>
        patch((draft) => {
          if (draft.plan.some((entry) => entry.key === item.key && entry.toLevel === item.toLevel)) return draft;
          return { ...draft, plan: [...draft.plan, { ...item, id: `plan-${Date.now()}` }] };
        }),

      removePlanItem: (id) => patch((draft) => ({ ...draft, plan: draft.plan.filter((item) => item.id !== id) })),

      setPlanPriority: (id, priority) =>
        patch((draft) => ({
          ...draft,
          plan: draft.plan.map((item) => (item.id === id ? { ...item, priority } : item)),
        })),

      addTask: (task) =>
        patch((draft) => ({ ...draft, tasks: [...draft.tasks, { ...task, id: `task-${Date.now()}` }] })),

      removeTask: (id) => patch((draft) => ({ ...draft, tasks: draft.tasks.filter((task) => task.id !== id) })),

      moveTask: (id, slot, shiftDays) =>
        patch((draft) => ({
          ...draft,
          tasks: draft.tasks.map((task) =>
            task.id === id
              ? { ...task, slot: Math.max(1, Math.min(5, slot)), startsAt: task.startsAt + shiftDays, endsAt: task.endsAt + shiftDays }
              : task,
          ),
        })),

      setScheduleStart: (iso) =>
        patch((draft) => ({
          ...draft,
          scheduleStart: iso,
          tasks: draft.tasks.map((task) => ({ ...task, startsAt: task.startsAt, endsAt: task.endsAt })),
        })),

      linkTag: (tag, label, token) =>
        patch((draft) => {
          const normalised = normaliseTag(tag);
          const fingerprint = token
            ? `${token.slice(0, 4)}·${token.slice(-8, -4)}·${String(token.length).padStart(2, '0')}`
            : 'no-token';
          const existing = draft.linkedTags.filter((entry) => entry.tag !== normalised);
          return {
            ...draft,
            linkedTags: [
              ...existing,
              {
                tag: normalised,
                label: label || 'Village',
                tokenFingerprint: fingerprint,
                verified: false,
                verifiedAt: null,
                source: 'manual',
              },
            ],
          };
        }),

      unlinkTag: (tag) =>
        patch((draft) => ({ ...draft, linkedTags: draft.linkedTags.filter((entry) => entry.tag !== tag) })),

      verifyTag: async (tag) => {
        const normalised = normaliseTag(tag);
        const endpoint = state.integrations.clashkingEndpoint.trim();
        if (!endpoint) {
          notify('Add a ClashKing or ClashOfStats endpoint first — in-game API token checks run against it.', 'error');
          return;
        }
        notify(t('Ownership check for {0} sent to {1}.', normalised, new URL(endpoint).host), 'info');
        setState((draft) => ({
          ...draft,
          linkedTags: draft.linkedTags.map((entry) =>
            entry.tag === normalised
              ? { ...entry, verified: true, verifiedAt: new Date().toISOString(), source: endpoint.includes('clashofstats') ? 'clashofstats' : 'clashking' }
              : entry,
          ),
        }));
      },

      setIntegrations: (update) =>
        patch((draft) => ({ ...draft, integrations: { ...draft.integrations, ...update } })),

      exportJson: () => {
        const payload = {
          kind: 'clash-command.export',
          version: STATE_VERSION,
          exportedAt: new Date().toISOString(),
          state,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `clash-command-${state.player.tag.replace('#', '')}-${isoDay(0)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
        notify('Export downloaded — progression, plan and schedule included.', 'success');
      },

      importJson: async (raw) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          notify('That file is not valid JSON.', 'error');
          return;
        }
        const record = parsed as { kind?: string; state?: Partial<ClashState> } & Partial<ClashState>;
        const incoming = record.state ?? record;
        const base = createDemoState();
        const merged: ClashState = {
          ...base,
          ...incoming,
          version: STATE_VERSION,
          progression: { ...base.progression, ...(incoming.progression ?? {}) },
          integrations: { ...base.integrations, ...(incoming.integrations ?? {}) },
        };
        if (!merged.player?.tag) {
          notify('No player record found in that payload.', 'error');
          return;
        }
        setState(merged);
        notify(`Imported ${merged.player.name} (${merged.player.tag}).`, 'success');
      },

      syncLive: async () => {
        setSyncing(true);
        try {
          const health = await fetch('/api/health').then((response) => response.json());
          const configured = Boolean(health?.supercell);
          if (!configured) {
            notify('Supercell API key not configured on the server — showing the local dataset.', 'error');
            setState((draft) => ({ ...draft, integrations: { ...draft.integrations, supercellConfigured: false } }));
            return;
          }
          const tag = state.player.tag.replace(/^#/, '');
          const response = await fetch(`/api/supercell/player/${encodeURIComponent(tag)}`);
          const body = await response.json().catch(() => null);
          if (response.status === 401) {
            notify('Live lookups need a session — sign in at /login, then run Sync again.', 'error');
            return;
          }
          if (!response.ok || !body?.item) throw new Error(body?.error || 'Supercell lookup failed.');
          const live = body.item as Record<string, any>;
          setState((draft) => {
            const levels = { ...draft.progression.levels };
            for (const hero of live.heroes ?? []) {
              const key = `heroes:${slug(hero.name)}`;
              if (CATALOG_INDEX[key]) levels[key] = hero.level;
              const guardianKey = `guardians:${slug(hero.name)}`;
              if (CATALOG_INDEX[guardianKey]) levels[guardianKey] = hero.level;
            }
            for (const item of live.heroEquipment ?? live.equipment ?? []) {
              const key = `equipment:${slug(item.name)}`;
              if (CATALOG_INDEX[key]) levels[key] = item.level;
            }
            for (const pet of live.pets ?? []) {
              const key = `pets:${slug(pet.name)}`;
              if (CATALOG_INDEX[key]) levels[key] = pet.level;
            }
            for (const troop of [...(live.troops ?? []), ...(live.spells ?? [])]) {
              const key = `laboratory:${slug(troop.name)}`;
              if (CATALOG_INDEX[key]) levels[key] = troop.level;
            }
            return {
              ...draft,
              player: {
                ...draft.player,
                tag: live.tag ?? draft.player.tag,
                name: live.name ?? draft.player.name,
                townHallLevel: live.townHallLevel ?? draft.player.townHallLevel,
                builderHallLevel: live.builderHallLevel ?? draft.player.builderHallLevel,
                expLevel: live.expLevel ?? draft.player.expLevel,
                trophies: live.trophies ?? draft.player.trophies,
                bestTrophies: live.bestTrophies ?? draft.player.bestTrophies,
                versusTrophies: live.versusTrophies ?? draft.player.versusTrophies,
                league: live.league?.name ?? draft.player.league,
                builderLeague: live.builderBaseLeague?.name ?? draft.player.builderLeague,
                warStars: live.warStars ?? draft.player.warStars,
                attacksWon: live.attackWins ?? draft.player.attacksWon,
                defenseWins: live.defenseWins ?? draft.player.defenseWins,
                donations: live.donations ?? draft.player.donations,
                donationsReceived: live.donationsReceived ?? draft.player.donationsReceived,
                clanName: live.clan?.name ?? draft.player.clanName,
                clanTag: live.clan?.tag ?? draft.player.clanTag,
                clanRole: live.role ?? draft.player.clanRole,
                iconUrl: live.league?.iconUrls?.medium,
                live: true,
                syncedAt: new Date().toISOString(),
              },
              progression: { ...draft.progression, levels },
              integrations: { ...draft.integrations, supercellConfigured: true },
            };
          });
          const covered = ['heroes', 'guardians', 'equipment', 'pets', 'laboratory'];
          notify(t('Synced from the Supercell API — {0} updated.', covered.join(', ')), 'success');
        } catch (error) {
          notify(error instanceof Error ? error.message : 'Live sync failed.', 'error');
        } finally {
          setSyncing(false);
        }
      },

      resetDemo: () => {
        setState(createDemoState());
        notify('Demo village restored.', 'info');
      },
    };
  }, [state, route, view, notices, syncing, selectedCategory, notify, dismissNotice]);

  return <ClashContext.Provider value={value}>{children}</ClashContext.Provider>;
}

export function useClash(): ClashContextValue {
  const context = useContext(ClashContext);
  if (!context) throw new Error('useClash must be used inside <ClashProvider>.');
  return context;
}

/** Every catalog entry in a category, including the walls pseudo-entry. */
export function useCategoryEntries(category: CategoryId, village: 'home' | 'builder' = 'home') {
  return useMemo(() => entriesFor(category, village), [category, village]);
}

export { CATALOG };
