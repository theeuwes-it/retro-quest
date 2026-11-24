// localStorage wrappers. Storage can be missing or throw (private windows,
// blocked site data), so every access is guarded and the app keeps working
// for the current page view.

export interface Membership {
  token: string;
  hostToken?: string;
}

const memory = new Map<string, string>();
const key = (code: string) => `retro-quest:room:${code}`;

function read(k: string): string | null {
  try {
    const v = window.localStorage.getItem(k);
    if (v !== null) return v;
  } catch {}
  return memory.get(k) ?? null;
}

function write(k: string, v: string | null) {
  if (v === null) memory.delete(k);
  else memory.set(k, v);
  try {
    if (v === null) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, v);
  } catch {}
}

const CHANGE = 'retro-quest-storage';

/** For useSyncExternalStore: re-render when membership changes (here or in another tab). */
export function subscribeStorage(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

export function membershipSnapshot(code: string): string | null {
  return read(key(code));
}

export function parseMembership(raw: string | null): Membership | null {
  if (!raw) return null;
  try {
    const m = JSON.parse(raw);
    return typeof m?.token === 'string' ? m : null;
  } catch {
    return null;
  }
}

export function loadMembership(code: string): Membership | null {
  return parseMembership(read(key(code)));
}

export function saveMembership(code: string, m: Membership) {
  write(key(code), JSON.stringify(m));
  window.dispatchEvent(new Event(CHANGE));
}

export function clearMembership(code: string) {
  write(key(code), null);
  window.dispatchEvent(new Event(CHANGE));
}

export function loadFlag(name: string, fallback: boolean): boolean {
  const v = read(`retro-quest:${name}`);
  return v === null ? fallback : v === '1';
}

export function saveFlag(name: string, value: boolean) {
  write(`retro-quest:${name}`, value ? '1' : '0');
}
