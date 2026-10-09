import { fetch as undiciFetch, ProxyAgent } from 'undici';

const apiBase = process.env.SUPERCELL_API_BASE_URL || 'https://api.clashofclans.com/v1';

function configuration() {
  const apiKey = process.env.SUPERCELL_API_KEY?.trim();
  let proxyUrl = (process.env.SUPERCELL_STATIC_IP_PROXY_URL || process.env.SUPERCELL_PROXY_URL)?.trim() || '';

  if (!apiKey) return null;

  if (proxyUrl) {
    if (!/^https?:\/\//i.test(proxyUrl)) {
      proxyUrl = `http://${proxyUrl}`;
    }
    try {
      new URL(proxyUrl);
    } catch {
      proxyUrl = '';
    }
  }

  return { apiKey, proxyUrl };
}

export function isSupercellConfigured() {
  return Boolean(configuration());
}

export async function supercellLookup(kind, rawTag) {
  const config = configuration();
  if (!config) return { configured: false, item: null };

  const tag = String(rawTag || '').trim().toUpperCase().replace(/^#?/, '#');
  if (!/^#[0-9A-Z]{3,16}$/.test(tag)) throw new Error('Enter a valid Supercell player or clan tag.');

  const resource = kind === 'player' ? 'players' : kind === 'clan' ? 'clans' : null;
  if (!resource) throw new Error('Unsupported Supercell resource.');

  const target = new URL(`${resource}/${encodeURIComponent(tag)}`, `${apiBase.replace(/\/$/, '')}/`);

  let dispatcher;
  if (config.proxyUrl) {
    try {
      dispatcher = new ProxyAgent(config.proxyUrl);
    } catch (err) {
      console.warn('Invalid proxy URL format, falling back to direct connection:', err.message);
      dispatcher = undefined;
    }
  }

  try {
    const response = await undiciFetch(target, {
      method: 'GET',
      ...(dispatcher ? { dispatcher } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json', Authorization: `Bearer ${config.apiKey}` },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(body?.message || `Supercell API returned ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return { configured: true, item: body };
  } finally {
    if (dispatcher) await dispatcher.close();
  }
}