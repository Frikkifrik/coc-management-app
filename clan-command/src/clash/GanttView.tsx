import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, GripVertical, Plus, Trash2 } from 'lucide-react';
import { CATEGORY_LABELS, CATALOG_INDEX } from './catalog';
import { dayOffsetFrom, isoDay } from './demo';
import { ActionButton, AssetIcon, Card, Chip, InnerBox, SectionTitle, Sheet } from './components';
import { compactNumber, hoursLabel, useClash } from './store';
import type { UpgradeTask } from './types';

const DAY_WIDTH = 86;
const GUTTER = 62;
const SLOT_COUNT = 5;
const ROW_HEIGHT = 74;
const WINDOW_DAYS = 14;

const SLOT_LABELS = ['Slot 1', 'Slot 2', 'Slot 3', 'Slot 4', 'Slot 5'];

function dayLabel(iso: string, offset: number): { primary: string; secondary: string } {
  const date = new Date(`${iso}T12:00:00`);
  if (offset === 0) return { primary: 'Today', secondary: date.toLocaleDateString('en-GB', { weekday: 'short' }) };
  return {
    primary: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    secondary: date.toLocaleDateString('en-GB', { weekday: 'short' }),
  };
}

export function GanttView() {
  const { state, moveTask, removeTask, addTask, notify } = useClash();
  const [windowStart, setWindowStart] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const scheduleStart = state.scheduleStart;
  const days = useMemo(
    () =>
      Array.from({ length: WINDOW_DAYS }, (_, index) => {
        const offset = windowStart + index;
        return { offset, iso: isoDay(offset), ...dayLabel(isoDay(offset), offset) };
      }),
    [windowStart],
  );

  const tasks = state.tasks;
  const task = selected ? tasks.find((item) => item.id === selected) ?? null : null;

  const nowProgress = useMemo(() => {
    const today = dayOffsetFrom(isoDay(0));
    const now = new Date();
    const fraction = (now.getHours() * 60 + now.getMinutes()) / 1440;
    return (today + fraction - windowStart) * DAY_WIDTH;
  }, [windowStart]);

  const queueable = useMemo(
    () =>
      Object.values(CATALOG_INDEX).filter(
        (entry) =>
          ['defenses', 'buildings', 'heroes', 'guardians', 'equipment', 'laboratory', 'pets'].includes(entry.category) &&
          (state.progression.levels[entry.key] ?? 0) < entry.max,
      ),
    [state.progression.levels],
  );

  const freeSlot = useMemo(() => {
    const used = new Set(tasks.map((item) => item.slot));
    for (let slot = 1; slot <= SLOT_COUNT; slot += 1) if (!used.has(slot)) return slot;
    return 1;
  }, [tasks]);

  return (
    <div className="flex flex-col gap-3.5">
      {/* -------- range navigator -------- */}
      <Card className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-[#27272A]/50 bg-[#18181A] text-[#7DB8FF]">
              <CalendarDays size={15} />
            </span>
            <div>
              <h2 className="text-[14px] font-bold tracking-tight text-white">Builder schedule</h2>
              <p className="text-[10px] text-neutral-500">
                {new Date(`${days[0].iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} —{' '}
                {new Date(`${days[days.length - 1].iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Earlier dates"
              onClick={() => setWindowStart((value) => value - 7)}
              className="cc-tap grid h-8 w-8 place-items-center rounded-xl border border-[#27272A]/50 bg-[#18181A] text-neutral-400 hover:text-white"
            >
              <ArrowLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                setWindowStart(0);
                scroller.current?.scrollTo({ left: 0, behavior: 'smooth' });
              }}
              className="cc-tap rounded-xl border border-[#27272A]/50 bg-[#18181A] px-2.5 py-1.5 text-[11px] font-bold text-neutral-300 hover:text-white"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Later dates"
              onClick={() => setWindowStart((value) => value + 7)}
              className="cc-tap grid h-8 w-8 place-items-center rounded-xl border border-[#27272A]/50 bg-[#18181A] text-neutral-400 hover:text-white"
            >
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniFact label="Active slots" value={`${new Set(tasks.map((item) => item.slot)).size}/${SLOT_COUNT}`} />
          <MiniFact label="Queued" value={String(tasks.length)} />
          <MiniFact
            label="Total time"
            value={hoursLabel(tasks.reduce((sum, item) => sum + item.hours, 0))}
          />
        </div>
      </Card>

      {/* -------- gantt -------- */}
      <Card className="overflow-hidden">
        <div className="flex">
          {/* fixed Y axis */}
          <div className="shrink-0 border-r border-[#27272A]/40 bg-[#0F0F10]">
            <div className="h-[52px] border-b border-[#27272A]/40" />
            {SLOT_LABELS.map((label, index) => {
              const busy = tasks.some((item) => item.slot === index + 1);
              return (
                <div
                  key={label}
                  className="flex items-center gap-1.5 border-b border-[#27272A]/25 px-2.5"
                  style={{ height: ROW_HEIGHT, width: GUTTER }}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${busy ? 'bg-[#38BDF8]' : 'bg-[#27272A]'}`} />
                  <span className="text-[10px] font-bold tracking-tight text-neutral-400">{label}</span>
                </div>
              );
            })}
          </div>

          {/* scrollable timeline */}
          <div ref={scroller} className="cc-no-scrollbar min-w-0 flex-1 overflow-x-auto">
            <div style={{ width: WINDOW_DAYS * DAY_WIDTH }}>
              {/* day header */}
              <div className="sticky top-0 z-20 flex h-[52px] border-b border-[#27272A]/40 bg-[#0F0F10]/95 backdrop-blur">
                {days.map((day) => (
                  <div
                    key={day.iso}
                    className={`shrink-0 border-r border-[#27272A]/25 px-2 py-2 ${
                      day.offset === 0 ? 'bg-[#3B1515]/45' : ''
                    }`}
                    style={{ width: DAY_WIDTH }}
                  >
                    <span
                      className={`block text-[11px] font-bold tracking-tight ${
                        day.offset === 0 ? 'text-[#FF7A7A]' : 'text-neutral-200'
                      }`}
                    >
                      {day.primary}
                    </span>
                    <span className="block text-[9px] uppercase tracking-[0.1em] text-neutral-600">{day.secondary}</span>
                  </div>
                ))}
              </div>

              {/* rows */}
              <div className="relative">
                <div
                  className="cc-gantt-grid pointer-events-none absolute inset-y-0 left-0"
                  style={{ backgroundSize: `${DAY_WIDTH}px 100%`, width: WINDOW_DAYS * DAY_WIDTH }}
                  aria-hidden="true"
                />
                {nowProgress > 0 && nowProgress < WINDOW_DAYS * DAY_WIDTH ? (
                  <div
                    className="pointer-events-none absolute inset-y-0 z-10 w-px bg-[#E52E2E]/70"
                    style={{ left: nowProgress }}
                    aria-hidden="true"
                  >
                    <span className="absolute -top-[1px] -left-[3px] h-[7px] w-[7px] rounded-full bg-[#E52E2E]" />
                  </div>
                ) : null}

                {SLOT_LABELS.map((label, index) => {
                  const slot = index + 1;
                  const slotTasks = tasks.filter((item) => item.slot === slot);
                  return (
                    <div
                      key={label}
                      className="relative border-b border-[#27272A]/25"
                      style={{ height: ROW_HEIGHT }}
                    >
                      {slotTasks.length === 0 ? (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-neutral-700">
                          Free slot
                        </span>
                      ) : null}
                      {slotTasks.map((item) => (
                        <TaskCard
                          key={item.id}
                          task={item}
                          windowStart={windowStart}
                          onSelect={() => setSelected(item.id)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* -------- slot list (accessible fallback + quick actions) -------- */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle
          title="Scheduled upgrades"
          detail="Ordered by slot, then start date."
          action={
            <ActionButton tone="red" className="px-2.5 py-1.5 text-[11px]">
              <Plus size={12} /> Add
            </ActionButton>
          }
        />
        <div className="flex flex-col gap-2">
          {tasks.length === 0 ? (
            <InnerBox className="px-3 py-6 text-center text-[11px] text-neutral-500">
              Nothing scheduled. Add an upgrade from the plan or the tracker.
            </InnerBox>
          ) : null}
          {tasks
            .slice()
            .sort((a, b) => a.slot - b.slot || a.startsAt - b.startsAt)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item.id)}
                className="cc-tap flex w-full items-center gap-3 rounded-xl border border-blue-500/50 bg-[#131926] px-3 py-2.5 text-left"
              >
                <AssetIcon name={item.name} category={item.category} size={32} rounded="rounded-lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-white">{item.name}</span>
                  <span className="block text-[10px] tabular-nums text-[#7DB8FF]">
                    Slot {item.slot} · Level {item.toLevel} · {hoursLabel(item.hours)}
                  </span>
                </span>
                <Chip tone="blue">{isoDay(item.startsAt + dayOffsetFrom(scheduleStart)).slice(5).replace('-', ' ')}</Chip>
              </button>
            ))}
        </div>
      </section>

      {/* -------- task sheet -------- */}
      {task ? (
        <Sheet
          title={task.name}
          detail={`${CATEGORY_LABELS[task.category]} · Level ${task.fromLevel} → ${task.toLevel}`}
          onClose={() => setSelected(null)}
          footer={
            <div className="flex items-center gap-2">
              <ActionButton
                tone="neutral"
                className="flex-1"
                onClick={() => {
                  removeTask(task.id);
                  setSelected(null);
                  notify(`${task.name} removed from the schedule.`, 'info');
                }}
              >
                <Trash2 size={13} /> Remove
              </ActionButton>
              <ActionButton tone="green" className="flex-1" onClick={() => setSelected(null)}>
                Done
              </ActionButton>
            </div>
          }
        >
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Fact label="Duration" value={hoursLabel(task.hours)} />
              <Fact label="Cost" value={`${compactNumber(task.cost)} ${task.resource}`} />
              <Fact label="Slot" value={`Slot ${task.slot}`} />
              <Fact
                label="Window"
                value={`${isoDay(task.startsAt + dayOffsetFrom(scheduleStart)).slice(5)} → ${isoDay(
                  task.endsAt + dayOffsetFrom(scheduleStart),
                ).slice(5)}`}
              />
            </div>

            <div className="rounded-xl border border-[#27272A]/40 bg-[#18181A] p-3">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">Move</span>
              <div className="flex items-center justify-between gap-2">
                <ActionButton
                  tone="neutral"
                  className="flex-1"
                  disabled={task.slot <= 1}
                  onClick={() => moveTask(task.id, task.slot - 1, 0)}
                >
                  ↑ Slot up
                </ActionButton>
                <ActionButton
                  tone="neutral"
                  className="flex-1"
                  disabled={task.slot >= SLOT_COUNT}
                  onClick={() => moveTask(task.id, task.slot + 1, 0)}
                >
                  ↓ Slot down
                </ActionButton>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <ActionButton tone="neutral" className="flex-1" onClick={() => moveTask(task.id, task.slot, -1)}>
                  <ArrowLeft size={12} /> 1 day
                </ActionButton>
                <ActionButton tone="neutral" className="flex-1" onClick={() => moveTask(task.id, task.slot, 1)}>
                  1 day <ArrowRight size={12} />
                </ActionButton>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
                Free slot available: <span className="font-bold text-neutral-300">Slot {freeSlot}</span>
              </p>
            </div>

            <div className="rounded-xl border border-[#27272A]/40 bg-[#18181A] p-3">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">
                Add another upgrade to Slot {freeSlot}
              </span>
              <div className="cc-no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                {queueable.slice(0, 12).map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => {
                      const level = state.progression.levels[entry.key] ?? 0;
                      addTask({
                        key: entry.key,
                        name: entry.name,
                        category: entry.category,
                        fromLevel: level,
                        toLevel: Math.min(entry.max, level + 1),
                        hours: 48 + entry.max * 8,
                        resource: entry.category === 'laboratory' ? 'dark' : 'gold',
                        cost: 900_000 * entry.max,
                        slot: freeSlot,
                        startsAt: 0,
                        endsAt: Math.max(1, Math.round((48 + entry.max * 8) / 24)),
                      });
                      notify(`${entry.name} scheduled in Slot ${freeSlot}.`);
                    }}
                    className="cc-tap flex shrink-0 items-center gap-1.5 rounded-full border border-[#27272A]/60 bg-[#121214] px-2.5 py-1.5 text-[10px] font-bold text-neutral-300 hover:text-white"
                  >
                    <GripVertical size={11} className="text-neutral-600" />
                    {entry.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function TaskCard({ task, windowStart, onSelect }: { task: UpgradeTask; windowStart: number; onSelect: () => void }) {
  const left = (task.startsAt - windowStart) * DAY_WIDTH;
  const width = (task.endsAt - task.startsAt) * DAY_WIDTH;
  if (left + width <= 0 || left >= WINDOW_DAYS * DAY_WIDTH) return null;

  const todayOffset = dayOffsetFrom(isoDay(0));
  const active = task.startsAt <= todayOffset && task.endsAt > todayOffset;
  const elapsedDays = Math.max(0, Math.min(task.endsAt - task.startsAt, todayOffset - task.startsAt));
  const remainingHours = Math.max(0, task.hours - elapsedDays * 24);
  const remainingLabel = active ? hoursLabel(remainingHours) : hoursLabel(task.hours);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="cc-tap absolute z-10 overflow-hidden rounded-xl border border-blue-500/50 bg-[#131926] px-2 py-1.5 text-left shadow-[0_6px_18px_rgba(0,0,0,0.4)]"
      style={{
        left: Math.max(0, left) + 3,
        width: Math.max(66, Math.min(width, WINDOW_DAYS * DAY_WIDTH - Math.max(0, left)) - 6),
        top: 8,
        height: ROW_HEIGHT - 16,
      }}
      title={`${task.name} — level ${task.toLevel}, ${remainingLabel} left`}
    >
      <span className="flex items-center gap-1.5">
        <AssetIcon name={task.name} category={task.category} size={20} rounded="rounded-md" />
        <span className="min-w-0 flex-1 truncate text-[10px] font-bold leading-tight text-white">{task.name}</span>
      </span>
      <span className="mt-1 block truncate text-[9px] font-bold tabular-nums text-[#7DB8FF]">
        Level {task.toLevel} · {remainingLabel}
      </span>
      {active ? (
        <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#38BDF8]/70">
          <span
            className="block h-full bg-[#00C29A]"
            style={{ width: `${Math.min(100, (elapsedDays * 24 / task.hours) * 100)}%` }}
          />
        </span>
      ) : null}
    </button>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <InnerBox className="px-2.5 py-2">
      <span className="block text-[9px] font-medium uppercase tracking-[0.08em] text-neutral-500">{label}</span>
      <strong className="mt-0.5 block text-[13px] font-bold tabular-nums text-white">{value}</strong>
    </InnerBox>
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
