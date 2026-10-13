import { useMemo } from 'react';
import { useI18n } from './i18n';
import { ArrowRight, CalendarDays, Flame, ListChecks, RefreshCw, Shield, Swords, TrendingUp, Trophy } from 'lucide-react';
import { CATEGORY_LABELS } from './catalog';
import { categoryRows } from './demo';
import { ActionButton, Bar, Card, Chip, CompletionPill, Ring, SectionTitle } from './components';
import { formatNumber, useClash } from './store';

export function HomeView() {
  const { t } = useI18n();
  const { state, setRoute, setView, syncLive, syncing } = useClash();
  const { player, clan, currentWar, warLog, progression, plan, tasks } = state;

  const rows = useMemo(() => categoryRows(progression, 'home'), [progression]);
  const overall = useMemo(() => {
    const earned = rows.reduce((sum, row) => sum + row.earned, 0);
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    return total ? (earned / total) * 100 : 0;
  }, [rows]);

  const lastRound = warLog[warLog.length - 1];
  const nextThree = rows
    .filter((row) => !row.maxed)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-3.5">
      {/* -------- hero -------- */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-4">
          <Ring percent={overall} size={64} stroke={5} />
          <div className="min-w-0 flex-1">
            <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-500">
              {clan.name}
            </span>
            <h2 className="mt-0.5 truncate text-[18px] font-bold leading-tight tracking-tight text-white">
              {player.name}
            </h2>
            <p className="text-[11px] tabular-nums text-neutral-500">
              {player.tag} · TH{player.townHallLevel} · {player.league}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-px border-t border-[#27272A]/40 bg-[#27272A]/40">
          <Cell label="Trophies" value={formatNumber(player.trophies)} />
          <Cell label={t('War stars')} value={formatNumber(player.warStars)} />
          <Cell label={t('Attacks')} value={formatNumber(player.attacksWon)} />
          <Cell label={t('Donated')} value={formatNumber(player.donations)} />
        </div>
        <div className="flex items-center gap-2 border-t border-[#27272A]/40 px-3 py-2.5">
          <ActionButton tone="royal" className="flex-1" onClick={() => void syncLive()} disabled={syncing}>
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing…' : 'Sync live'}
          </ActionButton>
          <ActionButton tone="neutral" className="flex-1" onClick={() => { setRoute('profile'); setView('home-village'); }}>
            <TrendingUp size={13} /> Tracker
          </ActionButton>
        </div>
      </Card>

      {/* -------- live war -------- */}
      <button
        type="button"
        onClick={() => setRoute('war')}
        className="cc-tap cc-history-card w-full rounded-2xl border border-[#27272A]/40 p-4 text-left"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-[#2563EB]/40 bg-[#0F172A] text-[#93C5FD]">
              <Swords size={15} />
            </span>
            <span>
              <span className="block text-[14px] font-bold tracking-tight text-white">War Day · vs {currentWar.opponent}</span>
              <span className="block text-[10px] text-neutral-500">
                {currentWar.size} v {currentWar.size} · {currentWar.attacksUsed}/{currentWar.attacksAvailable} attacks used
              </span>
            </span>
          </span>
          <ArrowRight size={16} className="shrink-0 text-neutral-600" />
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <strong className="text-right text-[20px] font-bold tabular-nums leading-none text-[#34D399]">
            {currentWar.stars}
          </strong>
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-600">{t('Stars')}</span>
          <strong className="text-[20px] font-bold tabular-nums leading-none text-[#60A5FA]">
            {currentWar.opponentStars}
          </strong>
        </div>
        <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-[#1F1F22]">
          <span
            className="h-full bg-[#10B981]"
            style={{ width: `${(currentWar.stars / Math.max(1, currentWar.stars + currentWar.opponentStars)) * 100}%` }}
          />
          <span
            className="ml-auto h-full bg-[#2563EB]"
            style={{ width: `${(currentWar.opponentStars / Math.max(1, currentWar.stars + currentWar.opponentStars)) * 100}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] tabular-nums text-neutral-500">
          <span className="text-[#34D399]">{currentWar.destruction.toFixed(1)}%</span>
          <span className="text-[#60A5FA]">{currentWar.opponentDestruction.toFixed(1)}%</span>
        </div>
      </button>

      {/* -------- quick routes -------- */}
      <div className="grid grid-cols-2 gap-2.5">
        <QuickCard
          icon={CalendarDays}
          title={t('Calendar')}
          detail={t('{0} scheduled · {1} slots busy', tasks.length, new Set(tasks.map((task) => task.slot)).size)}
          onClick={() => { setRoute('profile'); setView('calendar'); }}
        />
        <QuickCard
          icon={ListChecks}
          title={t('Plan')}
          detail={t('{0} queued upgrades', plan.length)}
          onClick={() => { setRoute('profile'); setView('plan'); }}
        />
        <QuickCard
          icon={Trophy}
          title="CWL"
          detail={lastRound ? `Round ${lastRound.rank} · ${lastRound.wins}W ${lastRound.ties}T ${lastRound.losses}L` : 'No group yet'}
          onClick={() => setRoute('war')}
        />
        <QuickCard
          icon={Shield}
          title="Clan"
          detail={`${clan.members} members · ${clan.warWinStreak} streak`}
          onClick={() => setRoute('clan')}
        />
      </div>

      {/* -------- progression snapshot -------- */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle
          title={t('Progression snapshot')}
          detail={t('Closest categories to a gold pill.')}
          action={
            <ActionButton tone="ghost" className="px-2 py-1 text-[11px]" onClick={() => { setRoute('profile'); setView('home-village'); }}>
              Open
            </ActionButton>
          }
        />
        <Card className="divide-y divide-[#27272A]/30 overflow-hidden">
          {nextThree.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => { setRoute('profile'); setView('home-village'); }}
              className="cc-tap flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-[#121214]"
            >
              <Ring percent={row.percent} size={34} stroke={3} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-white">{CATEGORY_LABELS[row.id]}</span>
                <span className="mt-1 block">
                  <Bar percent={row.percent} tone="royal" className="max-w-[160px]" />
                </span>
              </span>
              <CompletionPill percent={row.percent} compact />
            </button>
          ))}
          {rows.filter((row) => row.maxed).length ? (
            <div className="flex items-center gap-2 px-3.5 py-2.5">
              <Chip tone="amber">
                <Flame size={10} /> {t('{0} categories maxed', rows.filter((row) => row.maxed).length)}
              </Chip>
            </div>
          ) : null}
        </Card>
      </section>

    </div>
  );
}

function QuickCard({
  icon: Icon,
  title,
  detail,
  onClick,
}: {
  icon: typeof Swords;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cc-tap rounded-2xl border border-[#27272A]/40 bg-[#0F0F10] p-3.5 text-left"
    >
      <span className="grid h-8 w-8 place-items-center rounded-xl border border-[#27272A]/50 bg-[#18181A] text-[#93C5FD]">
        <Icon size={15} />
      </span>
      <span className="mt-2 block text-[13px] font-bold tracking-tight text-white">{title}</span>
      <span className="mt-0.5 block text-[10px] leading-snug text-neutral-500">{detail}</span>
    </button>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0F0F10] px-2.5 py-2.5">
      <span className="block text-[8px] font-medium uppercase tracking-[0.06em] text-neutral-500">{label}</span>
      <strong className="mt-0.5 block truncate text-[13px] font-bold tabular-nums text-white">{value}</strong>
    </div>
  );
}

