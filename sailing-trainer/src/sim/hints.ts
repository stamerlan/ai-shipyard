import { DEG, pointOfSail, type BoatState, type Controls, type Telemetry } from './physics';

export interface Hint {
  level: 'ok' | 'info' | 'warn' | 'danger';
  ru: string;
  en: string;
}

/** Coaching hints for the current situation, most important first. */
export function hints(s: BoatState, c: Controls, t: Telemetry): Hint[] {
  const out: Hint[] = [];
  const pos = pointOfSail(t.twa);
  const absAwa = Math.abs(t.awa);
  const heelLee = -Math.sign(t.awa || 1) * s.heel; // heel to leeward is positive

  if (heelLee > 32 * DEG) out.push({ level: 'danger', ru: 'Опасный крен! Потравите грота-шкот и откренивайтесь.', en: 'Dangerous heel! Ease the main and hike out.' });
  else if (heelLee > 20 * DEG) out.push({ level: 'warn', ru: 'Сильный крен: потравите шкоты или откренивайтесь.', en: 'Heeling a lot: ease the sheets or hike.' });
  if (heelLee < -12 * DEG) out.push({ level: 'warn', ru: 'Лодку кренит на ветер — экипажу сесть ближе к ДП.', en: 'Heeling to windward — crew move inboard.' });

  if (s.u < -0.15) out.push({ level: 'info', ru: 'Задний ход: руль действует наоборот.', en: 'Sternway: the rudder works in reverse.' });

  if (pos === 'irons') {
    out.push({ level: 'warn', ru: 'Мёртвая зона: паруса не работают. Увалитесь (румпель на ветер, к себе).', en: 'No-go zone: the sails can’t work. Bear away (tiller to windward).' });
  } else {
    if (pos === 'run' && Math.abs(s.boom) < 55 * DEG && c.main > 0.45)
      out.push({ level: 'info', ru: 'На фордевинде потравите грот почти до вант.', en: 'On a run, ease the main almost to the shroud.' });
    else if (t.main.luffing)
      out.push({ level: 'warn', ru: 'Грот полощет — выберите грота-шкот (или увалитесь).', en: 'Main is luffing — sheet in (or bear away).' });
    else if (t.main.stalled && absAwa < 125 * DEG)
      out.push({ level: 'warn', ru: 'Грот перетянут (срыв потока) — потравите грота-шкот.', en: 'Main is over-sheeted (stalled) — ease it.' });

    if (absAwa < 140 * DEG) {
      if (t.jib.luffing) out.push({ level: 'info', ru: 'Стаксель полощет — выберите стаксель-шкот.', en: 'Jib is luffing — sheet it in.' });
      else if (t.jib.stalled) out.push({ level: 'info', ru: 'Стаксель перетянут — потравите стаксель-шкот.', en: 'Jib over-sheeted — ease it.' });
    }
  }

  if (Math.abs(t.leeway) > 9 * DEG && t.speed > 0.6 && c.board < 0.7)
    out.push({ level: 'warn', ru: 'Лодку сносит боком — опустите шверт.', en: 'Lots of leeway — lower the centreboard.' });
  if (pos === 'run' && c.board > 0.8) out.push({ level: 'info', ru: 'На фордевинде шверт можно приподнять — меньше сопротивление.', en: 'On a run you can raise the board a bit — less drag.' });

  if (absAwa > 168 * DEG && Math.sign(s.boom) === Math.sign(t.awa) && Math.abs(s.boom) > 30 * DEG)
    out.push({ level: 'danger', ru: 'Ветер заходит с подветренной стороны гика — возможен самопроизвольный поворот фордевинд!', en: 'Sailing by the lee — risk of an accidental gybe!' });

  if (!out.some((h) => h.level !== 'info') && pos !== 'irons' && t.speed > 0.8)
    out.unshift({ level: 'ok', ru: 'Паруса настроены — так держать!', en: 'Sails are trimmed — steady as you go!' });
  return out.slice(0, 3);
}
