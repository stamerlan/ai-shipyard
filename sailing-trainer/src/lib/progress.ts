import { load, save } from './store';

export interface MissionRecord { done: boolean; best?: number }

export const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function missionRecords(): Record<string, MissionRecord> {
  return load<Record<string, MissionRecord>>('missions', {});
}

/** Mission name for lists: "✓ 2:34" once completed. */
export function missionLabel(id: string, name: string): string {
  const r = missionRecords()[id];
  return r?.done ? `${name}  ✓ ${r.best !== undefined ? fmtTime(r.best) : ''}` : name;
}

/** Save a completed mission; returns whether it is a new best time. */
export function recordMission(id: string, time: number): { newRecord: boolean; prev?: number } {
  const all = missionRecords();
  const prev = all[id]?.best;
  const newRecord = prev === undefined || time < prev;
  all[id] = { done: true, best: newRecord ? time : prev };
  save('missions', all);
  return { newRecord, prev };
}

const PREFIX = 'sailtrainer.';

/** Everything this app keeps in the browser, as one JSON object. */
export function exportProgress(): string {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k.startsWith(PREFIX)) data[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)!);
  }
  return JSON.stringify({ app: 'sailing-trainer', version: 1, exported: new Date().toISOString(), data }, null, 2);
}

export function importProgress(text: string): number {
  const obj = JSON.parse(text);
  if (obj?.app !== 'sailing-trainer' || typeof obj.data !== 'object') throw new Error('Это не файл прогресса тренажёра');
  let n = 0;
  for (const [k, v] of Object.entries(obj.data)) { localStorage.setItem(PREFIX + k, JSON.stringify(v)); n++; }
  return n;
}

export function resetAllProgress(): void {
  for (const k of ['cards', 'missions']) localStorage.removeItem(PREFIX + k);
}
