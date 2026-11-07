// Right-of-way scenarios for small sailing craft (COLREG/МППСС and inland CEVNI rules).

export type VesselType = 'sail' | 'motor' | 'rowing' | 'ship';
export type Context = 'colreg' | 'inland';

export interface Vessel {
  x: number;
  y: number;
  /** Compass heading, rad. */
  heading: number;
  type: VesselType;
  speed: number;
}

export interface Scenario {
  kind: string;
  own: Vessel;
  other: Vessel;
  windFrom: number;
  context: Context;
}

export interface Verdict {
  giveWay: 'own' | 'other';
  ruleRu: string;
  ruleEn: string;
  whyRu: string;
}

const D = Math.PI / 180;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export const VESSEL_RU: Record<VesselType, string> = {
  sail: 'парусная лодка',
  motor: 'моторная лодка',
  rowing: 'гребная лодка',
  ship: 'большое судно на фарватере',
};

export function tackOf(v: Vessel, windFrom: number): 'starboard' | 'port' {
  return wrap(windFrom - v.heading) >= 0 ? 'starboard' : 'port';
}

export const TACK_RU = { starboard: 'правый галс', port: 'левый галс' } as const;
const TACK_INSTR = { starboard: 'правым галсом', port: 'левым галсом' } as const;

/** Is `a` overtaking `b`? (coming up from more than 22.5° abaft b's beam, and faster on a similar course) */
export function isOvertaking(a: Vessel, b: Vessel): boolean {
  const bearingFromB = Math.atan2(a.x - b.x, a.y - b.y); // compass bearing of a seen from b
  const rel = Math.abs(wrap(bearingFromB - b.heading));
  const sameWay = Math.abs(wrap(a.heading - b.heading)) < 67.5 * D;
  return rel > 112.5 * D && sameWay && a.speed > b.speed;
}

/** Height of `v` up the wind (bigger = more to windward). */
function upwind(v: Vessel, windFrom: number): number {
  return v.x * Math.sin(windFrom) + v.y * Math.cos(windFrom);
}

export function judge(sc: Scenario): Verdict {
  const { own, other, windFrom } = sc;
  if (isOvertaking(own, other)) {
    return { giveWay: 'own', ruleRu: 'МППСС, правило 13 — обгон', ruleEn: 'COLREG rule 13 — overtaking',
      whyRu: 'Вы догоняете другое судно сзади: обгоняющее судно уступает дорогу обгоняемому — независимо от того, парусное оно или моторное.' };
  }
  if (isOvertaking(other, own)) {
    return { giveWay: 'other', ruleRu: 'МППСС, правило 13 — обгон', ruleEn: 'COLREG rule 13 — overtaking',
      whyRu: 'Другое судно догоняет вас сзади: обгоняющий уступает дорогу. Вы сохраняете курс и скорость.' };
  }
  if (other.type === 'ship') {
    return { giveWay: 'own', ruleRu: 'CEVNI 6.02 / МППСС, правило 9 — малые суда и узкости', ruleEn: 'CEVNI 6.02 / COLREG rule 9 — small craft & narrow channels',
      whyRu: 'Малые суда уступают дорогу большим судам; в узкости парусное судно не должно мешать судну, которое может идти только по фарватеру.' };
  }
  if (other.type === 'motor') {
    return { giveWay: 'other', ruleRu: 'МППСС, правило 18; CEVNI 6.02', ruleEn: 'COLREG rule 18; CEVNI 6.02',
      whyRu: 'Моторная лодка уступает дорогу парусной (если не обгоняет её и не идёт по узкому фарватеру, где стеснена).' };
  }
  if (other.type === 'rowing') {
    return { giveWay: 'other', ruleRu: 'CEVNI 6.02 — внутренние воды', ruleEn: 'CEVNI 6.02 — inland waters',
      whyRu: 'На внутренних водах малые суда не под мотором и не под парусом (гребные) уступают дорогу малым парусным.' };
  }
  const ot = tackOf(own, windFrom), tt = tackOf(other, windFrom);
  if (ot !== tt) {
    const ownGives = ot === 'port';
    return { giveWay: ownGives ? 'own' : 'other', ruleRu: 'МППСС, правило 12(a)(i) — разные галсы', ruleEn: 'COLREG rule 12(a)(i) — opposite tacks',
      whyRu: `Вы идёте ${TACK_INSTR[ot]}, другая лодка — ${TACK_INSTR[tt]}. На разных галсах уступает судно левого галса.` };
  }
  const ownWindward = upwind(own, windFrom) > upwind(other, windFrom);
  return { giveWay: ownWindward ? 'own' : 'other', ruleRu: 'МППСС, правило 12(a)(ii) — один галс', ruleEn: 'COLREG rule 12(a)(ii) — same tack',
    whyRu: `Обе лодки идут ${TACK_INSTR[ot]}. На одном галсе наветренное судно уступает подветренному — ${ownWindward ? 'вы на ветре' : 'вы под ветром'}.` };
}

function rand(a: number, b: number, rnd: () => number) {
  return a + (b - a) * rnd();
}

const fwd = (h: number) => [Math.sin(h), Math.cos(h)] as const;

/** Generate a random but unambiguous scenario. */
export function generate(rnd: () => number = Math.random): Scenario {
  for (let attempt = 0; attempt < 200; attempt++) {
    const windFrom = rand(0, 2 * Math.PI, rnd);
    const side = rnd() < 0.5 ? 1 : -1;
    const ownTwa = rand(50, 150, rnd) * D;
    const ownHeading = windFrom - side * ownTwa;
    const own: Vessel = { x: 0, y: 0, heading: ownHeading, type: 'sail', speed: 2 };
    const kinds = ['cross', 'cross', 'same', 'same', 'overtakeByOther', 'overtakeOwn', 'motor', 'rowing', 'ship'];
    const kind = kinds[Math.floor(rnd() * kinds.length)];
    const [fx, fy] = fwd(ownHeading);
    const dist = 60;
    const cx = fx * dist, cy = fy * dist;
    let other: Vessel;
    let context: Context = 'colreg';

    if (kind === 'overtakeByOther' || kind === 'overtakeOwn') {
      const h = ownHeading + rand(-8, 8, rnd) * D;
      const off = rand(4, 8, rnd) * (rnd() < 0.5 ? 1 : -1);
      const ahead = kind === 'overtakeOwn' ? 30 : -30;
      other = { x: fx * ahead + fy * off, y: fy * ahead - fx * off, heading: h, type: rnd() < 0.5 ? 'sail' : 'motor', speed: kind === 'overtakeOwn' ? 1.2 : 3.5 };
      if (other.type === 'motor' && kind === 'overtakeOwn') other.type = 'rowing';
      if (other.type === 'rowing') context = 'inland';
    } else {
      let h: number;
      let type: VesselType = 'sail';
      if (kind === 'cross' || kind === 'same') {
        const oside = kind === 'cross' ? -side : side;
        const twa = rand(50, 150, rnd) * D;
        h = windFrom - oside * twa;
      } else {
        h = rand(0, 2 * Math.PI, rnd);
        type = kind as VesselType;
        if (type !== 'motor') context = 'inland';
      }
      const diff = Math.abs(wrap(h - ownHeading));
      if (diff < 35 * D || diff > 160 * D) continue; // need a clear crossing, avoid head-on ambiguity
      const sp = type === 'ship' ? 3 : type === 'motor' ? 3.5 : type === 'rowing' ? 1.2 : 2;
      const [ox, oy] = fwd(h);
      const d2 = dist * (sp / own.speed);
      other = { x: cx - ox * d2, y: cy - oy * d2, heading: h, type, speed: sp };
      if (type === 'ship') { other.x = cx - ox * 70; other.y = cy - oy * 70; }
    }
    const sc: Scenario = { kind, own, other, windFrom, context };
    if (other.type === 'sail' && Math.abs(Math.abs(wrap(windFrom - other.heading)) - Math.PI) < 20 * D) continue;
    if (kind === 'same' && Math.abs(upwind(own, windFrom) - upwind(other, windFrom)) < 10) continue;
    if ((kind === 'overtakeByOther' && !isOvertaking(other, own)) || (kind === 'overtakeOwn' && !isOvertaking(own, other))) continue;
    if (kind !== 'overtakeByOther' && kind !== 'overtakeOwn' && (isOvertaking(own, other) || isOvertaking(other, own))) continue;
    return sc;
  }
  // Fallback: classic port/starboard crossing.
  return {
    kind: 'cross', windFrom: 0, context: 'colreg',
    own: { x: 0, y: 0, heading: -60 * D, type: 'sail', speed: 2 },
    other: { x: -60, y: 40, heading: 60 * D, type: 'sail', speed: 2 },
  };
}

export function questionRu(sc: Scenario): string {
  const what = VESSEL_RU[sc.other.type];
  const where = sc.context === 'inland' ? ' (внутренние воды)' : '';
  return `Вы — синяя лодка под парусом. Навстречу — ${what}${where}. Кто должен уступить дорогу?`;
}
