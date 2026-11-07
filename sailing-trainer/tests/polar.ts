// Quick headless check of boat speeds: npx vite-node tests/polar.ts (or via vitest)
import { initialState, step, DEG, autoHike, type Controls, type Telemetry } from '../src/sim/physics';

export function bestSpeed(twaDeg: number, windSpeed: number, hikeAuto = true) {
  let best = { speed: 0, main: 0, jib: 0, heel: 0, leeway: 0 };
  for (let m = 0; m <= 1.0001; m += 0.1) {
    const s = initialState(twaDeg * DEG * -1 + 0, 0, 0, 1);
    // wind from north (0), heading = -twa means wind from starboard side
    s.heading = -twaDeg * DEG;
    const c: Controls = { tiller: 0, main: m, jib: m, hike: 0, board: twaDeg > 150 ? 0.3 : 1 };
    let t: Telemetry | undefined;
    for (let i = 0; i < 60 * 40; i++) {
      if (t && hikeAuto) c.hike = autoHike(s, t);
      // hold heading fixed (autopilot) to measure steady state
      s.heading = -twaDeg * DEG; s.r = 0;
      const res = step(s, c, { from: 0, speed: windSpeed }, 1 / 60);
      t = res.t;
      if (s.capsized) break;
    }
    if (!s.capsized && s.u > best.speed) best = { speed: s.u, main: m, jib: m, heel: s.heel / DEG, leeway: t!.leeway / DEG };
  }
  return best;
}

export function printPolar() {
  for (const ws of [2.5, 4.5, 7, 9.5]) {
    const row = [15, 25, 32, 40, 45, 52, 60, 75, 90, 110, 135, 150, 170, 180].map((a) => {
      const b = bestSpeed(a, ws);
      return `${a}°:${(b.speed * 1.944).toFixed(1)}kn(m${b.main.toFixed(1)},h${b.heel.toFixed(0)})`;
    });
    console.log(`wind ${ws} m/s:`, row.join(' '));
  }
}
