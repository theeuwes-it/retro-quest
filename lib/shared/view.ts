// viewFor: the ONLY place that decides what one player may see. Every rule
// about hidden cards, anonymity, Tavern picks and votes lives here, and it is
// unit-tested in tests/view.test.ts.
import { CLAIM_HOST_AFTER_MS, COINS_PER_PLAYER, OFFLINE_AFTER_MS, stepIndexOf } from './config';
import { bossHp, coinsSpent, partyXp, targetTitle, voteTotals } from './rules';
import type { Room, View, ViewCard, ViewPlayer } from './types';
import { BOSS_MAX_HP } from './config';

export interface ViewCtx {
  now: number;
  version: number;
  /** playerId -> last seen (ms) */
  presence: Record<string, number>;
  realtime: 'ably' | 'poll';
}

export function viewFor(room: Room, playerId: string, ctx: ViewCtx): View | null {
  const viewer = room.players.find((p) => p.id === playerId);
  if (!viewer) return null;

  const isOnline = (id: string) => ctx.now - (ctx.presence[id] ?? 0) < OFFLINE_AFTER_MS;
  const hostLastSeen = ctx.presence[room.hostPlayerId] ?? room.createdAt;
  const hostAway = room.phase !== 'ended' && ctx.now - hostLastSeen >= OFFLINE_AFTER_MS;

  const players: ViewPlayer[] = room.players.map((p) => {
    const vp: ViewPlayer = {
      id: p.id,
      name: p.name,
      avatarId: p.avatarId,
      color: p.color,
      isHost: p.id === room.hostPlayerId,
      plays: p.plays,
      online: p.id === viewer.id ? true : isOnline(p.id),
      doneWriting: p.doneWriting,
      coinsSpent: coinsSpent(room, p.id),
    };
    const pick = room.tavernPicks[p.id];
    if (pick && (room.revealed.tavern || p.id === viewer.id)) vp.classId = pick.classId;
    return vp;
  });

  const tavernPicks = Object.entries(room.tavernPicks)
    .filter(([pid]) => room.revealed.tavern || pid === viewer.id)
    .map(([pid, pick]) => ({ playerId: pid, classId: pick.classId, ...(pick.comment ? { comment: pick.comment } : {}) }));

  const cards: ViewCard[] = room.cards.map((c) => {
    const mine = c.authorId === viewer.id;
    if (!room.revealed[c.type] && !mine) {
      // Face down: no text, and no author for anonymous cards.
      return c.anonymous
        ? { id: c.id, type: c.type, hidden: true, anonymous: true }
        : { id: c.id, type: c.type, hidden: true, authorId: c.authorId };
    }
    const vc: ViewCard = {
      id: c.id,
      type: c.type,
      hidden: false,
      text: c.text,
      anonymous: c.anonymous,
      mine,
      discussed: c.discussed,
      createdAt: c.createdAt,
    };
    if (!c.anonymous || mine) vc.authorId = c.authorId;
    if (c.groupId) vc.groupId = c.groupId;
    return vc;
  });

  const myVotes = { ...(room.votes[viewer.id] ?? {}) };
  const spent = Object.values(myVotes).reduce((s, n) => s + n, 0);

  // Suggestions only reference card ids; the cards themselves are already revealed by then.
  const suggestions = room.suggestions.map((s) => ({ ...s, cardIds: [...s.cardIds] }));

  return {
    code: room.code,
    version: ctx.version,
    serverNow: ctx.now,
    me: players.find((p) => p.id === viewer.id)!,
    hostPlayerId: room.hostPlayerId,
    isHost: viewer.id === room.hostPlayerId,
    hostAway,
    canClaimHost:
      viewer.id !== room.hostPlayerId && room.phase !== 'ended' && ctx.now - hostLastSeen >= CLAIM_HOST_AFTER_MS,
    phase: room.phase,
    subPhase: room.subPhase,
    stepIndex: room.phase === 'ended' ? stepIndexOf('loot', 'active') : stepIndexOf(room.phase, room.subPhase),
    furthestStep: room.furthestStep,
    timer: { ...room.timer },
    revealed: { ...room.revealed },
    players,
    tavernPicks,
    tavernPickedCount: Object.keys(room.tavernPicks).length,
    cards,
    spotlightCardId: room.spotlightCardId,
    groups: room.groups.map((g) => ({ ...g, cardIds: [...g.cardIds] })),
    suggestions,
    votes: {
      mine: myVotes,
      coinsLeft: viewer.plays ? COINS_PER_PLAYER - spent : 0,
      locked: room.votingLocked,
      totals: room.revealed.votes ? voteTotals(room) : null,
    },
    bosses: room.bosses.map((b) => ({
      targetId: b.targetId,
      title: targetTitle(room, b.targetId),
      name: b.name,
      attacks: b.attacks.map((a) => ({ ...a })),
      defeated: b.defeated,
      hp: bossHp(b),
      maxHp: BOSS_MAX_HP,
    })),
    xp: partyXp(room),
    createdAt: room.createdAt,
    ...(room.endedAt ? { endedAt: room.endedAt } : {}),
    realtime: ctx.realtime,
  };
}
