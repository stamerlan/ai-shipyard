import { load, save } from './store';

/** Leitner-style spaced repetition. Box 0 = new/forgotten, box 5 = well known. */
export interface CardState {
  box: number;
  due: number; // epoch ms
  seen: number;
}

export const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16];
const DAY = 24 * 3600 * 1000;

export type Grade = 'again' | 'hard' | 'good';

export function nextState(prev: CardState | undefined, grade: Grade, now = Date.now()): CardState {
  const box = prev?.box ?? 0;
  let nb: number;
  if (grade === 'again') nb = 0;
  else if (grade === 'hard') nb = Math.max(1, box);
  else nb = Math.min(INTERVAL_DAYS.length - 1, box + 1);
  const due = grade === 'again' ? now : now + INTERVAL_DAYS[nb] * DAY;
  return { box: nb, due, seen: (prev?.seen ?? 0) + 1 };
}

type Progress = Record<string, CardState>;

let progress: Progress = load<Progress>('cards', {});

export function getState(id: string): CardState | undefined {
  return progress[id];
}

export function grade(id: string, g: Grade): void {
  progress[id] = nextState(progress[id], g);
  save('cards', progress);
}

export function isDue(id: string, now = Date.now()): boolean {
  const s = progress[id];
  return !s || s.due <= now;
}

export function stats(ids: string[]): { total: number; learned: number; due: number; fresh: number } {
  const now = Date.now();
  let learned = 0, due = 0, fresh = 0;
  for (const id of ids) {
    const s = progress[id];
    if (!s) fresh++;
    else {
      if (s.box >= 3) learned++;
      if (s.due <= now) due++;
    }
  }
  return { total: ids.length, learned, due, fresh };
}

export function resetProgress(): void {
  progress = {};
  save('cards', progress);
}
