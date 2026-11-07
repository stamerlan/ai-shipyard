import { BOAT, DEG, pointOfSail, tackOf, type BoatState, type PointOfSail, type SimEvent, type Telemetry } from './physics';
import type { Mark } from './render';
import { createWorld, type World } from './world';
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
  night?: boolean;
  /** Number of other vessels. */
  traffic?: number;
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

export const MISSIONS: MissionDef[] = [
  {
    id: 'free', ru: 'Свободное плавание', en: 'Free sailing', beaufort: 3, gusts: 0.3, shifts: 4 * DEG,
    descRu: 'Попробуйте все курсы относительно ветра, повороты оверштаг и фордевинд. Настройки ветра — в меню ⚙.',
    start: { x: 0, y: 0, heading: 90 * DEG, speed: 1.5, main: 0.6 },
    create: () => ({ marks: [], objective: 'Свободное плавание', update: () => null }),
  },
  {
    id: 'points', ru: 'Курсы относительно ветра', en: 'Points of sail', beaufort: 3, gusts: 0.15, shifts: 0,
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
    id: 'beat', ru: 'Лавировка к наветренному знаку', en: 'Beating to windward', beaufort: 3, gusts: 0.2, shifts: 6 * DEG,
    descRu: 'Знак находится прямо против ветра в 200 м. Идите бейдевиндом и меняйте галсы поворотом оверштаг.',
    start: { x: 0, y: 0, heading: 50 * DEG, speed: 1.5, main: 0.9 },
    create: () => courseRuntime([{ x: 0, y: 200, kind: 'mark', label: '1' }], 7, 'Дойдите до знака против ветра'),
  },
  {
    id: 'slalom', ru: 'Слалом по ветру (повороты фордевинд)', en: 'Downwind slalom (gybing)', beaufort: 3, gusts: 0.2, shifts: 0,
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
    id: 'buoy', ru: 'Подход к бую', en: 'Picking up a buoy', beaufort: 3, gusts: 0.1, shifts: 0,
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
    id: 'mob', ru: 'Человек за бортом', en: 'Man overboard', beaufort: 3, gusts: 0.15, shifts: 0,
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
          p.y -= 0.12 * ctx.dt;
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
    id: 'triangle', ru: 'Треугольная дистанция', en: 'Triangle course', beaufort: 3, gusts: 0.25, shifts: 6 * DEG,
    descRu: 'Классическая гоночная дистанция: наветренный знак (лавировка), знак на галфвинде, подветренный знак.',
    start: { x: 10, y: -10, heading: 45 * DEG, speed: 1.5, main: 0.9 },
    create: () => courseRuntime([
      { x: 0, y: 160, kind: 'mark', label: '1' },
      { x: 110, y: 80, kind: 'mark', label: '2' },
      { x: 0, y: 0, kind: 'finish', label: '3' },
    ], 9, 'Обойдите знаки 1 → 2 → 3'),
  },
  {
    id: 'gusty', ru: 'Свежий порывистый ветер', en: 'Fresh, gusty wind', beaufort: 5, gusts: 0.6, shifts: 5 * DEG,
    descRu: '5 баллов с порывами. Пройдите 250 м галфвиндом и не опрокиньтесь: в порывах травите грот и откренивайтесь.',
    start: { x: 0, y: 0, heading: 90 * DEG, speed: 2, main: 0.5 },
    create: () => courseRuntime([{ x: 250, y: 0, kind: 'finish', label: 'Финиш' }], 10, 'Дойдите до финиша'),
  },
  {
    id: 'marina_out', ru: 'Выход из марины по фарватеру', en: 'Leaving the marina', beaufort: 3, gusts: 0.1, shifts: 0, world: true,
    descRu: 'Выйдите из гавани и пройдите фарватер между буями до знака безопасной воды. Выходя из порта, вы идёте ПРОТИВ направления ограждения: красные буи остаются справа (по правому борту), зелёные — слева.',
    start: { x: -365, y: 0, heading: 90 * DEG, speed: 0.3, main: 0.5 },
    create: () => fairwayRuntime('out'),
  },
  {
    id: 'marina_in', ru: 'Заход в марину и швартовка', en: 'Entering the marina', beaufort: 3, gusts: 0.1, shifts: 0, world: true,
    descRu: 'Войдите в гавань по фарватеру и остановитесь у причала (пунктирное место у северной стенки). Входя в порт, красные буи держите слева, зелёные — справа. Последний отрезок — против ветра, чтобы погасить ход.',
    start: { x: 30, y: 25, heading: 270 * DEG, speed: 1.5, main: 0.5 },
    create: () => fairwayRuntime('in'),
  },
  {
    id: 'cardinals', ru: 'Обход опасности по кардинальным знакам', en: 'Cardinal marks', beaufort: 3, gusts: 0.15, shifts: 0, world: true,
    descRu: 'Между вами и финишем — мель, огороженная кардинальными знаками. Северный знак обходят с севера, восточный — с востока, южный — с юга, западный — с запада. Не срезайте!',
    start: { x: 80, y: 290, heading: 175 * DEG, speed: 2, main: 0.2 },
    create: () => courseRuntime([{ x: 80, y: 20, kind: 'finish', label: 'Финиш' }], 10, 'Дойдите до финиша, обойдя мель'),
  },
  {
    id: 'traffic', ru: 'Расхождение с судами', en: 'Collision avoidance', beaufort: 3, gusts: 0.1, shifts: 0, traffic: 3,
    descRu: 'Пройдите 450 м галфвиндом среди других судов. Красный пунктир вокруг судна — уступить должны вы: меняйте курс заранее и явно, лучше за корму другого судна. Зелёный — уступают вам: держите курс и скорость.',
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
    id: 'night_in', ru: 'Ночью: заход в марину по огням', en: 'Night entry by lights', beaufort: 2, gusts: 0.1, shifts: 0, world: true, night: true,
    descRu: 'Темно — видны только огни. Найдите знак безопасной воды (белый длинный проблеск LFl 10s), затем идите между красными (Fl R 4s, слева) и зелёными (Fl G 4s, справа) огнями фарватера в гавань и встаньте к причалу. Мини-карта — как картплоттер.',
    start: { x: 25, y: -30, heading: 300 * DEG, speed: 1.5, main: 0.6 },
    create: () => fairwayRuntime('in'),
  },
];

export const MISSION_BY_ID: Record<string, MissionDef> = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));

/** Pass the fairway gates in order (out of or into the marina); finish at sea or at the berth. */
function fairwayRuntime(dir: 'in' | 'out'): MissionRuntime {
  const w = createWorld();
  const gates = dir === 'out' ? w.gates : [...w.gates].reverse();
  const finish: Mark = dir === 'out' ? { x: -30, y: 0, kind: 'finish', label: 'Выход', active: false } : { x: w.berth.x, y: w.berth.y, kind: 'buoy', label: 'Причал', active: false };
  const gateMark: Mark = { x: gates[0].x, y: 0, kind: 'mark', label: 'Ворота', active: true };
  let next = 0;
  let prevX: number | null = null;
  const wrongSide = dir === 'out'
    ? 'Вы прошли вне фарватера. При выходе из порта красные буи должны оставаться по правому борту, зелёные — по левому.'
    : 'Вы прошли вне фарватера. При входе в порт красные буи держите по левому борту, зелёные — по правому («красный — слева, когда идёшь домой»).';
  const rt: MissionRuntime = {
    marks: [gateMark, finish],
    objective: '',
    update(ctx) {
      const x = ctx.s.x, y = ctx.s.y;
      if (prevX !== null && next < gates.length) {
        const g = gates[next];
        if ((prevX - g.x) * (x - g.x) <= 0 && prevX !== x) {
          if (y < g.yMin || y > g.yMax) return { won: false, textRu: wrongSide };
          next++;
          if (next < gates.length) gateMark.x = gates[next].x;
          else { gateMark.active = false; gateMark.label = ''; finish.active = true; }
        }
      }
      prevX = x;
      rt.progress = next / (gates.length + 1);
      if (next < gates.length) {
        rt.objective = `Ворота фарватера ${next + 1}/${gates.length} · ${dir === 'out' ? 'красные — справа' : 'красные — слева'} · ${fmtTime(ctx.time)}`;
        return null;
      }
      if (dir === 'out') {
        rt.objective = 'Выйдите к знаку безопасной воды';
        if (x > finish.x) return { won: true, textRu: `Вышли из марины по фарватеру за ${fmtTime(ctx.time)}.` };
      } else {
        const p = bow(ctx.s);
        const d = dist(p.x, p.y, w.berth.x, w.berth.y);
        rt.objective = `До причала ${d.toFixed(1)} м · скорость ${(ctx.t.speed * 1.944).toFixed(1)} уз`;
        if (d < 3.5 && ctx.t.speed < 0.5) return { won: true, textRu: `Ошвартовались за ${fmtTime(ctx.time)}. Отличный заход!` };
      }
      return null;
    },
  };
  return rt;
}
