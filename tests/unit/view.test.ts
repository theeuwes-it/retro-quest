import { describe, expect, it } from 'vitest';
import { viewFor } from '@/lib/shared/view';
import { buildMarkdown } from '@/lib/shared/export';
import type { Room } from '@/lib/shared/types';
import { act, goTo, setupRoom } from './helpers';

const vctx = { now: 1_700_000_000_000, version: 1, presence: {}, realtime: 'poll' as const };
const view = (room: Room, id: string) => viewFor(room, id, vctx)!;
const json = (room: Room, id: string) => JSON.stringify(view(room, id));

function withMonsters() {
  const s = setupRoom(4);
  const [host, a, b] = s.ids;
  let room = goTo(s.room, host, 'monster', 'writing');
  room = act(room, a, { type: 'card:add', cardType: 'monster', text: 'SECRET-A flaky pipeline', anonymous: false });
  room = act(room, b, { type: 'card:add', cardType: 'monster', text: 'SECRET-B anonymous worry', anonymous: true });
  return { ...s, room, host, a, b };
}

describe('viewFor visibility rules', () => {
  it('hides other players card text during writing', () => {
    const { room, host, a, b, ids } = withMonsters();
    // host, the other author, and an uninvolved player
    for (const viewer of [host, b, ids[3]]) {
      expect(json(room, viewer)).not.toContain('SECRET-A');
    }
    for (const viewer of [host, a, ids[3]]) {
      expect(json(room, viewer)).not.toContain('SECRET-B');
    }
    const hidden = view(room, host).cards.find((c) => c.hidden && c.authorId === a);
    expect(hidden).toEqual({ id: expect.any(String), type: 'monster', hidden: true, authorId: a });
  });

  it('shows players their own cards during writing', () => {
    const { room, a } = withMonsters();
    expect(json(room, a)).toContain('SECRET-A');
  });

  it('never sends authorId of anonymous cards to others, before or after reveal', () => {
    const { room, host, a, b } = withMonsters();
    const anonCardId = room.cards.find((c) => c.anonymous)!.id;
    const check = (r: Room) => {
      for (const viewer of [host, a]) {
        const card = view(r, viewer).cards.find((c) => c.id === anonCardId)!;
        expect(card).not.toHaveProperty('authorId');
      }
      const own = view(r, b).cards.find((c) => c.id === anonCardId)!;
      expect(own.authorId).toBe(b);
    };
    check(room);
    const revealed = act(room, host, { type: 'reveal' });
    check(revealed);
    expect(json(revealed, a)).toContain('SECRET-B');
    // ... and in every later phase, plus the export
    let later = goTo(revealed, host, 'loot', 'active');
    check(later);
    const md = buildMarkdown(view(later, host));
    expect(md).toContain('SECRET-B');
    expect(md).toContain('Mysterious Stranger');
    const bName = later.players.find((p) => p.id === b)!.name;
    expect(md).not.toMatch(new RegExp(`SECRET-B[^\\n]*${bName}`));
    later = act(later, host, { type: 'session:end' });
    check(later);
  });

  it('reveals card text to everyone after the reveal', () => {
    const { room, host, ids } = withMonsters();
    const revealed = act(room, host, { type: 'reveal' });
    for (const viewer of ids) expect(json(revealed, viewer)).toContain('SECRET-A');
  });

  it('hides Tavern picks of others until revealed', () => {
    const s = setupRoom(4);
    const [host, a, b] = s.ids;
    let room = goTo(s.room, host, 'tavern', 'writing');
    room = act(room, a, { type: 'tavern:pick', classId: 'wizard', comment: 'TAVERN-SECRET' });
    expect(json(room, b)).not.toContain('TAVERN-SECRET');
    expect(view(room, b).players.find((p) => p.id === a)!.classId).toBeUndefined();
    expect(view(room, b).tavernPickedCount).toBe(1);
    expect(view(room, a).players.find((p) => p.id === a)!.classId).toBe('wizard');
    room = act(room, host, { type: 'reveal' });
    expect(json(room, b)).toContain('TAVERN-SECRET');
    expect(view(room, b).players.find((p) => p.id === a)!.classId).toBe('wizard');
  });

  it('hides where others put their coins until revealed, but shows coins spent', () => {
    const { room: r0, host, a, b } = withMonsters();
    let room = goTo(r0, host, 'warTable', 'voting');
    const target = room.cards[0].id;
    room = act(room, a, { type: 'vote:set', targetId: target, coins: 2 });
    const bView = view(room, b);
    expect(bView.votes.mine).toEqual({});
    expect(bView.votes.totals).toBeNull();
    expect(bView.players.find((p) => p.id === a)!.coinsSpent).toBe(2);
    expect(JSON.stringify(bView.votes)).not.toContain(target);
    const hostView = view(room, host);
    expect(hostView.votes.totals).toBeNull();
    expect(view(room, a).votes.mine).toEqual({ [target]: 2 });
    room = act(room, host, { type: 'reveal' });
    expect(view(room, b).votes.totals![target]).toBe(2);
  });

  it('never sends tokens', () => {
    const { room, host, a } = withMonsters();
    for (const viewer of [host, a]) {
      const out = json(room, viewer);
      expect(out).not.toContain(room.hostToken);
      for (const p of room.players) expect(out).not.toContain(p.token);
      expect(out).not.toMatch(/"token"|hostToken/);
    }
  });

  it('returns null for unknown players', () => {
    const { room } = withMonsters();
    expect(viewFor(room, 'nobody', vctx)).toBeNull();
  });
});
