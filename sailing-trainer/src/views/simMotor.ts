import { h, clear } from '../lib/dom';
import { load, save } from '../lib/store';
import { missionLabel, recordMission } from '../lib/progress';
import { DEG, BEAUFORT_MS, wrap } from '../sim/physics';
import { MISSIONS, MISSION_BY_ID, type MissionDef } from '../sim/missions';
import { buildHarbour, HARBOURS, type Harbour } from '../sim/harbours';
import { motorInit, motorStep, touching, berthError, stepThrottle, resolveContact, THROTTLE_RU, type MotorState, type MotorTelemetry, type ObstacleKind } from '../sim/motor';
import { HarbourRenderer } from '../sim/harbourRender';

const OBSTACLE_RU: Record<ObstacleKind, string> = {
  land: 'набережную', pontoon: 'понтон', finger: 'палец (Y-бом)', boat: 'соседнюю яхту', ship: 'судно',
};

const KEYS: [string, string][] = [['A / D', 'румпель'], ['↑ ↓', 'газ вперёд / назад'], ['N', 'нейтраль'], ['Enter', 'рулевой на другой борт'], ['Пробел', 'пауза'], ['R', 'заново']];

/** Hard contact above this speed is a crash; slower is a fender touch. */
const CRASH_SPEED = 0.6;

export function motorSimView(root: HTMLElement, params: URLSearchParams): () => void {
  const mission: MissionDef = MISSION_BY_ID[params.get('m') ?? ''] ?? MISSIONS[0];
  const leaving = mission.id === 'unmoor';
  const prefs = load('motorPrefs', { harbour: 'random' });

  let harbour: Harbour;
  let s: MotorState;
  let tiller = 0;
  let tillerCmd = 0;
  let wind = { from: 0, speed: 3 };
  let tel: MotorTelemetry | null = null;
  let time = 0, paused = true, finished = false, touches = 0, hold = 0;
  let buoyTaken = false;
  let touchingNow = false;
  let zoom = 1;
  const held = new Set<'away' | 'toward'>();

  // ---------- DOM ----------
  const canvas = h('canvas');
  const renderer = new HarbourRenderer(canvas);
  const hudTL = h('div', { class: 'hud tl' });
  const hudTR = h('div', { class: 'hud tr' });
  const objective = h('div', { class: 'objective' });
  const hintBox = h('div', { class: 'hints' });
  const toast = h('div', { class: 'toast', style: { opacity: '0' } });
  const overlay = h('div', { class: 'overlay', style: { display: 'none' } });
  const stage = h('div', { class: 'sim-stage' }, canvas, hudTL, hudTR, objective, hintBox, toast, overlay);

  const missionSel = h('select', { 'aria-label': 'Задание' }, MISSIONS.map((m) => h('option', { value: m.id }, missionLabel(m.id, m.ru))));
  missionSel.value = mission.id;
  missionSel.addEventListener('change', () => { location.hash = `#/sim?m=${missionSel.value}`; });
  const harbourSel = h('select', { 'aria-label': 'Марина' },
    h('option', { value: 'random' }, 'Марина: случайная'), HARBOURS.map((x) => h('option', { value: x.id }, x.nameRu)));
  harbourSel.value = prefs.harbour;
  harbourSel.addEventListener('change', () => { prefs.harbour = harbourSel.value; save('motorPrefs', prefs); reset(true); });
  const pauseBtn = h('button', { class: 'btn secondary small', onClick: () => togglePause() }, '⏸');
  const bar = h('div', { class: 'sim-bar' },
    missionSel, harbourSel,
    h('button', { class: 'btn secondary small', title: 'Заново (R)', onClick: () => reset(true) }, '⟳'),
    pauseBtn,
    h('button', { class: 'btn secondary small', title: 'Отдалить', onClick: () => (zoom = Math.max(0.35, zoom / 1.25)) }, '−'),
    h('button', { class: 'btn secondary small', title: 'Приблизить', onClick: () => (zoom = Math.min(3, zoom * 1.25)) }, '+'),
    h('span', { class: 'keys' }, KEYS.map(([k, t]) => h('span', { style: { marginRight: '8px' } }, h('kbd', null, k), ' ', t))),
  );

  const holdBtn = (dir: 'away' | 'toward', text: string, key: string) => {
    const b = h('button', { class: 'hold' }, text, h('span', { class: 'kh' }, ` (${key})`));
    const on = (e: Event) => { e.preventDefault(); held.add(dir); b.classList.add('down'); };
    const off = () => { held.delete(dir); b.classList.remove('down'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  };
  const tillerInfo = h('div', { class: 'ctl-val' });
  const throttleInfo = h('div', { class: 'ctl-val' });
  const throttleBtn = (label: string, key: string, dir: 1 | -1 | 0) =>
    h('button', { class: 'hold', onClick: () => setThrottle(dir) }, label, h('span', { class: 'kh' }, ` (${key})`));
  const helmBtn = h('button', { class: 'btn side-btn', onClick: () => switchHelm() });
  const stateBox = h('div', { class: 'sail-state' });
  const controls = h('div', { class: 'controls2' },
    h('div', { class: 'ctl-row r-tiller' }, h('div', { class: 'ctl-name' }, 'Румпель'), holdBtn('away', '◀ От себя', 'A'), tillerInfo, holdBtn('toward', 'К себе ▶', 'D')),
    h('div', { class: 'ctl-row r-motor' }, h('div', { class: 'ctl-name' }, 'Мотор',
      h('button', { class: 'btn secondary small', style: { marginTop: '2px' }, onClick: () => setThrottle(0) }, 'Нейтраль', h('span', { class: 'kh' }, ' (N)'))),
    throttleBtn('◀ Назад', '↓', -1), throttleInfo, throttleBtn('Вперёд ▶', '↑', 1)),
    h('div', { class: 'ctl-row side-row' }, helmBtn, stateBox),
  );
  root.append(h('div', { class: 'sim' }, bar, stage, controls));

  // ---------- Game ----------
  function reset(showIntro: boolean): void {
    harbour = buildHarbour(prefs.harbour === 'random' ? null : prefs.harbour);
    const t = harbour.target;
    s = leaving ? motorInit(t) : motorInit(harbour.arrival, 1.1);
    // The helmsman starts on the side facing the open water (or starboard).
    s.helmSide = 1;
    const bft = 2 + Math.floor(Math.random() * 3);
    wind = { from: Math.floor(Math.random() * 8) * 45 * DEG, speed: BEAUFORT_MS[bft] };
    tiller = 0; tillerCmd = 0; time = 0; finished = false; touches = 0; hold = 0; buoyTaken = false; tel = null;
    zoom = 1;
    renderer.reset();
    held.clear();
    if (showIntro) intro(bft); else { overlay.style.display = 'none'; paused = false; }
  }

  function windRu(): string {
    const names = ['северный', 'северо-восточный', 'восточный', 'юго-восточный', 'южный', 'юго-западный', 'западный', 'северо-западный'];
    return names[Math.round((((wind.from / DEG) % 360) + 360) % 360 / 45) % 8];
  }

  function intro(bft: number): void {
    paused = true; pauseBtn.textContent = '▶';
    clear(overlay);
    overlay.style.display = '';
    overlay.append(h('div', { class: 'panel' },
      h('h2', { style: { marginTop: '0' } }, mission.ru),
      h('p', null, h('b', null, harbour.nameRu), '. ', harbour.placeRu),
      h('p', null, leaving
        ? 'Вы стоите на своём месте. Отойдите, не задев соседей и понтоны, и выйдите из марины (зелёный круг на мини-карте — выход).'
        : 'Паруса убраны, идёте под мотором. Найдите своё место (зелёный пунктир) и ошвартуйтесь.'),
      h('p', null, h('b', null, 'Способ швартовки: '), harbour.mooringRu),
      harbour.attributionRu ? h('p', { class: 'small muted' }, harbour.attributionRu) : null,
      h('p', { class: 'small muted' }, `Ветер ${windRu()}, ${bft} балла (~${Math.round(wind.speed * 1.944)} уз). Яхта 7,5 м, подвесной мотор, руль — румпелем. Руль работает только при потоке воды: на нейтрали без хода лодка почти не управляется, на заднем ходу руль слабый и работает наоборот. Короткий «газ вперёд» с переложенным рулём разворачивает лодку почти на месте.`),
      h('p', { class: 'small muted' }, 'Касание на скорости до ~1 узла — это кранцы (засчитывается как касание); быстрее — удар.'),
      h('p', { class: 'keys' }, KEYS.map(([k, t]) => h('span', { style: { marginRight: '10px', display: 'inline-block' } }, h('kbd', null, k), ' ', t))),
      h('button', { class: 'btn', onClick: () => { overlay.style.display = 'none'; paused = false; pauseBtn.textContent = '⏸'; } }, 'Старт'),
    ));
  }

  function finish(won: boolean, text: string): void {
    finished = true; paused = true;
    const rec = won ? recordMission(mission.id, time) : null;
    for (const o of missionSel.options) o.textContent = missionLabel(o.value, MISSION_BY_ID[o.value].ru);
    clear(overlay);
    overlay.style.display = '';
    overlay.append(h('div', { class: 'panel' },
      h('h2', { style: { marginTop: '0' } }, won ? '🎉 Готово' : '😬 Не получилось'),
      h('p', null, text),
      rec?.newRecord ? h('p', null, h('b', null, `🏆 Новый рекорд: ${fmt(time)}`), rec.prev !== undefined ? ` (было ${fmt(rec.prev)})` : '') : rec ? h('p', { class: 'small muted' }, `Ваш рекорд: ${fmt(rec.prev!)}`) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn', onClick: () => reset(false) }, 'Ещё раз (новое место и ветер)'),
        h('button', { class: 'btn secondary', onClick: () => { location.hash = `#/sim?m=${leaving ? 'moor' : 'unmoor'}`; } }, leaving ? 'Швартовка' : 'Отход'),
      )));
  }

  function setThrottle(dir: 1 | -1 | 0): void {
    if (paused) return;
    s.throttle = stepThrottle(s.throttle, dir);
  }

  function switchHelm(): void {
    if (paused) return;
    s.helmSide = -s.helmSide;
    showToast(`Рулевой пересел на ${s.helmSide > 0 ? 'правый' : 'левый'} борт`);
  }

  function togglePause(): void {
    if (finished || overlay.style.display !== 'none') return;
    paused = !paused;
    pauseBtn.textContent = paused ? '▶' : '⏸';
  }

  let toastTimer = 0;
  function showToast(text: string): void {
    toast.textContent = text;
    toast.style.opacity = '1';
    toastTimer = text.length > 40 ? 3.5 : 1.8;
  }

  // ---------- Input ----------
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'SELECT') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(k)) e.preventDefault();
    if (k === ' ') togglePause();
    else if (k === 'r' || k === 'к') reset(false);
    else if (!e.repeat && k === 'ArrowUp') setThrottle(1);
    else if (!e.repeat && k === 'ArrowDown') setThrottle(-1);
    else if (!e.repeat && (k === 'n' || k === 'т' || k === '0')) setThrottle(0);
    else if (!e.repeat && (k === 'Enter' || k === 'b' || k === 'и')) switchHelm();
    if (k === 'a' || k === 'ф') held.add('away');
    if (k === 'd' || k === 'в') held.add('toward');
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'a' || k === 'ф') held.delete('away');
    if (k === 'd' || k === 'в') held.delete('toward');
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // Key-up never arrives if the window loses focus while a key is held: release everything and pause.
  const onBlur = () => { held.clear(); if (!paused && !finished && overlay.style.display === 'none') togglePause(); };
  const onVis = () => { if (document.hidden) onBlur(); };
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVis);

  // ---------- Loop ----------
  let raf = 0, last = performance.now(), hudTimer = 0;

  function update(dt: number): void {
    const push = (held.has('away') ? 1 : 0) - (held.has('toward') ? 1 : 0);
    if (push) tillerCmd = Math.max(-1, Math.min(1, tillerCmd + push * 2 * dt));
    else tillerCmd *= Math.max(0, 1 - 5 * dt);
    tiller = -s.helmSide * tillerCmd; // "от себя" = away from the helmsman

    const sub = 4;
    let contact = false;
    for (let i = 0; i < sub; i++) {
      const prev = { x: s.x, y: s.y, heading: s.heading };
      tel = motorStep(s, { tiller }, wind, harbour.current, dt / sub);
      time += dt / sub;
      const hit = touching(harbour, s);
      if (hit) {
        const impact = tel.sog;
        if (impact > CRASH_SPEED) {
          finish(false, `Удар о ${OBSTACLE_RU[hit]} на скорости ${(impact * 1.944).toFixed(1)} уз. В марине — только малый ход, ход гасите заранее нейтралью и малым задним.`);
          return;
        }
        resolveContact(harbour, s, prev, dt / sub);
        if (!touchingNow) { touches++; showToast(`Касание: ${OBSTACLE_RU[hit]} (кранцы)`); }
        touchingNow = true;
        contact = true;
        break;
      }
    }
    if (!contact) touchingNow = false;

    const t = harbour.target;
    if (!leaving) {
      if (t.buoy && !buoyTaken && Math.hypot(s.x - t.buoy.x, s.y - t.buoy.y) < 3.2) { buoyTaken = true; showToast('Буй взят — кормовой конец заведён'); }
      const e = berthError(s, t, !!t.eitherWay);
      const near = Math.abs(e.along) < (t.type === 'alongside' ? 3.5 : 1.0) && Math.abs(e.across) < (t.type === 'alongside' ? 1.0 : t.type === 'buoy' ? 0.8 : 0.5) && e.angle < (t.type === 'alongside' ? 15 : 12) * DEG;
      if (near && tel!.sog < 0.25) {
        if (t.buoy && !buoyTaken) {
          finish(false, 'Лодка у кеи, но кормовой буй не взят: ветер развернёт корму на соседей. Проходите вплотную к своему бую.');
          return;
        }
        hold += dt;
        if (hold > 1.2) {
          finish(true, `Ошвартовались за ${fmt(time)}${touches ? `, касаний: ${touches}` : ' без единого касания'}. ${t.type === 'alongside' ? 'Подайте носовой и кормовой швартовы и шпринги.' : t.type === 'finger' ? 'Подайте носовые на понтон и кормовые на пальцы.' : 'Носовые — на кею, кормовой — на буй.'}`);
        }
      } else hold = 0;
    } else if (Math.hypot(s.x - harbour.exit.x, s.y - harbour.exit.y) < harbour.exit.r) {
      finish(true, `Вышли из марины за ${fmt(time)}${touches ? `, касаний: ${touches}` : ' без единого касания'}.`);
    }
  }

  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) update(dt);
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) toast.style.opacity = '0'; }
    renderer.draw(harbour, s, tiller, wind, time, zoom, !leaving);
    hudTimer -= dt;
    if (hudTimer <= 0) { hudTimer = 0.12; hud(); }
    raf = requestAnimationFrame(frame);
  }

  function hud(): void {
    const kn = (tel?.sog ?? 0) * 1.944;
    const hdg = ((s.heading / DEG) % 360 + 360) % 360;
    clear(hudTL);
    hudTL.append(
      h('div', { class: 'val' }, `${kn.toFixed(1)} уз`),
      h('div', { class: 'pos' }, s.u < -0.05 ? 'Задний ход' : THROTTLE_RU[String(s.throttle)]),
      h('div', { class: 'small' }, `курс ${Math.round(hdg).toString().padStart(3, '0')}°${touches ? ` · касаний: ${touches}` : ''}`),
    );
    const rel = Math.round(Math.abs(wrap(wind.from - s.heading)) / DEG);
    clear(hudTR);
    hudTR.append(
      h('div', { class: 'wind-dial', html: `<svg viewBox="-32 -32 64 64"><circle r="30" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.6)"/><g transform="rotate(${wind.from / DEG})"><line y1="-20" y2="14" stroke="#fff" stroke-width="4"/><polygon points="-8,9 8,9 0,22" fill="#fff"/></g></svg>` }),
      h('div', { class: 'val' }, `${(wind.speed * 1.944).toFixed(0)} уз`),
      h('div', { class: 'small' }, `ветер ${windRu()}`),
      h('div', { class: 'small' }, `${rel}° от носа`),
    );
    const t = harbour.target;
    clear(objective);
    if (leaving) {
      objective.append(`Выход из марины: ${Math.round(Math.hypot(s.x - harbour.exit.x, s.y - harbour.exit.y))} м · ${fmt(time)}`);
    } else {
      const d = Math.hypot(s.x - t.x, s.y - t.y);
      objective.append(`До места ${d.toFixed(d < 20 ? 1 : 0)} м · ${fmt(time)}${t.buoy ? (buoyTaken ? ' · буй взят ✓' : ' · буй не взят') : ''}`);
    }
    clear(hintBox);
    if (!paused) for (const [lvl, text] of hints()) hintBox.append(h('div', { class: `hint ${lvl}` }, text));

    const deg = Math.round(Math.abs(tillerCmd) * 35);
    const bowGoes = tiller > 0 ? 'нос влево' : 'нос вправо';
    tillerInfo.textContent = deg < 2 ? 'прямо' : `${tillerCmd > 0 ? 'от себя' : 'к себе'} ${deg}° → ${s.u < -0.05 ? 'корма ' + (tiller > 0 ? 'влево' : 'вправо') : bowGoes}`;
    throttleInfo.textContent = THROTTLE_RU[String(s.throttle)];
    helmBtn.textContent = `⇄ Рулевой: ${s.helmSide > 0 ? 'правый' : 'левый'} борт (Enter)`;
    clear(stateBox);
    stateBox.append(
      h('span', { class: 'st good' }, `«От себя» — нос ${s.helmSide > 0 ? 'вправо' : 'влево'}`),
      h('span', { class: `st ${kn > 3 ? 'bad' : 'good'}` }, kn > 3 ? 'Слишком быстро для марины' : 'Скорость для марины'),
    );
  }

  function hints(): [string, string][] {
    const out: [string, string][] = [];
    const kn = (tel?.sog ?? 0) * 1.944;
    const t = harbour.target;
    const d = Math.hypot(s.x - t.x, s.y - t.y);
    if (kn > 3) out.push(['danger', 'Больше 3 узлов в марине — сбавьте ход.']);
    if (!leaving && d < 18 && kn > 1.6) out.push(['warn', 'Подходите медленнее: нейтраль, у самого места — малый назад.']);
    if (s.u < -0.05) out.push(['info', 'Задний ход: руль слабый и работает наоборот (смотрите подсказку у кнопок румпеля).']);
    if (Math.abs(s.u) < 0.2 && s.throttle === 0 && wind.speed > 3) out.push(['info', 'Без хода руль не работает, ветер сносит нос — дайте короткий ход вперёд.']);
    if (!leaving && t.buoy && !buoyTaken && d < 16) out.push(['warn', 'Пройдите вплотную к своему бую (зелёный круг), чтобы взять его.']);
    if (!leaving && d < 30 && d > 6) {
      const bearing = Math.atan2(t.x - s.x, t.y - s.y);
      const off = Math.abs(wrap(bearing - t.heading));
      if (t.type !== 'alongside' && off > 25 * DEG && d < 15) out.push(['info', 'Выйдите на ось места заранее, заходите прямо.']);
    }
    if (out.length === 0 && kn > 0.3) out.push(['ok', 'Хорошая скорость, так держать.']);
    return out.slice(0, 3);
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

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

