import { describe, expect, it } from 'vitest';
import { bossHp, partyXp } from '@/lib/shared/rules';
import { createRoom, joinRoom } from '@/lib/shared/reducer';
import { CLAIM_HOST_AFTER_MS, OFFLINE_AFTER_MS, STEPS } from '@/lib/shared/config';
import { AVATARS } from '@/lib/shared/classes';
import type { Room } from '@/lib/shared/types';
import { act, goTo, makeCtx, setupRoom, tryAct } from './helpers';

function errorOf(out: ReturnType<typeof tryAct>) {
  return out.ok ? null : out.error;
}

describe('rooms and joining', () => {
  it('creates a room with the host playing by default', () => {
    const out = createRoom({ hostName: 'Hana', hostPlays: undefined }, 'ABCD', makeCtx());
    expect(out.ok && out.room.players[0].plays).toBe(true);
    const off = createRoom({ hostName: 'Hana', hostPlays: false }, 'ABCD', makeCtx());
    expect(off.ok && off.room.players[0].plays).toBe(false);
  });

  it('gives each avatar once until all 12 are taken, then allows repeats', () => {
    const { room } = setupRoom(11); // host + 11 = 12 avatars
    const dup = joinRoom(room, { name: 'Late', avatarId: 'mage' }, makeCtx());
    expect(dup.ok).toBe(true); // all taken -> repeats allowed
    const s = setupRoom(2);
    const taken = joinRoom(s.room, { name: 'Copy', avatarId: s.room.players[1].avatarId }, makeCtx());
    expect(taken.ok).toBe(false);
  });

  it('rejects duplicate names and supports more than 12 players', () => {
    const { room } = setupRoom(12);
    expect(room.players.length).toBe(13);
    const out = joinRoom(room, { name: 'ari', avatarId: AVATARS[0].id }, makeCtx());
    expect(out.ok).toBe(false);
  });
});

describe('phases and permissions', () => {
  it('only lets the host move the party', () => {
    const { room, ids } = setupRoom(4);
    expect(errorOf(tryAct(room, ids[1], { type: 'phase:set', phase: 'tavern', subPhase: 'writing' }))).toMatch(/host/);
    const r = goTo(room, ids[0], 'tavern', 'writing');
    expect(r.phase).toBe('tavern');
    expect(r.timer.durationSec).toBe(240);
  });

  it('default timings add up to 48 minutes', () => {
    expect(STEPS.reduce((s, x) => s + x.defaultSec, 0)).toBe(48 * 60);
  });

  it('auto-reveals everything the party moved past', () => {
    const { room, ids } = setupRoom(4);
    let r = goTo(room, ids[0], 'monster', 'writing');
    r = act(r, ids[1], { type: 'card:add', cardType: 'monster', text: 'x', anonymous: false });
    r = goTo(r, ids[0], 'treasure', 'writing');
    expect(r.revealed.monster).toBe(true);
    expect(r.revealed.tavern).toBe(true);
  });

  it('runs the timer from endsAt', () => {
    const { room, ids } = setupRoom(4);
    let r = goTo(room, ids[0], 'tavern', 'writing');
    r = act(r, ids[0], { type: 'timer:start' }, makeCtx(1000));
    expect(r.timer.endsAt).toBe(1000 + 240_000);
    r = act(r, ids[0], { type: 'timer:pause' }, makeCtx(61_000));
    expect(r.timer).toMatchObject({ endsAt: null, pausedRemainingSec: 180 });
    r = act(r, ids[0], { type: 'timer:add' });
    expect(r.timer.pausedRemainingSec).toBe(240);
    r = act(r, ids[0], { type: 'timer:resume' }, makeCtx(100_000));
    expect(r.timer.endsAt).toBe(100_000 + 240_000);
    r = act(r, ids[0], { type: 'timer:reset' });
    expect(r.timer).toEqual({ durationSec: 240, endsAt: null, pausedRemainingSec: null });
  });

  it('makes an ended room read-only', () => {
    const { room, ids } = setupRoom(4);
    const r = act(room, ids[0], { type: 'session:end' });
    expect(r.phase).toBe('ended');
    expect(errorOf(tryAct(r, ids[0], { type: 'phase:set', phase: 'tavern', subPhase: 'writing' }))).toMatch(/ended/);
  });
});

describe('cards', () => {
  function monsters() {
    const s = setupRoom(4);
    const room = goTo(s.room, s.ids[0], 'monster', 'writing');
    return { ...s, room };
  }

  it('validates text length 1 to 280', () => {
    const { room, ids } = monsters();
    expect(errorOf(tryAct(room, ids[1], { type: 'card:add', cardType: 'monster', text: '   ', anonymous: false }))).toBeTruthy();
    expect(
      errorOf(tryAct(room, ids[1], { type: 'card:add', cardType: 'monster', text: 'x'.repeat(281), anonymous: false })),
    ).toBeTruthy();
    expect(tryAct(room, ids[1], { type: 'card:add', cardType: 'monster', text: 'x'.repeat(280), anonymous: false }).ok).toBe(true);
  });

  it('only accepts the card type of the current location', () => {
    const { room, ids } = monsters();
    expect(errorOf(tryAct(room, ids[1], { type: 'card:add', cardType: 'treasure', text: 'x', anonymous: false }))).toBeTruthy();
  });

  it('allows edits always, deletes only before the reveal, and only for the author', () => {
    const { room: r0, ids } = monsters();
    let r = act(r0, ids[1], { type: 'card:add', cardType: 'monster', text: 'one', anonymous: false });
    const id = r.cards[0].id;
    expect(errorOf(tryAct(r, ids[2], { type: 'card:edit', id, text: 'hack' }))).toMatch(/own/);
    r = act(r, ids[1], { type: 'card:edit', id, text: 'two' });
    r = act(r, ids[0], { type: 'reveal' });
    expect(errorOf(tryAct(r, ids[1], { type: 'card:delete', id }))).toMatch(/after the reveal/);
    r = act(r, ids[1], { type: 'card:edit', id, text: 'three' });
    expect(r.cards[0].text).toBe('three');
    // late additions after the reveal
    r = act(r, ids[2], { type: 'card:add', cardType: 'monster', text: 'late', anonymous: false });
    expect(r.cards.length).toBe(2);
  });

  it('lets the host mark discussed and spotlight', () => {
    const { room: r0, ids } = monsters();
    let r = act(r0, ids[1], { type: 'card:add', cardType: 'monster', text: 'one', anonymous: false });
    const id = r.cards[0].id;
    expect(errorOf(tryAct(r, ids[0], { type: 'card:spotlight', id }))).toMatch(/Reveal/);
    r = act(r, ids[0], { type: 'reveal' });
    r = act(r, ids[0], { type: 'card:spotlight', id });
    r = act(r, ids[0], { type: 'card:discussed', id });
    expect(r.spotlightCardId).toBe(id);
    expect(r.cards[0].discussed).toBe(true);
    expect(errorOf(tryAct(r, ids[1], { type: 'card:discussed', id }))).toMatch(/host/);
  });
});

function warTable(): { room: Room; ids: string[]; cards: string[] } {
  const s = setupRoom(4);
  const [host, a, b, c] = s.ids;
  let r = goTo(s.room, host, 'monster', 'writing');
  r = act(r, a, { type: 'card:add', cardType: 'monster', text: 'Flaky pipeline', anonymous: false });
  r = act(r, b, { type: 'card:add', cardType: 'monster', text: 'Pipeline flakes again', anonymous: false });
  r = act(r, c, { type: 'card:add', cardType: 'monster', text: 'Too many meetings', anonymous: false });
  r = act(r, a, { type: 'card:add', cardType: 'monster', text: 'Unclear scope', anonymous: true });
  r = goTo(r, host, 'warTable', 'grouping');
  return { room: r, ids: s.ids, cards: r.cards.map((x) => x.id) };
}

describe('grouping and voting', () => {
  it('groups, renames, ungroups and handles suggestions', () => {
    const { room, ids, cards } = warTable();
    const [host, a] = ids;
    let r = act(room, a, { type: 'group:suggest', cardIds: [cards[0], cards[1]] });
    expect(errorOf(tryAct(r, a, { type: 'group:create', cardIds: [cards[0], cards[1]] }))).toMatch(/host/);
    r = act(r, host, { type: 'group:create', cardIds: [cards[0], cards[1]], suggestionId: r.suggestions[0].id });
    expect(r.suggestions).toHaveLength(0);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].title).toBe('Flaky pipeline');
    // Dropping a card onto a grouped card extends that group
    r = act(r, host, { type: 'group:create', cardIds: [cards[2], cards[0]] });
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].cardIds).toHaveLength(3);
    r = act(r, host, { type: 'group:rename', id: r.groups[0].id, title: 'CI pain' });
    expect(r.groups[0].title).toBe('CI pain');
    r = act(r, host, { type: 'group:ungroup', id: r.groups[0].id });
    expect(r.groups).toHaveLength(0);
    expect(r.cards.every((c) => !c.groupId)).toBe(true);
  });

  it('caps coins at 3 per player, allows stacking, and only while voting is open', () => {
    const { room, ids, cards } = warTable();
    const [host, a] = ids;
    expect(errorOf(tryAct(room, a, { type: 'vote:set', targetId: cards[0], coins: 1 }))).toMatch(/not open/);
    let r = goTo(room, host, 'warTable', 'voting');
    r = act(r, a, { type: 'vote:set', targetId: cards[0], coins: 3 });
    expect(errorOf(tryAct(r, a, { type: 'vote:set', targetId: cards[1], coins: 1 }))).toMatch(/only have 3/);
    expect(errorOf(tryAct(r, a, { type: 'vote:set', targetId: cards[0], coins: 4 }))).toBeTruthy();
    r = act(r, a, { type: 'vote:set', targetId: cards[0], coins: 1 });
    r = act(r, a, { type: 'vote:set', targetId: cards[1], coins: 2 });
    expect(r.votes[a]).toEqual({ [cards[0]]: 1, [cards[1]]: 2 });
    r = act(r, host, { type: 'vote:lock' });
    expect(errorOf(tryAct(r, a, { type: 'vote:set', targetId: cards[0], coins: 0 }))).toMatch(/locked/);
  });

  it('moves coins into a group and back out', () => {
    const { room, ids, cards } = warTable();
    const [host, a, b] = ids;
    let r = goTo(room, host, 'warTable', 'voting');
    r = act(r, a, { type: 'vote:set', targetId: cards[0], coins: 2 });
    r = act(r, b, { type: 'vote:set', targetId: cards[1], coins: 1 });
    r = act(r, host, { type: 'group:create', cardIds: [cards[0], cards[1]] });
    const gid = r.groups[0].id;
    expect(r.votes[a]).toEqual({ [gid]: 2 });
    expect(r.votes[b]).toEqual({ [gid]: 1 });
    // grouped cards are no longer vote targets on their own
    expect(errorOf(tryAct(r, a, { type: 'vote:set', targetId: cards[0], coins: 1 }))).toMatch(/Monsters or groups/);
    r = act(r, host, { type: 'group:ungroup', id: gid });
    expect(r.votes[a]).toEqual({ [cards[0]]: 2 });
  });
});

describe('boss battle', () => {
  function toBoss(tie = false) {
    const { room, ids, cards } = warTable();
    const [host, a, b, c] = ids;
    let r = goTo(room, host, 'warTable', 'voting');
    r = act(r, a, { type: 'vote:set', targetId: cards[2], coins: 3 });
    r = act(r, b, { type: 'vote:set', targetId: tie ? cards[1] : cards[2], coins: 3 });
    r = act(r, c, { type: 'vote:set', targetId: tie ? cards[0] : cards[1], coins: 1 });
    r = act(r, host, { type: 'reveal' });
    r = goTo(r, host, 'boss', 'active');
    return { r, ids, cards };
  }

  it('makes the top-voted Monster the Boss', () => {
    const { r, cards } = toBoss();
    expect(r.bosses).toHaveLength(1);
    expect(r.bosses[0].targetId).toBe(cards[2]);
    expect(r.bosses[0].name).toMatch(/^The Many Meetings /);
  });

  it('lets the host choose on a tie', () => {
    const { r, ids, cards } = toBoss(true);
    expect(r.bosses).toHaveLength(0);
    expect(errorOf(tryAct(r, ids[1], { type: 'boss:select', targetId: cards[1] }))).toMatch(/host/);
    const picked = act(r, ids[0], { type: 'boss:select', targetId: cards[1] });
    expect(picked.bosses[0].targetId).toBe(cards[1]);
  });

  it('only owned Attacks do damage, and defeat needs one', () => {
    const { r: r0, ids } = toBoss();
    const [host, a, b] = ids;
    let r = act(r0, a, { type: 'attack:add', text: 'Investigate flaky tests' });
    expect(bossHp(r.bosses[0])).toBe(100);
    expect(errorOf(tryAct(r, host, { type: 'boss:defeat' }))).toMatch(/owner/);
    r = act(r, b, { type: 'attack:edit', id: r.bosses[0].attacks[0].id, ownerId: a });
    expect(bossHp(r.bosses[0])).toBe(40);
    r = act(r, b, { type: 'attack:add', text: 'Fewer meetings', ownerId: b, dueDate: '2026-12-05' });
    expect(bossHp(r.bosses[0])).toBe(20);
    r = act(r, b, { type: 'attack:add', text: 'Third', ownerId: host });
    expect(bossHp(r.bosses[0])).toBe(0);
    expect(errorOf(tryAct(r, a, { type: 'attack:add', text: 'x', dueDate: '2026-13-01' }))).toMatch(/date/);
    expect(errorOf(tryAct(r, a, { type: 'boss:defeat' }))).toMatch(/host/);
    r = act(r, host, { type: 'boss:defeat' });
    expect(r.bosses[0].defeated).toBe(true);
    expect(errorOf(tryAct(r, a, { type: 'attack:add', text: 'more' }))).toMatch(/defeated/);
  });

  it('brings out the next Monster by votes as a mini-boss', () => {
    const { r: r0, ids, cards } = toBoss();
    const [host, a] = ids;
    expect(errorOf(tryAct(r0, host, { type: 'boss:next' }))).toMatch(/Defeat/);
    let r = act(r0, a, { type: 'attack:add', text: 'Do it', ownerId: a });
    r = act(r, host, { type: 'boss:defeat' });
    r = act(r, host, { type: 'boss:next' });
    expect(r.bosses).toHaveLength(2);
    expect(r.bosses[1].targetId).toBe(cards[1]);
  });
});

describe('players and host transfer', () => {
  it('lets the host remove a player', () => {
    const { room, ids } = setupRoom(4);
    const r = act(room, ids[0], { type: 'player:remove', playerId: ids[2] });
    expect(r.players.map((p) => p.id)).not.toContain(ids[2]);
    expect(r.removedTokens).toHaveLength(1);
  });

  it('lets a player claim host only after the host was away for 2 minutes', () => {
    const { room, ids } = setupRoom(4);
    const now = room.createdAt + 10 * 60_000;
    // Offline for 1 minute: too early.
    const recent = { ...makeCtx(now), presence: { [ids[0]]: now - OFFLINE_AFTER_MS - 60_000 } };
    expect(errorOf(tryAct(room, ids[1], { type: 'host:claim' }, recent))).toMatch(/2 minutes/);
    const away = { ...makeCtx(now), presence: { [ids[0]]: now - OFFLINE_AFTER_MS - CLAIM_HOST_AFTER_MS } };
    const r = act(room, ids[1], { type: 'host:claim' }, away);
    expect(r.hostPlayerId).toBe(ids[1]);
    expect(r.hostToken).not.toBe(room.hostToken);
  });
});

describe('party XP', () => {
  it('grows as the party adds cards and never ranks players', () => {
    const { room, ids } = setupRoom(4);
    const before = partyXp(room).total;
    let r = goTo(room, ids[0], 'monster', 'writing');
    r = act(r, ids[1], { type: 'card:add', cardType: 'monster', text: 'x', anonymous: false });
    expect(partyXp(r).total).toBeGreaterThan(before);
    expect(partyXp(goTo(room, ids[0], 'tavern', 'writing')).level).toBe(1);
  });
});
