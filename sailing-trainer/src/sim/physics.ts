// Simplified 2D (top-down) physics of a two-person training dinghy with main and jib.
// Units: metres, seconds, radians, newtons. World: x = east, y = north.
// Heading is a compass angle (0 = north, clockwise positive).
// In the boat frame: u = forward speed, v = sideways speed (positive to starboard).
// Signed angles in the boat frame are positive to starboard.

export const DEG = Math.PI / 180;

export interface Controls {
  /** Tiller position -1..1, positive = tiller pushed to starboard (bow turns to port). */
  tiller: number;
  /** Mainsheet 0..1, 1 = sheeted fully in. */
  main: number;
  /** Jib sheet 0..1, 1 = sheeted fully in. */
  jib: number;
  /** Crew hiking 0..1 (0 = sitting on the centreline, 1 = fully hiked out). */
  hike: number;
  /** Centreboard 0..1 (1 = fully down). */
  board: number;
}

export interface Wind {
  /** Direction the wind blows FROM (compass, rad). */
  from: number;
  /** Speed, m/s. */
  speed: number;
}

export interface BoatState {
  x: number;
  y: number;
  heading: number;
  u: number;
  v: number;
  /** Yaw rate, rad/s (positive = turning to starboard). */
  r: number;
  /** Heel, rad, positive = starboard side down. */
  heel: number;
  /** Boom angle from the aft centreline, rad, positive = boom out to starboard. */
  boom: number;
  /** Jib clew angle, same convention as boom. */
  jibAngle: number;
  /** Side the crew sits on: +1 starboard, -1 port. */
  crewSide: number;
  capsized: boolean;
}

export interface SailInfo {
  /** Angle of attack, rad (0..π). */
  aoa: number;
  luffing: boolean;
  stalled: boolean;
  drive: number;
  side: number;
}

export interface Telemetry {
  /** Apparent wind angle (signed, + = from starboard) and speed. */
  awa: number;
  aws: number;
  /** True wind angle relative to the bow (signed, + = from starboard). */
  twa: number;
  main: SailInfo;
  jib: SailInfo;
  /** Speed through water, m/s. */
  speed: number;
  leeway: number;
  /** Target heel the boat is settling towards. */
  heelTarget: number;
  /** Heeling moment from the sails alone, N·m (positive = to starboard). */
  sailHeelMoment: number;
}

export type SimEvent = 'tack' | 'gybe' | 'crashGybe' | 'capsize';

export const BOAT = {
  length: 4.2,
  mass: 260,
  mainArea: 7.0,
  jibArea: 3.0,
  mainCE: 1.9,
  jibCE: 1.3,
  boomLength: 2.5,
  jibFoot: 1.4,
  mastFromBow: 1.4,
  rho: 1.2,
  stiffness: 1200, // N·m per rad of heel (form stability)
  crewRighting: 1300, // N·m at full hike
  capsizeHeel: 45 * DEG,
  mainMin: 6 * DEG,
  mainMax: 85 * DEG,
  jibMin: 12 * DEG,
  jibMax: 70 * DEG,
};

export const wrap = (a: number) => {
  // to (-π, π]
  a = (a + Math.PI) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a - Math.PI;
};

const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);

export function initialState(heading: number, x = 0, y = 0, speed = 0): BoatState {
  return { x, y, heading, u: speed, v: 0, r: 0, heel: 0, boom: 0, jibAngle: 0, crewSide: 1, capsized: false };
}

/** Lift and drag coefficients of a soft sail as a function of angle of attack (rad). */
export function sailCoefficients(aoa: number): { cl: number; cd: number } {
  const a = aoa / DEG;
  let cl: number;
  // A soft sail only starts to fill above ~6° (below that the luff flaps).
  if (a <= 6) cl = 0.25 * (a / 6);
  else if (a <= 24) cl = 0.25 + 1.2 * ((a - 6) / 18);
  else if (a <= 45) cl = 1.45 - ((a - 24) / 21) * 0.45;
  else if (a <= 90) cl = 1.0 * Math.cos(((a - 45) / 45) * (Math.PI / 2));
  else cl = 0;
  const s = Math.sin(Math.min(aoa, Math.PI));
  // profile drag + induced drag (aspect ratio ≈ 3) + flapping drag
  const cd = 0.05 + 1.15 * s * s + 0.11 * cl * cl + (a < 7 ? 0.05 : 0);
  return { cl, cd };
}

/** Force from one sail in boat-frame components (forward, starboard). */
function sailForce(awa: number, aws: number, sailAngle: number, area: number): SailInfo {
  // Air flow direction (where the air goes) in boat frame (f, s).
  const df = -Math.cos(awa), ds = -Math.sin(awa);
  // Chord from luff to leech.
  const cf = -Math.cos(sailAngle), cs = Math.sin(sailAngle);
  const dot = clamp(cf * df + cs * ds, -1, 1);
  const cross = cf * ds - cs * df;
  const aoa = Math.acos(dot);
  const { cl, cd } = sailCoefficients(aoa);
  const q = 0.5 * BOAT.rho * aws * aws * area;
  const sign = cross >= 0 ? 1 : -1;
  // Lift is perpendicular to the flow, rot90(d) = (-ds, df)
  const lf = sign * -ds, ls = sign * df;
  const drive = q * (cl * lf + cd * df);
  const side = q * (cl * ls + cd * ds);
  return { aoa, luffing: aoa < 7 * DEG, stalled: aoa > 32 * DEG && aoa < 75 * DEG, drive, side };
}

export function apparentWind(s: BoatState, w: Wind): { awa: number; aws: number; twa: number } {
  const sinH = Math.sin(s.heading), cosH = Math.cos(s.heading);
  // Air velocity (where it goes) in world frame.
  const wx = -w.speed * Math.sin(w.from), wy = -w.speed * Math.cos(w.from);
  // Boat velocity in world frame.
  const bx = s.u * sinH + s.v * cosH, by = s.u * cosH - s.v * sinH;
  const ax = wx - bx, ay = wy - by;
  // Components of the incoming wind (−A) in boat frame.
  const inF = -(ax * sinH + ay * cosH);
  const inS = -(ax * cosH - ay * sinH);
  return { awa: Math.atan2(inS, inF), aws: Math.hypot(ax, ay), twa: wrap(w.from - s.heading) };
}

/**
 * Advance the simulation by dt seconds. Mutates `s` and returns telemetry and events.
 */
export function step(s: BoatState, c: Controls, w: Wind, dt: number): { t: Telemetry; events: SimEvent[] } {
  const events: SimEvent[] = [];
  const { awa, aws, twa } = apparentWind(s, w);

  // --- Sail angles: sails swing to leeward up to the limit set by the sheet. ---
  const windSide = awa >= 0 ? 1 : -1; // side the wind comes from
  const mainLimit = BOAT.mainMin + (1 - clamp(c.main, 0, 1)) * (BOAT.mainMax - BOAT.mainMin);
  const jibLimit = BOAT.jibMin + (1 - clamp(c.jib, 0, 1)) * (BOAT.jibMax - BOAT.jibMin);
  const absAwa = Math.abs(awa);

  // The boom stays on its side when sailing slightly by the lee; it flips once the wind is clearly on the other side.
  let boomSide = s.boom === 0 ? -windSide : Math.sign(s.boom);
  if (boomSide !== -windSide && absAwa < 168 * DEG) boomSide = -windSide;
  const boomTarget = boomSide * Math.min(mainLimit, absAwa, BOAT.mainMax);
  const prevBoom = s.boom;
  const boomRate = 5.0; // rad/s max swing speed
  s.boom += clamp((boomTarget - s.boom) * 10 * dt, -boomRate * dt, boomRate * dt);
  if (Math.sign(prevBoom) !== Math.sign(s.boom) && prevBoom !== 0) {
    if (absAwa > 90 * DEG) {
      events.push('gybe');
      // An eased boom slamming across in a breeze kicks the boat over.
      const swing = Math.abs(prevBoom) / BOAT.mainMax;
      if (swing > 0.6 && w.speed > 4) {
        events.push('crashGybe');
        s.heel += -boomSide * swing * (w.speed / 9) * 0.9;
        s.r += windSide * 0.6 * swing;
      }
    } else {
      events.push('tack');
    }
  }
  const jibTarget = -windSide * Math.min(jibLimit, absAwa);
  s.jibAngle += clamp((jibTarget - s.jibAngle) * 10 * dt, -6 * dt, 6 * dt);

  // --- Aerodynamic forces ---
  const cosHeel = Math.cos(s.heel);
  const mainF = sailForce(awa, aws, s.boom, BOAT.mainArea * cosHeel);
  const jibF = sailForce(awa, aws, s.jibAngle, BOAT.jibArea * cosHeel);
  // On a run the jib is blanketed by the mainsail.
  const blanket = absAwa > 140 * DEG ? 1 - 0.7 * ((absAwa - 140 * DEG) / (40 * DEG)) : 1;
  jibF.drive *= blanket;
  jibF.side *= blanket;

  // --- Hydrodynamics ---
  const board = clamp(c.board, 0, 1);
  const m = BOAT.mass;
  const absU = Math.abs(s.u);
  const wave = absU > 2.1 ? 70 * (absU - 2.1) ** 2 : 0;
  const rudderDrag = 18 * c.tiller * c.tiller * absU;
  const sternFactor = s.u < 0 ? 4 : 1; // going backwards, transom first, is very draggy
  const resist = sternFactor * ((6 + 2.5 * board + rudderDrag) * s.u * absU + 6 * s.u) + Math.sign(s.u) * wave;
  const lateral = (520 * (0.12 + 0.88 * board) * Math.max(absU, 0.3)) * s.v + 120 * s.v * Math.abs(s.v) + 15 * s.v;

  // Windage of hull, crew and rig acts along the apparent wind flow.
  const windage = 0.5 * BOAT.rho * aws * aws * 0.9;
  const Fx = mainF.drive + jibF.drive - resist - windage * Math.cos(awa);
  const Fy = mainF.side + jibF.side - lateral - windage * Math.sin(awa);

  // Boat-frame dynamics with rotation coupling.
  s.u += (Fx / m + s.v * s.r) * dt;
  s.v += (Fy / (1.4 * m) - s.u * s.r) * dt;

  // --- Heel ---
  if (absAwa > 15 * DEG && absAwa < 165 * DEG && Math.sign(awa) !== s.crewSide) s.crewSide = windSide;
  const heelMoment = mainF.side * BOAT.mainCE + jibF.side * BOAT.jibCE;
  const crewMoment = s.crewSide * BOAT.crewRighting * clamp(c.hike, 0, 1) * cosHeel;
  const heelTarget = (heelMoment + crewMoment) / BOAT.stiffness;
  s.heel += (heelTarget - s.heel) * 2.5 * dt;

  // --- Yaw ---
  const steer = -0.4 * c.tiller * s.u;
  // A heeled boat turns away from its low side (weather helm when heeled to leeward).
  const excessHeel = Math.sign(s.heel) * Math.max(0, Math.abs(s.heel) - 8 * DEG);
  const helm = -0.6 * excessHeel * Math.min(1, absU / 1.2);
  // Without steerage way the wind blows the bow off (a boat in irons falls away by itself, slowly).
  const noWay = Math.max(0, 1 - Math.max(s.u, 0) / 1.0);
  const weathervane = -0.18 * Math.sign(twa) * (0.25 + Math.abs(Math.sin(twa))) * Math.min(1.5, w.speed / 5) * noWay;
  const rTarget = steer + helm + weathervane;
  s.r += (rTarget - s.r) * 2.5 * dt;
  s.heading = wrap(s.heading + s.r * dt);

  // --- Position ---
  const sinH = Math.sin(s.heading), cosH = Math.cos(s.heading);
  s.x += (s.u * sinH + s.v * cosH) * dt;
  s.y += (s.u * cosH - s.v * sinH) * dt;

  if (Math.abs(s.heel) > BOAT.capsizeHeel) {
    s.capsized = true;
    events.push('capsize');
  }

  return {
    t: {
      awa, aws, twa,
      main: mainF, jib: jibF,
      speed: Math.hypot(s.u, s.v),
      leeway: Math.atan2(s.v, Math.max(Math.abs(s.u), 0.01)),
      heelTarget,
      sailHeelMoment: heelMoment,
    },
    events,
  };
}

/** Crew that automatically hikes just enough to keep the boat (nearly) flat. */
export function autoHike(s: BoatState, t: Telemetry): number {
  const need = -s.crewSide * t.sailHeelMoment; // > 0: sails heel the boat away from the crew
  return clamp((need - 0.08 * BOAT.stiffness) / BOAT.crewRighting, 0, 1);
}

// ---------- Point of sail ----------

export type PointOfSail = 'irons' | 'close_hauled' | 'close_reach' | 'beam_reach' | 'broad_reach' | 'run';

export const POINT_OF_SAIL_RU: Record<PointOfSail, string> = {
  irons: 'Левентик / мёртвая зона',
  close_hauled: 'Бейдевинд',
  close_reach: 'Полный бейдевинд',
  beam_reach: 'Галфвинд',
  broad_reach: 'Бакштаг',
  run: 'Фордевинд',
};

export const POINT_OF_SAIL_EN: Record<PointOfSail, string> = {
  irons: 'Head to wind / no-go zone',
  close_hauled: 'Close-hauled',
  close_reach: 'Close reach',
  beam_reach: 'Beam reach',
  broad_reach: 'Broad reach',
  run: 'Run',
};

export function pointOfSail(twa: number): PointOfSail {
  const a = Math.abs(twa) / DEG;
  if (a < 38) return 'irons';
  if (a < 58) return 'close_hauled';
  if (a < 80) return 'close_reach';
  if (a < 105) return 'beam_reach';
  if (a < 160) return 'broad_reach';
  return 'run';
}

/** Tack by the side opposite the boom (COLREG definition). */
export function tackOf(s: BoatState, twa: number): 'starboard' | 'port' {
  if (Math.abs(s.boom) > 3 * DEG) return s.boom < 0 ? 'starboard' : 'port';
  return twa >= 0 ? 'starboard' : 'port';
}

// ---------- Wind with gusts and shifts ----------

export interface WindModel {
  base: Wind;
  gustiness: number; // 0..1
  shifts: number; // max shift, rad
  seed: number;
}

export function windAt(model: WindModel, time: number): Wind & { gust: number } {
  const p = model.seed;
  const n1 = Math.sin(time * 0.23 + p) * 0.5 + Math.sin(time * 0.61 + p * 2.1) * 0.3 + Math.sin(time * 1.37 + p * 3.7) * 0.2;
  const n2 = Math.sin(time * 0.05 + p * 1.3) * 0.7 + Math.sin(time * 0.17 + p * 0.7) * 0.3;
  // Occasional strong gusts.
  const g = Math.max(0, Math.sin(time * 0.11 + p * 5.3)) ** 6;
  const gust = model.gustiness * (0.25 * n1 + 0.6 * g);
  return { from: model.base.from + model.shifts * n2, speed: Math.max(0, model.base.speed * (1 + gust)), gust };
}

export const BEAUFORT_MS = [0.2, 1.0, 2.6, 4.4, 6.7, 9.3, 12.3];
