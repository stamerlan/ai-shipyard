export interface Term {
  id: string;
  cat: TermCategory;
  ru: string;
  en: string;
  defRu: string;
  defEn: string;
}

export type TermCategory =
  | 'hull'
  | 'spars'
  | 'standing'
  | 'running'
  | 'sails'
  | 'courses'
  | 'actions'
  | 'wind'
  | 'knots'
  | 'safety';

export const TERM_CATEGORIES: Record<TermCategory, { ru: string; en: string }> = {
  hull: { ru: 'Корпус и направления', en: 'Hull & directions' },
  spars: { ru: 'Рангоут', en: 'Spars' },
  standing: { ru: 'Стоячий такелаж', en: 'Standing rigging' },
  running: { ru: 'Бегучий такелаж и оборудование', en: 'Running rigging & fittings' },
  sails: { ru: 'Паруса', en: 'Sails' },
  courses: { ru: 'Курсы и галсы', en: 'Points of sail & tacks' },
  actions: { ru: 'Действия и манёвры', en: 'Actions & manoeuvres' },
  wind: { ru: 'Ветер и погода', en: 'Wind & weather' },
  knots: { ru: 'Узлы и тросы', en: 'Knots & ropes' },
  safety: { ru: 'Безопасность', en: 'Safety' },
};

type Row = [id: string, ru: string, en: string, defRu: string, defEn: string];

const RAW: Record<TermCategory, Row[]> = {
  hull: [
    ['bow', 'Нос', 'Bow', 'Передняя часть лодки.', 'The front end of the boat.'],
    ['stern', 'Корма', 'Stern', 'Задняя часть лодки.', 'The back end of the boat.'],
    ['starboard', 'Правый борт', 'Starboard', 'Правая сторона лодки, если смотреть с кормы в нос.', 'The right-hand side of the boat when facing forward.'],
    ['port', 'Левый борт', 'Port', 'Левая сторона лодки, если смотреть с кормы в нос.', 'The left-hand side of the boat when facing forward.'],
    ['windward_side', 'Наветренный борт', 'Windward side', 'Борт, на который дует ветер.', 'The side of the boat the wind is blowing onto.'],
    ['leeward_side', 'Подветренный борт', 'Leeward side', 'Борт, противоположный наветренному; на нём находится гик.', 'The side away from the wind; the boom is on this side.'],
    ['hull', 'Корпус', 'Hull', 'Основная «плавающая» часть лодки без рангоута и такелажа.', 'The body of the boat, without mast and rigging.'],
    ['deck', 'Палуба', 'Deck', 'Верхнее покрытие корпуса.', 'The top surface covering the hull.'],
    ['cockpit', 'Кокпит', 'Cockpit', 'Открытое углубление в корпусе, где находится экипаж.', 'The open, recessed area where the crew sits.'],
    ['transom', 'Транец', 'Transom', 'Плоская кормовая стенка корпуса; на ней навешивается руль.', 'The flat, vertical back of the hull; the rudder hangs on it.'],
    ['gunwale', 'Планширь', 'Gunwale', 'Верхняя кромка борта.', 'The top edge of the side of the boat.'],
    ['thwart', 'Банка', 'Thwart', 'Поперечная скамья (сиденье) в лодке.', 'A seat running across the boat.'],
    ['centreboard', 'Шверт', 'Centreboard', 'Подъёмный плавник, выдвигаемый из днища; противодействует боковому сносу (дрейфу). Кинжальный шверт поднимается вертикально.', 'A retractable fin lowered through the hull to resist leeway. A daggerboard slides straight up and down.'],
    ['centreboard_case', 'Швертовый колодец', 'Centreboard case (trunk)', 'Водонепроницаемый короб в корпусе, в котором ходит шверт.', 'The watertight box in the hull that houses the centreboard.'],
    ['rudder', 'Руль (перо руля)', 'Rudder (blade)', 'Подвижная пластина за кормой, которой управляют направлением движения.', 'The movable blade at the stern used for steering.'],
    ['tiller', 'Румпель', 'Tiller', 'Рычаг, поворачивающий перо руля. Румпель в одну сторону — нос уходит в другую.', 'The lever that turns the rudder. Push it one way and the bow turns the other way.'],
    ['tiller_ext', 'Удлинитель румпеля', 'Tiller extension', 'Шарнирная ручка на конце румпеля; позволяет рулить, сидя на борту.', 'A hinged stick on the tiller, so the helm can steer while sitting out.'],
    ['pintles', 'Рулевые петли и штыри', 'Pintles and gudgeons', 'Крепление руля к транцу: штыри (pintles) входят в петли (gudgeons).', 'The hinge fittings that hold the rudder on the transom.'],
    ['hiking_straps', 'Откренивающие ремни', 'Hiking (toe) straps', 'Ремни в кокпите, за которые экипаж цепляется ногами при откренивании.', 'Straps in the cockpit to hook your feet under when hiking out.'],
    ['centreline', 'Диаметральная плоскость (ДП)', 'Centreline', 'Продольная вертикальная плоскость симметрии лодки.', 'The imaginary fore-and-aft line down the middle of the boat.'],
    ['waterline', 'Ватерлиния', 'Waterline', 'Линия, по которой вода касается корпуса.', 'The line where the water meets the hull.'],
    ['draught', 'Осадка', 'Draught (draft)', 'Глубина погружения лодки (у швертбота сильно зависит от положения шверта).', 'How deep the boat reaches below the surface.'],
    ['freeboard', 'Надводный борт', 'Freeboard', 'Высота борта от воды до палубы.', 'The height of the side of the hull above the water.'],
    ['buoyancy_tanks', 'Отсеки плавучести', 'Buoyancy tanks', 'Герметичные объёмы в корпусе, которые не дают опрокинутой лодке затонуть.', 'Sealed compartments that keep a capsized boat afloat.'],
    ['bailer', 'Черпак', 'Bailer', 'Ковш для вычерпывания воды из лодки.', 'A scoop for removing water from the boat.'],
    ['self_bailer', 'Самоотливной клапан', 'Self-bailer', 'Клапан в днище, через который вода уходит из кокпита на ходу.', 'A valve in the bottom that drains the cockpit while sailing.'],
    ['abeam', 'Траверз', 'Abeam', 'Направление перпендикулярно ДП лодки («на траверзе»).', 'At right angles to the centreline of the boat.'],
    ['ahead', 'Прямо по носу', 'Dead ahead', 'Направление точно вперёд.', 'Directly in front of the boat.'],
    ['astern', 'За кормой', 'Astern', 'Позади лодки.', 'Behind the boat.'],
  ],
  spars: [
    ['mast', 'Мачта', 'Mast', 'Вертикальное рангоутное дерево, несущее паруса.', 'The vertical spar that carries the sails.'],
    ['boom', 'Гик', 'Boom', 'Горизонтальное рангоутное дерево, к которому крепится нижняя шкаторина грота. «Гик!» — предупреждение пригнуться.', 'The horizontal spar along the foot of the mainsail. "Boom!" is a warning to duck.'],
    ['gooseneck', 'Гусёк', 'Gooseneck', 'Шарнир, соединяющий гик с мачтой.', 'The hinge joining the boom to the mast.'],
    ['masthead', 'Топ мачты', 'Masthead', 'Верхний конец мачты.', 'The top of the mast.'],
    ['mast_step', 'Степс', 'Mast step', 'Гнездо, в которое ставится нижний конец (шпор) мачты.', 'The socket the foot of the mast stands in.'],
    ['spreaders', 'Краспицы', 'Spreaders', 'Распорки на мачте, разносящие ванты в стороны.', 'Struts on the mast that push the shrouds outwards.'],
    ['vang', 'Оттяжка гика', 'Kicking strap (vang)', 'Снасть между гиком и низом мачты; тянет гик вниз и не даёт ему задираться.', 'A line or tackle pulling the boom down to control the leech of the mainsail.'],
    ['spinnaker_pole', 'Спинакер-гик', 'Spinnaker pole', 'Гик, выносящий галсовый угол спинакера на ветер.', 'The pole that holds the spinnaker out to windward.'],
    ['wind_indicator', 'Флюгарка', 'Wind indicator (burgee)', 'Указатель вымпельного ветра на топе мачты.', 'A small vane at the masthead that shows the apparent wind.'],
  ],
  standing: [
    ['standing_rigging', 'Стоячий такелаж', 'Standing rigging', 'Неподвижные тросы, удерживающие мачту.', 'The fixed wires that hold the mast up.'],
    ['shrouds', 'Ванты', 'Shrouds', 'Тросы, раскрепляющие мачту с бортов.', 'Wires supporting the mast from the sides.'],
    ['forestay', 'Штаг', 'Forestay', 'Трос от верхней части мачты к носу; удерживает мачту спереди, по нему идёт стаксель.', 'The wire from the mast to the bow; the jib is set along it.'],
    ['backstay', 'Ахтерштаг', 'Backstay', 'Трос от топа мачты к корме; на большинстве швертботов отсутствует.', 'The wire from the masthead to the stern (most dinghies have none).'],
    ['chainplates', 'Вант-путенсы', 'Chainplates', 'Металлические крепления вант к корпусу.', 'Metal fittings on the hull that the shrouds attach to.'],
    ['turnbuckle', 'Талреп', 'Rigging screw (turnbuckle)', 'Устройство для натяжения стоячего такелажа.', 'A screw fitting for tensioning the standing rigging.'],
  ],
  running: [
    ['running_rigging', 'Бегучий такелаж', 'Running rigging', 'Подвижные снасти для подъёма и управления парусами.', 'The lines used to hoist and control the sails.'],
    ['halyard', 'Фал', 'Halyard', 'Снасть для подъёма паруса.', 'A line for hoisting a sail.'],
    ['sheet', 'Шкот', 'Sheet', 'Снасть, которой управляют углом паруса к ветру.', 'A line for setting the angle of a sail to the wind.'],
    ['mainsheet', 'Грота-шкот', 'Mainsheet', 'Шкот грота; обычно проходит через блоки на гике.', 'The sheet controlling the mainsail.'],
    ['jibsheet', 'Стаксель-шкот', 'Jib sheet', 'Шкот стакселя; их два — по одному на каждый борт.', 'The sheet controlling the jib; there is one on each side.'],
    ['cunningham', 'Оттяжка Каннингхема', 'Cunningham', 'Снасть, натягивающая переднюю шкаторину грота вниз; используют в свежий ветер.', 'A line tensioning the luff of the mainsail downwards; used in stronger wind.'],
    ['outhaul', 'Оттяжка шкотового угла', 'Outhaul', 'Натягивает нижнюю шкаторину грота вдоль гика, делая парус площе.', 'Pulls the clew of the mainsail along the boom to flatten the sail.'],
    ['cleat', 'Утка', 'Cleat', 'Деталь для закрепления троса (двурогая планка).', 'A fitting with two horns to make a rope fast.'],
    ['cam_cleat', 'Кулачковый стопор', 'Cam cleat', 'Стопор с подпружиненными зубчатыми кулачками; трос закрепляется и отдаётся одним движением.', 'A cleat with spring-loaded toothed cams for quick securing and release.'],
    ['block', 'Блок', 'Block', 'Шкив в обойме для изменения направления троса.', 'A pulley in a case that changes the direction of a rope.'],
    ['fairlead', 'Направляющий кип', 'Fairlead', 'Направляющая, через которую проходит трос (например, стаксель-шкот).', 'A guide the rope runs through, e.g. for the jib sheet.'],
    ['traveller', 'Погон (трэвеллер)', 'Traveller', 'Поперечная направляющая, по которой ходит нижний блок грота-шкота.', 'A track across the boat for the lower mainsheet block.'],
    ['painter', 'Фалинь', 'Painter', 'Носовой конец лодки для швартовки и буксировки.', 'The line at the bow for mooring or towing the dinghy.'],
    ['mooring_line', 'Швартов', 'Mooring line', 'Трос, которым лодку крепят к причалу.', 'A line used to tie the boat to a pier.'],
    ['shackle', 'Скоба', 'Shackle', 'Металлическая U-образная деталь с винтом для соединения снастей.', 'A U-shaped metal fitting with a pin for connecting things.'],
  ],
  sails: [
    ['mainsail', 'Грот', 'Mainsail', 'Главный парус, ставится за мачтой на гике.', 'The main sail, set behind the mast on the boom.'],
    ['jib', 'Стаксель', 'Jib', 'Треугольный парус впереди мачты, ставится по штагу.', 'The triangular sail in front of the mast, set on the forestay.'],
    ['spinnaker', 'Спинакер', 'Spinnaker', 'Большой лёгкий парус для полных курсов.', 'A large, light sail for downwind courses.'],
    ['luff', 'Передняя шкаторина', 'Luff', 'Передняя кромка паруса (у мачты или штага).', 'The front edge of a sail.'],
    ['leech', 'Задняя шкаторина', 'Leech', 'Задняя кромка паруса.', 'The back edge of a sail.'],
    ['foot', 'Нижняя шкаторина', 'Foot', 'Нижняя кромка паруса.', 'The bottom edge of a sail.'],
    ['head', 'Фаловый угол', 'Head', 'Верхний угол паруса, к нему крепится фал.', 'The top corner of a sail, where the halyard attaches.'],
    ['tack_corner', 'Галсовый угол', 'Tack', 'Передний нижний угол паруса.', 'The front lower corner of a sail.'],
    ['clew', 'Шкотовый угол', 'Clew', 'Задний нижний угол паруса, к нему крепится шкот.', 'The back lower corner of a sail, where the sheet attaches.'],
    ['battens', 'Латы', 'Battens', 'Упругие пластины в карманах паруса, поддерживающие форму задней шкаторины.', 'Stiff strips in pockets of the sail that support the leech.'],
    ['telltales', 'Колдунчики', 'Telltales', 'Лёгкие ленточки на парусе или вантах, показывающие обтекание и ветер.', 'Light ribbons on the sail or shrouds that show the airflow.'],
    ['reef', 'Риф', 'Reef', 'Уменьшение площади паруса в сильный ветер («взять риф»).', 'Reducing sail area in strong wind ("take in a reef").'],
    ['bolt_rope', 'Ликтрос', 'Bolt rope', 'Трос, вшитый в шкаторину паруса; заводится в паз мачты или гика.', 'A rope sewn into the edge of a sail that slides into a groove in the mast or boom.'],
    ['draft', 'Пузо паруса', 'Draft (camber)', 'Глубина профиля паруса. Глубокий парус — больше тяги, плоский — для сильного ветра.', 'The depth of the sail’s curve. Fuller for power, flatter for strong wind.'],
    ['luffing', 'Заполаскивание', 'Luffing (flapping)', 'Парус полощет у передней шкаторины: он слишком потравлен или курс слишком острый.', 'The sail flaps at the luff: it is eased too much or the course is too close to the wind.'],
    ['backing', 'Обстенить парус', 'Back a sail', 'Вынести парус так, чтобы ветер давил на него с обратной стороны; помогает развернуть нос.', 'Hold a sail out so the wind fills it from the wrong side; pushes the bow round.'],
  ],
  courses: [
    ['head_to_wind', 'Левентик', 'Head to wind (in irons)', 'Положение носом точно против ветра; паруса полощут, лодка теряет ход.', 'Pointing straight into the wind; sails flap and the boat stops.'],
    ['no_go_zone', 'Мёртвая зона', 'No-go zone', 'Сектор около ±45° от направления ветра, в котором парусная лодка не может идти.', 'The sector of about 45° either side of the wind where a sailing boat cannot sail.'],
    ['close_hauled', 'Бейдевинд (крутой)', 'Close-hauled', 'Самый острый курс к ветру (≈45°), паруса выбраны до конца.', 'Sailing as close to the wind as possible (≈45°), sails pulled in tight.'],
    ['close_reach', 'Полный бейдевинд', 'Close reach', 'Курс между крутым бейдевиндом и галфвиндом (≈60–80°).', 'Between close-hauled and a beam reach (≈60–80°).'],
    ['beam_reach', 'Галфвинд', 'Beam reach', 'Ветер дует перпендикулярно ДП лодки (≈90°).', 'The wind blows at right angles to the boat (≈90°).'],
    ['broad_reach', 'Бакштаг', 'Broad reach', 'Ветер дует сзади-сбоку (≈110–160°).', 'The wind comes from behind, over the quarter (≈110–160°).'],
    ['run', 'Фордевинд', 'Run (running)', 'Ветер дует прямо в корму (≈180°).', 'The wind is directly behind the boat (≈180°).'],
    ['tack_course', 'Галс', 'Tack (course relative to wind)', 'Положение лодки относительно ветра, определяется бортом, в который дует ветер.', 'Which side of the boat the wind is coming from.'],
    ['starboard_tack', 'Правый галс', 'Starboard tack', 'Ветер дует в правый борт, гик — на левом борту.', 'The wind comes over the starboard side; the boom is to port.'],
    ['port_tack', 'Левый галс', 'Port tack', 'Ветер дует в левый борт, гик — на правом борту.', 'The wind comes over the port side; the boom is to starboard.'],
    ['upwind', 'Острые курсы', 'Upwind courses', 'Курсы, при которых ветер дует спереди-сбоку (бейдевинд).', 'Courses with the wind ahead of the beam (close-hauled, close reach).'],
    ['downwind', 'Полные курсы', 'Downwind courses', 'Курсы, при которых ветер дует сзади (бакштаг, фордевинд).', 'Courses with the wind behind the beam (broad reach, run).'],
    ['beating', 'Лавировка', 'Beating (to windward)', 'Движение против ветра зигзагом с поворотами оверштаг.', 'Zig-zagging towards the wind by tacking.'],
  ],
  actions: [
    ['luff_up', 'Привестись', 'Luff up (head up)', 'Изменить курс ближе к ветру (острее).', 'Turn the boat towards the wind.'],
    ['bear_away', 'Увалиться', 'Bear away (bear off)', 'Изменить курс дальше от ветра (полнее).', 'Turn the boat away from the wind.'],
    ['tacking', 'Поворот оверштаг', 'Tacking (to tack)', 'Смена галса, при которой нос лодки проходит линию ветра.', 'Changing tack by turning the bow through the wind.'],
    ['gybing', 'Поворот фордевинд', 'Gybing (to gybe)', 'Смена галса, при которой корма проходит линию ветра и гик перебрасывается.', 'Changing tack by turning the stern through the wind; the boom swings across.'],
    ['sheet_in', 'Выбрать шкот', 'Sheet in (trim)', 'Подтянуть шкот, приблизив парус к ДП.', 'Pull a sheet in, bringing the sail closer to the centreline.'],
    ['ease', 'Потравить шкот', 'Ease (let out)', 'Отпустить шкот на некоторую длину, сохраняя контроль.', 'Let a sheet out in a controlled way.'],
    ['let_go', 'Отдать', 'Let go (release, cast off)', 'Освободить трос полностью (отдать шкот, отдать швартов).', 'Release a rope completely.'],
    ['make_fast', 'Закрепить', 'Make fast', 'Надёжно закрепить трос.', 'Secure a rope.'],
    ['hike', 'Откренивать', 'Hike out', 'Вывешиваться за наветренный борт, чтобы уменьшить крен.', 'Lean out over the windward side to keep the boat flat.'],
    ['heel', 'Крен', 'Heel', 'Наклон лодки на борт.', 'The boat leaning over to one side.'],
    ['leeway', 'Дрейф (снос)', 'Leeway', 'Боковое смещение лодки под действием ветра.', 'Sideways drift of the boat caused by the wind.'],
    ['heave_to', 'Лечь в дрейф', 'Heave to (lie to)', 'Остановить лодку, не убирая парусов: потравить шкоты на полном бейдевинде, чтобы паруса заполоскали.', 'Stop without lowering sails, e.g. let both sheets go on a close reach so the sails flap.'],
    ['way', 'Ход', 'Way (headway)', 'Движение лодки относительно воды («иметь ход», «потерять ход»).', 'The boat’s movement through the water ("to have way on").'],
    ['sternway', 'Задний ход', 'Sternway', 'Движение лодки кормой вперёд; руль действует наоборот.', 'Moving backwards; the rudder works the other way round.'],
    ['capsize', 'Опрокидывание', 'Capsize', 'Лодка ложится на борт, мачта на воде.', 'The boat falls over on its side, mast in the water.'],
    ['turtle', 'Оверкиль', 'Turtle (inversion)', 'Лодка перевернулась вверх дном, мачта смотрит вниз.', 'The boat is completely upside down, mast pointing down.'],
    ['right_boat', 'Поставить лодку', 'Right the boat', 'Вернуть опрокинутую лодку в нормальное положение.', 'Bring a capsized boat back upright.'],
    ['broach', 'Брочинг', 'Broach', 'Резкий неуправляемый уход лодки к ветру с большим креном.', 'A sudden uncontrolled turn towards the wind with heavy heel.'],
    ['rig_boat', 'Вооружить лодку', 'Rig the boat', 'Подготовить лодку к плаванию: поставить мачту, паруса, руль.', 'Prepare the boat: step the mast, set the sails, fit the rudder.'],
    ['moor', 'Швартоваться', 'Moor (come alongside)', 'Подойти к причалу и закрепить лодку.', 'Come alongside a pier and tie the boat up.'],
    ['anchor_v', 'Стать на якорь', 'Anchor (to anchor)', 'Отдать якорь и остановить лодку на нём.', 'Drop the anchor and lie to it.'],
    ['launch', 'Спуск на воду', 'Launch', 'Спуск лодки с берега или слипа на воду.', 'Putting the boat into the water from the shore or a slipway.'],
  ],
  wind: [
    ['true_wind', 'Истинный ветер', 'True wind', 'Ветер, который ощущает неподвижный наблюдатель.', 'The wind felt by a stationary observer.'],
    ['apparent_wind', 'Вымпельный ветер', 'Apparent wind', 'Ветер на движущейся лодке: сумма истинного ветра и встречного потока от движения. Его показывает флюгарка.', 'The wind felt on a moving boat: true wind plus wind from the boat’s motion. Shown by the wind indicator.'],
    ['windward', 'Наветренная сторона', 'Windward', 'Сторона, откуда дует ветер.', 'The side the wind is blowing from.'],
    ['leeward', 'Подветренная сторона', 'Leeward', 'Сторона, куда дует ветер.', 'The side the wind is blowing towards.'],
    ['gust', 'Порыв', 'Gust', 'Кратковременное усиление ветра; на воде видно как тёмное пятно ряби.', 'A short increase in wind; visible as a dark patch on the water.'],
    ['lull', 'Ослабление ветра', 'Lull', 'Кратковременное ослабление ветра.', 'A short drop in wind strength.'],
    ['squall', 'Шквал', 'Squall', 'Внезапное резкое и сильное усиление ветра, часто с дождём.', 'A sudden, violent increase in wind, often with rain.'],
    ['calm', 'Штиль', 'Calm', 'Отсутствие ветра.', 'No wind.'],
    ['header', 'Ветер заходит', 'Header', 'Ветер смещается к носу — приходится уваливаться.', 'The wind shifts towards the bow, forcing you to bear away.'],
    ['lift', 'Ветер отходит', 'Lift', 'Ветер смещается к корме — можно привестись.', 'The wind shifts aft, letting you point higher.'],
    ['offshore_wind', 'Отжимной ветер', 'Offshore wind', 'Ветер с берега или от причала; отжимает лодку от него.', 'Wind blowing from the shore or pier, pushing the boat away.'],
    ['onshore_wind', 'Прижимной ветер', 'Onshore wind', 'Ветер на берег или причал; прижимает лодку к нему.', 'Wind blowing onto the shore or pier.'],
    ['lee_shore', 'Подветренный берег', 'Lee shore', 'Берег, на который дует ветер; опасен для лодки.', 'A shore the wind blows onto; dangerous for a boat.'],
    ['beaufort', 'Шкала Бофорта', 'Beaufort scale', 'Шкала силы ветра от 0 (штиль) до 12 (ураган). Для швертбота комфортно 2–4 балла.', 'Wind force scale from 0 (calm) to 12 (hurricane). Force 2–4 is comfortable for a dinghy.'],
  ],
  knots: [
    ['bowline', 'Беседочный узел', 'Bowline', 'Незатягивающаяся петля на конце троса; легко развязывается после нагрузки.', 'A fixed loop at the end of a rope that is easy to untie after loading.'],
    ['figure8', 'Восьмёрка', 'Figure-eight knot', 'Стопорный узел на конце шкота, чтобы он не выскочил из блока.', 'A stopper knot at the end of a sheet so it cannot pull out of a block.'],
    ['reef_knot', 'Прямой (рифовый) узел', 'Reef knot (square knot)', 'Связывает два конца одинаковой толщины, например риф-сезни.', 'Joins two ends of the same size, e.g. reef ties.'],
    ['sheet_bend', 'Шкотовый узел', 'Sheet bend', 'Связывает два троса разной толщины.', 'Joins two ropes of different thickness.'],
    ['clove_hitch', 'Выбленочный узел', 'Clove hitch', 'Быстрое крепление троса к столбику, леерам или рейлингу.', 'A quick hitch round a post or rail.'],
    ['round_turn', 'Шлаг и два полуштыка', 'Round turn and two half hitches', 'Надёжное крепление троса к кольцу или палу; держит под нагрузкой.', 'A secure hitch to a ring or post that holds under load.'],
    ['cleat_hitch', 'Крепление на утке', 'Cleat hitch', 'Шлаг вокруг утки, затем восьмёрки и замыкающий шлаг.', 'A turn round the cleat, figure-of-eights, then a locking turn.'],
    ['coil', 'Бухта', 'Coil', 'Трос, сложенный кольцами («бухтовать трос»).', 'A rope laid in loops ("to coil a rope").'],
    ['line', 'Конец (трос)', 'Line (rope)', 'На борту верёвку называют тросом или концом.', 'On board, a rope is called a line.'],
    ['working_end', 'Ходовой конец', 'Working end', 'Свободный конец троса, которым вяжут узел.', 'The free end of the rope used to tie a knot.'],
    ['standing_part', 'Коренной конец', 'Standing part', 'Нерабочая (закреплённая или длинная) часть троса.', 'The inactive, longer part of the rope.'],
    ['whipping', 'Марка', 'Whipping', 'Обмотка на конце троса, не дающая ему распускаться.', 'Binding on a rope end to stop it fraying.'],
  ],
  safety: [
    ['lifejacket', 'Спасательный жилет', 'Lifejacket', 'Жилет с большой плавучестью; переворачивает человека лицом вверх.', 'A high-buoyancy jacket that turns a person face up.'],
    ['buoyancy_aid', 'Страховочный жилет', 'Buoyancy aid', 'Жилет для швертботистов: помогает держаться на воде, но не переворачивает лицом вверх.', 'A dinghy vest that helps you float but does not turn you face up.'],
    ['lifebuoy', 'Спасательный круг', 'Lifebuoy', 'Кольцевой спасательный буй, который бросают человеку в воде.', 'A ring buoy thrown to a person in the water.'],
    ['throw_line', 'Спасательный конец', 'Throwing line', 'Плавучий трос в мешке, который бросают человеку в воде.', 'A floating line in a bag, thrown to a person in the water.'],
    ['mob', 'Человек за бортом', 'Man overboard (MOB)', 'Аварийная ситуация и команда при падении человека в воду.', 'The emergency (and the call) when someone falls into the water.'],
    ['paddle', 'Весло (гребок)', 'Paddle', 'Обязательное снаряжение швертбота на случай штиля.', 'Required dinghy equipment for when the wind dies.'],
    ['anchor', 'Якорь', 'Anchor', 'Устройство для удержания лодки на месте.', 'A device for holding the boat in place.'],
    ['whistle', 'Свисток', 'Whistle', 'Средство звуковой сигнализации, крепится к жилету.', 'A sound-signalling device, usually attached to the vest.'],
    ['wetsuit', 'Гидрокостюм', 'Wetsuit', 'Неопреновый костюм, защищающий от холода в воде.', 'A neoprene suit protecting against cold water.'],
    ['hypothermia', 'Переохлаждение', 'Hypothermia', 'Опасное снижение температуры тела, особенно в холодной воде.', 'Dangerous loss of body heat, especially in cold water.'],
    ['rescue_boat', 'Спасательная (страхующая) лодка', 'Rescue (safety) boat', 'Моторная лодка, сопровождающая учебные и гоночные лодки.', 'A motor boat that supports dinghies during training or racing.'],
  ],
};

export const TERMS: Term[] = (Object.keys(RAW) as TermCategory[]).flatMap((cat) =>
  RAW[cat].map(([id, ru, en, defRu, defEn]) => ({ id, cat, ru, en, defRu, defEn })),
);

export const TERM_BY_ID: Record<string, Term> = Object.fromEntries(TERMS.map((t) => [t.id, t]));
