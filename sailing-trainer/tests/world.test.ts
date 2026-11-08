import { describe, it, expect } from 'vitest';
import { createWorld, isBlocked, lightOn, lightSegments } from '../src/sim/world';
import { Traffic } from '../src/sim/traffic';
import { initialState, DEG } from '../src/sim/physics';

describe('world', () => {
  const w = createWorld();
  it('knows land, water, shoals and the harbour basin', () => {
    expect(isBlocked(w, -500, 0)).toBe('land');
    expect(isBlocked(w, -350, 0)).toBeNull(); // inside the basin
    expect(isBlocked(w, -290, 0)).toBeNull(); // harbour entrance
    expect(isBlocked(w, -290, 30)).toBe('land'); // breakwater
    expect(isBlocked(w, 80, 140)).toBe('shoal');
    expect(isBlocked(w, 0, 0)).toBeNull();
  });

  it('IALA A: entering westwards, red buoys are on the port (south) side', () => {
    for (const b of w.buoys.filter((b) => b.kind === 'port')) expect(b.y).toBeLessThan(0);
    for (const b of w.buoys.filter((b) => b.kind === 'starboard')) expect(b.y).toBeGreaterThan(0);
  });

  it('cardinal marks are on their named side of the shoal', () => {
    const sh = w.shoals[0];
    const at = (k: string) => w.buoys.find((b) => b.kind === k)!;
    expect(at('north').y).toBeGreaterThan(sh.y + sh.r);
    expect(at('south').y).toBeLessThan(sh.y - sh.r);
    expect(at('east').x).toBeGreaterThan(sh.x + sh.r);
    expect(at('west').x).toBeLessThan(sh.x - sh.r);
  });

  it('light characters have the right number of flashes and period', () => {
    const count = (c: string) => lightSegments(c).filter(([on]) => on).length;
    const period = (c: string) => lightSegments(c).reduce((a, [, d]) => a + d, 0);
    expect(count('Q(3) 10s')).toBe(3);
    expect(period('Q(3) 10s')).toBeCloseTo(10);
    expect(count('Q(6)+LFl 15s')).toBe(7);
    expect(period('Q(6)+LFl 15s')).toBeCloseTo(15);
    expect(count('Q(9) 15s')).toBe(9);
    expect(count('Fl(2) 5s')).toBe(2);
    expect(period('Fl R 4s')).toBeCloseTo(4);
    expect(lightOn('Q', 0.1)).toBe(true);
    expect(lightOn('Q', 0.6)).toBe(false);
  });
});

describe('traffic', () => {
  it('vessels that must give way keep clear of a boat holding its course', () => {
    let standOnEncounters = 0, collisionsWhenStandOn = 0;
    for (let seed = 1; seed <= 12; seed++) {
      let x = seed * 7919;
      const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647);
      const tr = new Traffic(2, null, rnd);
      const s = initialState(90 * DEG, 0, 0, 2, 0);
      let roleAtCollision: string | undefined;
      for (let t = 0; t < 300; t += 0.05) {
        s.x += 2 * 0.05; // hold course and speed (stand-on behaviour)
        for (const e of tr.update(0.05, s, 0)) {
          if (e.kind === 'encounter' && e.vessel.encounter?.giveWay === 'other') standOnEncounters++;
          if (e.kind === 'collision') roleAtCollision = e.vessel.encounter?.giveWay;
          if (e.kind === 'collision' && roleAtCollision === 'other') collisionsWhenStandOn++;
        }
      }
    }
    expect(standOnEncounters).toBeGreaterThan(3);
    expect(collisionsWhenStandOn).toBe(0);
  });
});

import { createGdanskWorld, GDANSK_STARTS, GULF_ANCHOR } from '../src/sim/gdanskWorld';

describe('Gdańsk chart for free sailing', () => {
  const g = createGdanskWorld();
  it('all start positions and the gulf anchor are in open water', () => {
    for (const [id, , x, y] of GDANSK_STARTS) expect(isBlocked(g, x, y), id).toBeNull();
    // Wind-relative exercises are placed around the anchor: keep ~600 m of water around it.
    for (let a = 0; a < 360; a += 15) {
      const r = 600;
      expect(isBlocked(g, GULF_ANCHOR.x + r * Math.sin(a * DEG), GULF_ANCHOR.y + r * Math.cos(a * DEG)), `${a}`).toBeNull();
    }
  });
  it('land is land and the sea is sea', () => {
    expect(isBlocked(g, 2000, 3000)).toBe('land'); // city between the rivers
    expect(isBlocked(g, 3000, 8500)).toBeNull(); // Gulf of Gdańsk
  });
});
