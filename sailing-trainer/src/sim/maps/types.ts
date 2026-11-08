import type { Pt } from '../world';

/** Geography extracted from OsmAnd/OpenStreetMap, in local metres (x east, y north). */
export interface MapData {
  origin: [number, number];
  bbox: number[];
  /** Navigable water as rings (even–odd: islands and piers are holes). */
  water: Pt[][];
  /** Pontoon centre lines (OSM man_made=pier ways). */
  pierLines: Pt[][];
  /** Pontoons/piers mapped as areas. */
  pierPolys: Pt[][];
  bridges: Pt[][];
  marinas: Pt[][];
  lights: { x: number; y: number; type: string; colour: string }[];
  buildings: Pt[][];
}
