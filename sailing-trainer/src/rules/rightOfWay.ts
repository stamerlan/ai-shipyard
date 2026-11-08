// Right-of-way scenarios for small sailing craft (COLREG/МППСС and inland CEVNI rules).

export type VesselType = 'sail' | 'motor' | 'rowing' | 'ship' | 'fishing' | 'ram' | 'motorsail';
/** colreg = open water; channel = narrow channel / traffic separation scheme; inland = CEVNI waters. */
export type Context = 'colreg' | 'channel' | 'inland';

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
  /** Multiple-choice question instead of "who gives way" (e.g. rule 17). */
  choices?: { ru: string; correct: boolean }[];
  questionRu?: string;
  whyRu?: string;
  ruleRu?: string;
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
  ship: 'большое судно с механическим двигателем',
  fishing: 'судно, занятое ловом рыбы (знак: два конуса вершинами вместе)',
  ram: 'судно, ограниченное в возможности маневрировать (знак: шар — ромб — шар)',
  motorsail: 'парусная яхта, идущая под мотором (знак: конус вершиной вниз)',
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
  if (other.type === 'ship' && sc.context !== 'colreg') {
    return sc.context === 'channel'
      ? { giveWay: 'own', ruleRu: 'МППСС, правила 9(b) и 10(j) — узкость, система разделения движения', ruleEn: 'COLREG rules 9(b), 10(j) — narrow channel / TSS',
        whyRu: 'В узкости и в системе разделения движения парусное судно и судно длиной менее 20 м не должны мешать судну, которое может безопасно идти только по фарватеру.' }
      : { giveWay: 'own', ruleRu: 'CEVNI 6.02 — внутренние воды', ruleEn: 'CEVNI 6.02 — inland waters',
        whyRu: 'На внутренних водах малые суда уступают дорогу всем остальным судам, в том числе большим.' };
  }
  if (other.type === 'ship') {
    return { giveWay: 'other', ruleRu: 'МППСС, правило 18(a)', ruleEn: 'COLREG rule 18(a)',
      whyRu: 'В открытом море судно с механическим двигателем, даже большое, уступает дорогу парусному. Но большое судно маневрирует медленно и может вас не видеть: будьте готовы действовать сами (правило 17).' };
  }
  if (other.type === 'fishing') {
    return { giveWay: 'own', ruleRu: 'МППСС, правило 18(b)(iii)', ruleEn: 'COLREG rule 18(b)(iii)',
      whyRu: 'Парусное судно уступает дорогу судну, занятому ловом рыбы (тралом, сетями — не путать с рыбаком на удочке).' };
  }
  if (other.type === 'ram') {
    return { giveWay: 'own', ruleRu: 'МППСС, правило 18(b)(ii)', ruleEn: 'COLREG rule 18(b)(ii)',
      whyRu: 'Парусное судно уступает дорогу судну, ограниченному в возможности маневрировать (земснаряд, судно, ставящее буи, буксир с трудноуправляемым буксиром).' };
  }
  if (other.type === 'motorsail') {
    return { giveWay: 'other', ruleRu: 'МППСС, правила 3(c), 25(e) и 18', ruleEn: 'COLREG rules 3(c), 25(e), 18',
      whyRu: 'Парусная яхта под мотором (даже с поднятыми парусами) — это судно с механическим двигателем. Днём она несёт конус вершиной вниз и уступает дорогу судну под парусами.' };
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
    const kinds = ['cross', 'cross', 'same', 'same', 'overtakeByOther', 'overtakeOwn', 'motor', 'rowing', 'ship', 'shipOpen', 'fishing', 'ram', 'motorsail', 'standon'];
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
        type = kind === 'shipOpen' ? 'ship' : kind === 'standon' ? 'motor' : (kind as VesselType);
        if (kind === 'rowing') context = 'inland';
        if (kind === 'ship') context = rnd() < 0.5 ? 'channel' : 'inland';
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
    if (kind === 'standon') {
      sc.questionRu = 'Моторная лодка должна уступить вам дорогу, но курс не меняет, и расстояние быстро сокращается. Что делаете вы?';
      sc.ruleRu = 'МППСС, правила 17 и 34(d)';
      sc.whyRu = 'Привилегированное судно сначала сохраняет курс и скорость. Если ясно, что уступающее не маневрирует, подайте не менее пяти коротких сигналов и можете действовать сами; когда столкновения уже не избежать одним его манёвром — обязаны. Не отворачивайте влево к судну, которое у вас слева.';
      sc.choices = [
        { ru: 'Держу курс и скорость до последнего — я привилегирован.', correct: false },
        { ru: 'Подаю 5 коротких сигналов; если он не отворачивает — сам меняю курс, чтобы избежать столкновения.', correct: true },
        { ru: 'Сразу резко отворачиваю влево, ему навстречу.', correct: false },
      ];
    }
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
  if (sc.questionRu) return sc.questionRu;
  const what = VESSEL_RU[sc.other.type];
  const where = sc.context === 'inland' ? ' Внутренние воды.' : sc.context === 'channel' ? ' Узкий фарватер.' : sc.other.type === 'ship' ? ' Открытое море.' : '';
  const situation = sc.kind === 'overtakeByOther' ? `Вас догоняет сзади ${what}.`
    : sc.kind === 'overtakeOwn' ? `Вы догоняете ${what === 'гребная лодка' ? 'гребную лодку' : what === 'парусная лодка' ? 'парусную лодку' : what}.`
    : `Ваши курсы пересекаются: ${what}.`;
  return `Вы — синяя лодка под парусом. ${situation}${where} Кто должен уступить дорогу?`;
}
