// The Gdańsk sailing area from real map data: Gulf of Gdańsk, the port entrance at Nowy Port and
// Westerplatte, Port Północny, Martwa Wisła down to Marina Gdańsk and east to Górki Zachodnie / NCŻ.

import { WaterIndex, type World } from './world';
import { GDANSK_REGION } from './maps/gdanskRegion';
import { GDANSK_MARINA } from './maps/gdanskMarina';
import { NCZ } from './maps/ncz';
import type { MapData } from './maps/types';

export const GDANSK_PLACES = {
  marina: { x: -60, y: 60, name: 'Марина Гданьск (вход в Новую Мотлаву)' },
  portEntrance: { x: -150, y: 7300, name: 'Вход в порт Гданьск (Новый Порт)' },
  gorki: { x: 7850, y: 3050, name: 'Устье Śmiała Wisła (Гурки-Заходние, NCŻ)' },
};

/** Start positions for free sailing: [id, name, x, y]. */
export const GDANSK_STARTS: [string, string, number, number][] = [
  ['gulf', 'Гданьский залив, у входа в порт', -300, 7520],
  ['gulfOpen', 'Открытая часть залива', 4500, 7900],
  ['gorki', 'У устья Śmiała Wisła (Гурки-Заходние)', 7400, 3100],
  ['ncz', 'Гавани Гурки-Заходние (NCŻ)', 7830, 1830],
  ['canal', 'Martwa Wisła у Вестерплатте', 400, 6080],
  ['marina', 'Марина Гданьск, у Оловянки (Мотлава)', -90, 20],
];

/** Open water in the gulf, used to place wind-relative exercises on the real map. */
export const GULF_ANCHOR = { x: 4500, y: 7900 };

let cached: World | null = null;

export function createGdanskWorld(): World {
  if (cached) return cached;
  const d = GDANSK_REGION;
  const [x0, y0, x1, y1] = d.bbox;
  cached = {
    land: [], shoals: [], pontoons: [], buoys: [], gates: [],
    lighthouses: d.lights.map((l) => ({
      x: l.x, y: l.y, range: 400, name: 'Огонь',
      light: { char: '', color: l.colour === 'red' ? 'red' : l.colour === 'green' ? 'green' : l.colour === 'yellow' ? 'yellow' : 'white' },
    })),
    berth: { x: GDANSK_PLACES.marina.x, y: GDANSK_PLACES.marina.y },
    bounds: { minX: x0, maxX: x1, minY: y0, maxY: y1 },
    water: d.water,
    waterIndex: new WaterIndex(d.water, 16),
    bridges: d.bridges,
    marinaOutlines: d.marinas,
    labels: [
      { x: 5600, y: 8300, text: 'Zatoka Gdańska' },
      { x: 3900, y: 5300, text: 'Port Północny' },
      { x: 900, y: 6050, text: 'Westerplatte' },
      { x: -850, y: 6150, text: 'Nowy Port' },
      { x: 330, y: 3600, text: 'Martwa Wisła' },
      { x: 4400, y: 760, text: 'Martwa Wisła' },
      { x: 8150, y: 1300, text: 'Śmiała Wisła' },
      { x: 7300, y: 2250, text: 'Górki Zachodnie · NCŻ' },
      { x: -120, y: -80, text: 'Marina Gdańsk' },
    ],
    attribution: '© OpenStreetMap contributors (ODbL), via OsmAnd',
    // Cargo ships alongside: placed along straight quays of Port Północny, the Martwa Wisła
    // wharves and the terminal piers (positions are illustrative, not a live port plan).
    mooredShips: [
      { x: 3339, y: 4131, heading: -0.609, halfL: 70, halfB: 11 },
      { x: 3335, y: 4652, heading: -2.085, halfL: 70, halfB: 11 },
      { x: 3031, y: 4627, heading: -0.424, halfL: 70, halfB: 11 },
      { x: 2907, y: 4942, heading: -0.288, halfL: 69, halfB: 10 },
      { x: 2632, y: 5233, heading: -1.848, halfL: 70, halfB: 11 },
      { x: 3025, y: 5403, heading: -1.849, halfL: 70, halfB: 11 },
      { x: 437, y: 4277, heading: 0.662, halfL: 70, halfB: 11 },
      { x: 650, y: 4561, heading: 0.583, halfL: 70, halfB: 11 },
      { x: 1094, y: 5182, heading: 0.624, halfL: 70, halfB: 11 },
      { x: 1229, y: 5412, heading: 0.382, halfL: 70, halfB: 11 },
      { x: 1249, y: 5679, heading: -0.258, halfL: 70, halfB: 11 },
      { x: -34, y: 6375, heading: -2.31, halfL: 55, halfB: 8 },
      { x: 3626, y: 5812, heading: 2.111, halfL: 70, halfB: 11 },
      { x: 3514, y: 6163, heading: 0.727, halfL: 70, halfB: 11 },
      { x: 3706, y: 6346, heading: 0.732, halfL: 70, halfB: 11 },
    ],
    shipLanes: [
      // Port of Gdańsk: from the roads through the entrance between the breakwaters to the Westerplatte bend.
      { pts: [[-450, 9200], [-300, 7700], [60, 6620], [150, 6380], [260, 6220], [600, 6040], [1050, 5900]] },
      { pts: [[1050, 5900], [600, 6040], [260, 6220], [150, 6380], [60, 6620], [-300, 7700], [-450, 9200]] },
      // Port Północny terminal.
      { pts: [[5400, 9600], [4300, 6700]] },
      { pts: [[4300, 6700], [5400, 9600]] },
    ],
    laneShips: 2,
    nameRu: 'Гданьск (реальная карта)',
  };
  return cached;
}

/** Harbours of the motor (mooring) mode that lie on this chart. */
export const MOTOR_HARBOURS: { id: string; nameRu: string; data: MapData; box: [number, number, number, number] }[] = [
  { id: 'gdansk', nameRu: 'Марина Гданьск (Шафарня)', data: GDANSK_MARINA, box: [-400, -800, 130, 300] },
  { id: 'ncz', nameRu: 'NCŻ / Гурки-Заходние', data: NCZ, box: [6950, 1050, 8300, 2500] },
];

/** Convert a point of this chart into the local metres of another map (both use lat/lon origins). */
export function toMapCoords(data: MapData, x: number, y: number): [number, number] {
  const [lat0, lon0] = GDANSK_REGION.origin;
  const [lat1, lon1] = data.origin;
  const KY = 110540;
  const lon = lon0 + x / (Math.cos((lat0 * Math.PI) / 180) * 111320);
  const lat = lat0 + y / KY;
  return [(lon - lon1) * Math.cos((lat1 * Math.PI) / 180) * 111320, (lat - lat1) * KY];
}

/** Harbours whose approaches contain this point. */
export function harboursNear(x: number, y: number): typeof MOTOR_HARBOURS {
  return MOTOR_HARBOURS.filter((m) => x >= m.box[0] && x <= m.box[2] && y >= m.box[1] && y <= m.box[3]);
}
