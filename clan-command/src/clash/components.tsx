import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Home,
  Info,
  Share2,
  Settings2,
  Swords,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { assetPathFor } from './assets';
import { CATEGORY_ABBR, type CategoryId } from './catalog';
import { ROUTES, VIEWS, useClash } from './store';
import type { RouteId, ViewId } from './types';

/* ================================================================== */
/* Asset artwork                                                       */
/*                                                                     */
/* POLICY: no generated artwork. When an official icon URL is present  */
/* (Supercell API `iconUrls`, or a JSON import) it is rendered as-is.  */
/* Otherwise the tile shows a neutral typographic mark — never a       */
/* simulated render of the game asset.                                 */
/* ================================================================== */

const CATEGORY_TONE: Record<CategoryId, string> = {
  buildings: '#7C8894',
  defenses: '#E52E2E',
  traps: '#F59E0B',
  supercharge: '#00C29A',
  heroes: '#F5C451',
  guardians: '#8B7CF6',
  laboratory: '#38BDF8',
  equipment: '#00C29A',
  pets: '#F472B6',
  walls: '#9AA1A9',
};

export function monogram(name: string): string {
  const clean = name.replace(/[^A-Za-z0-9. ]/g, '');
  const parts = clean.split(/[\s.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

export function AssetIcon({
  name,
  category,
  iconUrl,
  assetKey,
  size = 34,
  className = '',
  rounded = 'rounded-lg',
}: {
  name: string;
  category: CategoryId;
  /** Live Supercell `iconUrls` value, when a sync or import supplied one. */
  iconUrl?: string;
  /** Catalog key (or `category:<id>`) used to resolve local official artwork. */
  assetKey?: string;
  size?: number;
  className?: string;
  rounded?: string;
}) {
  const [skipped, setSkipped] = useState(0);
  const local = assetPathFor(assetKey);

  // Local official artwork wins, then the live API icon, then the mark.
  const candidates = useMemo(
    () => [local, iconUrl].filter((value): value is string => Boolean(value)),
    [local, iconUrl],
  );

  useEffect(() => setSkipped(0), [assetKey, name]);

  const tone = CATEGORY_TONE[category] ?? '#7C8894';
  const src = candidates[skipped];
  const showImage = Boolean(src);

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden bg-[#1F1F22] ${rounded} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
          onError={() => setSkipped((value) => value + 1)}
        />
      ) : (
        <>
          <span
            className="absolute inset-0 opacity-70"
            style={{ background: `linear-gradient(150deg, ${tone}1f 0%, transparent 62%)` }}
          />
          <span className="cc-tile-glyph relative text-[10px] font-bold tracking-tight text-neutral-400">
            {monogram(name) || CATEGORY_ABBR[category]}
          </span>
          <span className="absolute bottom-[3px] right-[3px] h-[3px] w-[3px] rounded-full" style={{ background: tone }} />
        </>
      )}
    </span>
  );
}

/* ================================================================== */
/* Surfaces                                                            */
/* ================================================================== */

export function Card({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'article' | 'div' | 'aside';
}) {
  return (
    <Tag className={`rounded-2xl border border-[#27272A]/40 bg-[#0F0F10] ${className}`.trim()}>{children}</Tag>
  );
}

export function InnerBox({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl bg-[#18181A] ${className}`.trim()}>{children}</div>;
}

export function SectionTitle({
  title,
  detail,
  action,
  className = '',
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between gap-3 px-1 ${className}`.trim()}>
      <div className="min-w-0">
        <h2 className="text-[13px] font-bold tracking-tight text-white">{title}</h2>
        {detail ? <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{detail}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ================================================================== */
/* Completion pill — gold when maxed, red when still in progress       */
/* ================================================================== */

export function CompletionPill({ percent, maxed, compact = false }: { percent: number; maxed?: boolean; compact?: boolean }) {
  const done = maxed ?? percent >= 100;
  const label = `${percent >= 100 ? 100 : Math.round(percent)}%`;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-lg border font-bold tabular-nums ${
        compact ? 'px-1.5 py-[3px] text-[10px]' : 'px-2 py-1 text-[11px]'
      } ${
        done
          ? 'border-amber-500/60 bg-[#18181A] text-amber-300'
          : 'border-red-500/60 bg-[#18181A] text-red-400'
      }`}
      title={done ? 'Fully maxed' : `${label} complete`}
    >
      {done ? <Check size={compact ? 10 : 11} strokeWidth={3} /> : null}
      {label}
    </span>
  );
}

/* ================================================================== */
/* Progress ring (accent red by default)                               */
/* ================================================================== */

export function Ring({
  percent,
  size = 44,
  stroke = 4,
  color,
  children,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const done = clamped >= 100;
  const strokeColor = color ?? (done ? '#F5C451' : '#E52E2E');

  return (
    <span className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="cc-ring" aria-hidden="true">
        <circle className="cc-ring__track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * clamped) / 100}
          style={{ transition: 'stroke-dashoffset 420ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[11px] font-bold tabular-nums text-white">
        {children ?? `${Math.round(clamped)}`}
      </span>
    </span>
  );
}

export function Bar({ percent, tone = 'red', className = '' }: { percent: number; tone?: 'red' | 'green' | 'blue' | 'amber'; className?: string }) {
  const colors = {
    red: 'bg-[#E52E2E]',
    green: 'bg-[#10B981]',
    blue: 'bg-[#38BDF8]',
    amber: 'bg-[#F5C451]',
  } as const;
  return (
    <span className={`block h-1.5 w-full overflow-hidden rounded-full bg-[#1F1F22] ${className}`.trim()}>
      <span
        className={`block h-full rounded-full ${colors[tone]}`}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%`, transition: 'width 380ms ease' }}
      />
    </span>
  );
}

/* ================================================================== */
/* Top navigation bar                                                  */
/* ================================================================== */

export function TopBar({
  title,
  tag,
  kicker,
  onBack,
  onShare,
  onSettings,
  onInfo,
  children,
}: {
  title: string;
  tag?: string;
  kicker?: string;
  onBack?: () => void;
  onShare?: () => void;
  onSettings?: () => void;
  onInfo?: () => void;
  children?: ReactNode;
}) {
  return (
    <header className="cc-header-gradient cc-safe-top sticky top-0 z-30 border-b border-[#27272A]/40">
      <div className="flex items-center gap-1 px-3 pt-2 pb-3">
        {onBack ? (
          <NavButton label="Go back" onClick={onBack}>
            <ChevronLeft size={20} />
          </NavButton>
        ) : (
          <span className="w-9" aria-hidden="true" />
        )}

        <div className="min-w-0 flex-1 text-center">
          {kicker ? (
            <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-500">{kicker}</span>
          ) : null}
          <h1 className="truncate text-[17px] font-bold leading-tight tracking-tight text-white">{title}</h1>
          {tag ? <span className="block text-[11px] font-medium tabular-nums text-neutral-500">{tag}</span> : null}
        </div>

        <div className="flex items-center gap-1">
          {onShare ? (
            <NavButton label="Share" onClick={onShare}>
              <Share2 size={17} />
            </NavButton>
          ) : null}
          {onSettings ? (
            <NavButton label="Settings" onClick={onSettings}>
              <Settings2 size={17} />
            </NavButton>
          ) : null}
          {onInfo ? (
            <NavButton label="About this screen" onClick={onInfo}>
              <Info size={17} />
            </NavButton>
          ) : null}
        </div>
      </div>
      {children ? <div className="px-3 pb-3">{children}</div> : null}
    </header>
  );
}

export function NavButton({
  label,
  children,
  onClick,
  active = false,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`cc-tap grid h-9 w-9 place-items-center rounded-xl border transition-colors ${
        active
          ? 'border-[#E52E2E]/50 bg-[#3B1515] text-[#FF6B6B]'
          : 'border-[#27272A]/50 bg-[#18181A]/70 text-neutral-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

/* ================================================================== */
/* View selector — full width, dark, red active state                  */
/* ================================================================== */

const ROUTE_ICONS: Record<RouteId, LucideIcon> = {
  home: Home,
  profile: UserRound,
  clan: Users,
  war: Swords,
};

export function ViewSelector() {
  const { view, setView } = useClash();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = VIEWS.find((item) => item.id === view) ?? VIEWS[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="cc-tap flex w-full items-center justify-between gap-3 rounded-2xl border border-[#27272A]/50 bg-[#121214] px-3.5 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-500">Viewing</span>
          <span className="mt-0.5 block truncate text-[15px] font-bold tracking-tight text-white">{current.label}</span>
        </span>
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#27272A]/60 bg-[#18181A] text-neutral-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        >
          <ChevronDown size={15} />
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Select view"
          className="cc-sheet absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-2xl border border-[#27272A]/60 bg-[#0F0F10] p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
        >
          {VIEWS.map((item) => {
            const active = item.id === view;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setView(item.id as ViewId);
                  setOpen(false);
                }}
                className={`cc-tap flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  active ? 'bg-[#3B1515]' : 'hover:bg-[#18181A]'
                }`}
              >
                <span className="min-w-0">
                  <span className={`block text-[14px] font-bold tracking-tight ${active ? 'text-white' : 'text-neutral-200'}`}>
                    {item.label}
                  </span>
                  <span className="block truncate text-[11px] text-neutral-500">{item.hint}</span>
                </span>
                {active ? (
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#E52E2E] text-white">
                    <Check size={13} strokeWidth={3.5} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* ================================================================== */
/* Bottom navigation — floating pill                                   */
/* ================================================================== */

export function BottomNav() {
  const { route, setRoute } = useClash();
  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-3"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
    >
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-[#27272A]/50 bg-[#18181A]/95 p-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.6)] backdrop-blur-md">
        {ROUTES.map((item) => {
          const Icon = ROUTE_ICONS[item.id];
          const active = route === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setRoute(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`cc-tap flex items-center gap-1.5 rounded-full py-2 text-[11px] font-bold transition-colors ${
                active ? 'bg-[#28282B] px-3.5 text-white' : 'px-3 text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2.4 : 2} className={active ? 'text-[#FF5A5A]' : ''} />
              {active ? <span>{item.label}</span> : <span className="sr-only">{item.label}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ================================================================== */
/* Buttons & sheets                                                    */
/* ================================================================== */

export function ActionButton({
  children,
  tone = 'neutral',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'neutral' | 'red' | 'green' | 'ghost' }) {
  const tones = {
    neutral: 'border-[#27272A]/60 bg-[#18181A] text-neutral-100 hover:bg-[#1F1F22]',
    red: 'border-[#E52E2E]/50 bg-[#3B1515] text-[#FF7A7A] hover:bg-[#4a1a1a]',
    green: 'border-[#10B981]/40 bg-[#0d2a22] text-[#34D399] hover:bg-[#10332a]',
    ghost: 'border-transparent bg-transparent text-neutral-400 hover:text-white',
  } as const;
  return (
    <button
      type="button"
      className={`cc-tap inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-bold tracking-tight ${tones[tone]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export function Sheet({
  title,
  detail,
  onClose,
  children,
  footer,
}: {
  title: string;
  detail?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const labelId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="cc-sheet-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-[2px] sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className="cc-sheet cc-safe-bottom flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-[#27272A]/60 bg-[#0F0F10] sm:max-w-md sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#27272A]/40 px-4 py-3.5">
          <div className="min-w-0">
            <h2 id={labelId} className="truncate text-[16px] font-bold tracking-tight text-white">
              {title}
            </h2>
            {detail ? <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{detail}</p> : null}
          </div>
          <NavButton label="Close" onClick={onClose}>
            <X size={17} />
          </NavButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="border-t border-[#27272A]/40 px-4 py-3">{footer}</div> : null}
      </section>
    </div>
  );
}

/* ================================================================== */
/* Notices                                                             */
/* ================================================================== */

export function NoticeStack() {
  const { notices, dismissNotice } = useClash();
  if (!notices.length) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[60] flex flex-col items-center gap-2 px-3">
      {notices.map((notice) => (
        <div
          key={notice.id}
          role="status"
          className={`cc-sheet pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-2xl border px-3.5 py-3 text-[12px] leading-snug shadow-[0_18px_44px_rgba(0,0,0,0.6)] ${
            notice.tone === 'error'
              ? 'border-[#E52E2E]/40 bg-[#1a1011] text-[#FFB4B4]'
              : notice.tone === 'success'
                ? 'border-[#10B981]/35 bg-[#0d1f19] text-[#86EFAC]'
                : 'border-[#27272A]/60 bg-[#121214] text-neutral-200'
          }`}
        >
          <span className="flex-1">{notice.text}</span>
          <button type="button" aria-label="Dismiss" onClick={() => dismissNotice(notice.id)} className="cc-tap text-neutral-500 hover:text-white">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/* Small shared bits                                                   */
/* ================================================================== */

export function KeyValue({ label, value, tone }: { label: string; value: ReactNode; tone?: 'red' | 'green' | 'amber' }) {
  const toneClass = tone === 'red' ? 'text-[#FF6B6B]' : tone === 'green' ? 'text-[#34D399]' : tone === 'amber' ? 'text-amber-300' : 'text-white';
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500">{label}</span>
      <strong className={`mt-0.5 block truncate text-[14px] font-bold tabular-nums ${toneClass}`}>{value}</strong>
    </div>
  );
}

export function Chip({ children, tone = 'neutral', className = '' }: { children: ReactNode; tone?: 'neutral' | 'red' | 'green' | 'amber' | 'blue'; className?: string }) {
  const tones = {
    neutral: 'border-[#27272A]/60 bg-[#18181A] text-neutral-400',
    red: 'border-[#E52E2E]/40 bg-[#3B1515] text-[#FF7A7A]',
    green: 'border-[#10B981]/35 bg-[#0d2a22] text-[#34D399]',
    amber: 'border-amber-500/40 bg-[#2a2210] text-amber-300',
    blue: 'border-blue-500/40 bg-[#131926] text-[#7DB8FF]',
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.06em] ${tones[tone]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#27272A]/50 bg-[#0F0F10] px-5 py-8 text-center">
      <h3 className="text-[14px] font-bold text-white">{title}</h3>
      <p className="max-w-[34ch] text-[11px] leading-relaxed text-neutral-500">{detail}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
