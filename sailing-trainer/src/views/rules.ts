import { h, en, clear } from '../lib/dom';
import { generate, judge, questionRu, tackOf, TACK_RU } from '../rules/rightOfWay';
import { scenarioSvg } from '../rules/scenarioSvg';

export function rulesView(root: HTMLElement): () => void {
  let score = 0, total = 0, streak = 0;
  const pic = h('div', { class: 'scenario panel', style: { padding: '6px' } });
  const side = h('div', { class: 'panel' });

  function next(): void {
    const sc = generate();
    const v = judge(sc);
    clear(pic);
    pic.innerHTML = scenarioSvg(sc);
    clear(side);
    const fb = h('div');
    const opts = h('div', { class: 'options' });
    const mark = (ok: boolean) => {
      total++;
      if (ok) { score++; streak++; } else streak = 0;
      stat.textContent = `Верно: ${score} из ${total} · серия: ${streak}`;
      nextBtn.style.display = '';
    };
    if (sc.choices) {
      // Multiple-choice situation (e.g. rule 17: the stand-on vessel's duty to act).
      sc.choices.forEach((c, i) => {
        const b = h('button', null, h('kbd', null, String(i + 1)), ' ', c.ru);
        b.addEventListener('click', () => {
          for (const x of opts.querySelectorAll('button')) x.disabled = true;
          b.classList.add(c.correct ? 'correct' : 'wrong');
          opts.children[sc.choices!.findIndex((x) => x.correct)].classList.add('correct');
          fb.className = `feedback ${c.correct ? 'ok' : 'bad'}`;
          fb.append(h('b', null, c.correct ? 'Верно! ' : 'Неверно. '), sc.whyRu ?? '', h('div', { class: 'small muted' }, sc.ruleRu ?? ''));
          mark(c.correct);
        });
        opts.append(b);
      });
    } else {
      const choices: { label: string; val: 'own' | 'other' }[] = [
        { label: 'Я (синяя лодка) уступаю дорогу', val: 'own' },
        { label: 'Другое судно (красное) уступает', val: 'other' },
      ];
      choices.forEach((c, i) => {
        const b = h('button', null, h('kbd', null, String(i + 1)), ' ', c.label);
        b.addEventListener('click', () => {
          for (const x of opts.querySelectorAll('button')) x.disabled = true;
          const ok = c.val === v.giveWay;
          b.classList.add(ok ? 'correct' : 'wrong');
          opts.children[choices.findIndex((x) => x.val === v.giveWay)].classList.add('correct');
          fb.className = `feedback ${ok ? 'ok' : 'bad'}`;
          const tacks = sc.other.type === 'sail'
            ? h('div', { class: 'small' }, `Вы: ${TACK_RU[tackOf(sc.own, sc.windFrom)]}; другая лодка: ${TACK_RU[tackOf(sc.other, sc.windFrom)]}.`)
            : h('div', { class: 'small' }, `Вы: ${TACK_RU[tackOf(sc.own, sc.windFrom)]}.`);
          fb.append(h('b', null, ok ? 'Верно! ' : 'Неверно. '), v.whyRu, tacks, h('div', { class: 'small muted' }, v.ruleRu, ' · ', en(v.ruleEn)),
            v.giveWay === 'own' ? h('div', { class: 'small' }, 'Уступая, меняйте курс заранее и явно — обычно отворачивая за корму другого судна.') :
              h('div', { class: 'small' }, 'Вы — привилегированное судно: сохраняйте курс и скорость, но будьте готовы действовать, если другой не уступает (правило 17).'));
          mark(ok);
        });
        opts.append(b);
      });
    }
    const nextBtn = h('button', { class: 'btn', style: { marginTop: '10px', display: 'none' }, onClick: next }, 'Следующая ситуация');
    side.append(h('div', { style: { fontSize: '17px', fontWeight: '600' } }, questionRu(sc)), stat, opts, fb, nextBtn);
  }
  const stat = h('div', { class: 'small muted' }, 'Верно: 0 из 0');
  const onKey = (e: KeyboardEvent) => {
    const btns = [...side.querySelectorAll<HTMLButtonElement>('.options button')];
    const n = Number(e.key);
    if (n >= 1 && n <= btns.length && !btns[n - 1].disabled) btns[n - 1].click();
    else if (e.key === 'Enter') side.querySelector<HTMLButtonElement>('.btn:not([style*="none"])')?.click();
  };
  window.addEventListener('keydown', onKey);

  root.append(
    h('h1', null, 'Правила расхождения ', en('Right of way', 'small')),
    h('p', { class: 'sub' }, 'Пунктир — курс судна. Стрелка «ВЕТЕР» показывает, куда дует ветер. Гик на рисунке — на подветренном борту.'),
    h('div', { class: 'rules-layout' }, pic, side),
    h('details', { class: 'panel', style: { marginTop: '14px' } },
      h('summary', null, h('b', null, 'Шпаргалка')),
      h('ul', null,
        h('li', null, 'Разные галсы: уступает лодка левого галса (ветер дует в левый борт, гик справа).'),
        h('li', null, 'Один галс: уступает наветренная лодка.'),
        h('li', null, 'Обгоняющее судно уступает всегда — даже парусное моторному.'),
        h('li', null, 'Моторное уступает парусному (если не обгоняется им и не стеснено в узкости). Парусник под мотором (конус вершиной вниз) — моторное судно.'),
        h('li', null, 'Большое судно: в открытом море уступает оно; в узкости и системе разделения движения — не мешайте ему вы (правила 9, 10).'),
        h('li', null, 'Парусное уступает судну, занятому ловом рыбы (два конуса вершинами вместе), ограниченному в манёвре (шар–ромб–шар) и лишённому возможности управляться (два шара).'),
        h('li', null, 'Привилегированное судно держит курс и скорость, но если уступающее не маневрирует — 5 коротких сигналов и действуйте сами (правило 17).'),
        h('li', null, 'Внутренние воды (CEVNI): малые суда уступают большим; малые моторные — всем малым; гребные — парусным.'),
        h('li', null, 'Галс определяется бортом, противоположным гику. На фордевинде смотрите, где гик.'),
      )),
  );
  next();
  return () => window.removeEventListener('keydown', onKey);
}
