import { useMemo, useState } from 'react';
import { ChevronDown, Search, Shield, ShieldCheck, Swords, Users } from 'lucide-react';
import { ActionButton, AssetIcon, Bar, Card, Chip, EmptyState, SectionTitle, Sheet } from './components';
import { formatNumber, useClash } from './store';
import type { ClanMemberRow } from './types';

const ROLE_LABEL: Record<ClanMemberRow['role'], string> = {
  leader: 'Leader',
  coLeader: 'Co-Leader',
  elder: 'Elder',
  member: 'Member',
};

const SORTS = [
  { id: 'trophies', label: 'Trophies' },
  { id: 'donations', label: 'Donations' },
  { id: 'warStars', label: 'War stars' },
  { id: 'townHallLevel', label: 'Town Hall' },
] as const;

type SortId = (typeof SORTS)[number]['id'];

export function ClanView() {
  const { state, setRoute } = useClash();
  const { clan, roster, player } = state;
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortId>('trophies');
  const [warOnly, setWarOnly] = useState(false);
  const [selected, setSelected] = useState<ClanMemberRow | null>(null);
  const [familyOpen, setFamilyOpen] = useState(false);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return roster
      .filter((member) => !term || member.name.toLowerCase().includes(term) || member.tag.toLowerCase().includes(term))
      .filter((member) => !warOnly || member.warOptIn)
      .sort((a, b) => Number(b[sort]) - Number(a[sort]));
  }, [roster, query, sort, warOnly]);

  const warReady = roster.filter((member) => member.warOptIn).length;
  const donations = roster.reduce((sum, member) => sum + member.donations, 0);
  const avgTh = roster.reduce((sum, member) => sum + member.townHallLevel, 0) / Math.max(1, roster.length);

  return (
    <div className="flex flex-col gap-3.5">
      {/* -------- clan header -------- */}
      <Card className="overflow-hidden">
        <div className="flex items-start gap-3 px-4 py-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[#27272A]/50 bg-[#18181A]">
            {clan.badgeUrl ? (
              <img src={clan.badgeUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <Shield size={22} className="text-[#E52E2E]" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-bold tracking-tight text-white">{clan.name}</h2>
            <p className="text-[11px] tabular-nums text-neutral-500">
              {clan.tag} · Level {clan.level} · {clan.members} members
            </p>
            <button
              type="button"
              onClick={() => setFamilyOpen(true)}
              className="cc-tap mt-2 inline-flex items-center gap-1 rounded-full border border-[#27272A]/60 bg-[#18181A] px-2 py-1 text-[10px] font-bold text-neutral-300 hover:text-white"
            >
              <Users size={11} /> {clan.family.length} clans in family <ChevronDown size={11} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-px border-t border-[#27272A]/40 bg-[#27272A]/40">
          <Cell label="Points" value={formatNumber(clan.points)} />
          <Cell label="Versus" value={formatNumber(clan.versusPoints)} />
          <Cell label="War wins" value={formatNumber(clan.warWins)} />
          <Cell label="Streak" value={clan.warWinStreak} tone="amber" />
        </div>
      </Card>

      {/* -------- readiness -------- */}
      <Card className="p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-bold tracking-tight text-white">War readiness</h3>
            <p className="text-[10px] text-neutral-500">
              {warReady} of {roster.length} listed members opted in
            </p>
          </div>
          <ActionButton tone="neutral" className="px-2.5 py-1.5 text-[11px]" onClick={() => setRoute('war')}>
            <Swords size={12} /> War room
          </ActionButton>
        </div>
        <div className="mt-2.5">
          <Bar percent={(warReady / Math.max(1, roster.length)) * 100} tone="green" className="h-2" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Cell label="Avg TH" value={avgTh.toFixed(1)} />
          <Cell label="Donated" value={formatNumber(donations)} />
          <Cell label="War stars" value={formatNumber(roster.reduce((sum, m) => sum + m.warStars, 0))} />
        </div>
      </Card>

      {/* -------- roster controls -------- */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle title="Roster" detail={`${visible.length} members shown`} />
        <Card className="p-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or #TAG…"
              aria-label="Search roster"
              className="w-full rounded-xl border border-[#27272A]/60 bg-[#18181A] py-2.5 pl-9 pr-3 text-[13px] text-white outline-none placeholder:text-neutral-600 focus:border-[#E52E2E]/60"
            />
          </div>
          <div className="cc-no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
            {SORTS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSort(option.id)}
                className={`cc-tap shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors ${
                  sort === option.id
                    ? 'border-[#E52E2E]/50 bg-[#3B1515] text-[#FF7A7A]'
                    : 'border-[#27272A]/60 bg-[#18181A] text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setWarOnly((value) => !value)}
              className={`cc-tap shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors ${
                warOnly
                  ? 'border-[#10B981]/40 bg-[#0d2a22] text-[#34D399]'
                  : 'border-[#27272A]/60 bg-[#18181A] text-neutral-400 hover:text-neutral-200'
              }`}
            >
              War opted-in
            </button>
          </div>
        </Card>

        {visible.length === 0 ? (
          <EmptyState title="No members match" detail="Clear the search or turn off the war opted-in filter." />
        ) : (
          <Card className="divide-y divide-[#27272A]/30 overflow-hidden">
            {visible.map((member, index) => {
              const isYou = member.tag === player.tag;
              return (
                <button
                  key={member.tag}
                  type="button"
                  onClick={() => setSelected(member)}
                  className="cc-tap flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-[#121214]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#27272A]/50 bg-[#18181A] text-[11px] font-bold tabular-nums text-neutral-300">
                    {member.iconUrl ? <img src={member.iconUrl} alt="" className="h-full w-full object-contain" /> : `TH${member.townHallLevel}`}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-bold text-white">{member.name}</span>
                      {isYou ? <Chip tone="red">You</Chip> : null}
                      {member.role === 'leader' || member.role === 'coLeader' ? (
                        <ShieldCheck size={12} className="shrink-0 text-amber-400" />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-neutral-500">
                      {ROLE_LABEL[member.role]} · {member.league} · {member.expLevel} lvl
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-bold tabular-nums text-white">{formatNumber(member.trophies)}</span>
                    <span className="block text-[9px] tabular-nums text-neutral-500">
                      <span className="text-[#34D399]">{member.donations}↑</span>{' '}
                      <span className="text-neutral-600">{member.donationsReceived}↓</span>
                    </span>
                  </span>
                  <span className="w-6 shrink-0 text-right text-[10px] font-bold tabular-nums text-neutral-600">
                    {index + 1}
                  </span>
                </button>
              );
            })}
          </Card>
        )}
      </section>

      {/* -------- member sheet -------- */}
      {selected ? (
        <Sheet
          title={selected.name}
          detail={`${selected.tag} · ${ROLE_LABEL[selected.role]}`}
          onClose={() => setSelected(null)}
          footer={
            <ActionButton tone="neutral" className="w-full" onClick={() => setSelected(null)}>
              Close
            </ActionButton>
          }
        >
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-3 rounded-xl bg-[#18181A] p-3">
              <AssetIcon name={selected.name} category="heroes" iconUrl={selected.iconUrl} size={44} rounded="rounded-xl" />
              <div className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-white">Town Hall {selected.townHallLevel}</span>
                <span className="block text-[11px] text-neutral-500">
                  Level {selected.expLevel} · {selected.league}
                </span>
              </div>
              <Chip tone={selected.warOptIn ? 'green' : 'red'}>{selected.warOptIn ? 'War in' : 'War out'}</Chip>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Trophies" value={formatNumber(selected.trophies)} />
              <Stat label="War stars" value={formatNumber(selected.warStars)} />
              <Stat label="Donated" value={formatNumber(selected.donations)} />
              <Stat label="Received" value={formatNumber(selected.donationsReceived)} />
            </div>
            <div className="rounded-xl bg-[#18181A] px-3 py-2.5">
              <span className="block text-[9px] font-medium uppercase tracking-[0.08em] text-neutral-500">Last seen</span>
              <strong className="mt-0.5 block text-[13px] font-bold text-white">{selected.lastSeen}</strong>
            </div>
          </div>
        </Sheet>
      ) : null}

      {/* -------- family switcher -------- */}
      {familyOpen ? (
        <Sheet
          title="Clan family"
          detail="Switch the clan this workspace is tracking."
          onClose={() => setFamilyOpen(false)}
        >
          <div className="flex flex-col gap-2">
            {clan.family.map((entry) => {
              const active = entry.tag === clan.tag;
              return (
                <button
                  key={entry.tag}
                  type="button"
                  onClick={() => setFamilyOpen(false)}
                  className={`cc-tap flex items-center gap-3 rounded-xl border px-3 py-3 text-left ${
                    active ? 'border-[#E52E2E]/50 bg-[#3B1515]' : 'border-[#27272A]/50 bg-[#18181A]'
                  }`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#27272A]/50 bg-[#121214]">
                    <Shield size={16} className={active ? 'text-[#FF7A7A]' : 'text-neutral-500'} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-white">{entry.name}</span>
                    <span className="block truncate text-[10px] tabular-nums text-neutral-500">
                      {entry.tag} · {entry.role} · {entry.members} members
                    </span>
                  </span>
                  {active ? <Chip tone="red">Active</Chip> : null}
                </button>
              );
            })}
            <p className="text-[10px] leading-relaxed text-neutral-500">
              Switching clans re-points the tracker, calendar and war room at that clan's tag. Roster records for the other
              family clans load from the same Supercell key or JSON import.
            </p>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string | number; tone?: 'amber' }) {
  return (
    <div className="bg-[#0F0F10] px-3 py-2.5">
      <span className="block text-[9px] font-medium uppercase tracking-[0.08em] text-neutral-500">{label}</span>
      <strong className={`mt-0.5 block truncate text-[13px] font-bold tabular-nums ${tone === 'amber' ? 'text-amber-300' : 'text-white'}`}>
        {value}
      </strong>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#18181A] px-3 py-2.5">
      <span className="block text-[9px] font-medium uppercase tracking-[0.08em] text-neutral-500">{label}</span>
      <strong className="mt-0.5 block truncate text-[13px] font-bold tabular-nums text-white">{value}</strong>
    </div>
  );
}
