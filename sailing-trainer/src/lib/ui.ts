import { h } from './dom';
import { DECKS, KIND_LABEL, type CardKind } from '../data/cards';

/** Multi-select chip list of decks, grouped by kind. Returns the element; selection is kept in `selected`. */
export function deckPicker(selected: Set<string>, onChange: () => void, kinds: CardKind[] = ['term', 'sign', 'command']): HTMLElement {
  const wrap = h('div');
  for (const kind of kinds) {
    const decks = DECKS.filter((d) => d.kind === kind);
    const chips = h('div', { class: 'chips' });
    const all = h('button', { class: 'chip' }, 'Все');
    const refresh = () => {
      for (const b of chips.querySelectorAll<HTMLButtonElement>('[data-deck]')) b.classList.toggle('on', selected.has(b.dataset.deck!));
      all.classList.toggle('on', decks.every((d) => selected.has(d.id)));
    };
    all.addEventListener('click', () => {
      const on = decks.every((d) => selected.has(d.id));
      for (const d of decks) on ? selected.delete(d.id) : selected.add(d.id);
      refresh(); onChange();
    });
    chips.append(all);
    for (const d of decks) {
      const b = h('button', { class: 'chip', 'data-deck': d.id }, d.ru);
      b.addEventListener('click', () => {
        selected.has(d.id) ? selected.delete(d.id) : selected.add(d.id);
        refresh(); onChange();
      });
      chips.append(b);
    }
    refresh();
    wrap.append(h('div', { class: 'cat-label' }, KIND_LABEL[kind]), chips);
  }
  return wrap;
}

export function progressBar(frac: number): HTMLElement {
  return h('div', { class: 'progress' }, h('div', { style: { width: `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%` } }));
}

/** Play a sound-signal pattern (S = short, L = long, v = very short) with WebAudio, sped up. */
let audioCtx: AudioContext | null = null;
export function playPattern(pattern: string): void {
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  audioCtx ??= new Ctor();
  const ctx = audioCtx;
  let t = ctx.currentTime + 0.05;
  for (const ch of pattern) {
    const dur = ch === 'S' ? 0.45 : ch === 'L' ? 1.6 : ch === 'v' ? 0.12 : 0;
    if (ch === ' ') { t += 0.5; continue; }
    if (!dur) continue;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 220;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
    gain.gain.setValueAtTime(0.18, t + dur - 0.03);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    t += dur + (ch === 'v' ? 0.1 : 0.35);
  }
}
