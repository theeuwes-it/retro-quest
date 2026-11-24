import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './config';

/** Uppercases and validates a room code; returns null when it can't be one. */
export function normalizeCode(raw: string): string | null {
  const code = String(raw ?? '').toUpperCase();
  if (code.length !== ROOM_CODE_LENGTH) return null;
  for (const ch of code) if (!ROOM_CODE_ALPHABET.includes(ch)) return null;
  return code;
}
