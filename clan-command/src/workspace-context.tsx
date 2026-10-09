import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiRequest, jsonBody, setApiSessionToken } from './api';
import type { AppRole, DiscordIntegration, Member, ProgressEvent, ResourceName, RewardClaim, User, WorkspaceData } from './types';

type CollectionRow = { id: string };
type SessionReply = { user: User | null; demoMode: boolean };
type AuthReply = { user: User; demoMode: boolean; sessionToken?: string };
type BootstrapReply = { user: User; data: WorkspaceData };

function storeClientSession(token?: string) {
  setApiSessionToken(token);
}
type Notice = { id: number; text: string; error?: boolean };

type WorkspaceContextValue = {
  user: User | null;
  data: WorkspaceData | null;
  demoMode: boolean;
  loading: boolean;
  authChecking: boolean;
  notices: Notice[];
  signIn: (email: string, password: string) => Promise<void>;
  signInDemo: (role: AppRole) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  save: (resource: ResourceName, id: string | null, payload: Record<string, unknown>) => Promise<CollectionRow>;
  remove: (resource: ResourceName, id: string) => Promise<void>;
  addHistory: (payload: Record<string, unknown>) => Promise<ProgressEvent>;
  claimReward: (rewardId: string) => Promise<RewardClaim>;
  updateClaim: (claimId: string, status: RewardClaim['status']) => Promise<RewardClaim>;
  saveIntegration: (payload: Record<string, unknown>) => Promise<DiscordIntegration>;
  saveUser: (id: string | null, payload: Record<string, unknown>) => Promise<User>;
  removeUser: (id: string) => Promise<void>;
  dismissNotice: (id: number) => void;
  notify: (message: string, error?: boolean) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const paths: Record<ResourceName, string> = {
  members: '/api/members', clans: '/api/clans', wars: '/api/wars', alerts: '/api/alerts', rewards: '/api/rewards',
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);

  const notify = useCallback((text: string, error = false) => {
    const item = { id: Date.now() + Math.round(Math.random() * 1000), text, error };
    setNotices((current) => [...current.slice(-2), item]);
    window.setTimeout(() => setNotices((current) => current.filter((notice) => notice.id !== item.id)), 4200);
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await apiRequest<BootstrapReply>('/api/bootstrap');
      setUser(response.user);
      setData(response.data);
      setDemoMode(response.data.demoMode);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Workspace could not be refreshed.';
      if ((error as { status?: number }).status === 401) {
        setUser(null);
        setData(null);
      } else notify(message, true);
    } finally {
      setLoading(false);
    }
  }, [user, notify]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const session = await apiRequest<SessionReply>('/api/auth/session');
        if (!active) return;
        setDemoMode(session.demoMode);
        if (!session.user) { storeClientSession(); return; }
        const bootstrap = await apiRequest<BootstrapReply>('/api/bootstrap');
        if (!active) return;
        setUser(bootstrap.user);
        setData(bootstrap.data);
      } catch {
        if (active) {
          setUser(null);
          setData(null);
        }
      } finally {
        if (active) setAuthChecking(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const acceptSession = useCallback(async (session: { user: User; demoMode?: boolean }) => {
    setDemoMode(Boolean(session.demoMode));
    setLoading(true);
    try {
      const bootstrap = await apiRequest<BootstrapReply>('/api/bootstrap');
      setUser(bootstrap.user);
      setData(bootstrap.data);
      setDemoMode(bootstrap.data.demoMode);
    } catch (error) {
      storeClientSession();
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
      setAuthChecking(false);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await apiRequest<AuthReply>('/api/auth/login', { method: 'POST', body: jsonBody({ email, password }) });
    storeClientSession(session.sessionToken);
    await acceptSession(session);
    notify('Welcome back. Your clan workspace is ready.');
  }, [acceptSession, notify]);

  const signInDemo = useCallback(async (role: AppRole) => {
    const session = await apiRequest<AuthReply>('/api/auth/demo-login', { method: 'POST', body: jsonBody({ role }) });
    storeClientSession(session.sessionToken);
    await acceptSession(session);
    notify(`Demo workspace opened as ${role.replace('_', ' ')}.`);
  }, [acceptSession, notify]);

  const signOut = useCallback(async () => {
    try { await apiRequest('/api/auth/logout', { method: 'POST' }); } catch { /* local sign-out still wins */ }
    storeClientSession();
    setUser(null);
    setData(null);
  }, []);

  const save = useCallback(async (resource: ResourceName, entityId: string | null, payload: Record<string, unknown>) => {
    if (!data) throw new Error('Workspace is still loading.');
    const key = resource as keyof Pick<WorkspaceData, 'members' | 'clans' | 'wars' | 'alerts' | 'rewards'>;
    const previous = [...(data[key] as unknown as CollectionRow[])];
    const localId = entityId || `optimistic-${crypto.randomUUID()}`;
    const optimistic = { ...payload, id: localId } as CollectionRow;
    setData((current) => {
      if (!current) return current;
      const rows = current[key] as unknown as CollectionRow[];
      const exists = rows.some((row) => row.id === entityId);
      const next = exists ? rows.map((row) => row.id === entityId ? { ...row, ...optimistic } : row) : [optimistic, ...rows];
      return { ...current, [key]: next };
    });
    try {
      const method = entityId ? 'PATCH' : 'POST';
      const endpoint = entityId ? `${paths[resource]}/${encodeURIComponent(entityId)}` : paths[resource];
      const response = await apiRequest<{ item: CollectionRow }>(endpoint, { method, body: jsonBody(payload) });
      setData((current) => {
        if (!current) return current;
        const rows = current[key] as unknown as CollectionRow[];
        return { ...current, [key]: rows.map((row) => row.id === localId || row.id === entityId ? response.item : row) };
      });
      notify(entityId ? 'Changes saved.' : 'Added to the clan workspace.');
      void refresh();
      return response.item;
    } catch (error) {
      setData((current) => current ? { ...current, [key]: previous } : current);
      const message = error instanceof Error ? error.message : 'Changes could not be saved.';
      notify(message, true);
      throw error;
    }
  }, [data, notify, refresh]);

  const remove = useCallback(async (resource: ResourceName, entityId: string) => {
    if (!data) return;
    const key = resource as keyof Pick<WorkspaceData, 'members' | 'clans' | 'wars' | 'alerts' | 'rewards'>;
    const previous = [...(data[key] as unknown as CollectionRow[])];
    setData((current) => current ? { ...current, [key]: (current[key] as unknown as CollectionRow[]).filter((row) => row.id !== entityId) } : current);
    try {
      await apiRequest(`${paths[resource]}/${encodeURIComponent(entityId)}`, { method: 'DELETE' });
      notify('Record removed.');
      void refresh();
    } catch (error) {
      setData((current) => current ? { ...current, [key]: previous } : current);
      const message = error instanceof Error ? error.message : 'Record could not be removed.';
      notify(message, true);
      throw error;
    }
  }, [data, notify, refresh]);

  const addHistory = useCallback(async (payload: Record<string, unknown>) => {
    if (!data) throw new Error('Workspace is still loading.');
    const before = [...data.history];
    const temp = { id: `optimistic-${crypto.randomUUID()}`, playerId: String(payload.playerId || ''), playerName: 'New event', playerTag: '', clanName: '', eventType: String(payload.eventType || 'note'), title: String(payload.title || 'New event'), details: String(payload.details || ''), fromValue: null, toValue: null, createdAt: new Date().toISOString() } as ProgressEvent;
    setData((current) => current ? { ...current, history: [temp, ...current.history] } : current);
    try {
      const result = await apiRequest<{ item: ProgressEvent }>('/api/history', { method: 'POST', body: jsonBody(payload) });
      setData((current) => current ? { ...current, history: current.history.map((event) => event.id === temp.id ? result.item : event) } : current);
      notify('Progression event recorded.');
      void refresh();
      return result.item;
    } catch (error) {
      setData((current) => current ? { ...current, history: before } : current);
      const message = error instanceof Error ? error.message : 'Progression could not be saved.';
      notify(message, true);
      throw error;
    }
  }, [data, notify, refresh]);

  const claimReward = useCallback(async (rewardId: string) => {
    if (!data || !user) throw new Error('Sign in to request a reward.');
    const beforeClaims = [...data.claims];
    const beforeMembers = [...data.members];
    const reward = data.rewards.find((item) => item.id === rewardId);
    const member = data.members.find((item) => item.id === user.playerId);
    if (!reward || !member) throw new Error('Reward or linked base could not be found.');
    const temp = { id: `optimistic-${crypto.randomUUID()}`, playerId: member.id, playerName: member.name, playerTag: member.tag, rewardId, rewardName: reward.name, pointsCost: reward.pointsCost, status: 'pending', requestedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as RewardClaim;
    setData((current) => current ? { ...current, claims: [temp, ...current.claims], members: current.members.map((item) => item.id === member.id ? { ...item, rewardPoints: Math.max(0, item.rewardPoints - reward.pointsCost) } : item) } : current);
    try {
      const result = await apiRequest<{ item: RewardClaim; member?: Member }>('/api/claims', { method: 'POST', body: jsonBody({ rewardId }) });
      setData((current) => current ? { ...current, claims: current.claims.map((claim) => claim.id === temp.id ? result.item : claim), members: result.member ? current.members.map((item) => item.id === result.member!.id ? result.member! : item) : current.members } : current);
      notify('Reward request sent to leadership.');
      return result.item;
    } catch (error) {
      setData((current) => current ? { ...current, claims: beforeClaims, members: beforeMembers } : current);
      const message = error instanceof Error ? error.message : 'Reward request could not be sent.';
      notify(message, true);
      throw error;
    }
  }, [data, notify, user]);

  const updateClaim = useCallback(async (claimId: string, status: RewardClaim['status']) => {
    if (!data) throw new Error('Workspace is still loading.');
    const before = [...data.claims];
    setData((current) => current ? { ...current, claims: current.claims.map((item) => item.id === claimId ? { ...item, status, updatedAt: new Date().toISOString() } : item) } : current);
    try {
      const result = await apiRequest<{ item: RewardClaim; member?: Member }>(`/api/claims/${encodeURIComponent(claimId)}`, { method: 'PATCH', body: jsonBody({ status }) });
      setData((current) => current ? { ...current, claims: current.claims.map((item) => item.id === claimId ? result.item : item), members: result.member ? current.members.map((member) => member.id === result.member!.id ? result.member! : member) : current.members } : current);
      notify(`Reward request ${status}.`);
      return result.item;
    } catch (error) {
      setData((current) => current ? { ...current, claims: before } : current);
      const message = error instanceof Error ? error.message : 'Reward request could not be updated.';
      notify(message, true);
      throw error;
    }
  }, [data, notify]);

  const saveIntegration = useCallback(async (payload: Record<string, unknown>) => {
    const before = data?.integration || null;
    setData((current) => current ? { ...current, integration: { ...(current.integration || { id: 'discord', enabled: false, guildId: '', channelLabel: '', notifications: { warReminders: true, cwlLineup: true, memberMilestones: true, rankedMovement: false, applicantAlerts: true }, webhookConfigured: false, updatedAt: new Date().toISOString() }), ...payload } as DiscordIntegration } : current);
    try {
      const result = await apiRequest<{ item: DiscordIntegration }>('/api/integrations/discord', { method: 'PUT', body: jsonBody(payload) });
      setData((current) => current ? { ...current, integration: result.item } : current);
      notify('Discord settings saved.');
      return result.item;
    } catch (error) {
      setData((current) => current ? { ...current, integration: before } : current);
      const message = error instanceof Error ? error.message : 'Discord settings could not be saved.';
      notify(message, true);
      throw error;
    }
  }, [data, notify]);

  const saveUser = useCallback(async (accountId: string | null, payload: Record<string, unknown>) => {
    if (!data) throw new Error('Workspace is still loading.');
    const previous = [...data.users];
    const tempId = accountId || `optimistic-${crypto.randomUUID()}`;
    const local = { ...payload, id: tempId, isActive: (payload.isActive as boolean | undefined) ?? true } as unknown as User;
    setData((current) => current ? { ...current, users: accountId ? current.users.map((item) => item.id === accountId ? { ...item, ...local } : item) : [local, ...current.users] } : current);
    try {
      const result = await apiRequest<{ item: User }>(accountId ? `/api/users/${encodeURIComponent(accountId)}` : '/api/users', { method: accountId ? 'PATCH' : 'POST', body: jsonBody(payload) });
      setData((current) => current ? { ...current, users: current.users.map((item) => item.id === tempId || item.id === accountId ? result.item : item) } : current);
      notify(accountId ? 'Account updated.' : 'Account created.');
      void refresh();
      return result.item;
    } catch (error) {
      setData((current) => current ? { ...current, users: previous } : current);
      const message = error instanceof Error ? error.message : 'Account could not be saved.';
      notify(message, true);
      throw error;
    }
  }, [data, notify, refresh]);

  const removeUser = useCallback(async (accountId: string) => {
    if (!data) return;
    const previous = [...data.users];
    setData((current) => current ? { ...current, users: current.users.filter((item) => item.id !== accountId) } : current);
    try {
      await apiRequest(`/api/users/${encodeURIComponent(accountId)}`, { method: 'DELETE' });
      notify('Account deleted.');
    } catch (error) {
      setData((current) => current ? { ...current, users: previous } : current);
      const message = error instanceof Error ? error.message : 'Account could not be deleted.';
      notify(message, true);
      throw error;
    }
  }, [data, notify]);

  const dismissNotice = useCallback((noticeId: number) => setNotices((items) => items.filter((item) => item.id !== noticeId)), []);

  const value = useMemo<WorkspaceContextValue>(() => ({
    user, data, demoMode, loading, authChecking, notices, signIn, signInDemo, signOut, refresh, save, remove, addHistory,
    claimReward, updateClaim, saveIntegration, saveUser, removeUser, dismissNotice, notify,
  }), [user,data,demoMode,loading,authChecking,notices,signIn,signInDemo,signOut,refresh,save,remove,addHistory,claimReward,updateClaim,saveIntegration,saveUser,removeUser,dismissNotice,notify]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider.');
  return context;
}
