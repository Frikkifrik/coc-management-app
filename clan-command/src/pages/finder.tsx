import { useEffect, useState } from 'react';
import { ArrowRight, Award, Copy, ExternalLink, Search, Shield, Sparkles, Swords, Trophy } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Avatar, Badge, Button, EmptyState, PageHeading, Panel, ProgressBar } from '../components/ui';
import { apiRequest, fetchLivePlayer } from '../api';
import { useWorkspace } from '../workspace-context';
import type { Member } from '../types';
import { formatNumber, readinessScore, readinessTone } from './helpers';

// Standalone Supercell API Fetcher
async function fetchPlayerData(playerTag: string) {
  // Routes through your local server via apiRequest to bypass Cloudflare browser block
  return await fetchLivePlayer<any>(playerTag);
}

export function FinderPage() {
  const { data, notify } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [results, setResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setQuery(params.get('q') || '');
  }, [params]);

  useEffect(() => {
    const value = query.trim();
    const timer = window.setTimeout(async () => {
      if (!value) {
        setResults([]);
        setSearched(false);
        setSearching(false);
        setError('');
        return;
      }
      setSearching(true);
      setError('');
      setSearched(true);

      try {
        // If searching a tag starting with # or tag pattern
        if (value.startsWith('#') || /^[0-9A-Z]{6,}$/i.test(value)) {
          const livePlayer = await fetchPlayerData(value);

          // Calculate hero readiness %
          const totalHeroes = livePlayer.heroes?.length || 0;
          const maxedHeroes = livePlayer.heroes?.filter((h: any) => h.level === h.maxLevel).length || 0;
          const heroReadinessPct = totalHeroes > 0 ? Math.round((maxedHeroes / totalHeroes) * 100) : 100;

          // Map live Supercell JSON to match full Member interface
          const mappedMember: Member = {
            id: livePlayer.tag,
            tag: livePlayer.tag,
            name: livePlayer.name || 'Unknown',
            accountType: 'main',
            clanId: livePlayer.clan?.tag || 'none',
            clanName: livePlayer.clan?.name || 'No Clan',
            role: 'member' as any,
            townHall: livePlayer.townHallLevel || 1,
            builderHall: livePlayer.builderHallLevel || 0,
            xpLevel: livePlayer.expLevel || 1,
            trophies: livePlayer.trophies || 0,
            bestTrophies: livePlayer.bestTrophies || 0,
            builderBaseTrophies: livePlayer.versusTrophies || 0,
            builderBaseLeague: 'Unranked',
            warStars: livePlayer.warStars || 0,
            league: livePlayer.league?.name || 'Unranked',
            rankedTier: livePlayer.builderHallLevel ? `BH ${livePlayer.builderHallLevel}` : 'Main Village',
            rankedPoints: livePlayer.trophies || 0,
            rewardPoints: 0,
            heroReadiness: heroReadinessPct,
            heroLevels: {} as any,
            warOptIn: true,
            cwlOptIn: true,
            missedAttacks30d: 0,
            warAttacks30d: 0,
            donationRatio: 1.0,
            lastActiveAt: new Date().toISOString(),
            joinedAt: new Date().toISOString(),
            baseLink: '',
            isActive: true,
            bio: '',
          };

          setResults([mappedMember]);
        } else {
          // Fall back to saved workspace search for fuzzy names
          const response = await apiRequest<{ items: Member[] }>(`/api/search?q=${encodeURIComponent(value)}`);
          setResults(response.items);
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Search could not run.');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setParams(query.trim() ? { q: query.trim() } : {});
  }

  async function copyTag(tag: string) {
    try {
      await navigator.clipboard.writeText(tag);
      notify(`Copied ${tag}`);
    } catch {
      notify('Clipboard permission was not available.', true);
    }
  }

  const topBases = [...(data?.members || [])].sort((a, b) => (b.rankedPoints || 0) - (a.rankedPoints || 0)).slice(0, 4);

  return (
    <div className="page-stack finder-page">
      <PageHeading
        eyebrow="Clan tools · base intelligence"
        title="Player finder"
        detail="Search your clan database by player name, tag or clan. Open a dossier to inspect progression and readiness."
        actions={<Badge tone="blue"><Shield size={12} /> FAMILY DIRECTORY</Badge>}
      />

      <section className="finder-hero">
        <div className="finder-hero__copy">
          <span className="eyebrow">CLAN INDEX · PLAYER / BASE SEARCH</span>
          <h2>Find the base<br /><span>behind the tag.</span></h2>
          <p>One search across your roster, player stats and live Supercell API data.</p>
          <div className="finder-capabilities">
            <span><Trophy size={14} /> Ranked tiers</span>
            <span><Swords size={14} /> War readiness</span>
            <span><Award size={14} /> Progress history</span>
          </div>
        </div>
        <div className="finder-search-art" aria-hidden="true">
          <div className="finder-orbit finder-orbit--one" />
          <div className="finder-orbit finder-orbit--two" />
          <span><Search size={48} /></span>
          <i />
        </div>
      </section>

      <Panel className="finder-search-panel">
        <form className="finder-form" onSubmit={submit}>
          <label className="finder-input">
            <Search size={22} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Enter a player name, #tag or clan name…"
              aria-label="Search player name, tag or clan"
              autoComplete="off"
            />
            <kbd>↵</kbd>
          </label>
          <Button type="submit" leading={<Search size={15} />}>Search bases</Button>
        </form>
        <div className="finder-search-panel__foot">
          <span>Try a tag for live Supercell lookup or search part of a player's name.</span>
          <span><i /> Live Supercell API + Saved Roster</span>
        </div>
      </Panel>

      {searching ? (
        <Panel className="finder-result-panel">
          <div className="finder-loading">
            <span className="spinner" />
            <span>
              <strong>Fetching player data…</strong>
              <small>Querying live Supercell API and clan index.</small>
            </span>
          </div>
          <div className="finder-skeletons"><i /><i /><i /></div>
        </Panel>
      ) : error ? (
        <Panel className="finder-result-panel">
          <EmptyState icon={<Search size={21} />} title="Search is unavailable" detail={error} />
        </Panel>
      ) : searched ? (
        <Panel className="finder-result-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">SEARCH RESULTS</span>
              <h2>{results.length} matching base{results.length === 1 ? '' : 's'}</h2>
            </div>
            <Badge tone={results.length ? 'green' : 'muted'}>{query}</Badge>
          </div>

          {results.length ? (
            <div className="finder-results">
              {results.map((member, index) => {
                const readiness = member.heroReadiness === undefined ? null : readinessScore(member, 'war');
                return (
                  <article className="finder-result-card" key={member.id}>
                    <div className="finder-result-card__head">
                      <span className="finder-result-rank">{String(index + 1).padStart(2, '0')}</span>
                      <Avatar name={member.name} size="md" />
                      <span className="finder-result-card__identity">
                        <strong>{member.name}</strong>
                        <span>
                          {member.tag}{' '}
                          <button type="button" aria-label={`Copy ${member.tag}`} onClick={() => void copyTag(member.tag)}>
                            <Copy size={12} />
                          </button>
                        </span>
                      </span>
                      <Badge tone="blue">TH {member.townHall}</Badge>
                    </div>

                    <div className="finder-result-card__stats">
                      <div><span>Clan</span><strong>{member.clanName}</strong></div>
                      <div><span>Home league</span><strong>{member.league}</strong></div>
                      <div><span>Ranked tier</span><strong>{member.rankedTier}</strong></div>
                      <div><span>Trophies</span><strong><Trophy size={12} />{formatNumber(member.trophies)}</strong></div>
                    </div>

                    {readiness ? (
                      <div className="finder-result-card__readiness">
                        <span><Shield size={13} /> War readiness <b>{readiness.score}%</b></span>
                        <ProgressBar value={readiness.score} tone={readinessTone(readiness.score)} />
                        <Badge tone={readiness.ready ? 'green' : 'orange'}>{readiness.ready ? 'READY' : 'REVIEW'}</Badge>
                      </div>
                    ) : null}

                    <div className="finder-result-card__foot">
                      <span>{member.heroReadiness === undefined ? 'Public roster view' : 'Hero signal ' + member.heroReadiness + '%'} <i>·</i> {member.isActive ? 'Active' : 'Inactive'} base</span>
                      <Link to={`/app/members/${member.id}`} className="text-link">Open dossier <ArrowRight size={14} /></Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Search size={22} />}
              title="No base found"
              detail="Try an exact player tag starting with # (e.g. #2PP98L9U) or a shorter name fragment."
              action={<Button variant="outline" onClick={() => setQuery('')}>Clear search</Button>}
            />
          )}

          <div className="finder-source-note">
            <Sparkles size={14} /> Live Supercell API search enabled for #tags.
          </div>
        </Panel>
      ) : (
        <div className="finder-empty-layout">
          <Panel className="finder-prompt">
            <span className="finder-prompt__icon"><Search size={21} /></span>
            <span className="eyebrow">START YOUR SEARCH</span>
            <h2>Type a name or player tag.</h2>
            <p>Use a player tag like <b>#2PP98L9U</b> for a live Supercell API lookup.</p>
            <div className="finder-prompt__hint">
              <span>⌕</span>
              <span><strong>Fuzzy name match</strong><small>Search saved family database</small></span>
              <span>→</span>
            </div>
            <div className="finder-prompt__hint">
              <span>#</span>
              <span><strong>Live Supercell Tag</strong><small>Direct real-time API query</small></span>
              <span>→</span>
            </div>
          </Panel>

          <Panel className="finder-trending">
            <div className="panel-heading">
              <div><span className="eyebrow">TOP RANKED BASES</span><h2>On the rise</h2></div>
              <Link to="/app/ranked" className="panel-link">Ranked board <ArrowRight size={13} /></Link>
            </div>
            {topBases.map((member, index) => (
              <Link to={`/app/members/${member.id}`} className="trending-player" key={member.id}>
                <span className="trending-place">0{index + 1}</span>
                <Avatar name={member.name} size="sm" />
                <span><strong>{member.name}</strong><small>{member.clanName}</small></span>
                <b>{formatNumber(member.rankedPoints)} <small>pts</small></b>
                <ArrowRight size={14} />
              </Link>
            ))}
            {!topBases.length ? <EmptyState title="No saved bases yet" detail="Add players to begin your family index." /> : null}
          </Panel>
        </div>
      )}

      <div className="finder-disclaimer">
        <ExternalLink size={14} />
        <span>Clan Command queries live Supercell API data for tags and searches your saved workspace index.</span>
      </div>
    </div>
  );
}