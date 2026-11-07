import { DEG, pointOfSail, type BoatState, type SailState, type Telemetry } from './physics';
import { isBlocked, type World } from './world';

export interface Hint {
  level: 'ok' | 'info' | 'warn' | 'danger';
  ru: string;
}

export const SAIL_STATE_RU: Record<SailState, string> = {
  ok: 'работает',
  luffing: 'полощет',
  over: 'перетянут',
  backed: 'обстенён',
  blanketed: 'в тени грота',
  goosewing: 'на бабочке',
};

/** Coaching hints for the current situation, most important first. */
export function hints(s: BoatState, t: Telemetry, world: World | null): Hint[] {
  const out: Hint[] = [];
  const pos = pointOfSail(t.twa);
  const heelLee = -Math.sign(t.awa || 1) * s.heel; // heel to leeward is positive

  if (world) {
    const sh = Math.sin(s.heading), ch = Math.cos(s.heading);
    for (const d of [6, 12, 20]) {
      const hit = isBlocked(world, s.x + sh * d, s.y + ch * d);
      if (hit && hit !== 'pontoon') { out.push({ level: 'danger', ru: `${hit === 'shoal' ? 'Мель' : 'Берег'} прямо по курсу (${d} м)! Меняйте курс.` }); break; }
    }
  }
  if (t.crewLeeward) out.push({ level: 'danger', ru: 'Экипаж на подветренном борту! Команда «Смена борта».' });
  if (heelLee > 30 * DEG) out.push({ level: 'danger', ru: 'Опасный крен! Потравите грота-шкот.' });
  else if (heelLee > 18 * DEG) out.push({ level: 'warn', ru: 'Сильный крен: потравите шкоты или немного приведитесь.' });

  if (s.u < -0.15) out.push({ level: 'info', ru: 'Задний ход: руль действует наоборот.' });

  if (pos === 'irons') {
    out.push({ level: 'warn', ru: t.jib.state === 'backed'
      ? 'Левентик. Стаксель обстенён — он развернёт нос; затем «Смена борта».'
      : 'Мёртвая зона: паруса не работают. Увалитесь (румпель к себе).' });
  } else {
    if (t.jib.state === 'backed' && !t.crewLeeward) out.push({ level: 'warn', ru: 'Стаксель обстенён (на наветренном борту) — «Смена борта».' });
    if (t.main.state === 'luffing') out.push({ level: 'warn', ru: 'Грот полощет — выберите грота-шкот (или увалитесь).' });
    else if (t.main.state === 'over') out.push({ level: 'warn', ru: pos === 'run' || pos === 'broad_reach' ? 'Грот перетянут — на полных курсах травите грот почти до вант.' : 'Грот перетянут — потравите грота-шкот.' });
    if (t.jib.state === 'luffing') out.push({ level: 'info', ru: 'Стаксель полощет — выберите стаксель-шкот.' });
    else if (t.jib.state === 'over') out.push({ level: 'info', ru: 'Стаксель перетянут — потравите стаксель-шкот.' });
  }

  if (Math.abs(t.awa) > 168 * DEG && Math.sign(s.boom) === Math.sign(t.awa) && Math.abs(s.boom) > 30 * DEG)
    out.push({ level: 'danger', ru: 'Ветер с подветренной стороны гика — возможен самопроизвольный поворот фордевинд!' });

  if (out.length === 0 && pos !== 'irons' && t.speed > 0.8)
    out.unshift({ level: 'ok', ru: 'Паруса настроены — так держать!' });
  return out.slice(0, 3);
}
