import { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { BUILDER_CATALOG, CATALOG, CATEGORY_LABELS, type CategoryId } from './catalog';
import { levelOf } from './demo';
import { AssetIcon, Card, Chip, EmptyState, SectionTitle } from './components';
import { useClash } from './store';

type Filter = 'all' | 'complete' | 'incomplete';

const GALLERY_CATEGORIES: CategoryId[] = [
  'heroes',
  'guardians',
  'equipment',
  'pets',
  'laboratory',
  'defenses',
  'buildings',
  'traps',
];

export function CollectionView({ village }: { village: 'home' | 'builder' }) {
  const { state } = useClash();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [filter, setFilter] = useState<Filter>('all');

  const source = village === 'builder' ? BUILDER_CATALOG : CATALOG;

  const grouped = useMemo(() => {
    const term = query.trim().toLowerCase();
    const buckets = new Map<CategoryId, typeof CATALOG>();
    for (const entry of source) {
      if (!GALLERY_CATEGORIES.includes(entry.category)) continue;
      if (category !== 'all' && entry.category !== category) continue;
      if (term && !entry.name.toLowerCase().includes(term) && !CATEGORY_LABELS[entry.category].toLowerCase().includes(term)) continue;
      const level = levelOf(state.progression, entry);
      if (filter === 'complete' && level < entry.max) continue;
      if (filter === 'incomplete' && level >= entry.max) continue;
      const bucket = buckets.get(entry.category) ?? [];
      bucket.push(entry);
      buckets.set(entry.category, bucket);
    }
    return GALLERY_CATEGORIES.filter((id) => buckets.has(id)).map((id) => ({ id, entries: buckets.get(id)! }));
  }, [source, query, category, filter, state.progression]);

  const totalVisible = grouped.reduce((sum, group) => sum + group.entries.length, 0);

  return (
    <div className="flex flex-col gap-3.5">
      {/* -------- controls -------- */}
      <Card className="p-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search every asset…"
            aria-label="Search every asset"
            className="w-full rounded-xl border border-[#27272A]/60 bg-[#18181A] py-2.5 pl-9 pr-9 text-[13px] text-white outline-none placeholder:text-neutral-600 focus:border-[#E52E2E]/60"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="cc-tap absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-lg text-neutral-500 hover:text-white"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>

        <div className="cc-no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
          <Pill active={category === 'all'} onClick={() => setCategory('all')}>
            All
          </Pill>
          {GALLERY_CATEGORIES.map((id) => (
            <Pill key={id} active={category === id} onClick={() => setCategory(id)}>
              {CATEGORY_LABELS[id]}
            </Pill>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          {(['all', 'incomplete', 'complete'] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`cc-tap flex-1 rounded-xl border px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] transition-colors ${
                filter === value
                  ? 'border-[#E52E2E]/50 bg-[#3B1515] text-[#FF7A7A]'
                  : 'border-[#27272A]/60 bg-[#18181A] text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {value === 'all' ? 'Everything' : value === 'incomplete' ? 'Upgrading' : 'Maxed'}
            </button>
          ))}
        </div>
      </Card>

      {totalVisible === 0 ? (
        <EmptyState
          title="No assets match"
          detail="Try a different search term, or switch the filter back to Everything."
        />
      ) : (
        grouped.map((group) => {
          const maxed = group.entries.filter((entry) => levelOf(state.progression, entry) >= entry.max).length;
          return (
            <section key={group.id} className="flex flex-col gap-2.5">
              <SectionTitle
                title={CATEGORY_LABELS[group.id]}
                detail={`${maxed} of ${group.entries.length} maxed`}
                action={<Chip tone={maxed === group.entries.length ? 'amber' : 'neutral'}>{Math.round((maxed / group.entries.length) * 100)}%</Chip>}
              />
              <Card className="p-3">
                <div className="grid grid-cols-5 gap-2.5">
                  {group.entries.map((entry) => {
                    const level = levelOf(state.progression, entry);
                    const complete = level >= entry.max;
                    return (
                      <div
                        key={entry.key}
                        className="relative rounded-2xl bg-[#18181A] p-2"
                        title={`${entry.name} — level ${level}/${entry.max}`}
                      >
                        <AssetIcon
                          name={entry.name}
                          category={entry.category}
                          iconUrl={entry.iconUrl}
                          size={38}
                          className="mx-auto"
                          rounded="rounded-xl"
                        />
                        <span className="mt-1 block truncate text-center text-[8px] font-bold leading-tight text-neutral-400">
                          {entry.name}
                        </span>
                        <span
                          className={`absolute bottom-1 right-1 grid min-w-[17px] place-items-center rounded-md border px-1 py-[1px] text-[9px] font-bold tabular-nums ${
                            complete ? 'border-amber-500/50 bg-black/80 text-amber-300' : 'border-neutral-700 bg-black/80 text-white'
                          }`}
                        >
                          {level}
                        </span>
                        {complete ? (
                          <span className="absolute left-1 top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-amber-500/20 text-amber-300">
                            <Check size={9} strokeWidth={3.5} />
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </section>
          );
        })
      )}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cc-tap shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-tight transition-colors ${
        active
          ? 'border-[#E52E2E]/50 bg-[#3B1515] text-[#FF7A7A]'
          : 'border-[#27272A]/60 bg-[#18181A] text-neutral-400 hover:text-neutral-200'
      }`}
    >
      {children}
    </button>
  );
}
