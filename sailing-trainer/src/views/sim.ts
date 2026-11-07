import { h, clear } from '../lib/dom';
import { settings, saveSettings, load, save } from '../lib/store';
import {
  initialState, step, autoHike, windAt, pointOfSail, tackOf, DEG, BEAUFORT_MS,
  POINT_OF_SAIL_RU, POINT_OF_SAIL_EN, type BoatState, type Controls, type Telemetry, type WindModel, type SimEvent,
} from '../sim/physics';
import { Renderer, type Mark } from '../sim/render';
import { MISSIONS, MISSION_BY_ID, type MissionDef, type MissionRuntime } from '../sim/missions';
import { hints } from '../sim/hints';

interface SimPrefs {
  autoHike: boolean;
  linkJib: boolean;
  showNoGo: boolean;
  freeBft: number;
  freeGusts: boolean;
}

const EVENT_TEXT: Partial<Record<SimEvent, string>> = {
  tack: 'Поворот оверштаг',
  gybe: 'Поворот фордевинд',
  crashGybe: 'Неконтролируемый поворот фордевинд! Перед поворотом подберите грота-шкот.',
};

const KEYS_HELP = [
  ['← →', 'румпель'], ['↑ ↓', 'грота-шкот (выбрать / потравить)'], ['W S', 'стаксель-шкот'],
  ['Q A', 'откренивание'], ['C', 'шверт'], ['Пробел', 'пауза'], ['R', 'заново'],
];

export function simView(root: HTMLElement, params: URLSearchParams): () => void {
  const prefs: SimPrefs = load('simPrefs', { autoHike: true, linkJib: true, showNoGo: true, freeBft: 3, freeGusts: true });
  const savePrefs = () => save('simPrefs', prefs);

  let mission: MissionDef = MISSION_BY_ID[params.get('m') ?? ''] ?? MISSIONS[0];
  let runtime: MissionRuntime;
  let s: BoatState;
  const c: Controls = { tiller: 0, main: 0.5, jib: 0.5, hike: 0, board: 1 };
  let windModel: WindModel;
  let tel: Telemetry | null = null;
  let time = 0;
  let paused = true;
  let finished = false;
  let counters = { tacks: 0, gybes: 0, crashGybes: 0 };
  let zoom = 1;
  let lastWind = { from: 0, speed: 0, gust: 0 };

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

  const missionSel = h('select', { 'aria-label': 'Задание' }, MISSIONS.map((m) => h('option', { value: m.id }, m.ru)));
  missionSel.value = mission.id;
  missionSel.addEventListener('change', () => { mission = MISSION_BY_ID[missionSel.value]; reset(true); });
  const pauseBtn = h('button', { class: 'btn secondary small', onClick: () => togglePause() }, '⏸');
  const bar = h('div', { class: 'sim-bar' },
    missionSel,
    h('button', { class: 'btn secondary small', title: 'Заново (R)', onClick: () => reset(true) }, '⟳'),
    pauseBtn,
    h('button', { class: 'btn secondary small', title: 'Отдалить', onClick: () => (zoom = Math.max(0.4, zoom / 1.25)) }, '−'),
    h('button', { class: 'btn secondary small', title: 'Приблизить', onClick: () => (zoom = Math.min(3, zoom * 1.25)) }, '+'),
    h('button', { class: 'btn secondary small', title: 'Настройки', onClick: () => showSettings() }, '⚙'),
    h('span', { class: 'keys' }, KEYS_HELP.slice(0, 5).map(([k, t]) => h('span', { style: { marginRight: '8px' } }, h('kbd', null, k), ' ', t))),
  );

  // Controls
  const tillerIn = h('input', { type: 'range', min: '-100', max: '100', value: '0', 'aria-label': 'Румпель' });
  const tillerEnds = h('div', { class: 'ends' });
  const mainIn = h('input', { type: 'range', min: '0', max: '100', value: '50', 'aria-label': 'Грота-шкот' });
  const jibIn = h('input', { type: 'range', min: '0', max: '100', value: '50', 'aria-label': 'Стаксель-шкот' });
  const hikeIn = h('input', { type: 'range', min: '0', max: '100', value: '0', 'aria-label': 'Откренивание' });
  const tillerLbl = h('span');
  const mainLbl = h('span'), jibLbl = h('span'), hikeLbl = h('span');
  const linkCb = h('input', { type: 'checkbox', checked: prefs.linkJib });
  const autoCb = h('input', { type: 'checkbox', checked: prefs.autoHike });
  linkCb.addEventListener('change', () => { prefs.linkJib = linkCb.checked; savePrefs(); });
  autoCb.addEventListener('change', () => { prefs.autoHike = autoCb.checked; savePrefs(); });
  const boardSeg = h('div', { class: 'seg' });
  const boardOpts: [number, string][] = [[1, 'Опущен'], [0.5, 'Наполовину'], [0.1, 'Поднят']];
  const drawBoard = () => {
    clear(boardSeg);
    for (const [v, l] of boardOpts) boardSeg.append(h('button', { class: Math.abs(c.board - v) < 0.01 ? 'on' : '', onClick: () => { c.board = v; drawBoard(); } }, l));
  };

  let draggingTiller = false;
  const tillerSign = () => (settings.steerMode === 'bow' ? -1 : 1);
  tillerIn.addEventListener('input', () => { c.tiller = (Number(tillerIn.value) / 100) * tillerSign(); });
  tillerIn.addEventListener('pointerdown', () => (draggingTiller = true));
  const releaseTiller = () => { draggingTiller = false; };
  tillerIn.addEventListener('pointerup', releaseTiller);
  tillerIn.addEventListener('pointercancel', releaseTiller);
  mainIn.addEventListener('input', () => { c.main = Number(mainIn.value) / 100; });
  jibIn.addEventListener('input', () => { c.jib = Number(jibIn.value) / 100; linkCb.checked = prefs.linkJib = false; savePrefs(); });
  hikeIn.addEventListener('input', () => { c.hike = Number(hikeIn.value) / 100; autoCb.checked = prefs.autoHike = false; savePrefs(); });

  const ctl = (label: string, val: HTMLElement, input: HTMLElement, ends: HTMLElement | null, extra?: HTMLElement) =>
    h('div', { class: 'ctl' }, h('label', null, h('span', null, label), val), input, ends, extra);
  const controls = h('div', { class: 'controls' },
    ctl('Румпель', tillerLbl, tillerIn, tillerEnds),
    ctl('Грота-шкот', mainLbl, mainIn, h('div', { class: 'ends' }, h('span', null, '◀ потравить'), h('span', null, 'выбрать ▶'))),
    ctl('Стаксель-шкот', jibLbl, jibIn, h('div', { class: 'ends' }, h('span', null, '◀ потравить'), h('span', null, 'выбрать ▶')),
      h('label', { class: 'small row' }, linkCb, 'вместе с гротом')),
    ctl('Откренивание', hikeLbl, hikeIn, h('div', { class: 'ends' }, h('span', null, '◀ сидим в лодке'), h('span', null, 'висим ▶')),
      h('label', { class: 'small row' }, autoCb, 'автоматически')),
    h('div', { class: 'ctl' }, h('label', null, h('span', null, 'Шверт (C)')), boardSeg),
  );

  root.append(h('div', { class: 'sim' }, bar, stage, controls));

  // ---------- Simulation ----------
  function reset(showIntro: boolean): void {
    const st = mission.start;
    s = initialState(st.heading, st.x, st.y, st.speed);
    c.tiller = 0; c.main = st.main; c.jib = st.main; c.hike = 0; c.board = 1;
    const isFree = mission.id === 'free';
    const bft = isFree ? prefs.freeBft : mission.beaufort;
    windModel = {
      base: { from: 0, speed: BEAUFORT_MS[bft] ?? 4.4 },
      gustiness: isFree ? (prefs.freeGusts ? mission.gusts : 0) : mission.gusts,
      shifts: isFree ? (prefs.freeGusts ? mission.shifts : 0) : mission.shifts,
      seed: Math.random() * 100,
    };
    runtime = mission.create();
    time = 0;
    finished = false;
    counters = { tacks: 0, gybes: 0, crashGybes: 0 };
    tel = null;
    renderer.reset();
    renderer.showNoGo = prefs.showNoGo;
    // settle sail positions
    for (let i = 0; i < 60; i++) {
      const sv = { ...s };
      step(s, c, windAt(windModel, 0), 1 / 60);
      Object.assign(s, { x: sv.x, y: sv.y, heading: sv.heading, u: sv.u, v: 0, r: 0, heel: 0 });
    }
    drawBoard();
    syncInputs(true);
    if (showIntro) intro(); else { overlay.style.display = 'none'; paused = false; }
  }

  function intro(): void {
    paused = true;
    pauseBtn.textContent = '▶';
    clear(overlay);
    overlay.style.display = '';
    const bft = mission.id === 'free' ? prefs.freeBft : mission.beaufort;
    overlay.append(h('div', { class: 'panel' },
      h('h2', { style: { marginTop: '0' } }, mission.ru, ' ', h('span', { class: 'en small' }, mission.en)),
      h('p', null, mission.descRu),
      h('p', { class: 'small muted' }, `Ветер: ${bft} балла по Бофорту (~${Math.round(BEAUFORT_MS[bft] * 1.944)} уз), дует с севера — сверху экрана.`),
      h('ul', { class: 'small' },
        h('li', null, 'Румпель в одну сторону — нос в другую. Румпель «от себя» (под ветер) — привестись, «к себе» (на ветер) — увалиться.'),
        h('li', null, 'Следите за подсказками внизу: заполаскивание, перетянутые паруса, крен, мёртвая зона.'),
        h('li', null, 'Красный сектор — мёртвая зона, пунктир — курсы крутого бейдевинда.')),
      h('p', { class: 'keys' }, KEYS_HELP.map(([k, t]) => h('span', { style: { marginRight: '10px', display: 'inline-block' } }, h('kbd', null, k), ' ', t))),
      h('button', { class: 'btn', onClick: () => { overlay.style.display = 'none'; paused = false; pauseBtn.textContent = '⏸'; } }, 'Старт'),
    ));
  }

  function finish(won: boolean, text: string): void {
    finished = true;
    paused = true;
    if (won) {
      const best = load<Record<string, { done: boolean; best?: number }>>('missions', {});
      const prev = best[mission.id];
      best[mission.id] = { done: true, best: prev?.best ? Math.min(prev.best, time) : time };
      save('missions', best);
    }
    const idx = MISSIONS.indexOf(mission);
    const nextM = MISSIONS[(idx + 1) % MISSIONS.length];
    clear(overlay);
    overlay.style.display = '';
    overlay.append(h('div', { class: 'panel' },
      h('h2', { style: { marginTop: '0' } }, won ? '🎉 Задание выполнено' : '😬 Не получилось'),
      h('p', null, text),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onClick: () => reset(false) }, 'Ещё раз'),
        won ? h('button', { class: 'btn secondary', onClick: () => { mission = nextM; missionSel.value = nextM.id; reset(true); } }, `Дальше: ${nextM.ru}`) : null,
        h('a', { class: 'btn secondary', href: '#/maneuvers' }, 'Повторить манёвры'),
      ),
    ));
  }

  function capsized(): void {
    if (mission.id === 'free') {
      paused = true;
      clear(overlay);
      overlay.style.display = '';
      overlay.append(h('div', { class: 'panel' },
        h('h2', { style: { marginTop: '0' } }, 'Лодка опрокинулась!'),
        h('p', null, 'Крен превысил предел. В порывах травите грота-шкот, откренивайтесь и немного приводитесь. Как ставить лодку — в разделе «Манёвры».'),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onClick: () => { s.capsized = false; s.heel = 0; s.u = 0; s.v = 0; s.r = 0; c.main = 0.2; c.jib = 0.2; syncInputs(true); overlay.style.display = 'none'; paused = false; } }, 'Поставить лодку'),
          h('a', { class: 'btn secondary', href: '#/maneuvers' }, 'Как поставить лодку'))));
    } else {
      finish(false, 'Лодка опрокинулась. В порывах травите грота-шкот и откренивайтесь; перед поворотом фордевинд подбирайте гик.');
    }
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
    const bftSel = h('select', null, [1, 2, 3, 4, 5].map((b) => h('option', { value: String(b) }, `${b} балл${b === 1 ? '' : b < 5 ? 'а' : 'ов'} (~${Math.round(BEAUFORT_MS[b] * 1.944)} уз)`)));
    bftSel.value = String(prefs.freeBft);
    bftSel.addEventListener('change', () => { prefs.freeBft = Number(bftSel.value); savePrefs(); });
    const steerSel = h('select', null, h('option', { value: 'tiller' }, '← → двигают румпель (как на лодке)'), h('option', { value: 'bow' }, '← → поворачивают нос (упрощённо)'));
    steerSel.value = settings.steerMode;
    steerSel.addEventListener('change', () => { settings.steerMode = steerSel.value as 'tiller' | 'bow'; saveSettings(); syncInputs(true); });
    overlay.append(h('div', { class: 'panel' },
      h('h2', { style: { marginTop: '0' } }, 'Настройки'),
      h('div', { class: 'settings-grid' },
        h('div', null, h('div', { class: 'small muted' }, 'Ветер в свободном плавании'), bftSel),
        cb('Порывы и заходы ветра (свободное плавание)', prefs.freeGusts, (v) => { prefs.freeGusts = v; savePrefs(); }),
        cb('Показывать мёртвую зону', prefs.showNoGo, (v) => { prefs.showNoGo = v; renderer.showNoGo = v; savePrefs(); }),
        h('div', null, h('div', { class: 'small muted' }, 'Управление с клавиатуры'), steerSel),
        cb('Румпель возвращается в центр, если отпустить', settings.springTiller, (v) => { settings.springTiller = v; saveSettings(); }),
      ),
      h('p', { class: 'small muted' }, 'Новые настройки ветра применяются после перезапуска задания.'),
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
  const keys = new Set<string>();
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'SELECT') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
    if (k === ' ') togglePause();
    else if (k === 'r' || k === 'к') reset(false);
    else if (k === 'c' || k === 'с') { const i = boardOpts.findIndex(([v]) => Math.abs(v - c.board) < 0.01); c.board = boardOpts[(i + 1) % boardOpts.length][0]; drawBoard(); }
    keys.add(k);
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  function applyKeys(dt: number): void {
    const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
    const left = keys.has('ArrowLeft'), right = keys.has('ArrowRight');
    const sign = settings.steerMode === 'bow' ? -1 : 1;
    if (left) c.tiller = clamp(c.tiller - sign * 1.6 * dt, -1, 1);
    if (right) c.tiller = clamp(c.tiller + sign * 1.6 * dt, -1, 1);
    if (!left && !right && !draggingTiller && settings.springTiller) c.tiller *= Math.max(0, 1 - 5 * dt);
    if (keys.has('ArrowUp')) c.main = clamp(c.main + 0.45 * dt, 0, 1);
    if (keys.has('ArrowDown')) c.main = clamp(c.main - 0.45 * dt, 0, 1);
    if (keys.has('w') || keys.has('ц')) { c.jib = clamp(c.jib + 0.45 * dt, 0, 1); prefs.linkJib = linkCb.checked = false; }
    if (keys.has('s') || keys.has('ы')) { c.jib = clamp(c.jib - 0.45 * dt, 0, 1); prefs.linkJib = linkCb.checked = false; }
    if (keys.has('q') || keys.has('й')) { c.hike = clamp(c.hike + 0.6 * dt, 0, 1); prefs.autoHike = autoCb.checked = false; }
    if (keys.has('a') || keys.has('ф')) { c.hike = clamp(c.hike - 0.6 * dt, 0, 1); prefs.autoHike = autoCb.checked = false; }
    if (prefs.linkJib) c.jib = c.main;
  }

  function syncInputs(force = false): void {
    const set = (el: HTMLInputElement, v: number) => { if (force || document.activeElement !== el || el === tillerIn) el.value = String(Math.round(v)); };
    if (!draggingTiller || force) set(tillerIn, c.tiller * 100 * tillerSign());
    set(mainIn, c.main * 100);
    set(jibIn, c.jib * 100);
    set(hikeIn, c.hike * 100);
    clear(tillerEnds);
    if (settings.steerMode === 'bow') tillerEnds.append(h('span', null, '◀ нос влево'), h('span', null, 'нос вправо ▶'));
    else tillerEnds.append(h('span', null, '◀ румпель влево (нос вправо)'), h('span', null, '(нос влево) румпель вправо ▶'));
  }

  // ---------- Loop ----------
  let raf = 0;
  let last = performance.now();
  let hudTimer = 0;
  let toastTimer = 0;

  function showToast(text: string): void {
    toast.textContent = text;
    toast.style.opacity = '1';
    toastTimer = text.length > 30 ? 3.5 : 1.6;
  }

  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) {
      applyKeys(dt);
      const sub = 4;
      const events: SimEvent[] = [];
      for (let i = 0; i < sub; i++) {
        const w = windAt(windModel, time);
        lastWind = w;
        if (prefs.autoHike && tel) c.hike = autoHike(s, tel);
        const r = step(s, c, w, dt / sub);
        tel = r.t;
        events.push(...r.events);
        time += dt / sub;
        if (s.capsized) break;
      }
      for (const e of events) {
        if (e === 'tack') counters.tacks++;
        if (e === 'gybe') counters.gybes++;
        if (e === 'crashGybe') counters.crashGybes++;
        const txt = EVENT_TEXT[e];
        if (txt && (e !== 'gybe' || !events.includes('crashGybe'))) showToast(txt);
      }
      if (s.capsized) capsized();
      else if (tel) {
        const res = runtime.update({ s, t: tel, time, dt, events, marks: runtime.marks, counters });
        if (res) finish(res.won, res.textRu);
      }
      syncInputs();
    }
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) toast.style.opacity = '0'; }
    renderer.draw(s, c, tel, lastWind, runtime.marks as Mark[], time, paused ? 0 : dt, zoom);
    hudTimer -= dt;
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
      h('div', { class: 'small', style: { opacity: '0.85' } }, POINT_OF_SAIL_EN[pos]),
      h('div', { class: 'small' }, `курс ${Math.round(hdg).toString().padStart(3, '0')}° · к ветру ${Math.round(Math.abs(twa) / DEG)}°`),
    );
    const wkn = lastWind.speed * 1.944;
    const dirDeg = lastWind.from / DEG; // arrow drawn pointing down = wind from north
    clear(hudTR);
    hudTR.append(
      h('div', { class: 'wind-dial', html: `<svg viewBox="-32 -32 64 64"><circle r="30" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.6)"/><g transform="rotate(${dirDeg})"><line y1="-20" y2="14" stroke="#fff" stroke-width="4"/><polygon points="-8,9 8,9 0,22" fill="#fff"/></g></svg>` }),
      h('div', { class: 'val' }, `${wkn.toFixed(0)} уз`),
      h('div', { class: 'small' }, lastWind.gust > 0.2 ? '💨 порыв!' : 'ветер'),
    );
    const heelDeg = s.heel / DEG;
    clear(hudBL);
    hudBL.append(
      h('div', { class: 'heel-gauge', html: heelSvg(heelDeg) }),
      h('div', { class: 'small' }, `крен ${Math.abs(heelDeg).toFixed(0)}° · шверт: ${c.board > 0.9 ? 'опущен' : c.board > 0.3 ? 'наполовину' : 'поднят'}`),
    );
    clear(objective);
    objective.append(runtime.objective);
    if (runtime.progress !== undefined) objective.append(h('div', { class: 'progress' }, h('div', { style: { width: `${runtime.progress * 100}%` } })));
    objective.style.display = runtime.objective ? '' : 'none';
    clear(hintBox);
    if (tel && !paused) for (const hn of hints(s, c, tel)) hintBox.append(h('div', { class: `hint ${hn.level}` }, hn.ru));
    tillerLbl.textContent = c.tiller === 0 ? 'прямо' : `${Math.round(Math.abs(c.tiller) * 35)}° ${c.tiller > 0 ? 'вправо' : 'влево'}`;
    mainLbl.textContent = `${Math.round(Math.abs(s.boom) / DEG)}° от ДП`;
    jibLbl.textContent = `${Math.round(Math.abs(s.jibAngle) / DEG)}°`;
    hikeLbl.textContent = `${Math.round(c.hike * 100)}%`;
  }

  reset(true);
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}

function heelSvg(heelDeg: number): string {
  const a = Math.max(-70, Math.min(70, heelDeg));
  const danger = Math.abs(a) > 30 ? '#ff5a5a' : Math.abs(a) > 18 ? '#ffc23d' : '#7fe08f';
  return `<svg viewBox="-60 -8 120 70">
    <path d="M-50 0 A50 50 0 0 0 50 0" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
    <path d="M-50 0 L50 0" stroke="rgba(255,255,255,0.35)"/>
    <g transform="rotate(${a})"><line x1="0" y1="0" x2="0" y2="-2" /><path d="M-22 6 Q0 26 22 6 Z" fill="${danger}"/><line x1="0" y1="6" x2="0" y2="-40" stroke="#fff" stroke-width="3"/></g>
  </svg>`;
}
