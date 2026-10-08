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
