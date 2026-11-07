import { describe, it, expect } from 'vitest';
import { TERMS, TERM_BY_ID } from '../src/data/terms';
import { SIGNS } from '../src/data/signs';
import { CARDS } from '../src/data/cards';
import { HOTSPOTS } from '../src/data/parts';
import { SITUATIONS, MANEUVERS } from '../src/data/maneuvers';
import { nextState } from '../src/lib/srs';

describe('content', () => {
  it('has unique card ids', () => {
    const ids = CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(TERMS.map((t) => t.id)).size).toBe(TERMS.length);
  });

  it('every diagram hotspot points to a glossary term', () => {
    for (const list of Object.values(HOTSPOTS)) for (const hs of list) expect(TERM_BY_ID[hs.term], hs.term).toBeTruthy();
  });

  it('every sign renders an SVG', () => {
    for (const s of SIGNS) expect(s.art()).toMatch(/^<svg/);
  });

  it('situations have valid answers and manoeuvres have steps', () => {
    for (const s of SITUATIONS) expect(s.options[s.answer]).toBeTruthy();
    for (const m of MANEUVERS) expect(m.steps.length).toBeGreaterThan(3);
  });
});

describe('spaced repetition', () => {
  it('moves cards between boxes', () => {
    const a = nextState(undefined, 'good', 0);
    expect(a.box).toBe(1);
    const b = nextState(a, 'good', 0);
    expect(b.box).toBe(2);
    const c = nextState(b, 'again', 0);
    expect(c.box).toBe(0);
    expect(c.due).toBe(0);
  });
});
