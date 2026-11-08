import { h, en } from '../lib/dom';
import { stats, resetProgress } from '../lib/srs';
import { load } from '../lib/store';
import { CARDS } from '../data/cards';
import { TERMS } from '../data/terms';
import { SIGNS } from '../data/signs';
import { MISSIONS } from '../sim/missions';

const TILES = [
  { href: '#/glossary', icon: '📖', ru: 'Словарь', en: 'Glossary', text: `${TERMS.length} терминов по-русски и по-английски, поиск и категории.` },
  { href: '#/cards', icon: '🃏', ru: 'Карточки', en: 'Flashcards', text: 'Интервальное повторение: термины, знаки, сигналы и команды.' },
  { href: '#/quiz', icon: '✅', ru: 'Тесты', en: 'Quizzes', text: 'Выбор ответа: определения, знаки и сигналы, команды, ситуации на воде.' },
  { href: '#/parts', icon: '⛵', ru: 'Устройство лодки', en: 'Parts of the boat', text: 'Интерактивная схема швертбота: сбоку и сверху, с проверкой.' },
  { href: '#/signs', icon: '🚩', ru: 'Знаки и сигналы', en: 'Signs & signals', text: `${SIGNS.length} знаков и сигналов: МАМС, внутренние водные пути (CEVNI), звуки, флаги.` },
  { href: '#/maneuvers', icon: '🔄', ru: 'Манёвры и команды', en: 'Manoeuvres & commands', text: 'Оверштаг, фордевинд, «человек за бортом», опрокидывание, подход к бую.' },
  { href: '#/rules', icon: '⚠️', ru: 'Правила расхождения', en: 'Right of way', text: 'Случайные ситуации: кто уступает дорогу и почему.' },
  { href: '#/sim', icon: '🌊', ru: 'Симулятор', en: 'Simulator', text: `Швертбот под парусом: румпель, шкоты, смена борта, берег, знаки, маяки, суда, ночь. Яхта под мотором: швартовка и отход в маринах Гданьска, Гдыни и Миколайек. ${MISSIONS.length} заданий.` },
];

export function homeView(root: HTMLElement): void {
  const st = stats(CARDS.map((c) => c.id));
  const best = load<Record<string, { done: boolean }>>('missions', {});
  const done = MISSIONS.filter((m) => best[m.id]?.done).length;

  root.append(
    h('h1', null, 'Парусный тренажёр'),
    h('p', { class: 'sub' }, 'Освежите знания для швертбота: термины, устройство лодки, знаки, манёвры, правила и практика в симуляторе. ',
      'Английские названия показаны рядом — ', en('English terms are shown next to Russian ones'), '. Кнопка «EN» вверху скрывает их (нажмите на скрытый термин, чтобы подсмотреть).'),
    h('div', { class: 'panel row', style: { marginBottom: '14px' } },
      h('div', { class: 'stat' }, h('b', null, `${st.learned}/${st.total}`), h('span', { class: 'small muted' }, 'карточек выучено')),
      h('div', { class: 'stat' }, h('b', null, String(st.due)), h('span', { class: 'small muted' }, 'к повторению')),
      h('div', { class: 'stat' }, h('b', null, String(st.fresh)), h('span', { class: 'small muted' }, 'новых')),
      h('div', { class: 'stat' }, h('b', null, `${done}/${MISSIONS.length}`), h('span', { class: 'small muted' }, 'заданий симулятора')),
      h('div', { class: 'spacer', style: { flex: '1' } }),
      h('a', { class: 'btn', href: '#/cards' }, st.due > 0 ? 'Повторить' : 'Учить карточки'),
    ),
    h('div', { class: 'grid' },
      TILES.map((t) => h('a', { class: 'tile', href: t.href },
        h('div', { class: 'icon' }, t.icon), h('h3', null, t.ru, ' ', en(t.en, 'small')), h('p', null, t.text)))),
    h('p', { class: 'small muted', style: { marginTop: '22px' } },
      'Изображения знаков упрощены, а физика симулятора приближённая — это тренажёр для повторения, а не замена официальных правил и практики на воде. ',
      'Прогресс хранится только в этом браузере. ',
      h('button', { class: 'btn secondary small', onClick: () => { if (confirm('Сбросить прогресс карточек?')) { resetProgress(); location.reload(); } } }, 'Сбросить прогресс')),
  );
}
