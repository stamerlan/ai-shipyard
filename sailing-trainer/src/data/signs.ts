import { buoy, inland, flags, soundArt } from '../render/signArt';

export type SignGroup = 'lateral' | 'cardinal' | 'other_marks' | 'prohibit' | 'mandatory' | 'restrict' | 'recommend' | 'info' | 'sound' | 'flags';

export const SIGN_GROUPS: Record<SignGroup, { ru: string; en: string; noteRu?: string }> = {
  lateral: { ru: 'Латеральные знаки (МАМС, регион A)', en: 'Lateral marks (IALA A)', noteRu: 'Регион A — Европа, в т. ч. Польша. Направление ограждения — с моря в порт / вверх по реке.' },
  cardinal: { ru: 'Кардинальные знаки', en: 'Cardinal marks', noteRu: 'Знак ставят с названной стороны от опасности: обходить северный знак — с севера и т. д. Конусы топовой фигуры «показывают» на чёрные полосы.' },
  other_marks: { ru: 'Прочие знаки МАМС', en: 'Other IALA marks' },
  prohibit: { ru: 'Запрещающие знаки (A) — внутренние воды', en: 'Prohibitory signs (A) — inland', noteRu: 'Знаки CEVNI, на которых основаны польские правила плавания по внутренним водным путям.' },
  mandatory: { ru: 'Предписывающие знаки (B)', en: 'Mandatory signs (B)' },
  restrict: { ru: 'Ограничительные знаки (C)', en: 'Restriction signs (C)' },
  recommend: { ru: 'Рекомендательные знаки (D)', en: 'Recommendation signs (D)' },
  info: { ru: 'Информационные знаки (E)', en: 'Informative signs (E)' },
  sound: { ru: 'Звуковые сигналы', en: 'Sound signals', noteRu: '● — короткий звук (~1 с), ▬ — продолжительный (4–6 с). Кнопка ▶ проигрывает сигнал в ускоренном темпе.' },
  flags: { ru: 'Флаги международного свода сигналов', en: 'International code flags' },
};

export interface Sign {
  id: string;
  group: SignGroup;
  code?: string;
  ru: string;
  en: string;
  defRu: string;
  defEn: string;
  art: () => string;
  /** Sound pattern for audio playback (sound signals only). */
  sound?: string;
}

type S = Omit<Sign, 'group'>;

const lateral: S[] = [
  { id: 'iala_port', ru: 'Левая сторона фарватера', en: 'Port-hand lateral mark', art: buoy.portLateral,
    defRu: 'Красный, форма — цилиндр, топовая фигура — красный цилиндр, огонь красный. Идя по направлению ограждения, оставляйте знак слева.',
    defEn: 'Red, can-shaped, red can topmark, red light. Keep it on your port side when going in the direction of buoyage.' },
  { id: 'iala_stb', ru: 'Правая сторона фарватера', en: 'Starboard-hand lateral mark', art: buoy.starboardLateral,
    defRu: 'Зелёный, форма — конус, топовая фигура — зелёный конус вершиной вверх, огонь зелёный. Идя по направлению ограждения, оставляйте знак справа.',
    defEn: 'Green, conical, green cone topmark point up, green light. Keep it on your starboard side when going in the direction of buoyage.' },
  { id: 'iala_pref_stb', ru: 'Разделение фарватера: основной — вправо', en: 'Preferred channel to starboard', art: buoy.preferredStarboard,
    defRu: 'Красный с широкой зелёной полосой, цилиндр. Основной фарватер — справа; знак оставляют слева, как красный. Огонь красный Fl(2+1).',
    defEn: 'Red with one broad green band, can-shaped. Preferred channel is to starboard; treat it like a red port mark. Light Fl(2+1) R.' },
  { id: 'iala_pref_port', ru: 'Разделение фарватера: основной — влево', en: 'Preferred channel to port', art: buoy.preferredPort,
    defRu: 'Зелёный с широкой красной полосой, конус. Основной фарватер — слева; знак оставляют справа, как зелёный. Огонь зелёный Fl(2+1).',
    defEn: 'Green with one broad red band, conical. Preferred channel is to port; treat it like a green starboard mark. Light Fl(2+1) G.' },
];

const cardinal: S[] = [
  { id: 'card_n', ru: 'Северный кардинальный знак', en: 'North cardinal mark', art: buoy.north,
    defRu: 'Чёрный верх, жёлтый низ; два конуса вершинами вверх. Безопасная вода — к северу от знака. Огонь белый, непрерывные частые проблески (Q или VQ).',
    defEn: 'Black over yellow; two cones pointing up. Safe water lies to the north. White light, continuous quick (Q) or very quick (VQ) flashes.' },
  { id: 'card_e', ru: 'Восточный кардинальный знак', en: 'East cardinal mark', art: buoy.east,
    defRu: 'Чёрный с жёлтой широкой полосой; конусы основаниями друг к другу. Безопасная вода — к востоку. Огонь белый, 3 проблеска: Q(3) 10 с или VQ(3) 5 с.',
    defEn: 'Black with a broad yellow band; cones base to base. Safe water lies to the east. White light, 3 flashes: Q(3) 10 s or VQ(3) 5 s.' },
  { id: 'card_s', ru: 'Южный кардинальный знак', en: 'South cardinal mark', art: buoy.south,
    defRu: 'Жёлтый верх, чёрный низ; два конуса вершинами вниз. Безопасная вода — к югу. Огонь белый: 6 проблесков + длинный, Q(6)+LFl 15 с.',
    defEn: 'Yellow over black; two cones pointing down. Safe water lies to the south. White light: 6 flashes + a long flash, Q(6)+LFl 15 s.' },
  { id: 'card_w', ru: 'Западный кардинальный знак', en: 'West cardinal mark', art: buoy.west,
    defRu: 'Жёлтый с чёрной широкой полосой; конусы вершинами друг к другу. Безопасная вода — к западу. Огонь белый, 9 проблесков: Q(9) 15 с.',
    defEn: 'Yellow with a broad black band; cones point to point. Safe water lies to the west. White light, 9 flashes: Q(9) 15 s.' },
];

const otherMarks: S[] = [
  { id: 'isolated_danger', ru: 'Знак отдельной опасности', en: 'Isolated danger mark', art: buoy.isolatedDanger,
    defRu: 'Чёрный с красными полосами, топовая фигура — два чёрных шара. Ставится прямо над небольшой опасностью, вокруг — судоходная вода. Огонь белый Fl(2).',
    defEn: 'Black with red bands, two black spheres. Placed on a small danger with navigable water all around. White light Fl(2).' },
  { id: 'safe_water', ru: 'Знак безопасной воды', en: 'Safe water mark', art: buoy.safeWater,
    defRu: 'Красно-белые вертикальные полосы, топовая фигура — красный шар. Вокруг знака безопасная вода: ось фарватера, подход к порту. Огонь белый: изофазный, затмевающийся, LFl 10 с или «A» азбукой Морзе.',
    defEn: 'Red and white vertical stripes, one red sphere. Safe water all around: mid-channel or landfall. White light: Iso, Oc, LFl 10 s or Morse "A".' },
  { id: 'special_mark', ru: 'Специальный знак', en: 'Special mark', art: buoy.special,
    defRu: 'Жёлтый, топовая фигура — жёлтый крест «X». Обозначает особый район: зону купания, гоночную дистанцию, трубопровод, кабель. Огонь жёлтый.',
    defEn: 'Yellow with a yellow X topmark. Marks a special area: swimming zone, racing area, pipeline, cable. Yellow light.' },
  { id: 'wreck_mark', ru: 'Знак новой опасности (затонувшее судно)', en: 'Emergency wreck marking buoy', art: buoy.wreck,
    defRu: 'Синие и жёлтые вертикальные полосы, топовая фигура — жёлтый прямой крест. Временно ограждает новую опасность. Огонь чередующийся синий/жёлтый.',
    defEn: 'Blue and yellow vertical stripes, yellow upright cross. Temporarily marks a new danger. Alternating blue/yellow light.' },
];

const prohibit: S[] = [
  { id: 'a1', code: 'A.1', ru: 'Проход запрещён', en: 'No passage', art: inland.noPassage,
    defRu: 'Общий запрет прохода (красное полотнище с белой полосой; также пара красных огней или щитов).',
    defEn: 'General prohibition of passage (red board with a white band; also a pair of red lights or boards).' },
  { id: 'a2', code: 'A.2', ru: 'Обгон запрещён', en: 'No overtaking', art: inland.noOvertaking,
    defRu: 'На этом участке запрещено обгонять другие суда.', defEn: 'Overtaking is prohibited on this stretch.' },
  { id: 'a5', code: 'A.5', ru: 'Стоянка запрещена', en: 'No berthing', art: inland.noBerthing,
    defRu: 'Запрещено останавливаться и стоять у берега на стороне знака.', defEn: 'Berthing (lying at the bank) on the side of the sign is prohibited.' },
  { id: 'a6', code: 'A.6', ru: 'Якорная стоянка запрещена', en: 'No anchoring', art: inland.noAnchoring,
    defRu: 'Запрещено отдавать якорь (часто возле кабелей и трубопроводов).', defEn: 'Anchoring is prohibited (often near cables and pipelines).' },
  { id: 'a7', code: 'A.7', ru: 'Швартовка к берегу запрещена', en: 'No making fast to the bank', art: inland.noMakingFast,
    defRu: 'Запрещено крепить швартовы к берегу.', defEn: 'Making fast to the bank is prohibited.' },
  { id: 'a8', code: 'A.8', ru: 'Разворот запрещён', en: 'No turning', art: inland.noTurning,
    defRu: 'Запрещено разворачиваться на этом участке.', defEn: 'Turning round is prohibited here.' },
  { id: 'a9', code: 'A.9', ru: 'Не создавать волну', en: 'Do not create wash', art: inland.noWash,
    defRu: 'Сбавить ход, чтобы не создавать волну и волновой удар.', defEn: 'Avoid creating wash or suction (slow down).' },
  { id: 'a12', code: 'A.12', ru: 'Движение моторных судов запрещено', en: 'Motorised craft prohibited', art: inland.noMotor,
    defRu: 'Запрещено движение судов с двигателем.', defEn: 'Navigation by motorised craft is prohibited.' },
  { id: 'a14', code: 'A.14', ru: 'Водные лыжи запрещены', en: 'Water-skiing prohibited', art: inland.noSkiing,
    defRu: 'Запрещено катание на водных лыжах.', defEn: 'Water-skiing is prohibited.' },
  { id: 'a15', code: 'A.15', ru: 'Движение парусных судов запрещено', en: 'Sailing vessels prohibited', art: inland.noSailing,
    defRu: 'Запрещено плавание под парусами.', defEn: 'Navigation by sailing vessels is prohibited.' },
  { id: 'a16', code: 'A.16', ru: 'Движение гребных судов запрещено', en: 'Rowing (non-motorised) craft prohibited', art: inland.noRowing,
    defRu: 'Запрещено движение судов, идущих не под мотором и не под парусом (гребных).', defEn: 'Craft that are neither motorised nor under sail (e.g. rowing) are prohibited.' },
  { id: 'a17', code: 'A.17', ru: 'Виндсёрфинг запрещён', en: 'Sailboards prohibited', art: inland.noSailboards,
    defRu: 'Запрещено плавание на парусных досках.', defEn: 'Sailboards are prohibited.' },
];

const mandatory: S[] = [
  { id: 'b1', code: 'B.1', ru: 'Двигаться в направлении стрелки', en: 'Proceed in the direction of the arrow', art: inland.followArrow,
    defRu: 'Обязательно следовать в указанном направлении.', defEn: 'You must proceed in the direction shown.' },
  { id: 'b6', code: 'B.6', ru: 'Не превышать скорость', en: 'Do not exceed the speed limit', art: inland.speedLimit,
    defRu: 'Ограничение скорости в км/ч относительно берега (здесь — 12 км/ч).', defEn: 'Speed limit in km/h relative to the bank (here 12 km/h).' },
  { id: 'b11', code: 'B.11', ru: 'Установить радиосвязь', en: 'Make radiotelephone contact', art: inland.vhf,
    defRu: 'Выйти на связь по УКВ-радио на указанном канале.', defEn: 'Make VHF radio contact on the channel shown.' },
];

const restrict: S[] = [
  { id: 'c1', code: 'C.1', ru: 'Глубина ограничена', en: 'Depth of water limited', art: inland.depthLimit,
    defRu: 'Ограничение по глубине; на знаке указана доступная глубина в метрах.', defEn: 'Limited depth; the number shows the available depth in metres.' },
  { id: 'c2', code: 'C.2', ru: 'Высота прохода ограничена', en: 'Headroom limited', art: inland.headroomLimit,
    defRu: 'Ограничен надводный габарит (мост, кабель). Важно для лодки с мачтой!', defEn: 'Limited headroom (bridge, cable). Important with a mast up!' },
];

const recommend: S[] = [
  { id: 'd1a', code: 'D.1a', ru: 'Рекомендуемый проход (в обоих направлениях)', en: 'Recommended passage, both directions', art: inland.recommendedBoth,
    defRu: 'Жёлтый ромб на мосту: рекомендуется проходить здесь, движение в обе стороны.', defEn: 'Yellow diamond on a bridge: recommended span, two-way traffic.' },
  { id: 'd1b', code: 'D.1b', ru: 'Рекомендуемый проход (только в этом направлении)', en: 'Recommended passage, this direction only', art: inland.recommendedOneWay,
    defRu: 'Два жёлтых квадрата: рекомендуемый пролёт, движение навстречу запрещено.', defEn: 'Two yellow squares: recommended span, oncoming traffic prohibited.' },
];

const infoSigns: S[] = [
  { id: 'e2', code: 'E.2', ru: 'Воздушная линия электропередачи', en: 'Overhead power cable', art: inland.overheadCable,
    defRu: 'Впереди пересечение с ЛЭП. Опасно для мачты!', defEn: 'Overhead power line crossing ahead. Dangerous for a mast!' },
  { id: 'e5', code: 'E.5', ru: 'Стоянка разрешена', en: 'Berthing permitted', art: inland.berthingAllowed,
    defRu: 'Разрешено стоять у берега на стороне знака.', defEn: 'Berthing is permitted on the side of the sign.' },
  { id: 'e6', code: 'E.6', ru: 'Якорная стоянка разрешена', en: 'Anchoring permitted', art: inland.anchoringAllowed,
    defRu: 'Разрешено становиться на якорь.', defEn: 'Anchoring is permitted.' },
  { id: 'e7', code: 'E.7', ru: 'Швартовка к берегу разрешена', en: 'Making fast to the bank permitted', art: inland.makingFastAllowed,
    defRu: 'Разрешено крепить швартовы к берегу.', defEn: 'Making fast to the bank is permitted.' },
  { id: 'e15', code: 'E.15', ru: 'Моторным судам разрешено', en: 'Motorised craft permitted', art: inland.motorAllowed,
    defRu: 'Движение моторных судов разрешено.', defEn: 'Motorised craft are permitted.' },
  { id: 'e18', code: 'E.18', ru: 'Плавание под парусами разрешено', en: 'Sailing permitted', art: inland.sailingAllowed,
    defRu: 'Разрешено плавание парусных судов.', defEn: 'Sailing vessels are permitted.' },
  { id: 'e20', code: 'E.20', ru: 'Виндсёрфинг разрешён', en: 'Sailboards permitted', art: inland.sailboardsAllowed,
    defRu: 'Разрешено плавание на парусных досках.', defEn: 'Sailboards are permitted.' },
];

const snd = (p: string, rep?: string) => () => soundArt(p, rep);

const sound: S[] = [
  { id: 'snd_stb', ru: 'Изменяю курс вправо', en: 'I am altering my course to starboard', art: snd('S'), sound: 'S',
    defRu: 'Один короткий звук (МППСС и CEVNI).', defEn: 'One short blast (COLREG and CEVNI).' },
  { id: 'snd_port', ru: 'Изменяю курс влево', en: 'I am altering my course to port', art: snd('SS'), sound: 'SS',
    defRu: 'Два коротких звука.', defEn: 'Two short blasts.' },
  { id: 'snd_astern', ru: 'Мои движители работают на задний ход', en: 'I am operating astern propulsion', art: snd('SSS'), sound: 'SSS',
    defRu: 'Три коротких звука.', defEn: 'Three short blasts.' },
  { id: 'snd_doubt', ru: 'Не понимаю ваших намерений / сомневаюсь', en: 'I doubt your intentions (danger)', art: snd('SSSSS'), sound: 'SSSSS',
    defRu: 'Не менее пяти коротких частых звуков (МППСС, правило 34).', defEn: 'At least five short, rapid blasts (COLREG rule 34).' },
  { id: 'snd_attention', ru: 'Внимание', en: 'Attention', art: snd('L'), sound: 'L',
    defRu: 'Один продолжительный звук. Также: судно подходит к изгибу реки или выходит с места стоянки.', defEn: 'One prolonged blast. Also used when approaching a bend or leaving a berth.' },
  { id: 'snd_unable', ru: 'Не могу маневрировать', en: 'I am unable to manoeuvre', art: snd('SSSS'), sound: 'SSSS',
    defRu: 'Четыре коротких звука (внутренние воды, CEVNI).', defEn: 'Four short blasts (inland waters, CEVNI).' },
  { id: 'snd_overtake_stb', ru: 'Намерен обогнать вас по правому борту', en: 'I intend to overtake you on your starboard side', art: snd('LLS'), sound: 'LLS',
    defRu: 'Два продолжительных и один короткий — в узкости (МППСС, правило 34(c)).', defEn: 'Two prolonged and one short blast — in a narrow channel (COLREG 34(c)).' },
  { id: 'snd_overtake_port', ru: 'Намерен обогнать вас по левому борту', en: 'I intend to overtake you on your port side', art: snd('LLSS'), sound: 'LLSS',
    defRu: 'Два продолжительных и два коротких — в узкости.', defEn: 'Two prolonged and two short blasts — in a narrow channel.' },
  { id: 'snd_agree', ru: 'Согласен на обгон', en: 'Agreement to be overtaken', art: snd('LSLS'), sound: 'LSLS',
    defRu: 'Продолжительный, короткий, продолжительный, короткий.', defEn: 'Prolonged, short, prolonged, short.' },
  { id: 'snd_fog_sail', ru: 'Парусное судно в тумане', en: 'Sailing vessel in restricted visibility', art: snd('LSS', 'каждые 2 мин'), sound: 'LSS',
    defRu: 'Один продолжительный и два коротких не реже чем каждые 2 минуты (также стеснённые в манёвре, рыбаки, буксиры).', defEn: 'One prolonged and two short blasts at least every 2 minutes (also restricted, fishing, towing vessels).' },
  { id: 'snd_fog_power', ru: 'Судно с мех. двигателем на ходу в тумане', en: 'Power-driven vessel making way in fog', art: snd('L', 'каждые 2 мин'), sound: 'L',
    defRu: 'Один продолжительный звук не реже чем каждые 2 минуты.', defEn: 'One prolonged blast at least every 2 minutes.' },
  { id: 'snd_danger', ru: 'Опасность столкновения', en: 'Danger of collision', art: snd('vvvvvvvvvv'), sound: 'vvvvvvvvvv',
    defRu: 'Серия очень коротких звуков (внутренние воды, CEVNI).', defEn: 'A series of very short blasts (inland waters, CEVNI).' },
  { id: 'snd_distress', ru: 'Бедствие', en: 'Distress', art: snd('L L L', 'повторяется'), sound: 'L L L',
    defRu: 'Повторяющиеся продолжительные звуки или непрерывный звук туманного сигнала.', defEn: 'Repeated prolonged blasts or continuous sounding of a fog signal.' },
];

const flagSigns: S[] = [
  { id: 'flag_a', code: 'A', ru: 'Флаг «A»: у меня водолаз', en: 'Flag A: diver down, keep clear', art: flags.A,
    defRu: 'Под водой водолаз — держитесь в стороне и проходите малым ходом.', defEn: 'I have a diver down; keep well clear at slow speed.' },
  { id: 'flag_b', code: 'B', ru: 'Флаг «B»: опасный груз', en: 'Flag B: dangerous cargo', art: flags.B,
    defRu: 'Гружу, выгружаю или перевожу опасный груз.', defEn: 'I am taking in, discharging or carrying dangerous goods.' },
  { id: 'flag_c', code: 'C', ru: 'Флаг «C»: да', en: 'Flag C: yes (affirmative)', art: flags.C,
    defRu: 'Утвердительный ответ «да».', defEn: 'Affirmative — "yes".' },
  { id: 'flag_n', code: 'N', ru: 'Флаг «N»: нет', en: 'Flag N: no (negative)', art: flags.N,
    defRu: 'Отрицательный ответ «нет».', defEn: 'Negative — "no".' },
  { id: 'flag_o', code: 'O', ru: 'Флаг «O»: человек за бортом', en: 'Flag O: man overboard', art: flags.O,
    defRu: 'Человек за бортом.', defEn: 'Man overboard.' },
  { id: 'flag_v', code: 'V', ru: 'Флаг «V»: нужна помощь', en: 'Flag V: I require assistance', art: flags.V,
    defRu: 'Требуется помощь.', defEn: 'I require assistance.' },
  { id: 'flag_w', code: 'W', ru: 'Флаг «W»: нужна медицинская помощь', en: 'Flag W: I require medical assistance', art: flags.W,
    defRu: 'Требуется медицинская помощь.', defEn: 'I require medical assistance.' },
  { id: 'flag_nc', code: 'N/C', ru: 'Флаги «N» над «C»: бедствие', en: 'Flags N over C: distress', art: flags.NC,
    defRu: 'Сигнал бедствия: флаг N над флагом C.', defEn: 'Distress signal: flag N above flag C.' },
];

const BY_GROUP: Record<SignGroup, S[]> = {
  lateral, cardinal, other_marks: otherMarks, prohibit, mandatory, restrict, recommend, info: infoSigns, sound, flags: flagSigns,
};

export const SIGNS: Sign[] = (Object.keys(BY_GROUP) as SignGroup[]).flatMap((group) =>
  BY_GROUP[group].map((s) => ({ ...s, group })),
);

export const SIGN_BY_ID: Record<string, Sign> = Object.fromEntries(SIGNS.map((s) => [s.id, s]));
