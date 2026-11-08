import { describe, it, expect } from 'vitest';
import { initialState, step, switchSide, DEG, pointOfSail, tackOf, apparentWind, wrap, type Controls } from '../src/sim/physics';
import { steadySpeed } from './trim';
import { bestSpeed } from './polar';

const WIND = { from: 0, speed: 4.4 }; // force 3 from the north

function sail(heading: number, c: Partial<Controls>, seconds: number, wind = WIND, hold = false) {
  const s = initialState(heading, 0, 0, 1.5, 0);
  const ctl: Controls = { tiller: 0, main: 0.6, jib: 0.6, hike: 0, board: 1, ...c };
  const events: string[] = [];
  let t;
  for (let i = 0; i < seconds * 120; i++) {
    if (hold) { s.heading = heading; s.r = 0; }
    const r = step(s, ctl, wind, 1 / 120);
    t = r.t;
    events.push(...r.events);
    if (s.capsized) break;
  }
  return { s, t: t!, events };
}

describe('physics', () => {
  it('cannot sail in the no-go zone', () => {
    expect(bestSpeed(15, 4.4).speed).toBeLessThan(0.1);
  });

  it('beam reach is faster than close-hauled and a run', () => {
    const close = bestSpeed(45, 4.4).speed;
    const beam = bestSpeed(90, 4.4).speed;
    const run = bestSpeed(180, 4.4).speed;
    expect(beam).toBeGreaterThan(close);
    expect(beam).toBeGreaterThan(run);
    expect(close).toBeGreaterThan(1.2); // > ~2.3 kn upwind in force 3
  });

  it('with neutral helm a trimmed boat holds roughly its course', () => {
    const { s } = sail(70 * DEG, { main: 0.75, jib: 0.75 }, 10);
    expect(Math.abs(s.heading - 70 * DEG)).toBeLessThan(20 * DEG);
  });

  it('a boat in irons drifts back slowly and falls off', () => {
    const { s } = sail(3 * DEG, { main: 0.9, jib: 0.9 }, 15);
    expect(s.u).toBeGreaterThan(-1.0);
    expect(Math.abs(s.heading)).toBeGreaterThan(20 * DEG);
  });

  it('a fully eased mainsail luffs on a beam reach', () => {
    const { t } = sail(90 * DEG, { main: 0, jib: 0 }, 5);
    expect(t.main.luffing).toBe(true);
  });

  it('tiller to port turns the boat to starboard', () => {
    const { s } = sail(90 * DEG, { tiller: -0.6 }, 2);
    expect(s.heading).toBeGreaterThan(95 * DEG);
  });

  it('turning through the wind is reported as a tack', () => {
    const { events } = sail(50 * DEG, { tiller: 0.7, main: 0.9, jib: 0.9 }, 6);
    expect(events).toContain('tack');
  });

  it('overpowered without hiking in force 6 capsizes if you hold the course', () => {
    const { s } = sail(60 * DEG, { main: 0.85, jib: 0.85, hike: 0 }, 20, { from: 0, speed: 11 }, true);
    expect(s.capsized).toBe(true);
  });

  it('easing the sheets in force 5 keeps the boat upright', () => {
    const { s } = sail(90 * DEG, { main: 0.3, jib: 0.3, hike: 0.5 }, 20, { from: 0, speed: 9.3 }, true);
    expect(s.capsized).toBe(false);
  });

  it('fully hiked in a light breeze heels the boat to windward but does not capsize', () => {
    const { s } = sail(90 * DEG, { main: 0.6, jib: 0.6, hike: 1 }, 20, WIND, true);
    expect(s.capsized).toBe(false);
    // Heading east with wind from the north: crew sits on port, so the boat heels to port (negative).
    expect(s.heel).toBeLessThan(-10 * DEG);
  });

  it('a raised centreboard increases leeway upwind', () => {
    const down = sail(55 * DEG, { main: 0.9, jib: 0.9, board: 1 }, 15, WIND, true).t.leeway;
    const up = sail(55 * DEG, { main: 0.9, jib: 0.9, board: 0.1 }, 15, WIND, true).t.leeway;
    expect(Math.abs(up)).toBeGreaterThan(Math.abs(down) * 2);
  });

  it('classifies points of sail and tacks', () => {
    expect(pointOfSail(20 * DEG)).toBe('irons');
    expect(pointOfSail(-45 * DEG)).toBe('close_hauled');
    expect(pointOfSail(90 * DEG)).toBe('beam_reach');
    expect(pointOfSail(130 * DEG)).toBe('broad_reach');
    expect(pointOfSail(-178 * DEG)).toBe('run');
    // Heading east with wind from north: wind on the port side -> port tack.
    const s = initialState(90 * DEG);
    const { twa } = apparentWind(s, WIND);
    expect(twa).toBeLessThan(0);
    expect(tackOf(s, twa)).toBe('port');
  });

  it('sheets in the middle only suit a beam reach', () => {
    const best = (twa: number) => Math.max(...[0, 0.25, 0.5, 0.75, 1].map((m) => steadySpeed(twa, m)));
    expect(steadySpeed(45, 0.5)).toBeLessThan(0.3); // luffing close-hauled
    expect(steadySpeed(90, 0.5)).toBeGreaterThan(0.9 * best(90));
    expect(steadySpeed(120, 0.5)).toBeLessThan(0.8 * best(120));
    expect(steadySpeed(180, 0.5)).toBeLessThan(0.7 * best(180));
    expect(steadySpeed(180, 1)).toBeLessThan(0.4 * best(180));
  });

  it('forgetting to change sides after a tack: crew to leeward, backed jib, slower', () => {
    const run = (switched: boolean) => {
      const s = initialState(-50 * DEG, 0, 0, 1.5, 0); // starboard tack
      if (!switched) { s.heading = 50 * DEG; } else { s.heading = 50 * DEG; switchSide(s); }
      let t;
      for (let i = 0; i < 15 * 120; i++) { s.heading = 50 * DEG; s.r = 0; t = step(s, { tiller: 0, main: 0.9, jib: 0.9, board: 1 }, WIND, 1 / 120).t; }
      return { s, t: t! };
    };
    const good = run(true), bad = run(false);
    expect(good.t.jib.state).not.toBe('backed');
    expect(bad.t.jib.state).toBe('backed');
    expect(bad.t.crewLeeward).toBe(true);
    expect(bad.s.u).toBeLessThan(good.s.u * 0.8);
    expect(Math.abs(bad.s.heel)).toBeGreaterThan(Math.abs(good.s.heel));
  });

  it('a backed jib pushes the bow off the wind when in irons', () => {
    const turn = (backed: boolean) => {
      const s = initialState(-8 * DEG, 0, 0, 0, 0); // wind 8° on the starboard bow, jib to port
      if (backed) s.jibSide = 1; // sheet the jib to windward
      for (let i = 0; i < 4 * 120; i++) step(s, { tiller: 0, main: 0.3, jib: 1, board: 1 }, WIND, 1 / 120);
      return -s.heading; // bearing away = turning to port = heading decreasing
    };
    expect(turn(true)).toBeGreaterThan(turn(false) + 5 * DEG);
  });
});

describe('outboard with the sails down', () => {
  const run = (c: Partial<Controls>, wind: number, secs = 60, heading = 90) => {
    const s = initialState(heading * DEG, 0, 0, 0, 0);
    const cc: Controls = { tiller: 0, main: 0.6, jib: 0.6, board: 1, sailsDown: true, ...c };
    for (let t = 0; t < secs; t += 1 / 60) step(s, cc, { from: 0, speed: wind }, 1 / 60);
    return s;
  };
  it('lowered sails give no drive; the engine pushes the boat at 4–6 kn', () => {
    // Only drift under bare poles (the mast and hull windage), well below sailing speed.
    expect(Math.abs(run({ engine: 0 }, 6).u)).toBeLessThan(1);
    const kn = run({ engine: 1 }, 0).u * 1.944;
    expect(kn).toBeGreaterThan(4);
    expect(kn).toBeLessThan(6);
  });
  it('the outboard turns the boat almost on the spot', () => {
    const s = run({ engine: 0.5, tiller: 1 }, 2, 5, 0);
    expect(Math.abs(wrap(s.heading))).toBeGreaterThan(120 * DEG);
  });
});
