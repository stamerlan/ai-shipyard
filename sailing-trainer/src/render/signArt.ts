// SVG artwork for buoys, inland waterway signs and flags.
// The pictures are simplified teaching illustrations, not official drawings.

let uid = 0;
const nextId = () => `s${++uid}`;

export const C = {
  red: '#d7262e',
  green: '#1f9a48',
  yellow: '#f6c718',
  black: '#1b1b1b',
  white: '#ffffff',
  blue: '#1d5fb4',
  water: '#7fb6dd',
};

const svg = (vb: string, body: string) =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" role="img">${body}</svg>`;

const water = `<path d="M0 112 q12 -6 25 0 t25 0 t25 0 t25 0 V130 H0Z" fill="${C.water}"/>`;

// ---------- Buoys ----------

type Topmark = 'can' | 'cone' | 'cones-up' | 'cones-down' | 'cones-apart' | 'cones-together' | 'two-spheres' | 'sphere' | 'x' | 'cross' | 'none';

function topmarkSvg(t: Topmark, color: string): string {
  const pole = `<line x1="50" y1="46" x2="50" y2="14" stroke="${C.black}" stroke-width="2.5"/>`;
  const up = (y: number) => `<polygon points="40,${y + 12} 60,${y + 12} 50,${y}" fill="${color}"/>`;
  const down = (y: number) => `<polygon points="40,${y} 60,${y} 50,${y + 12}" fill="${color}"/>`;
  switch (t) {
    case 'none': return '';
    case 'can': return pole + `<rect x="41" y="10" width="18" height="18" fill="${color}" stroke="${C.black}" stroke-width="1"/>`;
    case 'cone': return pole + `<polygon points="39,30 61,30 50,8" fill="${color}" stroke="${C.black}" stroke-width="1"/>`;
    case 'cones-up': return pole + up(4) + up(22);
    case 'cones-down': return pole + down(4) + down(22);
    case 'cones-apart': return pole + up(4) + down(20); // East: base to base
    case 'cones-together': return pole + down(4) + up(20); // West: point to point
    case 'two-spheres': return pole + `<circle cx="50" cy="12" r="7" fill="${color}"/><circle cx="50" cy="29" r="7" fill="${color}"/>`;
    case 'sphere': return pole + `<circle cx="50" cy="18" r="9" fill="${color}"/>`;
    case 'x': return pole + `<g stroke="${color}" stroke-width="5" stroke-linecap="round"><line x1="41" y1="9" x2="59" y2="27"/><line x1="59" y1="9" x2="41" y2="27"/></g>`;
    case 'cross': return pole + `<g stroke="${color}" stroke-width="5" stroke-linecap="round"><line x1="50" y1="6" x2="50" y2="30"/><line x1="40" y1="18" x2="60" y2="18"/></g>`;
  }
}

type Band = { color: string; from: number; to: number }; // fractions of body height, 0 = top

function pillarBuoy(bands: Band[], topmark: Topmark, topColor: string, stripes?: [string, string]): string {
  const id = nextId();
  const body = 'M36 46 L64 46 L72 108 L28 108 Z';
  let fill = '';
  if (stripes) {
    for (let i = 0; i < 8; i++) {
      fill += `<rect x="${24 + i * 7}" y="46" width="7" height="62" fill="${i % 2 ? stripes[1] : stripes[0]}"/>`;
    }
  } else {
    for (const b of bands) {
      fill += `<rect x="20" y="${46 + b.from * 62}" width="60" height="${(b.to - b.from) * 62 + 0.5}" fill="${b.color}"/>`;
    }
  }
  return svg('0 0 100 130',
    `<defs><clipPath id="${id}"><path d="${body}"/></clipPath></defs>` +
    topmarkSvg(topmark, topColor) +
    `<g clip-path="url(#${id})">${fill}</g><path d="${body}" fill="none" stroke="${C.black}" stroke-width="1.5"/>` +
    water);
}

function canBuoy(color: string, band?: string): string {
  return svg('0 0 100 130',
    topmarkSvg('can', color) +
    `<rect x="30" y="46" width="40" height="62" fill="${color}" stroke="${C.black}" stroke-width="1.5"/>` +
    (band ? `<rect x="30" y="68" width="40" height="16" fill="${band}"/>` : '') +
    water);
}

function coneBuoy(color: string, band?: string): string {
  const id = nextId();
  const body = 'M50 40 L74 108 L26 108 Z';
  return svg('0 0 100 130',
    `<defs><clipPath id="${id}"><path d="${body}"/></clipPath></defs>` +
    `<line x1="50" y1="40" x2="50" y2="34" stroke="${C.black}" stroke-width="2.5"/>` +
    `<polygon points="39,34 61,34 50,12" fill="${color}" stroke="${C.black}" stroke-width="1"/>` +
    `<path d="${body}" fill="${color}"/>` +
    (band ? `<g clip-path="url(#${id})"><rect x="20" y="72" width="60" height="16" fill="${band}"/></g>` : '') +
    `<path d="${body}" fill="none" stroke="${C.black}" stroke-width="1.5"/>` +
    water);
}

export const buoy = {
  portLateral: () => canBuoy(C.red),
  starboardLateral: () => coneBuoy(C.green),
  preferredStarboard: () => canBuoy(C.red, C.green),
  preferredPort: () => coneBuoy(C.green, C.red),
  north: () => pillarBuoy([{ color: C.black, from: 0, to: 0.5 }, { color: C.yellow, from: 0.5, to: 1 }], 'cones-up', C.black),
  east: () => pillarBuoy([{ color: C.black, from: 0, to: 0.33 }, { color: C.yellow, from: 0.33, to: 0.67 }, { color: C.black, from: 0.67, to: 1 }], 'cones-apart', C.black),
  south: () => pillarBuoy([{ color: C.yellow, from: 0, to: 0.5 }, { color: C.black, from: 0.5, to: 1 }], 'cones-down', C.black),
  west: () => pillarBuoy([{ color: C.yellow, from: 0, to: 0.33 }, { color: C.black, from: 0.33, to: 0.67 }, { color: C.yellow, from: 0.67, to: 1 }], 'cones-together', C.black),
  isolatedDanger: () => pillarBuoy([{ color: C.black, from: 0, to: 1 }, { color: C.red, from: 0.36, to: 0.64 }], 'two-spheres', C.black),
  safeWater: () => pillarBuoy([], 'sphere', C.red, [C.red, C.white]),
  special: () => pillarBuoy([{ color: C.yellow, from: 0, to: 1 }], 'x', C.yellow),
  wreck: () => pillarBuoy([], 'cross', C.yellow, [C.blue, C.yellow]),
};

// ---------- Inland waterway signs (CEVNI) ----------

const ICONS = {
  anchor: `<g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><circle cx="50" cy="25" r="6"/><line x1="50" y1="31" x2="50" y2="76"/><line x1="37" y1="40" x2="63" y2="40"/><path d="M26 58 Q30 78 50 78 Q70 78 74 58"/></g><polygon points="22,62 30,52 33,64" fill="currentColor"/><polygon points="78,62 70,52 67,64" fill="currentColor"/>`,
  P: `<text x="50" y="72" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="58" fill="currentColor">P</text>`,
  bollard: `<g fill="currentColor"><rect x="38" y="40" width="24" height="38"/><rect x="31" y="30" width="38" height="12" rx="4"/><rect x="26" y="78" width="48" height="6"/></g>`,
  sail: `<g fill="currentColor"><polygon points="52,16 52,66 76,66"/><polygon points="48,24 48,66 28,66"/><path d="M20 72 H80 L72 82 H28 Z"/></g>`,
  motor: `<g fill="currentColor"><path d="M14 60 H80 L72 74 H22 Z"/><rect x="40" y="46" width="22" height="14"/><rect x="80" y="56" width="6" height="22"/></g>`,
  rowing: `<g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><line x1="22" y1="40" x2="78" y2="80"/><line x1="78" y1="40" x2="22" y2="80"/></g><path d="M18 58 H82 L74 68 H26 Z" fill="currentColor"/><circle cx="50" cy="46" r="7" fill="currentColor"/>`,
  waves: `<g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M18 42 q8 -8 16 0 t16 0 t16 0 t16 0"/><path d="M18 60 q8 -8 16 0 t16 0 t16 0 t16 0"/></g>`,
  skier: `<g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><circle cx="56" cy="24" r="5" fill="currentColor"/><path d="M56 30 L50 52 L60 66"/><path d="M50 52 L40 64"/><path d="M53 38 L30 30"/><line x1="26" y1="72" x2="74" y2="72"/></g><path d="M14 82 q9 -6 18 0 t18 0 t18 0 t18 0" fill="none" stroke="currentColor" stroke-width="3"/>`,
  sailboard: `<g fill="currentColor"><polygon points="50,14 50,66 74,60"/><rect x="48" y="14" width="3" height="56"/><path d="M22 72 H80 Q76 80 68 80 H26 Z"/></g>`,
  twoBoats: `<g fill="currentColor"><path d="M34 20 Q42 34 42 50 V82 H26 V50 Q26 34 34 20 Z"/><path d="M66 20 Q74 34 74 50 V82 H58 V50 Q58 34 66 20 Z"/></g>`,
  uturn: `<g fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"><path d="M34 80 V42 A16 16 0 0 1 66 42 V62"/></g><polygon points="56,58 76,58 66,76" fill="currentColor"/>`,
  arrowRight: `<path d="M50 84 V44 A10 10 0 0 1 60 34 H66" fill="none" stroke="currentColor" stroke-width="8"/><polygon points="62,20 84,34 62,48" fill="currentColor"/>`,
  cable: `<path d="M8 26 Q50 44 92 26" fill="none" stroke="currentColor" stroke-width="3"/><polygon points="56,36 38,62 50,62 42,84 64,54 52,54 60,36" fill="currentColor"/>`,
};

type Icon = keyof typeof ICONS;

function prohibition(icon: Icon | null, extra = ''): string {
  return svg('0 0 100 100',
    `<rect x="4" y="4" width="92" height="92" fill="${C.white}" stroke="${C.red}" stroke-width="8"/>` +
    (icon ? `<g color="${C.black}">${ICONS[icon]}</g>` : '') + extra +
    `<line x1="10" y1="10" x2="90" y2="90" stroke="${C.red}" stroke-width="9"/>`);
}

function mandatory(inner: string): string {
  return svg('0 0 100 100',
    `<rect x="4" y="4" width="92" height="92" fill="${C.white}" stroke="${C.red}" stroke-width="8"/>` +
    `<g color="${C.black}">${inner}</g>`);
}

function info(inner: string): string {
  return svg('0 0 100 100',
    `<rect x="2" y="2" width="96" height="96" fill="${C.blue}" stroke="${C.white}" stroke-width="3"/>` +
    `<g color="${C.white}">${inner}</g>`);
}

const text = (s: string, size = 34, y = 62) =>
  `<text x="50" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${size}" fill="currentColor">${s}</text>`;

export const inland = {
  noPassage: () => svg('0 0 100 100', `<rect x="4" y="18" width="92" height="64" fill="${C.red}"/><rect x="4" y="42" width="92" height="16" fill="${C.white}"/>`),
  noOvertaking: () => prohibition('twoBoats'),
  noBerthing: () => prohibition('P'),
  noAnchoring: () => prohibition('anchor'),
  noMakingFast: () => prohibition('bollard'),
  noTurning: () => prohibition('uturn'),
  noWash: () => prohibition('waves'),
  noMotor: () => prohibition('motor'),
  noSailing: () => prohibition('sail'),
  noRowing: () => prohibition('rowing'),
  noSkiing: () => prohibition('skier'),
  noSailboards: () => prohibition('sailboard'),
  followArrow: () => mandatory(ICONS.arrowRight),
  speedLimit: () => mandatory(text('12', 44, 66)),
  vhf: () => mandatory(text('VHF', 26, 50) + text('10', 30, 80)),
  depthLimit: () => mandatory(text('2,20', 28, 46) + `<g stroke="currentColor" stroke-width="4"><line x1="50" y1="54" x2="50" y2="82"/><line x1="30" y1="86" x2="70" y2="86"/></g><polygon points="42,72 58,72 50,84" fill="currentColor"/>`),
  headroomLimit: () => mandatory(`<g stroke="currentColor" stroke-width="4"><line x1="30" y1="14" x2="70" y2="14"/><line x1="50" y1="18" x2="50" y2="46"/></g><polygon points="42,28 58,28 50,16" fill="currentColor"/>` + text('4,50', 28, 76)),
  recommendedBoth: () => svg('0 0 100 100', `<path d="M4 96 V40 Q50 4 96 40 V96 H80 V52 Q50 28 20 52 V96 Z" fill="#9aa4ad"/><rect x="38" y="20" width="24" height="24" transform="rotate(45 50 32)" fill="${C.yellow}" stroke="${C.black}" stroke-width="1"/>`),
  recommendedOneWay: () => svg('0 0 100 100', `<path d="M4 96 V40 Q50 4 96 40 V96 H80 V52 Q50 28 20 52 V96 Z" fill="#9aa4ad"/><rect x="28" y="20" width="20" height="20" fill="${C.yellow}" stroke="${C.black}" stroke-width="1"/><rect x="52" y="20" width="20" height="20" fill="${C.yellow}" stroke="${C.black}" stroke-width="1"/>`),
  overheadCable: () => info(ICONS.cable),
  berthingAllowed: () => info(ICONS.P),
  anchoringAllowed: () => info(ICONS.anchor),
  makingFastAllowed: () => info(ICONS.bollard),
  motorAllowed: () => info(ICONS.motor),
  sailingAllowed: () => info(ICONS.sail),
  sailboardsAllowed: () => info(ICONS.sailboard),
};

// ---------- Flags (International Code of Signals) ----------

const flag = (body: string) => svg('0 0 120 84', `<line x1="4" y1="2" x2="4" y2="84" stroke="#555" stroke-width="3"/>${body}`);
const tail = 'M6 4 H116 L92 42 L116 80 H6 Z';

export const flags = {
  A: () => flag(`<rect x="6" y="4" width="55" height="76" fill="${C.white}" stroke="#999"/><path d="M61 4 H116 L92 42 L116 80 H61 Z" fill="${C.blue}"/>`),
  B: () => flag(`<path d="${tail}" fill="${C.red}"/>`),
  C: () => flag([C.blue, C.white, C.red, C.white, C.blue].map((c, i) => `<rect x="6" y="${4 + i * 15.2}" width="110" height="15.4" fill="${c}"/>`).join('')),
  N: () => {
    let s = '';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) s += `<rect x="${6 + c * 27.5}" y="${4 + r * 19}" width="27.6" height="19.1" fill="${(r + c) % 2 ? C.white : C.blue}"/>`;
    return flag(s + `<rect x="6" y="4" width="110" height="76" fill="none" stroke="#999"/>`);
  },
  O: () => flag(`<polygon points="6,4 116,4 116,80" fill="${C.red}"/><polygon points="6,4 116,80 6,80" fill="${C.yellow}"/>`),
  V: () => flag(`<rect x="6" y="4" width="110" height="76" fill="${C.white}" stroke="#999"/><g stroke="${C.red}" stroke-width="14"><line x1="6" y1="4" x2="116" y2="80"/><line x1="116" y1="4" x2="6" y2="80"/></g>`),
  W: () => flag(`<rect x="6" y="4" width="110" height="76" fill="${C.blue}"/><rect x="24" y="17" width="74" height="50" fill="${C.white}"/><rect x="42" y="30" width="38" height="24" fill="${C.red}"/>`),
  NC: () => svg('0 0 120 170',
    `<line x1="4" y1="2" x2="4" y2="168" stroke="#555" stroke-width="3"/>` +
    Array.from({ length: 16 }, (_, k) => { const r = Math.floor(k / 4), c = k % 4; return `<rect x="${6 + c * 27.5}" y="${4 + r * 19}" width="27.6" height="19.1" fill="${(r + c) % 2 ? C.white : C.blue}"/>`; }).join('') +
    [C.blue, C.white, C.red, C.white, C.blue].map((c, i) => `<rect x="6" y="${88 + i * 15.2}" width="110" height="15.4" fill="${c}"/>`).join('')),
};

// ---------- Sound signals ----------

/** Pattern letters: S = short (~1 s), L = prolonged (4–6 s), v = very short series. */
export function soundArt(pattern: string, repeat?: string): string {
  let x = 6;
  let body = '';
  for (const ch of pattern) {
    if (ch === 'S') { body += `<rect x="${x}" y="26" width="14" height="14" rx="7" fill="#123"/>`; x += 22; }
    else if (ch === 'L') { body += `<rect x="${x}" y="26" width="52" height="14" rx="7" fill="#123"/>`; x += 60; }
    else if (ch === 'v') { body += `<rect x="${x}" y="29" width="7" height="8" rx="3" fill="#123"/>`; x += 11; }
    else if (ch === ' ') x += 14;
  }
  const w = Math.max(x + 4, 60);
  const rep = repeat ? `<text x="${w / 2}" y="60" text-anchor="middle" font-size="12" fill="#345" font-family="Arial, sans-serif">${repeat}</text>` : '';
  return svg(`0 0 ${w} 66`, `<path d="M0 33 H${w}" stroke="#cdd" stroke-width="1"/>${body}${rep}`);
}
