// Harbours for mooring practice under engine. Layouts are simplified and only *inspired by*
// real places (not charts): a river marina with alongside berths (Gdańsk, Nowa Motława),
// a breakwater basin with finger pontoons (Gdynia) and a Masurian quay where yachts lie
// bow-to with a stern buoy (Mikołajki). Units: metres, y = north.

import { pointInPoly, type Pt } from './world';
import { WATER, PIERS, BRIDGES, BUILDINGS, MARINA_OUTLINE } from './maps/gdanskOsm';

export type MooringType = 'alongside' | 'finger' | 'buoy';

export interface Pose {
  x: number;
  y: number;
  /** Compass heading of the boat, rad. */
  heading: number;
}

export interface Slot extends Pose {
  type: MooringType;
  /** Stern buoy for Masurian-style berths. */
  buoy?: { x: number; y: number };
  /** For alongside berths either direction is fine. */
  eitherWay?: boolean;
  /** Unit vector from the pontoon towards open water (alongside berths). */
  out?: { x: number; y: number };
}

export interface MooredBoat extends Pose {
  halfL: number;
  halfB: number;
  color: string;
  kind: 'yacht' | 'ship';
}

export interface HarbourLight {
  x: number;
  y: number;
  color: 'red' | 'green' | 'white';
  char: string;
}

export interface HarbourLayout {
  id: string;
  nameRu: string;
  placeRu: string;
  mooringRu: string;
  land: Pt[][];
  pontoons: Pt[][];
  fingers: Pt[][];
  slots: Slot[];
  bigShips: MooredBoat[];
  lights: HarbourLight[];
  arrival: Pose;
  exit: { x: number; y: number; r: number };
  /** Start/exit closer to the chosen berth (long harbours). */
  near?: (t: Slot) => { arrival: Pose; exit: { x: number; y: number; r: number } };
  /** Water current, m/s (world frame). */
  current: { x: number; y: number };
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** Real-map harbours: navigable water polygons (everything else is land). */
  water?: Pt[][];
  /** Drawn only: buildings, bridges (open), marina outline. */
  decor?: { buildings: Pt[][]; bridges: Pt[][]; outline: Pt[][] };
  /** Data source shown to the user. */
  attributionRu?: string;
}

export interface Harbour extends HarbourLayout {
  moored: MooredBoat[];
  buoys: { x: number; y: number }[];
  /** The berth you must moor in (or leave from). */
  target: Slot;
}

export const YACHT = { halfL: 3.75, halfB: 1.3 };

const D = Math.PI / 180;

/** Rectangle polygon centred at (cx, cy), w across and h along a compass heading. */
export function rect(cx: number, cy: number, w: number, h: number, heading = 0): Pt[] {
  const s = Math.sin(heading), c = Math.cos(heading);
  const pts: Pt[] = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  return pts.map(([a, b]) => [cx + a * c + b * s, cy - a * s + b * c]);
}

const box = (x1: number, y1: number, x2: number, y2: number): Pt[] => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];

// ---------- Gdańsk: Marina Gdańsk on Nowa Motława, real geometry from OsmAnd/OpenStreetMap ----------
const inWater = (x: number, y: number) => WATER.some((w) => pointInPoly(x, y, w));

function gdansk(): HarbourLayout {
  // Pontoons from the pier centre lines: the long one is the main pontoon along the Szafarnia quay.
  const longest = PIERS.reduce((a, b) => (len(b) > len(a) ? b : a));
  const pontoons: Pt[][] = [];
  const segs: { a: Pt; b: Pt; w: number }[] = [];
  for (const line of PIERS) {
    const w = line === longest ? 2.5 : 2.0;
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i], b = line[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 1) continue;
      const h = Math.atan2(b[0] - a[0], b[1] - a[1]);
      pontoons.push(rect((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, w, L + w, h));
      segs.push({ a, b, w });
    }
  }
  const blocked = (x: number, y: number) => !inWater(x, y) || pontoons.some((p) => pointInPoly(x, y, p));
  // Alongside berths on both faces of every pontoon segment, where a 7.5 m yacht fits in open water.
  const slots: Slot[] = [];
  const taken: { poly: Pt[]; pts: Pt[] }[] = [];
  for (const { a, b, w } of segs) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const h = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const fx = Math.sin(h), fy = Math.cos(h), sx = Math.cos(h), sy = -Math.sin(h);
    for (const side of [-1, 1]) {
      const off = w / 2 + YACHT.halfB + 0.25;
      // Only faces with room to manoeuvre (not the narrow gap between the main pontoon and the quay).
      const mx = (a[0] + b[0]) / 2 + sx * side * (off + 9), my = (a[1] + b[1]) / 2 + sy * side * (off + 9);
      if (blocked(mx, my)) continue;
      for (let d = 5.5; d <= L - 5.5; d += 9.5) {
        const x = a[0] + fx * d + sx * side * off, y = a[1] + fy * d + sy * side * off;
        const poly = rect(x, y, YACHT.halfB * 2 + 0.3, YACHT.halfL * 2 + 1.2, h);
        if (samplePose(x, y, h, YACHT.halfB + 0.15, YACHT.halfL + 0.6).some(([px, py]) => blocked(px, py))) continue;
        const mine = samplePose(x, y, h, YACHT.halfB + 0.15, YACHT.halfL + 0.6);
        if (taken.some((t) => mine.some(([px, py]) => pointInPoly(px, py, t.poly)) || t.pts.some(([px, py]) => pointInPoly(px, py, poly)))) continue;
        // Keep only berths with a fair approach: ≥ 14 m of open water along the berth, 0–4 m out from it.
        const approachFrom = (hd: number) => {
          const ax = Math.sin(hd), ay = Math.cos(hd);
          for (let d = 2; d <= 14; d += 1) {
            const o = 3.8 * Math.min(1, Math.max(0, (d - 1) / 6)) ** 2;
            const px = x - ax * d + sx * side * o, py = y - ay * d + sy * side * o;
            if (samplePose(px, py, hd, YACHT.halfB, YACHT.halfL).some(([qx, qy]) => blocked(qx, qy))) return false;
          }
          return true;
        };
        if (!approachFrom(h) && !approachFrom(h + Math.PI)) continue;
        taken.push({ poly, pts: mine });
        slots.push({ x, y, heading: h, type: 'alongside', eitherWay: true, out: { x: sx * side, y: sy * side } });
      }
    }
  }
  /** Middle of the widest stretch of open water across the channel at latitude y. */
  const channelMid = (y: number): number => {
    let best = 0, bestLen = 0, runStart: number | null = null;
    for (let x = -130; x <= 90; x += 0.5) {
      const free = !blocked(x, y);
      if (free && runStart === null) runStart = x;
      if ((!free || x >= 90) && runStart !== null) {
        if (x - runStart > bestLen) { bestLen = x - runStart; best = (x + runStart) / 2; }
        runStart = null;
      }
    }
    return best;
  };
  return {
    id: 'gdansk',
    nameRu: 'Гданьск — Марина Гданьск (Новая Мотлава)',
    placeRu: 'Настоящая акватория по карте OsmAnd (данные OpenStreetMap): главный понтон вдоль набережной Шафарни, поперечные пирсы, напротив — Остров Спихлежей, на севере — разводной мост и плёс у Оловянки. Слабое течение на север.',
    mooringRu: 'Лагом (бортом) к понтону или пирсу. Идите вдоль стоящих яхт в 3–4 м от них; когда корма пройдёт соседа — поворачивайте к понтону под 25–30°. У места: нейтраль, румпель — чтобы корма подошла к понтону, ход гасите малым задним. Лучше подходить против течения.',
    land: [],
    pontoons,
    fingers: [],
    slots,
    bigShips: [],
    lights: [],
    arrival: { x: -45, y: 100, heading: 165 * D },
    exit: { x: -45, y: 105, r: 18 },
    near: (t) => {
      const y = Math.min(100, t.y + 70);
      const ey = Math.min(80, t.y + 60);
      return { arrival: { x: channelMid(y), y, heading: 180 * D }, exit: { x: channelMid(ey), y: ey, r: 12 } };
    },
    current: { x: 0, y: 0.1 },
    bounds: { minX: -130, maxX: 90, minY: -290, maxY: 150 },
    water: WATER,
    decor: { buildings: BUILDINGS, bridges: BRIDGES, outline: MARINA_OUTLINE },
    attributionRu: 'Карта: © участники OpenStreetMap (ODbL), извлечено из карт OsmAnd.',
  };
}

/** Points covering a boat-sized rectangle (edges and centre line), for clearance checks. */
export function samplePose(x: number, y: number, heading: number, halfB: number, halfL: number): Pt[] {
  const s = Math.sin(heading), c = Math.cos(heading);
  const pts: Pt[] = [];
  for (let i = -4; i <= 4; i++) for (const a of [-1, 0, 1]) {
    const across = a * halfB, along = (i / 4) * halfL;
    pts.push([x + across * c + along * s, y - across * s + along * c]);
  }
  return pts;
}

function len(line: Pt[]): number {
  let s = 0;
  for (let i = 0; i + 1 < line.length; i++) s += Math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]);
  return s;
}

// ---------- Gdynia: breakwater basin, finger pontoons ----------
function gdynia(): HarbourLayout {
  const pontoonXs = [-55, -12, 31];
  const pontoons: Pt[][] = [];
  const fingers: Pt[][] = [];
  const slots: Slot[] = [];
  for (const px of pontoonXs) {
    pontoons.push(box(px - 1.25, -60, px + 1.25, 14));
    for (let y = -57; y <= 13; y += 4.2) {
      for (const side of [-1, 1]) {
        if (px === 31 && side === 1 && y > 0) continue; // keep the area under the entrance clear
        fingers.push(box(side > 0 ? px + 1.25 : px - 8.25, y - 0.3, side > 0 ? px + 8.25 : px - 1.25, y + 0.3));
        if (y + 4.2 <= 13.5) slots.push({ x: px + side * 5.4, y: y + 2.1, heading: side > 0 ? 270 * D : 90 * D, type: 'finger' });
      }
    }
  }
  return {
    id: 'gdynia',
    nameRu: 'Гдыня — яхтенный бассейн',
    placeRu: 'Бассейн за волноломом (по мотивам Марины Гдыня): вход с севера между головками мола, три понтона с пальцами (Y-бомами).',
    mooringRu: 'Носом в «бокс» между пальцами. Заранее выйдите на ось места, заходите прямо малым ходом; боковой ветер сносит — держите упреждение. У понтона погасите ход малым задним.',
    land: [box(-300, -300, -90, 300), box(90, -300, 300, 300), box(-90, -300, 90, -60), box(-90, 60, 45, 76), box(75, 60, 90, 76)],
    pontoons,
    fingers,
    slots,
    bigShips: [],
    lights: [
      { x: 45, y: 72, color: 'green', char: 'Fl G 4s' },
      { x: 75, y: 72, color: 'red', char: 'Fl R 4s' },
    ],
    arrival: { x: 60, y: 108, heading: 180 * D },
    exit: { x: 60, y: 100, r: 16 },
    current: { x: 0, y: 0 },
    bounds: { minX: -95, maxX: 95, minY: -65, maxY: 160 },
  };
}

// ---------- Mikołajki: Masurian quay, bow-to with stern buoys ----------
function mikolajki(): HarbourLayout {
  const slots: Slot[] = [];
  for (let x = -138; x <= 86; x += 4) {
    slots.push({ x, y: 4.15, heading: 180 * D, type: 'buoy', buoy: { x, y: 17 } });
  }
  return {
    id: 'mikolajki',
    nameRu: 'Миколайки — Мазуры',
    placeRu: 'Набережная на озере (по мотивам Wioska Żeglarska в Миколайках): яхты стоят носом к кее, корма — на буе; рядом мол с прогулочным судном.',
    mooringRu: 'Носом к кее, корма на буе. Выйдите на ось места, пройдите вплотную к своему бую (экипаж берёт его кормовым концом), затем малым ходом к кее и погасите ход задним.',
    land: [box(-300, -200, 300, 0), box(-300, 0, -150, 90), box(96, 0, 101, 75)],
    pontoons: [],
    fingers: [],
    slots,
    bigShips: [{ x: 106, y: 38, heading: 0, halfL: 19, halfB: 4, color: '#f2f2f2', kind: 'ship' }],
    lights: [{ x: 98.5, y: 74, color: 'green', char: 'Fl G 3s' }],
    arrival: { x: 0, y: 110, heading: 180 * D },
    exit: { x: 0, y: 100, r: 22 },
    near: (t) => ({ arrival: { x: Math.max(-120, Math.min(70, t.x + 25)), y: 75, heading: 200 * D }, exit: { x: Math.max(-120, Math.min(70, t.x)), y: 60, r: 14 } }),
    current: { x: 0, y: 0 },
    bounds: { minX: -155, maxX: 130, minY: -10, maxY: 130 },
  };
}

export const HARBOURS: { id: string; nameRu: string; make: () => HarbourLayout }[] = [
  { id: 'gdansk', nameRu: 'Гданьск, реальная карта (лагом)', make: gdansk },
  { id: 'gdynia', nameRu: 'Гдыня (между пальцами)', make: gdynia },
  { id: 'mikolajki', nameRu: 'Миколайки (носом, корма на буе)', make: mikolajki },
];

const COLORS = ['#ffffff', '#f4f1e8', '#e8eef4', '#1f3b5a', '#ffffff', '#c9d6df', '#8a1f1f', '#ffffff'];

const layoutCache = new Map<string, HarbourLayout>();
/** Layouts are deterministic (real maps take a moment to process), so build each one once. */
function layoutOf(def: { id: string; make: () => HarbourLayout }): HarbourLayout {
  let l = layoutCache.get(def.id);
  if (!l) { l = def.make(); layoutCache.set(def.id, l); }
  return l;
}

/** Build a harbour with a random free berth; all other berths are taken by moored yachts. */
export function buildHarbour(id: string | null, rnd: () => number = Math.random): Harbour {
  const def = HARBOURS.find((h) => h.id === id) ?? HARBOURS[Math.floor(rnd() * HARBOURS.length)];
  const lay = layoutOf(def);
  // Choose a target berth away from the very ends, plus a couple of other empty berths.
  const candidates = lay.slots.filter((_, i) => i > 1 && i < lay.slots.length - 2);
  const target = candidates[Math.floor(rnd() * candidates.length)];
  const empty = new Set<Slot>([target]);
  for (let k = 0; k < 2; k++) empty.add(lay.slots[Math.floor(rnd() * lay.slots.length)]);
  if (target.type === 'alongside') {
    // Coming alongside needs a gap of two to three boat lengths: free the neighbouring berths too.
    const par = (a: number, b: number) => Math.abs(Math.sin(a - b)) < 0.2;
    const nb = lay.slots.filter((s) => s !== target && par(s.heading, target.heading) && Math.hypot(s.x - target.x, s.y - target.y) < 12);
    for (const n of nb) empty.add(n);
  }
  const moored: MooredBoat[] = [...lay.bigShips];
  const buoys: { x: number; y: number }[] = [];
  for (const s of lay.slots) {
    if (s.buoy) buoys.push(s.buoy);
    if (empty.has(s)) continue;
    // Neighbours are slightly smaller or bigger than us and not perfectly placed.
    const scale = s.type === 'alongside' ? 0.85 + rnd() * 0.15 : 0.85 + rnd() * 0.25;
    const jitter = s.type === 'alongside' ? (rnd() - 0.5) * 0.8 : 0;
    moored.push({
      x: s.x + Math.sin(s.heading) * jitter, y: s.y + Math.cos(s.heading) * jitter, heading: s.heading + (s.eitherWay && rnd() < 0.5 ? Math.PI : 0),
      halfL: YACHT.halfL * scale, halfB: YACHT.halfB * Math.min(1, scale + 0.05), color: COLORS[Math.floor(rnd() * COLORS.length)], kind: 'yacht',
    });
  }
  if (target.type === 'alongside' && target.out) clearApproach(target, moored);
  const near = lay.near?.(target);
  const h: Harbour = { ...lay, ...(near ?? {}), moored, buoys, target };
  // Make sure the start is in open water, clear of everything (move it along the axis if needed).
  const free = (p: Pose) => samplePose(p.x, p.y, p.heading, YACHT.halfB + 1, YACHT.halfL + 1).every(([x, y]) => clearAt(h, x, y));
  if (!free(h.arrival)) {
    search: for (let r = 2; r <= 40; r += 2) {
      for (let a = 0; a < 360; a += 30) {
        const p = { ...h.arrival, x: h.arrival.x + Math.sin(a * D) * r, y: h.arrival.y + Math.cos(a * D) * r };
        if (free(p)) { h.arrival = p; break search; }
      }
    }
  }
  return h;
}

/** Remove moored yachts standing on the better of the two approach lines to an alongside berth. */
function clearApproach(t: Slot, moored: MooredBoat[]): void {
  const blockers = (hd: number) => {
    const ax = Math.sin(hd), ay = Math.cos(hd), sx = Math.cos(hd), sy = -Math.sin(hd);
    const side = Math.sign(t.out!.x * sx + t.out!.y * sy);
    const hit = new Set<MooredBoat>();
    for (let d = 2; d <= 16; d += 1) {
      const o = side * 3.8 * Math.min(1, Math.max(0, (d - 1) / 6)) ** 2;
      const pts = samplePose(t.x - ax * d + sx * o, t.y - ay * d + sy * o, hd, YACHT.halfB + 0.3, YACHT.halfL + 0.3);
      for (const m of moored) {
        if (m.kind !== 'yacht') continue;
        const poly = rect(m.x, m.y, m.halfB * 2, m.halfL * 2, m.heading);
        if (pts.some(([x, y]) => pointInPoly(x, y, poly))) hit.add(m);
      }
    }
    return hit;
  };
  const a = blockers(t.heading), b = blockers(t.heading + Math.PI);
  for (const m of a.size <= b.size ? a : b) moored.splice(moored.indexOf(m), 1);
}

function clearAt(h: Harbour, x: number, y: number): boolean {
  if (h.water && !h.water.some((w) => pointInPoly(x, y, w))) return false;
  const polys = [...h.land, ...h.pontoons, ...h.fingers, ...h.moored.map((m) => rect(m.x, m.y, m.halfB * 2, m.halfL * 2, m.heading))];
  return !polys.some((p) => pointInPoly(x, y, p));
}

/** Pose a boat should have when lying in the berth. */
export function berthPose(s: Slot): Pose {
  return { x: s.x, y: s.y, heading: s.heading };
}
