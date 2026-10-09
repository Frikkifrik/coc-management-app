import { ProxyAgent, fetch as undiciFetch } from 'undici';

const apiBase = process.env.SUPERCELL_API_BASE_URL || 'https://api.clashofclans.com/v1';

function configuration() {
  const apiKey = process.env.SUPERCELL_API_KEY?.trim();
  const proxyUrl = process.env.SUPERCELL_STATIC_IP_PROXY_URL?.trim();
  if (!apiKey || !proxyUrl) return null;
  const parsed = new URL(proxyUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('The Supercell static-IP proxy must use HTTP or HTTPS.');
  return { apiKey, proxyUrl };
}

export function isSupercellConfigured() {
  try { return Boolean(configuration()); } catch { return false; }
}

/** All live game API traffic exits through the configured static-egress proxy. */
export async function supercellLookup(kind, rawTag) {
  const config = configuration();
  if (!config) return { configured: false, item: null };
  const tag = String(rawTag || '').trim().toUpperCase().replace(/^#?/, '#');
  if (!/^#[0-9A-Z]{3,16}$/.test(tag)) throw new Error('Enter a valid Supercell player or clan tag.');
  const resource = kind === 'player' ? 'players' : kind === 'clan' ? 'clans' : null;
  if (!resource) throw new Error('Unsupported Supercell resource.');

  const target = new URL(`${resource}/${encodeURIComponent(tag)}`, `${apiBase.replace(/\/$/, '')}/`);
  const dispatcher = new ProxyAgent(config.proxyUrl);
  try {
    const response = await undiciFetch(target, {
      method: 'GET', dispatcher, redirect: 'error', signal: AbortSignal.timeout(8000),
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
    await dispatcher.close();
  }
}
