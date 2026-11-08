// Training conditions chosen by the user: area/map, wind direction and strength, gusts, day/night and
// visibility. "auto" means "as the exercise defines it".

import { load, save } from '../lib/store';

export type AreaId = 'open' | 'training' | 'gdansk';
export type Gusts = 'auto' | 'none' | 'light' | 'strong';
export type Visibility = 'clear' | 'haze' | 'fog';

export interface Conditions {
  /** Area for exercises with marks (they are placed relative to the wind). */
  area: AreaId;
  /** Area for free sailing. */
  freeArea: AreaId;
  freeStart: string;
  /** Wind direction "from", degrees; or as in the exercise (north) / random. */
  windDir: 'auto' | 'random' | number;
  bft: 'auto' | 'random' | number;
  gusts: Gusts;
  night: 'auto' | 'day' | 'night';
  vis: Visibility;
}

export const DEFAULT_CONDITIONS: Conditions = {
  area: 'open', freeArea: 'gdansk', freeStart: 'gulf', windDir: 'auto', bft: 'auto', gusts: 'auto', night: 'auto', vis: 'clear',
};

export function loadConditions(): Conditions {
  return { ...DEFAULT_CONDITIONS, ...load<Partial<Conditions>>('simCond', {}) };
}

export function saveConditions(c: Conditions): void {
  save('simCond', c);
}

export const AREA_RU: Record<AreaId, string> = {
  open: 'Открытая вода',
  training: 'Учебная акватория (берег, марина, фарватер, кардинальные знаки)',
  gdansk: 'Гданьск — реальная карта (OpenStreetMap)',
};

const FROM_RU = ['с севера', 'с северо-востока', 'с востока', 'с юго-востока', 'с юга', 'с юго-запада', 'с запада', 'с северо-запада'];
const NAME_RU = ['северный', 'северо-восточный', 'восточный', 'юго-восточный', 'южный', 'юго-западный', 'западный', 'северо-западный'];
const idx8 = (deg: number) => Math.round((((deg % 360) + 360) % 360) / 45) % 8;

/** "с северо-запада" */
export const windFromRu = (deg: number) => FROM_RU[idx8(deg)];
/** "северо-западный" */
export const windNameRu = (deg: number) => NAME_RU[idx8(deg)];

export const DIR_OPTIONS: [string, string][] = [
  ['auto', 'как в задании'], ['random', 'случайное'],
  ...NAME_RU.map((n, i): [string, string] => [String(i * 45), `${n} (${FROM_RU[i]})`]),
];

/** Wind direction in degrees ("from"). */
export function resolveWindDir(c: Conditions, missionDeg = 0, rnd = Math.random): number {
  if (c.windDir === 'random') return Math.floor(rnd() * 72) * 5;
  if (c.windDir === 'auto') return missionDeg;
  return c.windDir;
}

export function resolveBft(c: Conditions, missionBft: number, rnd = Math.random): number {
  if (c.bft === 'random') return 2 + Math.floor(rnd() * 3);
  if (c.bft === 'auto') return missionBft;
  return c.bft;
}

/** Multipliers for the mission's own gust and shift settings. */
export function gustFactor(g: Gusts): { gust: number; shift: number } | null {
  if (g === 'none') return { gust: 0, shift: 0 };
  if (g === 'light') return { gust: 0.2, shift: 4 };
  if (g === 'strong') return { gust: 0.55, shift: 10 };
  return null;
}

/** Visible range in metres. */
export const VIS_RANGE: Record<Visibility, number> = { clear: Infinity, haze: 160, fog: 55 };
export const VIS_RU: Record<Visibility, string> = { clear: 'ясно', haze: 'дымка (~150 м)', fog: 'туман (~50 м)' };

/** Rotate a mission-frame point (designed for wind from the north) to a wind from `deg`, then shift. */
export function placeFn(deg: number, ox: number, oy: number): (x: number, y: number) => [number, number] {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return (x, y) => [ox + x * c + y * s, oy - x * s + y * c];
}
