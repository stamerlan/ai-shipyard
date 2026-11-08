import { h, clear } from '../lib/dom';
import { settings, saveSettings, load, save } from '../lib/store';
import { missionLabel, recordMission, fmtTime } from '../lib/progress';
import {
  initialState, step, switchSide, windAt, pointOfSail, tackOf, DEG, BEAUFORT_MS,
  POINT_OF_SAIL_RU, type BoatState, type Controls, type Telemetry, type WindModel, type SimEvent,
} from '../sim/physics';
import { Renderer, type Mark } from '../sim/render';
import { MISSIONS, MISSION_BY_ID, type MissionDef, type MissionRuntime } from '../sim/missions';
import { hints, SAIL_STATE_RU } from '../sim/hints';
import { createWorld, isBlocked, type World } from '../sim/world';
import { createGdanskWorld, GDANSK_STARTS, GULF_ANCHOR } from '../sim/gdanskWorld';
import {
  loadConditions, saveConditions, resolveWindDir, resolveBft, gustFactor, placeFn, windFromRu, AREA_RU, DIR_OPTIONS,
  VIS_RANGE, VIS_RU, type AreaId, type Conditions,
} from '../sim/conditions';
import { Traffic, TRAFFIC_RU } from '../sim/traffic';
import { motorSimView } from './simMotor';

interface SimPrefs {
  linkJib: boolean;
  showNoGo: boolean;
  freeTraffic: number;
}

const KEYS_HELP: [string, string][] = [
  ['A / D', 'румпель'], ['↑ ↓', 'грота-шкот'], ['W S', 'стаксель-шкот'], ['Enter', 'смена борта'], ['Пробел', 'пауза'], ['R', 'заново'],
];

type Hold = 'away' | 'toward' | 'mainIn' | 'mainOut' | 'jibIn' | 'jibOut';

export function simView(root: HTMLElement, params: URLSearchParams): () => void {
  if (MISSION_BY_ID[params.get('m') ?? '']?.motor) return motorSimView(root, params);
  const prefs: SimPrefs = load('simPrefs', { linkJib: true, showNoGo: true, freeTraffic: 1 });
  const savePrefs = () => save('simPrefs', prefs);
  const cond: Conditions = loadConditions();
  const simple = () => settings.steerMode === 'bow';

  let mission: MissionDef = MISSION_BY_ID[params.get('m') ?? ''] ?? MISSIONS[0];
  let runtime: MissionRuntime;
  let s: BoatState;
  const c: Controls = { tiller: 0, main: 0.5, jib: 0.5, board: 1 };
  let tillerCmd = 0; // −1..1, + = "от себя" (or "привестись" in simple mode)
  let windModel: WindModel;
  let tel: Telemetry | null = null;
  let time = 0;
  let paused = true;
  let finished = false;
  let counters = { tacks: 0, gybes: 0, crashGybes: 0 };
  let zoom = 1;
  let lastWind = { from: 0, speed: 0, gust: 0 };
  let world: World | null = null;
  let traffic: Traffic | null = null;
  let night = false;
  let area: AreaId = 'open';
  let windDeg = 0;
  let bft = 3;
  let speedMul = 1;
  let safeTrail: { x: number; y: number; heading: number }[] = [];
  let safeTimer = 0;
  const held = new Set<Hold>();

  // ---------- DOM ----------
  const canvas = h('canvas');
  const renderer = new Renderer(canvas);
  const hudTL = h('div', { class: 'hud tl' });
  const hudTR = h('div', { class: 'hud tr' });
  const hudBL = h('div', { class: 'hud bl' });
  const objective = h('div', { class: 'objective' });
  const hintBox = h('div', { class: 'hints' });
  const toast = h('div', { class: 'toast', style: { opacity: '0' } });
  const overlay = h('div', { class: 'overlay', style: { display: 'none' } });
  const stage = h('div', { class: 'sim-stage' }, canvas, hudTL, hudTR, hudBL, objective, hintBox, toast, overlay);

  const missionSel = h('select', { 'aria-label': 'Задание' }, MISSIONS.map((m) => h('option', { value: m.id }, missionLabel(m.id, m.ru))));
  const syncMissionLabels = () => { for (const o of missionSel.options) o.textContent = missionLabel(o.value, MISSION_BY_ID[o.value].ru); };
  missionSel.value = mission.id;
  missionSel.addEventListener('change', () => {
    if (MISSION_BY_ID[missionSel.value].motor) { location.hash = `#/sim?m=${missionSel.value}`; return; }
    mission = MISSION_BY_ID[missionSel.value]; reset(true);
  });
  const pauseBtn = h('button', { class: 'btn secondary small', onClick: () => togglePause() }, '⏸');
  const speedBtn = h('button', { class: 'btn secondary small', title: 'Ускорение времени', onClick: () => {
    speedMul = speedMul >= 8 ? 1 : speedMul * 2; speedBtn.textContent = `×${speedMul}`;
  } }, '×1');
  const bar = h('div', { class: 'sim-bar' },
    missionSel,
    h('button', { class: 'btn secondary small', title: 'Заново (R)', onClick: () => reset(true) }, '⟳'),
    pauseBtn,
    h('button', { class: 'btn secondary small', title: 'Отдалить', onClick: () => (zoom = Math.max(world?.water ? 0.012 : 0.3, zoom / (world?.water ? 1.6 : 1.25))) }, '−'),
    h('button', { class: 'btn secondary small', title: 'Приблизить', onClick: () => (zoom = Math.min(3, zoom * (world?.water ? 1.6 : 1.25))) }, '+'),
    speedBtn,
    h('button', { class: 'btn secondary small', title: 'Условия и настройки', onClick: () => showSettings() }, '⚙'),
    h('span', { class: 'keys' }, KEYS_HELP.map(([k, t]) => h('span', { style: { marginRight: '8px' } }, h('kbd', null, k), ' ', t))),
  );

  /** A button that acts while it is held down (mouse or touch). */
  const holdBtn = (hold: Hold, label: () => [string, string], cls = '') => {
    const b = h('button', { class: `hold ${cls}` });
    const update = () => { const [text, key] = label(); clear(b); b.append(text, h('span', { class: 'kh' }, ` (${key})`)); };
    update();
    const on = (e: Event) => { e.preventDefault(); held.add(hold); nudge(hold); b.classList.add('down'); };
    const off = () => { held.delete(hold); b.classList.remove('down'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return { el: b, update };
  };
  const awayBtn = holdBtn('away', () => [simple() ? '⤴ Привестись' : '◀ От себя', 'A']);
  const towardBtn = holdBtn('toward', () => [simple() ? 'Увалиться ⤵' : 'К себе ▶', 'D']);
  const mainOut = holdBtn('mainOut', () => ['Потравить', '↓']);
  const mainIn = holdBtn('mainIn', () => ['Выбрать', '↑']);
  const jibOut = holdBtn('jibOut', () => ['Потравить', 'S']);
  const jibIn = holdBtn('jibIn', () => ['Выбрать', 'W']);
  const tillerInfo = h('div', { class: 'ctl-val' });
  const mainInfo = h('div', { class: 'ctl-val' });
  const jibInfo = h('div', { class: 'ctl-val' });
  const linkCb = h('input', { type: 'checkbox', checked: prefs.linkJib });
  linkCb.addEventListener('change', () => { prefs.linkJib = linkCb.checked; savePrefs(); syncJibButtons(); });
  const syncJibButtons = () => { jibIn.el.disabled = jibOut.el.disabled = prefs.linkJib; };
  syncJibButtons();
  const sideBtn = h('button', { class: 'btn side-btn', onClick: () => doSwitch() }, '⇄ Смена борта (Enter)');
  const stateBox = h('div', { class: 'sail-state' });

  const row = (cls: string, label: string, a: HTMLElement, mid: HTMLElement, b: HTMLElement, extra?: HTMLElement) =>
    h('div', { class: `ctl-row ${cls}` }, h('div', { class: 'ctl-name' }, label, extra), a, mid, b);
  const controls = h('div', { class: 'controls2' },
    row('r-tiller', 'Румпель', awayBtn.el, tillerInfo, towardBtn.el),
    row('r-main', 'Грот', mainOut.el, mainInfo, mainIn.el),
    row('r-jib', 'Стаксель', jibOut.el, jibInfo, jibIn.el, h('label', { class: 'link' }, linkCb, ' с гротом')),
    h('div', { class: 'ctl-row side-row' }, sideBtn, stateBox),
  );

  root.append(h('div', { class: 'sim' }, bar, stage, controls));

  // ---------- Simulation ----------
  function reset(showIntro: boolean): void {
    const isFree = mission.id === 'free';
    area = mission.realMap ? 'gdansk' : mission.world ? 'training' : isFree ? cond.freeArea : cond.area === 'gdansk' ? 'gdansk' : 'open';
    world = area === 'gdansk' ? createGdanskWorld() : area === 'training' ? createWorld() : null;
    night = cond.night === 'night' || (cond.night === 'auto' && !!mission.night);
    renderer.fogRange = VIS_RANGE[cond.vis];
    const tcount = mission.traffic ?? (isFree ? prefs.freeTraffic : 0);
    traffic = tcount > 0 ? new Traffic(tcount, world) : null;
    windDeg = resolveWindDir(cond, mission.windDeg ?? 0);
    bft = resolveBft(cond, mission.beaufort);
    const wFrom = windDeg * DEG;
    const gf = gustFactor(cond.gusts);
    windModel = {
      base: { from: wFrom, speed: BEAUFORT_MS[bft] ?? 4.4 },
      gustiness: gf ? gf.gust : mission.gusts,
      shifts: gf ? gf.shift * DEG : mission.shifts,
      seed: Math.random() * 100,
    };
    runtime = mission.create();
    let st = { ...mission.start };
    if (mission.windRelative) {
      const anchor = area === 'gdansk' ? GULF_ANCHOR : { x: 0, y: 0 };
      const place = placeFn(windDeg, anchor.x, anchor.y);
      [st.x, st.y] = place(st.x, st.y);
      st.heading += wFrom;
      for (const m of runtime.marks) [m.x, m.y] = place(m.x, m.y);
    } else if (isFree) {
      const p = area === 'gdansk' ? GDANSK_STARTS.find(([id]) => id === cond.freeStart) ?? GDANSK_STARTS[0] : null;
      st = { ...st, x: p ? p[2] : area === 'training' ? 20 : 0, y: p ? p[3] : 0 };
      st.heading = bestHeading(st.x, st.y, wFrom);
    }
    s = initialState(st.heading, st.x, st.y, st.speed, wFrom);
    c.tiller = 0; c.main = st.main; c.jib = st.main;
    tillerCmd = 0;
    time = 0;
    finished = false;
    counters = { tacks: 0, gybes: 0, crashGybes: 0 };
    tel = null;
    safeTrail = [{ x: s.x, y: s.y, heading: s.heading }];
    renderer.reset();
    renderer.showNoGo = prefs.showNoGo;
    zoom = night ? 0.3 : world?.water ? 0.5 : world ? 0.6 : traffic ? 0.7 : 1;
    if (Number.isFinite(renderer.fogRange)) zoom = Math.max(zoom, 0.6);
    // Let the sails settle into position before the start.
    for (let i = 0; i < 60; i++) {
      const keep = { x: s.x, y: s.y, heading: s.heading, u: s.u };
      tel = step(s, c, windAt(windModel, 0), 1 / 60).t;
      lastWind = windAt(windModel, 0);
      Object.assign(s, keep, { v: 0, r: 0, heel: 0 });
    }
    held.clear();
    awayBtn.update(); towardBtn.update();
    if (showIntro) intro(); else { overlay.style.display = 'none'; paused = false; pauseBtn.textContent = '⏸'; }
  }

  function intro(): void {
    paused = true;
    pauseBtn.textContent = '▶';
    clear(overlay);
    overlay.style.display = '';
    overlay.append(h('div', { class: 'panel' },
      h('h2', { style: { marginTop: '0' } }, mission.ru, ' ', h('span', { class: 'en small' }, mission.en)),
      h('p', null, mission.descRu),
      h('p', { class: 'small muted' }, `Ветер ${windFromRu(windDeg)}, ${bft} балл${bft === 1 ? '' : bft < 5 ? 'а' : 'ов'} по Бофорту (~${Math.round(BEAUFORT_MS[bft] * 1.944)} уз)${night ? ', ночь' : ''}${cond.vis !== 'clear' ? `, ${VIS_RU[cond.vis]}` : ''}. Север — сверху экрана, стрелка ветра — справа вверху.`),
      conditionsBlock(),
      h('ul', { class: 'small' },
        h('li', null, simple()
          ? 'Румпель: «Привестись» — нос к ветру, «Увалиться» — нос от ветра.'
          : 'Румпель: «От себя» (под ветер) — лодка приводится к ветру; «К себе» (на ветер) — уваливается. Рулевой сидит на наветренном борту.'),
        h('li', null, 'Шкоты: «Выбрать» — парус ближе к ДП, «Потравить» — дальше. Состояние парусов показано под кнопками.'),
        h('li', null, 'После каждого поворота оверштаг или фордевинд — команда «Смена борта»: экипаж пересаживается, стаксель перекидывается на новый борт.'),
        world ? h('li', null, 'Не выходите на берег и мели. Мини-карта справа — как картплоттер.') : null,
        world?.water ? h('li', null, 'Реальная карта большая: кнопки «−/+» меняют масштаб, «×1» ускоряет время. Береговая линия и молы — по данным OpenStreetMap, глубины не показаны: держитесь фарватеров.') : null,
        traffic ? h('li', null, 'Красный пунктир вокруг судна — уступаете вы; зелёный — уступают вам.') : null),
      h('p', { class: 'keys' }, KEYS_HELP.map(([k, t]) => h('span', { style: { marginRight: '10px', display: 'inline-block' } }, h('kbd', null, k), ' ', t))),
      h('button', { class: 'btn', onClick: () => { overlay.style.display = 'none'; paused = false; pauseBtn.textContent = '⏸'; } }, 'Старт'),
    ));
  }

  /** Heading on a beam reach (or close to it) with the most open water ahead. */
  function bestHeading(x: number, y: number, wFrom: number): number {
    let best = wFrom + 90 * DEG, bestLen = -1;
    for (const off of [90, -90, 110, -110, 70, -70, 135, -135, 160, -160]) {
      const hd = wFrom + off * DEG;
      let len = 0;
      while (len < 400 && !(world && isBlocked(world, x + Math.sin(hd) * len, y + Math.cos(hd) * len))) len += 10;
      if (len > bestLen + 30) { best = hd; bestLen = len; }
    }
    return best;
  }

  /** Selects for map, wind and visibility — shown in the intro and in ⚙. */
  function conditionsBlock(): HTMLElement {
    const isFree = mission.id === 'free';
    const sel = (label: string, opts: [string, string][], val: string, fn: (v: string) => void) => {
      const el = h('select', { 'aria-label': label }, opts.map(([v, t]) => h('option', { value: v }, t)));
      el.value = val;
      el.addEventListener('change', () => { fn(el.value); saveConditions(cond); reset(true); });
      return h('label', { class: 'cond' }, h('span', { class: 'small muted' }, label), el);
    };
    const num = (v: string) => (v === 'auto' || v === 'random' ? v : Number(v));
    const areaEl = mission.realMap || mission.world
      ? h('label', { class: 'cond' }, h('span', { class: 'small muted' }, 'Карта'), h('span', null, mission.realMap ? 'Гданьск (реальная карта)' : 'Учебная акватория'))
      : isFree
        ? sel('Карта', (['gdansk', 'training', 'open'] as AreaId[]).map((a) => [a, AREA_RU[a]]), cond.freeArea, (v) => { cond.freeArea = v as AreaId; })
        : sel('Карта', (['open', 'gdansk'] as AreaId[]).map((a) => [a, a === 'gdansk' ? 'Гданьский залив (реальная карта)' : AREA_RU[a]]), cond.area === 'gdansk' ? 'gdansk' : 'open', (v) => { cond.area = v as AreaId; });
    const dirOpts = DIR_OPTIONS.map(([v, t]): [string, string] => [v, v === 'auto' ? `как в задании (${windFromRu(mission.windDeg ?? 0)})` : t]);
    return h('div', { class: 'cond-grid' },
      areaEl,
      isFree && area === 'gdansk' ? sel('Место старта', GDANSK_STARTS.map(([id, name]) => [id, name]), cond.freeStart, (v) => { cond.freeStart = v; }) : null,
      sel('Направление ветра', dirOpts, String(cond.windDir), (v) => { cond.windDir = num(v) as Conditions['windDir']; }),
      sel('Сила ветра', [['auto', `как в задании (${mission.beaufort} б.)`], ['random', 'случайная (2–4 б.)'],
        ...[1, 2, 3, 4, 5, 6].map((b): [string, string] => [String(b), `${b} балл${b === 1 ? '' : b < 5 ? 'а' : 'ов'} (~${Math.round(BEAUFORT_MS[b] * 1.944)} уз)`])],
      String(cond.bft), (v) => { cond.bft = num(v) as Conditions['bft']; }),
      sel('Порывы и заходы', [['auto', 'как в задании'], ['none', 'ровный ветер'], ['light', 'небольшие'], ['strong', 'сильные']], cond.gusts, (v) => { cond.gusts = v as Conditions['gusts']; }),
      sel('Время суток', [['auto', 'как в задании'], ['day', 'день'], ['night', 'ночь (видны огни)']], cond.night, (v) => { cond.night = v as Conditions['night']; }),
      sel('Видимость', [['clear', 'ясно'], ['haze', 'дымка (~150 м)'], ['fog', 'туман (~50 м)']], cond.vis, (v) => { cond.vis = v as Conditions['vis']; }),
      isFree ? sel('Другие суда', [['0', 'нет'], ['1', '1 судно'], ['2', '2 судна'], ['3', '3 судна']], String(prefs.freeTraffic), (v) => { prefs.freeTraffic = Number(v); savePrefs(); }) : null,
    );
  }

  function finish(won: boolean, text: string): void {
    finished = true;
    paused = true;
    const rec = won ? recordMission(mission.id, time) : null;
    syncMissionLabels();
    const idx = MISSIONS.indexOf(mission);
    const nextM = MISSIONS[(idx + 1) % MISSIONS.length];
    clear(overlay);
    overlay.style.display = '';
    overlay.append(h('div', { class: 'panel' },
      h('h2', { style: { marginTop: '0' } }, won ? '🎉 Задание выполнено' : '😬 Не получилось'),
      h('p', null, text),
      rec?.newRecord ? h('p', null, h('b', null, `🏆 Новый рекорд: ${fmtTime(time)}`), rec.prev !== undefined ? ` (было ${fmtTime(rec.prev)})` : '') : rec ? h('p', { class: 'small muted' }, `Ваш рекорд: ${fmtTime(rec.prev!)}`) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn', onClick: () => reset(false) }, 'Ещё раз'),
        won ? h('button', { class: 'btn secondary', onClick: () => { if (nextM.motor) { location.hash = `#/sim?m=${nextM.id}`; return; } mission = nextM; missionSel.value = nextM.id; reset(true); } }, `Дальше: ${nextM.ru}`) : null,
        h('a', { class: 'btn secondary', href: '#/maneuvers' }, 'Повторить манёвры'),
      ),
    ));
  }

  /** In free sailing: show a message and offer to continue from a safe spot. */
  function freeMishap(title: string, text: string, recover: () => void): void {
    paused = true;
    clear(overlay);
    overlay.style.display = '';
    overlay.append(h('div', { class: 'panel' },
      h('h2', { style: { marginTop: '0' } }, title), h('p', null, text),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onClick: () => { recover(); overlay.style.display = 'none'; paused = false; } }, 'Продолжить'),
        h('a', { class: 'btn secondary', href: '#/maneuvers' }, 'Манёвры'))));
  }

  function capsized(): void {
    const text = 'Крен превысил предел. В порывах травите грота-шкот; после поворота не забывайте «Смену борта» — экипаж на подветренном борту кренит лодку.';
    if (mission.id === 'free') {
      freeMishap('Лодка опрокинулась!', text, () => { s.capsized = false; s.heel = 0; s.u = 0; s.v = 0; s.r = 0; c.main = 0.2; c.jib = 0.2; });
    } else finish(false, `Лодка опрокинулась. ${text}`);
  }

  function grounded(kind: 'land' | 'shoal' | 'pontoon'): void {
    const text = kind === 'shoal'
      ? 'Сели на мель. Кардинальный знак показывает безопасную сторону: северный обходят с севера, южный — с юга, восточный — с востока, западный — с запада.'
      : kind === 'pontoon' ? 'Удар о причал на скорости. Гасите ход заранее: последний отрезок — против ветра, паруса потравлены.'
        : 'Выбросились на берег. Следите за береговой линией и мини-картой.';
    if (mission.id === 'free') {
      freeMishap(kind === 'shoal' ? 'Мель!' : 'Удар!', text, () => {
        const p = safeTrail[0];
        Object.assign(s, { x: p.x, y: p.y, heading: p.heading, u: 0, v: 0, r: 0, heel: 0 });
        safeTrail = [p];
      });
    } else finish(false, text);
  }

  function doSwitch(): void {
    if (paused || finished) return;
    switchSide(s);
    showToast(s.crewSide > 0 ? 'Смена борта: экипаж на правом борту' : 'Смена борта: экипаж на левом борту');
  }

  function showSettings(): void {
    const wasPaused = paused;
    paused = true;
    clear(overlay);
    overlay.style.display = '';
    const cb = (label: string, val: boolean, fn: (v: boolean) => void) => {
      const i = h('input', { type: 'checkbox', checked: val });
      i.addEventListener('change', () => fn(i.checked));
      return h('label', null, i, label);
    };
    const sel = (label: string, opts: [string, string][], val: string, fn: (v: string) => void) => {
      const el = h('select', null, opts.map(([v, t]) => h('option', { value: v }, t)));
      el.value = val;
      el.addEventListener('change', () => fn(el.value));
      return h('div', null, h('div', { class: 'small muted' }, label), el);
    };
    overlay.append(h('div', { class: 'panel' },
      h('h2', { style: { marginTop: '0' } }, 'Условия и настройки'),
      h('p', { class: 'small muted' }, 'Условия применяются сразу — упражнение начнётся заново.'),
      conditionsBlock(),
      h('div', { class: 'settings-grid' },
        h('b', null, 'Общие'),
        sel('Кнопки руля', [['tiller', 'От себя / К себе (как на лодке)'], ['bow', 'Привестись / Увалиться (упрощённо)']], settings.steerMode, (v) => {
          settings.steerMode = v as 'tiller' | 'bow'; saveSettings(); awayBtn.update(); towardBtn.update();
        }),
        cb('Показывать мёртвую зону', prefs.showNoGo, (v) => { prefs.showNoGo = v; renderer.showNoGo = v; savePrefs(); }),
      ),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onClick: () => { overlay.style.display = 'none'; paused = finished || wasPaused; pauseBtn.textContent = paused ? '▶' : '⏸'; } }, 'Закрыть'),
        h('button', { class: 'btn secondary', onClick: () => reset(true) }, 'Перезапустить')),
    ));
  }

  function togglePause(): void {
    if (finished || overlay.style.display !== 'none') return;
    paused = !paused;
    pauseBtn.textContent = paused ? '▶' : '⏸';
  }

  // ---------- Input ----------
  const KEY_HOLD: Record<string, Hold> = {
    a: 'away', ф: 'away', d: 'toward', в: 'toward',
    ArrowUp: 'mainIn', ArrowDown: 'mainOut', w: 'jibIn', ц: 'jibIn', s: 'jibOut', ы: 'jibOut',
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'SELECT') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(k)) e.preventDefault();
    if (k === ' ') togglePause();
    else if (k === 'r' || k === 'к') reset(false);
    else if ((k === 'Enter' || k === 'b' || k === 'и') && !e.repeat) doSwitch();
    const hold = KEY_HOLD[k];
    if (hold && !held.has(hold)) { held.add(hold); nudge(hold); }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const hold = KEY_HOLD[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (hold) held.delete(hold);
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // Key-up never arrives if the window loses focus while a key is held: release everything and pause.
  const onBlur = () => { held.clear(); if (!paused && !finished && overlay.style.display === 'none') togglePause(); };
  const onVis = () => { if (document.hidden) onBlur(); };
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVis);

  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  /** A short tap still moves the sheet a little. */
  function nudge(hold: Hold): void {
    if (hold === 'mainIn') c.main = clamp01(c.main + 0.04);
    if (hold === 'mainOut') c.main = clamp01(c.main - 0.04);
    if (hold === 'jibIn' && !prefs.linkJib) c.jib = clamp01(c.jib + 0.04);
    if (hold === 'jibOut' && !prefs.linkJib) c.jib = clamp01(c.jib - 0.04);
  }

  function applyControls(dt: number): void {
    const push = (held.has('away') ? 1 : 0) - (held.has('toward') ? 1 : 0);
    if (push !== 0) tillerCmd = Math.max(-1, Math.min(1, tillerCmd + push * 2.2 * dt));
    else tillerCmd *= Math.max(0, 1 - 6 * dt);
    if (simple()) {
      // Luff = tiller to leeward.
      const windSide = tel ? (tel.twa >= 0 ? 1 : -1) : 1;
      c.tiller = -windSide * tillerCmd;
    } else {
      // "От себя" = away from the helmsman, who sits with the crew.
      c.tiller = -s.crewSide * tillerCmd;
    }
    const rate = 0.4 * dt;
    if (held.has('mainIn')) c.main = clamp01(c.main + rate);
    if (held.has('mainOut')) c.main = clamp01(c.main - rate);
    if (!prefs.linkJib) {
      if (held.has('jibIn')) c.jib = clamp01(c.jib + rate);
      if (held.has('jibOut')) c.jib = clamp01(c.jib - rate);
    } else c.jib = c.main;
  }

  // ---------- Loop ----------
  let raf = 0;
  let last = performance.now();
  let hudTimer = 0;
  let toastTimer = 0;
  let encounterText = '';

  function showToast(text: string): void {
    toast.textContent = text;
    toast.style.opacity = '1';
    toastTimer = text.length > 40 ? 3.5 : 1.8;
  }

  function checkGround(): boolean {
    if (!world) return false;
    const sh = Math.sin(s.heading), ch = Math.cos(s.heading);
    const pts = [[s.x, s.y], [s.x + sh * 2.1, s.y + ch * 2.1], [s.x - sh * 2, s.y - ch * 2]];
    for (const [x, y] of pts) {
      const hit = isBlocked(world, x, y);
      if (!hit) continue;
      const speed = Math.hypot(s.u, s.v);
      if (hit !== 'shoal' && speed < 0.8) {
        // Gentle touch: the boat just stops against the pontoon or shore.
        s.x -= sh * 0.4; s.y -= ch * 0.4; s.u = 0; s.v = 0;
        if (toastTimer <= 0) showToast(hit === 'pontoon' ? 'Касание причала' : 'Касание берега');
        return false;
      }
      grounded(hit);
      return true;
    }
    safeTimer += 1;
    if (safeTimer % 60 === 0) { safeTrail.push({ x: s.x, y: s.y, heading: s.heading }); if (safeTrail.length > 4) safeTrail.shift(); }
    return false;
  }

  function frame(now: number): void {
    const rdt = Math.min(0.05, (now - last) / 1000);
    const dt = rdt * (paused ? 1 : speedMul);
    last = now;
    if (!paused) {
      applyControls(rdt);
      const sub = 4 * speedMul;
      const events: SimEvent[] = [];
      for (let i = 0; i < sub; i++) {
        const w = windAt(windModel, time);
        lastWind = w;
        const r = step(s, c, w, dt / sub);
        tel = r.t;
        events.push(...r.events);
        time += dt / sub;
        if (s.capsized) break;
      }
      for (const e of events) {
        if (e === 'tack') { counters.tacks++; showToast('Поворот оверштаг — «Смена борта!»'); }
        if (e === 'gybe') { counters.gybes++; if (!events.includes('crashGybe')) showToast('Поворот фордевинд — «Смена борта!»'); }
        if (e === 'crashGybe') { counters.crashGybes++; showToast('Неконтролируемый поворот фордевинд! Перед поворотом подберите грота-шкот.'); }
      }
      if (traffic) {
        for (const ev of traffic.update(dt, s, lastWind.from)) {
          if (ev.kind === 'collision') {
            if (mission.id === 'free') freeMishap('Столкновение!', `${ev.textRu} Уступающее судно должно менять курс заранее и явно.`, () => { s.u = 0; s.v = 0; });
          } else if (ev.kind === 'encounter' || ev.kind === 'violation') showToast(ev.textRu);
        }
      }
      if (s.capsized) capsized();
      else if (!checkGround() && tel && !finished) {
        const res = runtime.update({ s, t: tel, time, dt, events, marks: runtime.marks, counters, world, traffic, windFrom: windModel.base.from });
        if (res) finish(res.won, res.textRu);
      }
    }
    if (toastTimer > 0) { toastTimer -= rdt; if (toastTimer <= 0) toast.style.opacity = '0'; }
    renderer.draw(s, c, tel, lastWind, runtime.marks as Mark[], time, paused ? 0 : dt, zoom, { world, vessels: traffic?.vessels ?? [], night });
    hudTimer -= rdt;
    if (hudTimer <= 0) { hudTimer = 0.12; updateHud(); }
    raf = requestAnimationFrame(frame);
  }

  function updateHud(): void {
    const kn = (tel?.speed ?? 0) * 1.944;
    const twa = tel?.twa ?? 0;
    const pos = pointOfSail(twa);
    const tack = tackOf(s, twa) === 'starboard' ? 'правый галс' : 'левый галс';
    const hdg = ((s.heading / DEG) % 360 + 360) % 360;
    clear(hudTL);
    hudTL.append(
      h('div', { class: 'val' }, `${kn.toFixed(1)} уз`),
      h('div', { class: 'pos' }, POINT_OF_SAIL_RU[pos], pos !== 'irons' ? `, ${tack}` : ''),
      h('div', { class: 'small' }, `курс ${Math.round(hdg).toString().padStart(3, '0')}° · к ветру ${Math.round(Math.abs(twa) / DEG)}°`),
      h('div', { class: 'small phone-only' }, `крен ${Math.abs(s.heel / DEG).toFixed(0)}°`),
    );
    const wkn = lastWind.speed * 1.944;
    clear(hudTR);
    hudTR.append(
      h('div', { class: 'wind-dial', html: `<svg viewBox="-32 -32 64 64"><circle r="30" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.6)"/><g transform="rotate(${lastWind.from / DEG})"><line y1="-20" y2="14" stroke="#fff" stroke-width="4"/><polygon points="-8,9 8,9 0,22" fill="#fff"/></g></svg>` }),
      h('div', { class: 'val' }, `${wkn.toFixed(0)} уз`),
      h('div', { class: 'small' }, lastWind.gust > 0.2 ? '💨 порыв!' : 'ветер'),
    );
    const heelDeg = s.heel / DEG;
    clear(hudBL);
    hudBL.append(h('div', { class: 'heel-gauge', html: heelSvg(heelDeg) }), h('div', { class: 'small' }, `крен ${Math.abs(heelDeg).toFixed(0)}°`));
    clear(objective);
    objective.append(runtime.objective);
    if (runtime.progress !== undefined) objective.append(h('div', { class: 'progress' }, h('div', { style: { width: `${runtime.progress * 100}%` } })));
    objective.style.display = runtime.objective ? '' : 'none';

    clear(hintBox);
    if (tel && !paused) {
      const enc = traffic?.current();
      encounterText = '';
      if (enc?.encounter) {
        encounterText = enc.encounter.giveWay === 'own'
          ? `⚠ Уступите дорогу: ${TRAFFIC_RU[enc.type]} (${enc.encounter.ruleRu})`
          : `Вам уступает ${TRAFFIC_RU[enc.type]} — держите курс и скорость`;
        hintBox.append(h('div', { class: `hint ${enc.encounter.giveWay === 'own' ? 'danger' : 'ok'}` }, encounterText));
      }
      for (const hn of hints(s, tel, world).slice(0, encounterText ? 2 : 3)) hintBox.append(h('div', { class: `hint ${hn.level}` }, hn.ru));
    }

    // Controls panel
    const tillerDeg = Math.round(Math.abs(tillerCmd) * 35);
    tillerInfo.textContent = tillerDeg < 2 ? 'прямо' : simple()
      ? `${tillerCmd > 0 ? 'приводимся' : 'уваливаемся'} ${tillerDeg}°`
      : `${tillerCmd > 0 ? 'от себя' : 'к себе'} ${tillerDeg}°`;
    mainInfo.innerHTML = sheetBar(c.main, Math.abs(s.boom) / DEG);
    jibInfo.innerHTML = sheetBar(c.jib, Math.abs(s.jibAngle) / DEG);
    clear(stateBox);
    if (tel) {
      const item = (label: string, text: string, bad: boolean) => h('span', { class: `st ${bad ? 'bad' : 'good'}` }, `${bad ? '✗' : '✓'} ${label}: ${text}`);
      stateBox.append(
        item('Грот', SAIL_STATE_RU[tel.main.state], tel.main.state !== 'ok'),
        item('Стаксель', SAIL_STATE_RU[tel.jib.state], tel.jib.state !== 'ok' && tel.jib.state !== 'goosewing' && tel.jib.state !== 'blanketed'),
        item('Экипаж', tel.crewLeeward ? 'на подветренном борту!' : s.crewSide > 0 ? 'правый борт' : 'левый борт', tel.crewLeeward),
      );
      const needSwitch = tel.crewLeeward || (tel.jib.state === 'backed' && pointOfSail(tel.twa) !== 'irons');
      sideBtn.classList.toggle('attention', needSwitch);
    }
  }

  reset(true);
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVis);
  };
}

function sheetBar(sheet: number, angleDeg: number): string {
  return `<div class="sheet-bar"><div style="width:${Math.round(sheet * 100)}%"></div></div><div class="sheet-txt">${Math.round(angleDeg)}° от ДП</div>`;
}

function heelSvg(heelDeg: number): string {
  const a = Math.max(-70, Math.min(70, heelDeg));
  const danger = Math.abs(a) > 30 ? '#ff5a5a' : Math.abs(a) > 18 ? '#ffc23d' : '#7fe08f';
  return `<svg viewBox="-60 -8 120 70">
    <path d="M-50 0 A50 50 0 0 0 50 0" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
    <g transform="rotate(${a})"><path d="M-22 6 Q0 26 22 6 Z" fill="${danger}"/><line x1="0" y1="6" x2="0" y2="-40" stroke="#fff" stroke-width="3"/></g>
  </svg>`;
}
