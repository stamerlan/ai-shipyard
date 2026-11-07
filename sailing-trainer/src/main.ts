import './styles.css';
import { h, clear } from './lib/dom';
import { settings, saveSettings, applySettings } from './lib/store';
import { homeView } from './views/home';
import { glossaryView } from './views/glossary';
import { cardsView } from './views/cards';
import { quizView } from './views/quiz';
import { partsView } from './views/parts';
import { signsView } from './views/signs';
import { maneuversView } from './views/maneuvers';
import { rulesView } from './views/rules';
import { simView } from './views/sim';

export type View = (root: HTMLElement, params: URLSearchParams) => void | (() => void);

interface Route { path: string; ru: string; icon: string; view: View; full?: boolean }

const ROUTES: Route[] = [
  { path: '', ru: 'Главная', icon: '⚓', view: homeView },
  { path: 'glossary', ru: 'Словарь', icon: '📖', view: glossaryView },
  { path: 'cards', ru: 'Карточки', icon: '🃏', view: cardsView },
  { path: 'quiz', ru: 'Тесты', icon: '✅', view: quizView },
  { path: 'parts', ru: 'Устройство', icon: '⛵', view: partsView },
  { path: 'signs', ru: 'Знаки', icon: '🚩', view: signsView },
  { path: 'maneuvers', ru: 'Манёвры', icon: '🔄', view: maneuversView },
  { path: 'rules', ru: 'Расхождение', icon: '⚠️', view: rulesView },
  { path: 'sim', ru: 'Симулятор', icon: '🌊', view: simView, full: true },
];

const app = document.getElementById('app')!;
const enBtn = h('button', { class: 'en-toggle', title: 'Показывать английские термины' }, 'EN');
const nav = h('nav');
const bottom = h('div', { class: 'bottomnav' });
const main = h('main');
app.append(
  h('header', { class: 'topbar' }, h('a', { class: 'brand', href: '#/' }, '⛵ Парусный тренажёр'), h('div', { class: 'spacer' }), nav, enBtn),
  main,
  bottom,
);

for (const r of ROUTES) {
  nav.append(h('a', { href: `#/${r.path}`, 'data-path': r.path }, r.ru));
  bottom.append(h('a', { href: `#/${r.path}`, 'data-path': r.path }, h('span', null, r.icon), r.ru));
}

function syncEn(): void {
  enBtn.setAttribute('aria-pressed', String(settings.showEn));
  enBtn.textContent = settings.showEn ? 'EN: вкл' : 'EN: скрыто';
}
enBtn.addEventListener('click', () => {
  settings.showEn = !settings.showEn;
  saveSettings();
  syncEn();
});

let cleanup: void | (() => void);

function render(): void {
  const hash = location.hash.replace(/^#\/?/, '');
  const [path, query] = hash.split('?');
  const route = ROUTES.find((r) => r.path === path) ?? ROUTES[0];
  if (typeof cleanup === 'function') cleanup();
  clear(main);
  main.className = route.full ? 'full' : '';
  for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-path]')) {
    a.classList.toggle('active', a.dataset.path === route.path);
  }
  document.title = route.path ? `${route.ru} — Парусный тренажёр` : 'Парусный тренажёр';
  cleanup = route.view(main, new URLSearchParams(query ?? ''));
  window.scrollTo(0, 0);
}

applySettings();
syncEn();
window.addEventListener('hashchange', render);
render();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}
