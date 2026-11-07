import { describe, it, expect } from 'vitest';
import { initialState, step, autoHike, windAt, wrap, DEG, BEAUFORT_MS, type Controls, type Telemetry, type BoatState } from '../src/sim/physics';
import { MISSION_BY_ID, type MissionResult } from '../src/sim/missions';

/** Run a mission with a scripted pilot that returns the desired heading. */
function run(id: string, pilot: (s: BoatState, t: Telemetry | null, time: number) => { heading: number; sheet?: number }, maxTime = 400): { res: MissionResult | null; time: number } {
  const m = MISSION_BY_ID[id];
  const s = initialState(m.start.heading, m.start.x, m.start.y, m.start.speed);
  const c: Controls = { tiller: 0, main: m.start.main, jib: m.start.main, hike: 0, board: 1 };
  const wm = { base: { from: 0, speed: BEAUFORT_MS[m.beaufort] }, gustiness: 0, shifts: 0, seed: 1 };
  const rt = m.create();
  const counters = { tacks: 0, gybes: 0, crashGybes: 0 };
  let t: Telemetry | null = null;
  const dt = 1 / 60;
  for (let time = 0; time < maxTime; time += dt) {
    const p = pilot(s, t, time);
    const err = wrap(p.heading - s.heading);
    c.tiller = Math.max(-1, Math.min(1, -err * 2.5));
    if (t) {
      c.hike = autoHike(s, t);
      if (p.sheet !== undefined) c.main = p.sheet;
      else if (t.main.luffing || t.main.aoa < 12 * DEG) c.main = Math.min(1, c.main + 0.6 * dt);
      else if (t.main.aoa > 22 * DEG) c.main = Math.max(0, c.main - 0.6 * dt);
      c.jib = c.main;
    }
    const r = step(s, c, windAt(wm, time), dt);
    t = r.t;
    for (const e of r.events) { if (e === 'tack') counters.tacks++; if (e === 'gybe') counters.gybes++; }
    if (s.capsized) return { res: { won: false, textRu: 'capsize' }, time };
    const res = rt.update({ s, t, time, dt, events: r.events, marks: rt.marks, counters });
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
});
