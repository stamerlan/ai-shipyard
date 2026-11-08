import { lightOn, type Pt } from './world';
import { YACHT, rect, type Harbour, type MooredBoat, type Slot } from './harbours';
import type { MotorState } from './motor';
import type { Wind } from './physics';

const LIGHT: Record<string, string> = { red: '#ff3b3b', green: '#39ff6a', white: '#fffbe6' };

export class HarbourRenderer {
  private wake: { x: number; y: number; t: number }[] = [];

  constructor(private canvas: HTMLCanvasElement) {}

  reset(): void {
    this.wake = [];
  }

  draw(h: Harbour, s: MotorState, tiller: number, wind: Wind, time: number, zoom: number, showTarget: boolean): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rectEl = this.canvas.getBoundingClientRect();
    const w = Math.max(100, rectEl.width), hgt = Math.max(100, rectEl.height);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(hgt * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(hgt * dpr);
    }
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = Math.max(5, Math.min(w, hgt) / 55) * zoom;
    const tx = (x: number) => w / 2 + (x - s.x) * k;
    const ty = (y: number) => hgt / 2 - (y - s.y) * k;
    const poly = (p: Pt[]) => { ctx.beginPath(); p.forEach(([x, y], i) => (i ? ctx.lineTo(tx(x), ty(y)) : ctx.moveTo(tx(x), ty(y)))); ctx.closePath(); };

    // water
    ctx.fillStyle = '#2a7bb3';
    ctx.fillRect(0, 0, w, hgt);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    const step = 6;
    const x0 = Math.floor((s.x - w / 2 / k) / step) * step, y0 = Math.floor((s.y - hgt / 2 / k) / step) * step;
    for (let x = x0; x < s.x + w / 2 / k + step; x += step) for (let y = y0; y < s.y + hgt / 2 / k + step; y += step) ctx.fillRect(tx(x) - 1, ty(y) - 1, 2, 2);

    // wake
    if (Math.abs(s.u) > 0.2) {
      if (!this.wake.length || time - this.wake[this.wake.length - 1].t > 0.25) {
        this.wake.push({ x: s.x - Math.sin(s.heading) * YACHT.halfL * Math.sign(s.u), y: s.y - Math.cos(s.heading) * YACHT.halfL * Math.sign(s.u), t: time });
        if (this.wake.length > 80) this.wake.shift();
      }
    }
    for (let i = 1; i < this.wake.length; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${(0.4 * i) / this.wake.length})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tx(this.wake[i - 1].x), ty(this.wake[i - 1].y)); ctx.lineTo(tx(this.wake[i].x), ty(this.wake[i].y)); ctx.stroke();
    }

    // land and quays
    for (const p of h.land) {
      poly(p);
      ctx.fillStyle = '#b9b3a3';
      ctx.fill();
      ctx.strokeStyle = '#5d5a52';
      ctx.lineWidth = Math.max(2, 0.5 * k);
      ctx.stroke();
    }
    // pontoons and fingers
    for (const p of [...h.pontoons, ...h.fingers]) {
      poly(p);
      ctx.fillStyle = '#a77a4a';
      ctx.fill();
      ctx.strokeStyle = '#6b4a28';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // mooring buoys and their lines to the moored boats
    for (const b of h.buoys) {
      ctx.fillStyle = '#f2f2f2';
      ctx.strokeStyle = '#d8572a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tx(b.x), ty(b.y), Math.max(3, 0.45 * k), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    for (const b of h.moored) {
      if (b.kind === 'yacht') {
        const slot = h.slots.find((sl) => Math.hypot(sl.x - b.x, sl.y - b.y) < 1.5 && sl.buoy);
        if (slot?.buoy) {
          const sx = b.x - Math.sin(b.heading) * b.halfL, sy = b.y - Math.cos(b.heading) * b.halfL;
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(tx(sx), ty(sy)); ctx.lineTo(tx(slot.buoy.x), ty(slot.buoy.y)); ctx.stroke();
        }
      }
      this.drawYacht(ctx, b, tx, ty, k);
    }

    // target berth
    if (showTarget) this.drawTarget(ctx, h.target, tx, ty, k, time);

    // harbour lights (structures by day)
    for (const l of h.lights) {
      const on = lightOn(l.char, time);
      ctx.fillStyle = LIGHT[l.color];
      ctx.strokeStyle = '#222';
      ctx.beginPath(); ctx.arc(tx(l.x), ty(l.y), Math.max(4, 0.8 * k) * (on ? 1.3 : 1), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // own boat
    this.drawOwn(ctx, s, tiller, tx, ty, k, time);
    this.drawMinimap(ctx, h, s, w, hgt);
    void wind;
  }

  private drawYacht(ctx: CanvasRenderingContext2D, b: MooredBoat, tx: (x: number) => number, ty: (y: number) => number, k: number): void {
    ctx.save();
    ctx.translate(tx(b.x), ty(b.y));
    ctx.rotate(b.heading);
    const L = b.halfL * 2 * k, B = b.halfB * 2 * k;
    ctx.fillStyle = b.color;
    ctx.strokeStyle = '#2b3a46';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (b.kind === 'ship') {
      ctx.moveTo(0, -L / 2); ctx.quadraticCurveTo(B / 2, -L / 2 + B, B / 2, -L / 4); ctx.lineTo(B / 2, L / 2); ctx.lineTo(-B / 2, L / 2); ctx.lineTo(-B / 2, -L / 4); ctx.quadraticCurveTo(-B / 2, -L / 2 + B, 0, -L / 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d9dee2';
      ctx.fillRect(-B / 3, -L / 6, (B * 2) / 3, L / 3);
    } else {
      hull(ctx, L, B);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(30,60,90,0.25)';
      ctx.fillRect(-B * 0.25, -L * 0.12, B * 0.5, L * 0.3);
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(0, -L * 0.12, Math.max(1.5, 0.12 * k), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  private drawTarget(ctx: CanvasRenderingContext2D, t: Slot, tx: (x: number) => number, ty: (y: number) => number, k: number, time: number): void {
    ctx.save();
    ctx.translate(tx(t.x), ty(t.y));
    ctx.rotate(t.heading);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = `rgba(120,255,140,${0.6 + 0.4 * Math.sin(time * 4)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    hull(ctx, YACHT.halfL * 2 * k, YACHT.halfB * 2 * k);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(120,255,140,0.9)';
    ctx.font = `700 ${Math.max(11, k * 1.1)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.rotate(-t.heading);
    ctx.fillText('Ваше место', 0, 4);
    ctx.restore();
    if (t.buoy) {
      ctx.strokeStyle = 'rgba(120,255,140,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(tx(t.buoy.x), ty(t.buoy.y), Math.max(7, 1.2 * k), 0, Math.PI * 2); ctx.stroke();
    }
  }

  private drawOwn(ctx: CanvasRenderingContext2D, s: MotorState, tiller: number, tx: (x: number) => number, ty: (y: number) => number, k: number, time: number): void {
    const L = YACHT.halfL * 2 * k, B = YACHT.halfB * 2 * k;
    ctx.save();
    ctx.translate(tx(s.x), ty(s.y));
    ctx.rotate(s.heading);
    // propeller wash
    if (Math.abs(s.throttle) > 0.01) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      const dir = s.throttle > 0 ? 1 : -1;
      for (let i = 0; i < 3; i++) {
        const off = ((time * 3 + i / 3) % 1) * 1.5 * k * Math.abs(s.throttle) * 3;
        ctx.beginPath();
        ctx.arc(0.5 * k, L / 2 + (dir > 0 ? off + 0.4 * k : -off + 0.2 * k), 0.25 * k + off * 0.3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#fbfbf6';
    ctx.strokeStyle = '#123';
    ctx.lineWidth = 2;
    ctx.beginPath();
    hull(ctx, L, B);
    ctx.fill(); ctx.stroke();
    // cabin and cockpit
    ctx.fillStyle = '#cfe0ee';
    ctx.fillRect(-B * 0.28, -L * 0.2, B * 0.56, L * 0.32);
    ctx.fillStyle = '#e7d3b2';
    ctx.fillRect(-B * 0.3, L * 0.14, B * 0.6, L * 0.28);
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(0, -L * 0.16, Math.max(2, 0.14 * k), 0, Math.PI * 2); ctx.fill();
    // outboard on the starboard quarter and the rudder on the centreline
    ctx.fillStyle = '#222';
    ctx.fillRect(0.3 * k, L / 2 - 0.2 * k, 0.45 * k, 0.6 * k);
    const rud = -tiller * 35 * Math.PI / 180;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = Math.max(2, 0.15 * k);
    ctx.beginPath(); ctx.moveTo(0, L / 2); ctx.lineTo(Math.sin(rud) * 0.8 * k, L / 2 + Math.cos(rud) * 0.8 * k); ctx.stroke();
    ctx.strokeStyle = '#7a4a1e';
    ctx.beginPath(); ctx.moveTo(0, L / 2); ctx.lineTo(Math.sin(-rud) * 1.3 * k, L / 2 - Math.cos(rud) * 1.3 * k); ctx.stroke();
    // helmsman
    ctx.fillStyle = '#e0552f';
    ctx.beginPath(); ctx.arc(s.helmSide * B * 0.32, L * 0.3, Math.max(3, 0.3 * k), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  private drawMinimap(ctx: CanvasRenderingContext2D, h: Harbour, s: MotorState, w: number, hgt: number): void {
    const b = h.bounds;
    const bw = b.maxX - b.minX, bh = b.maxY - b.minY;
    const size = w < 600 ? 92 : 130;
    const sc = size / Math.max(bw, bh);
    const mw = bw * sc, mh = bh * sc;
    const ox = w - mw - 8, oy = hgt - mh - 8;
    const mx = (x: number) => ox + (x - b.minX) * sc, my = (y: number) => oy + (b.maxY - y) * sc;
    ctx.save();
    ctx.beginPath(); ctx.rect(ox, oy, mw, mh); ctx.clip();
    ctx.fillStyle = 'rgba(20,70,110,0.9)'; ctx.fillRect(ox, oy, mw, mh);
    const fill = (polys: Pt[][], col: string) => { ctx.fillStyle = col; for (const p of polys) { ctx.beginPath(); p.forEach(([x, y], i) => (i ? ctx.lineTo(mx(x), my(y)) : ctx.moveTo(mx(x), my(y)))); ctx.closePath(); ctx.fill(); } };
    fill(h.land, '#b9b3a3');
    fill([...h.pontoons, ...h.fingers], '#a77a4a');
    fill(h.moored.map((m) => rect(m.x, m.y, m.halfB * 2, m.halfL * 2, m.heading)), '#e8e8e8');
    ctx.fillStyle = '#7dff8c';
    ctx.beginPath(); ctx.arc(mx(h.target.x), my(h.target.y), 3, 0, Math.PI * 2); ctx.fill();
    ctx.translate(mx(s.x), my(s.y)); ctx.rotate(s.heading);
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3.5, 4); ctx.lineTo(-3.5, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.strokeRect(ox, oy, mw, mh);
  }
}

function hull(ctx: CanvasRenderingContext2D, L: number, B: number): void {
  ctx.moveTo(0, -L / 2);
  ctx.bezierCurveTo(B * 0.62, -L * 0.3, B * 0.52, L * 0.25, B * 0.44, L / 2);
  ctx.lineTo(-B * 0.44, L / 2);
  ctx.bezierCurveTo(-B * 0.52, L * 0.25, -B * 0.62, -L * 0.3, 0, -L / 2);
  ctx.closePath();
}
