import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadShared } from '../scripts/load-shared.mjs';

const { WL } = loadShared();
const { art, model: M } = WL;

test('every frame of every stage is a clean rectangle of known palette keys', () => {
  const keys = new Set(['.', ...Object.keys(art.palette('x'))]);
  for (const stage of ['baby', 'adult', 'legend']) {
    const [w, h] = art.size(stage);
    for (const [clip, def] of Object.entries(art.CLIPS)) {
      def.frames.forEach((_, i) => {
        const rows = art.rows(stage, clip, i);
        assert.equal(rows.length, h, `${stage}/${clip}/${i} height`);
        for (const r of rows) {
          assert.equal(r.length, w, `${stage}/${clip}/${i} row "${r}"`);
          for (const ch of r) assert.ok(keys.has(ch), `${stage}/${clip}: unknown key ${ch}`);
        }
      });
    }
  }
  for (const r of [...art.EGG.whole, ...art.EGG.crack]) assert.equal(r.length, 8);
});

test('colours are stable per seed and valid hex', () => {
  assert.deepEqual(art.palette('abc'), art.palette('abc'));
  for (const v of Object.values(art.palette('zz9'))) assert.match(v, /^#[0-9a-f]{6}$/);
});

test('stages follow xp', () => {
  const p = M.newPet();
  assert.equal(M.stage(p), 'egg');
  p.hatched = true;
  assert.equal(M.stage(p), 'baby');
  p.xp = 120;
  assert.equal(M.stage(p), 'adult');
  p.xp = 1500;
  assert.equal(M.stage(p), 'legend');
  assert.equal(M.progress(p).next, null);
});

test('hunger drains over time and feeding caps at 100', () => {
  const now = Date.now();
  const p = { ...M.newPet(now), fullness: 80, fullnessAt: now };
  assert.equal(M.fullness(p, now + 10 * M.HOUR), 40);
  assert.equal(M.fullness(p, now + 100 * M.HOUR), 0);
  assert.equal(M.mood(p, now + 16 * M.HOUR), 'hungry');
  M.feed(p, 500, now);
  assert.equal(p.fullness, 100);
});

test('names are trimmed and stripped of markup characters', () => {
  assert.equal(M.cleanName('  <b>Mochi</b> the great and powerful '), 'bMochi/b the gre');
});

test('any frame number gives a frame (a bad clock once froze the pet)', () => {
  const good = WL.art.rows('adult', 'walk', 0);
  for (const i of [-1, -7, 2, 3.9, NaN]) assert.equal(WL.art.rows('adult', 'walk', i).length, good.length, String(i));
});
