import { h, en, clear, shuffle } from '../lib/dom';
import { DIAGRAMS, HOTSPOTS, type PartView } from '../data/parts';
import { TERM_BY_ID } from '../data/terms';

const NS = 'http://www.w3.org/2000/svg';

function buildSvg(view: PartView): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 600 540');
  svg.innerHTML = DIAGRAMS[view];
  HOTSPOTS[view].forEach((hs, i) => {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'hotspot');
    g.setAttribute('data-term', hs.term);
    g.setAttribute('tabindex', '0');
    g.innerHTML = `<circle class="ring" cx="${hs.x}" cy="${hs.y}" r="14"/><circle class="dot" cx="${hs.x}" cy="${hs.y}" r="9.5"/>` +
      `<text x="${hs.x}" y="${hs.y + 4}" text-anchor="middle">${i + 1}</text>` +
      `<text class="lbl" x="${hs.x + 13}" y="${hs.y - 10}">${TERM_BY_ID[hs.term]?.ru ?? hs.term}</text>`;
    svg.append(g);
  });
  return svg;
}

export function partsView(root: HTMLElement): void {
  let view: PartView = 'side';
  let mode: 'explore' | 'find' | 'name' = 'explore';
  const tabs = h('div', { class: 'tabs' });
  const diagram = h('div', { class: 'diagram panel', style: { padding: '6px' } });
  const side = h('div', { class: 'panel' });
  let svg: SVGSVGElement;

  const setTabs = () => {
    clear(tabs);
    const add = (label: string, on: boolean, fn: () => void) => tabs.append(h('button', { class: on ? 'on' : '', onClick: fn }, label));
    add('Вид сбоку', view === 'side', () => { view = 'side'; draw(); });
    add('Вид сверху', view === 'top', () => { view = 'top'; draw(); });
    tabs.append(h('span', { style: { flex: '1' } }));
    add('Изучать', mode === 'explore', () => { mode = 'explore'; draw(); });
    add('Найди на схеме', mode === 'find', () => { mode = 'find'; draw(); });
    add('Назови деталь', mode === 'name', () => { mode = 'name'; draw(); });
  };

  const spots = () => [...svg.querySelectorAll<SVGGElement>('.hotspot')];
  const clearMarks = () => spots().forEach((g) => g.classList.remove('sel', 'right', 'wrong'));
  const spot = (term: string) => svg.querySelector<SVGGElement>(`.hotspot[data-term="${term}"]`);

  function draw(): void {
    setTabs();
    clear(diagram);
    svg = buildSvg(view);
    diagram.append(svg);
    clear(side);
    if (mode === 'explore') explore();
    else if (mode === 'find') find();
    else name();
  }

  function explore(): void {
    const labelsBtn = h('label', { class: 'small row' }, h('input', { type: 'checkbox', onChange: (e: Event) => diagram.classList.toggle('show-labels', (e.target as HTMLInputElement).checked) }), 'Показать подписи на схеме');
    const info = h('div', { class: 'feedback' }, 'Нажмите на точку на схеме или на название в списке.');
    const list = h('ol', { class: 'part-list small' });
    const select = (term: string) => {
      clearMarks();
      spot(term)?.classList.add('sel');
      const t = TERM_BY_ID[term];
      clear(info);
      info.append(h('div', { style: { fontSize: '18px', fontWeight: '700' } }, t.ru), en(t.en), h('p', { style: { margin: '6px 0 0' } }, t.defRu), h('p', { class: 'small', style: { margin: '4px 0 0' } }, en(t.defEn)));
    };
    HOTSPOTS[view].forEach((hs) => {
      list.append(h('li', { style: { cursor: 'pointer', padding: '2px 0' }, onClick: () => select(hs.term) }, TERM_BY_ID[hs.term].ru, ' — ', en(TERM_BY_ID[hs.term].en)));
    });
    spots().forEach((g) => g.addEventListener('click', () => select(g.dataset.term!)));
    diagram.classList.remove('show-labels');
    side.append(labelsBtn, info, h('h3', null, 'Все детали'), list);
  }

  function find(): void {
    const order = shuffle(HOTSPOTS[view].map((x) => x.term));
    let i = 0, score = 0, tries = 0;
    const prompt = h('div', { style: { fontSize: '20px', fontWeight: '700' } });
    const fb = h('div', { class: 'feedback' });
    const stat = h('div', { class: 'small muted' });
    const ask = () => {
      clearMarks();
      tries = 0;
      if (i >= order.length) {
        clear(prompt); prompt.append(`Готово: ${score} из ${order.length} с первой попытки`);
        clear(fb); fb.append(h('button', { class: 'btn', onClick: () => draw() }, 'Ещё раз'));
        return;
      }
      const t = TERM_BY_ID[order[i]];
      clear(prompt); prompt.append('Где: ', t.ru, '? ', en(t.en, 'small'));
      stat.textContent = `${i + 1} / ${order.length} · с первой попытки: ${score}`;
    };
    spots().forEach((g) => g.addEventListener('click', () => {
      if (i >= order.length) return;
      const target = order[i];
      if (g.dataset.term === target) {
        if (tries === 0) score++;
        g.classList.add('right');
        clear(fb); fb.className = 'feedback ok'; fb.append('Верно! ', TERM_BY_ID[target].defRu);
        i++;
        setTimeout(ask, 900);
      } else {
        tries++;
        g.classList.add('wrong');
        clear(fb); fb.className = 'feedback bad'; fb.append('Это ', h('b', null, TERM_BY_ID[g.dataset.term!].ru), '. Попробуйте ещё.');
        if (tries >= 3) spot(target)?.classList.add('sel');
      }
    }));
    side.append(prompt, stat, fb);
    ask();
  }

  function name(): void {
    const order = shuffle(HOTSPOTS[view].map((x) => x.term));
    let i = 0, score = 0;
    const box = h('div');
    const ask = () => {
      clearMarks();
      clear(box);
      if (i >= order.length) {
        box.append(h('div', { style: { fontSize: '20px', fontWeight: '700' } }, `Готово: ${score} из ${order.length}`), h('button', { class: 'btn', onClick: () => draw() }, 'Ещё раз'));
        return;
      }
      const term = order[i];
      spot(term)?.classList.add('sel');
      const others = shuffle(HOTSPOTS[view].map((x) => x.term).filter((t) => t !== term)).slice(0, 3);
      const opts = shuffle([term, ...others]);
      const fb = h('div');
      const list = h('div', { class: 'options' });
      for (const o of opts) {
        const b = h('button', null, TERM_BY_ID[o].ru, ' ', en(TERM_BY_ID[o].en, 'small'));
        b.addEventListener('click', () => {
          for (const x of list.querySelectorAll('button')) x.disabled = true;
          const ok = o === term;
          if (ok) score++;
          b.classList.add(ok ? 'correct' : 'wrong');
          list.children[opts.indexOf(term)].classList.add('correct');
          fb.className = `feedback ${ok ? 'ok' : 'bad'}`;
          fb.append(TERM_BY_ID[term].defRu);
          fb.append(h('div', null, h('button', { class: 'btn small', style: { marginTop: '8px' }, onClick: () => { i++; ask(); } }, 'Дальше')));
        });
        list.append(b);
      }
      box.append(h('div', { style: { fontSize: '18px', fontWeight: '700' } }, 'Как называется отмеченная деталь?'), h('div', { class: 'small muted' }, `${i + 1} / ${order.length} · верно: ${score}`), list, fb);
    };
    side.append(box);
    ask();
  }

  root.append(h('h1', null, 'Устройство швертбота ', en('Parts of a dinghy', 'small')),
    h('p', { class: 'sub' }, 'Учебный швертбот с гротом и стакселем (обобщённая схема, не конкретный класс).'),
    tabs, h('div', { class: 'parts-layout' }, diagram, side));
  draw();
}
