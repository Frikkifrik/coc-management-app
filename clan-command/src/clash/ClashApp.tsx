import { useMemo, useState } from 'react';
import {
  Download,
  ExternalLink,
  KeyRound,
  Link2,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { LegendStrip, ProgressionView } from './ProgressionView';
import { GanttView } from './GanttView';
import { PlanView } from './PlanView';
import { CollectionView } from './CollectionView';
import { WarView } from './WarView';
import { ClanView } from './ClanView';
import { HomeView } from './HomeView';
import {
  ActionButton,
  AssetIcon,
  BottomNav,
  Card,
  Chip,
  InnerBox,
  NoticeStack,
  SectionTitle,
  Sheet,
  TopBar,
  ViewSelector,
} from './components';
import { useOptionalAuth } from './auth';
import { ClashProvider, formatNumber, normaliseTag, useClash } from './store';
import './clash.css';

const SCREEN_INFO: Record<string, { title: string; body: string[] }> = {
  home: {
    title: 'Home',
    body: [
      'Family overview: village completion, the live war bar, CWL position and clan readiness in one scroll.',
      'Sync live pulls the Supercell player endpoint through this app’s own server. The API key never reaches the browser.',
    ],
  },
  profile: {
    title: 'Profile',
    body: [
      'The view selector switches between Home Village, Builder Base, Calendar, Plan and Collection without leaving the player.',
      'Completion pills are gold at exactly 100% and red below it. Tap any category row to adjust levels or push an item into the plan.',
      'Level caps follow the Town Hall 17 reference sheet, so a maxed row really means maxed for that hall.',
    ],
  },
  clan: {
    title: 'Clan',
    body: [
      'Roster is sortable by trophies, donations, war stars or Town Hall, and can be filtered to members who opted in to war.',
      'The family switcher re-points the whole workspace at another clan tag in the family.',
    ],
  },
  war: {
    title: 'War & CWL',
    body: [
      'The dual-team bar compares contested stars and destruction: green is your clan, red is the opponent.',
      'History cards show the CWL group rank, the W-T-L record, stars and destruction for each round.',
    ],
  },
};

function Shell() {
  const auth = useOptionalAuth();
  const { state, route, view, setRoute, syncLive, syncing, exportJson, importJson, resetDemo, linkTag, unlinkTag, verifyTag, setIntegrations, notify } = useClash();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [labelDraft, setLabelDraft] = useState('');
  const [tokenDraft, setTokenDraft] = useState('');

  const { player, clan } = state;
  const info = SCREEN_INFO[route] ?? SCREEN_INFO.profile;

  const title = useMemo(() => {
    if (route === 'home') return clan.name;
    if (route === 'clan') return clan.name;
    if (route === 'war') return 'War & CWL';
    return player.name;
  }, [route, clan.name, player.name]);

  const tag = route === 'profile' ? player.tag : route === 'war' ? clan.tag : clan.tag;
  const kicker = route === 'profile' ? `${player.clanRole} · ${player.clanName}` : 'Misclicked Family';

  return (
    <div className="clash-app">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-black">
        <TopBar
          title={title}
          tag={tag}
          kicker={kicker}
          onBack={route === 'profile' ? () => setRoute('home') : undefined}
          onShare={async () => {
            const url = `${window.location.origin}${window.location.pathname}#/${route}`;
            const text =
              route === 'profile'
                ? `${player.name} · TH${player.townHallLevel} · ${player.tag}`
                : `${clan.name} · ${clan.tag}`;
            try {
              if (navigator.share) {
                await navigator.share({ title: 'Clash Command', text, url });
                return;
              }
              await navigator.clipboard.writeText(`${text} — ${url}`);
              notify('Link copied to the clipboard.', 'success');
            } catch {
              notify('Sharing is unavailable in this browser.', 'info');
            }
          }}
          onSettings={() => setSettingsOpen(true)}
          onInfo={() => setInfoOpen(true)}
        >
          {route === 'profile' ? <ViewSelector /> : null}
        </TopBar>

        <main className="flex-1 px-3 pb-28 pt-3.5">
          {route === 'home' ? <HomeView /> : null}
          {route === 'clan' ? <ClanView /> : null}
          {route === 'war' ? <WarView /> : null}
          {route === 'profile' ? (
            <>
              {view === 'home-village' ? <ProgressionView village="home" /> : null}
              {view === 'builder-base' ? <ProgressionView village="builder" /> : null}
              {view === 'calendar' ? <GanttView /> : null}
              {view === 'plan' ? <PlanView /> : null}
              {view === 'collection' ? <CollectionView village="home" /> : null}
              <div className="mt-3.5">
                <LegendStrip />
              </div>
            </>
          ) : null}
        </main>

        <BottomNav />
      </div>

      <NoticeStack />

      {/* ---------------- info ---------------- */}
      {infoOpen ? (
        <Sheet title={info.title} detail="How this screen is built" onClose={() => setInfoOpen(false)}>
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2">
              {info.body.map((line) => (
                <li key={line} className="flex gap-2.5 rounded-xl bg-[#18181A] px-3 py-2.5">
                  <ShieldCheck size={14} className="mt-[2px] shrink-0 text-[#00C29A]" />
                  <span className="text-[11px] leading-relaxed text-neutral-300">{line}</span>
                </li>
              ))}
            </ul>

            <InnerBox className="px-3 py-3">
              <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                Artwork policy
              </span>
              <p className="text-[11px] leading-relaxed text-neutral-400">
                This app renders <strong className="text-white">no generated artwork</strong>. Tiles show official
                Supercell icons when an <span className="font-mono text-neutral-300">iconUrl</span> is supplied by the live
                API or a JSON import; otherwise they show a neutral typographic mark. Clan badges and the ClashKing logo are
                used exactly as provided, without recolouring or cropping.
              </p>
            </InnerBox>

            <InnerBox className="px-3 py-3">
              <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                Demo vs live
              </span>
              <p className="text-[11px] leading-relaxed text-neutral-400">
                {player.live
                  ? `This village was loaded from the Supercell API at ${new Date(player.syncedAt ?? Date.now()).toLocaleString('en-GB')}. Buildings, defences, traps and wall segments are still local — the player endpoint does not expose them.`
                  : 'Every number on screen is seeded demo data held in this browser. Configure a Supercell API key or import a JSON payload to replace it.'}
              </p>
            </InnerBox>
          </div>
        </Sheet>
      ) : null}

      {/* ---------------- settings ---------------- */}
      {settingsOpen ? (
        <Sheet
          title="Settings"
          detail="Linked villages, integrations and data"
          onClose={() => setSettingsOpen(false)}
          footer={
            <ActionButton tone="neutral" className="w-full" onClick={() => setSettingsOpen(false)}>
              Done
            </ActionButton>
          }
        >
          <div className="flex flex-col gap-4">
            {/* linked tags */}
            <section className="flex flex-col gap-2">
              <SectionTitle title="Linked player tags" detail="Verified with the in-game API token." />
              {state.linkedTags.map((entry) => (
                <div key={entry.tag} className="rounded-xl border border-[#27272A]/40 bg-[#18181A] p-3">
                  <div className="flex items-center gap-2.5">
                    <AssetIcon name={entry.label} category="heroes" size={30} rounded="rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-white">{entry.label}</span>
                      <span className="block truncate text-[10px] tabular-nums text-neutral-500">{entry.tag}</span>
                    </span>
                    <Chip tone={entry.verified ? 'green' : 'red'}>{entry.verified ? 'Verified' : 'Unverified'}</Chip>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-[9px] text-neutral-600">
                      token {entry.tokenFingerprint}
                    </span>
                    <ActionButton
                      tone="neutral"
                      className="px-2 py-1 text-[10px]"
                      onClick={() => void verifyTag(entry.tag)}
                      disabled={entry.verified}
                    >
                      <KeyRound size={11} /> Verify
                    </ActionButton>
                    <ActionButton tone="ghost" className="px-2 py-1 text-[10px]" onClick={() => unlinkTag(entry.tag)}>
                      <Trash2 size={11} />
                    </ActionButton>
                  </div>
                </div>
              ))}

              <div className="rounded-xl border border-[#27272A]/40 bg-[#18181A] p-3">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-500">
                  Link another village
                </span>
                <div className="flex flex-col gap-2">
                  <input
                    value={tagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    placeholder="#PLAYERTAG"
                    aria-label="Player tag"
                    className="w-full rounded-lg border border-[#27272A]/60 bg-[#121214] px-2.5 py-2 text-[12px] tabular-nums uppercase text-white outline-none focus:border-[#E52E2E]/60"
                  />
                  <input
                    value={labelDraft}
                    onChange={(event) => setLabelDraft(event.target.value)}
                    placeholder="Label (Main, War alt…)"
                    aria-label="Label"
                    className="w-full rounded-lg border border-[#27272A]/60 bg-[#121214] px-2.5 py-2 text-[12px] text-white outline-none focus:border-[#E52E2E]/60"
                  />
                  <input
                    value={tokenDraft}
                    onChange={(event) => setTokenDraft(event.target.value)}
                    type="password"
                    placeholder="In-game API token"
                    aria-label="In-game API token"
                    autoComplete="off"
                    className="w-full rounded-lg border border-[#27272A]/60 bg-[#121214] px-2.5 py-2 font-mono text-[11px] text-white outline-none focus:border-[#E52E2E]/60"
                  />
                  <ActionButton
                    tone="red"
                    className="w-full"
                    onClick={() => {
                      const tag = normaliseTag(tagDraft);
                      if (!/^#[0-9A-Z]{3,16}$/.test(tag)) {
                        notify('Enter a valid Supercell tag, e.g. #2YL8V0JQ.', 'error');
                        return;
                      }
                      linkTag(tag, labelDraft, tokenDraft);
                      notify(`${tag} linked. Run Verify to check ownership.`, 'success');
                      setTagDraft('');
                      setLabelDraft('');
                      setTokenDraft('');
                    }}
                  >
                    <Link2 size={12} /> Link village
                  </ActionButton>
                  <p className="text-[9px] leading-relaxed text-neutral-600">
                    Only a fingerprint of the token is stored locally — never the token itself.
                  </p>
                </div>
              </div>
            </section>

            {/* integrations */}
            <section className="flex flex-col gap-2">
              <SectionTitle
                title="Integrations"
                detail={
                  auth?.user
                    ? `Signed in as ${auth.user.displayName} · ${auth.user.role.replace('_', '-')}`
                    : 'Not signed in — live Supercell lookups need a session.'
                }
              />
              <div className="rounded-xl border border-[#27272A]/40 bg-[#18181A] p-3">
                <IntegrationRow
                  label="Supercell API"
                  ok={state.integrations.supercellConfigured}
                  detail={
                    state.integrations.supercellConfigured
                      ? 'Server key detected.'
                      : 'Set SUPERCELL_API_KEY on the server to enable live lookups.'
                  }
                />
                <IntegrationRow
                  label="Supabase"
                  ok={state.integrations.supabaseConfigured}
                  detail={
                    state.integrations.supabaseConfigured
                      ? 'Connected for auth and stored profiles.'
                      : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
                  }
                />
                <label className="mt-3 block">
                  <span className="block text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-500">
                    ClashKing endpoint
                  </span>
                  <input
                    value={state.integrations.clashkingEndpoint}
                    onChange={(event) => setIntegrations({ clashkingEndpoint: event.target.value })}
                    placeholder="https://bot.clashking.space/api/…"
                    className="mt-1 w-full rounded-lg border border-[#27272A]/60 bg-[#121214] px-2.5 py-2 font-mono text-[11px] text-white outline-none focus:border-[#E52E2E]/60"
                  />
                </label>
                <label className="mt-2 block">
                  <span className="block text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-500">
                    ClashOfStats endpoint
                  </span>
                  <input
                    value={state.integrations.clashofstatsEndpoint}
                    onChange={(event) => setIntegrations({ clashofstatsEndpoint: event.target.value })}
                    placeholder="https://www.clashofstats.com/api/…"
                    className="mt-1 w-full rounded-lg border border-[#27272A]/60 bg-[#121214] px-2.5 py-2 font-mono text-[11px] text-white outline-none focus:border-[#E52E2E]/60"
                  />
                </label>
                <div className="mt-3 flex items-center gap-2">
                  <ActionButton tone="neutral" className="flex-1" onClick={() => void syncLive()} disabled={syncing}>
                    <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing…' : 'Sync now'}
                  </ActionButton>
                  <ActionButton
                    tone="neutral"
                    className="flex-1"
                    onClick={() => {
                      if (auth?.user) {
                        void auth.signOut().then(() => notify('Signed out.', 'info'));
                      } else {
                        window.location.assign('/login');
                      }
                    }}
                  >
                    <ExternalLink size={12} /> {auth?.user ? 'Sign out' : 'Sign in'}
                  </ActionButton>
                </div>
              </div>
            </section>

            {/* data */}
            <section className="flex flex-col gap-2">
              <SectionTitle title="Data" detail="Everything in this workspace is yours to export." />
              <div className="rounded-xl border border-[#27272A]/40 bg-[#18181A] p-3">
                <div className="grid grid-cols-2 gap-2">
                  <ActionButton tone="neutral" onClick={exportJson}>
                    <Download size={12} /> Export JSON
                  </ActionButton>
                  <ActionButton tone="neutral" onClick={() => setImportOpen(true)}>
                    <Upload size={12} /> Import JSON
                  </ActionButton>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Fact label="Progression entries" value={formatNumber(Object.keys(state.progression.levels).length)} />
                  <Fact label="Scheduled / planned" value={`${state.tasks.length} / ${state.plan.length}`} />
                </div>
                <ActionButton tone="ghost" className="mt-2 w-full" onClick={resetDemo}>
                  <PlugZap size={12} /> Reset to the seeded demo village
                </ActionButton>
              </div>
            </section>

            <Card className="p-3">
              <p className="text-[10px] leading-relaxed text-neutral-500">
                Clash Command stores this workspace in your browser’s local storage. Supabase, when configured, adds
                server-side profiles and linked tags; the Supercell key and any Discord webhook stay on the server and are
                never exposed to the client.
              </p>
            </Card>
          </div>
        </Sheet>
      ) : null}

      {/* ---------------- import ---------------- */}
      {importOpen ? (
        <Sheet
          title="Import JSON"
          detail="Merges progression, plan and schedule from a payload."
          onClose={() => setImportOpen(false)}
          footer={
            <div className="flex items-center gap-2">
              <ActionButton tone="neutral" className="flex-1" onClick={() => setImportOpen(false)}>
                Cancel
              </ActionButton>
              <ActionButton
                tone="red"
                className="flex-1"
                onClick={async () => {
                  await importJson(importText);
                  setImportOpen(false);
                  setImportText('');
                }}
              >
                Import
              </ActionButton>
            </div>
          }
        >
          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            rows={10}
            spellCheck={false}
            placeholder='{ "player": { "tag": "#2YL8V0JQ" }, "progression": { "levels": { … } } }'
            aria-label="JSON payload"
            className="w-full resize-y rounded-xl border border-[#27272A]/60 bg-[#18181A] px-3 py-2.5 font-mono text-[11px] leading-relaxed text-neutral-200 outline-none placeholder:text-neutral-700 focus:border-[#E52E2E]/60"
          />
        </Sheet>
      ) : null}
    </div>
  );
}

function IntegrationRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${ok ? 'bg-[#10B981]' : 'bg-[#E52E2E]'}`} />
      <span className="min-w-0">
        <span className="block text-[11px] font-bold text-neutral-200">{label}</span>
        <span className="block text-[10px] leading-snug text-neutral-500">{detail}</span>
      </span>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#121214] px-2.5 py-2">
      <span className="block text-[8px] font-medium uppercase tracking-[0.06em] text-neutral-500">{label}</span>
      <strong className="mt-0.5 block truncate text-[12px] font-bold tabular-nums text-white">{value}</strong>
    </div>
  );
}

export default function ClashApp() {
  return (
    <ClashProvider>
      <Shell />
    </ClashProvider>
  );
}
