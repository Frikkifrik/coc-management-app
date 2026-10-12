import { useMemo, useState } from 'react';
import { useI18n } from './i18n';
import { ChevronRight, Layers, Plus, RotateCcw, Sparkles, Zap } from 'lucide-react';
import {
  CATALOG,
  BUILDER_CATALOG,
  CATEGORY_LABELS,
  HERO_NAMES,
  type CatalogEntry,
  type CategoryId,
} from './catalog';
import { categoryRows, entriesInCategory, levelOf, summarize } from './demo';
import {
  AssetIcon,
  Bar,
  Card,
  Chip,
  CompletionPill,
  InnerBox,
  Ring,
  SectionTitle,
  Sheet,
  ActionButton,
} from './components';
import { compactNumber, formatNumber, hoursLabel, useClash } from './store';
import type { CategorySummary } from './types';

export function ProgressionView({ village }: { village: 'home' | 'builder' }) {
  const { t } = useI18n();
  const { state, setLevel, toggleSupercharge, addPlanItem, notify } = useClash();
  const { progression, player } = state;
  const [openCategory, setOpenCategory] = useState<CategoryId | null>(null);

  const rows = useMemo(() => categoryRows(progression, village), [progression, village]);
  const overall = useMemo(() => {
    const earned = rows.reduce((sum, row) => sum + row.earned, 0);
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    return total ? (earned / total) * 100 : 0;
  }, [rows]);

  const maxedCount = rows.filter((row) => row.maxed).length;
  const heroRows = rows.filter((row) => row.id === 'heroes' || row.id === 'guardians');
  const heroes = useMemo(() => {
    const source = village === 'builder' ? BUILDER_CATALOG : CATALOG;
    return source.filter((entry) => (entry.category === 'heroes' || entry.category === 'guardians') && entry.village === village);
  }, [village]);

  const equipment = useMemo(
    () => (village === 'builder' ? BUILDER_CATALOG : CATALOG).filter((entry) => entry.category === 'equipment'),
    [village],
  );
  const pets = useMemo(
    () => (village === 'builder' ? BUILDER_CATALOG : CATALOG).filter((entry) => entry.category === 'pets'),
    [village],
  );

  const active = openCategory ? rows.find((row) => row.id === openCategory) ?? null : null;
  const drilldown = openCategory ? entriesInCategory(progression, openCategory, village) : [];

  return (
    <div className="flex flex-col gap-3.5">
      {/* -------- summary -------- */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-4">
          <Ring percent={overall} size={62} stroke={5} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[17px] font-bold tracking-tight text-white">
                {village === 'builder' ? `Builder Hall ${player.builderHallLevel}` : `Town Hall ${player.townHallLevel}`}
              </h2>
              {player.live ? <Chip tone="green">{t('Live')}</Chip> : <Chip>{t('Demo data')}</Chip>}
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
              {t('{0} of {1} categories maxed', maxedCount, rows.length)} ·{' '}
              {village === 'builder' ? player.builderLeague : player.league}
            </p>
            <div className="mt-2.5 flex items-center gap-4">
              <MiniStat label="Trophies" value={formatNumber(village === 'builder' ? player.versusTrophies : player.trophies)} />
              <MiniStat label={t('Best')} value={formatNumber(player.bestTrophies)} />
              <MiniStat label={t('Level')} value={player.expLevel} />
            </div>
          </div>
        </div>
        {heroRows.length ? (
          <div className="grid grid-cols-2 gap-px border-t border-[#27272A]/40 bg-[#27272A]/40">
            {heroRows.map((row) => (
              <div key={row.id} className="bg-[#0F0F10] px-4 py-2.5">
                <span className="block text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500">
                  {CATEGORY_LABELS[row.id]}
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[15px] font-bold tabular-nums text-white">
                    {Math.round(row.percent)}%
                  </span>
                  <CompletionPill percent={row.percent} compact />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      {/* -------- upgrade tracker -------- */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle
          title={t('Upgrade tracker')}
          detail={t('Tap a category to adjust levels or push it into the plan.')}
        />
        <Card className="divide-y divide-[#27272A]/30 overflow-hidden">
          {rows.map((row) => (
            <TrackerRow
              key={row.id}
              row={row}
              onOpen={() => setOpenCategory(row.id)}
            />
          ))}
        </Card>
      </section>

      {/* -------- heroes -------- */}
      {heroes.length ? (
        <section className="flex flex-col gap-2.5">
          <SectionTitle title={village === 'builder' ? 'War machines' : 'Heroes'} detail={t('Levels gate every attack composition.')} />
          <Card className="p-3">
            {/* Heroes render three across so the official renders stay legible —
                five across crushed them. Equipment, pets and the collection keep
                the denser grid-cols-5. */}
            <div className="grid grid-cols-3 gap-2.5">
              {heroes.map((entry) => {
                const level = levelOf(progression, entry);
                const complete = level >= entry.max;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setOpenCategory(entry.category)}
                    className="cc-tap group relative overflow-hidden rounded-2xl border border-[#27272A]/40 bg-[#18181A] p-2 text-left"
                  >
                    <AssetIcon name={entry.name} category={entry.category} assetKey={entry.key} iconUrl={entry.iconUrl} size={38} className="mx-auto" rounded="rounded-xl" />
                    <span className="mt-1.5 block truncate text-center text-[9px] font-bold leading-tight text-neutral-300">
                      {HERO_NAMES[entry.hero ?? ''] ?? entry.name}
                    </span>
                    <span
                      className={`absolute bottom-1 right-1 rounded-md border px-1 py-[1px] text-[9px] font-bold tabular-nums ${
                        complete
                          ? 'border-amber-500/50 bg-black/80 text-amber-300'
                          : 'border-neutral-700 bg-black/80 text-white'
                      }`}
                    >
                      {level}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </section>
      ) : null}

      {/* -------- equipment -------- */}
      {equipment.length ? <EquipmentGrid entries={equipment} onOpen={(category) => setOpenCategory(category)} /> : null}

      {/* -------- pets -------- */}
      {pets.length ? (
        <section className="flex flex-col gap-2.5">
          <SectionTitle title={t('Hero pets')} detail={t('{0} of {1} maxed', pets.filter((entry) => levelOf(progression, entry) >= entry.max).length, pets.length)} />
          <Card className="p-3">
            <div className="grid grid-cols-5 gap-2.5">
              {pets.map((entry) => {
                const level = levelOf(progression, entry);
                const complete = level >= entry.max;
                return (
                  <div key={entry.key} className="relative rounded-2xl border border-[#27272A]/40 bg-[#18181A] p-2">
                    <AssetIcon name={entry.name} category="pets" assetKey={entry.key} iconUrl={entry.iconUrl} size={34} className="mx-auto" rounded="rounded-xl" />
                    <span className="mt-1 block truncate text-center text-[8px] font-bold leading-tight text-neutral-400">
                      {entry.name}
                    </span>
                    <span
                      className={`absolute bottom-1 right-1 rounded-md border px-1 py-[1px] text-[9px] font-bold tabular-nums ${
                        complete ? 'border-amber-500/50 bg-black/80 text-amber-300' : 'border-neutral-700 bg-black/80 text-white'
                      }`}
                    >
                      {level}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      ) : null}

      {/* -------- walls -------- */}
      <WallCard village={village} />

      {/* -------- drill-down -------- */}
      {active ? (
        <Sheet
          title={CATEGORY_LABELS[active.id]}
          detail={`${active.maxed ? 'Fully maxed' : `${active.remaining} of ${active.itemCount} still upgrading`} · ${Math.round(active.percent)}% complete`}
          onClose={() => setOpenCategory(null)}
        >
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-[#18181A] p-3">
            <Ring percent={active.percent} size={46} stroke={4} />
            <div className="min-w-0 flex-1">
              <span className="block text-[11px] text-neutral-500">{t('Category completion')}</span>
              <strong className="block text-[15px] font-bold tabular-nums text-white">
                {formatNumber(active.earned)} / {formatNumber(active.total)} level points
              </strong>
            </div>
            <CompletionPill percent={active.percent} />
          </div>

          {active.id === 'supercharge' ? (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] leading-relaxed text-neutral-500">
                {t('One seasonal charge per eligible defence. Toggle what is currently charged in your village.')}
              </p>
              {Object.keys(progression.supercharge).map((key) => {
                const name = key.split(':')[1].replace(/-/g, ' ');
                const on = progression.supercharge[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleSupercharge(key)}
                    className={`cc-tap flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left ${
                      on ? 'border-[#00C29A]/40 bg-[#0d2a22]' : 'border-[#27272A]/50 bg-[#18181A]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <AssetIcon name={name} category="supercharge" assetKey={`supercharge:${name.toLowerCase().replace(/\s+/g, '-')}`} size={30} rounded="rounded-lg" />
                      <span className="text-[13px] font-bold capitalize text-white">{name}</span>
                    </span>
                    <span className={`text-[11px] font-bold ${on ? 'text-[#34D399]' : 'text-neutral-500'}`}>
                      {on ? 'Charged' : 'Not charged'}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : active.id === 'walls' ? (
            <WallEditor village={village} />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {drilldown.map(({ entry, level, complete }) => (
                <li key={entry.key} className="rounded-xl border border-[#27272A]/40 bg-[#18181A] p-2.5">
                  <div className="flex items-center gap-2.5">
                    <AssetIcon name={entry.name} category={entry.category} assetKey={entry.key} iconUrl={entry.iconUrl} size={32} rounded="rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-white">{entry.name}</span>
                      <span className="block text-[10px] tabular-nums text-neutral-500">
                        {entry.count > 1 ? `${entry.count}× · ` : ''}Max {entry.max}
                        {entry.rarity ? ` · ${entry.rarity}` : ''}
                      </span>
                    </div>
                    <span className={`shrink-0 text-[13px] font-bold tabular-nums ${complete ? 'text-amber-300' : 'text-white'}`}>
                      {level}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={entry.max}
                      value={level}
                      aria-label={`${entry.name} level`}
                      onChange={(event) => setLevel(entry.key, Number(event.target.value))}
                      className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[#1F1F22] accent-[#2563EB]"
                    />
                    <ActionButton
                      tone="neutral"
                      className="px-2 py-1 text-[10px]"
                      onClick={() => {
                        addPlanItem({
                          key: entry.key,
                          name: entry.name,
                          category: entry.category,
                          fromLevel: level,
                          toLevel: entry.max,
                          hours: estimateHours(entry.category, entry.max),
                          resource: entry.category === 'laboratory' ? 'dark' : 'gold',
                          cost: estimateCost(entry.category, entry.max),
                          priority: entry.category === 'defenses' || entry.category.startsWith('hero') ? 1 : 2,
                        });
                        notify(t('{0} added to the plan.', entry.name));
                      }}
                      disabled={complete}
                    >
                      <Plus size={12} /> Plan
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      ) : null}
    </div>
  );
}

function TrackerRow({ row, onOpen }: { row: CategorySummary; onOpen: () => void }) {
  const { t } = useI18n();
  const label = CATEGORY_LABELS[row.id];
  return (
    <button type="button" onClick={onOpen} className="cc-tap flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-[#121214]">
      <AssetIcon name={label} category={row.id} assetKey={`category:${row.id}`} size={34} rounded="rounded-lg" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-bold tracking-tight text-white">{label}</span>
          {row.remaining > 0 && row.next ? (
            <span className="truncate text-[10px] text-neutral-600">· {t(row.next.name)}</span>
          ) : null}
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <Bar percent={row.percent} tone={row.maxed ? 'amber' : 'royal'} className="max-w-[150px]" />
          <span className="shrink-0 text-[10px] tabular-nums text-neutral-500">
            {row.id === 'walls'
              ? t('{0}/{1} maxed', formatNumber(row.itemCount - row.remaining), formatNumber(row.itemCount))
              : t('{0}/{1} maxed', row.itemCount - row.remaining, row.itemCount)}
          </span>
        </span>
      </span>
      <CompletionPill percent={row.percent} />
      <ChevronRight size={15} className="shrink-0 text-neutral-600" />
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="min-w-0">
      <span className="block text-[9px] font-medium uppercase tracking-[0.08em] text-neutral-600">{label}</span>
      <strong className="block text-[13px] font-bold tabular-nums text-white">{value}</strong>
    </span>
  );
}

export function EquipmentGrid({
  entries,
  onOpen,
  title = 'Equipment',
}: {
  entries: CatalogEntry[];
  onOpen: (category: CategoryId) => void;
  title?: string;
}) {
  const { t } = useI18n();
  const { state } = useClash();
  const [heroFilter, setHeroFilter] = useState<string>('all');
  const heroes = Array.from(new Set(entries.map((entry) => entry.hero).filter(Boolean))) as string[];
  const visible = heroFilter === 'all' ? entries : entries.filter((entry) => entry.hero === heroFilter);
  const maxed = entries.filter((entry) => levelOf(state.progression, entry) >= entry.max).length;

  return (
    <section className="flex flex-col gap-2.5">
      <SectionTitle title={title} detail={t('{0} of {1} at max level', maxed, entries.length)} />
      <Card className="p-3">
        <div className="cc-no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          <FilterChip active={heroFilter === 'all'} onClick={() => setHeroFilter('all')}>
            {t('All')}
          </FilterChip>
          {heroes.map((hero) => (
            <FilterChip key={hero} active={heroFilter === hero} onClick={() => setHeroFilter(hero)}>
              {HERO_NAMES[hero] ?? hero}
            </FilterChip>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-2.5">
          {visible.map((entry) => {
            const level = levelOf(state.progression, entry);
            const complete = level >= entry.max;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => onOpen(entry.category)}
                className="cc-tap relative rounded-2xl bg-[#18181A] p-2 text-left"
                title={`${entry.name} — level ${level}/${entry.max}`}
              >
                <AssetIcon
                  name={entry.name}
                  category="equipment"
                  assetKey={entry.key}
                  iconUrl={entry.iconUrl}
                  size={38}
                  className="mx-auto"
                  rounded="rounded-xl"
                />
                <span
                  className={`absolute bottom-1 right-1 rounded-md border px-1 py-[1px] text-[9px] font-bold tabular-nums ${
                    complete ? 'border-amber-500/50 bg-black/80 text-amber-300' : 'border-neutral-700 bg-black/80 text-white'
                  }`}
                >
                  {level}
                </span>
                {entry.rarity === 'epic' ? (
                  <span className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full bg-[#00C29A]" aria-label={t('Epic equipment')} />
                ) : null}
              </button>
            );
          })}
        </div>
      </Card>
    </section>
  );
}

export function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cc-tap shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-tight transition-colors ${
        active
          ? 'border-[#2563EB]/50 bg-[#0F172A] text-[#93C5FD]'
          : 'border-[#27272A]/60 bg-[#18181A] text-neutral-400 hover:text-neutral-200'
      }`}
    >
      {children}
    </button>
  );
}

function WallCard({ village }: { village: 'home' | 'builder' }) {
  const { t } = useI18n();
  const { state } = useClash();
  const summary = summarize(state.progression, 'walls', village);
  const walls = state.progression.walls[village];
  const distribution = Object.entries(walls.levels)
    .map(([level, count]) => ({ level: Number(level), count: Number(count) }))
    .sort((a, b) => b.level - a.level);

  return (
    <section className="flex flex-col gap-2.5">
      <SectionTitle title="Walls" detail={t('{0} segments · cap level {1}', formatNumber(walls.total), walls.max)} />
      <Card className="p-3.5">
        <div className="mb-3 flex items-center gap-3">
          <Ring percent={summary.percent} size={46} stroke={4} />
          <div className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-white">
              {t('{0} at level {1}', formatNumber(walls.levels[walls.max] ?? 0), walls.max)}
            </span>
            <span className="block text-[11px] text-neutral-500">
              {t('{0} segments left to ring', formatNumber(summary.remaining))}
            </span>
          </div>
          <CompletionPill percent={summary.percent} />
        </div>
        <div className="flex flex-col gap-1.5">
          {distribution.map((slice) => (
            <div key={slice.level} className="flex items-center gap-2.5">
              <span className="w-14 shrink-0 text-[11px] font-bold tabular-nums text-neutral-400">{t('Lvl {0}', slice.level)}</span>
              <Bar percent={(slice.count / walls.total) * 100} tone={slice.level >= walls.max ? 'amber' : 'blue'} className="h-2" />
              <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-neutral-500">{slice.count}</span>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

function WallEditor({ village }: { village: 'home' | 'builder' }) {
  const { t } = useI18n();
  const { state, setWallSegments } = useClash();
  const walls = state.progression.walls[village];
  const distribution = Object.entries(walls.levels)
    .map(([level, count]) => ({ level: Number(level), count: Number(count) }))
    .sort((a, b) => b.level - a.level);

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[11px] leading-relaxed text-neutral-500">
        {t('The Supercell API does not expose wall segments, so the wall ring is tracked locally or through a JSON import.')}
      </p>
      {distribution.map((slice) => (
        <div key={slice.level} className="flex items-center gap-2.5 rounded-xl border border-[#27272A]/40 bg-[#18181A] px-3 py-2.5">
          <span className="w-16 shrink-0 text-[12px] font-bold tabular-nums text-white">Level {slice.level}</span>
          <input
            type="number"
            min={0}
            max={walls.total}
            value={slice.count}
            aria-label={t('Wall segments at level {0}', slice.level)}
            onChange={(event) => setWallSegments(village, slice.level, Number(event.target.value))}
            className="w-20 rounded-lg border border-[#27272A]/60 bg-[#121214] px-2 py-1.5 text-right text-[13px] font-bold tabular-nums text-white outline-none focus:border-[#2563EB]/60"
          />
          <span className="flex-1 text-right text-[10px] tabular-nums text-neutral-500">
            {Math.round((slice.count / walls.total) * 100)}%
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-xl bg-[#18181A] px-3 py-2.5">
        <span className="text-[12px] font-bold text-white">{t('Total segments')}</span>
        <span className="text-[13px] font-bold tabular-nums text-white">{formatNumber(walls.total)}</span>
      </div>
    </div>
  );
}

/* Rough planning estimates — replaced by live values when a data source supplies them. */
function estimateHours(category: CategoryId, max: number): number {
  const base: Record<CategoryId, number> = {
    buildings: 24,
    defenses: 20,
    traps: 6,
    supercharge: 1,
    heroes: 8,
    guardians: 8,
    laboratory: 16,
    equipment: 5,
    pets: 8,
    walls: 0,
  };
  return Math.round((base[category] ?? 12) * max * 0.8);
}

function estimateCost(category: CategoryId, max: number): number {
  const base: Record<CategoryId, number> = {
    buildings: 900_000,
    defenses: 1_100_000,
    traps: 120_000,
    supercharge: 0,
    heroes: 140_000,
    guardians: 160_000,
    laboratory: 90_000,
    equipment: 260_000,
    pets: 110_000,
    walls: 8_000_000,
  };
  return Math.round((base[category] ?? 500_000) * max);
}

export function LegendStrip() {
  const { t } = useI18n();
  return (
    <InnerBox className="flex items-start gap-2.5 px-3 py-2.5">
      <Sparkles size={14} className="mt-[1px] shrink-0 text-[#00C29A]" />
      <p className="text-[10px] leading-relaxed text-neutral-500">
        {t('Level caps follow the Town Hall 17 reference sheet. Official artwork appears automatically once a Supercell API key or JSON import supplies')}{' '}
        <span className="font-bold text-neutral-400">iconUrls</span>{' '}
        {t('— no generated images are used anywhere in this app.')}
      </p>
    </InnerBox>
  );
}

export function SourceChips({ hours, cost, resource }: { hours: number; cost: number; resource: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <Chip tone="blue">
        <Zap size={10} /> {hoursLabel(hours)}
      </Chip>
      <Chip>
        <Layers size={10} /> {compactNumber(cost)} {resource}
      </Chip>
    </span>
  );
}

export function ResetRow() {
  const { resetDemo } = useClash();
  return (
    <button
      type="button"
      onClick={resetDemo}
      className="cc-tap flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#27272A]/50 bg-[#121214] px-3 py-2 text-[11px] font-bold text-neutral-400 hover:text-white"
    >
      <RotateCcw size={12} /> Reset demo village
    </button>
  );
}
