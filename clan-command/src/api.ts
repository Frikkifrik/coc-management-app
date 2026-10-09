let clientSessionToken: string | null = null;

export function setApiSessionToken(token?: string) {
  clientSessionToken = token || null;
  try {
    if (token) window.sessionStorage.setItem('clan-command-session-token', token);
    else window.sessionStorage.removeItem('clan-command-session-token');
  } catch { /* Some embedded previews restrict storage; the in-memory token still works for this tab. */ }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let requestPath = path;
  if (path.startsWith('/api/') && !['/api/auth/login','/api/auth/demo-login'].includes(path.split('?')[0])) {
    try {
      const token = clientSessionToken || window.sessionStorage.getItem('clan-command-session-token');
      if (token) {
        if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
        const separator = requestPath.includes('?') ? '&' : '?';
        requestPath = `${requestPath}${separator}__cc_session=${encodeURIComponent(token)}`;
      }
    } catch { /* The in-memory token remains usable when browser storage is unavailable. */ }
  }
  const response = await fetch(requestPath, { ...init, headers, credentials: 'same-origin' });
  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new ApiError(result?.error || `Request failed (${response.status}).`, response.status);
  return result as T;
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}

// Live Supercell proxy call via local server
export async function fetchLivePlayer<T = unknown>(tag: string): Promise<T> {
  // Remove leading '#' so the browser doesn't truncate the URL as a hash fragment
  const cleanTag = tag.trim().replace(/^#/, '');
  const response = await apiRequest<{ item: T }>(`/api/supercell/player/${encodeURIComponent(cleanTag)}`);
  return response.item;
}

// --- Clan Types ---

export interface ClanMember {
  tag: string;
  name: string;
  role: 'leader' | 'coLeader' | 'admin' | 'member';
  expLevel: number;
  league?: {
    id: number;
    name: string;
    iconUrls: { small: string; tiny: string; medium?: string };
  };
  trophies: number;
  versusTrophies?: number;
  clanRank: number;
  previousClanRank: number;
  donations: number;
  donationsReceived: number;
}

export interface ClanData {
  tag: string;
  name: string;
  type: 'open' | 'inviteOnly' | 'closed';
  description?: string;
  location?: { id: number; name: string; isCountry: boolean; countryCode: string };
  badgeUrls: { small: string; large: string; medium: string };
  clanLevel: number;
  clanPoints: number;
  clanVersusPoints?: number;
  requiredTrophies: number;
  warFrequency?: string;
  warWinStreak: number;
  warWins: number;
  warTies?: number;
  warLosses?: number;
  isWarLogPublic: boolean;
  members: number;
  memberList: ClanMember[];
}

// --- Clan API Fetch Helper ---

// --- Clan Types ---

export interface ClanMember {
  tag: string;
  name: string;
  role: 'leader' | 'coLeader' | 'admin' | 'member';
  expLevel: number;
  league?: {
    id: number;
    name: string;
    iconUrls: { small: string; tiny: string; medium?: string };
  };
  trophies: number;
  versusTrophies?: number;
  clanRank: number;
  previousClanRank: number;
  donations: number;
  donationsReceived: number;
}

export interface ClanData {
  tag: string;
  name: string;
  type: 'open' | 'inviteOnly' | 'closed';
  description?: string;
  location?: { id: number; name: string; isCountry: boolean; countryCode: string };
  badgeUrls: { small: string; large: string; medium: string };
  clanLevel: number;
  clanPoints: number;
  clanVersusPoints?: number;
  requiredTrophies: number;
  warFrequency?: string;
  warWinStreak: number;
  warWins: number;
  warTies?: number;
  warLosses?: number;
  isWarLogPublic: boolean;
  members: number;
  memberList: ClanMember[];
}

// --- Clan API Fetch Helper ---

export async function getClanByTag(tag: string): Promise<ClanData> {
  const cleanTag = tag.trim().replace(/^#/, '');
  
  if (!cleanTag) {
    throw new Error('Please enter a valid Clan Tag.');
  }

  const response = await fetch(`/api/supercell/clan/${encodeURIComponent(cleanTag)}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch clan (Status: ${response.status})`);
  }

  return response.json();
}