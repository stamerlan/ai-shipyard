import { BOAT, DEG, pointOfSail, tackOf, type BoatState, type PointOfSail, type SimEvent, type Telemetry } from './physics';
import type { Mark } from './render';
import type { World } from './world';
import type { Traffic } from './traffic';

export interface MissionCtx {
  s: BoatState;
  t: Telemetry;
  time: number;
  dt: number;
  events: SimEvent[];
  marks: Mark[];
  counters: { tacks: number; gybes: number; crashGybes: number };
  world: World | null;
  traffic: Traffic | null;
  /** Mean wind direction ("from"), radians. */
  windFrom: number;
}

export interface MissionResult {
  won: boolean;
  textRu: string;
}

export interface MissionRuntime {
  marks: Mark[];
  objective: string;
  progress?: number; // 0..1
  /** Return a result to finish the mission. */
  update(ctx: MissionCtx): MissionResult | null;
}

export interface MissionDef {
  id: string;
  ru: string;
  en: string;
  descRu: string;
  /** Wind force on the Beaufort scale. */
  beaufort: number;
  gusts: number;
  shifts: number;
  start: { x: number; y: number; heading: number; speed: number; main: number };
  /** Coast, marina, marks and lighthouses. */
  world?: boolean;
  /** Fixed fictional training chart. */
  chart?: 'bay';
  /** Cargo ships on the fairways of the chart. */
  laneShips?: number;
  night?: boolean;
  /** Number of other vessels. */
  traffic?: number;
  /** Harbour manoeuvres under engine (separate simulator mode). */
  motor?: boolean;
  /** Geometry is drawn for wind from the north and is rotated to the chosen wind direction. */
  windRelative?: boolean;
  /** Task on the real Gdańsk chart (positions are fixed on the map). */
  realMap?: boolean;
  /** Default wind direction, degrees ("from"); north if omitted. */
  windDeg?: number;
  create(): MissionRuntime;
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const bow = (s: BoatState) => ({ x: s.x + Math.sin(s.heading) * BOAT.length / 2, y: s.y + Math.cos(s.heading) * BOAT.length / 2 });
const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;


function sailsTrimmed(s: BoatState, t: Telemetry): boolean {
  const pos = pointOfSail(t.twa);
  if (pos === 'run') return Math.abs(s.boom) > 60 * DEG;
  return !t.main.luffing && t.main.aoa < 34 * DEG;
}

/** Visit marks in order: pass within `radius` metres. */
function courseRuntime(marks: Mark[], radius: number, intro: string): MissionRuntime {
  let idx = 0;
  marks.forEach((m, i) => (m.active = i === 0));
  const rt: MissionRuntime = {
    marks,
    objective: intro,
    update(ctx) {
      const m = marks[idx];
      const d = dist(ctx.s.x, ctx.s.y, m.x, m.y);
      rt.objective = `Знак ${m.label ?? idx + 1}: ${Math.round(d)} м · время ${fmtTime(ctx.time)} · повороты: оверштаг ${ctx.counters.tacks}, фордевинд ${ctx.counters.gybes}`;
      rt.progress = idx / marks.length;
      if (d < radius) {
        m.done = true; m.active = false;
        idx++;
        if (idx >= marks.length) {
          return { won: true, textRu: `Дистанция пройдена за ${fmtTime(ctx.time)}. Оверштаг: ${ctx.counters.tacks}, фордевинд: ${ctx.counters.gybes}${ctx.counters.crashGybes ? `, из них неконтролируемых: ${ctx.counters.crashGybes}` : ''}.` };
        }
        marks[idx].active = true;
      }
      return null;
    },
  };
  return rt;
}

/** Fail on collision; at the finish, any impeding of ships means the exercise is not passed. */
function withTrafficRules(rt: MissionRuntime): MissionRuntime {
  const base = rt.update.bind(rt);
  rt.update = (ctx) => {
    const tr = ctx.traffic;
    if (tr && tr.collisions > 0) return { won: false, textRu: 'Столкновение с судном! Крупное судно в фарватере не может отвернуть и быстро остановиться — уходите с его пути заранее.' };
    const res = base(ctx);
    if (res?.won && tr && tr.violations > 0) {
      return { won: false, textRu: `Финиш пройден, но вы мешали проходу судов: ${tr.violations} раз(а). Пропускайте суда в фарватере и пересекайте его за кормой.` };
    }
    return res;
  };
  return rt;
}

export const MISSIONS: MissionDef[] = [
  {
    id: 'free', ru: 'Свободное плавание', en: 'Free sailing', beaufort: 3, gusts: 0.3, shifts: 4 * DEG,
    descRu: 'Попробуйте все курсы относительно ветра, повороты оверштаг и фордевинд. Настройки ветра — в меню ⚙.',
    start: { x: 0, y: 0, heading: 90 * DEG, speed: 1.5, main: 0.6 },
    create: () => ({ marks: [], objective: 'Свободное плавание', update: () => null }),
  },
  {
    id: 'points', windRelative: true, ru: 'Курсы относительно ветра', en: 'Points of sail', beaufort: 3, gusts: 0.15, shifts: 0,
    descRu: 'Ложитесь на указанный курс и галс, настройте паруса (без заполаскивания) и удерживайте 4 секунды.',
    start: { x: 0, y: 0, heading: 90 * DEG, speed: 1.5, main: 0.4 },
    create() {
      const targets: { pos: PointOfSail[]; tack?: 'starboard' | 'port'; ru: string }[] = [
        { pos: ['beam_reach'], tack: 'port', ru: 'Галфвинд левым галсом' },
        { pos: ['close_hauled'], tack: 'port', ru: 'Бейдевинд левым галсом' },
        { pos: ['close_hauled'], tack: 'starboard', ru: 'Бейдевинд правым галсом (сделайте оверштаг)' },
        { pos: ['broad_reach'], tack: 'starboard', ru: 'Бакштаг правым галсом' },
        { pos: ['run'], ru: 'Фордевинд' },
        { pos: ['broad_reach'], tack: 'port', ru: 'Бакштаг левым галсом (сделайте поворот фордевинд)' },
        { pos: ['beam_reach'], tack: 'port', ru: 'Галфвинд левым галсом' },
      ];
      let i = 0, hold = 0;
      const rt: MissionRuntime = {
        marks: [],
        objective: targets[0].ru,
        update(ctx) {
          const tg = targets[i];
          const pos = pointOfSail(ctx.t.twa);
          const ok = tg.pos.includes(pos) && (!tg.tack || tackOf(ctx.s, ctx.t.twa) === tg.tack) && sailsTrimmed(ctx.s, ctx.t) && ctx.t.speed > 0.7;
          hold = ok ? hold + ctx.dt : Math.max(0, hold - ctx.dt * 2);
          rt.objective = `${i + 1}/${targets.length}: ${tg.ru}${ok ? ' ✓ держите…' : ''}`;
          rt.progress = (i + Math.min(1, hold / 4)) / targets.length;
          if (hold >= 4) {
            i++; hold = 0;
            if (i >= targets.length) return { won: true, textRu: `Все курсы пройдены за ${fmtTime(ctx.time)}!` };
          }
          return null;
        },
      };
      return rt;
    },
  },
  {
    id: 'beat', windRelative: true, ru: 'Лавировка к наветренному знаку', en: 'Beating to windward', beaufort: 3, gusts: 0.2, shifts: 6 * DEG,
    descRu: 'Знак находится прямо против ветра в 200 м. Идите бейдевиндом и меняйте галсы поворотом оверштаг.',
    start: { x: 0, y: 0, heading: 50 * DEG, speed: 1.5, main: 0.9 },
    create: () => courseRuntime([{ x: 0, y: 200, kind: 'mark', label: '1' }], 7, 'Дойдите до знака против ветра'),
  },
  {
    id: 'slalom', windRelative: true, ru: 'Слалом по ветру (повороты фордевинд)', en: 'Downwind slalom (gybing)', beaufort: 3, gusts: 0.2, shifts: 0,
    descRu: 'Пройдите знаки по ветру по порядку. Каждый знак требует поворота фордевинд — подбирайте грота-шкот перед поворотом!',
    start: { x: 0, y: 0, heading: 160 * DEG, speed: 2, main: 0.1 },
    create: () => courseRuntime([
      { x: 30, y: -70, kind: 'mark', label: '1' },
      { x: -30, y: -140, kind: 'mark', label: '2' },
      { x: 30, y: -210, kind: 'mark', label: '3' },
      { x: -30, y: -280, kind: 'finish', label: 'Финиш' },
    ], 10, 'Пройдите знаки по ветру'),
  },
  {
    id: 'buoy', windRelative: true, ru: 'Подход к бую', en: 'Picking up a buoy', beaufort: 3, gusts: 0.1, shifts: 0,
    descRu: 'Остановитесь носом у буя: расстояние от носа меньше 3 м, скорость меньше 1 узла. Подходите против ветра и гасите ход в левентике.',
    start: { x: -60, y: -10, heading: 90 * DEG, speed: 2, main: 0.5 },
    create() {
      const b: Mark = { x: 10, y: 35, kind: 'buoy', label: 'Буй', active: true };
      const rt: MissionRuntime = {
        marks: [b],
        objective: '',
        update(ctx) {
          const p = bow(ctx.s);
          const d = dist(p.x, p.y, b.x, b.y);
          rt.objective = `До буя ${d.toFixed(1)} м · скорость ${(ctx.t.speed * 1.944).toFixed(1)} уз`;
          if (d < 1.3 && ctx.t.speed > 1.0) return { won: false, textRu: 'Удар о буй на скорости! Начните приводиться к ветру раньше — лодка идёт по инерции 1–3 корпуса.' };
          if (d < 3 && ctx.t.speed < 0.5) return { won: true, textRu: `Отличная остановка у буя за ${fmtTime(ctx.time)}.` };
          return null;
        },
      };
      return rt;
    },
  },
  {
    id: 'mob', windRelative: true, ru: 'Человек за бортом', en: 'Man overboard', beaufort: 3, gusts: 0.15, shifts: 0,
    descRu: 'Через несколько секунд человек упадёт за борт. Вернитесь и остановитесь рядом с ним (меньше 3 м, скорость меньше 1 узла). Не наезжайте на человека!',
    start: { x: 0, y: 0, heading: 90 * DEG, speed: 2, main: 0.5 },
    create() {
      let fallen = false;
      let fallTime = 0;
      const p: Mark = { x: 0, y: 0, kind: 'mob', label: 'Человек!', active: true };
      const rt: MissionRuntime = {
        marks: [],
        objective: 'Идите галфвиндом…',
        update(ctx) {
          if (!fallen) {
            if (ctx.time > 5) {
              fallen = true; fallTime = ctx.time;
              p.x = ctx.s.x - Math.sin(ctx.s.heading) * 3; p.y = ctx.s.y - Math.cos(ctx.s.heading) * 3;
              rt.marks.push(p);
            }
            return null;
          }
          // The person drifts slowly downwind.
          p.x -= Math.sin(ctx.windFrom) * 0.12 * ctx.dt;
          p.y -= Math.cos(ctx.windFrom) * 0.12 * ctx.dt;
          const d = dist(ctx.s.x, ctx.s.y, p.x, p.y);
          const el = ctx.time - fallTime;
          rt.objective = `«Человек за бортом!» · ${Math.round(d)} м · ${fmtTime(el)}`;
          if (d < 1.6 && ctx.t.speed > 1.2) return { won: false, textRu: 'Вы наехали на человека на скорости. Возвращайтесь курсом полный бейдевинд и гасите ход, потравливая паруса.' };
          if (d < 3 && ctx.t.speed < 0.5) return { won: true, textRu: `Человек поднят на борт через ${fmtTime(el)}.` };
          if (el > 240) return { won: false, textRu: 'Прошло больше 4 минут. В холодной воде время критично — отходите недалеко.' };
          return null;
        },
      };
      return rt;
    },
  },
  {
    id: 'triangle', windRelative: true, ru: 'Треугольная дистанция', en: 'Triangle course', beaufort: 3, gusts: 0.25, shifts: 6 * DEG,
    descRu: 'Классическая гоночная дистанция: наветренный знак (лавировка), знак на галфвинде, подветренный знак.',
    start: { x: 10, y: -10, heading: 45 * DEG, speed: 1.5, main: 0.9 },
    create: () => courseRuntime([
      { x: 0, y: 160, kind: 'mark', label: '1' },
      { x: 110, y: 80, kind: 'mark', label: '2' },
      { x: 0, y: 0, kind: 'finish', label: '3' },
    ], 9, 'Обойдите знаки 1 → 2 → 3'),
  },
  {
    id: 'gusty', windRelative: true, ru: 'Свежий порывистый ветер', en: 'Fresh, gusty wind', beaufort: 5, gusts: 0.6, shifts: 5 * DEG,
    descRu: '5 баллов с порывами. Пройдите 250 м галфвиндом и не опрокиньтесь: в порывах травите грот и откренивайтесь.',
    start: { x: 0, y: 0, heading: 90 * DEG, speed: 2, main: 0.5 },
    create: () => courseRuntime([{ x: 250, y: 0, kind: 'finish', label: 'Финиш' }], 10, 'Дойдите до финиша'),
  },
  {
    id: 'cardinals', ru: 'Обход опасности по кардинальным знакам', en: 'Cardinal marks', beaufort: 3, gusts: 0.15, shifts: 0, world: true,
    descRu: 'Между вами и финишем — мель, огороженная кардинальными знаками. Северный знак обходят с севера, восточный — с востока, южный — с юга, западный — с запада. Не срезайте!',
    start: { x: 80, y: 290, heading: 175 * DEG, speed: 2, main: 0.2 },
    create: () => courseRuntime([{ x: 80, y: 20, kind: 'finish', label: 'Финиш' }], 10, 'Дойдите до финиша, обойдя мель'),
  },
  {
    id: 'traffic', windRelative: true, ru: 'Расхождение с судами', en: 'Collision avoidance', beaufort: 3, gusts: 0.1, shifts: 0, traffic: 3,
    descRu: 'Пройдите 450 м галфвиндом среди других судов. Когда курсы пересекаются, они рисуются линиями до точки встречи: красные — уступить должны вы (меняйте курс заранее и явно, лучше за корму другого судна), зелёные — уступают вам (держите курс и скорость).',
    start: { x: 0, y: 0, heading: 90 * DEG, speed: 2, main: 0.5 },
    create() {
      const rt = courseRuntime([{ x: 450, y: 0, kind: 'finish', label: 'Финиш' }], 12, 'Дойдите до финиша');
      const base = rt.update.bind(rt);
      rt.update = (ctx) => {
        const res = base(ctx);
        const tr = ctx.traffic;
        if (tr && tr.collisions > 0) return { won: false, textRu: 'Столкновение! Уступающее судно должно действовать заранее и решительно, обычно отворачивая за корму.' };
        if (res && tr) {
          return tr.violations === 0
            ? { won: true, textRu: `${res.textRu} Все расхождения — по правилам!` }
            : { won: false, textRu: `Финиш пройден, но было опасных сближений, когда уступать должны были вы: ${tr.violations}. Попробуйте менять курс раньше.` };
        }
        return res;
      };
      return rt;
    },
  },
  {
    id: 'gd_entry', ru: 'Гданьск: вход в порт с моря', en: 'Gdańsk: entering port from sea', beaufort: 3, gusts: 0.2, shifts: 5 * DEG,
    realMap: true, windDeg: 270,
    descRu: 'Реальная карта. Из Гданьского залива обогните голову восточного мола, войдите в порт между головами молов (по системе МАМС-А при входе с моря красные латеральные знаки оставляют слева, зелёные — справа) и дойдите по Мёртвой Висле до Вестерплатте. Не срезайте мол!',
    start: { x: 350, y: 8050, heading: 200 * DEG, speed: 2, main: 0.5 },
    create: () => courseRuntime([
      { x: -250, y: 7450, kind: 'mark', label: 'Голова мола' },
      { x: 80, y: 6600, kind: 'mark', label: 'Вход' },
      { x: 600, y: 6040, kind: 'finish', label: 'Вестерплатте' },
    ], 45, 'Обогните голову мола и войдите в порт'),
  },
  {
    id: 'gd_ncz', ru: 'Гданьск: заход в устье Śmiała Wisła (NCŻ)', en: 'Gdańsk: Śmiała Wisła mouth', beaufort: 3, gusts: 0.2, shifts: 5 * DEG,
    realMap: true, windDeg: 270,
    descRu: 'Реальная карта. Устье Śmiała Wisła прикрыто с востока длинным молом: подходите с северо-запада, оставьте голову мола слева, пройдите между молом и западным берегом и дойдите до акватории яхтенных гаваней Гурки-Заходние — здесь Национальный центр парусного спорта (NCŻ) и яхт-клубы. Вход узкий: заранее выберите галс, чтобы не лавировать у мола.',
    start: { x: 7300, y: 3350, heading: 155 * DEG, speed: 2, main: 0.5 },
    create: () => courseRuntime([
      { x: 7740, y: 2380, kind: 'mark', label: 'Вход' },
      { x: 7860, y: 2150, kind: 'mark', label: 'Устье' },
      { x: 7830, y: 1830, kind: 'finish', label: 'NCŻ' },
    ], 40, 'Войдите в устье, оставив мол слева'),
  },
  {
    id: 'gd_ships', ru: 'Гданьск: выход из порта среди судов', en: 'Gdańsk: leaving port with shipping', beaufort: 3, gusts: 0.2, shifts: 5 * DEG,
    realMap: true, windDeg: 90, laneShips: 3,
    descRu: 'Реальная карта. От Вестерплатте выйдите в море по фарватеру порта Гданьск. По фарватеру ходят грузовые суда — они не могут уйти с него. Держитесь правой кромки фарватера (МППСС, правило 9), не мешайте их проходу и не пересекайте курс у них перед носом. Вдоль причалов стоят суда — обходите с запасом.',
    start: { x: 600, y: 6040, heading: 300 * DEG, speed: 2, main: 0.3 },
    create() {
      const rt = courseRuntime([
        { x: 80, y: 6600, kind: 'mark', label: 'Выход' },
        { x: -300, y: 7750, kind: 'finish', label: 'Море' },
      ], 45, 'Выйдите из порта');
      return withTrafficRules(rt);
    },
  },
  {
    id: 'chart_shoals', ru: 'Учебная карта: проход среди мелей', en: 'Training chart: pilotage among shoals', beaufort: 3, gusts: 0.15, shifts: 4 * DEG,
    chart: 'bay',
    descRu: '«Песчаная бухта» (выдуманная учебная карта). Дойдите до финиша на северо-востоке. На пути — мель с четырьмя кардинальными знаками, камень с знаком отдельной опасности (обходить можно с любой стороны, но не вплотную), мель с северным знаком (проходите севернее). Юго-восточнее — полигон, огороженный жёлтыми знаками: вход запрещён.',
    start: { x: -560, y: -380, heading: 70 * DEG, speed: 2, main: 0.5 },
    create: () => courseRuntime([{ x: 360, y: 40, kind: 'finish', label: 'Финиш' }], 15, 'Дойдите до финиша, не задев мели и не заходя на полигон'),
  },
  {
    id: 'chart_fairway', ru: 'Учебная карта: пересечение судоходного фарватера', en: 'Training chart: crossing a shipping channel', beaufort: 3, gusts: 0.1, shifts: 0,
    chart: 'bay', windDeg: 270, laneShips: 3,
    descRu: '«Песчаная бухта». Пересеките огороженный буями фарватер, по которому идут грузовые суда, и дойдите до знака на севере. Пересекайте под прямым углом и быстро; не мешайте судам, которые могут идти только по фарватеру (МППСС, правило 9) — пропустите судно и проходите за кормой. Севернее — якорная стоянка: суда на якоре обходите с запасом.',
    start: { x: 0, y: -20, heading: 0, speed: 2, main: 0.5 },
    create() {
      const rt = withTrafficRules(courseRuntime([{ x: 0, y: 330, kind: 'finish', label: 'Знак' }], 15, 'Пересеките фарватер'));
      // Crossing angle: from where we enter the channel to where we leave it.
      let entry: { x: number; y: number } | null = null;
      const base = rt.update.bind(rt);
      rt.update = (ctx) => {
        const inside = ctx.s.y > 105 && ctx.s.y < 195;
        if (inside && !entry) entry = { x: ctx.s.x, y: ctx.s.y };
        if (!inside && entry) {
          const ang = Math.abs(Math.atan2(ctx.s.x - entry.x, Math.abs(ctx.s.y - entry.y))) / DEG;
          entry = null;
          if (ang > 35 && ctx.s.y > 195) return { won: false, textRu: `Фарватер пересечён под углом ${Math.round(ang)}° к перпендикуляру. Пересекайте как можно ближе к прямому углу — так вы быстрее освобождаете фарватер и судам понятно ваше намерение.` };
        }
        return base(ctx);
      };
      return rt;
    },
  },
  {
    id: 'moor', ru: 'Швартовка в марине (мотор)', en: 'Mooring under engine', beaufort: 3, gusts: 0, shifts: 0, motor: true,
    descRu: 'Паруса убраны, яхта 7,5 м под подвесным мотором. Зайдите в марину и встаньте на своё место. Марина, место и ветер — случайные.',
    start: { x: 0, y: 0, heading: 0, speed: 0, main: 0 },
    create: () => ({ marks: [], objective: '', update: () => null }),
  },
  {
    id: 'unmoor', ru: 'Отход от причала (мотор)', en: 'Leaving the berth under engine', beaufort: 3, gusts: 0, shifts: 0, motor: true,
    descRu: 'Отойдите со своего места, не задев соседей, и выйдите из марины. Марина, место и ветер — случайные.',
    start: { x: 0, y: 0, heading: 0, speed: 0, main: 0 },
    create: () => ({ marks: [], objective: '', update: () => null }),
  },
];

export const MISSION_BY_ID: Record<string, MissionDef> = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));
