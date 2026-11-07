import { h, en, clear } from '../lib/dom';
import { generate, judge, questionRu, tackOf, TACK_RU } from '../rules/rightOfWay';
import { scenarioSvg } from '../rules/scenarioSvg';

export function rulesView(root: HTMLElement): void {
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
    const choices: { label: string; val: 'own' | 'other' }[] = [
      { label: 'Я (синяя лодка) уступаю дорогу', val: 'own' },
      { label: 'Другое судно (красное) уступает', val: 'other' },
    ];
    for (const c of choices) {
      const b = h('button', null, c.label);
      b.addEventListener('click', () => {
        for (const x of opts.querySelectorAll('button')) x.disabled = true;
        total++;
        const ok = c.val === v.giveWay;
        if (ok) { score++; streak++; } else streak = 0;
        b.classList.add(ok ? 'correct' : 'wrong');
        opts.children[choices.findIndex((x) => x.val === v.giveWay)].classList.add('correct');
        fb.className = `feedback ${ok ? 'ok' : 'bad'}`;
        const tacks = sc.other.type === 'sail'
          ? h('div', { class: 'small' }, `Вы: ${TACK_RU[tackOf(sc.own, sc.windFrom)]}; другая лодка: ${TACK_RU[tackOf(sc.other, sc.windFrom)]}.`)
          : h('div', { class: 'small' }, `Вы: ${TACK_RU[tackOf(sc.own, sc.windFrom)]}.`);
        fb.append(h('b', null, ok ? 'Верно! ' : 'Неверно. '), v.whyRu, tacks, h('div', { class: 'small muted' }, v.ruleRu, ' · ', en(v.ruleEn)),
          v.giveWay === 'own' ? h('div', { class: 'small' }, 'Уступая, меняйте курс заранее и явно — обычно отворачивая за корму другого судна.') :
            h('div', { class: 'small' }, 'Вы — привилегированное судно: сохраняйте курс и скорость, но будьте готовы действовать, если другой не уступает.'));
        stat.textContent = `Верно: ${score} из ${total} · серия: ${streak}`;
        nextBtn.style.display = '';
      });
      opts.append(b);
    }
    const nextBtn = h('button', { class: 'btn', style: { marginTop: '10px', display: 'none' }, onClick: next }, 'Следующая ситуация');
    side.append(h('div', { style: { fontSize: '17px', fontWeight: '600' } }, questionRu(sc)), stat, opts, fb, nextBtn);
  }
  const stat = h('div', { class: 'small muted' }, 'Верно: 0 из 0');

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
        h('li', null, 'Моторное уступает парусному (если не обгоняется им и не стеснено в узкости).'),
        h('li', null, 'Внутренние воды (CEVNI): малые суда уступают большим; малые моторные — всем малым; гребные — парусным.'),
        h('li', null, 'Галс определяется бортом, противоположным гику. На фордевинде смотрите, где гик.'),
      )),
  );
  next();
}
