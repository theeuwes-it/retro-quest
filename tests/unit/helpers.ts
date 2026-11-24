import { apply, createRoom, joinRoom, type Ctx } from '@/lib/shared/reducer';
import { STEPS } from '@/lib/shared/config';
import type { ClientEvent, Room } from '@/lib/shared/types';
import { AVATARS } from '@/lib/shared/classes';

let n = 0; // shared so ids stay unique across contexts

export function makeCtx(now = 1_700_000_000_000): Ctx {
  return {
    now,
    newId: () => `id${++n}`,
    newToken: () => `tok${++n}`,
  };
}

/** A room with a playing host and `players` extra players. Returns the room and member ids. */
export function setupRoom(players = 4) {
  const ctx = makeCtx();
  const created = createRoom({ hostName: 'Hana', hostPlays: true, avatarId: 'knight' }, 'ABCD', ctx);
  if (!created.ok) throw new Error(created.error);
  let room = created.room;
  const ids = [created.player.id];
  const names = ['Ari', 'Bo', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kai', 'Lu', 'Mo'];
  for (let i = 0; i < players; i++) {
    const out = joinRoom(room, { name: names[i], avatarId: AVATARS[(i + 1) % AVATARS.length].id }, ctx);
    if (!out.ok) throw new Error(out.error);
    room = out.room;
    ids.push(out.player.id);
  }
  return { room, ctx, host: ids[0], ids };
}

export function act(room: Room, actor: string, event: ClientEvent, ctx: Ctx = makeCtx()): Room {
  const out = apply(room, event, actor, ctx);
  if (!out.ok) throw new Error(`${event.type}: ${out.error}`);
  return out.room;
}

export function tryAct(room: Room, actor: string, event: ClientEvent, ctx: Ctx = makeCtx()) {
  return apply(room, event, actor, ctx);
}

export function goTo(room: Room, host: string, phase: Room['phase'], subPhase: Room['subPhase']) {
  return act(room, host, { type: 'phase:set', phase, subPhase });
}

export const stepOf = (phase: Room['phase'], subPhase: Room['subPhase']) =>
  STEPS.findIndex((s) => s.phase === phase && s.subPhase === subPhase);
