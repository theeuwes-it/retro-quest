import 'server-only';
import { randomBytes, randomInt } from 'node:crypto';
import {
  MAX_WRITE_ATTEMPTS,
  OFFLINE_AFTER_MS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from '@/lib/shared/config';
import { apply, createRoom, freeAvatars, joinRoom, type Ctx } from '@/lib/shared/reducer';
import type { ClientEvent, Player, Room, View } from '@/lib/shared/types';
import { viewFor } from '@/lib/shared/view';
export { normalizeCode } from '@/lib/shared/code';
import { publishVersion, realtimeMode } from './realtime';
import { getStore, type RoomStore } from './store';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const newId = () => randomBytes(9).toString('base64url');
export const newToken = () => randomBytes(24).toString('base64url');

export function makeCtx(presence?: Record<string, number>): Ctx {
  return { now: Date.now(), newId, newToken, presence };
}

export function generateCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  return code;
}

/** Player tokens and the host token both identify a member. */
export function findMember(room: Room, token: string | null | undefined): Player | null {
  if (!token) return null;
  if (token === room.hostToken) return room.players.find((p) => p.id === room.hostPlayerId) ?? null;
  return room.players.find((p) => p.token === token) ?? null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Optimistic read-modify-write: read the room and its version, apply the
 * change, then write with check-and-set. Retries with jitter on a conflict.
 */
export async function mutate<T>(
  code: string,
  change: (room: Room) => { ok: true; room: Room; result: T } | { ok: false; error: string; status: number },
  store: RoomStore = getStore(),
): Promise<{ version: number; result: T }> {
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
    const stored = await store.get(code);
    if (!stored) throw new HttpError(404, 'Room not found');
    const out = change(stored.room);
    if (!out.ok) throw new HttpError(out.status, out.error);
    const version = stored.version + 1;
    if (await store.cas(code, stored.version, { version, room: out.room })) {
      await publishVersion(code, version);
      return { version, result: out.result };
    }
    await sleep(5 + Math.random() * 25 * (attempt + 1));
  }
  throw new HttpError(409, 'The room is busy, please try again');
}

export async function createRoomFlow(input: { hostName: unknown; hostPlays: unknown; avatarId?: unknown }) {
  const store = getStore();
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateCode();
    const created = createRoom(input, code, makeCtx());
    if (!created.ok) throw new HttpError(created.status, created.error);
    if (await store.create(code, { version: 1, room: created.room })) {
      await store.touch(code, created.player.id, Date.now());
      return {
        code,
        playerId: created.player.id,
        token: created.player.token,
        hostToken: created.room.hostToken,
      };
    }
  }
  throw new HttpError(503, 'Could not find a free room code, please try again');
}

export async function roomInfo(code: string) {
  const stored = await getStore().get(code);
  if (!stored) return null;
  const { room } = stored;
  return {
    code,
    ended: room.phase === 'ended',
    phase: room.phase,
    memberCount: room.players.length,
    freeAvatars: freeAvatars(room),
  };
}

export async function joinFlow(code: string, body: { name?: unknown; avatarId?: unknown; token?: unknown }) {
  const store = getStore();
  // Rejoin with a stored token (player or host token).
  if (typeof body.token === 'string' && body.token) {
    const stored = await store.get(code);
    if (!stored) throw new HttpError(404, 'Room not found');
    if (stored.room.removedTokens.includes(body.token)) throw new HttpError(410, 'The host removed you from this party');
    const member = findMember(stored.room, body.token);
    if (!member) throw new HttpError(401, 'Unknown token');
    await touchAndMaybePing(code, member.id, stored.version);
    return { playerId: member.id, token: member.token };
  }
  const { result } = await mutate(code, (room) => {
    const out = joinRoom(room, { name: body.name, avatarId: body.avatarId }, makeCtx());
    if (!out.ok) return out;
    return { ok: true, room: out.room, result: out.player };
  });
  await store.touch(code, result.id, Date.now());
  return { playerId: result.id, token: result.token };
}

async function memberFor(code: string, token: string | null) {
  const stored = await getStore().get(code);
  if (!stored) throw new HttpError(404, 'Room not found');
  if (token && stored.room.removedTokens.includes(token)) throw new HttpError(410, 'The host removed you from this party');
  const member = findMember(stored.room, token);
  if (!member) throw new HttpError(401, 'Join the room first');
  return { stored, member };
}

export async function actionFlow(code: string, token: string | null, event: ClientEvent) {
  const store = getStore();
  const { member } = await memberFor(code, token);
  const presence = event?.type === 'host:claim' ? await store.presence(code) : undefined;
  const { version } = await mutate(code, (room) => {
    const out = apply(room, event, member.id, makeCtx(presence));
    if (!out.ok) return out;
    return { ok: true, room: out.room, result: null };
  });
  return { version };
}

/** Records presence; when a member comes back online the others get a ping. */
async function touchAndMaybePing(code: string, playerId: string, version: number) {
  const now = Date.now();
  const prev = await getStore().touch(code, playerId, now);
  if (now - prev >= OFFLINE_AFTER_MS) await publishVersion(code, version);
}

export async function viewFlow(code: string, token: string | null): Promise<View> {
  const store = getStore();
  let { stored, member } = await memberFor(code, token);
  await touchAndMaybePing(code, member.id, stored.version);
  let presence = await store.presence(code);
  const now = Date.now();

  // If the host has dropped out, the session pauses: freeze a running timer.
  const hostSeen = presence[stored.room.hostPlayerId] ?? stored.room.createdAt;
  if (stored.room.phase !== 'ended' && now - hostSeen >= OFFLINE_AFTER_MS && stored.room.timer.endsAt !== null) {
    try {
      await mutate(code, (room) => {
        if (room.timer.endsAt === null) return { ok: true, room, result: null };
        const r = structuredClone(room);
        r.timer = {
          ...r.timer,
          endsAt: null,
          pausedRemainingSec: Math.max(0, Math.ceil((room.timer.endsAt! - Date.now()) / 1000)),
        };
        return { ok: true, room: r, result: null };
      });
      ({ stored, member } = await memberFor(code, token));
      presence = await store.presence(code);
    } catch {
      // Best effort; the next view will try again.
    }
  }

  const view = viewFor(stored.room, member.id, {
    now: Date.now(),
    version: stored.version,
    presence,
    realtime: realtimeMode(),
  });
  if (!view) throw new HttpError(401, 'Join the room first');
  return view;
}

export async function leaveFlow(code: string, token: string | null) {
  const store = getStore();
  const stored = await store.get(code);
  if (!stored) return;
  const member = findMember(stored.room, token);
  if (!member) return;
  // Seen just long enough ago to count as offline from now on.
  await store.touch(code, member.id, Date.now() - OFFLINE_AFTER_MS);
  await publishVersion(code, stored.version);
}
