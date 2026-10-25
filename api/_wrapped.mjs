// Webling Wrapped links: /w?… is a shared week, /w/image.png?… its preview. The popup builds the query
// (extension/popup/card.js wrappedLink); this reads it back and works out the same verdict and take.
//
// Query: n name · s seed · g stage · v vibe · t take · d, e first and last day (YYYY-MM-DD) · so "so far"
// c cookie banners · p pop-ups · x new sites · vi pages visited · l after midnight · ds doomscrolls · y yeets
// f focus sessions finished · sl slips during them
// a aura gained · k top kind of site and its visits ("shopping.23")
import { WL } from './_roast.mjs';

const STAGES = ['baby', 'adult', 'legend'];
const count = (q, k) => Math.min(99999, Math.max(0, Math.trunc(Number(q.get(k))) || 0));
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseWrapped(url) {
  const q = new URL(url).searchParams;
  const seed = /^[a-z0-9]{1,16}$/.test(q.get('s') || '') ? q.get('s') : 'mochi7';
  const vibe = WL.voice.VIBES[q.get('v')] ? q.get('v') : WL.voice.vibeOf({ seed });
  const name = WL.model.cleanName(q.get('n')) || 'A webling';
  const stage = STAGES.includes(q.get('g')) ? q.get('g') : 'adult';
  const w = { cookies: count(q, 'c'), popups: count(q, 'p'), sites: count(q, 'x'), visits: count(q, 'vi'),
    late: count(q, 'l'), doomscrolls: count(q, 'ds'), yeets: count(q, 'y'), focus: count(q, 'f'), slips: count(q, 'sl'), kinds: {} };
  const [kind, kn] = (q.get('k') || '').split('.');
  if (WL.voice.SITES[kind]) w.kinds[kind] = Math.min(w.visits, count(new URLSearchParams({ k: kn }), 'k'));
  const aura = /^-?\d{1,6}$/.test(q.get('a') || '') ? Number(q.get('a')) : null;
  const take = WL.voice.wrapped(w, vibe, /^\d{1,9}$/.test(q.get('t') || '') ? Number(q.get('t')) : 0);
  const fmt = (d) => (DAY.test(d || '') ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : null);
  const from = fmt(q.get('d')), to = q.get('so') ? 'so far' : fmt(q.get('e'));
  return { name, seed, vibe, stage, w, aura, when: from && to ? `${from} – ${to}` : 'this week', ...take, query: q.toString() };
}

// The numbers worth showing, the one behind the verdict first.
const STAR = { touch_grass: 'visits', locked_in: 'focus', night_owl: 'late', doomscroller: 'doomscrolls', pop_up_predator: 'eaten', explorer: 'sites' };
export function tiles(r) {
  const t = [['eaten', r.eaten, 'pop-ups eaten'], ['sites', r.w.sites, 'new sites'], ['visits', r.w.visits, 'pages'],
    ['late', r.w.late, 'after midnight'], ['doomscrolls', r.w.doomscrolls, 'doomscrolls'], ['yeets', r.w.yeets, 'yeets']];
  if (r.w.focus) t.splice(1, 0, ['focus', r.w.focus, r.w.focus === 1 ? 'focus session' : 'focus sessions']);
  if (r.aura !== null) t.splice(1, 0, ['aura', `${r.aura >= 0 ? '+' : ''}${r.aura}`, 'aura']);
  if (r.top) t.splice(1, 0, ['top', `${r.top.share}%`, r.top.kind]);
  const star = STAR[r.verdict] || (r.top && r.verdict !== 'lowkey' ? 'top' : 'eaten');
  t.sort((a, b) => (b[0] === star) - (a[0] === star));
  return t.map(([, value, label]) => [value, label]);
}
