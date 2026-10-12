import { useMemo, useState } from 'react';
import { Clock, Crown, Flame, Shield, Star, Swords, Target, Trophy } from 'lucide-react';
import { ActionButton, AssetIcon, Bar, Card, Chip, InnerBox, SectionTitle, Sheet } from './components';
import { formatNumber, useClash } from './store';
import type { WarRound } from './types';

function countdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export function WarView() {
  const { state, setRoute } = useClash();
  const { currentWar, warLog, clan, player } = state;
  const [selected, setSelected] = useState<WarRound | null>(null);

  const starTotal = Math.max(currentWar.stars, currentWar.opponentStars, 1);
  const homeStarPct = (currentWar.stars / starTotal) * 100;
  const awayStarPct = (currentWar.opponentStars / starTotal) * 100;

  const groupStandings = useMemo(
    () =>
      warLog
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 8),
    [warLog],
  );

  const totals = useMemo(() => {
    const wins = warLog.reduce((sum, round) => sum + round.wins, 0);
    const ties = warLog.reduce((sum, round) => sum + round.ties, 0);
    const losses = warLog.reduce((sum, round) => sum + round.losses, 0);
    const stars = warLog.reduce((sum, round) => sum + round.stars, 0);
    const destruction = warLog.reduce((sum, round) => sum + round.destruction, 0) / (warLog.length || 1);
    return { wins, ties, losses, stars, destruction };
  }, [warLog]);

  return (
    <div className="flex flex-col gap-3.5">
      {/* -------- live war -------- */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[#27272A]/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-[#E52E2E]/40 bg-[#3B1515] text-[#FF7A7A]">
              <Swords size={16} />
            </span>
            <div>
              <h2 className="text-[14px] font-bold tracking-tight text-white">
                {currentWar.state === 'warDay' ? 'War Day' : currentWar.state === 'preparation' ? 'Preparation' : 'Finished'}
              </h2>
              <p className="text-[10px] text-neutral-500">
                {currentWar.size} v {currentWar.size} · vs {currentWar.opponent}
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1 rounded-full border border-[#27272A]/60 bg-[#18181A] px-2 py-1 text-[10px] font-bold tabular-nums text-neutral-300">
            <Clock size={11} /> {countdown(currentWar.endsAt)}
          </span>
        </div>

        {/* dual-team comparison */}
        <div className="px-4 py-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="min-w-0 text-right">
              <span className="block truncate text-[13px] font-bold text-white">{player.clanName}</span>
              <span className="block text-[10px] tabular-nums text-neutral-500">{clan.tag}</span>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-full border border-[#27272A]/60 bg-[#18181A] text-[11px] font-bold uppercase tracking-tight text-neutral-500">
              vs
            </div>
            <div className="min-w-0">
              <span className="block truncate text-[13px] font-bold text-white">{currentWar.opponent}</span>
              <span className="block text-[10px] tabular-nums text-neutral-500">{currentWar.opponentTag}</span>
            </div>
          </div>

          {/* stars */}
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <strong className="text-right text-[22px] font-bold tabular-nums leading-none text-[#34D399]">
              {currentWar.stars}
            </strong>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">
              <Star size={11} className="text-amber-400" /> Stars
            </span>
            <strong className="text-[22px] font-bold tabular-nums leading-none text-[#FF6B6B]">
              {currentWar.opponentStars}
            </strong>
          </div>

          <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-[#1F1F22]" role="img" aria-label={`Stars: ${currentWar.stars} to ${currentWar.opponentStars}`}>
            <span className="h-full bg-[#10B981]" style={{ width: `${homeStarPct}%`, transition: 'width 420ms ease' }} />
            <span className="ml-auto h-full bg-[#E52E2E]" style={{ width: `${awayStarPct}%`, transition: 'width 420ms ease' }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] tabular-nums text-neutral-500">
            <span>{Math.round(homeStarPct)}% of contested stars</span>
            <span>{Math.round(awayStarPct)}%</span>
          </div>

          {/* destruction */}
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <strong className="text-right text-[15px] font-bold tabular-nums text-[#34D399]">
              {currentWar.destruction.toFixed(2)}%
            </strong>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">
              <Flame size={11} className="text-[#FF7A7A]" /> Dmg
            </span>
            <strong className="text-[15px] font-bold tabular-nums text-[#FF6B6B]">
              {currentWar.opponentDestruction.toFixed(2)}%
            </strong>
          </div>
          <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-[#1F1F22]">
            <span className="h-full bg-[#10B981]/85" style={{ width: `${currentWar.destruction}%` }} />
            <span className="ml-auto h-full bg-[#E52E2E]/85" style={{ width: `${currentWar.opponentDestruction}%` }} />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Fact label="Attacks used" value={`${currentWar.attacksUsed}/${currentWar.attacksAvailable}`} />
            <Fact label="Avg stars" value={(currentWar.stars / Math.max(1, currentWar.attacksUsed)).toFixed(2)} />
            <Fact label="Max possible" value={String(currentWar.size * 3)} />
          </div>
        </div>
      </Card>

      {/* -------- attack feed -------- */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle
          title="Attack feed"
          detail={`${currentWar.attacks.length} recorded attacks`}
          action={
            <ActionButton tone="neutral" className="px-2.5 py-1.5 text-[11px]" onClick={() => setRoute('clan')}>
              Roster
            </ActionButton>
          }
        />
        <Card className="divide-y divide-[#27272A]/30 overflow-hidden">
          {currentWar.attacks.map((attack) => (
            <div key={`${attack.attacker}-${attack.order}`} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#27272A]/50 bg-[#18181A] text-[10px] font-bold tabular-nums text-neutral-400">
                {attack.order}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-white">{attack.attacker}</span>
                <span className="block truncate text-[10px] text-neutral-500">→ {attack.defender}</span>
              </span>
              <span className="flex items-center gap-1 text-[13px] font-bold tabular-nums text-amber-300">
                <Star size={12} fill="currentColor" /> {attack.stars}
              </span>
              <span className="w-12 text-right text-[11px] tabular-nums text-neutral-400">{attack.destruction}%</span>
            </div>
          ))}
        </Card>
      </section>

      {/* -------- CWL group -------- */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle title="CWL group standings" detail="Current group · ranks #1–#8" />
        <Card className="p-3">
          <div className="flex flex-col gap-1">
            {groupStandings.map((round) => {
              const first = round.rank === 1;
              return (
                <button
                  key={round.id}
                  type="button"
                  onClick={() => setSelected(round)}
                  className={`cc-tap flex items-center gap-3 rounded-xl px-2.5 py-2 text-left ${
                    first ? 'border border-amber-500/30 bg-[#1a1608]' : 'bg-[#18181A]'
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold tabular-nums ${
                      first ? 'bg-amber-500/20 text-amber-300' : 'bg-[#27272A]/40 text-neutral-400'
                    }`}
                  >
                    #{round.rank}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-bold text-white">{round.opponent}</span>
                    <span className="block truncate text-[9px] uppercase tracking-[0.08em] text-neutral-500">
                      {round.league}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-lg border border-[#27272A]/60 bg-[#121214] px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-neutral-400">
                    {round.wins}W {round.ties}T {round.losses}L
                  </span>
                  <span className="w-9 shrink-0 text-right text-[11px] font-bold tabular-nums text-amber-300">
                    {round.stars}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </section>

      {/* -------- history cards -------- */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle
          title="War history"
          detail={`${totals.wins}W ${totals.ties}T ${totals.losses}L · ${totals.destruction.toFixed(1)}% average destruction`}
        />
        <div className="flex flex-col gap-2.5">
          {warLog.map((round) => {
            const won = round.stars > round.opponentStars;
            const drawn = round.stars === round.opponentStars;
            return (
              <button
                key={round.id}
                type="button"
                onClick={() => setSelected(round)}
                className="cc-tap cc-history-card w-full rounded-2xl border border-[#27272A]/40 p-3.5 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#27272A]/50 bg-[#18181A] text-[12px] font-bold tabular-nums text-neutral-300">
                      #{round.rank}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-bold tracking-tight text-white">
                        {round.opponent}
                      </span>
                      <span className="block truncate text-[10px] text-neutral-500">
                        {round.league} ·{' '}
                        {new Date(round.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold tabular-nums ${
                      won
                        ? 'border-[#10B981]/40 bg-[#0d2a22] text-[#34D399]'
                        : drawn
                          ? 'border-[#27272A]/60 bg-[#18181A] text-neutral-400'
                          : 'border-[#E52E2E]/40 bg-[#3B1515] text-[#FF7A7A]'
                    }`}
                  >
                    {round.wins}W {round.ties}T {round.losses}L
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <span className="text-right text-[16px] font-bold tabular-nums text-[#34D399]">{round.stars}</span>
                  <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-600">
                    <Target size={10} /> Stars
                  </span>
                  <span className="text-[16px] font-bold tabular-nums text-[#FF6B6B]">{round.opponentStars}</span>
                </div>

                <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-[#1F1F22]">
                  <span
                    className="h-full bg-[#10B981]"
                    style={{ width: `${(round.stars / Math.max(1, round.stars + round.opponentStars)) * 100}%` }}
                  />
                  <span
                    className="ml-auto h-full bg-[#E52E2E]"
                    style={{ width: `${(round.opponentStars / Math.max(1, round.stars + round.opponentStars)) * 100}%` }}
                  />
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[10px] tabular-nums text-neutral-500">
                  <span className="text-[#34D399]">{round.destruction.toFixed(1)}% destruction</span>
                  <span className="text-[#FF6B6B]">{round.opponentDestruction.toFixed(1)}% opponent</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* -------- clan war record -------- */}
      <Card className="p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-500/30 bg-[#1a1608] text-amber-300">
            <Trophy size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-bold tracking-tight text-white">{clan.name} war record</h3>
            <p className="text-[10px] text-neutral-500">
              Level {clan.level} · {clan.warWinStreak} war win streak
            </p>
          </div>
          <Chip tone="amber">
            <Crown size={10} /> {formatNumber(clan.warWins)} wins
          </Chip>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Fact label="Wins" value={formatNumber(clan.warWins)} />
          <Fact label="Losses" value={formatNumber(clan.warLosses)} />
          <Fact label="Ties" value={formatNumber(clan.warTies)} />
        </div>
        <div className="mt-2">
          <Bar
            percent={(clan.warWins / Math.max(1, clan.warWins + clan.warLosses + clan.warTies)) * 100}
            tone="green"
            className="h-2"
          />
        </div>
      </Card>

      {selected ? (
        <Sheet
          title={selected.opponent}
          detail={`${selected.league} · ${new Date(selected.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
          onClose={() => setSelected(null)}
          footer={
            <ActionButton tone="neutral" className="w-full" onClick={() => setSelected(null)}>
              Close
            </ActionButton>
          }
        >
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Fact label="Group rank" value={`#${selected.rank}`} />
              <Fact label="War size" value={`${selected.size} v ${selected.size}`} />
              <Fact label="Stars" value={`${selected.stars} — ${selected.opponentStars}`} />
              <Fact label="Destruction" value={`${selected.destruction.toFixed(1)}%`} />
            </div>
            <InnerBox className="flex items-center gap-2.5 px-3 py-3">
              <Shield size={14} className="shrink-0 text-[#00C29A]" />
              <p className="text-[11px] leading-relaxed text-neutral-400">
                {selected.stars > selected.opponentStars
                  ? `Group won on stars against ${selected.opponent}.`
                  : selected.stars === selected.opponentStars
                    ? `Tied on stars — destruction decides the round.`
                    : `Lost the round to ${selected.opponent} on stars.`}
              </p>
            </InnerBox>
            <div className="rounded-xl bg-[#18181A] px-3 py-3">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">
                Round record
              </span>
              <div className="flex items-center gap-2">
                <Chip tone="green">{selected.wins} wins</Chip>
                <Chip>{selected.ties} ties</Chip>
                <Chip tone="red">{selected.losses} losses</Chip>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-[#18181A] px-3 py-3">
              <AssetIcon name={selected.opponent} category="defenses" size={30} rounded="rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-bold text-white">{selected.opponent}</span>
                <span className="block text-[10px] tabular-nums text-neutral-500">{selected.opponentTag}</span>
              </span>
            </div>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#18181A] px-3 py-2.5">
      <span className="block text-[9px] font-medium uppercase tracking-[0.08em] text-neutral-500">{label}</span>
      <strong className="mt-0.5 block truncate text-[13px] font-bold tabular-nums text-white">{value}</strong>
    </div>
  );
}
