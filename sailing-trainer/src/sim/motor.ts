// A 7.5 m cabin yacht with sails down, an outboard engine and a tiller (typical Masurian charter boat).
// Same conventions as physics.ts: heading is compass, u = forward, v = to starboard, r > 0 = turning to starboard.

import { wrap, type Wind } from './physics';
import { pointInPoly, type Pt } from './world';
import type { Harbour, Pose } from './harbours';
import { YACHT, rect } from './harbours';

export interface MotorState {
  x: number;
  y: number;
  heading: number;
  u: number;
  v: number;
  r: number;
  /** Throttle −1..1 (negative = astern). */
  throttle: number;
  /** Side the helmsman sits on (+1 starboard). Decides what "от себя" means. */
  helmSide: number;
}

export interface MotorControls {
  /** Tiller −1..1, positive = tiller to starboard (bow turns to port). */
  tiller: number;
}

/** Engine telegraph positions. */
export const THROTTLE_STEPS = [-1, -0.4, 0, 0.12, 0.35, 1];
export const THROTTLE_RU: Record<string, string> = {
  '-1': 'Полный назад', '-0.4': 'Малый назад', '0': 'Нейтраль', '0.12': 'Малый вперёд', '0.35': 'Средний вперёд', '1': 'Полный вперёд',
};

const M = 2200; // kg with crew
const THRUST_AHEAD = 900; // N
const THRUST_ASTERN = 520;

export function motorInit(p: Pose, speed = 0): MotorState {
  return { x: p.x, y: p.y, heading: p.heading, u: speed, v: 0, r: 0, throttle: speed > 0.2 ? 0.12 : 0, helmSide: 1 };
}

export interface MotorTelemetry {
  speed: number;
  /** Apparent wind angle (signed, + from starboard) and speed. */
  awa: number;
  aws: number;
  /** Ground speed (including current). */
  sog: number;
}

export function motorStep(s: MotorState, c: MotorControls, w: Wind, current: { x: number; y: number }, dt: number): MotorTelemetry {
  const sinH = Math.sin(s.heading), cosH = Math.cos(s.heading);
  // Velocity over ground = through water + current.
  const gx = s.u * sinH + s.v * cosH + current.x;
  const gy = s.u * cosH - s.v * sinH + current.y;
  const wx = -w.speed * Math.sin(w.from), wy = -w.speed * Math.cos(w.from);
  const ax = wx - gx, ay = wy - gy; // air relative to the boat (where it goes)
  const aws = Math.hypot(ax, ay);
  const af = ax * sinH + ay * cosH, as = ax * cosH - ay * sinH; // flow components in boat frame
  const awa = Math.atan2(-as, -af);
  const q = 0.5 * 1.2 * aws * aws;

  const thrust = s.throttle >= 0 ? s.throttle * THRUST_AHEAD : s.throttle * THRUST_ASTERN;
  const absU = Math.abs(s.u);
  const wave = absU > 2.6 ? 450 * (absU - 2.6) ** 2 : 0;
  const resist = (s.u < 0 ? 1.6 : 1) * (45 * s.u * absU + 35 * s.u) + Math.sign(s.u) * wave + 30 * c.tiller * c.tiller * s.u;
  const lateral = 1500 * absU * s.v + 650 * s.v * Math.abs(s.v) + 160 * s.v;
  // Windage: small frontal area, large side area (hull, cabin, mast).
  const Fx = thrust - resist + q * 3.0 * (af / (aws || 1));
  const Fy = -lateral + q * 9.0 * (as / (aws || 1));

  s.u += (Fx / M + s.v * s.r) * dt;
  s.v += (Fy / (1.5 * M) - s.u * s.r) * dt;

  // Rudder works with water flow: boat speed plus propeller wash when going ahead (a short burst
  // of throttle turns the boat even from rest). Astern the rudder is weak and works the other way.
  const wash = s.throttle > 0 ? 1.1 * Math.sqrt(s.throttle) : 0;
  const flow = s.u >= 0 ? s.u + wash : 0.6 * s.u;
  const steer = -0.09 * c.tiller * flow;
  // With little way on, the wind blows the bow off (the bow has more windage than the stern).
  const noWay = Math.max(0, 1 - absU / 1.8);
  const windYaw = -0.0022 * q * Math.sin(awa) * noWay;
  s.r += (steer + windYaw - s.r) * 1.2 * dt;
  s.heading = wrap(s.heading + s.r * dt);

  s.x += gx * dt;
  s.y += gy * dt;
  return { speed: Math.hypot(s.u, s.v), awa, aws, sog: Math.hypot(gx, gy) };
}

/** Points around the hull outline (for collision tests). */
export function hullPoints(s: Pose, halfL = YACHT.halfL, halfB = YACHT.halfB): Pt[] {
  const sh = Math.sin(s.heading), ch = Math.cos(s.heading);
  const local: Pt[] = [[0, halfL], [halfB * 0.7, halfL * 0.6], [halfB, 0], [halfB * 0.9, -halfL], [-halfB * 0.9, -halfL], [-halfB, 0], [-halfB * 0.7, halfL * 0.6], [0, -halfL]];
  return local.map(([a, b]) => [s.x + a * ch + b * sh, s.y - a * sh + b * ch]);
}

export type ObstacleKind = 'land' | 'pontoon' | 'finger' | 'boat' | 'ship';

/** What the hull is touching, if anything. */
export function touching(h: Harbour, s: Pose): ObstacleKind | null {
  const pts = hullPoints(s);
  const inAny = (polys: Pt[][]) => polys.some((poly) => pts.some(([x, y]) => pointInPoly(x, y, poly)));
  if (inAny(h.land)) return 'land';
  if (inAny(h.pontoons)) return 'pontoon';
  if (h.waterIndex && pts.some(([x, y]) => !h.waterIndex!.contains(x, y))) return 'land';
  if (inAny(h.fingers)) return 'finger';
  for (const b of h.moored) {
    const poly = rect(b.x, b.y, b.halfB * 2, b.halfL * 2, b.heading);
    if (pts.some(([x, y]) => pointInPoly(x, y, poly))) return b.kind === 'ship' ? 'ship' : 'boat';
    // also their bow inside our hull
    const ours = rect(s.x, s.y, YACHT.halfB * 2, YACHT.halfL * 2, s.heading);
    const theirs = hullPoints(b, b.halfL, b.halfB);
    if (theirs.some(([x, y]) => pointInPoly(x, y, ours))) return b.kind === 'ship' ? 'ship' : 'boat';
  }
  return null;
}

/** How well the boat lies in the berth. */
export function berthError(s: Pose, target: Pose, eitherWay: boolean): { along: number; across: number; angle: number } {
  const dx = s.x - target.x, dy = s.y - target.y;
  const along = dx * Math.sin(target.heading) + dy * Math.cos(target.heading);
  const across = dx * Math.cos(target.heading) - dy * Math.sin(target.heading);
  let angle = Math.abs(wrap(s.heading - target.heading));
  if (eitherWay) angle = Math.min(angle, Math.PI - angle);
  return { along, across, angle };
}

/**
 * Gentle contact (fenders): undo the move, then let the boat slide along the obstacle — the fender
 * pushes it off a little and turns it parallel. If nothing works it stops. Returns true if it stopped.
 */
export function resolveContact(h: Harbour, s: MotorState, prev: Pose, dt: number): boolean {
  Object.assign(s, prev);
  const fwd = s.u * dt;
  const sh = Math.sin(s.heading), ch = Math.cos(s.heading);
  const cands: Pose[] = [];
  for (const side of [0, 0.04, -0.04, 0.1, -0.1]) {
    for (const turn of [0, 0.01, -0.01, 0.025, -0.025]) {
      cands.push({ x: s.x + sh * fwd + ch * side, y: s.y + ch * fwd - sh * side, heading: s.heading + turn });
    }
  }
  const free = cands.find((p) => !touching(h, p));
  if (free) {
    Object.assign(s, free);
    s.v = 0; s.r *= 0.5; s.u *= 0.995;
    return false;
  }
  s.u = 0; s.v = 0; s.r *= 0.3;
  return true;
}

export function stepThrottle(cur: number, dir: 1 | -1 | 0): number {
  if (dir === 0) return 0;
  let i = THROTTLE_STEPS.findIndex((t) => Math.abs(t - cur) < 1e-6);
  if (i < 0) i = THROTTLE_STEPS.indexOf(0);
  return THROTTLE_STEPS[Math.max(0, Math.min(THROTTLE_STEPS.length - 1, i + dir))];
}
