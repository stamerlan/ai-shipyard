// Other vessels that cross the player's course so the right-of-way rules can be practised.
// Each encounter is judged with the same rules as the "Правила расхождения" quiz:
// if the other vessel must give way it alters course; if you must give way it stands on.

import { judge, type Vessel as RuleVessel, type VesselType } from '../rules/rightOfWay';
import { isBlocked, type World, type Pt } from './world';
import type { BoatState } from './physics';

export type TrafficType = Extract<VesselType, 'motor' | 'sail' | 'ship'>;

export interface AIVessel {
  id: number;
  type: TrafficType;
  x: number;
  y: number;
  heading: number;
  baseHeading: number;
  speed: number;
  /** Half length and half beam in metres (for drawing and collisions). */
  halfL: number;
  halfB: number;
  encounter: Encounter | null;
  /** Seconds left of an avoiding turn. */
  avoiding: number;
  avoidHeading: number;
  /** Cargo ship following a fairway: it cannot leave the channel and does not give way to small craft. */
  lane?: { pts: Pt[]; seg: number; warned: boolean; wait: number; cooldown: number };
}

export interface Encounter {
  /** Who must give way, decided when the encounter starts. */
  giveWay: 'own' | 'other';
  whyRu: string;
  ruleRu: string;
  violation: boolean;
  /** Heading of the player when the encounter started (to detect stand-on course changes). */
  ownHeading0: number;
}

export interface TrafficEvent {
  kind: 'collision' | 'violation' | 'encounter' | 'passed';
  vessel: AIVessel;
  textRu: string;
}

const D = Math.PI / 180;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

const SIZE: Record<TrafficType, { halfL: number; halfB: number; speed: number }> = {
  motor: { halfL: 3, halfB: 1.2, speed: 3.6 },
  sail: { halfL: 2.4, halfB: 0.9, speed: 2.0 },
  ship: { halfL: 22, halfB: 4, speed: 3.0 },
};

export const TRAFFIC_RU: Record<TrafficType, string> = {
  motor: 'моторная лодка',
  sail: 'парусная лодка',
  ship: 'большое судно',
};

export class Traffic {
  vessels: AIVessel[] = [];
  private nextId = 1;
  private spawnTimer = 2;
  violations = 0;
  collisions = 0;
  private laneCount: number;
  /** The player's boat: sailing, or under engine (then a power-driven vessel). */
  ownType: 'sail' | 'motor' = 'sail';
  private laneSpawned = 0;

  constructor(public count: number, private world: World | null, private rnd: () => number = Math.random, laneShips?: number) {
    this.laneCount = world?.shipLanes?.length ? laneShips ?? world.laneShips ?? 2 : 0;
  }

  reset(): void {
    this.vessels = [];
    this.spawnTimer = 2;
    this.violations = 0;
    this.collisions = 0;
  }

  /** Put a cargo ship on a random fairway, away from the player but not too far. */
  private spawnLane(s: BoatState, initial: boolean): void {
    const lanes = this.world!.shipLanes!;
    for (let attempt = 0; attempt < 40; attempt++) {
      const lane = lanes[Math.floor(this.rnd() * lanes.length)];
      const seg = Math.floor(this.rnd() * (lane.pts.length - 1));
      const [ax, ay] = lane.pts[seg], [bx, by] = lane.pts[seg + 1];
      const t = initial ? this.rnd() : attempt < 20 ? 0 : this.rnd() * 0.3;
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      const d = Math.hypot(x - s.x, y - s.y);
      if (d < 260 || d > 1800) continue;
      if (this.vessels.some((v) => v.lane && Math.hypot(v.x - x, v.y - y) < 400)) continue;
      const heading = Math.atan2(bx - ax, by - ay);
      const halfL = 38 + this.rnd() * 22;
      this.vessels.push({
        id: this.nextId++, type: 'ship', x, y, heading, baseHeading: heading, speed: 4 + this.rnd() * 1.5,
        halfL, halfB: halfL * 0.16, encounter: null, avoiding: 0, avoidHeading: heading,
        lane: { pts: lane.pts, seg, warned: false, wait: 0, cooldown: 0 },
      });
      return;
    }
  }

  private updateLane(v: AIVessel, dt: number, s: BoatState, events: TrafficEvent[]): void {
    const L = v.lane!;
    const [tx, ty] = L.pts[L.seg + 1];
    if (Math.hypot(tx - v.x, ty - v.y) < 25) {
      if (L.seg + 2 < L.pts.length) L.seg++;
      else L.wait += dt; // end of the fairway: the ship stops (berthing); removed once out of sight
    }
    const [nx, ny] = L.pts[Math.min(L.seg + 1, L.pts.length - 1)];
    const want = Math.atan2(nx - v.x, ny - v.y);
    v.heading += Math.max(-0.06 * dt, Math.min(0.06 * dt, wrap(want - v.heading)));
    const sp = L.wait > 0 ? 0 : v.speed;
    v.x += Math.sin(v.heading) * sp * dt;
    v.y += Math.cos(v.heading) * sp * dt;
    // Small craft must not impede a vessel that can navigate only within a fairway (COLREG 9(b), 9(d)).
    const dx = s.x - v.x, dy = s.y - v.y;
    const along = dx * Math.sin(v.heading) + dy * Math.cos(v.heading);
    const across = dx * Math.cos(v.heading) - dy * Math.sin(v.heading);
    const inPath = sp > 0 && along > v.halfL && along < v.halfL + 200 && Math.abs(across) < v.halfB + 18;
    if (inPath && !L.warned) {
      L.warned = true;
      this.violations++;
      events.push({ kind: 'violation', vessel: v, textRu: 'Судно в фарватере даёт пять коротких гудков: вы мешаете его проходу! Маломерное и парусное судно не должно затруднять движение судна, которое может идти только по фарватеру (МППСС, правило 9). Уходите с его курса.' });
    }
    if (L.warned && (along < 0 || Math.abs(across) > v.halfB + 60)) L.warned = false;
  }

  private ownVessel(s: BoatState): RuleVessel {
    return { x: s.x, y: s.y, heading: s.heading, type: this.ownType, speed: Math.max(0.3, Math.hypot(s.u, s.v)) };
  }

  private spawn(s: BoatState, windFrom: number): void {
    for (let attempt = 0; attempt < 30; attempt++) {
      const r = this.rnd();
      const type: TrafficType = r < 0.45 ? 'motor' : r < 0.85 ? 'sail' : 'ship';
      const size = SIZE[type];
      const ownSpeed = Math.max(1, Math.hypot(s.u, s.v));
      // Meet the player ~35–55 s ahead on their current course.
      const tMeet = 35 + this.rnd() * 20;
      const meetX = s.x + Math.sin(s.heading) * ownSpeed * tMeet;
      const meetY = s.y + Math.cos(s.heading) * ownSpeed * tMeet;
      let heading = s.heading + (this.rnd() < 0.5 ? 1 : -1) * (50 + this.rnd() * 90) * D;
      if (type === 'sail') {
        // Sailing boats keep away from the no-go zone.
        const twa = wrap(windFrom - heading);
        if (Math.abs(twa) < 55 * D) heading = windFrom - Math.sign(twa || 1) * (60 + this.rnd() * 60) * D;
      }
      const speed = size.speed * (0.85 + this.rnd() * 0.3);
      const x = meetX - Math.sin(heading) * speed * tMeet;
      const y = meetY - Math.cos(heading) * speed * tMeet;
      if (Math.hypot(x - s.x, y - s.y) < 60) continue;
      if (this.world && !this.pathClear(x, y, heading, speed * (tMeet + 40))) continue;
      this.vessels.push({ id: this.nextId++, type, x, y, heading, baseHeading: heading, speed, halfL: size.halfL, halfB: size.halfB, encounter: null, avoiding: 0, avoidHeading: heading });
      return;
    }
  }

  private pathClear(x: number, y: number, h: number, len: number): boolean {
    for (let d = -20; d <= len; d += 10) {
      if (isBlocked(this.world!, x + Math.sin(h) * d, y + Math.cos(h) * d)) return false;
    }
    return true;
  }

  update(dt: number, s: BoatState, windFrom: number): TrafficEvent[] {
    const events: TrafficEvent[] = [];
    this.spawnTimer -= dt;
    const lanes = this.vessels.filter((v) => v.lane).length;
    if (lanes < this.laneCount) { this.spawnLane(s, this.laneSpawned < this.laneCount); this.laneSpawned++; }
    if (this.vessels.length - lanes < this.count && this.spawnTimer <= 0) {
      this.spawn(s, windFrom);
      this.spawnTimer = 8 + this.rnd() * 8;
    }
    const own = this.ownVessel(s);
    const ovx = Math.sin(s.heading) * own.speed, ovy = Math.cos(s.heading) * own.speed;

    for (const v of this.vessels) {
      if (v.lane) {
        this.updateLane(v, dt, s, events);
        v.lane.cooldown = Math.max(0, v.lane.cooldown - dt);
        if (v.lane.cooldown === 0 && collides(v, s.x, s.y)) {
          v.lane.cooldown = 8;
          this.collisions++;
          events.push({ kind: 'collision', vessel: v, textRu: 'Столкновение с грузовым судном!' });
          s.u = 0; s.v = 0;
        }
        continue;
      }
      // Steering: avoid if needed, otherwise return to the original course.
      const want = v.avoiding > 0 ? v.avoidHeading : v.baseHeading;
      v.heading += Math.max(-0.35 * dt, Math.min(0.35 * dt, wrap(want - v.heading)));
      v.avoiding = Math.max(0, v.avoiding - dt);
      v.x += Math.sin(v.heading) * v.speed * dt;
      v.y += Math.cos(v.heading) * v.speed * dt;

      const dx = v.x - s.x, dy = v.y - s.y;
      const dist = Math.hypot(dx, dy);
      const rvx = Math.sin(v.heading) * v.speed - ovx, rvy = Math.cos(v.heading) * v.speed - ovy;
      const rv2 = rvx * rvx + rvy * rvy || 1e-6;
      const tcpa = -(dx * rvx + dy * rvy) / rv2;
      const cpa = Math.hypot(dx + rvx * tcpa, dy + rvy * tcpa);
      const safe = v.type === 'ship' ? 35 : 16;

      if (!v.encounter && tcpa > 0 && tcpa < 40 && cpa < safe && dist < 160) {
        const verdict = judge({ kind: 'live', own, other: { x: v.x, y: v.y, heading: v.heading, type: v.type, speed: v.speed }, windFrom, context: 'colreg' });
        v.encounter = { giveWay: verdict.giveWay, whyRu: verdict.whyRu, ruleRu: verdict.ruleRu, violation: false, ownHeading0: s.heading };
        events.push({ kind: 'encounter', vessel: v, textRu: verdict.giveWay === 'own'
          ? `Вы должны уступить дорогу: ${TRAFFIC_RU[v.type]}. ${verdict.whyRu}`
          : `Вам уступают дорогу (${TRAFFIC_RU[v.type]}). Держите курс и скорость.` });
      }
      if (v.encounter) {
        if (v.encounter.giveWay === 'other' && tcpa > 0 && cpa < safe) {
          // Give way early and clearly: pass astern of the player (turn away from them).
          const bearingToOwn = Math.atan2(-dx, -dy);
          const side = wrap(bearingToOwn - v.heading) > 0 ? -1 : 1;
          v.avoidHeading = v.baseHeading + side * (v.type === 'ship' ? 35 : 55) * D;
          v.avoiding = 6;
        }
        const close = v.type === 'ship' ? 22 : 9;
        if (v.encounter.giveWay === 'own' && !v.encounter.violation && dist < close + v.halfL * 0.3) {
          v.encounter.violation = true;
          this.violations++;
          events.push({ kind: 'violation', vessel: v, textRu: `Опасное сближение: уступить должны были вы (${v.encounter.ruleRu}).` });
        }
        if (tcpa < -4 || dist > 120) {
          events.push({ kind: 'passed', vessel: v, textRu: v.encounter.violation ? 'Разошлись, но слишком близко.' : 'Разошлись безопасно.' });
          v.encounter = null;
        }
      }
      if (collides(v, s.x, s.y)) {
        this.collisions++;
        events.push({ kind: 'collision', vessel: v, textRu: `Столкновение с судном (${TRAFFIC_RU[v.type]})!` });
        v.x += Math.sin(v.heading) * 30; // move it away so the event fires once
        v.y += Math.cos(v.heading) * 30;
      }
    }
    this.vessels = this.vessels.filter((v) => {
      const d = Math.hypot(v.x - s.x, v.y - s.y);
      if (v.lane) return !(v.lane.wait > 0 && d > 600) && d < 2500;
      const blocked = this.world ? isBlocked(this.world, v.x, v.y) : null;
      return d < 320 && !blocked;
    });
    return events;
  }

  /** The most urgent active encounter, for the HUD. */
  current(): AIVessel | null {
    return this.vessels.find((v) => v.encounter?.giveWay === 'own') ?? this.vessels.find((v) => v.encounter) ?? null;
  }
}

/** Is the point (our boat, ~2 m radius) touching the vessel's hull rectangle? */
export function collides(v: AIVessel, x: number, y: number): boolean {
  const dx = x - v.x, dy = y - v.y;
  const along = dx * Math.sin(v.heading) + dy * Math.cos(v.heading);
  const across = dx * Math.cos(v.heading) - dy * Math.sin(v.heading);
  return Math.abs(along) < v.halfL + 2 && Math.abs(across) < v.halfB + 1.2;
}
