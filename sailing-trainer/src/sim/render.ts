import { BOAT, DEG, type BoatState, type Controls, type Telemetry, type Wind } from './physics';

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

  draw(s: BoatState, c: Controls, t: Telemetry | null, wind: Wind & { gust?: number }, marks: Mark[], time: number, dt: number, zoom: number): void {
    const { w, h } = this.resize();
    const ctx = this.canvas.getContext('2d')!;
    const k = Math.max(9, Math.min(w, h) / 30) * zoom;
    const v: View = { ctx, w, h, k, camX: s.x, camY: s.y };

    // Water
    const gust = Math.max(0, wind.gust ?? 0);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, shade('#2f86c1', -gust * 0.5));
    g.addColorStop(1, shade('#1f6aa3', -gust * 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    this.drawGrid(v);
    this.drawWindParticles(v, wind, dt);
    this.updateWake(s, dt);
    this.drawWake(v);
    if (this.showNoGo) this.drawNoGo(v, s, wind);
    for (const m of marks) this.drawMark(v, m, time);
    this.drawBoat(v, s, c, t, time);
    for (const m of marks) if (m.active) this.drawOffscreen(v, m, s);
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
      const r = (m.kind === 'buoy' ? 0.6 : 0.8) * k;
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
      ctx.fillText(m.label, x, y - 1.3 * k);
    }
  }

  private drawOffscreen(v: View, m: Mark, s: BoatState): void {
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
    ctx.fillStyle = 'rgba(255,140,26,0.95)';
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
    const crewX = s.crewSide * (0.15 + 0.75 * c.hike) * (B / 2 + 0.25 * k * c.hike);
    ctx.fillStyle = '#e0552f';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (const cy of [L * 0.22, L * 0.02]) {
      ctx.beginPath(); ctx.arc(crewX, cy, 0.24 * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    const mastY = -L / 2 + BOAT.mastFromBow * k;
    const flowX = t ? -Math.sin(t.awa) : 0, flowY = t ? Math.cos(t.awa) : 1;

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
