import { BOAT, DEG, wrap, type BoatState, type Controls, type Telemetry, type Wind } from './physics';
import { lightOn, type World, type Buoy, type BuoyKind, type Light } from './world';
import type { AIVessel } from './traffic';

export interface Scene {
  world: World | null;
  vessels: AIVessel[];
  night: boolean;
  /** Free camera (chart view); default follows the boat. */
  cam?: { x: number; y: number };
}

export interface Mark {
  x: number;
  y: number;
  kind: 'mark' | 'buoy' | 'mob' | 'finish';
  label?: string;
  active?: boolean;
  done?: boolean;
}

export interface View {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** Pixels per metre. */
  k: number;
  camX: number;
  camY: number;
}

interface Particle { x: number; y: number; life: number }

export class Renderer {
  private particles: Particle[] = [];
  private wake: { x: number; y: number }[] = [];
  private wakeTimer = 0;
  showNoGo = true;
  /** Visibility in metres (Infinity = clear). */
  fogRange = Infinity;
  lastView: View | null = null;
  private paths = new WeakMap<World, Path2D>();

  constructor(private canvas: HTMLCanvasElement) {}

  reset(): void {
    this.wake = [];
    this.particles = [];
  }

  resize(): { w: number; h: number } {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(100, rect.width), h = Math.max(100, rect.height);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  draw(s: BoatState, c: Controls, t: Telemetry | null, wind: Wind & { gust?: number }, marks: Mark[], time: number, dt: number, zoom: number, scene: Scene): void {
    const { w, h } = this.resize();
    const ctx = this.canvas.getContext('2d')!;
    const k = Math.max(9, Math.min(w, h) / 30) * zoom;
    const v: View = { ctx, w, h, k, camX: scene.cam?.x ?? s.x, camY: scene.cam?.y ?? s.y };
    this.lastView = v;

    // Water
    const gust = Math.max(0, wind.gust ?? 0);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, shade('#2f86c1', -gust * 0.5));
    g.addColorStop(1, shade('#1f6aa3', -gust * 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (scene.world?.water) {
      this.drawWorld(v, scene.world);
      this.drawGrid(v);
    } else {
      this.drawGrid(v);
      if (scene.world) this.drawWorld(v, scene.world);
    }
    if (scene.world) this.drawChartExtras(v, scene.world);
    this.drawWindParticles(v, wind, dt);
    this.updateWake(s, dt);
    this.drawWake(v);
    if (this.showNoGo && !scene.night && !c.sailsDown) this.drawNoGo(v, s, wind);
    for (const m of marks) this.drawMark(v, m, time);
    this.drawTracks(v, scene.vessels, s);
    for (const vs of scene.vessels) this.drawVessel(v, vs, wind.from, time);
    if (scene.night) {
      ctx.fillStyle = 'rgba(4,10,22,0.86)';
      ctx.fillRect(0, 0, w, h);
      if (scene.world) this.drawWorld(v, scene.world, true);
      ctx.globalAlpha = 0.75;
      for (const m of marks) this.drawMark(v, m, time);
      ctx.globalAlpha = 1;
    }
    if (Number.isFinite(this.fogRange) && !scene.cam) this.drawFog(v, scene.night);
    this.drawBoat(v, s, c, t, time);
    if (k < 4) {
      // Zoomed out on a big chart: a plotter-style arrow so the boat stays visible.
      ctx.save();
      ctx.translate(...this.toScreen(v, s.x, s.y));
      ctx.rotate(s.heading);
      ctx.fillStyle = '#ffeb3b'; ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if (scene.night) {
      if (scene.world) this.drawLights(v, scene.world, time);
      for (const vs of scene.vessels) this.drawNavLights(v, vs.x, vs.y, vs.heading, vs.type === 'motor' || vs.type === 'ship', vs.halfL);
      this.drawNavLights(v, s.x, s.y, s.heading, false, BOAT.length / 2);
    }
    for (const m of marks) if (m.active) this.drawOffscreen(v, m, s);
    for (const vs of scene.vessels) {
      const who = vs.encounter?.giveWay ?? vs.predicted;
      if (who) this.drawOffscreen(v, { x: vs.x, y: vs.y, kind: 'mark' }, s, who === 'own' ? 'rgba(255,70,70,0.95)' : 'rgba(80,230,120,0.95)');
    }
    if (scene.world) this.drawMinimap(v, scene, s, marks);
    if (scene.world?.attribution) {
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.textAlign = 'center';
      ctx.fillText(scene.world.attribution, w / 2, h - 4);
      ctx.textAlign = 'left';
    }
  }

  /** Courses that meet: both tracks to the meeting point, red if you must give way, green if they must. */
  private drawTracks(v: View, vessels: AIVessel[], s: BoatState): void {
    const { ctx } = v;
    const os = Math.max(0.5, Math.hypot(s.u, s.v));
    const ox = Math.sin(s.heading) * os, oy = Math.cos(s.heading) * os;
    for (const vs of vessels) {
      let color: string | null = null;
      const who = vs.encounter?.giveWay ?? vs.predicted;
      if (who) color = who === 'own' ? '#ff4040' : '#3fe07a';
      // A ship in a fairway: red when you are near its track ahead (keep out of its way).
      if (!color && vs.lane) {
        const dx = s.x - vs.x, dy = s.y - vs.y;
        const along = dx * Math.sin(vs.heading) + dy * Math.cos(vs.heading);
        const across = dx * Math.cos(vs.heading) - dy * Math.sin(vs.heading);
        if (along > 0 && along < 450 && Math.abs(across) < vs.halfB + 60) color = '#ff4040';
      }
      if (!color) continue;
      // Time of closest approach decides where both tracks end.
      const vx = Math.sin(vs.heading) * vs.speed, vy = Math.cos(vs.heading) * vs.speed;
      const rx = vs.x - s.x, ry = vs.y - s.y, rvx = vx - ox, rvy = vy - oy;
      const tc = Math.max(8, Math.min(120, -(rx * rvx + ry * rvy) / (rvx * rvx + rvy * rvy || 1e-6)));
      const meet = (x: number, y: number, ux: number, uy: number): [number, number] => [x + ux * tc, y + uy * tc];
      const [ax, ay] = meet(vs.x, vs.y, vx, vy), [bx, by] = meet(s.x, s.y, ox, oy);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 6]);
      for (const [x0, y0, x1, y1] of [[vs.x, vs.y, ax, ay], [s.x, s.y, bx, by]]) {
        const [sx0, sy0] = this.toScreen(v, x0, y0), [sx1, sy1] = this.toScreen(v, x1, y1);
        ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(sx1, sy1); ctx.stroke();
      }
      ctx.setLineDash([]);
      // Meeting point: a ring between the two predicted positions.
      const [mx, my] = this.toScreen(v, (ax + bx) / 2, (ay + by) / 2);
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx - 6, my - 6); ctx.lineTo(mx + 6, my + 6); ctx.moveTo(mx + 6, my - 6); ctx.lineTo(mx - 6, my + 6); ctx.stroke();
      ctx.restore();
    }
  }

  /** Zones, fairway lines and ships at anchor / alongside. */
  private drawChartExtras(v: View, w: World): void {
    const { ctx, k } = v;
    const path = (p: [number, number][]) => {
      ctx.beginPath();
      p.forEach(([x, y], i) => { const [sx, sy] = this.toScreen(v, x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.closePath();
    };
    for (const z of w.zones ?? []) {
      path(z.poly);
      if (z.kind === 'prohibited') {
        ctx.fillStyle = 'rgba(215,38,46,0.16)'; ctx.fill();
        ctx.strokeStyle = 'rgba(215,38,46,0.95)'; ctx.lineWidth = 2.5; ctx.setLineDash([10, 4, 2, 4]);
      } else if (z.kind === 'swim') {
        ctx.fillStyle = 'rgba(255,214,64,0.15)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,214,64,0.95)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      } else {
        ctx.strokeStyle = 'rgba(190,90,220,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([12, 6]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Fairway centre lines (like the recommended track on a chart).
    ctx.strokeStyle = 'rgba(200,60,200,0.55)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([14, 8]);
    for (const l of w.shipLanes ?? []) {
      ctx.beginPath();
      l.pts.forEach(([x, y], i) => { const [sx, sy] = this.toScreen(v, x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const sh of w.mooredShips ?? []) {
      const [x, y] = this.toScreen(v, sh.x, sh.y);
      const L = sh.halfL * 2 * k, B = sh.halfB * 2 * k;
      if (x < -L || y < -L || x > v.w + L || y > v.h + L) continue;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(sh.heading);
      shipShape(ctx, L, B, '#4f5a63');
      ctx.restore();
    }
    if (!w.labels || w.water) return; // real maps draw labels with the map
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const l of w.labels) {
      const [x, y] = this.toScreen(v, l.x, l.y);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(l.text, x, y);
      ctx.fillStyle = '#fff'; ctx.fillText(l.text, x, y);
    }
    ctx.textAlign = 'left';
  }

  private drawFog(v: View, night: boolean): void {
    const { ctx, w, h, k } = v;
    const r = this.fogRange * k;
    const col = night ? '4,10,22' : '196,204,210';
    const [bx, by] = this.toScreen(v, v.camX, v.camY);
    const g = ctx.createRadialGradient(bx, by, r * 0.35, bx, by, r);
    g.addColorStop(0, `rgba(${col},0)`);
    g.addColorStop(1, `rgba(${col},0.97)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  private waterPath(w: World): Path2D {
    let p = this.paths.get(w);
    if (!p) {
      p = new Path2D();
      for (const ring of w.water!) {
        ring.forEach(([x, y], i) => (i ? p!.lineTo(x, y) : p!.moveTo(x, y)));
        p.closePath();
      }
      this.paths.set(w, p);
    }
    return p;
  }

  /** Real map: land everywhere, water polygons on top (even–odd), bridges, marinas, labels. */
  private drawRealMap(v: View, w: World, night: boolean): void {
    const { ctx, k } = v;
    const path = this.waterPath(w);
    ctx.save();
    ctx.translate(v.w / 2, v.h / 2);
    ctx.scale(k, -k);
    ctx.translate(-v.camX, -v.camY);
    if (night) {
      ctx.strokeStyle = 'rgba(160,190,220,0.3)';
      ctx.lineWidth = 1.5 / k;
      ctx.stroke(path);
      ctx.restore();
      return;
    }
    ctx.fillStyle = '#d8c58e';
    ctx.fillRect(v.camX - v.w / 2 / k - 10, v.camY - v.h / 2 / k - 10, v.w / k + 20, v.h / k + 20);
    ctx.fillStyle = '#2a7cb7';
    ctx.fill(path, 'evenodd');
    ctx.strokeStyle = 'rgba(244,234,208,0.9)';
    ctx.lineWidth = Math.max(1.5, 0.4 * k) / k;
    ctx.stroke(path);
    ctx.fillStyle = 'rgba(110,110,110,0.75)';
    for (const b of w.bridges ?? []) {
      ctx.beginPath();
      b.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,90,90,0.85)';
    ctx.setLineDash([6 / k, 4 / k]);
    ctx.lineWidth = 1.5 / k;
    for (const m of w.marinaOutlines ?? []) {
      ctx.beginPath();
      m.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath(); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const l of w.labels ?? []) {
      const [x, y] = this.toScreen(v, l.x, l.y);
      if (x < -150 || y < -20 || x > v.w + 150 || y > v.h + 20) continue;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(l.text, x, y);
      ctx.fillStyle = '#fff'; ctx.fillText(l.text, x, y);
    }
    ctx.textAlign = 'left';
  }

  // ---------- World ----------

  private drawWorld(v: View, w: World, nightOutline = false): void {
    const { ctx, k } = v;
    if (w.water) {
      this.drawRealMap(v, w, nightOutline);
      if (!nightOutline) for (const lh of w.lighthouses) this.drawLighthouse(v, lh.x, lh.y, false, lh.light.color);
      return;
    }
    for (const poly of w.land) {
      ctx.beginPath();
      poly.forEach(([x, y], i) => { const [sx, sy] = this.toScreen(v, x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.closePath();
      if (nightOutline) {
        ctx.strokeStyle = 'rgba(160,190,220,0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#d8c58e';
        ctx.fill();
        ctx.strokeStyle = '#f4ead0';
        ctx.lineWidth = Math.max(2, 0.6 * k);
        ctx.stroke();
      }
    }
    if (nightOutline) return;
    for (const sh of w.shoals) {
      const [x, y] = this.toScreen(v, sh.x, sh.y);
      ctx.fillStyle = 'rgba(150,215,210,0.75)';
      ctx.beginPath(); ctx.arc(x, y, sh.r * k, 0, Math.PI * 2); ctx.fill();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#7b6a55';
      for (let i = 0; i < 5; i++) {
        const a = i * 2.4, rr = sh.r * 0.35 * ((i % 3) + 1) / 3;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr * k, y + Math.sin(a) * rr * k, Math.max(2, sh.r * 0.12 * k), 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const p of w.pontoons) {
      const [x1, y1] = this.toScreen(v, p.x, p.y + p.h);
      ctx.fillStyle = '#9a6b3c';
      ctx.fillRect(x1, y1, p.w * k, p.h * k);
      ctx.strokeStyle = '#6b4724';
      ctx.strokeRect(x1, y1, p.w * k, p.h * k);
    }
    const [bx, by] = this.toScreen(v, w.berth.x, w.berth.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(bx - 2.5 * k, by - 2 * k, 5 * k, 4 * k);
    ctx.setLineDash([]);
    for (const b of w.buoys) this.drawBuoy(v, b);
    for (const lh of w.lighthouses) this.drawLighthouse(v, lh.x, lh.y, lh.name === 'Маяк');
  }

  private drawBuoy(v: View, b: Buoy): void {
    const [x, y] = this.toScreen(v, b.x, b.y);
    if (x < -40 || y < -60 || x > v.w + 40 || y > v.h + 40) return;
    const hgt = Math.max(22, Math.min(36, v.k * 2.4));
    drawBuoyIcon(v.ctx, x, y, b.kind, hgt);
  }

  private drawLighthouse(v: View, x0: number, y0: number, big: boolean, color?: Light['color']): void {
    const { ctx } = v;
    const [x, y] = this.toScreen(v, x0, y0);
    if (x < -60 || y < -80 || x > v.w + 60 || y > v.h + 60) return;
    const hgt = big ? Math.max(28, v.k * 4) : Math.max(16, v.k * 2);
    const wdt = hgt * 0.32;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - wdt / 2, y); ctx.lineTo(x - wdt / 3, y - hgt); ctx.lineTo(x + wdt / 3, y - hgt); ctx.lineTo(x + wdt / 2, y); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = color === 'green' ? '#1f9a48' : color === 'yellow' ? '#e0b000' : '#d7262e';
    for (let i = 1; i < 4; i += 2) ctx.fillRect(x - wdt / 2.3, y - hgt * (i + 1) / 4.5, wdt / 1.15, hgt / 9);
    ctx.fillStyle = '#ffe9a6';
    ctx.fillRect(x - wdt / 3, y - hgt - wdt / 2.5, wdt / 1.5, wdt / 2.5);
  }

  private drawLights(v: View, w: World, time: number): void {
    const items: { x: number; y: number; light: Light; r: number; phase: number }[] = [
      ...w.buoys.map((b, i) => ({ x: b.x, y: b.y, light: b.light, r: 1, phase: i * 0.37 })),
      ...w.lighthouses.map((l, i) => ({ x: l.x, y: l.y, light: l.light, r: l.name === 'Маяк' ? 3 : 1.4, phase: i * 0.7 })),
      // Ships at anchor: all-round white lights fore and aft.
      ...(w.mooredShips ?? []).flatMap((sh) => [-1, 1].map((e) => ({
        x: sh.x + Math.sin(sh.heading) * sh.halfL * 0.8 * e, y: sh.y + Math.cos(sh.heading) * sh.halfL * 0.8 * e,
        light: { char: '', color: 'white' as const }, r: 0.8, phase: 0,
      }))),
    ];
    const { ctx } = v;
    for (const it of items) {
      const [x, y] = this.toScreen(v, it.x, it.y);
      const on = lightOn(it.light.char, time, it.phase);
      const col = LIGHT_COLOR[it.light.color];
      if (x < -200 || y < -200 || x > v.w + 200 || y > v.h + 200) continue;
      if (on) {
        const rad = Math.max(10, v.k * 2.2) * it.r;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, col);
        g.addColorStop(0.25, col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(120,130,150,0.35)';
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(200,215,235,0.55)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(it.light.char, x, y + 18);
    }
  }

  /** Sidelights (red to port, green to starboard), stern light, masthead light for power vessels. */
  private drawNavLights(v: View, x0: number, y0: number, heading: number, power: boolean, halfL: number): void {
    const { ctx, k } = v;
    const [x, y] = this.toScreen(v, x0, y0);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    const dot = (lx: number, ly: number, col: string) => {
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 9);
      g.addColorStop(0, col); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, 9, 0, Math.PI * 2); ctx.fill();
    };
    const bowY = -halfL * k * 0.8;
    dot(-0.6 * k, bowY, '#ff3b3b');
    dot(0.6 * k, bowY, '#39ff6a');
    dot(0, halfL * k * 0.95, '#ffffff');
    if (power) dot(0, -halfL * k * 0.3, '#ffffff');
    ctx.restore();
  }

  private drawVessel(v: View, vs: AIVessel, windFrom: number, time: number): void {
    const { ctx, k } = v;
    const [x, y] = this.toScreen(v, vs.x, vs.y);
    const L = vs.halfL * 2 * k, B = vs.halfB * 2 * k;
    if (x < -L - 40 || y < -L - 40 || x > v.w + L + 40 || y > v.h + L + 40) return;
    if (vs.encounter) {
      ctx.strokeStyle = vs.encounter.giveWay === 'own' ? 'rgba(255,70,70,0.9)' : 'rgba(80,230,120,0.9)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.arc(x, y, Math.max(L, 30) * 0.7 + Math.sin(time * 5) * 2, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(vs.heading);
    if (vs.type === 'ship') {
      shipShape(ctx, L, B, vs.lane ? '#8a3b2e' : '#56616b');
    } else {
      ctx.fillStyle = vs.type === 'motor' ? '#f4f4f4' : '#e0473c';
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -L / 2); ctx.bezierCurveTo(B * 0.6, -L * 0.2, B * 0.5, L * 0.3, B * 0.4, L / 2); ctx.lineTo(-B * 0.4, L / 2); ctx.bezierCurveTo(-B * 0.5, L * 0.3, -B * 0.6, -L * 0.2, 0, -L / 2);
      ctx.fill(); ctx.stroke();
      if (vs.type === 'motor') {
        ctx.fillStyle = '#9fb3c4';
        ctx.fillRect(-B * 0.3, -L * 0.1, B * 0.6, L * 0.25);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-B * 0.4, L / 2); ctx.lineTo(-B * 1.6, L * 1.4); ctx.moveTo(B * 0.4, L / 2); ctx.lineTo(B * 1.6, L * 1.4); ctx.stroke();
      } else {
        const twa = wrap(windFrom - vs.heading);
        const side = twa >= 0 ? -1 : 1;
        const ang = Math.min(Math.abs(twa) * 0.5, 80 * DEG);
        const mastY = -L * 0.15;
        const bx = side * Math.sin(ang) * L * 0.6, by = mastY + Math.cos(ang) * L * 0.6;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(0, mastY); ctx.quadraticCurveTo(bx / 2 + side * L * 0.12, (mastY + by) / 2, bx, by); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawMinimap(v: View, scene: Scene, s: BoatState, marks: Mark[]): void {
    const w = scene.world!;
    const { ctx } = v;
    const phone = v.w < 600;
    const size = phone ? 96 : 128;
    const bw0 = w.bounds.maxX - w.bounds.minX, bh0 = w.bounds.maxY - w.bounds.minY;
    const ox = v.w - size - 8, oy = phone ? v.h - (size * bh0) / Math.max(bw0, bh0) - 8 : 112;
    const bw = w.bounds.maxX - w.bounds.minX, bh = w.bounds.maxY - w.bounds.minY;
    const sc = size / Math.max(bw, bh);
    const mx = (x: number) => ox + (x - w.bounds.minX) * sc;
    const my = (y: number) => oy + (w.bounds.maxY - y) * sc;
    ctx.save();
    ctx.beginPath(); ctx.rect(ox, oy, bw * sc, bh * sc); ctx.clip();
    ctx.fillStyle = 'rgba(20,70,110,0.85)';
    ctx.fillRect(ox, oy, bw * sc, bh * sc);
    if (w.water) {
      ctx.fillStyle = '#cdb77f';
      ctx.fillRect(ox, oy, bw * sc, bh * sc);
      ctx.save();
      ctx.translate(ox - w.bounds.minX * sc, oy + w.bounds.maxY * sc);
      ctx.scale(sc, -sc);
      ctx.fillStyle = 'rgba(20,70,110,0.95)';
      ctx.fill(this.waterPath(w), 'evenodd');
      ctx.restore();
      // Visible area of the main view.
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(mx(v.camX - v.w / 2 / v.k), my(v.camY + v.h / 2 / v.k), Math.max(2, (v.w / v.k) * sc), Math.max(2, (v.h / v.k) * sc));
    }
    ctx.fillStyle = '#cdb77f';
    for (const poly of w.land) {
      ctx.beginPath();
      poly.forEach(([x, y], i) => (i ? ctx.lineTo(mx(x), my(y)) : ctx.moveTo(mx(x), my(y))));
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(150,215,210,0.9)';
    for (const sh of w.shoals) { ctx.beginPath(); ctx.arc(mx(sh.x), my(sh.y), Math.max(1.5, sh.r * sc), 0, Math.PI * 2); ctx.fill(); }
    for (const b of w.buoys) {
      ctx.fillStyle = b.kind === 'port' ? '#ff4d4d' : b.kind === 'starboard' ? '#3fd16b' : b.kind === 'special' ? '#ffd23f' : b.kind === 'safe' ? '#fff' : '#f6c718';
      ctx.fillRect(mx(b.x) - 1, my(b.y) - 1, 2.5, 2.5);
    }
    for (const z of w.zones ?? []) {
      ctx.strokeStyle = z.kind === 'prohibited' ? '#ff5a5a' : z.kind === 'swim' ? '#ffd640' : '#c070e0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      z.poly.forEach(([x, y], i) => (i ? ctx.lineTo(mx(x), my(y)) : ctx.moveTo(mx(x), my(y))));
      ctx.closePath(); ctx.stroke();
    }
    ctx.fillStyle = '#9aa6b0';
    for (const sh of w.mooredShips ?? []) ctx.fillRect(mx(sh.x) - 1.5, my(sh.y) - 1.5, 3, 3);
    ctx.fillStyle = '#ffffff';
    for (const vs of scene.vessels) ctx.fillRect(mx(vs.x) - 1.5, my(vs.y) - 1.5, 3, 3);
    for (const m of marks) if (m.active) { ctx.fillStyle = '#ff8c1a'; ctx.beginPath(); ctx.arc(mx(m.x), my(m.y), 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.translate(mx(s.x), my(s.y));
    ctx.rotate(s.heading);
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3.5, 4); ctx.lineTo(-3.5, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.strokeRect(ox, oy, bw * sc, bh * sc);
  }

  private toScreen(v: View, x: number, y: number): [number, number] {
    return [v.w / 2 + (x - v.camX) * v.k, v.h / 2 - (y - v.camY) * v.k];
  }

  private drawGrid(v: View): void {
    const { ctx, k } = v;
    const step = 8;
    const x0 = Math.floor((v.camX - v.w / 2 / k) / step) * step;
    const y0 = Math.floor((v.camY - v.h / 2 / k) / step) * step;
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    for (let x = x0; x < v.camX + v.w / 2 / k + step; x += step) {
      for (let y = y0; y < v.camY + v.h / 2 / k + step; y += step) {
        const [sx, sy] = this.toScreen(v, x + ((y / step) % 2 ? step / 2 : 0), y);
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
      }
    }
  }

  private drawWindParticles(v: View, wind: Wind, dt: number): void {
    const { ctx, k } = v;
    const halfW = v.w / 2 / k + 5, halfH = v.h / 2 / k + 5;
    const target = Math.round(Math.min(160, (v.w * v.h) / 5000));
    while (this.particles.length < target) {
      this.particles.push({ x: v.camX + (Math.random() * 2 - 1) * halfW, y: v.camY + (Math.random() * 2 - 1) * halfH, life: Math.random() * 3 });
    }
    const vx = -Math.sin(wind.from) * wind.speed * 0.8, vy = -Math.cos(wind.from) * wind.speed * 0.8;
    const len = Math.min(2.2, 0.5 + wind.speed * 0.18);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const p of this.particles) {
      p.x += vx * dt; p.y += vy * dt; p.life -= dt;
      if (p.life < 0 || Math.abs(p.x - v.camX) > halfW || Math.abs(p.y - v.camY) > halfH) {
        p.x = v.camX + (Math.random() * 2 - 1) * halfW;
        p.y = v.camY + (Math.random() * 2 - 1) * halfH;
        p.life = 2 + Math.random() * 3;
      }
      const [sx, sy] = this.toScreen(v, p.x, p.y);
      const n = Math.hypot(vx, vy) || 1;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (vx / n) * len * k, sy - (vy / n) * len * k);
    }
    ctx.stroke();
  }

  private updateWake(s: BoatState, dt: number): void {
    this.wakeTimer += dt;
    if (this.wakeTimer > 0.25) {
      this.wakeTimer = 0;
      const sinH = Math.sin(s.heading), cosH = Math.cos(s.heading);
      this.wake.push({ x: s.x - sinH * BOAT.length * 0.5, y: s.y - cosH * BOAT.length * 0.5 });
      if (this.wake.length > 120) this.wake.shift();
    }
  }

  private drawWake(v: View): void {
    const { ctx } = v;
    const n = this.wake.length;
    for (let i = 1; i < n; i++) {
      const a = this.wake[i - 1], b = this.wake[i];
      const [x1, y1] = this.toScreen(v, a.x, a.y);
      const [x2, y2] = this.toScreen(v, b.x, b.y);
      ctx.strokeStyle = `rgba(255,255,255,${(0.45 * i) / n})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }

  private drawNoGo(v: View, s: BoatState, wind: Wind): void {
    const { ctx, k } = v;
    const [cx, cy] = this.toScreen(v, s.x, s.y);
    const r = 11 * k;
    // Canvas angle: 0 = +x (east), clockwise positive. Compass c → canvas c − 90°.
    const up = wind.from - Math.PI / 2;
    ctx.fillStyle = 'rgba(230,60,60,0.18)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, up - 42 * DEG, up + 42 * DEG);
    ctx.closePath();
    ctx.fill();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    for (const sgn of [-1, 1]) {
      const a = up + sgn * 45 * DEG;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r * 1.6, cy + Math.sin(a) * r * 1.6); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `${Math.max(10, k * 0.9)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('мёртвая зона', cx + Math.cos(up) * r * 0.75, cy + Math.sin(up) * r * 0.75);
  }

  private drawMark(v: View, m: Mark, time: number): void {
    const { ctx, k } = v;
    const [x, y] = this.toScreen(v, m.x, m.y);
    if (x < -50 || y < -50 || x > v.w + 50 || y > v.h + 50) return;
    if (m.kind === 'mob') {
      const bob = Math.sin(time * 3) * 0.1 * k;
      ctx.fillStyle = '#ff7a00';
      ctx.beginPath(); ctx.arc(x, y + bob, 0.55 * k, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c6a0';
      ctx.beginPath(); ctx.arc(x, y + bob, 0.28 * k, 0, Math.PI * 2); ctx.fill();
      // waving arm
      ctx.strokeStyle = '#f2c6a0'; ctx.lineWidth = Math.max(2, 0.12 * k);
      ctx.beginPath(); ctx.moveTo(x + 0.3 * k, y + bob); ctx.lineTo(x + 0.75 * k, y - 0.6 * k + Math.sin(time * 6) * 0.2 * k); ctx.stroke();
    } else {
      const r = Math.max(6, (m.kind === 'buoy' ? 0.6 : 0.8) * k);
      ctx.fillStyle = m.done ? '#8fd18f' : m.kind === 'finish' ? '#ffd23f' : '#ff8c1a';
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (m.active) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, r + 4 + Math.sin(time * 4) * 2, 0, Math.PI * 2); ctx.stroke();
      }
    }
    if (m.label) {
      ctx.fillStyle = '#fff';
      ctx.font = `600 ${Math.max(11, k * 0.9)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.strokeText(m.label, x, y - Math.max(10, 1.3 * k));
      ctx.fillText(m.label, x, y - Math.max(10, 1.3 * k));
    }
  }

  private drawOffscreen(v: View, m: Mark, s: BoatState, color = 'rgba(255,140,26,0.95)'): void {
    const { ctx } = v;
    const [x, y] = this.toScreen(v, m.x, m.y);
    const pad = 28;
    if (x > pad && y > pad && x < v.w - pad && y < v.h - pad) return;
    const cx = v.w / 2, cy = v.h / 2;
    const dx = x - cx, dy = y - cy;
    const scale = Math.min((v.w / 2 - pad) / Math.abs(dx || 1e-6), (v.h / 2 - pad) / Math.abs(dy || 1e-6));
    const ex = cx + dx * scale, ey = cy + dy * scale;
    const ang = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-6, -9); ctx.lineTo(-6, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
    const d = Math.hypot(m.x - s.x, m.y - s.y);
    ctx.fillStyle = '#fff';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(d)} м`, ex - Math.cos(ang) * 26, ey - Math.sin(ang) * 26 + 4);
  }

  private drawBoat(v: View, s: BoatState, c: Controls, t: Telemetry | null, time: number): void {
    const { ctx, k } = v;
    const [x, y] = this.toScreen(v, s.x, s.y);
    const L = BOAT.length * k;
    const B = 1.6 * k * (1 - 0.25 * Math.abs(Math.sin(s.heel)));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(s.heading);
    // Local coordinates: +x = starboard, +y = aft, origin at mid-length.

    // shadow / heel shading
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    hullPath(ctx, L, B, Math.sin(s.heel) * 0.15 * k + 2, 3);
    ctx.fill();

    // rudder
    const rud = -c.tiller * 35 * DEG;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = Math.max(2, 0.12 * k);
    ctx.beginPath();
    ctx.moveTo(0, L / 2);
    ctx.lineTo(Math.sin(rud) * 0.55 * k, L / 2 + Math.cos(rud) * 0.55 * k);
    ctx.stroke();

    // hull
    ctx.fillStyle = '#f7f7f2';
    ctx.strokeStyle = '#2b3a46';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    hullPath(ctx, L, B, 0, 0);
    ctx.fill();
    ctx.stroke();
    // cockpit
    ctx.fillStyle = '#d9e2e8';
    ctx.beginPath();
    ctx.ellipse(0, L * 0.12, B * 0.32, L * 0.27, 0, 0, Math.PI * 2);
    ctx.fill();
    // centreboard slot
    ctx.fillStyle = c.board > 0.5 ? '#445' : '#99a';
    ctx.fillRect(-0.05 * k, -L * 0.08, 0.1 * k, 0.6 * k);

    // tiller
    ctx.strokeStyle = '#7a4a1e';
    ctx.lineWidth = Math.max(2, 0.1 * k);
    ctx.beginPath();
    ctx.moveTo(0, L / 2);
    ctx.lineTo(Math.sin(c.tiller * 35 * DEG) * 1.0 * k, L / 2 - Math.cos(c.tiller * 35 * DEG) * 1.0 * k);
    ctx.stroke();

    // crew (two heads) on the crew side
    const p = s.crewPos;
    const crewX = p * (B * 0.42 + 0.35 * k * Math.abs(p));
    ctx.fillStyle = '#e0552f';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (const cy of [L * 0.22, L * 0.02]) {
      ctx.beginPath(); ctx.arc(crewX, cy, 0.24 * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    const mastY = -L / 2 + BOAT.mastFromBow * k;
    const flowX = t ? -Math.sin(t.awa) : 0, flowY = t ? Math.cos(t.awa) : 1;
    if (c.sailsDown) {
      // Sails lowered and furled on the boom; outboard on the transom.
      ctx.strokeStyle = '#555';
      ctx.lineWidth = Math.max(3, 0.18 * k);
      ctx.beginPath(); ctx.moveTo(0, mastY); ctx.lineTo(0, mastY + BOAT.boomLength * k); ctx.stroke();
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(0, mastY, Math.max(2.5, 0.12 * k), 0, Math.PI * 2); ctx.fill();
      const eng = c.engine ?? 0;
      ctx.save();
      ctx.translate(0.35 * k, L / 2);
      ctx.rotate(-c.tiller * 30 * DEG);
      ctx.fillStyle = '#222';
      ctx.fillRect(-0.15 * k, -0.25 * k, 0.3 * k, 0.55 * k);
      if (Math.abs(eng) > 0.05) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2;
        const dir = Math.sign(eng);
        for (let i = 0; i < 3; i++) {
          const yy = 0.4 * k + i * 0.35 * k + ((time * 6) % 1) * 0.35 * k;
          ctx.beginPath(); ctx.arc(0, dir > 0 ? yy : -yy - 0.6 * k, 0.12 * k * (1 + i * 0.6), 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.restore();
      ctx.restore();
      return;
    }

    // jib
    const tackY = -L / 2 + 0.2 * k;
    const jx = Math.sin(s.jibAngle) * BOAT.jibFoot * k * 1.4, jy = tackY + Math.cos(s.jibAngle) * BOAT.jibFoot * k * 1.4;
    drawSail(ctx, 0, tackY, jx, jy, flowX, flowY, t ? t.jib : null, time, k, '#e9f3ff');

    // boom + mainsail
    const bx = Math.sin(s.boom) * BOAT.boomLength * k, by = mastY + Math.cos(s.boom) * BOAT.boomLength * k;
    drawSail(ctx, 0, mastY, bx, by, flowX, flowY, t ? t.main : null, time, k, '#ffffff');
    ctx.strokeStyle = '#555';
    ctx.lineWidth = Math.max(2, 0.12 * k);
    ctx.beginPath(); ctx.moveTo(0, mastY); ctx.lineTo(bx, by); ctx.stroke();
    // mast
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(0, mastY, Math.max(2.5, 0.12 * k), 0, Math.PI * 2); ctx.fill();

    // wind indicator (apparent wind) at masthead
    if (t) {
      ctx.strokeStyle = '#d33';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, mastY);
      ctx.lineTo(flowX * 0.9 * k, mastY + flowY * 0.9 * k);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function hullPath(ctx: CanvasRenderingContext2D, L: number, B: number, ox: number, oy: number): void {
  ctx.moveTo(ox, -L / 2 + oy);
  ctx.bezierCurveTo(ox + B * 0.55, -L * 0.3 + oy, ox + B * 0.5, L * 0.2 + oy, ox + B * 0.42, L / 2 + oy);
  ctx.lineTo(ox - B * 0.42, L / 2 + oy);
  ctx.bezierCurveTo(ox - B * 0.5, L * 0.2 + oy, ox - B * 0.55, -L * 0.3 + oy, ox, -L / 2 + oy);
  ctx.closePath();
}

function drawSail(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  flowX: number, flowY: number,
  info: { aoa: number; luffing: boolean; drive: number; side: number } | null,
  time: number, k: number, color: string,
): void {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if (nx * flowX + ny * flowY < 0) { nx = -nx; ny = -ny; }
  ctx.strokeStyle = 'rgba(40,40,60,0.8)';
  ctx.lineWidth = 1.2;
  ctx.fillStyle = color;
  if (!info || info.luffing) {
    // flapping sail: wavy line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const n = 8;
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      const wob = Math.sin(time * 22 + i * 1.7) * 0.22 * k * Math.sin(Math.PI * f);
      ctx.lineTo(x1 + dx * f + nx * wob, y1 + dy * f + ny * wob);
    }
    ctx.stroke();
    return;
  }
  const force = Math.min(1, Math.hypot(info.drive, info.side) / 250);
  const camber = (0.12 + 0.18 * force) * len;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(x1 + dx * 0.45 + nx * camber, y1 + dy * 0.45 + ny * camber, x2, y2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 + amt))));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

const LIGHT_COLOR: Record<Light['color'], string> = { white: '#fffbe6', red: '#ff3b3b', green: '#39ff6a', yellow: '#ffd23f' };

/** Small side-view buoy icon standing on the water at (x, y), as on a chart or seen from the boat. */
export function drawBuoyIcon(ctx: CanvasRenderingContext2D, x: number, y: number, kind: BuoyKind, hgt: number): void {
  const Y = '#f6c718', K = '#1b1b1b', R = '#d7262e', G = '#1f9a48', W = '#ffffff';
  const bodyH = hgt * 0.55, bodyW = hgt * 0.42;
  const top = y - bodyH;
  const bands: Record<BuoyKind, string[]> = {
    port: [R], starboard: [G], north: [K, Y], east: [K, Y, K], south: [Y, K], west: [Y, K, Y],
    isolated: [K, R, K], safe: [R, W, R, W], special: [Y],
  };
  ctx.save();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  // body
  const path = () => {
    ctx.beginPath();
    if (kind === 'starboard') { ctx.moveTo(x, top); ctx.lineTo(x + bodyW / 2, y); ctx.lineTo(x - bodyW / 2, y); }
    else if (kind === 'port') { ctx.rect(x - bodyW / 2.4, top, bodyW / 1.2, bodyH); }
    else { ctx.moveTo(x - bodyW / 3, top); ctx.lineTo(x + bodyW / 3, top); ctx.lineTo(x + bodyW / 2, y); ctx.lineTo(x - bodyW / 2, y); }
    ctx.closePath();
  };
  path();
  ctx.save();
  ctx.clip();
  const bs = bands[kind];
  if (kind === 'safe') bs.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x - bodyW / 2 + (i * bodyW) / bs.length, top, bodyW / bs.length + 0.5, bodyH); });
  else bs.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x - bodyW, top + (i * bodyH) / bs.length, bodyW * 2, bodyH / bs.length + 0.5); });
  ctx.restore();
  path();
  ctx.stroke();
  // topmark
  const pole = top - hgt * 0.12;
  ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, pole); ctx.stroke();
  const t = hgt * 0.16;
  const up = (cy: number, col: string) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, cy - t); ctx.lineTo(x + t * 0.75, cy); ctx.lineTo(x - t * 0.75, cy); ctx.closePath(); ctx.fill(); };
  const down = (cy: number, col: string) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, cy + t); ctx.lineTo(x + t * 0.75, cy); ctx.lineTo(x - t * 0.75, cy); ctx.closePath(); ctx.fill(); };
  const ball = (cy: number, col: string) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, cy, t * 0.5, 0, Math.PI * 2); ctx.fill(); };
  switch (kind) {
    case 'port': ctx.fillStyle = R; ctx.fillRect(x - t * 0.5, pole - t, t, t); break;
    case 'starboard': up(pole, G); break;
    case 'north': up(pole, K); up(pole - t * 1.1, K); break;
    case 'south': down(pole - t * 2.1, K); down(pole - t, K); break;
    case 'east': up(pole - t * 1.2, K); down(pole - t * 1.1, K); break;
    case 'west': down(pole - t * 2.2, K); up(pole, K); break;
    case 'isolated': ball(pole - t * 0.5, K); ball(pole - t * 1.6, K); break;
    case 'safe': ball(pole - t * 0.5, R); break;
    case 'special': ctx.strokeStyle = Y; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - t * 0.5, pole - t); ctx.lineTo(x + t * 0.5, pole); ctx.moveTo(x + t * 0.5, pole - t); ctx.lineTo(x - t * 0.5, pole); ctx.stroke(); break;
  }
  ctx.restore();
}

/** Top view of a ship (bow up), centred at the origin. */
function shipShape(ctx: CanvasRenderingContext2D, L: number, B: number, hull: string): void {
  ctx.fillStyle = hull;
  ctx.strokeStyle = '#1d242a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -L / 2); ctx.quadraticCurveTo(B / 2, -L / 2 + B, B / 2, -L / 4); ctx.lineTo(B / 2, L / 2); ctx.lineTo(-B / 2, L / 2); ctx.lineTo(-B / 2, -L / 4); ctx.quadraticCurveTo(-B / 2, -L / 2 + B, 0, -L / 2);
  ctx.fill(); ctx.stroke();
  if (L > 60) {
    // Cargo hatches
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 4; i++) ctx.fillRect(-B / 3, -L / 4 + i * L / 9, B / 1.5, L / 12);
  }
  ctx.fillStyle = '#e9edf0';
  ctx.fillRect(-B / 2.6, L / 2 - L / 5, B / 1.3, L / 7);
}
