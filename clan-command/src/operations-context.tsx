import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'misclicked-family-ops-v1';

export type ClanIndex = 0 | 1 | 2;
export type Rsvp = 'accepted' | 'declined';
export type EventStatus = 'registration' | 'live' | 'complete';

export interface CWLDraft {
  placements: Record<string, ClanIndex>;
  suggestedBy: Record<string, string>;
  drawnTag: string | null;
  drawnTags: string[];
  locked: boolean;
  lockedAt: string | null;
  rosterMessage: string;
}

export interface EventScore {
  tag: string;
  name: string;
  clanName: string;
  score: number;
  played: number;
  wins: number;
  losses: number;
}

export interface KotHEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  rules: string;
  status: EventStatus;
  maxMatches: number;
  matchCount: number;
  rsvps: Record<string, Rsvp>;
  scores: EventScore[];
}

export interface OperationsState {
  contacts: Record<string, string>;
  cwl: CWLDraft;
  events: KotHEvent[];
  applicantSearches: string[];
}

interface OperationsContextValue extends OperationsState {
  setPhone: (personId: string, phone: string) => void;
  suggestPlacement: (tag: string, clan: ClanIndex, suggestedBy: string) => void;
  drawNextPlayer: (tag: string) => void;
  lockRoster: (message: string) => void;
  resetRosterDraft: () => void;
  addEvent: (event: Omit<KotHEvent, 'id' | 'rsvps' | 'scores' | 'matchCount'>) => string;
  removeEvent: (eventId: string) => void;
  setRsvp: (eventId: string, tag: string, status: Rsvp) => void;
  recordMatch: (eventId: string, score: Omit<EventScore, 'played' | 'wins' | 'losses'> & { result: 'win' | 'loss' | 'draw' }) => void;
  setEventStatus: (eventId: string, status: EventStatus) => void;
  trackApplicantSearch: (tag: string) => void;
}

const OperationsContext = createContext<OperationsContextValue | null>(null);

function makeId() {
  try { return crypto.randomUUID(); } catch { return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
}

function dateValue(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function seedOperations(): OperationsState {
  return {
    contacts: {},
    cwl: { placements: {}, suggestedBy: {}, drawnTag: null, drawnTags: [], locked: false, lockedAt: null, rosterMessage: '' },
    events: [
      {
        id: 'koth-live-demo', title: 'Crown Clash · King of the Hill', date: dateValue(0), startTime: '18:00',
        rules: 'Best of three attacks. Town Hall equalization is on. Stars score points; the winner gets a one-point bonus.',
        status: 'live', maxMatches: 20, matchCount: 14,
        rsvps: { '#2Q0P2YLRG': 'accepted', '#8Y2Q0P9LV': 'accepted', '#YJ2P8Q0RC': 'accepted' },
        scores: [
          { tag: '#2Q0P2YLRG', name: 'Rook Thirteen', clanName: 'Misclicked Main', score: 12, played: 4, wins: 4, losses: 0 },
          { tag: '#8Y2Q0P9LV', name: 'Ember Saint', clanName: 'Misclicked Main', score: 10, played: 4, wins: 3, losses: 1 },
          { tag: '#YJ2P8Q0RC', name: 'Lumen Arrow', clanName: 'Misclicked Feeder', score: 8, played: 3, wins: 3, losses: 0 },
          { tag: '#8P0L2JYRC', name: 'Iron Warden', clanName: 'Misclicked Academy', score: 7, played: 3, wins: 2, losses: 1 },
          { tag: '#2Y0J8QPRL', name: 'Frost Signal', clanName: 'Misclicked Feeder', score: 5, played: 3, wins: 2, losses: 1 },
          { tag: '#Q0YJ2LR8P', name: 'Nova Bell', clanName: 'Misclicked Academy', score: 3, played: 2, wins: 1, losses: 1 },
        ],
      },
      {
        id: 'koth-upcoming-demo', title: 'Iron Crown Trial', date: dateValue(3), startTime: '19:30',
        rules: 'Friendly challenge ladder. Three attacks per player; best total stars decide the King of the Hill.',
        status: 'registration', maxMatches: 30, matchCount: 0,
        rsvps: { '#2Q0P2YLRG': 'accepted', '#8P0L2JYRC': 'accepted', '#Q0YJ2LR8P': 'declined' }, scores: [],
      },
    ],
    applicantSearches: [],
  };
}

function readStoredState(): OperationsState {
  const seeded = seedOperations();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seeded;
    const saved = JSON.parse(raw) as Partial<OperationsState>;
    return {
      ...seeded,
      ...saved,
      contacts: saved.contacts && typeof saved.contacts === 'object' ? saved.contacts : seeded.contacts,
      cwl: { ...seeded.cwl, ...(saved.cwl || {}) },
      events: Array.isArray(saved.events) ? saved.events : seeded.events,
      applicantSearches: Array.isArray(saved.applicantSearches) ? saved.applicantSearches : [],
    };
  } catch {
    return seeded;
  }
}

export function OperationsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OperationsState>(readStoredState);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Demo state remains usable for this tab when storage is restricted. */ }
  }, [state]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try { setState(JSON.parse(event.newValue) as OperationsState); } catch { /* Ignore incomplete cross-tab writes. */ }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPhone = useCallback((personId: string, phone: string) => {
    setState((current) => ({ ...current, contacts: { ...current.contacts, [personId]: phone } }));
  }, []);

  const suggestPlacement = useCallback((tag: string, clan: ClanIndex, suggestedBy: string) => {
    setState((current) => current.cwl.locked ? current : ({
      ...current,
      cwl: {
        ...current.cwl,
        placements: { ...current.cwl.placements, [tag]: clan },
        suggestedBy: { ...current.cwl.suggestedBy, [tag]: suggestedBy },
      },
    }));
  }, []);

  const drawNextPlayer = useCallback((tag: string) => {
    setState((current) => ({ ...current, cwl: { ...current.cwl, drawnTag: tag, drawnTags: [...current.cwl.drawnTags, tag] } }));
  }, []);

  const lockRoster = useCallback((message: string) => {
    setState((current) => ({ ...current, cwl: { ...current.cwl, locked: true, lockedAt: new Date().toISOString(), rosterMessage: message } }));
  }, []);

  const resetRosterDraft = useCallback(() => {
    setState((current) => ({ ...current, cwl: { ...current.cwl, locked: false, lockedAt: null, rosterMessage: '' } }));
  }, []);

  const addEvent = useCallback((event: Omit<KotHEvent, 'id' | 'rsvps' | 'scores' | 'matchCount'>) => {
    const id = makeId();
    setState((current) => ({ ...current, events: [{ ...event, id, rsvps: {}, scores: [], matchCount: 0 }, ...current.events] }));
    return id;
  }, []);

  const removeEvent = useCallback((eventId: string) => {
    setState((current) => ({ ...current, events: current.events.filter((event) => event.id !== eventId) }));
  }, []);

  const setRsvp = useCallback((eventId: string, tag: string, status: Rsvp) => {
    setState((current) => ({
      ...current,
      events: current.events.map((event) => event.id === eventId ? { ...event, rsvps: { ...event.rsvps, [tag]: status } } : event),
    }));
  }, []);

  const recordMatch = useCallback((eventId: string, input: Omit<EventScore, 'played' | 'wins' | 'losses'> & { result: 'win' | 'loss' | 'draw' }) => {
    setState((current) => ({
      ...current,
      events: current.events.map((event) => {
        if (event.id !== eventId) return event;
        const found = event.scores.find((row) => row.tag === input.tag);
        const bonusPoint = input.result === 'win' ? 1 : 0;
        const score = { ...input, score: (found?.score || 0) + input.score + bonusPoint, played: (found?.played || 0) + 1, wins: (found?.wins || 0) + Number(input.result === 'win'), losses: (found?.losses || 0) + Number(input.result === 'loss') };
        const scores = found ? event.scores.map((row) => row.tag === input.tag ? score : row) : [...event.scores, score];
        const matchCount = Math.min(event.maxMatches, event.matchCount + 1);
        return { ...event, scores, matchCount, status: matchCount >= event.maxMatches ? 'complete' as const : event.status };
      }),
    }));
  }, []);

  const setEventStatus = useCallback((eventId: string, status: EventStatus) => {
    setState((current) => ({ ...current, events: current.events.map((event) => event.id === eventId ? { ...event, status } : event) }));
  }, []);

  const trackApplicantSearch = useCallback((tag: string) => {
    setState((current) => ({ ...current, applicantSearches: [tag, ...current.applicantSearches.filter((item) => item !== tag)].slice(0, 8) }));
  }, []);

  const value = useMemo<OperationsContextValue>(() => ({
    ...state, setPhone, suggestPlacement, drawNextPlayer, lockRoster, resetRosterDraft,
    addEvent, removeEvent, setRsvp, recordMatch, setEventStatus, trackApplicantSearch,
  }), [state, setPhone, suggestPlacement, drawNextPlayer, lockRoster, resetRosterDraft, addEvent, removeEvent, setRsvp, recordMatch, setEventStatus, trackApplicantSearch]);

  return <OperationsContext.Provider value={value}>{children}</OperationsContext.Provider>;
}

export function useOperations() {
  const context = useContext(OperationsContext);
  if (!context) throw new Error('useOperations must be used inside OperationsProvider.');
  return context;
}
