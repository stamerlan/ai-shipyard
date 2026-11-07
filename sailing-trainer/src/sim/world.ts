// The sailing area: coast with a small marina, a buoyed fairway (IALA A), a shoal guarded by
// cardinal marks, an isolated danger, a special mark and lighthouses. Units: metres, y = north.

export type Pt = [number, number];

export type BuoyKind = 'port' | 'starboard' | 'north' | 'east' | 'south' | 'west' | 'isolated' | 'safe' | 'special';

export interface Light {
  /** Light character as printed on charts, e.g. "Q(3) 10s". */
  char: string;
  color: 'white' | 'red' | 'green' | 'yellow';
}

export interface Buoy {
  x: number;
  y: number;
  kind: BuoyKind;
  light: Light;
}

export interface Lighthouse {
  x: number;
  y: number;
  light: Light;
  /** Visible range of the light in metres (scaled down for the simulator). */
  range: number;
  name: string;
}

export interface Shoal {
  x: number;
  y: number;
  r: number;
}

export interface Gate {
  x: number;
  yMin: number;
  yMax: number;
}

export interface World {
  land: Pt[][];
  shoals: Shoal[];
  pontoons: { x: number; y: number; w: number; h: number }[];
  buoys: Buoy[];
  lighthouses: Lighthouse[];
  /** Fairway gates from the harbour entrance outwards (west → east). */
  gates: Gate[];
  berth: { x: number; y: number };
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

const GATE_XS = [-250, -200, -150, -100];

export function createWorld(): World {
  const westCoast: Pt[] = [
    [-1500, -1500], [-280, -1500], [-280, -12], [-300, -12], [-300, -40], [-390, -40], [-390, 46],
    [-300, 46], [-300, 12], [-280, 12], [-280, 150], [-150, 196], [-104, 222], [-100, 246], [-140, 268],
    [-280, 330], [-280, 1500], [-1500, 1500],
  ];
  const southCoast: Pt[] = [
    [-280, -1500], [1500, -1500], [1500, -300], [420, -282], [260, -250], [120, -272], [0, -262], [-140, -238], [-280, -230],
  ];
  const buoys: Buoy[] = [];
  for (const x of GATE_XS) {
    // Entering the harbour means heading west: red (port-hand) marks are on the south side.
    buoys.push({ x, y: -16, kind: 'port', light: { char: 'Fl R 4s', color: 'red' } });
    buoys.push({ x, y: 16, kind: 'starboard', light: { char: 'Fl G 4s', color: 'green' } });
  }
  buoys.push({ x: -45, y: 0, kind: 'safe', light: { char: 'LFl 10s', color: 'white' } });
  const shoal = { x: 80, y: 140, r: 27 };
  buoys.push(
    { x: shoal.x, y: shoal.y + 34, kind: 'north', light: { char: 'Q', color: 'white' } },
    { x: shoal.x + 34, y: shoal.y, kind: 'east', light: { char: 'Q(3) 10s', color: 'white' } },
    { x: shoal.x, y: shoal.y - 34, kind: 'south', light: { char: 'Q(6)+LFl 15s', color: 'white' } },
    { x: shoal.x - 34, y: shoal.y, kind: 'west', light: { char: 'Q(9) 15s', color: 'white' } },
    { x: 230, y: -130, kind: 'isolated', light: { char: 'Fl(2) 5s', color: 'white' } },
    { x: 250, y: 60, kind: 'special', light: { char: 'Fl Y 5s', color: 'yellow' } },
  );
  return {
    land: [westCoast, southCoast],
    shoals: [shoal, { x: 230, y: -130, r: 6 }],
    pontoons: [{ x: -380, y: 38, w: 60, h: 8 }],
    buoys,
    lighthouses: [
      { x: -112, y: 236, light: { char: 'Fl(3) 15s', color: 'white' }, range: 900, name: 'Маяк' },
      { x: -290, y: -14, light: { char: 'Fl R 4s', color: 'red' }, range: 300, name: 'Мол' },
      { x: -290, y: 14, light: { char: 'Fl G 4s', color: 'green' }, range: 300, name: 'Мол' },
    ],
    gates: [{ x: -290, yMin: -12, yMax: 12 }, ...GATE_XS.map((x) => ({ x, yMin: -16, yMax: 16 }))],
    berth: { x: -350, y: 32 },
    bounds: { minX: -420, maxX: 330, minY: -300, maxY: 340 },
  };
}

export function pointInPoly(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Is this point on land, on a shoal or on a pontoon? */
export function isBlocked(w: World, x: number, y: number): 'land' | 'shoal' | 'pontoon' | null {
  for (const p of w.pontoons) if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return 'pontoon';
  for (const s of w.shoals) if (Math.hypot(x - s.x, y - s.y) < s.r) return 'shoal';
  for (const poly of w.land) if (pointInPoly(x, y, poly)) return 'land';
  return null;
}

// ---------- Light characters ----------

/** On/off segments (seconds) of a light character; the sequence repeats. */
export function lightSegments(char: string): [boolean, number][] {
  const m = char.match(/^(VQ|Q|Fl|LFl|Iso)(?:\((\d+)\))?(\+LFl)?(?: [A-Z])?(?: (\d+)s)?$/);
  if (!m) return [[true, 1]];
  const [, kind, nStr, plusLong, periodStr] = m;
  const n = nStr ? Number(nStr) : 1;
  const segs: [boolean, number][] = [];
  if (kind === 'Q' || kind === 'VQ') {
    const on = kind === 'Q' ? 0.3 : 0.15, off = kind === 'Q' ? 0.7 : 0.35;
    if (!nStr && !periodStr) return [[true, on], [false, off]]; // continuous
    for (let i = 0; i < n; i++) segs.push([true, on], [false, off]);
    if (plusLong) segs.push([true, 2], [false, 0.6]);
  } else if (kind === 'Fl') {
    for (let i = 0; i < n; i++) segs.push([true, 0.5], [false, 1]);
  } else if (kind === 'LFl') {
    segs.push([true, 2]);
  } else if (kind === 'Iso') {
    const p = Number(periodStr ?? 4);
    return [[true, p / 2], [false, p / 2]];
  }
  const used = segs.reduce((a, [, d]) => a + d, 0);
  const period = periodStr ? Number(periodStr) : used + 1;
  segs.push([false, Math.max(0.2, period - used)]);
  return segs;
}

const segCache = new Map<string, { segs: [boolean, number][]; period: number }>();

export function lightOn(char: string, t: number, phase = 0): boolean {
  let c = segCache.get(char);
  if (!c) {
    const segs = lightSegments(char);
    c = { segs, period: segs.reduce((a, [, d]) => a + d, 0) };
    segCache.set(char, c);
  }
  let x = (((t + phase) % c.period) + c.period) % c.period;
  for (const [on, d] of c.segs) {
    if (x < d) return on;
    x -= d;
  }
  return false;
}

export const BUOY_RU: Record<BuoyKind, string> = {
  port: 'Левая сторона фарватера',
  starboard: 'Правая сторона фарватера',
  north: 'Северный кардинальный',
  east: 'Восточный кардинальный',
  south: 'Южный кардинальный',
  west: 'Западный кардинальный',
  isolated: 'Отдельная опасность',
  safe: 'Безопасная вода',
  special: 'Специальный знак',
};
