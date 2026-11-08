// Harbours for mooring practice under engine. Layouts are simplified and only *inspired by*
// real places (not charts): a river marina with alongside berths (Gdańsk, Nowa Motława),
// a breakwater basin with finger pontoons (Gdynia) and a Masurian quay where yachts lie
// bow-to with a stern buoy (Mikołajki). Units: metres, y = north.

import type { Pt } from './world';

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

// ---------- Gdańsk: river marina, alongside berths ----------
function gdansk(): HarbourLayout {
  const slots: Slot[] = [];
  for (let i = 0; i < 17; i++) {
    const y = -118 + i * 12.5;
    slots.push({ x: 29.2, y, heading: 0, type: 'alongside', eitherWay: true });
  }
  // A few yachts along the west quay as well.
  for (let i = 0; i < 6; i++) slots.push({ x: -30.2, y: 20 + i * 12.5, heading: 180 * D, type: 'alongside', eitherWay: true });
  return {
    id: 'gdansk',
    nameRu: 'Гданьск — Новая Мотлава',
    placeRu: 'Речная марина в центре города (по мотивам Марины Гданьск): узкое русло, плавучий понтон вдоль набережной, у западной набережной — исторические суда. Слабое течение на север.',
    mooringRu: 'Лагом (бортом) к понтону. Идите вдоль стоящих яхт в 3–4 м от них; когда корма пройдёт соседа — поворачивайте к понтону под 25–30°. У места: нейтраль, румпель — чтобы корма подошла к понтону, ход гасите малым задним. Лучше подходить против течения.',
    land: [box(-250, -260, -32, 260), box(36, -260, 250, 260), box(-32, -260, 36, -150)],
    pontoons: [box(31, -128, 35, 98)],
    fingers: [],
    slots,
    bigShips: [
      { x: -26.5, y: -75, heading: 0, halfL: 26, halfB: 4.6, color: '#3d4a52', kind: 'ship' },
      { x: -28, y: -20, heading: 180 * D, halfL: 12, halfB: 3, color: '#7b5a3a', kind: 'ship' },
    ],
    lights: [],
    arrival: { x: 0, y: 200, heading: 180 * D },
    exit: { x: 0, y: 215, r: 22 },
    near: (t) => ({ arrival: { x: 0, y: Math.min(200, t.y + 75), heading: 180 * D }, exit: { x: 0, y: Math.min(215, t.y + 85), r: 15 } }),
    current: { x: 0, y: 0.15 },
    bounds: { minX: -60, maxX: 60, minY: -160, maxY: 240 },
  };
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
  { id: 'gdansk', nameRu: 'Гданьск (лагом)', make: gdansk },
  { id: 'gdynia', nameRu: 'Гдыня (между пальцами)', make: gdynia },
  { id: 'mikolajki', nameRu: 'Миколайки (носом, корма на буе)', make: mikolajki },
];

const COLORS = ['#ffffff', '#f4f1e8', '#e8eef4', '#1f3b5a', '#ffffff', '#c9d6df', '#8a1f1f', '#ffffff'];

/** Build a harbour with a random free berth; all other berths are taken by moored yachts. */
export function buildHarbour(id: string | null, rnd: () => number = Math.random): Harbour {
  const def = HARBOURS.find((h) => h.id === id) ?? HARBOURS[Math.floor(rnd() * HARBOURS.length)];
  const lay = def.make();
  // Choose a target berth away from the very ends, plus a couple of other empty berths.
  const candidates = lay.slots.filter((_, i) => i > 1 && i < lay.slots.length - 2);
  const target = candidates[Math.floor(rnd() * candidates.length)];
  const empty = new Set<Slot>([target]);
  for (let k = 0; k < 2; k++) empty.add(lay.slots[Math.floor(rnd() * lay.slots.length)]);
  const moored: MooredBoat[] = [...lay.bigShips];
  const buoys: { x: number; y: number }[] = [];
  for (const s of lay.slots) {
    if (s.buoy) buoys.push(s.buoy);
    if (empty.has(s)) continue;
    // Neighbours are slightly smaller or bigger than us and not perfectly placed.
    const scale = 0.85 + rnd() * 0.25;
    const jitter = s.type === 'alongside' ? (rnd() - 0.5) * 2 : 0;
    moored.push({
      x: s.x, y: s.y + (s.type === 'alongside' ? jitter : 0), heading: s.heading + (s.eitherWay && rnd() < 0.5 ? Math.PI : 0),
      halfL: YACHT.halfL * scale, halfB: YACHT.halfB * Math.min(1, scale + 0.05), color: COLORS[Math.floor(rnd() * COLORS.length)], kind: 'yacht',
    });
  }
  const near = lay.near?.(target);
  return { ...lay, ...(near ?? {}), moored, buoys, target };
}

/** Pose a boat should have when lying in the berth. */
export function berthPose(s: Slot): Pose {
  return { x: s.x, y: s.y, heading: s.heading };
}
