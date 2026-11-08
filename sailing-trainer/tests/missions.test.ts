import { describe, it, expect } from 'vitest';
import { initialState, step, switchSide, windAt, wrap, DEG, BEAUFORT_MS, type Controls, type Telemetry, type BoatState } from '../src/sim/physics';
import { MISSION_BY_ID, type MissionResult } from '../src/sim/missions';
import { createWorld, isBlocked, zoneAt, type World } from '../src/sim/world';
import { createBayWorld } from '../src/sim/charts';
import { createGdanskWorld, GULF_ANCHOR } from '../src/sim/gdanskWorld';
import { placeFn } from '../src/sim/conditions';

/** Run a mission with a scripted pilot that returns the desired heading. */
function run(id: string, pilot: (s: BoatState, t: Telemetry | null, time: number) => { heading: number; sheet?: number }, maxTime = 400,
  opts: { windDeg?: number; world?: World | null; anchor?: { x: number; y: number } } = {}): { res: MissionResult | null; time: number } {
  const m = MISSION_BY_ID[id];
  const wDeg = opts.windDeg ?? m.windDeg ?? 0;
  const rt = m.create();
  const st = { ...m.start };
  if (m.windRelative && (wDeg || opts.anchor)) {
    const place = placeFn(wDeg, opts.anchor?.x ?? 0, opts.anchor?.y ?? 0);
    [st.x, st.y] = place(st.x, st.y);
    st.heading += wDeg * DEG;
    for (const mk of rt.marks) [mk.x, mk.y] = place(mk.x, mk.y);
  }
  const s = initialState(st.heading, st.x, st.y, st.speed, wDeg * DEG);
  const c: Controls = { tiller: 0, main: m.start.main, jib: m.start.main, board: 1 };
  const wm = { base: { from: wDeg * DEG, speed: BEAUFORT_MS[m.beaufort] }, gustiness: 0, shifts: 0, seed: 1 };
  const world = opts.world !== undefined ? opts.world : m.world ? createWorld() : m.realMap ? createGdanskWorld() : m.chart === 'bay' ? createBayWorld() : null;
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
    const z = world ? zoneAt(world, s.x, s.y) : null;
    if (z && z.kind !== 'anchorage') return { res: { won: false, textRu: `zone ${z.name} at ${s.x.toFixed(0)},${s.y.toFixed(0)}` }, time };
    const res = rt.update({ s, t, time, dt, events: r.events, marks: rt.marks, counters, world, traffic: null, windFrom: wDeg * DEG });
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

  it('cutting through the cardinal-marked shoal runs aground; going round works', () => {
    const straight = run('cardinals', () => ({ heading: Math.PI }));
    expect(straight.res?.textRu).toMatch(/aground/);
    const round = run('cardinals', follow([[140, 220], [140, 70], [80, 20]], 8));
    expect(round.res?.won, round.res?.textRu).toBe(true);
  });

  /** Head for each mark in turn, never pointing closer than 48° to the wind (tacking when needed). */
  const markPilot = (marks: { x: number; y: number }[], windFrom: number, radius: number) => {
    let i = 0, tack = 1;
    return (s: BoatState) => {
      while (i < marks.length - 1 && Math.hypot(marks[i].x - s.x, marks[i].y - s.y) < radius) i++;
      const b = Math.atan2(marks[i].x - s.x, marks[i].y - s.y);
      const off = wrap(b - windFrom);
      if (Math.abs(off) >= 48 * DEG) return { heading: b };
      if (tack === 1 && off < -40 * DEG) tack = -1;
      else if (tack === -1 && off > 40 * DEG) tack = 1;
      return { heading: windFrom + tack * 48 * DEG };
    };
  };

  it('wind-relative exercises rotate with the wind and fit in the Gdańsk gulf', () => {
    for (const wDeg of [90, 225]) {
      const rt = MISSION_BY_ID.triangle.create();
      const place = placeFn(wDeg, GULF_ANCHOR.x, GULF_ANCHOR.y);
      const marks = rt.marks.map((mk) => { const [x, y] = place(mk.x, mk.y); return { x, y }; });
      // The first mark of the triangle lies straight upwind of the start area.
      const up = Math.atan2(marks[0].x - marks[2].x, marks[0].y - marks[2].y);
      expect(Math.abs(wrap(up - wDeg * DEG)) / DEG).toBeLessThan(1);
      const res = run('triangle', markPilot(marks, wDeg * DEG, 8), 600, { windDeg: wDeg, world: createGdanskWorld(), anchor: GULF_ANCHOR });
      expect(res.res?.won, `${wDeg}: ${res.res?.textRu}`).toBe(true);
    }
  });

  // Waypoints a skipper would pick from the chart (the mission marks plus turns in the channel).
  const ROUTES: Record<string, [number, number][]> = {
    gd_entry: [[-250, 7450], [80, 6600], [150, 6380], [260, 6220], [600, 6040]],
    gd_ncz: [[7740, 2380], [7860, 2150], [7880, 2000], [7865, 1890], [7830, 1830]],
    gd_ships: [[260, 6220], [150, 6380], [80, 6600], [-250, 7450], [-300, 7750]],
    chart_shoals: [[-260, -300], [-120, -170], [10, -60], [150, 10], [360, 40]],
    chart_fairway: [[0, 330]],
  };
  for (const id of Object.keys(ROUTES)) {
    it(`real-chart task ${id} can be sailed without running aground`, () => {
      const m = MISSION_BY_ID[id];
      const marks = m.create().marks;
      const w = m.chart === 'bay' ? createBayWorld() : createGdanskWorld();
      expect(isBlocked(w, m.start.x, m.start.y)).toBeNull();
      for (const mk of marks) expect(isBlocked(w, mk.x, mk.y), `${mk.label}`).toBeNull();
      const res = run(id, markPilot(ROUTES[id].map(([x, y]) => ({ x, y })), (m.windDeg ?? 0) * DEG, 20), 3000);
      expect(res.res?.won, res.res?.textRu).toBe(true);
    });
  }

  it('the straight line through the bay hits shoals or the rock (pilotage is needed)', () => {
    const w = createBayWorld();
    let hit: string | null = null;
    for (let t = 0; t <= 1 && !hit; t += 0.002) hit = isBlocked(w, -560 + 920 * t, -380 + 420 * t);
    expect(hit).toBe('shoal');
  });
});
