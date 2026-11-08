import { describe, it, expect } from 'vitest';
import { judge, generate, tackOf, questionRu, type Scenario } from '../src/rules/rightOfWay';

const D = Math.PI / 180;

describe('right of way', () => {
  it('port tack gives way to starboard tack', () => {
    // Wind from north. Own heading 300° (wind from starboard) -> starboard tack.
    const sc: Scenario = { kind: 'cross', windFrom: 0, context: 'colreg',
      own: { x: 0, y: 0, heading: -60 * D, type: 'sail', speed: 2 },
      other: { x: -80, y: 0, heading: 60 * D, type: 'sail', speed: 2 } };
    expect(tackOf(sc.own, 0)).toBe('starboard');
    expect(tackOf(sc.other, 0)).toBe('port');
    expect(judge(sc).giveWay).toBe('other');
  });

  it('windward boat gives way on the same tack', () => {
    const base = { type: 'sail' as const, speed: 2 };
    const sc: Scenario = { kind: 'same', windFrom: 0, context: 'colreg',
      own: { ...base, x: 0, y: 20, heading: 90 * D },
      other: { ...base, x: 10, y: 0, heading: 45 * D } };
    expect(judge(sc).giveWay).toBe('own');
  });

  it('overtaking vessel keeps clear even when sailing', () => {
    const sc: Scenario = { kind: 'overtakeOwn', windFrom: 0, context: 'colreg',
      own: { x: 0, y: -30, heading: 90 * D, type: 'sail', speed: 3 },
      other: { x: 0, y: 0, heading: 90 * D, type: 'motor', speed: 1 } };
    // own is directly astern? place own west of other, both heading east
    sc.own.x = -30; sc.own.y = 0;
    expect(judge(sc).giveWay).toBe('own');
  });

  it('motor boat gives way to a sailing boat', () => {
    const sc: Scenario = { kind: 'motor', windFrom: 0, context: 'colreg',
      own: { x: 0, y: 0, heading: 90 * D, type: 'sail', speed: 2 },
      other: { x: 60, y: -60, heading: 0, type: 'motor', speed: 3 } };
    expect(judge(sc).giveWay).toBe('other');
  });

  const base = { windFrom: 0, own: { x: 0, y: 0, heading: 90 * D, type: 'sail' as const, speed: 2 } };
  const other = (type: Scenario['other']['type']) => ({ x: 60, y: -60, heading: 0, type, speed: 3 });
  it('big ship: sail has priority in open water, must keep clear in a channel or inland', () => {
    expect(judge({ ...base, kind: 'shipOpen', context: 'colreg', other: other('ship') }).giveWay).toBe('other');
    expect(judge({ ...base, kind: 'ship', context: 'channel', other: other('ship') }).giveWay).toBe('own');
    expect(judge({ ...base, kind: 'ship', context: 'inland', other: other('ship') }).giveWay).toBe('own');
  });

  it('sail keeps clear of fishing and restricted vessels; a motoring sailboat is a power boat', () => {
    expect(judge({ ...base, kind: 'fishing', context: 'colreg', other: other('fishing') }).giveWay).toBe('own');
    expect(judge({ ...base, kind: 'ram', context: 'colreg', other: other('ram') }).giveWay).toBe('own');
    expect(judge({ ...base, kind: 'motorsail', context: 'colreg', other: other('motorsail') }).giveWay).toBe('other');
  });

  it('question text matches the situation', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 300; i++) {
      const sc = generate(rnd);
      const q = questionRu(sc);
      if (sc.kind === 'overtakeByOther') expect(q).toMatch(/догоняет/);
      if (sc.kind === 'overtakeOwn') expect(q).toMatch(/Вы догоняете/);
      if (sc.kind === 'standon') expect(sc.choices?.filter((c) => c.correct).length).toBe(1);
      expect(q).not.toMatch(/Навстречу/);
    }
  });

  it('generated scenarios are always judgeable and consistent', () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const kinds = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const sc = generate(rnd);
      kinds.add(sc.kind);
      const v = judge(sc);
      expect(['own', 'other']).toContain(v.giveWay);
      if (sc.kind === 'overtakeByOther') expect(v.giveWay).toBe('other');
      if (sc.kind === 'overtakeOwn') expect(v.giveWay).toBe('own');
      if (sc.kind === 'ship') expect(v.giveWay).toBe('own');
      if (sc.kind === 'shipOpen') expect(v.giveWay).toBe('other');
    }
    expect(kinds.size).toBeGreaterThanOrEqual(7);
  });
});
