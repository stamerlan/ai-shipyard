import { describe, it, expect } from 'vitest';
import { initialState, step, DEG, pointOfSail, tackOf, apparentWind, type Controls } from '../src/sim/physics';
import { bestSpeed } from './polar';

const WIND = { from: 0, speed: 4.4 }; // force 3 from the north

function sail(heading: number, c: Partial<Controls>, seconds: number, wind = WIND, hold = false) {
  const s = initialState(heading, 0, 0, 1.5);
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

  it('overpowered without hiking in force 5 capsizes if you hold the course', () => {
    const { s } = sail(50 * DEG, { main: 1, jib: 1, hike: 0 }, 20, { from: 0, speed: 9.3 }, true);
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
});
