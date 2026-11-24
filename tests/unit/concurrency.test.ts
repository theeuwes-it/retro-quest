import { describe, expect, it } from 'vitest';
import { MemoryStore } from '@/lib/server/store';
import { mutate } from '@/lib/server/rooms';
import { apply } from '@/lib/shared/reducer';
import { act, goTo, makeCtx, setupRoom } from './helpers';

function freshStore() {
  return new MemoryStore({ rooms: new Map(), presence: new Map(), rl: new Map() });
}

describe('concurrent writes', () => {
  it.each([5, 10])('keeps every card when %i players add cards in the same instant', async (n) => {
    const s = setupRoom(n);
    const room = goTo(s.room, s.host, 'monster', 'writing');
    const store = freshStore();
    await store.create('ABCD', { version: 1, room });

    await Promise.all(
      s.ids.map((id, i) =>
        mutate(
          'ABCD',
          (r) => {
            const out = apply(r, { type: 'card:add', cardType: 'monster', text: `card ${i}`, anonymous: false }, id, makeCtx());
            return out.ok ? { ok: true, room: out.room, result: null } : out;
          },
          store,
        ),
      ),
    );

    const stored = await store.get('ABCD');
    expect(stored!.room.cards).toHaveLength(s.ids.length);
    expect(stored!.version).toBe(1 + s.ids.length);
  });

  it('rejects a stale write', async () => {
    const s = setupRoom(2);
    const store = freshStore();
    await store.create('ABCD', { version: 1, room: s.room });
    const room2 = act(s.room, s.host, { type: 'phase:set', phase: 'tavern', subPhase: 'writing' });
    expect(await store.cas('ABCD', 1, { version: 2, room: room2 })).toBe(true);
    expect(await store.cas('ABCD', 1, { version: 2, room: s.room })).toBe(false);
  });
});
