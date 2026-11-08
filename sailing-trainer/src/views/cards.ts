import { h, en, clear, shuffle } from '../lib/dom';
import { load, save } from '../lib/store';
import { grade, isDue, getState, stats, type Grade } from '../lib/srs';
import { CARDS, DECKS, type Card } from '../data/cards';
import { deckPicker, progressBar, playPattern } from '../lib/ui';

type Mode = 'ru' | 'en' | 'def';
const MODES: { id: Mode; ru: string }[] = [
  { id: 'ru', ru: 'RU → EN' },
  { id: 'en', ru: 'EN → RU' },
  { id: 'def', ru: 'Знак / описание → термин' },
];
const NEW_PER_SESSION = 20;

export function cardArt(c: Card, size = ''): HTMLElement | null {
  if (!c.art) return null;
  const wrap = h('div', { class: `art ${size}`, html: c.art() });
  if (c.sound) {
    const p = c.sound;
    return h('div', null, wrap, h('button', { class: 'btn secondary small', onClick: (e: Event) => { e.stopPropagation(); playPattern(p); } }, '▶ Прослушать'));
  }
  return wrap;
}

export function cardsView(root: HTMLElement): () => void {
  const prefs = load('cardsPrefs', { decks: DECKS.map((d) => d.id), mode: 'ru' as Mode });
  const selected = new Set(prefs.decks);
  let mode: Mode = prefs.mode;
  const body = h('div');

  const persist = () => save('cardsPrefs', { decks: [...selected], mode });

  function setup(): void {
    clear(body);
    const pool = CARDS.filter((c) => selected.has(c.deck));
    const st = stats(pool.map((c) => c.id));
    const info = h('p', { class: 'small muted' },
      `Выбрано карточек: ${st.total}. К повторению: ${st.due}, новых: ${st.fresh}, выучено: ${st.learned}.`);
    const modeSel = h('div', { class: 'seg', style: { maxWidth: '520px' } },
      MODES.map((m) => h('button', { class: m.id === mode ? 'on' : '', onClick: () => { mode = m.id; persist(); setup(); } }, m.ru)));
    body.append(
      h('div', { class: 'panel' },
        h('h3', null, 'Колоды'),
        deckPicker(selected, () => { persist(); setup(); }),
        h('h3', null, 'Направление'),
        modeSel,
        info,
        h('button', { class: 'btn', disabled: st.total === 0, onClick: start }, st.due + Math.min(st.fresh, NEW_PER_SESSION) > 0 ? 'Начать' : 'Повторить всё ещё раз'),
      ),
    );
  }

  function start(): void {
    const pool = CARDS.filter((c) => selected.has(c.deck));
    const due = shuffle(pool.filter((c) => getState(c.id) && isDue(c.id)));
    const fresh = shuffle(pool.filter((c) => !getState(c.id))).slice(0, NEW_PER_SESSION);
    let queue = [...due, ...fresh];
    if (queue.length === 0) queue = shuffle(pool).slice(0, 25); // extra practice
    run(queue);
  }

  function run(queue: Card[]): void {
    const total = queue.length;
    let doneCount = 0;
    const tally = { again: 0, hard: 0, good: 0 };

    const next = () => {
      clear(body);
      if (queue.length === 0) {
        keyHandler = null; // the summary screen must not grade the last card again
        body.append(h('div', { class: 'panel flash' },
          h('div', { class: 'big' }, 'Сессия завершена!'),
          h('p', null, `Знаю: ${tally.good}, с трудом: ${tally.hard}, не помню: ${tally.again}.`),
          h('div', { class: 'row', style: { justifyContent: 'center' } },
            h('button', { class: 'btn', onClick: start }, 'Ещё'), h('button', { class: 'btn secondary', onClick: setup }, 'К настройкам'))));
        return;
      }
      const c = queue[0];
      const { front, back } = faces(c, mode);
      const answer = h('div', { class: 'answer', style: { display: 'none' } }, back);
      const gradeRow = h('div', { class: 'row', style: { justifyContent: 'center', display: 'none' } });
      const showBtn = h('button', { class: 'btn' }, 'Показать ответ');
      const reveal = () => { answer.style.display = ''; gradeRow.style.display = 'flex'; showBtn.style.display = 'none'; };
      showBtn.addEventListener('click', reveal);
      const doGrade = (g: Grade) => {
        grade(c.id, g);
        tally[g]++;
        queue.shift();
        if (g === 'again') queue.splice(Math.min(3, queue.length), 0, c);
        else doneCount++;
        next();
      };
      gradeRow.append(
        h('button', { class: 'btn bad', onClick: () => doGrade('again') }, 'Не помню'),
        h('button', { class: 'btn warn', onClick: () => doGrade('hard') }, 'С трудом'),
        h('button', { class: 'btn ok', onClick: () => doGrade('good') }, 'Знаю'),
      );
      const deck = DECKS.find((d) => d.id === c.deck);
      body.append(
        progressBar(doneCount / total),
        h('p', { class: 'small muted' }, `${doneCount} / ${total} · ${deck?.ru ?? ''}`),
        h('div', { class: 'panel flash', onClick: () => answer.style.display === 'none' && reveal() }, front, answer, showBtn, gradeRow),
        h('p', { class: 'small muted', style: { textAlign: 'center' } }, 'Клавиши: пробел — показать, 1 / 2 / 3 — оценка.'),
      );
      keyHandler = (e: KeyboardEvent) => {
        if (e.key === ' ' && answer.style.display === 'none') { e.preventDefault(); reveal(); }
        else if (answer.style.display !== 'none') {
          if (e.key === '1') doGrade('again');
          if (e.key === '2') doGrade('hard');
          if (e.key === '3') doGrade('good');
        }
      };
    };
    next();
  }

  let keyHandler: ((e: KeyboardEvent) => void) | null = null;
  const onKey = (e: KeyboardEvent) => keyHandler?.(e);
  window.addEventListener('keydown', onKey);

  root.append(h('h1', null, 'Карточки ', en('Flashcards', 'small')),
    h('p', { class: 'sub' }, 'Интервальное повторение: то, что вы знаете, показывается реже, а забытое — чаще.'), body);
  setup();
  return () => window.removeEventListener('keydown', onKey);
}

function faces(c: Card, mode: Mode): { front: HTMLElement; back: HTMLElement } {
  const art = () => cardArt(c);
  const code = c.code ? h('div', { class: 'small muted' }, c.code) : null;
  if (mode === 'def') {
    const front = h('div', null, art() ?? h('div', { class: 'big', style: { fontSize: '19px', fontWeight: '500' } }, c.defRu), code);
    const back = h('div', null, h('div', { class: 'big' }, c.ru), h('div', null, en(c.en)), c.art ? h('p', { class: 'small' }, c.defRu) : null);
    return { front, back };
  }
  if (mode === 'en') {
    const front = h('div', null, c.kind === 'sign' ? art() : null, h('div', { class: 'big', lang: 'en', style: { fontStyle: 'italic', color: '#2a6a9e' } }, c.en));
    const back = h('div', null, h('div', { class: 'big' }, c.ru), h('p', { class: 'small' }, c.defRu));
    return { front, back };
  }
  const front = h('div', null, c.kind === 'sign' ? art() : null, h('div', { class: 'big' }, c.ru), code);
  const back = h('div', null, h('div', { class: 'big' }, en(c.en)), h('p', { class: 'small' }, c.defRu), c.defEn ? h('p', { class: 'small' }, en(c.defEn)) : null);
  return { front, back };
}
