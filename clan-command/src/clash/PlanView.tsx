import { useMemo, useState } from 'react';
import { useI18n } from './i18n';
import { ArrowDown, ArrowUp, Download, ListChecks, Plus, Trash2, Upload } from 'lucide-react';
import { CATALOG_INDEX, CATEGORY_LABELS, type CategoryId } from './catalog';
import {
  ActionButton,
  AssetIcon,
  Bar,
  Card,
  Chip,
  EmptyState,
  InnerBox,
  SectionTitle,
  Sheet,
} from './components';
import { compactNumber, formatNumber, hoursLabel, useClash } from './store';

const PRIORITY_META: Record<1 | 2 | 3, { label: string; tone: 'royal' | 'amber' | 'neutral' }> = {
  1: { label: 'Now', tone: 'royal' },
  2: { label: 'Next', tone: 'amber' },
  3: { label: 'Later', tone: 'neutral' },
};

export function PlanView() {
  const { t } = useI18n();
  const { state, removePlanItem, setPlanPriority, addPlanItem, exportJson, importJson, notify } = useClash();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');

  const plan = useMemo(
    () => state.plan.slice().sort((a, b) => a.priority - b.priority || b.hours - a.hours),
    [state.plan],
  );

  const totals = useMemo(() => {
    const hours = plan.reduce((sum, item) => sum + item.hours, 0);
    const byResource = plan.reduce<Record<string, number>>((acc, item) => {
      acc[item.resource] = (acc[item.resource] ?? 0) + item.cost;
      return acc;
    }, {});
    return { hours, byResource, count: plan.length };
  }, [plan]);

  const longest = Math.max(1, ...plan.map((item) => item.hours));

  const candidates = useMemo(() => {
    const term = query.trim().toLowerCase();
    return Object.values(CATALOG_INDEX)
      .filter((entry) => entry.category !== 'supercharge')
      .filter((entry) => categoryFilter === 'all' || entry.category === categoryFilter)
      .filter((entry) => (state.progression.levels[entry.key] ?? 0) < entry.max)
      .filter((entry) => !term || entry.name.toLowerCase().includes(term))
      .slice(0, 40);
  }, [query, categoryFilter, state.progression.levels]);

  return (
    <div className="flex flex-col gap-3.5">
      {/* -------- budget -------- */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-[#27272A]/40 px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-[#27272A]/50 bg-[#18181A] text-[#7DB8FF]">
            <ListChecks size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-bold tracking-tight text-white">{t('Upgrade plan')}</h2>
            <p className="text-[10px] text-neutral-500">{totals.count} queued upgrades</p>
          </div>
          <Chip tone="blue">{hoursLabel(totals.hours)}</Chip>
        </div>
        <div className="grid grid-cols-2 gap-px bg-[#27272A]/40">
          {(['gold', 'elixir', 'dark', 'builder'] as const).map((resource) => (
            <div key={resource} className="bg-[#0F0F10] px-4 py-2.5">
              <span className="block text-[9px] font-medium uppercase tracking-[0.08em] text-neutral-500">
                {resource === 'dark' ? 'Dark elixir' : resource}
              </span>
              <strong className="mt-0.5 block text-[14px] font-bold tabular-nums text-white">
                {compactNumber(totals.byResource[resource] ?? 0)}
              </strong>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-[#27272A]/40 px-3 py-2.5">
          <ActionButton tone="royal" className="flex-1" onClick={() => setPickerOpen(true)}>
            <Plus size={13} /> Add upgrade
          </ActionButton>
          <ActionButton tone="neutral" onClick={exportJson}>
            <Download size={13} /> Export
          </ActionButton>
          <ActionButton tone="neutral" onClick={() => setImportOpen(true)}>
            <Upload size={13} /> Import
          </ActionButton>
        </div>
      </Card>

      {/* -------- plan list -------- */}
      {plan.length === 0 ? (
        <EmptyState
          title={t('Nothing planned yet')}
          detail="Add upgrades from the tracker drill-down, or pick them here. Plans export to JSON so you can share the queue with your co-leaders."
          action={
            <ActionButton tone="royal" onClick={() => setPickerOpen(true)}>
              <Plus size={13} /> Add your first upgrade
            </ActionButton>
          }
        />
      ) : (
        <section className="flex flex-col gap-2.5">
          <SectionTitle title={t('Queue')} detail={t('Sorted by priority, then longest upgrade first.')} />
          <div className="flex flex-col gap-2">
            {plan.map((item, index) => {
              const meta = PRIORITY_META[item.priority];
              return (
                <Card key={item.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <AssetIcon name={item.name} category={item.category} assetKey={item.key} size={36} rounded="rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-[14px] font-bold tracking-tight text-white">{t(item.name)}</h3>
                          <p className="mt-0.5 text-[10px] tabular-nums text-neutral-500">
                            {CATEGORY_LABELS[item.category]} · Level {item.fromLevel} → {item.toLevel}
                          </p>
                        </div>
                        <Chip tone={meta.tone}>{t(meta.label)}</Chip>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <Bar percent={(item.hours / longest) * 100} tone="blue" className="h-1" />
                        <span className="shrink-0 text-[10px] font-bold tabular-nums text-[#7DB8FF]">
                          {hoursLabel(item.hours)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Chip>{compactNumber(item.cost)} {item.resource}</Chip>
                        {item.note ? (
                          <span className="truncate text-[10px] italic text-neutral-500">{item.note}</span>
                        ) : null}
                      </div>

                      <div className="mt-2.5 flex items-center gap-1.5">
                        <ActionButton
                          tone="neutral"
                          className="px-2 py-1 text-[10px]"
                          disabled={item.priority <= 1}
                          onClick={() => setPlanPriority(item.id, (item.priority - 1) as 1 | 2)}
                        >
                          <ArrowUp size={11} />
                        </ActionButton>
                        <ActionButton
                          tone="neutral"
                          className="px-2 py-1 text-[10px]"
                          disabled={item.priority >= 3}
                          onClick={() => setPlanPriority(item.id, (item.priority + 1) as 2 | 3)}
                        >
                          <ArrowDown size={11} />
                        </ActionButton>
                        <span className="flex-1" />
                        <ActionButton
                          tone="ghost"
                          className="px-2 py-1 text-[10px]"
                          onClick={() => {
                            removePlanItem(item.id);
                            notify(t('{0} removed from the plan.', item.name), 'info');
                          }}
                        >
                          <Trash2 size={11} /> Remove
                        </ActionButton>
                      </div>
                    </div>
                  </div>
                  <span className="sr-only">Queue position {index + 1}</span>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <InnerBox className="px-3 py-2.5">
        <p className="text-[10px] leading-relaxed text-neutral-500">
          {t('Costs and times in this queue are planning estimates. Export the plan as JSON, or replace it with a payload from your own tracking sheet — imports merge progression, plan and schedule.')}
        </p>
      </InnerBox>

      {/* -------- picker -------- */}
      {pickerOpen ? (
        <Sheet
          title={t('Add an upgrade')}
          detail={t('Only items below their Town Hall 17 cap are listed.')}
          onClose={() => setPickerOpen(false)}
        >
          <div className="flex flex-col gap-3">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('Search the catalog…')}
              aria-label={t('Search the catalog')}
              className="w-full rounded-xl border border-[#27272A]/60 bg-[#18181A] px-3 py-2.5 text-[13px] text-white outline-none placeholder:text-neutral-600 focus:border-[#2563EB]/60"
            />
            <div className="cc-no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
              <FilterChip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>
                {t('All')}
              </FilterChip>
              {(Object.keys(CATEGORY_LABELS) as CategoryId[])
                .filter((id) => id !== 'supercharge' && id !== 'walls')
                .map((id) => (
                  <FilterChip key={id} active={categoryFilter === id} onClick={() => setCategoryFilter(id)}>
                    {CATEGORY_LABELS[id]}
                  </FilterChip>
                ))}
            </div>
            <ul className="flex flex-col gap-1.5">
              {candidates.map((entry) => {
                const level = state.progression.levels[entry.key] ?? 0;
                return (
                  <li key={entry.key}>
                    <button
                      type="button"
                      onClick={() => {
                        addPlanItem({
                          key: entry.key,
                          name: entry.name,
                          category: entry.category,
                          fromLevel: level,
                          toLevel: entry.max,
                          hours: Math.round(entry.max * (entry.category === 'equipment' ? 6 : 14)),
                          resource: entry.category === 'laboratory' ? 'dark' : 'gold',
                          cost: Math.round(entry.max * (entry.category === 'defenses' ? 1_100_000 : 700_000)),
                          priority: 2,
                        });
                        notify(t('{0} added to the plan.', entry.name));
                      }}
                      className="cc-tap flex w-full items-center gap-2.5 rounded-xl border border-[#27272A]/40 bg-[#18181A] px-2.5 py-2 text-left hover:border-[#2563EB]/40"
                    >
                      <AssetIcon name={entry.name} category={entry.category} assetKey={entry.key} size={30} rounded="rounded-lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold text-white">{entry.name}</span>
                        <span className="block text-[10px] tabular-nums text-neutral-500">
                          {CATEGORY_LABELS[entry.category]} · Level {level} / {entry.max}
                        </span>
                      </span>
                      <Plus size={14} className="shrink-0 text-neutral-500" />
                    </button>
                  </li>
                );
              })}
              {candidates.length === 0 ? (
                <li className="rounded-xl bg-[#18181A] px-3 py-6 text-center text-[11px] text-neutral-500">
                  {t('Everything matching that filter is already maxed.')}
                </li>
              ) : null}
            </ul>
          </div>
        </Sheet>
      ) : null}

      {/* -------- import -------- */}
      {importOpen ? (
        <Sheet
          title={t('Import JSON payload')}
          detail={t('Paste a clash-command export or your own progression payload.')}
          onClose={() => setImportOpen(false)}
          footer={
            <div className="flex items-center gap-2">
              <ActionButton
                tone="neutral"
                className="flex-1"
                onClick={() => {
                  setImportText('');
                  setImportOpen(false);
                }}
              >
                Cancel
              </ActionButton>
              <ActionButton
                tone="royal"
                className="flex-1"
                onClick={async () => {
                  await importJson(importText);
                  setImportOpen(false);
                  setImportText('');
                }}
              >
                <Upload size={13} /> Import
              </ActionButton>
            </div>
          }
        >
          <div className="flex flex-col gap-2.5">
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              rows={10}
              spellCheck={false}
              placeholder='{ "player": { "tag": "#2YL8V0JQ" }, "progression": { "levels": { … } } }'
              aria-label={t('JSON payload')}
              className="w-full resize-y rounded-xl border border-[#27272A]/60 bg-[#18181A] px-3 py-2.5 font-mono text-[11px] leading-relaxed text-neutral-200 outline-none placeholder:text-neutral-700 focus:border-[#2563EB]/60"
            />
            <p className="text-[10px] leading-relaxed text-neutral-500">
              Expected shape: <span className="font-mono text-neutral-400">{`{ version, player, progression, tasks, plan }`}</span>.
              {t('Unknown keys are ignored, and the demo record fills anything you omit.')}
            </p>
            <ActionButton tone="neutral" onClick={exportJson}>
              <Download size={13} /> {t('Export the current state first')}
            </ActionButton>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

export function PlanTotals() {
  const { state } = useClash();
  const hours = state.plan.reduce((sum, item) => sum + item.hours, 0);
  return (
    <span className="text-[10px] tabular-nums text-neutral-500">
      {state.plan.length} items · {formatNumber(hours)}h
    </span>
  );
}
