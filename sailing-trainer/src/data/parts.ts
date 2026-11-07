// Interactive diagrams of a two-person training dinghy (generic, not a specific class).
// Each hotspot points at a glossary term.

export type PartView = 'side' | 'top';

export interface Hotspot {
  term: string;
  x: number;
  y: number;
}

export const HOTSPOTS: Record<PartView, Hotspot[]> = {
  side: [
    { term: 'masthead', x: 378, y: 34 },
    { term: 'wind_indicator', x: 420, y: 22 },
    { term: 'head', x: 374, y: 70 },
    { term: 'halyard', x: 404, y: 175 },
    { term: 'mast', x: 404, y: 262 },
    { term: 'luff', x: 374, y: 140 },
    { term: 'forestay', x: 404, y: 108 },
    { term: 'jib', x: 466, y: 300 },
    { term: 'telltales', x: 494, y: 246 },
    { term: 'shrouds', x: 376, y: 292 },
    { term: 'chainplates', x: 360, y: 398 },
    { term: 'mainsail', x: 300, y: 236 },
    { term: 'leech', x: 244, y: 168 },
    { term: 'battens', x: 340, y: 112 },
    { term: 'foot', x: 282, y: 306 },
    { term: 'boom', x: 232, y: 340 },
    { term: 'tack_corner', x: 404, y: 306 },
    { term: 'gooseneck', x: 378, y: 334 },
    { term: 'vang', x: 356, y: 356 },
    { term: 'clew', x: 152, y: 306 },
    { term: 'outhaul', x: 136, y: 336 },
    { term: 'mainsheet', x: 166, y: 362 },
    { term: 'jibsheet', x: 430, y: 368 },
    { term: 'tiller', x: 206, y: 368 },
    { term: 'tiller_ext', x: 292, y: 350 },
    { term: 'rudder', x: 120, y: 470 },
    { term: 'transom', x: 138, y: 410 },
    { term: 'bow', x: 566, y: 370 },
    { term: 'deck', x: 486, y: 394 },
    { term: 'hull', x: 300, y: 428 },
    { term: 'centreboard', x: 354, y: 488 },
    { term: 'waterline', x: 586, y: 420 },
    { term: 'freeboard', x: 246, y: 406 },
    { term: 'draught', x: 410, y: 500 },
  ],
  top: [
    { term: 'bow', x: 300, y: 50 },
    { term: 'deck', x: 268, y: 150 },
    { term: 'forestay', x: 312, y: 120 },
    { term: 'mast', x: 300, y: 200 },
    { term: 'shrouds', x: 346, y: 196 },
    { term: 'chainplates', x: 392, y: 232 },
    { term: 'buoyancy_tanks', x: 366, y: 300 },
    { term: 'fairlead', x: 236, y: 296 },
    { term: 'cam_cleat', x: 236, y: 330 },
    { term: 'centreboard_case', x: 300, y: 290 },
    { term: 'thwart', x: 352, y: 348 },
    { term: 'cockpit', x: 336, y: 410 },
    { term: 'centreline', x: 300, y: 382 },
    { term: 'hiking_straps', x: 252, y: 420 },
    { term: 'self_bailer', x: 272, y: 456 },
    { term: 'tiller', x: 300, y: 436 },
    { term: 'traveller', x: 340, y: 482 },
    { term: 'transom', x: 372, y: 504 },
    { term: 'stern', x: 226, y: 496 },
    { term: 'rudder', x: 300, y: 526 },
    { term: 'port', x: 196, y: 380 },
    { term: 'starboard', x: 404, y: 380 },
    { term: 'gunwale', x: 396, y: 440 },
  ],
};

const SIDE = `
<rect x="0" y="0" width="600" height="540" fill="#e9f3fb"/>
<rect x="0" y="420" width="600" height="120" fill="#9cc8e6"/>
<!-- centreboard and rudder (under water) -->
<path d="M332 446 L372 444 L366 520 L342 516 Z" fill="#c9a36a" stroke="#5b4421" stroke-width="2"/>
<path d="M106 396 L126 396 L132 500 L112 505 Z" fill="#c9a36a" stroke="#5b4421" stroke-width="2"/>
<rect x="104" y="380" width="24" height="18" fill="#8a6a3a"/>
<!-- hull -->
<path d="M120 392 L560 380 Q548 420 470 438 Q330 452 126 428 Z" fill="#fbfbf7" stroke="#2b3a46" stroke-width="3"/>
<line x1="120" y1="392" x2="560" y2="380" stroke="#2b3a46" stroke-width="5"/>
<rect x="0" y="420" width="600" height="120" fill="#5ea3d4" opacity="0.35"/>
<line x1="90" y1="420" x2="595" y2="420" stroke="#1b5e8c" stroke-width="2" stroke-dasharray="8 6"/>
<!-- dimension arrows -->
<g stroke="#1b5e8c" stroke-width="1.5"><line x1="232" y1="390" x2="232" y2="420"/><line x1="226" y1="390" x2="238" y2="390"/><line x1="226" y1="420" x2="238" y2="420"/>
<line x1="394" y1="420" x2="394" y2="518"/><line x1="388" y1="518" x2="400" y2="518"/></g>
<!-- tiller -->
<line x1="122" y1="386" x2="250" y2="377" stroke="#7a4a1e" stroke-width="6" stroke-linecap="round"/>
<line x1="250" y1="377" x2="300" y2="338" stroke="#333" stroke-width="3" stroke-linecap="round"/>
<!-- mainsail -->
<path d="M390 48 L392 318 L156 322 Q240 170 390 48 Z" fill="#ffffff" stroke="#556" stroke-width="2"/>
<g stroke="#99a" stroke-width="3"><line x1="319" y1="111" x2="352" y2="113"/><line x1="256" y1="178" x2="298" y2="180"/><line x1="202" y1="248" x2="240" y2="250"/></g>
<!-- jib -->
<path d="M412 132 L544 362 L440 352 Q418 240 412 132 Z" fill="#eaf3ff" stroke="#556" stroke-width="2"/>
<g stroke="#d33" stroke-width="2"><line x1="476" y1="240" x2="486" y2="246"/><line x1="458" y1="210" x2="468" y2="216"/></g>
<!-- standing rigging -->
<line x1="390" y1="95" x2="556" y2="382" stroke="#444" stroke-width="1.8"/>
<line x1="390" y1="105" x2="372" y2="386" stroke="#444" stroke-width="1.8"/>
<!-- mast and boom -->
<line x1="390" y1="30" x2="390" y2="382" stroke="#3a3f45" stroke-width="6"/>
<line x1="395" y1="52" x2="395" y2="372" stroke="#b07a2a" stroke-width="1.2"/>
<path d="M390 30 L414 24 L390 20 Z" fill="#d33"/>
<line x1="390" y1="322" x2="148" y2="326" stroke="#3a3f45" stroke-width="6" stroke-linecap="round"/>
<circle cx="390" cy="322" r="5" fill="#222"/>
<!-- running rigging -->
<line x1="345" y1="324" x2="388" y2="374" stroke="#b07a2a" stroke-width="2"/>
<line x1="174" y1="326" x2="168" y2="390" stroke="#b07a2a" stroke-width="2"/>
<line x1="148" y1="326" x2="156" y2="322" stroke="#b07a2a" stroke-width="3"/>
<polyline points="440,352 420,384 380,388" fill="none" stroke="#b07a2a" stroke-width="2"/>
<circle cx="372" cy="386" r="3" fill="#222"/>
`;

const TOP = `
<rect x="0" y="0" width="600" height="540" fill="#9cc8e6"/>
<path d="M300 40 C390 120 400 330 395 500 L205 500 C200 330 210 120 300 40 Z" fill="#fbfbf7" stroke="#2b3a46" stroke-width="4"/>
<rect x="228" y="232" width="144" height="250" rx="40" fill="#dfe8ee" stroke="#9aa9b4" stroke-width="2"/>
<line x1="300" y1="40" x2="300" y2="500" stroke="#7e8b96" stroke-width="1.5" stroke-dasharray="8 6"/>
<rect x="293" y="250" width="14" height="80" fill="#8a6a3a" stroke="#5b4421"/>
<rect x="216" y="342" width="168" height="14" fill="#c9a36a" stroke="#5b4421"/>
<g stroke="#2f5d8a" stroke-width="5" stroke-linecap="round"><line x1="252" y1="372" x2="252" y2="466"/><line x1="348" y1="372" x2="348" y2="466"/></g>
<circle cx="272" cy="456" r="6" fill="#555"/>
<line x1="246" y1="482" x2="354" y2="482" stroke="#333" stroke-width="5"/>
<circle cx="318" cy="482" r="6" fill="#b07a2a"/>
<line x1="300" y1="500" x2="300" y2="420" stroke="#7a4a1e" stroke-width="7" stroke-linecap="round"/>
<line x1="300" y1="500" x2="300" y2="532" stroke="#5b4421" stroke-width="7"/>
<line x1="300" y1="200" x2="300" y2="56" stroke="#444" stroke-width="2"/>
<line x1="300" y1="200" x2="216" y2="232" stroke="#444" stroke-width="2"/>
<line x1="300" y1="200" x2="384" y2="232" stroke="#444" stroke-width="2"/>
<circle cx="216" cy="232" r="4" fill="#222"/><circle cx="384" cy="232" r="4" fill="#222"/>
<circle cx="300" cy="200" r="9" fill="#3a3f45"/>
<g fill="#555"><rect x="228" y="292" width="16" height="8" rx="3"/><rect x="356" y="292" width="16" height="8" rx="3"/>
<rect x="228" y="324" width="16" height="10" rx="2"/><rect x="356" y="324" width="16" height="10" rx="2"/></g>
<text x="300" y="20" text-anchor="middle" font-size="14" fill="#123" font-family="system-ui, sans-serif">▲ вперёд</text>
`;

export const DIAGRAMS: Record<PartView, string> = { side: SIDE, top: TOP };
