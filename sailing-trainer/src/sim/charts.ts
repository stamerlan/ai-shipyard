// Fictional training charts (like the RYA "training charts": invented waters made to practise on).
// Not for navigation — every name, depth and mark here is made up.

import type { Buoy, Pt, World } from './world';

/** «Песчаная бухта»: shoals with cardinal marks, an isolated danger, a buoyed shipping channel with
 *  cargo ships, an anchorage, a prohibited firing range and a swimming area by the beach. */
export function createBayWorld(): World {
  const south: Pt[] = [
    [-1600, -1600], [1600, -1600], [1600, -470], [700, -470], [560, -430], [420, -455], [200, -470], [100, -455],
    [-100, -455], [-200, -470], [-420, -460], [-560, -520], [-700, -470], [-1600, -470],
  ];
  const west: Pt[] = [[-1600, -480], [-760, -480], [-700, -300], [-740, 0], [-700, 300], [-760, 700], [-1600, 700]];
  const island: Pt[] = [[430, 380], [500, 360], [560, 400], [570, 460], [520, 500], [450, 490], [410, 440]];
  const buoys: Buoy[] = [];
  // Shipping channel along y = 150, direction of buoyage west → east: red marks to port (north side).
  for (let x = -600; x <= 600; x += 200) {
    buoys.push({ x, y: 195, kind: 'port', light: { char: 'Fl R 4s', color: 'red' } });
    buoys.push({ x, y: 105, kind: 'starboard', light: { char: 'Fl G 4s', color: 'green' } });
  }
  // Shoal A with all four cardinal marks.
  const a = { x: -260, y: -210, r: 45 };
  buoys.push(
    { x: a.x, y: a.y + 62, kind: 'north', light: { char: 'Q', color: 'white' } },
    { x: a.x + 62, y: a.y, kind: 'east', light: { char: 'Q(3) 10s', color: 'white' } },
    { x: a.x, y: a.y - 62, kind: 'south', light: { char: 'Q(6)+LFl 15s', color: 'white' } },
    { x: a.x - 62, y: a.y, kind: 'west', light: { char: 'Q(9) 15s', color: 'white' } },
  );
  // Shoal B: pass to the north of it.
  const b = { x: 150, y: -60, r: 32 };
  buoys.push({ x: b.x, y: b.y + 46, kind: 'north', light: { char: 'VQ', color: 'white' } });
  // Isolated danger: a rock with navigable water all round.
  const rock = { x: -20, y: -130, r: 7 };
  buoys.push({ x: rock.x, y: rock.y, kind: 'isolated', light: { char: 'Fl(2) 5s', color: 'white' } });
  // Firing range marked with yellow special marks.
  const range: Pt[] = [[300, -120], [620, -120], [620, -420], [300, -400]];
  for (const [x, y] of range) buoys.push({ x, y, kind: 'special', light: { char: 'Fl Y 5s', color: 'yellow' } });
  // Swimming area off the beach.
  const swim: Pt[] = [[-120, -452], [-120, -400], [90, -400], [90, -452]];
  for (const [x, y] of [[-120, -400], [90, -400]] as Pt[]) buoys.push({ x, y, kind: 'special', light: { char: 'Fl Y 5s', color: 'yellow' } });
  // Safe water mark at the western entrance of the channel.
  buoys.push({ x: -660, y: 150, kind: 'safe', light: { char: 'LFl 10s', color: 'white' } });
  const anchorage: Pt[] = [[-560, 260], [-160, 260], [-160, 560], [-560, 560]];
  return {
    nameRu: 'Учебная карта «Песчаная бухта»',
    land: [south, west, island],
    shoals: [a, b, rock],
    pontoons: [],
    buoys,
    lighthouses: [{ x: 500, y: 430, light: { char: 'Fl(3) 15s', color: 'white' }, range: 1500, name: 'Маяк' }],
    gates: [],
    berth: { x: 99999, y: 99999 },
    bounds: { minX: -780, maxX: 700, minY: -500, maxY: 620 },
    zones: [
      { kind: 'prohibited', poly: range, name: 'Полигон — плавание запрещено' },
      { kind: 'swim', poly: swim, name: 'Зона купания' },
      { kind: 'anchorage', poly: anchorage, name: 'Якорная стоянка' },
    ],
    mooredShips: [
      { x: -460, y: 360, heading: 0, halfL: 40, halfB: 7 },
      { x: -300, y: 470, heading: 0, halfL: 55, halfB: 9 },
      { x: -240, y: 330, heading: 0, halfL: 35, halfB: 6 },
    ],
    shipLanes: [
      // Ships keep to the starboard side of the channel.
      { pts: [[-1100, 130], [1100, 130]] },
      { pts: [[1100, 170], [-1100, 170]] },
    ],
    laneShips: 2,
    labels: [
      { x: 0, y: 225, text: 'Судоходный фарватер' },
      { x: -360, y: 590, text: 'Якорная стоянка' },
      { x: 460, y: -270, text: 'Полигон' },
      { x: -15, y: -440, text: 'Пляж' },
      { x: 495, y: 520, text: 'о. Маячный' },
    ],
  };
}
