import { h, en, append } from '../lib/dom';
import { SIGNS, SIGN_GROUPS, type SignGroup } from '../data/signs';
import { playPattern } from '../lib/ui';

export function signsView(root: HTMLElement): void {
  root.append(
    h('h1', null, 'Знаки и сигналы ', en('Signs & signals', 'small')),
    h('p', { class: 'sub' }, 'Плавучие знаки МАМС (регион A), знаки внутренних водных путей (CEVNI — на них основаны польские правила), звуковые сигналы и флаги. Нажмите на карточку, чтобы увидеть описание. ',
      h('a', { href: '#/cards' }, 'Учить в карточках'), ' · ', h('a', { href: '#/quiz?type=sign' }, 'Тест по знакам')),
    h('p', { class: 'note' }, 'Рисунки упрощены для запоминания. Перед экзаменом сверяйтесь с официальными таблицами знаков.'),
  );
  for (const group of Object.keys(SIGN_GROUPS) as SignGroup[]) {
    const g = SIGN_GROUPS[group];
    const grid = h('div', { class: 'sign-grid' });
    for (const s of SIGNS.filter((x) => x.group === group)) {
      const card = h('div', { class: 'sign-card' },
        h('div', { class: 'art', html: s.art() }),
        s.code ? h('div', { class: 'code' }, s.code) : null,
        h('div', { class: 'name' }, s.ru),
        h('div', { class: 'small' }, en(s.en)),
        h('div', { class: 'details' }, h('p', { style: { margin: '4px 0' } }, s.defRu), h('p', { style: { margin: '4px 0' } }, en(s.defEn))),
        s.sound ? h('button', { class: 'btn secondary small', onClick: (e: Event) => { e.stopPropagation(); playPattern(s.sound!); } }, '▶ Прослушать') : null,
      );
      card.addEventListener('click', () => card.classList.toggle('open'));
      grid.append(card);
    }
    append(root, [h('h2', null, g.ru, ' ', en(g.en, 'small')), g.noteRu ? h('p', { class: 'small muted' }, g.noteRu) : null, grid]);
  }
}
