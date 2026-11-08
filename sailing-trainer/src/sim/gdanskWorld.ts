// The Gdańsk sailing area from real map data: Gulf of Gdańsk, the port entrance at Nowy Port and
// Westerplatte, Port Północny, Martwa Wisła down to Marina Gdańsk and east to Górki Zachodnie / NCŻ.

import { WaterIndex, type World } from './world';
import { GDANSK_REGION } from './maps/gdanskRegion';

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
  ['marina', 'Марина Гданьск (Мотлава)', -60, 60],
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
  };
  return cached;
}
