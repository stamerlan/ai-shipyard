import { h, en, clear, shuffle, pick } from '../lib/dom';
import { CARDS, type Card } from '../data/cards';
import { SITUATIONS, COMMANDS } from '../data/maneuvers';
import { progressBar } from '../lib/ui';
import { cardArt } from './cards';

interface Question {
  prompt: HTMLElement;
  options: (string | HTMLElement)[];
  answer: number;
  explain: HTMLElement | string;
}

type QuizType = 'en_ru' | 'def' | 'sign' | 'situation' | 'command';

const TYPES: { id: QuizType; ru: string }[] = [
  { id: 'en_ru', ru: 'Перевод EN → RU' },
  { id: 'def', ru: 'Определение → термин' },
  { id: 'sign', ru: 'Знаки и сигналы' },
  { id: 'situation', ru: 'Ситуации на воде' },
  { id: 'command', ru: 'Команды' },
];

const terms = CARDS.filter((c) => c.kind === 'term');
const signs = CARDS.filter((c) => c.kind === 'sign');

function options<T>(correct: T, pool: T[], key: (t: T) => string): { opts: T[]; answer: number } {
  const others = shuffle(pool.filter((p) => key(p) !== key(correct)));
  const uniq: T[] = [];
  const seen = new Set([key(correct)]);
  for (const o of others) { if (!seen.has(key(o))) { seen.add(key(o)); uniq.push(o); } if (uniq.length === 3) break; }
  const opts = shuffle([correct, ...uniq]);
  return { opts, answer: opts.indexOf(correct) };
}

/** Prefer distractors from the same deck so questions are not trivially easy. */
function poolFor(c: Card, all: Card[]): Card[] {
  const same = all.filter((x) => x.deck === c.deck);
  return same.length >= 4 ? same : all;
}

function make(type: QuizType): Question {
  switch (type) {
    case 'en_ru': {
      const c = pick(terms);
      const { opts, answer } = options(c, poolFor(c, terms), (x) => x.ru);
      return { prompt: h('div', null, h('div', { class: 'muted small' }, 'Как по-русски?'), h('div', { class: 'big', lang: 'en', style: { fontStyle: 'italic' } }, c.en)),
        options: opts.map((o) => o.ru), answer, explain: `${c.en} — ${c.ru}. ${c.defRu}` };
    }
    case 'def': {
      const c = pick(terms);
      const { opts, answer } = options(c, poolFor(c, terms), (x) => x.ru);
      return { prompt: h('div', null, h('div', { class: 'muted small' }, 'Какой это термин?'), h('div', { style: { fontSize: '18px' } }, c.defRu)),
        options: opts.map((o) => h('span', null, o.ru, ' ', en(o.en, 'small'))), answer, explain: `${c.ru} (${c.en}).` };
    }
    case 'sign': {
      const c = pick(signs);
      const { opts, answer } = options(c, poolFor(c, signs), (x) => x.ru);
      return { prompt: h('div', null, h('div', { class: 'muted small' }, c.sound ? 'Что означает этот звуковой сигнал?' : 'Что означает этот знак?'), cardArt(c)),
        options: opts.map((o) => h('span', null, o.ru, ' ', en(o.en, 'small'))), answer, explain: `${c.code ? c.code + ' — ' : ''}${c.ru}. ${c.defRu}` };
    }
    case 'situation': {
      const s = pick(SITUATIONS);
      const idx = shuffle(s.options.map((_, i) => i));
      return { prompt: h('div', null, h('div', { style: { fontSize: '18px' } }, s.qRu), h('div', { class: 'small' }, en(s.qEn))),
        options: idx.map((i) => h('span', null, s.options[i].ru, ' ', en(s.options[i].en, 'small'))), answer: idx.indexOf(s.answer), explain: s.whyRu };
    }
    case 'command': {
      const c = pick(COMMANDS);
      const { opts, answer } = options(c, COMMANDS, (x) => x.ru);
      return { prompt: h('div', null, h('div', { class: 'muted small' }, 'Какая команда?'), h('div', { style: { fontSize: '18px' } }, c.situationRu)),
        options: opts.map((o) => h('span', null, `«${o.ru}» `, en(o.en, 'small'))), answer, explain: `«${c.ru}» — ${c.en}` };
    }
  }
}

export function quizView(root: HTMLElement, params: URLSearchParams): void {
  const chosen = new Set<QuizType>((params.get('type')?.split(',') as QuizType[]) ?? []);
  if (chosen.size === 0) TYPES.forEach((t) => chosen.add(t.id));
  const body = h('div');

  function setup(): void {
    clear(body);
    const chips = h('div', { class: 'chips' }, TYPES.map((t) => {
      const b = h('button', { class: `chip ${chosen.has(t.id) ? 'on' : ''}` }, t.ru);
      b.addEventListener('click', () => { chosen.has(t.id) ? chosen.delete(t.id) : chosen.add(t.id); b.classList.toggle('on'); });
      return b;
    }));
    body.append(h('div', { class: 'panel' }, h('h3', null, 'Темы вопросов'), chips,
      h('div', { class: 'row' },
        h('button', { class: 'btn', onClick: () => chosen.size && run(10) }, '10 вопросов'),
        h('button', { class: 'btn secondary', onClick: () => chosen.size && run(25) }, '25 вопросов'))));
  }

  function run(n: number): void {
    const types = [...chosen];
    let i = 0, score = 0;
    const next = () => {
      clear(body);
      if (i >= n) {
        const pct = Math.round((score / n) * 100);
        body.append(h('div', { class: 'panel flash' },
          h('div', { class: 'big' }, `${score} из ${n} (${pct}%)`),
          h('p', null, pct >= 90 ? 'Отлично! Можно выходить на воду.' : pct >= 70 ? 'Хорошо, но есть что повторить.' : 'Стоит повторить карточки и попробовать снова.'),
          h('div', { class: 'row', style: { justifyContent: 'center' } },
            h('button', { class: 'btn', onClick: () => run(n) }, 'Ещё раз'), h('button', { class: 'btn secondary', onClick: setup }, 'Темы'))));
        return;
      }
      const q = make(pick(types));
      const fb = h('div');
      const nextBtn = h('button', { class: 'btn', style: { marginTop: '12px', display: 'none' }, onClick: () => { i++; next(); } }, i + 1 < n ? 'Дальше' : 'Результат');
      const opts = h('div', { class: 'options' });
      q.options.forEach((o, k) => {
        const b = h('button', null, o);
        b.addEventListener('click', () => {
          for (const x of opts.querySelectorAll('button')) x.disabled = true;
          const right = k === q.answer;
          if (right) score++;
          b.classList.add(right ? 'correct' : 'wrong');
          opts.children[q.answer].classList.add('correct');
          fb.className = `feedback ${right ? 'ok' : 'bad'}`;
          fb.append(h('b', null, right ? 'Верно! ' : 'Неверно. '), q.explain);
          nextBtn.style.display = '';
        });
        opts.append(b);
      });
      body.append(progressBar(i / n), h('p', { class: 'small muted' }, `Вопрос ${i + 1} из ${n} · верно: ${score}`),
        h('div', { class: 'panel' }, h('div', { class: 'flash', style: { minHeight: '0', padding: '4px' } }, q.prompt), opts, fb, nextBtn));
    };
    next();
  }

  root.append(h('h1', null, 'Тесты ', en('Quizzes', 'small')), h('p', { class: 'sub' }, 'Выберите темы и проверьте себя.'), body);
  setup();
}
