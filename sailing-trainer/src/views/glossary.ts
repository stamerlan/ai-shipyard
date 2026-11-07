import { h, en, clear } from '../lib/dom';
import { TERMS, TERM_CATEGORIES, type TermCategory } from '../data/terms';

export function glossaryView(root: HTMLElement, params: URLSearchParams): void {
  let cat: TermCategory | 'all' = (params.get('cat') as TermCategory) || 'all';
  let q = '';
  const list = h('ul', { class: 'term-list' });
  const count = h('div', { class: 'small muted' });
  const search = h('input', { type: 'search', placeholder: 'Поиск по-русски или по-английски…', 'aria-label': 'Поиск' });
  search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); draw(); });

  const chips = h('div', { class: 'chips' });
  const cats: (TermCategory | 'all')[] = ['all', ...(Object.keys(TERM_CATEGORIES) as TermCategory[])];
  for (const c of cats) {
    const b = h('button', { class: 'chip' }, c === 'all' ? 'Все' : TERM_CATEGORIES[c].ru);
    b.addEventListener('click', () => { cat = c; draw(); });
    b.dataset.cat = c;
    chips.append(b);
  }

  function draw(): void {
    for (const b of chips.querySelectorAll<HTMLButtonElement>('button')) b.classList.toggle('on', b.dataset.cat === cat);
    clear(list);
    const items = TERMS.filter((t) => (cat === 'all' || t.cat === cat) &&
      (!q || t.ru.toLowerCase().includes(q) || t.en.toLowerCase().includes(q) || t.defRu.toLowerCase().includes(q)));
    count.textContent = `Найдено: ${items.length}`;
    for (const t of items) {
      const li = h('li', null,
        h('div', null, h('span', { class: 'ru' }, t.ru), ' — ', en(t.en)),
        h('div', { class: 'def' }, t.defRu),
        h('div', { class: 'def-en' }, en(t.defEn)),
        cat === 'all' ? h('div', { class: 'cat-label', style: { marginTop: '4px' } }, TERM_CATEGORIES[t.cat].ru) : null,
      );
      li.addEventListener('click', () => li.classList.toggle('open'));
      list.append(li);
    }
  }

  root.append(
    h('h1', null, 'Словарь ', en('Glossary', 'small')),
    h('p', { class: 'sub' }, 'Нажмите на термин, чтобы увидеть английское определение.'),
    search, chips, count, list,
  );
  draw();
}
