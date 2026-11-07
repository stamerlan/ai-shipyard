import { TERMS, TERM_CATEGORIES } from './terms';
import { SIGNS, SIGN_GROUPS } from './signs';
import { COMMANDS } from './maneuvers';

export type CardKind = 'term' | 'sign' | 'command';

export interface Card {
  id: string;
  kind: CardKind;
  deck: string;
  ru: string;
  en: string;
  defRu: string;
  defEn: string;
  code?: string;
  art?: () => string;
  sound?: string;
}

export interface Deck {
  id: string;
  kind: CardKind;
  ru: string;
  en: string;
}

export const DECKS: Deck[] = [
  ...Object.entries(TERM_CATEGORIES).map(([id, c]) => ({ id: `t:${id}`, kind: 'term' as const, ...c })),
  ...Object.entries(SIGN_GROUPS).map(([id, g]) => ({ id: `s:${id}`, kind: 'sign' as const, ru: g.ru, en: g.en })),
  { id: 'c:commands', kind: 'command', ru: 'Команды', en: 'Commands' },
];

export const CARDS: Card[] = [
  ...TERMS.map((t) => ({ id: `t:${t.id}`, kind: 'term' as const, deck: `t:${t.cat}`, ru: t.ru, en: t.en, defRu: t.defRu, defEn: t.defEn })),
  ...SIGNS.map((s) => ({
    id: `s:${s.id}`, kind: 'sign' as const, deck: `s:${s.group}`, ru: s.ru, en: s.en, defRu: s.defRu, defEn: s.defEn,
    code: s.code, art: s.art, sound: s.sound,
  })),
  ...COMMANDS.map((c) => ({ id: `c:${c.id}`, kind: 'command' as const, deck: 'c:commands', ru: c.ru, en: c.en, defRu: c.situationRu, defEn: '' })),
];

export const KIND_LABEL: Record<CardKind, string> = { term: 'Термины', sign: 'Знаки и сигналы', command: 'Команды' };
