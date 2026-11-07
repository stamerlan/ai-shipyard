import { describe, it, expect } from 'vitest';
import { initialState, step, switchSide, windAt, wrap, DEG, BEAUFORT_MS, type Controls, type Telemetry, type BoatState } from '../src/sim/physics';
import { MISSION_BY_ID, type MissionResult } from '../src/sim/missions';
import { createWorld, isBlocked } from '../src/sim/world';

/** Run a mission with a scripted pilot that returns the desired heading. */
function run(id: string, pilot: (s: BoatState, t: Telemetry | null, time: number) => { heading: number; sheet?: number }, maxTime = 400): { res: MissionResult | null; time: number } {
  const m = MISSION_BY_ID[id];
  const s = initialState(m.start.heading, m.start.x, m.start.y, m.start.speed, 0);
  const c: Controls = { tiller: 0, main: m.start.main, jib: m.start.main, board: 1 };
  const wm = { base: { from: 0, speed: BEAUFORT_MS[m.beaufort] }, gustiness: 0, shifts: 0, seed: 1 };
  const rt = m.create();
  const world = m.world ? createWorld() : null;
  const counters = { tacks: 0, gybes: 0, crashGybes: 0 };
  let t: Telemetry | null = null;
  const dt = 1 / 60;
  for (let time = 0; time < maxTime; time += dt) {
    const p = pilot(s, t, time);
    const err = wrap(p.heading - s.heading);
    c.tiller = Math.max(-1, Math.min(1, -err * 2.5));
    if (t) {
      if (p.sheet !== undefined) c.main = p.sheet;
      else if (t.main.luffing || t.main.aoa < 12 * DEG) c.main = Math.min(1, c.main + 0.6 * dt);
      else if (t.main.aoa > 22 * DEG) c.main = Math.max(0, c.main - 0.6 * dt);
      c.jib = c.main;
    }
    const r = step(s, c, windAt(wm, time), dt);
    t = r.t;
    for (const e of r.events) {
      if (e === 'tack') counters.tacks++;
      if (e === 'gybe') counters.gybes++;
      if (e === 'tack' || e === 'gybe') switchSide(s); // «Смена борта!»
    }
    if (s.capsized) return { res: { won: false, textRu: 'capsize' }, time };
    if (world && isBlocked(world, s.x + Math.sin(s.heading) * 2, s.y + Math.cos(s.heading) * 2) && Math.hypot(s.u, s.v) > 0.8) return { res: { won: false, textRu: `aground at ${s.x.toFixed(0)},${s.y.toFixed(0)}` }, time };
    const res = rt.update({ s, t, time, dt, events: r.events, marks: rt.marks, counters, world, traffic: null });
    if (res) return { res, time };
  }
  return { res: null, time: maxTime };
}

describe('missions are completable', () => {
  it('beat to a windward mark by tacking on the layline', () => {
    let tack = 1;
    const { res } = run('beat', (s) => {
      const bearing = Math.atan2(0 - s.x, 200 - s.y); // to mark at (0,200)
      if (tack === 1 && bearing < -42 * DEG) tack = -1;
      else if (tack === -1 && bearing > 42 * DEG) tack = 1;
      if (Math.hypot(s.x, 200 - s.y) < 25 && Math.abs(bearing) > 40 * DEG) return { heading: bearing };
      return { heading: tack * 45 * DEG };
    });
    expect(res?.won, res?.textRu).toBe(true);
  });

  it('downwind slalom by gybing between marks', () => {
    const marks = [[30, -70], [-30, -140], [30, -210], [-30, -280]];
    let i = 0;
    const { res } = run('slalom', (s) => {
      const [mx, my] = marks[i];
      if (Math.hypot(mx - s.x, my - s.y) < 9) i = Math.min(i + 1, marks.length - 1);
      const [nx, ny] = marks[i];
      return { heading: Math.atan2(nx - s.x, ny - s.y) };
    });
    expect(res?.won, res?.textRu).toBe(true);
  });

  it('stop at the buoy by luffing up head to wind', () => {
    // Reach to a point ~9 m downwind of the buoy at (10,35), then shoot head to wind with sails flapping.
    let phase = 0;
    const { res } = run('buoy', (s) => {
      const target = { x: 6, y: 27 };
      if (phase === 0) {
        if (Math.hypot(target.x - s.x, target.y - s.y) < 3) phase = 1;
        return { heading: Math.atan2(target.x - s.x, target.y - s.y) };
      }
      return { heading: Math.atan2(10 - s.x, 35 - s.y), sheet: 0 };
    });
    expect(res?.won, res?.textRu).toBe(true);
  });

  /** Follow waypoints; the last one is approached with sails eased (stopping). */
  const follow = (pts: [number, number][], radius = 6) => {
    let i = 0;
    return (s: BoatState) => {
      while (i < pts.length - 1 && Math.hypot(pts[i][0] - s.x, pts[i][1] - s.y) < radius) i++;
      return { heading: Math.atan2(pts[i][0] - s.x, pts[i][1] - s.y) };
    };
  };

  it('leave the marina through the fairway', () => {
    const { res } = run('marina_out', follow([[-330, 0], [-290, 0], [-100, 0], [0, 0]]));
    expect(res?.won, res?.textRu).toBe(true);
  });

  it('enter the marina and stop at the berth', () => {
    const go = follow([[-100, 0], [-290, 0], [-340, 14]], 4);
    let stopping = false;
    const { res } = run('marina_in', (s) => {
      if (!stopping && Math.hypot(-340 - s.x, 14 - s.y) < 4) stopping = true;
      return stopping ? { heading: Math.atan2(-350 - s.x, 32 - s.y) } : go(s);
    });
    expect(res?.won, res?.textRu).toBe(true);
  });

  it('cutting through the cardinal-marked shoal runs aground; going round works', () => {
    const straight = run('cardinals', () => ({ heading: Math.PI }));
    expect(straight.res?.textRu).toMatch(/aground/);
    const round = run('cardinals', follow([[140, 220], [140, 70], [80, 20]], 8));
    expect(round.res?.won, round.res?.textRu).toBe(true);
  });
});
