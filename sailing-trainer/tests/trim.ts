import { initialState, step, DEG, autoHike, type Controls, type Telemetry } from '../src/sim/physics';

/** Steady speed (m/s) on a fixed true-wind angle with a given sheet setting (main and jib together). */
export function steadySpeed(twaDeg: number, sheet: number, windSpeed = 4.4): number {
  const h = -twaDeg * DEG; // wind from north, from the starboard side
  const s = initialState(h, 0, 0, 1.5, 0);
  const c: Controls = { tiller: 0, main: sheet, jib: sheet, hike: 0, board: 1 };
  let t: Telemetry | undefined;
  for (let i = 0; i < 60 * 40; i++) {
    if (t) c.hike = autoHike(s, t);
    s.heading = h; s.r = 0;
    t = step(s, c, { from: 0, speed: windSpeed }, 1 / 60).t;
    if (s.capsized) return 0;
  }
  return Math.max(0, s.u);
}

export function trimTable(): string {
  const rows: string[] = [];
  for (const twa of [45, 60, 90, 120, 150, 180]) {
    const speeds = [0, 0.25, 0.5, 0.75, 1].map((m) => steadySpeed(twa, m));
    const best = Math.max(...speeds);
    rows.push(`${twa}°: ` + speeds.map((v, i) => `${[0, 25, 50, 75, 100][i]}%=${(v * 1.944).toFixed(1)}`).join(' ') + `  mid/best=${(speeds[2] / best * 100).toFixed(0)}%`);
  }
  return rows.join('\n');
}
