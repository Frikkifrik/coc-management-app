import { useMemo, useState } from 'react';
import { Check, Copy, Download, ExternalLink, ImageDown, LayoutGrid, Shield, Sparkles, Swords, Target, Wheat } from 'lucide-react';
import { Badge, Button, Field, PageHeading, Panel, SelectField } from '../components/ui';
import { useWorkspace } from '../workspace-context';

type LayoutKind = 'war' | 'trophy' | 'farm';
type FontStyle = 'clash' | 'warrior' | 'royal';
interface BaseLayout { id: string; townHall: number; type: LayoutKind; title: string; subtitle: string; code: string; likes: number; }

const kinds: Array<{ id: LayoutKind; name: string; icon: typeof Shield }> = [
  { id: 'war', name: 'War', icon: Swords }, { id: 'trophy', name: 'Trophy', icon: Target }, { id: 'farm', name: 'Farm', icon: Wheat },
];
const fontChoices: Array<{ id: FontStyle; name: string; sample: string }> = [
  { id: 'clash', name: 'Clash Heavy', sample: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif' },
  { id: 'warrior', name: 'Warrior', sample: 'Impact, Haettenschweiler, sans-serif' },
  { id: 'royal', name: 'Royal', sample: 'Georgia, serif' },
];
const mockLayouts: BaseLayout[] = Array.from({ length: 24 }, (_, index) => {
  const townHall = 11 + Math.floor(index / 3);
  const kind = (['war', 'trophy', 'farm'] as LayoutKind[])[index % 3];
  const typeName = kind === 'war' ? 'Anti-3 Star' : kind === 'trophy' ? 'Legend Push' : 'Resource Core';
  const hash = `${townHall}-${kind}-${index}`;
  return { id: hash, townHall, type: kind, title: `${typeName} ${String.fromCharCode(65 + Math.floor(index / 3))}`, subtitle: kind === 'war' ? 'Ring base · anti-blimp' : kind === 'trophy' ? 'Balanced · shield first' : 'Storages protected · collector safe', code: shareCode(hash), likes: 180 + (index * 73) % 940 };
});

function shareCode(seed: string) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return Array.from({ length: 38 }, (_, index) => alphabet[((hash >>> (index % 24)) + index * 13) % alphabet.length]).join('');
}

export function BaseBuilderPage() {
  const { notify } = useWorkspace();
  const [townHall, setTownHall] = useState(17);
  const [kind, setKind] = useState<LayoutKind>('war');
  const [selectedId, setSelectedId] = useState('17-war-18');
  const [overlayText, setOverlayText] = useState('MISCLICKED');
  const [fontStyle, setFontStyle] = useState<FontStyle>('clash');
  const layouts = useMemo(() => mockLayouts.filter((layout) => layout.townHall === townHall && layout.type === kind), [townHall, kind]);
  const selected = layouts.find((layout) => layout.id === selectedId) || layouts[0];
  const selectedFont = fontChoices.find((font) => font.id === fontStyle) || fontChoices[0];

  async function copyBaseLink(layout: BaseLayout) {
    const link = `https://link.clashofclans.com/en?action=OpenLayout&id=TH${layout.townHall}%3AWB%3A${layout.code}`;
    try { await navigator.clipboard.writeText(link); notify('Demo in-game layout link copied. Replace its sample code with a verified share code before importing.'); }
    catch { notify('Clipboard access is unavailable. The demo link format is shown in the builder preview.', true); }
  }

  function downloadImage() {
    if (!selected) return;
    const text = overlayText.trim() || 'CLAN';
    const svg = buildOverlaySvg(text, selected, fontStyle);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-th${selected.townHall}-layout.svg`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    notify('Layout preview image downloaded.');
  }

  return <div className="page-stack game-page base-builder-page">
    <PageHeading eyebrow="Workshop · layouts & text" title="Base Builder" detail="Browse a base by Town Hall, then add a bold clan-name overlay to your layout image." actions={<Badge tone="gold" dot>CLASHFOX-STYLE WORKSHOP</Badge>} />
    <section className="game-base-hero"><div className="game-base-hero__crest"><LayoutGrid size={32}/><span>✦</span></div><div><span className="game-ribbon">VILLAGE BLUEPRINTS</span><h2>Build. Share. Defend.</h2><p>Pick a layout for your Town Hall or stamp the clan name on a shareable preview.</p></div><div className="game-base-hero__note"><Shield size={15}/> 24 demo layouts <i/> TH11–TH18</div></section>

    <Panel className="game-gallery-panel"><div className="game-gallery-head"><div><span className="game-ribbon">BASE LAYOUT GALLERY</span><h2>Choose your blueprint</h2></div><div className="game-gallery-filters"><SelectField label="Town Hall level" value={townHall} onChange={(event) => { const value = Number(event.target.value); setTownHall(value); setSelectedId(mockLayouts.find((layout) => layout.townHall === value && layout.type === kind)?.id || ''); }}>{Array.from({ length: 8 }, (_, index) => <option value={18 - index} key={18 - index}>Town Hall {18 - index}</option>)}</SelectField></div></div>
      <div className="game-layout-tabs" role="tablist" aria-label="Filter layouts by purpose">{kinds.map(({ id, name, icon: Icon }) => <button key={id} role="tab" aria-selected={kind === id} className={kind === id ? 'is-active' : ''} onClick={() => { setKind(id); setSelectedId(mockLayouts.find((layout) => layout.townHall === townHall && layout.type === id)?.id || ''); }}><Icon size={16}/>{name} base</button>)}</div>
      <div className="game-layout-grid">{layouts.map((layout, index) => <button type="button" className={`game-layout-card ${selected?.id === layout.id ? 'is-selected' : ''}`} key={layout.id} onClick={() => setSelectedId(layout.id)}><span className="sr-only">Select {layout.title} Town Hall {layout.townHall} layout</span><div className="game-layout-card__preview"><BaseDiagram townHall={layout.townHall} kind={layout.type} seed={index}/><span className="game-layout-card__th">TH {layout.townHall}</span>{selected?.id === layout.id ? <span className="game-layout-card__selected"><Check size={12}/> SELECTED</span> : null}</div><span className="game-layout-card__copy"><strong>{layout.title}</strong><small>{layout.subtitle}</small><span><span><Sparkles size={12}/>{layout.likes}</span><b>View layout <ExternalLink size={12}/></b></span></span></button>)}</div>
      {selected ? <div className="game-layout-selected-bar"><span><Shield size={15}/><span><strong>{selected.title}</strong><small>TH{selected.townHall} · {kind.toUpperCase()} BASE · sample layout code</small></span></span><Button size="sm" leading={<Copy size={14}/>} onClick={() => void copyBaseLink(selected)}>Copy Direct In-Game Base Link</Button></div> : null}
    </Panel>

    <div className="game-overlay-layout"><Panel className="game-overlay-controls"><div className="game-section-heading"><div><span className="game-ribbon">TEXT OVERLAY GENERATOR</span><h2>Make it yours</h2></div><Sparkles size={18}/></div><p className="game-panel-intro">Add your clan tag, name or slogan to a downloadable blueprint preview.</p><Field label="Text to stamp on the layout" value={overlayText} onChange={(event) => setOverlayText(event.target.value.slice(0, 24))} placeholder="MISCLICKED MAIN" maxLength={24} hint="Up to 24 characters. Preview updates as you type."/><SelectField label="Stylized Clash font" value={fontStyle} onChange={(event) => setFontStyle(event.target.value as FontStyle)}>{fontChoices.map((font) => <option key={font.id} value={font.id}>{font.name}</option>)}</SelectField><div className="game-font-samples">{fontChoices.map((font) => <button type="button" key={font.id} className={fontStyle === font.id ? 'is-selected' : ''} onClick={() => setFontStyle(font.id)} style={{ fontFamily: font.sample }}><span>{overlayText || 'CLAN NAME'}</span><small>{font.name}</small></button>)}</div><div className="game-overlay-actions"><Button leading={<Download size={15}/>} onClick={downloadImage}>Download layout image</Button><Button variant="outline" leading={<Copy size={15}/>} onClick={() => selected && void copyBaseLink(selected)}>Copy Direct In-Game Base Link</Button></div><div className="game-base-disclaimer"><i/>Gallery codes are synthetic preview IDs. Use a verified Clash layout share code for a playable import.</div></Panel>
      <Panel className="game-overlay-preview-panel"><div className="game-section-heading"><div><span className="game-ribbon">LIVE PREVIEW</span><h2>{selected?.title || 'Layout image'}</h2></div><Badge tone="green">TH {selected?.townHall || townHall}</Badge></div><div className="game-overlay-preview"><OverlayPreview text={overlayText || 'CLAN NAME'} layout={selected} font={selectedFont}/><span className="game-overlay-preview__caption">TOWN HALL {selected?.townHall || townHall} · {kind.toUpperCase()} PLAN</span></div><div className="game-overlay-preview__foot"><span><ImageDown size={14}/> SVG image · transparent-ready</span><span>Made for {selected?.townHall || townHall}</span></div></Panel></div>
  </div>;
}

function BaseDiagram({ townHall, kind, seed }: { townHall: number; kind: LayoutKind; seed: number }) {
  const accent = kind === 'war' ? '#d84d27' : kind === 'trophy' ? '#3577c8' : '#d9a52c';
  const rings = kind === 'war' ? [[22, 17, 156, 106], [39, 29, 122, 82], [59, 42, 82, 55]] : kind === 'trophy' ? [[18, 14, 164, 112], [43, 28, 114, 84], [65, 43, 70, 55]] : [[22, 14, 156, 112], [34, 28, 132, 84], [57, 43, 86, 54]];
  return <svg className="game-base-diagram" viewBox="0 0 200 140" role="img" aria-label={`Town Hall ${townHall} ${kind} base diagram`}>
    <defs><pattern id={`grid-${townHall}-${kind}-${seed}`} width="12" height="12" patternUnits="userSpaceOnUse"><path d="M 12 0 L 0 0 0 12" fill="none" stroke="#ffffff" strokeOpacity=".16" strokeWidth=".7"/></pattern><filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="1.5" floodOpacity=".45"/></filter></defs>
    <rect width="200" height="140" rx="13" fill="#5f9f3d"/><rect width="200" height="140" rx="13" fill={`url(#grid-${townHall}-${kind}-${seed})`}/>
    {rings.map(([x,y,w,h], index) => <rect key={index} x={x} y={y} width={w} height={h} rx={index === 0 ? 10 : 8} fill="none" stroke={index === 0 ? '#f0daa0' : '#eed89a'} strokeWidth={index === 0 ? 4 : 3} opacity={index === 0 ? .95 : .85}/>)}
    {Array.from({ length: 12 }, (_, index) => { const positions = [[39,36],[78,26],[121,29],[160,42],[166,95],[137,111],[88,116],[43,102],[61,53],[139,53],[62,86],[139,86]]; const [x,y] = positions[(index + seed) % positions.length]; return <g key={index} filter="url(#shadow)"><rect x={x-5} y={y-5} width="10" height="10" rx="2" fill={index % 3 === 0 ? '#d94b27' : index % 3 === 1 ? '#55a7d8' : '#e3be51'} stroke="#573520" strokeWidth="1.6"/><path d={`M${x-3},${y}h6M${x},${y-3}v6`} stroke="#fff0b7" strokeWidth="1"/></g>; })}
    <rect x="78" y="48" width="44" height="42" rx="6" fill="#76513a" stroke="#f2d49a" strokeWidth="3"/><rect x="85" y="55" width="30" height="28" rx="4" fill={accent} stroke="#51361f" strokeWidth="2"/><path d="M100 61l10 8-10 8-10-8z" fill="#f8df76" stroke="#593c20" strokeWidth="1.4"/><text x="100" y="74" textAnchor="middle" fill="#503217" fontSize="7" fontWeight="900">{townHall}</text>
  </svg>;
}

function OverlayPreview({ text, layout, font }: { text: string; layout?: BaseLayout; font: { sample: string } }) {
  const th = layout?.townHall || 17;
  const kind = layout?.type || 'war';
  return <svg className="game-overlay-svg" viewBox="0 0 520 330" aria-hidden="true"><defs><linearGradient id="ov-sky" x2="0" y2="1"><stop stopColor="#b5dc63"/><stop offset="1" stopColor="#568c36"/></linearGradient><filter id="ov-shadow"><feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity=".7"/></filter></defs><rect width="520" height="330" rx="26" fill="url(#ov-sky)"/><rect x="40" y="38" width="440" height="254" rx="28" fill="#75ad42" stroke="#f3d18a" strokeWidth="12"/><rect x="89" y="66" width="342" height="198" rx="38" fill="none" stroke="#f7e7b4" strokeWidth="12"/><rect x="150" y="101" width="220" height="130" rx="32" fill="none" stroke="#f7e7b4" strokeWidth="10"/><rect x="207" y="125" width="106" height="82" rx="18" fill="#9d5830" stroke="#f7d782" strokeWidth="10"/><rect x="224" y="140" width="72" height="52" rx="10" fill="#b74429" stroke="#633a21" strokeWidth="5"/><text x="260" y="176" textAnchor="middle" fill="#fff3c0" fontSize="32" fontWeight="900">{th}</text><text x="260" y="277" textAnchor="middle" fill="#ffffff" fontFamily={font.sample} fontSize="34" fontWeight="900" stroke="#513019" strokeWidth="5" paintOrder="stroke" filter="url(#ov-shadow)">{text.slice(0, 20)}</text><text x="260" y="313" textAnchor="middle" fill="#fff0bd" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="700" letterSpacing="3">TH{th} · {kind.toUpperCase()} BASE</text></svg>;
}

function buildOverlaySvg(text: string, layout: BaseLayout, fontStyle: FontStyle) {
  const fonts: Record<FontStyle, string> = { clash: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif', warrior: 'Impact, Haettenschweiler, sans-serif', royal: 'Georgia, serif' };
  const safeText = text.replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[character] || character));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="660" viewBox="0 0 520 330"><defs><linearGradient id="field" x2="0" y2="1"><stop stop-color="#b5dc63"/><stop offset="1" stop-color="#568c36"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity=".7"/></filter></defs><rect width="520" height="330" rx="26" fill="url(#field)"/><rect x="40" y="38" width="440" height="254" rx="28" fill="#75ad42" stroke="#f3d18a" stroke-width="12"/><rect x="89" y="66" width="342" height="198" rx="38" fill="none" stroke="#f7e7b4" stroke-width="12"/><rect x="150" y="101" width="220" height="130" rx="32" fill="none" stroke="#f7e7b4" stroke-width="10"/><rect x="207" y="125" width="106" height="82" rx="18" fill="#9d5830" stroke="#f7d782" stroke-width="10"/><rect x="224" y="140" width="72" height="52" rx="10" fill="#b74429" stroke="#633a21" stroke-width="5"/><text x="260" y="176" text-anchor="middle" fill="#fff3c0" font-size="32" font-weight="900">${layout.townHall}</text><text x="260" y="277" text-anchor="middle" fill="#fff" font-family="${fonts[fontStyle]}" font-size="34" font-weight="900" stroke="#513019" stroke-width="5" paint-order="stroke" filter="url(#shadow)">${safeText.slice(0, 20)}</text><text x="260" y="313" text-anchor="middle" fill="#fff0bd" font-family="Arial,sans-serif" font-size="12" font-weight="700" letter-spacing="3">TH${layout.townHall} · ${layout.type.toUpperCase()} BASE</text></svg>`;
}
