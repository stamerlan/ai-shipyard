export type Who = 'helm' | 'crew' | 'boat' | 'all';

export const WHO_LABEL: Record<Who, { ru: string; en: string }> = {
  helm: { ru: 'Рулевой', en: 'Helm' },
  crew: { ru: 'Экипаж', en: 'Crew' },
  boat: { ru: 'Лодка', en: 'Boat' },
  all: { ru: 'Все', en: 'All' },
};

export interface Step {
  who: Who;
  ru: string;
  en: string;
  /** A spoken command/answer for this step, if any. */
  cmd?: { ru: string; en: string };
}

export interface Maneuver {
  id: string;
  ru: string;
  en: string;
  introRu: string;
  steps: Step[];
  tipsRu: string[];
}

export const MANEUVERS: Maneuver[] = [
  {
    id: 'tack',
    ru: 'Поворот оверштаг',
    en: 'Tacking',
    introRu: 'Смена галса носом через линию ветра. Швертбот с экипажем из двух человек: рулевой и шкотовый.',
    steps: [
      { who: 'helm', ru: 'Осмотреться: свободно ли с наветренной стороны и за кормой; лодка идёт бейдевиндом и имеет хороший ход.', en: 'Look around to windward and astern; make sure the boat is close-hauled with good speed.' },
      { who: 'helm', ru: 'Подать предварительную команду.', en: 'Give the warning call.', cmd: { ru: '«К повороту оверштаг приготовиться!»', en: '"Ready about!"' } },
      { who: 'crew', ru: 'Освободить рабочий стаксель-шкот из стопора, держать его в руке, проверить новый шкот. Ответить.', en: 'Uncleat the working jib sheet, hold it, check the new sheet. Reply.', cmd: { ru: '«Готов!»', en: '"Ready!"' } },
      { who: 'helm', ru: 'Подать исполнительную команду и плавно отвести румпель под ветер (от себя).', en: 'Give the executive call and push the tiller smoothly to leeward (away from you).', cmd: { ru: '«Поворот!»', en: '"Lee-ho!" (or "Tacking!")' } },
      { who: 'boat', ru: 'Лодка приводится, паруса заполаскивают, нос проходит линию ветра.', en: 'The boat luffs up, the sails flap and the bow passes through the wind.' },
      { who: 'all', ru: 'Когда нос прошёл линию ветра — смена борта: экипаж отдаёт старый стаксель-шкот, оба пригибаются под гиком и переходят на новый наветренный борт.', en: 'Once the bow is through the wind, change sides: release the old jib sheet, both duck under the boom and cross to the new windward side.', cmd: { ru: '«Смена борта!»', en: '"Change sides!"' } },
      { who: 'helm', ru: 'Сменить руки на румпеле и грота-шкоте, выровнять румпель и лечь на новый курс бейдевинд.', en: 'Swap hands on tiller and mainsheet, centre the tiller and settle on the new close-hauled course.' },
      { who: 'crew', ru: 'Выбрать новый стаксель-шкот, откренить лодку, набрать ход.', en: 'Sheet in the new jib sheet, flatten the boat, build speed.' },
    ],
    tipsRu: [
      'Слишком медленный поворот — лодка «зависает» в левентике. Слишком резкий — руль тормозит лодку.',
      'Если застряли в левентике: обстените стаксель (вынесите его на ветер) — нос сам уйдёт под ветер.',
      'Не выбирайте стаксель на новом галсе раньше, чем нос пройдёт линию ветра.',
    ],
  },
  {
    id: 'gybe',
    ru: 'Поворот фордевинд',
    en: 'Gybing',
    introRu: 'Смена галса кормой через линию ветра. Гик перелетает на другой борт — главное держать его под контролем.',
    steps: [
      { who: 'helm', ru: 'Осмотреться: свободно ли с подветренной стороны и по курсу. Лечь на курс фордевинд.', en: 'Look around to leeward and ahead. Settle on a run.' },
      { who: 'helm', ru: 'Подать предварительную команду.', en: 'Give the warning call.', cmd: { ru: '«К повороту фордевинд приготовиться!»', en: '"Stand by to gybe!"' } },
      { who: 'crew', ru: 'Приготовить стаксель-шкоты, проверить, что шверт немного опущен (примерно на четверть). Ответить.', en: 'Prepare the jib sheets, check the centreboard is about a quarter down. Reply.', cmd: { ru: '«Готов!»', en: '"Ready!"' } },
      { who: 'helm', ru: 'Подобрать грота-шкот, чтобы гик не пролетел через всю лодку.', en: 'Pull in some mainsheet so the boom cannot swing across uncontrolled.' },
      { who: 'helm', ru: 'Подать исполнительную команду и плавно положить румпель на ветер (на себя). Корма проходит линию ветра.', en: 'Give the executive call and pull the tiller gently to windward (towards you). The stern passes through the wind.', cmd: { ru: '«Поворот!»', en: '"Gybe-ho!"' } },
      { who: 'all', ru: 'Гик перебрасывается — смена борта: оба пригибаются и переходят на новый наветренный борт; рулевой помогает гику перейти, взявшись за грота-шкот.', en: 'The boom swings across — change sides: both duck and cross to the new windward side; the helm guides the boom over with the mainsheet.', cmd: { ru: '«Смена борта!»', en: '"Change sides!"' } },
      { who: 'helm', ru: 'Сразу одержать — румпель в нейтраль, чтобы лодку не забросило к ветру. Потравить грота-шкот, стаксель перекинуть на новый борт.', en: 'Immediately straighten the tiller so the boat does not round up. Ease the mainsheet and set the jib on the new side.' },
    ],
    tipsRu: [
      'Неконтролируемый поворот фордевинд в свежий ветер — частая причина опрокидывания и травм.',
      'Если ветер слишком сильный, вместо фордевинда сделайте оверштаг («поворот через левентик»).',
      'Шверт не поднимайте полностью: без него лодка очень неустойчива при перекладке гика.',
    ],
  },
  {
    id: 'mob',
    ru: 'Человек за бортом',
    en: 'Man overboard',
    introRu: 'Порядок действий на швертботе, когда один из экипажа упал в воду (вариант с поворотом оверштаг).',
    steps: [
      { who: 'all', ru: 'Громко подать сигнал тревоги.', en: 'Shout the alarm loudly.', cmd: { ru: '«Человек за бортом!»', en: '"Man overboard!"' } },
      { who: 'helm', ru: 'Бросить спасательный круг или конец; постоянно держать человека в поле зрения (если есть третий — он только наблюдает и показывает рукой).', en: 'Throw a lifebuoy or line; keep the person in sight at all times (a spotter points continuously).' },
      { who: 'helm', ru: 'Лечь на курс галфвинд и отойти на несколько корпусов, чтобы было место для манёвра.', en: 'Sail away on a beam reach for a few boat lengths to get room to manoeuvre.' },
      { who: 'helm', ru: 'Сделать поворот оверштаг (он безопаснее фордевинда).', en: 'Tack (safer than a gybe).' },
      { who: 'helm', ru: 'Возвращаться курсом полный бейдевинд, на котором ход легко гасить, потравливая паруса.', en: 'Return on a close reach, where you can control speed by easing the sails.' },
      { who: 'helm', ru: 'Остановиться так, чтобы человек оказался у наветренного борта в районе вант; паруса полностью потравлены и полощут.', en: 'Stop with the person at the windward side near the shroud; sails fully eased and flapping.' },
      { who: 'helm', ru: 'Помочь человеку подняться на борт через наветренный борт, не давая лодке опрокинуться.', en: 'Help the person aboard over the windward side, keeping the boat upright.' },
    ],
    tipsRu: [
      'Подход курсом полный бейдевинд — главное правило: на нём можно и остановиться, и снова набрать ход.',
      'Если подойти фордевиндом, ход погасить невозможно — лодка проскочит мимо или ударит человека.',
    ],
  },
  {
    id: 'capsize',
    ru: 'Опрокидывание и постановка лодки',
    en: 'Capsize recovery',
    introRu: 'Метод «ковша» (scoop): рулевой ставит лодку, шкотовый «зачерпывается» в кокпит.',
    steps: [
      { who: 'all', ru: 'Убедиться, что все целы; держаться за лодку и не уплывать от неё.', en: 'Check everyone is OK; stay with the boat.' },
      { who: 'all', ru: 'Отдать шкоты, чтобы паруса не держали воду, и не дать лодке перевернуться вверх дном.', en: 'Release the sheets so the sails don’t hold water, and stop the boat going turtle.' },
      { who: 'helm', ru: 'Переплыть к шверту (вокруг кормы, держась за лодку), убедиться, что шверт полностью выдвинут.', en: 'Swim round the stern to the centreboard and make sure it is fully down.' },
      { who: 'crew', ru: 'Находиться в воде внутри корпуса у банки, подать рулевому верхний стаксель-шкот.', en: 'Float inside the hull by the thwart and pass the top jib sheet to the helm.' },
      { who: 'helm', ru: 'Взобраться на шверт ближе к корпусу и, держась за стаксель-шкот, откидываться назад — мачта поднимается.', en: 'Climb onto the centreboard near the hull and lean back on the jib sheet — the mast lifts.' },
      { who: 'boat', ru: 'Лодка встаёт и «зачерпывает» шкотового в кокпит; тот сразу откренивает.', en: 'The boat comes upright and scoops the crew into the cockpit; the crew balances it.' },
      { who: 'all', ru: 'Шкотовый помогает рулевому подняться на борт; вычерпать воду, выбрать шкоты и продолжить движение.', en: 'Crew helps the helm aboard; bail out, sheet in and sail on.' },
    ],
    tipsRu: [
      'Никогда не уплывайте от лодки — её проще увидеть, и она держит на плаву.',
      'Не вставайте на конец шверта — его можно сломать; держитесь ближе к корпусу.',
    ],
  },
  {
    id: 'depart',
    ru: 'Отход от бона (ветер с берега)',
    en: 'Leaving a pontoon (offshore wind)',
    introRu: 'Простейший случай: ветер отжимной, лодка стоит носом к ветру.',
    steps: [
      { who: 'all', ru: 'Поставить лодку носом к ветру и поднять паруса — пока лодка в левентике, паруса просто полощут.', en: 'Hold the boat head to wind and hoist the sails — they just flap.' },
      { who: 'helm', ru: 'Навесить руль, опустить шверт частично (по глубине), разобрать шкоты.', en: 'Fit the rudder, lower the centreboard partly (depending on depth), sort out the sheets.' },
      { who: 'helm', ru: 'Выбрать сторону отхода и проверить, что путь свободен.', en: 'Choose which way to leave and check the way is clear.' },
      { who: 'helm', ru: 'Подать команду; экипаж отдаёт фалинь и отталкивает нос в сторону выбранного галса.', en: 'Give the order; the crew lets go the painter and pushes the bow off.', cmd: { ru: '«Отдать швартов!»', en: '"Let go!" / "Cast off!"' } },
      { who: 'all', ru: 'Выбрать шкоты, набрать ход, затем опустить шверт полностью.', en: 'Sheet in, build speed, then lower the centreboard fully.' },
    ],
    tipsRu: ['При прижимном ветре сначала отведите лодку (на вёслах или вдоль бона) туда, где можно встать носом к ветру.'],
  },
  {
    id: 'approach',
    ru: 'Подход к бону или бую',
    en: 'Coming alongside / picking up a buoy',
    introRu: 'Последний отрезок подхода — против ветра: лодка гасит ход в левентике.',
    steps: [
      { who: 'helm', ru: 'Оценить ветер и выбрать точку остановки. Выбрать курс, при котором последний отрезок — полный бейдевинд к точке.', en: 'Assess the wind and pick the stopping point, so the final leg is a close reach to it.' },
      { who: 'crew', ru: 'Заранее приготовить фалинь; при малой глубине — приподнять шверт.', en: 'Prepare the painter in advance; raise the centreboard if shallow.' },
      { who: 'helm', ru: 'Выйти под ветер от точки и идти к ней, регулируя скорость потравливанием шкотов.', en: 'Get downwind of the point and approach it, controlling speed by easing the sheets.' },
      { who: 'helm', ru: 'За несколько метров привестись в левентик: паруса полощут, лодка гасит ход.', en: 'A few metres away, luff up head to wind: sails flap and the boat slows.' },
      { who: 'crew', ru: 'Взять бон или буй и закрепить фалинь.', en: 'Take hold of the pontoon or buoy and make the painter fast.', cmd: { ru: '«Закрепить швартов!»', en: '"Make fast!"' } },
      { who: 'all', ru: 'Убрать паруса.', en: 'Lower the sails.' },
    ],
    tipsRu: ['Лодка проходит по инерции 1–3 корпуса — начинайте приводиться заранее.', 'Не подходите к бону курсом фордевинд: остановиться будет невозможно.'],
  },
  {
    id: 'heave_to',
    ru: 'Остановка (лечь в дрейф)',
    en: 'Stopping (lying to)',
    introRu: 'Как остановиться на воде, не убирая парусов.',
    steps: [
      { who: 'helm', ru: 'Лечь на курс полный бейдевинд — галфвинд.', en: 'Settle on a close reach or beam reach.' },
      { who: 'all', ru: 'Полностью потравить грота-шкот и стаксель-шкот.', en: 'Let both sheets right out.' },
      { who: 'boat', ru: 'Паруса заполаскивают, лодка теряет ход и медленно дрейфует.', en: 'The sails flap; the boat loses speed and drifts slowly.' },
      { who: 'helm', ru: 'Держать румпель немного под ветер, чтобы лодка не уваливалась.', en: 'Keep the tiller slightly to leeward so the boat does not bear away.' },
      { who: 'all', ru: 'Чтобы тронуться: выбрать шкоты и, если нужно, увалиться на нужный курс.', en: 'To go again: sheet in and bear away onto your course.' },
    ],
    tipsRu: ['Если лодка уваливается и паруса наполняются — значит курс слишком полный: приведитесь.'],
  },
];

export interface Command {
  id: string;
  situationRu: string;
  ru: string;
  en: string;
}

export const COMMANDS: Command[] = [
  { id: 'c_ready_about', situationRu: 'Рулевой предупреждает экипаж о повороте оверштаг', ru: 'К повороту оверштаг приготовиться!', en: 'Ready about!' },
  { id: 'c_ready', situationRu: 'Экипаж сообщает, что готов к повороту', ru: 'Готов!', en: 'Ready!' },
  { id: 'c_lee_ho', situationRu: 'Рулевой начинает поворот оверштаг', ru: 'Поворот!', en: 'Lee-ho! (Tacking!)' },
  { id: 'c_stand_by_gybe', situationRu: 'Рулевой предупреждает о повороте фордевинд', ru: 'К повороту фордевинд приготовиться!', en: 'Stand by to gybe!' },
  { id: 'c_gybe_ho', situationRu: 'Рулевой начинает поворот фордевинд', ru: 'Поворот! (через фордевинд)', en: 'Gybe-ho!' },
  { id: 'c_change_sides', situationRu: 'При повороте паруса перекидываются — экипаж пересаживается и перекидывает стаксель', ru: 'Смена борта!', en: 'Change sides!' },
  { id: 'c_boom', situationRu: 'Предупреждение, что гик сейчас пройдёт над кокпитом', ru: 'Гик!', en: 'Boom! (Watch the boom!)' },
  { id: 'c_mob', situationRu: 'Человек упал в воду', ru: 'Человек за бортом!', en: 'Man overboard!' },
  { id: 'c_sheet_in_main', situationRu: 'Нужно подтянуть грот', ru: 'Выбрать грота-шкот!', en: 'Sheet in the main!' },
  { id: 'c_ease_jib', situationRu: 'Нужно отпустить стаксель', ru: 'Потравить стаксель-шкот!', en: 'Ease the jib!' },
  { id: 'c_let_go', situationRu: 'Отход от причала: освободить швартов', ru: 'Отдать швартов!', en: 'Let go! (Cast off!)' },
  { id: 'c_make_fast', situationRu: 'Подход к причалу: закрепить лодку', ru: 'Закрепить швартов!', en: 'Make fast!' },
  { id: 'c_hoist', situationRu: 'Поднять главный парус', ru: 'Грот поднять!', en: 'Hoist the main!' },
  { id: 'c_lower', situationRu: 'Опустить главный парус', ru: 'Грот спустить (убрать)!', en: 'Lower the main!' },
  { id: 'c_hike', situationRu: 'Лодку сильно кренит, экипаж должен вывеситься', ru: 'Откренивать!', en: 'Hike out!' },
  { id: 'c_board_down', situationRu: 'Перед курсом бейдевинд опустить шверт', ru: 'Шверт опустить!', en: 'Centreboard down!' },
  { id: 'c_board_up', situationRu: 'На мелководье или фордевинде поднять шверт', ru: 'Шверт поднять!', en: 'Centreboard up!' },
  { id: 'c_steady', situationRu: 'Не менять курс', ru: 'Так держать!', en: 'Steady as you go! (Hold your course!)' },
  { id: 'c_luff', situationRu: 'Сменить курс ближе к ветру', ru: 'Привестись!', en: 'Luff up! (Head up!)' },
  { id: 'c_bear_away', situationRu: 'Сменить курс дальше от ветра', ru: 'Увалиться!', en: 'Bear away!' },
];

export interface Situation {
  id: string;
  qRu: string;
  qEn: string;
  options: { ru: string; en: string }[];
  /** Index of the correct option. */
  answer: number;
  whyRu: string;
}

export const SITUATIONS: Situation[] = [
  { id: 'sit_luff', qRu: 'На постоянном курсе грот полощет у передней шкаторины. Что сделать?', qEn: 'On a steady course the mainsail flaps at the luff. What do you do?',
    options: [{ ru: 'Выбрать грота-шкот', en: 'Sheet in the main' }, { ru: 'Потравить грота-шкот', en: 'Ease the main' }, { ru: 'Поднять шверт', en: 'Raise the centreboard' }, { ru: 'Привестись', en: 'Luff up' }],
    answer: 0, whyRu: 'Парус полощет — он слишком потравлен для этого курса. Выберите шкот (или увалитесь).' },
  { id: 'sit_gust', qRu: 'Налетел порыв, лодку сильно кренит. Что сделать в первую очередь?', qEn: 'A gust hits and the boat heels hard. What first?',
    options: [{ ru: 'Потравить грота-шкот и откренивать', en: 'Ease the main and hike' }, { ru: 'Выбрать все шкоты', en: 'Sheet everything in' }, { ru: 'Увалиться на фордевинд', en: 'Bear away to a run' }, { ru: 'Поднять шверт', en: 'Raise the centreboard' }],
    answer: 0, whyRu: 'Потравленный грот сразу уменьшает кренящую силу, а вес экипажа на борту её компенсирует. Можно также немного привестись.' },
  { id: 'sit_irons', qRu: 'Лодка застряла в левентике и не слушается руля. Что поможет?', qEn: 'The boat is stuck head to wind (in irons). What helps?',
    options: [{ ru: 'Обстенить стаксель', en: 'Back the jib' }, { ru: 'Выбрать грота-шкот до упора', en: 'Sheet the main in hard' }, { ru: 'Поднять шверт', en: 'Raise the centreboard' }, { ru: 'Ждать порыва', en: 'Wait for a gust' }],
    answer: 0, whyRu: 'Стаксель, вынесенный на ветер, отталкивает нос в сторону. При заднем ходе румпель действует наоборот.' },
  { id: 'sit_gybe_strong', qRu: 'Идёте фордевиндом в сильный ветер, нужно сменить галс. Что безопаснее?', qEn: 'Running in strong wind, you need to change tack. What is safer?',
    options: [{ ru: 'Привестись и сделать поворот оверштаг', en: 'Head up and tack round' }, { ru: 'Резкий поворот фордевинд', en: 'A quick gybe' }, { ru: 'Поворот фордевинд с потравленным гротом', en: 'Gybe with the main fully eased' }, { ru: 'Поднять шверт и поворачивать', en: 'Raise the board and turn' }],
    answer: 0, whyRu: 'Поворот через левентик дольше, но гик не перелетает под нагрузкой — риск опрокидывания минимален.' },
  { id: 'sit_board_run', qRu: 'На каком курсе шверт поднимают сильнее всего?', qEn: 'On which point of sail is the centreboard raised the most?',
    options: [{ ru: 'Фордевинд', en: 'Run' }, { ru: 'Бейдевинд', en: 'Close-hauled' }, { ru: 'Галфвинд', en: 'Beam reach' }, { ru: 'Полный бейдевинд', en: 'Close reach' }],
    answer: 0, whyRu: 'На фордевинде боковой силы почти нет, а шверт только тормозит. Полностью не поднимайте — для устойчивости и поворотов.' },
  { id: 'sit_leeway', qRu: 'На бейдевинде лодку сильно сносит боком. Что проверить?', qEn: 'Close-hauled, the boat is drifting sideways a lot. What do you check?',
    options: [{ ru: 'Опущен ли шверт', en: 'Is the centreboard down?' }, { ru: 'Поднят ли руль', en: 'Is the rudder raised?' }, { ru: 'Потравлен ли стаксель', en: 'Is the jib eased?' }, { ru: 'Закреплён ли фалинь', en: 'Is the painter secured?' }],
    answer: 0, whyRu: 'Шверт создаёт боковое сопротивление. На острых курсах он должен быть опущен полностью.' },
  { id: 'sit_header', qRu: 'Вы идёте бейдевиндом, ветер «заходит» (смещается к носу). Что делать?', qEn: 'Close-hauled, you get a header. What do you do?',
    options: [{ ru: 'Увалиться или сделать поворот оверштаг', en: 'Bear away or tack' }, { ru: 'Привестись', en: 'Luff up' }, { ru: 'Потравить шкоты', en: 'Ease the sheets' }, { ru: 'Ничего', en: 'Nothing' }],
    answer: 0, whyRu: 'Заход ветра загоняет в мёртвую зону. Уваливайтесь по ветру, а при лавировке заход — повод сменить галс.' },
  { id: 'sit_stop', qRu: 'Как быстрее всего остановить швертбот под парусами?', qEn: 'Quickest way to stop a dinghy under sail?',
    options: [{ ru: 'Привестись в левентик', en: 'Luff up head to wind' }, { ru: 'Увалиться на фордевинд', en: 'Bear away to a run' }, { ru: 'Выбрать шкоты', en: 'Sheet in' }, { ru: 'Поднять шверт', en: 'Raise the centreboard' }],
    answer: 0, whyRu: 'В левентике паруса не работают, и лодка быстро теряет ход. Также можно потравить шкоты на полном бейдевинде.' },
  { id: 'sit_approach', qRu: 'Каким курсом подходить к бую, чтобы остановиться у него?', qEn: 'How do you approach a buoy to stop at it?',
    options: [{ ru: 'Полным бейдевиндом, затем привестись', en: 'Close reach, then luff up' }, { ru: 'Фордевиндом', en: 'On a run' }, { ru: 'Бакштагом', en: 'On a broad reach' }, { ru: 'Любым курсом на полной скорости', en: 'Any course at full speed' }],
    answer: 0, whyRu: 'На полном бейдевинде скорость регулируется шкотами, а приведение в левентик гасит ход.' },
  { id: 'sit_gybe_main', qRu: 'Что делают с грота-шкотом перед поворотом фордевинд?', qEn: 'What do you do with the mainsheet before a gybe?',
    options: [{ ru: 'Подбирают', en: 'Pull some in' }, { ru: 'Отдают полностью', en: 'Let it go completely' }, { ru: 'Закрепляют на утке', en: 'Cleat it' }, { ru: 'Ничего', en: 'Nothing' }],
    answer: 0, whyRu: 'Подобранный шкот уменьшает размах гика — он перейдёт на другой борт контролируемо.' },
  { id: 'sit_capsize_first', qRu: 'Лодка опрокинулась. Что важнее всего сделать сразу?', qEn: 'The boat capsized. What matters most straight away?',
    options: [{ ru: 'Проверить экипаж и держаться за лодку', en: 'Check the crew and stay with the boat' }, { ru: 'Плыть к берегу за помощью', en: 'Swim to shore for help' }, { ru: 'Снять мачту', en: 'Take down the mast' }, { ru: 'Поднять шверт', en: 'Raise the centreboard' }],
    answer: 0, whyRu: 'Лодка держит на плаву и заметна спасателям. Расстояние до берега на воде обманчиво.' },
  { id: 'sit_tiller', qRu: 'Вы сидите на наветренном борту и толкаете румпель от себя. Что произойдёт?', qEn: 'Sitting to windward, you push the tiller away. What happens?',
    options: [{ ru: 'Лодка приведётся к ветру', en: 'The boat luffs up' }, { ru: 'Лодка увалится', en: 'The boat bears away' }, { ru: 'Лодка затормозит без поворота', en: 'It slows without turning' }, { ru: 'Ничего', en: 'Nothing' }],
    answer: 0, whyRu: 'Румпель под ветер (от себя) — нос идёт к ветру. Румпель на ветер (к себе) — лодка уваливается.' },
  { id: 'sit_tack_name', qRu: 'Ветер дует в левый борт. На каком вы галсе?', qEn: 'The wind is coming over the port side. Which tack are you on?',
    options: [{ ru: 'Левый галс', en: 'Port tack' }, { ru: 'Правый галс', en: 'Starboard tack' }, { ru: 'Зависит от курса', en: 'Depends on the course' }, { ru: 'Галфвинд', en: 'Beam reach' }],
    answer: 0, whyRu: 'Галс называют по борту, в который дует ветер. На левом галсе гик — справа.' },
  { id: 'sit_apparent', qRu: 'Лодка разгоняется на галфвинде. Как меняется вымпельный ветер?', qEn: 'The boat speeds up on a beam reach. How does the apparent wind change?',
    options: [{ ru: 'Смещается к носу и усиливается', en: 'Moves forward and gets stronger' }, { ru: 'Смещается к корме', en: 'Moves aft' }, { ru: 'Не меняется', en: 'Does not change' }, { ru: 'Ослабевает', en: 'Gets weaker' }],
    answer: 0, whyRu: 'Встречный поток от движения складывается с истинным ветром — вымпельный заходит к носу. Поэтому при разгоне шкоты подбирают.' },
];
