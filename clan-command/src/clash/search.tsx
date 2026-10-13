import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { apiRequest } from '../api';
import { useI18n } from './i18n';
import { ActionButton, AssetIcon, Chip, EmptyState, Sheet } from './components';

/**
 * GLOBAL TAG SEARCH
 *
 * One search field, pinned under the header on every screen. It takes either a
 * player or a clan tag, normalises it (a missing `#` is added, letters are
 * uppercased, stray spaces and the zero-width characters Clash tags pick up when
 * copied in-game are stripped), asks `/api/public-search`, and then routes the
 * app to the matching screen — Clan for a clan tag, the player tracker for a
 * player tag — with the profile drawer already open.
 *
 * `/api/public-search` is deliberately public: it returns game-profile fields
 * and membership milestones only, never contact details or leadership notes.
 */

export interface PublicProfile {
  tag: string;
  name: string;
  townHall: number;
  trophies: number;
  clanName: string;
  clanTag: string;
  active: boolean;
  rushPercent: number;
  labPurity: number;
  threeStarRate: number;
  warStars: number;
  heroEquipment: Array<{ name: string; level: number }>;
  mockMetrics?: boolean;
}

export interface SearchReply {
  kind: 'player' | 'clan' | 'none';
  query: string;
  clan?: { name: string; tag: string; clanLevel: number; league: string; trophies: number };
  items: PublicProfile[];
}

/**
 * Normalise whatever the user typed into a canonical tag. Returns null when
 * there is nothing usable, so the caller can show a validation message instead
 * of firing a request that cannot match.
 */
export function normaliseSearchTag(raw: string): string | null {
  // \u200b and friends ride along when a tag is copied out of the game client.
  const cleaned = raw.replace(/[\u200b-\u200f\u00a0]/g, '').replace(/\s+/g, '').toUpperCase();
  if (!cleaned) return null;
  const tag = cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
  return tag;
}

export async function searchTag(tag: string): Promise<SearchReply> {
  return apiRequest<SearchReply>(`/api/public-search?q=${encodeURIComponent(tag)}`);
}

/* ------------------------------------------------------------------ */
/* Shared result rendering — used by the header search and the clan     */
/* scout sheet, so both entry points describe a profile identically.    */
/* ------------------------------------------------------------------ */

export function ScoutResult({ result }: { result: SearchReply | null }) {
  const { t } = useI18n();
  if (!result) return null;

  if (result.kind === 'none') {
    return (
      <EmptyState
        title={t('No match')}
        detail={t('Check the tag and try again. Search takes a player #PLAYERTAG or a clan #CLANTAG.')}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {result.kind === 'clan' && result.clan ? (
        <div className="rounded-xl bg-[#18181A] px-3 py-2.5">
          <span className="block text-[13px] font-bold text-white">{result.clan.name}</span>
          <span className="block text-[10px] tabular-nums text-neutral-500">
            {result.clan.tag} · {t('Level')} {result.clan.clanLevel} · {result.clan.league}
          </span>
        </div>
      ) : null}

      {result.items.length ? (
        <ul className="flex flex-col gap-2">
          {result.items.map((profile) => (
            <li key={profile.tag} className="rounded-xl border border-[#27272A]/40 bg-[#18181A] p-3">
              <div className="flex items-center gap-2.5">
                <AssetIcon name={profile.name} category="heroes" size={34} rounded="rounded-lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-white">{profile.name}</span>
                  <span className="block truncate text-[10px] tabular-nums text-neutral-500">
                    {profile.tag} · TH{profile.townHall} · {profile.clanName}
                  </span>
                </span>
                <Chip tone={profile.active ? 'green' : 'neutral'}>
                  {profile.active ? t('Active') : t('Former')}
                </Chip>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <ScoutMetric label={t('Rush est.')} value={`${profile.rushPercent}%`} percent={profile.rushPercent} tone={profile.rushPercent < 15 ? 'green' : 'royal'} />
                <ScoutMetric label={t('Lab purity')} value={`${profile.labPurity}%`} percent={profile.labPurity} tone="green" />
                <ScoutMetric label={t('War 3★')} value={`${profile.threeStarRate}%`} percent={profile.threeStarRate} tone="blue" />
              </div>
              {profile.heroEquipment?.length ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {profile.heroEquipment.slice(0, 6).map((item) => (
                    <Chip key={item.name}>
                      {item.name} · {item.level}
                    </Chip>
                  ))}
                </div>
              ) : null}
              <p className="mt-2 text-[9px] text-neutral-600">
                {profile.mockMetrics
                  ? t('Rush, lab and war figures are demo estimates, not live game data.')
                  : t('Figures from the stored game profile.')}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ScoutMetric({
  label,
  value,
  percent,
  tone,
}: {
  label: string;
  value: string;
  percent: number;
  tone: 'green' | 'royal' | 'blue';
}) {
  const { t } = useI18n();
  const bar =
    tone === 'green' ? 'bg-[#10B981]' : tone === 'blue' ? 'bg-[#38BDF8]' : 'bg-[#2563EB]';
  return (
    <div className="rounded-lg bg-[#121214] px-2 py-1.5">
      <span className="block text-[8px] font-medium uppercase tracking-[0.06em] text-neutral-500">{label}</span>
      <strong className="block text-[12px] font-bold tabular-nums text-white">{value}</strong>
      <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-[#1F1F22]">
        <span className={`block h-full rounded-full ${bar}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </span>
      <span className="sr-only">{t('Level')}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The sticky bar itself                                               */
/* ------------------------------------------------------------------ */

export function GlobalSearchBar({
  onResult,
  onOpenProfile,
}: {
  /** Fired with the reply so the caller can route to the right screen. */
  onResult: (reply: SearchReply) => void;
  /** Opens the profile drawer for the searched tag. */
  onOpenProfile: (tag: string) => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tag = normaliseSearchTag(value);
    if (!tag) {
      setError(t('Enter a player or clan tag.'));
      return;
    }
    setValue(tag);
    setBusy(true);
    setError('');
    try {
      const reply = await searchTag(tag);
      if (reply.kind === 'none') {
        setError(t('No match'));
        return;
      }
      onResult(reply);
      onOpenProfile(tag);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('Public search is unavailable.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1">
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-3 text-neutral-600">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
        </span>
        <input
          type="search"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError('');
          }}
          placeholder={t('Search by #playertag or #clantag...')}
          aria-label={t('Search by #playertag or #clantag...')}
          enterKeyHint="search"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-xl border border-[#27272A]/60 bg-[#121214] py-2.5 pl-9 pr-9 text-[12px] uppercase tabular-nums text-white outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-neutral-600 focus:border-[#2563EB]/60"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue('');
              setError('');
            }}
            aria-label={t('Clear search')}
            className="cc-tap absolute right-2 grid h-6 w-6 place-items-center rounded-lg text-neutral-500 hover:text-white"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
      {error ? <p className="px-1 text-[10px] text-[#93C5FD]">{error}</p> : null}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer the header search opens                                      */
/* ------------------------------------------------------------------ */

export function ScoutDrawer({
  tag,
  onClose,
}: {
  tag: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [result, setResult] = useState<SearchReply | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  // Look the tag up as soon as the drawer opens.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const reply = await searchTag(tag);
        if (!cancelled) setResult(reply);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : t('Public search is unavailable.'));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tag, t]);

  return (
    <Sheet
      title={result?.clan?.name ?? result?.items[0]?.name ?? tag}
      detail={t('Public player and clan lookup — no sign-in needed.')}
      onClose={onClose}
      footer={
        <ActionButton tone="neutral" className="w-full" onClick={onClose}>
          {t('Close')}
        </ActionButton>
      }
    >
      {busy ? (
        <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-neutral-500">
          <Loader2 size={14} className="animate-spin" /> {t('Searching…')}
        </div>
      ) : error ? (
        <p className="rounded-xl border border-[#2563EB]/40 bg-[#0F172A] px-3 py-2 text-[11px] text-[#93C5FD]">{error}</p>
      ) : (
        <ScoutResult result={result} />
      )}
    </Sheet>
  );
}
