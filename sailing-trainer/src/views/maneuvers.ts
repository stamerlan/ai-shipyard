import { h, en, clear, shuffle } from '../lib/dom';
import { MANEUVERS, WHO_LABEL, type Maneuver } from '../data/maneuvers';

export function maneuversView(root: HTMLElement): void {
  let current: Maneuver = MANEUVERS[0];
  let mode: 'learn' | 'order' = 'learn';
  const list = h('div', { class: 'chips' });
  const tabs = h('div', { class: 'tabs' });
  const body = h('div');

  function draw(): void {
    clear(list);
    for (const m of MANEUVERS) list.append(h('button', { class: `chip ${m === current ? 'on' : ''}`, onClick: () => { current = m; draw(); } }, m.ru));
    clear(tabs);
    tabs.append(
      h('button', { class: mode === 'learn' ? 'on' : '', onClick: () => { mode = 'learn'; draw(); } }, 'Изучить'),
      h('button', { class: mode === 'order' ? 'on' : '', onClick: () => { mode = 'order'; draw(); } }, 'Упражнение: порядок действий'),
    );
    clear(body);
    body.append(h('h2', null, current.ru, ' ', en(current.en, 'small')), h('p', { class: 'muted' }, current.introRu));
    if (mode === 'learn') learn(); else order();
  }

  const stepView = (s: Maneuver['steps'][number]) => [
    h('div', { class: 'who' }, WHO_LABEL[s.who].ru),
    h('div', null, s.ru),
    s.cmd ? h('div', null, h('span', { class: 'cmd' }, s.cmd.ru), ' ', en(s.cmd.en, 'small')) : null,
    h('div', { class: 'small' }, en(s.en)),
  ];

  function learn(): void {
    body.append(
      h('ol', { class: 'steps' }, current.steps.map((s) => h('li', null, stepView(s)))),
      h('h3', null, 'Советы'),
      h('ul', null, current.tipsRu.map((t) => h('li', null, t))),
      h('p', null, h('a', { class: 'btn secondary', href: '#/sim' }, 'Попробовать в симуляторе')),
    );
  }

  function order(): void {
    const steps = current.steps;
    let pool = shuffle(steps.map((_, i) => i));
    if (pool.every((v, i) => v === i)) pool = pool.reverse();
    let next = 0, mistakes = 0;
    const done = h('ol', { class: 'steps order-done' });
    const poolEl = h('div', { class: 'order-pool options' });
    const fb = h('div');
    const redraw = () => {
      clear(poolEl);
      for (const idx of pool) {
        const s = steps[idx];
        const b = h('button', null, h('span', { class: 'who' }, WHO_LABEL[s.who].ru), ' ', s.ru, s.cmd ? h('div', null, h('span', { class: 'cmd' }, s.cmd.ru)) : null);
        b.addEventListener('click', () => {
          if (idx === next) {
            done.append(h('li', null, stepView(s)));
            pool = pool.filter((p) => p !== idx);
            next++;
            clear(fb);
            if (next === steps.length) {
              fb.className = 'feedback ok';
              fb.append(h('b', null, mistakes === 0 ? 'Идеально! ' : 'Готово! '), `Ошибок: ${mistakes}.`, ' ', h('button', { class: 'btn small', onClick: draw }, 'Ещё раз'));
            }
            redraw();
          } else {
            mistakes++;
            b.classList.add('wrong');
            setTimeout(() => b.classList.remove('wrong'), 600);
            clear(fb);
            fb.className = 'feedback bad';
            fb.append('Не этот шаг. Подумайте, что происходит раньше.');
          }
        });
        poolEl.append(b);
      }
    };
    body.append(h('p', { class: 'small muted' }, 'Нажимайте на шаги в правильном порядке.'), done, fb, poolEl);
    redraw();
  }

  root.append(h('h1', null, 'Манёвры и команды ', en('Manoeuvres & commands', 'small')),
    h('p', { class: 'sub' }, 'Пошагово для швертбота с экипажем из двух человек. Команды и ситуации также есть в ', h('a', { href: '#/quiz?type=command,situation' }, 'тестах'), ' и ', h('a', { href: '#/cards' }, 'карточках'), '.'),
    list, tabs, body);
  draw();
}
