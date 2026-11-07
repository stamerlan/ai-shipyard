const PREFIX = 'sailtrainer.';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or disabled: progress just isn't kept */
  }
}

export interface Settings {
  /** Show English terms everywhere (otherwise tap to reveal). */
  showEn: boolean;
  /** Simulator: arrow keys move the tiller (realistic) or turn the bow (simplified). */
  steerMode: 'tiller' | 'bow';
  /** Simulator: tiller returns to centre when the key is released. */
  springTiller: boolean;
}

const DEFAULT_SETTINGS: Settings = { showEn: true, steerMode: 'tiller', springTiller: true };

export const settings: Settings = load('settings', DEFAULT_SETTINGS);

export function saveSettings(): void {
  save('settings', settings);
  applySettings();
}

export function applySettings(): void {
  document.body.classList.toggle('en-hidden', !settings.showEn);
}
