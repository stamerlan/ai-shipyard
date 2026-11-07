import type { Scenario, Vessel } from './rightOfWay';

const D = Math.PI / 180;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Top-down picture of a right-of-way scenario. */
export function scenarioSvg(sc: Scenario): string {
  const pts = [sc.own, sc.other];
  // Course lines extend well past the point where the courses cross.
  const LINE = 90;
  const ext = pts.flatMap((v) => [[v.x, v.y], [v.x + Math.sin(v.heading) * LINE, v.y + Math.cos(v.heading) * LINE]]);
  const xs = ext.map((p) => p[0]), ys = ext.map((p) => p[1]);
  const mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 60);
  const k = 290 / span;
  const tx = (x: number) => 200 + (x - mx) * k;
  const ty = (y: number) => 200 - (y - my) * k;

  let body = `<rect width="400" height="400" fill="#2f7fb5"/>`;
  // light wave pattern
  for (let i = 0; i < 14; i++) for (let j = 0; j < 14; j++) {
    body += `<circle cx="${i * 30 + (j % 2) * 15 + 5}" cy="${j * 30 + 5}" r="1.2" fill="rgba(255,255,255,0.18)"/>`;
  }
  if (sc.other.type === 'ship') body += fairway(sc.other, tx, ty);

  // course lines
  for (const v of pts) {
    const x2 = v.x + Math.sin(v.heading) * LINE, y2 = v.y + Math.cos(v.heading) * LINE;
    body += `<line x1="${tx(v.x)}" y1="${ty(v.y)}" x2="${tx(x2)}" y2="${ty(y2)}" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" stroke-dasharray="5 5"/>`;
  }
  body += vessel(sc.other, sc.windFrom, tx(sc.other.x), ty(sc.other.y), '#d8343a', 'Б');
  body += vessel(sc.own, sc.windFrom, tx(sc.own.x), ty(sc.own.y), '#1f5fd1', 'Вы');
  body += windRose(sc.windFrom);
  return `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Схема расхождения">${body}</svg>`;
}

function windRose(from: number): string {
  // Arrow pointing where the wind goes, placed in the top-left corner.
  const deg = from / D; // arrow is drawn pointing down (wind from north)
  return `<g transform="translate(46 40)">
    <circle r="34" fill="rgba(255,255,255,0.88)"/>
    <g transform="rotate(${deg})"><line x1="0" y1="-22" x2="0" y2="18" stroke="#123" stroke-width="4"/><polygon points="-9,12 9,12 0,26" fill="#123"/></g>
    <text y="50" text-anchor="middle" font-size="13" font-weight="700" fill="#fff" stroke="#123" stroke-width="3" paint-order="stroke" font-family="system-ui, sans-serif">ВЕТЕР</text>
  </g>`;
}

function vessel(v: Vessel, windFrom: number, x: number, y: number, color: string, label: string): string {
  const deg = v.heading / D;
  let inner = '';
  if (v.type === 'ship') {
    inner = `<path d="M0 -38 Q9 -26 9 -10 V34 H-9 V-10 Q-9 -26 0 -38Z" fill="#6b7680" stroke="#222" stroke-width="1.2"/><rect x="-6" y="18" width="12" height="10" fill="#eee"/>`;
  } else {
    const hull = `<path d="M0 -15 Q7 -6 6 6 L5 13 H-5 L-6 6 Q-7 -6 0 -15Z" fill="${color}" stroke="#111" stroke-width="1"/>`;
    inner = hull;
    if (v.type === 'sail') {
      const twa = wrap(windFrom - v.heading); // + = wind from starboard
      const boomSide = twa >= 0 ? -1 : 1;
      const ang = Math.min(Math.abs(twa) / D * 0.55, 80) * D;
      const bx = boomSide * Math.sin(ang) * 15, by = -6 + Math.cos(ang) * 15;
      const nx = boomSide * Math.cos(ang) * 4, ny = -Math.sin(ang) * 4;
      inner += `<path d="M0 -6 Q${bx / 2 + nx} ${(-6 + by) / 2 + ny} ${bx} ${by} Z" fill="#fff" stroke="#333" stroke-width="0.8"/>`;
      inner += `<line x1="0" y1="-6" x2="${bx}" y2="${by}" stroke="#333" stroke-width="1.6"/><circle cx="0" cy="-6" r="1.8" fill="#222"/>`;
    } else if (v.type === 'motor') {
      inner += `<rect x="-3.5" y="-4" width="7" height="7" fill="#eee" stroke="#333" stroke-width="0.6"/>`;
      inner += `<path d="M-5 14 L-14 34 M5 14 L14 34" stroke="rgba(255,255,255,0.8)" stroke-width="1.5"/>`;
    } else if (v.type === 'rowing') {
      inner += `<line x1="-16" y1="4" x2="16" y2="-2" stroke="#7a4a1e" stroke-width="1.8"/><line x1="-16" y1="-2" x2="16" y2="4" stroke="#7a4a1e" stroke-width="1.8"/><circle cx="0" cy="1" r="3" fill="#f2c6a0"/>`;
    }
  }
  return `<g transform="translate(${x} ${y})"><g transform="rotate(${deg})">${inner}</g>
    <text x="0" y="${v.type === 'ship' ? 52 : 30}" text-anchor="middle" font-size="13" font-weight="700" fill="#fff" stroke="#123" stroke-width="3" paint-order="stroke" font-family="system-ui, sans-serif">${label}</text></g>`;
}

function fairway(ship: Vessel, tx: (x: number) => number, ty: (y: number) => number): string {
  let s = '';
  const [fx, fy] = [Math.sin(ship.heading), Math.cos(ship.heading)];
  const [px, py] = [fy, -fx]; // starboard of the ship
  for (let i = -6; i <= 8; i++) {
    const along = i * 20;
    for (const side of [-1, 1]) {
      const x = ship.x + fx * along + px * side * 16, y = ship.y + fy * along + py * side * 16;
      s += `<circle cx="${tx(x)}" cy="${ty(y)}" r="3.5" fill="${side > 0 ? '#1f9a48' : '#d7262e'}" stroke="#111" stroke-width="0.6"/>`;
    }
  }
  return s;
}
