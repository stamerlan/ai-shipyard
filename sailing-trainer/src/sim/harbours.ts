// Harbours for mooring practice under engine, built from real map data (OsmAnd / OpenStreetMap):
// water polygons, pontoons and piers, marina outlines and lights. Berths are generated along the
// real pontoons. Units: metres, x = east, y = north.

import { pointInPoly, WaterIndex, type Pt } from './world';
import type { MapData } from './maps/types';
import { GDANSK_MARINA } from './maps/gdanskMarina';
import { GDYNIA } from './maps/gdynia';
import { NCZ } from './maps/ncz';
import { MIKOLAJKI } from './maps/mikolajki';

export type MooringType = 'alongside' | 'finger' | 'buoy';

export interface Pose {
  x: number;
  y: number;
  /** Compass heading of the boat, rad. */
  heading: number;
}

export interface Slot extends Pose {
  type: MooringType;
  /** Stern buoy / mooring line pick-up point for bow-to berths. */
  buoy?: { x: number; y: number };
  /** For alongside berths either direction is fine. */
  eitherWay?: boolean;
  /** Unit vector from the pontoon towards open water. */
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
  color: 'red' | 'green' | 'white' | 'yellow';
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
  /** Water current, m/s (world frame). */
  current: { x: number; y: number };
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** Navigable water rings (even–odd); everything else is land. */
  water?: Pt[][];
  waterIndex?: WaterIndex;
  /** Drawn only: buildings, bridges (open), marina outlines. */
  decor?: { buildings: Pt[][]; bridges: Pt[][]; outline: Pt[][] };
  labels?: { x: number; y: number; text: string }[];
  attributionRu?: string;
  /** What the stern pick-up is called here ("буй" or "муринг"). */
  buoyRu?: string;
}

export interface Harbour extends HarbourLayout {
  moored: MooredBoat[];
  buoys: { x: number; y: number }[];
  /** The berth you must moor in (or leave from). */
  target: Slot;
}

export const YACHT = { halfL: 3.75, halfB: 1.3 };
export const ATTRIBUTION_RU = 'Карта: © участники OpenStreetMap (ODbL), извлечено из карт OsmAnd.';

const D = Math.PI / 180;

/** Rectangle polygon centred at (cx, cy), w across and h along a compass heading. */
export function rect(cx: number, cy: number, w: number, h: number, heading = 0): Pt[] {
  const s = Math.sin(heading), c = Math.cos(heading);
  const pts: Pt[] = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  return pts.map(([a, b]) => [cx + a * c + b * s, cy - a * s + b * c]);
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

// ---------- Building a harbour from map data ----------

interface Face { a: Pt; b: Pt; nx: number; ny: number }

interface RealCfg {
  id: string;
  nameRu: string;
  placeRu: string;
  mooringRu: string;
  data: MapData;
  mooring: 'alongside' | 'bowto';
  buoyRu?: string;
  current?: { x: number; y: number };
  /** Only berths inside marina outlines (bow-to marinas). */
  insideMarinas?: boolean;
  labels?: { x: number; y: number; text: string }[];
}

function realHarbour(cfg: RealCfg): HarbourLayout {
  const d = cfg.data;
  const index = new WaterIndex(d.water);
  // Pontoons: areas as mapped, lines get a width (long main pontoons are wider).
  const pontoons: Pt[][] = [...d.pierPolys];
  const faces: Face[] = [];
  for (const line of d.pierLines) {
    const w = len(line) > 60 ? 2.5 : 2.0;
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i], b = line[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 1) continue;
      const h = Math.atan2(b[0] - a[0], b[1] - a[1]);
      pontoons.push(rect((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, w, L + w, h));
      const sx = Math.cos(h), sy = -Math.sin(h);
      for (const side of [-1, 1]) {
        const o = (w / 2) * side;
        faces.push({ a: [a[0] + sx * o, a[1] + sy * o], b: [b[0] + sx * o, b[1] + sy * o], nx: sx * side, ny: sy * side });
      }
    }
  }
  for (const poly of d.pierPolys) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 3) continue;
      let nx = (b[1] - a[1]) / L, ny = -(b[0] - a[0]) / L;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (pointInPoly(mx + nx * 0.5, my + ny * 0.5, poly)) { nx = -nx; ny = -ny; }
      faces.push({ a, b, nx, ny });
    }
  }
  const pBoxes = pontoons.map((p) => {
    const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
    return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  });
  const onPontoon = (x: number, y: number) =>
    pontoons.some((p, i) => x >= pBoxes[i][0] && x <= pBoxes[i][1] && y >= pBoxes[i][2] && y <= pBoxes[i][3] && pointInPoly(x, y, p));
  const blocked = (x: number, y: number) => !index.contains(x, y) || onPontoon(x, y);
  const poseBlocked = (x: number, y: number, h: number, padB = 0, padL = 0) =>
    samplePose(x, y, h, YACHT.halfB + padB, YACHT.halfL + padL).some(([px, py]) => blocked(px, py));
  const inMarina = (x: number, y: number) => !cfg.insideMarinas || d.marinas.some((m) => pointInPoly(x, y, m));

  const slots: Slot[] = [];
  // Spatial hash of berths already placed (cells of 10 m), so overlap tests stay local.
  type Taken = { poly: Pt[]; pts: Pt[] };
  const grid = new Map<string, Taken[]>();
  const cell = (x: number, y: number) => `${Math.floor(x / 10)},${Math.floor(y / 10)}`;
  const near = (x: number, y: number) => {
    const out: Taken[] = [];
    const cx = Math.floor(x / 10), cy = Math.floor(y / 10);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(...(grid.get(`${cx + i},${cy + j}`) ?? []));
    return out;
  };
  const taken = {
    push(t: Taken) {
      const [x, y] = t.pts[Math.floor(t.pts.length / 2)];
      const k = cell(x, y);
      const list = grid.get(k) ?? [];
      list.push(t);
      grid.set(k, list);
    },
  };
  const overlaps = (poly: Pt[], pts: Pt[]) => {
    const [x, y] = pts[Math.floor(pts.length / 2)];
    return near(x, y).some((t) => pts.some(([px, py]) => pointInPoly(px, py, t.poly)) || t.pts.some(([px, py]) => pointInPoly(px, py, poly)));
  };

  for (const f of faces) {
    const L = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    const ux = (f.b[0] - f.a[0]) / L, uy = (f.b[1] - f.a[1]) / L;
    if (cfg.mooring === 'alongside') {
      const h = Math.atan2(ux, uy);
      const off = YACHT.halfB + 0.25;
      for (let s = 5.5; s <= L - 5.5; s += 9.5) {
        const x = f.a[0] + ux * s + f.nx * off, y = f.a[1] + uy * s + f.ny * off;
        if (!inMarina(x, y) || poseBlocked(x, y, h, 0.15, 0.6)) continue;
        if (blocked(x + f.nx * 10, y + f.ny * 10)) continue; // need room to manoeuvre
        const approach = (hd: number) => {
          const ax = Math.sin(hd), ay = Math.cos(hd);
          for (let k = 2; k <= 14; k++) {
            const o = 3.8 * Math.min(1, Math.max(0, (k - 1) / 6)) ** 2;
            if (poseBlocked(x - ax * k + f.nx * o, y - ay * k + f.ny * o, hd)) return false;
          }
          return true;
        };
        if (!approach(h) && !approach(h + Math.PI)) continue;
        const poly = rect(x, y, YACHT.halfB * 2 + 0.3, YACHT.halfL * 2 + 1.2, h);
        const pts = samplePose(x, y, h, YACHT.halfB + 0.15, YACHT.halfL + 0.6);
        if (overlaps(poly, pts)) continue;
        taken.push({ poly, pts });
        slots.push({ x, y, heading: h, type: 'alongside', eitherWay: true, out: { x: f.nx, y: f.ny } });
      }
    } else {
      // Bow-to the pontoon, stern to a buoy / mooring line out in the water.
      const h = Math.atan2(-f.nx, -f.ny);
      for (let s = 2.2; s <= L - 2.2; s += 3.9) {
        const px = f.a[0] + ux * s, py = f.a[1] + uy * s;
        const x = px + f.nx * (YACHT.halfL + 0.4), y = py + f.ny * (YACHT.halfL + 0.4);
        if (!inMarina(x, y) || poseBlocked(x, y, h, 0.25, 0)) continue;
        let clear = true;
        for (let k = 2; k <= 14 && clear; k += 2) if (poseBlocked(x + f.nx * k, y + f.ny * k, h)) clear = false;
        if (!clear) continue;
        const poly = rect(x, y, YACHT.halfB * 2 + 0.5, YACHT.halfL * 2 + 0.6, h);
        const pts = samplePose(x, y, h, YACHT.halfB + 0.25, YACHT.halfL + 0.3);
        if (overlaps(poly, pts)) continue;
        taken.push({ poly, pts });
        slots.push({ x, y, heading: h, type: 'buoy', out: { x: f.nx, y: f.ny }, buoy: { x: px + f.nx * (2 * YACHT.halfL + 5.5), y: py + f.ny * (2 * YACHT.halfL + 5.5) } });
      }
    }
  }

  // Bow-to berths face each other across fairways: drop berths whose approach corridor (12 m out)
  // would run into another berth.
  const finalSlots: Slot[] = [];
  if (cfg.mooring === 'bowto') {
    const corridor = (sl: Slot) => {
      const pts: Pt[] = [];
      for (let k = YACHT.halfL + 1; k <= YACHT.halfL + 12; k += 1.5) for (const a of [-1, 0, 1]) {
        pts.push([sl.x + sl.out!.x * k + sl.out!.y * a * (YACHT.halfB + 0.2), sl.y + sl.out!.y * k - sl.out!.x * a * (YACHT.halfB + 0.2)]);
      }
      return pts;
    };
    const boxOf = (sl: Slot) => rect(sl.x, sl.y, YACHT.halfB * 2, YACHT.halfL * 2, sl.heading);
    const kept: { sl: Slot; box: Pt[]; cor: Pt[] }[] = [];
    for (const sl of slots) {
      const box = boxOf(sl), cor = corridor(sl);
      const close = kept.filter((k) => Math.abs(k.sl.x - sl.x) < 30 && Math.abs(k.sl.y - sl.y) < 30);
      if (close.some((k) => cor.some(([x, y]) => pointInPoly(x, y, k.box)) || k.cor.some(([x, y]) => pointInPoly(x, y, box)))) continue;
      kept.push({ sl, box, cor });
      finalSlots.push(sl);
    }
  } else finalSlots.push(...slots);

  const [bx0, by0, bx1, by1] = d.bbox;
  const lights: HarbourLight[] = d.lights.map((l) => ({
    x: l.x, y: l.y,
    color: l.colour === 'red' ? 'red' : l.colour === 'green' ? 'green' : l.colour === 'yellow' ? 'yellow' : 'white',
    char: '',
  }));
  return {
    id: cfg.id, nameRu: cfg.nameRu, placeRu: cfg.placeRu, mooringRu: cfg.mooringRu,
    land: [], pontoons, fingers: [], slots: finalSlots, bigShips: [], lights,
    arrival: { x: 0, y: 0, heading: 0 }, exit: { x: 0, y: 0, r: 12 },
    current: cfg.current ?? { x: 0, y: 0 },
    bounds: { minX: bx0, maxX: bx1, minY: by0, maxY: by1 },
    water: d.water, waterIndex: index,
    decor: { buildings: d.buildings, bridges: d.bridges, outline: d.marinas },
    labels: cfg.labels,
    attributionRu: ATTRIBUTION_RU,
    buoyRu: cfg.buoyRu,
  };
}

function len(line: Pt[]): number {
  let s = 0;
  for (let i = 0; i + 1 < line.length; i++) s += Math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]);
  return s;
}

// ---------- The harbours ----------

export const HARBOURS: { id: string; nameRu: string; make: () => HarbourLayout }[] = [
  {
    id: 'gdansk', nameRu: 'Гданьск — Марина Гданьск (лагом)', make: () => realHarbour({
      id: 'gdansk', data: GDANSK_MARINA, mooring: 'alongside', current: { x: 0, y: 0.1 },
      nameRu: 'Гданьск — Марина Гданьск (Новая Мотлава)',
      placeRu: 'Реальная акватория: главный понтон вдоль набережной Шафарни, поперечные пирсы, напротив — Остров Спихлежей, на севере — разводной мост и плёс у Оловянки. Слабое течение на север.',
      mooringRu: 'Лагом (бортом) к понтону. Идите вдоль стоящих яхт в 3–4 м от них; когда корма пройдёт соседа — поворачивайте к понтону под 25–30°. У места: нейтраль, румпель — чтобы корма подошла к понтону, ход гасите малым задним. Лучше подходить против течения.',
      labels: [{ x: -95, y: 60, text: 'Оловянка' }, { x: -60, y: -150, text: 'Остров Спихлежей' }, { x: 45, y: -120, text: 'Шафарня' }],
    }),
  },
  {
    id: 'ncz', nameRu: 'Гурки-Заходние — NCŻ (муринг)', make: () => realHarbour({
      id: 'ncz', data: NCZ, mooring: 'bowto', insideMarinas: true, buoyRu: 'муринг',
      nameRu: 'Гурки-Заходние — Narodowe Centrum Żeglarstwa',
      placeRu: 'Реальная акватория у устья Śmiała Wisła: волноломы на выходе в Гданьский залив, бассейны NCŻ и клубов у устья, ниже по реке — городская марина Гурок.',
      mooringRu: 'Носом к понтону, корма — на муринге (кормовой конец с грунта). Выйдите на ось места, малым ходом заходите прямо, проходя рядом с точкой муринга (экипаж поднимает его), у понтона погасите ход задним.',
      labels: [{ x: 250, y: 600, text: 'Śmiała Wisła' }, { x: -300, y: 900, text: 'Zatoka Gdańska' }],
    }),
  },
  {
    id: 'gdynia', nameRu: 'Гдыня — яхтенные бассейны (муринг)', make: () => realHarbour({
      id: 'gdynia', data: GDYNIA, mooring: 'bowto', insideMarinas: true, buoyRu: 'муринг',
      nameRu: 'Гдыня — Marina Gdynia',
      placeRu: 'Реальная акватория: яхтенные бассейны у Южного мола, портовые причалы, выход в Гданьский залив на восток за волноломом.',
      mooringRu: 'Носом к понтону, корма — на муринге. Выйдите на ось места, малым ходом заходите прямо, проходя рядом с точкой муринга, у понтона погасите ход задним.',
    }),
  },
  {
    id: 'mikolajki', nameRu: 'Миколайки — Мазуры (корма на буе)', make: () => realHarbour({
      id: 'mikolajki', data: MIKOLAJKI, mooring: 'bowto', insideMarinas: true, buoyRu: 'буй',
      nameRu: 'Миколайки — Мазуры',
      placeRu: 'Реальная акватория: Миколайское озеро, протока через город под мостами, марины и пристани вдоль берегов.',
      mooringRu: 'Мазурская швартовка: носом к кее/понтону, корма на буе. Выйдите на ось места, пройдите вплотную к своему бую (экипаж берёт его кормовым концом), малым ходом к понтону, ход гасите задним.',
    }),
  },
];

const layoutCache = new Map<string, HarbourLayout>();
/** Layouts are deterministic (real maps take a moment to process), so build each one once. */
function layoutOf(def: { id: string; make: () => HarbourLayout }): HarbourLayout {
  let l = layoutCache.get(def.id);
  if (!l) { l = def.make(); layoutCache.set(def.id, l); }
  return l;
}

const COLORS = ['#ffffff', '#f4f1e8', '#e8eef4', '#1f3b5a', '#ffffff', '#c9d6df', '#8a1f1f', '#ffffff'];

/** Build a harbour with a random free berth; all other berths are taken by moored yachts. */
export function buildHarbour(id: string | null, rnd: () => number = Math.random): Harbour {
  const def = HARBOURS.find((h) => h.id === id) ?? HARBOURS[Math.floor(rnd() * HARBOURS.length)];
  const lay = layoutOf(def);
  const candidates = lay.slots.length > 6 ? lay.slots.filter((_, i) => i > 1 && i < lay.slots.length - 2) : lay.slots;
  const target = candidates[Math.floor(rnd() * candidates.length)];
  const empty = new Set<Slot>([target]);
  for (let k = 0; k < 3; k++) empty.add(lay.slots[Math.floor(rnd() * lay.slots.length)]);
  if (target.type === 'alongside') {
    // Coming alongside needs a gap of two to three boat lengths: free the neighbouring berths too.
    const par = (a: number, b: number) => Math.abs(Math.sin(a - b)) < 0.2;
    for (const s of lay.slots) if (s !== target && par(s.heading, target.heading) && Math.hypot(s.x - target.x, s.y - target.y) < 12) empty.add(s);
  }
  const moored: MooredBoat[] = [...lay.bigShips];
  const buoys: { x: number; y: number }[] = [];
  for (const s of lay.slots) {
    if (s.buoy) buoys.push(s.buoy);
    if (empty.has(s)) continue;
    const scale = s.type === 'alongside' ? 0.85 + rnd() * 0.15 : 0.8 + rnd() * 0.2;
    const jitter = s.type === 'alongside' ? (rnd() - 0.5) * 0.8 : 0;
    moored.push({
      x: s.x + Math.sin(s.heading) * jitter, y: s.y + Math.cos(s.heading) * jitter,
      heading: s.heading + (s.eitherWay && rnd() < 0.5 ? Math.PI : 0),
      halfL: YACHT.halfL * scale, halfB: YACHT.halfB * Math.min(1, scale + 0.05), color: COLORS[Math.floor(rnd() * COLORS.length)], kind: 'yacht',
    });
  }
  if (target.type === 'alongside' && target.out) clearApproach(target, moored);
  const h: Harbour = { ...lay, moored, buoys, target };
  // Start and exit: out in open water on the approach side of the berth.
  const out = target.out ?? { x: 0, y: 1 };
  const along = target.type === 'alongside' ? { x: -Math.sin(target.heading), y: -Math.cos(target.heading) } : out;
  const free = (p: Pose) => {
    if (!samplePose(p.x, p.y, p.heading, YACHT.halfB + 1.5, YACHT.halfL + 1.5).every(([x, y]) => clearAt(h, x, y))) return false;
    // Two-way test: no moored yacht may poke into our (padded) hull either.
    const mine = rect(p.x, p.y, YACHT.halfB * 2 + 3, YACHT.halfL * 2 + 3, p.heading);
    return !h.moored.some((m) => Math.hypot(m.x - p.x, m.y - p.y) < 20 && samplePose(m.x, m.y, m.heading, m.halfB, m.halfL).some(([x, y]) => pointInPoly(x, y, mine)));
  };
  const findFree = (cx: number, cy: number): Pose | null => {
    for (let r = 0; r <= 40; r += 3) {
      for (let a = 0; a < 360; a += r ? 20 : 360) {
        const x = cx + Math.sin(a * D) * r, y = cy + Math.cos(a * D) * r;
        const p = { x, y, heading: Math.atan2(target.x - x, target.y - y) };
        if (free(p)) return p;
      }
    }
    return null;
  };
  let found = false;
  for (const dist of [45, 35, 25, 60, 18, 80, 12]) {
    const ox = target.type === 'alongside' ? out.x * 6 : 0, oy = target.type === 'alongside' ? out.y * 6 : 0;
    const p = findFree(target.x + along.x * dist + ox, target.y + along.y * dist + oy);
    if (p) { h.arrival = p; h.exit = { x: p.x, y: p.y, r: 12 }; found = true; break; }
  }
  if (!found) {
    // Fall back to the straight approach line itself (always clear by construction).
    const p = { x: target.x + out.x * 10, y: target.y + out.y * 10, heading: Math.atan2(-out.x, -out.y) };
    h.arrival = p; h.exit = { x: p.x, y: p.y, r: 10 };
  }
  return h;
}

/** Remove moored yachts standing on the better of the two approach lines to an alongside berth. */
function clearApproach(t: Slot, moored: MooredBoat[]): void {
  const blockers = (hd: number) => {
    const ax = Math.sin(hd), ay = Math.cos(hd);
    const hit = new Set<MooredBoat>();
    for (let k = 2; k <= 16; k += 1) {
      const o = 3.8 * Math.min(1, Math.max(0, (k - 1) / 6)) ** 2;
      const pts = samplePose(t.x - ax * k + t.out!.x * o, t.y - ay * k + t.out!.y * o, hd, YACHT.halfB + 0.3, YACHT.halfL + 0.3);
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
  if (h.waterIndex ? !h.waterIndex.contains(x, y) : h.water && !h.water.some((w) => pointInPoly(x, y, w))) return false;
  const polys = [...h.land, ...h.pontoons, ...h.fingers, ...h.moored.map((m) => rect(m.x, m.y, m.halfB * 2, m.halfL * 2, m.heading))];
  return !polys.some((p) => pointInPoly(x, y, p));
}
