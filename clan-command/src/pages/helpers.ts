import type { AppRole, Member, War } from '../types';

export const roleName: Record<AppRole, string> = { leader: 'Leader', co_leader: 'Co-Leader', elder: 'Elder', member: 'Member' };
export const roleRank: Record<AppRole, number> = { member: 1, elder: 2, co_leader: 3, leader: 4 };

export function readinessScore(member: Partial<Member>, mode: 'war' | 'cwl' = 'war') {
  const hero = Number(member.heroReadiness || 0);
  const entries90d = Number(member.warEntries90d || 0);
  const hasWarHistory = entries90d >= 2;
  const missed = hasWarHistory ? Number(member.warMissed90d ?? member.missedAttacks30d ?? 0) : Number(member.missedAttacks30d || 0);
  const activity = Math.min(100, Math.round((Number(member.warAttacks30d || 0) / 6) * 100));
  const attacksMade90d = Number(member.warAttacks90d || 0);
  const plannedAttacks90d = attacksMade90d + Number(member.warMissed90d || 0);
  const completion = hasWarHistory && plannedAttacks90d > 0 ? attacksMade90d / plannedAttacks90d * 100 : activity;
  const starSignal = hasWarHistory ? Math.min(100, Number(member.averageStars90d || 0) / 3 * 100) : Math.max(0, 100 - missed * 28);
  const destruction = hasWarHistory ? Number(member.averageDestruction90d || 0) : activity;
  const penalty = Math.min(30, missed * (hasWarHistory ? 10 : 28));
  const score = hasWarHistory
    ? Math.max(0, Math.round(hero * 0.4 + completion * 0.3 + starSignal * 0.2 + destruction * 0.1 - penalty))
    : Math.round(hero * 0.4 + starSignal * 0.4 + activity * 0.2);
  const optedIn = mode === 'cwl' ? member.cwlOptIn : member.warOptIn;
  const threshold = mode === 'cwl' ? 82 : 76;
  return { score, optedIn: Boolean(optedIn), ready: Boolean(optedIn) && score >= threshold && missed < 2, threshold };
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}
export function shortDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...options }).format(date);
}
export function longDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
export function shortTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);
}
export function relativeTime(value: string | null | undefined) {
  if (!value) return 'No recent activity';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No recent activity';
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
  const unit = Math.abs(minutes) < 60 ? 'minute' : Math.abs(minutes) < 24 * 60 ? 'hour' : 'day';
  const divisor = unit === 'minute' ? 1 : unit === 'hour' ? 60 : 24 * 60;
  const amount = Math.round(minutes / divisor);
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(amount, unit as Intl.RelativeTimeFormatUnit);
}
export function warStatusLabel(war: War) {
  if (war.state === 'in_war') return 'Battle live';
  if (war.state === 'preparation') return 'Preparation';
  if (war.state === 'cancelled') return 'Cancelled';
  return war.result === 'win' ? 'Victory' : war.result === 'loss' ? 'Defeat' : war.result === 'draw' ? 'Draw' : 'Complete';
}
export function dateTimeInput(value?: string) {
  const date = value ? new Date(value) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
export function toIso(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}
export function readinessTone(score: number): 'green' | 'orange' | 'red' {
  return score >= 82 ? 'green' : score >= 65 ? 'orange' : 'red';
}
