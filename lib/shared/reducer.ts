// The pure game reducer. It only runs on the server: every client intent is
// validated and applied here, and the route handler saves the result.
import { AVATARS, CLASSES } from './classes';
import {
  ATTACK_TEXT_MAX,
  BOSS_NAME_MAX,
  CARD_PHASES,
  CARD_TEXT_MAX,
  CLAIM_HOST_AFTER_MS,
  COINS_PER_PLAYER,
  GROUP_TITLE_MAX,
  MAX_CARDS_PER_PLAYER_PER_TYPE,
  MAX_MEMBERS,
  NAME_MAX,
  NAME_TAG_COLORS,
  OFFLINE_AFTER_MS,
  STEPS,
  TAVERN_COMMENT_MAX,
  stepIndexOf,
} from './config';
import {
  activeBoss,
  generateBossName,
  rankedTargets,
  shorten,
  targetTitle,
  voteTargetIds,
} from './rules';
import type { Attack, CardType, ClientEvent, Player, Room } from './types';

export interface Ctx {
  now: number;
  newId: () => string;
  /** New secret token (player or host). */
  newToken: () => string;
  /** playerId -> last seen (ms). Only needed for host:claim. */
  presence?: Record<string, number>;
}

export type ApplyResult = { ok: true; room: Room } | { ok: false; error: string; status: number };

const fail = (error: string, status = 400): ApplyResult => ({ ok: false, error, status });

// ---------------------------------------------------------------------------
// Validation helpers

function cleanText(raw: unknown, max: number, what: string): string | { error: string } {
  if (typeof raw !== 'string') return { error: `${what} is required` };
  const text = raw.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').trim();
  if (text.length < 1) return { error: `${what} can't be empty` };
  if (text.length > max) return { error: `${what} can be at most ${max} characters` };
  return text;
}

function isError(v: unknown): v is { error: string } {
  return typeof v === 'object' && v !== null && 'error' in v;
}

function validDate(raw: unknown): string | undefined | { error: string } {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { error: 'Due date must be YYYY-MM-DD' };
  const d = new Date(raw + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) return { error: 'Due date is not a real date' };
  return raw;
}

// ---------------------------------------------------------------------------
// Room creation and joining (no actor yet)

export interface CreateInput {
  hostName: unknown;
  hostPlays: unknown;
  avatarId?: unknown;
}

export function createRoom(
  input: CreateInput,
  code: string,
  ctx: Ctx,
): { ok: true; room: Room; player: Player } | { ok: false; error: string; status: number } {
  const name = cleanText(input.hostName, NAME_MAX, 'Name');
  if (isError(name)) return fail(name.error) as { ok: false; error: string; status: number };
  const plays = input.hostPlays !== false;
  let avatarId = typeof input.avatarId === 'string' ? input.avatarId : AVATARS[0].id;
  if (!AVATARS.some((a) => a.id === avatarId)) avatarId = AVATARS[0].id;

  const host: Player = {
    id: ctx.newId(),
    token: ctx.newToken(),
    name,
    avatarId,
    color: 0,
    isHost: true,
    plays,
    doneWriting: false,
    joinedAt: ctx.now,
  };
  const room: Room = {
    code,
    hostPlayerId: host.id,
    hostToken: ctx.newToken(),
    phase: 'lobby',
    subPhase: 'active',
    revealed: { tavern: false, monster: false, treasure: false, potion: false, votes: false },
    timer: { durationSec: 0, endsAt: null, pausedRemainingSec: null },
    players: [host],
    removedTokens: [],
    tavernPicks: {},
    cards: [],
    spotlightCardId: null,
    groups: [],
    suggestions: [],
    votes: {},
    votingLocked: false,
    bosses: [],
    furthestStep: 0,
    createdAt: ctx.now,
  };
  return { ok: true, room, player: host };
}

/** Avatar ids that are still free. When all 12 are taken, avatars may repeat. */
export function freeAvatars(room: Room): string[] {
  const taken = new Set(room.players.filter((p) => p.plays).map((p) => p.avatarId));
  const free = AVATARS.map((a) => a.id).filter((id) => !taken.has(id));
  return free.length ? free : AVATARS.map((a) => a.id);
}

export function joinRoom(
  room: Room,
  input: { name: unknown; avatarId: unknown },
  ctx: Ctx,
): { ok: true; room: Room; player: Player } | { ok: false; error: string; status: number } {
  if (room.phase === 'ended') return { ok: false, error: 'This session has ended', status: 410 };
  if (room.players.length >= MAX_MEMBERS) return { ok: false, error: 'This room is full', status: 409 };
  const name = cleanText(input.name, NAME_MAX, 'Name');
  if (isError(name)) return { ok: false, error: name.error, status: 400 };
  if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: 'Someone in this party already uses that name', status: 409 };
  }
  const avatarId = typeof input.avatarId === 'string' ? input.avatarId : '';
  if (!AVATARS.some((a) => a.id === avatarId)) return { ok: false, error: 'Pick an avatar', status: 400 };
  if (!freeAvatars(room).includes(avatarId)) {
    return { ok: false, error: 'That avatar was just taken, pick another one', status: 409 };
  }
  const next = structuredClone(room);
  const player: Player = {
    id: ctx.newId(),
    token: ctx.newToken(),
    name,
    avatarId,
    color: next.players.length % NAME_TAG_COLORS.length,
    isHost: false,
    plays: true,
    doneWriting: false,
    joinedAt: ctx.now,
  };
  next.players.push(player);
  return { ok: true, room: next, player };
}

// ---------------------------------------------------------------------------
// Step transitions

function goToStep(room: Room, index: number, ctx: Ctx) {
  const step = STEPS[index];
  room.phase = step.phase;
  room.subPhase = step.subPhase;
  // Anything the party has moved past is revealed, so nothing stays hidden forever.
  const at = (phase: Room['phase'], sub: Room['subPhase']) => index >= stepIndexOf(phase, sub);
  if (at('tavern', 'revealed')) room.revealed.tavern = true;
  if (at('monster', 'revealed')) room.revealed.monster = true;
  if (at('treasure', 'revealed')) room.revealed.treasure = true;
  if (at('potion', 'revealed')) room.revealed.potion = true;
  if (at('warTable', 'revealed')) {
    room.revealed.votes = true;
    room.votingLocked = true;
  }
  room.timer = { durationSec: step.defaultSec, endsAt: null, pausedRemainingSec: null };
  room.spotlightCardId = null;
  for (const p of room.players) p.doneWriting = false;
  room.furthestStep = Math.max(room.furthestStep, index);

  if (step.phase === 'boss' && room.bosses.length === 0) {
    const ranked = rankedTargets(room);
    const top = ranked[0];
    const tied = top && ranked[1] && ranked[1].total === top.total;
    if (top && top.total > 0 && !tied) {
      room.bosses.push({
        targetId: top.targetId,
        name: generateBossName(targetTitle(room, top.targetId)),
        attacks: [],
        defeated: false,
      });
    }
  }
  void ctx;
}

function currentStepIndex(room: Room) {
  return stepIndexOf(room.phase, room.subPhase);
}

// ---------------------------------------------------------------------------
// Votes follow cards into and out of groups.

function moveVotes(room: Room, fromIds: string[], toId: string) {
  for (const perPlayer of Object.values(room.votes)) {
    let moved = 0;
    for (const id of fromIds) {
      if (perPlayer[id]) {
        moved += perPlayer[id];
        delete perPlayer[id];
      }
    }
    if (moved) perPlayer[toId] = (perPlayer[toId] ?? 0) + moved;
  }
}

// ---------------------------------------------------------------------------
// The reducer

export function apply(room: Room, event: ClientEvent, actorId: string, ctx: Ctx): ApplyResult {
  const actor = room.players.find((p) => p.id === actorId);
  if (!actor) return fail('You are not part of this party', 401);
  if (room.phase === 'ended') return fail('This session has ended and is read-only', 409);
  if (!event || typeof event !== 'object' || typeof event.type !== 'string') return fail('Unknown action');

  const isHost = actor.id === room.hostPlayerId;
  const hostOnly = () => (isHost ? null : fail('Only the host can do that', 403));
  const r = structuredClone(room);
  const me = r.players.find((p) => p.id === actorId)!;
  const ok = (): ApplyResult => ({ ok: true, room: r });

  switch (event.type) {
    // --- Phases --------------------------------------------------------------
    case 'phase:set': {
      const denied = hostOnly();
      if (denied) return denied;
      const index = stepIndexOf(event.phase, event.subPhase);
      if (index < 0) return fail('Unknown step');
      goToStep(r, index, ctx);
      return ok();
    }
    case 'reveal': {
      const denied = hostOnly();
      if (denied) return denied;
      const sub = r.subPhase;
      if (r.phase === 'warTable' && (sub === 'grouping' || sub === 'voting')) {
        goToStep(r, stepIndexOf('warTable', 'revealed'), ctx);
        return ok();
      }
      if (sub === 'writing') {
        goToStep(r, stepIndexOf(r.phase, 'revealed'), ctx);
        return ok();
      }
      return fail('There is nothing to reveal right now');
    }

    // --- Timer ---------------------------------------------------------------
    case 'timer:start': {
      const denied = hostOnly();
      if (denied) return denied;
      let duration = r.timer.durationSec;
      if (event.durationSec !== undefined) {
        if (!Number.isInteger(event.durationSec) || event.durationSec < 1 || event.durationSec > 7200) {
          return fail('Timer must be between 1 second and 2 hours');
        }
        duration = event.durationSec;
      }
      if (duration < 1) return fail('Set a duration first');
      r.timer = { durationSec: duration, endsAt: ctx.now + duration * 1000, pausedRemainingSec: null };
      return ok();
    }
    case 'timer:pause': {
      const denied = hostOnly();
      if (denied) return denied;
      if (r.timer.endsAt === null) return fail('The timer is not running');
      const remaining = Math.max(0, Math.ceil((r.timer.endsAt - ctx.now) / 1000));
      r.timer = { ...r.timer, endsAt: null, pausedRemainingSec: remaining };
      return ok();
    }
    case 'timer:resume': {
      const denied = hostOnly();
      if (denied) return denied;
      if (r.timer.pausedRemainingSec === null) return fail('The timer is not paused');
      r.timer = { ...r.timer, endsAt: ctx.now + r.timer.pausedRemainingSec * 1000, pausedRemainingSec: null };
      return ok();
    }
    case 'timer:add': {
      const denied = hostOnly();
      if (denied) return denied;
      if (r.timer.endsAt !== null) {
        r.timer.endsAt = Math.max(r.timer.endsAt, ctx.now) + 60_000;
      } else if (r.timer.pausedRemainingSec !== null) {
        r.timer.pausedRemainingSec += 60;
      } else {
        r.timer.durationSec = Math.min(7200, r.timer.durationSec + 60);
      }
      return ok();
    }
    case 'timer:reset': {
      const denied = hostOnly();
      if (denied) return denied;
      let duration = STEPS[currentStepIndex(r)]?.defaultSec ?? 0;
      if (event.durationSec !== undefined) {
        if (!Number.isInteger(event.durationSec) || event.durationSec < 0 || event.durationSec > 7200) {
          return fail('Timer must be between 0 seconds and 2 hours');
        }
        duration = event.durationSec;
      }
      r.timer = { durationSec: duration, endsAt: null, pausedRemainingSec: null };
      return ok();
    }

    // --- Tavern --------------------------------------------------------------
    case 'tavern:pick': {
      if (r.phase !== 'tavern') return fail('Class picks happen in the Tavern');
      if (!me.plays) return fail('Only playing members pick a class');
      if (!CLASSES.some((c) => c.id === event.classId)) return fail('Unknown class');
      let comment: string | undefined;
      if (event.comment !== undefined && event.comment !== null && String(event.comment).trim() !== '') {
        const c = cleanText(event.comment, TAVERN_COMMENT_MAX, 'Comment');
        if (isError(c)) return fail(c.error);
        comment = c;
      }
      r.tavernPicks[me.id] = comment ? { classId: event.classId, comment } : { classId: event.classId };
      return ok();
    }

    // --- Cards ---------------------------------------------------------------
    case 'card:add': {
      const type = event.cardType as CardType;
      if (!(type in CARD_PHASES)) return fail('Unknown card type');
      if (r.phase !== CARD_PHASES[type]) return fail('You can only add this card type in its own location');
      if (r.subPhase !== 'writing' && r.subPhase !== 'revealed') return fail('Cards cannot be added right now');
      if (!me.plays) return fail('Only playing members add cards');
      const text = cleanText(event.text, CARD_TEXT_MAX, 'Card text');
      if (isError(text)) return fail(text.error);
      const count = r.cards.filter((c) => c.authorId === me.id && c.type === type).length;
      if (count >= MAX_CARDS_PER_PLAYER_PER_TYPE) return fail('That is a lot of cards! Merge a few first.');
      r.cards.push({
        id: ctx.newId(),
        type,
        text,
        authorId: me.id,
        anonymous: event.anonymous === true,
        discussed: false,
        createdAt: ctx.now,
      });
      return ok();
    }
    case 'card:edit': {
      const card = r.cards.find((c) => c.id === event.id);
      if (!card) return fail('Card not found', 404);
      if (card.authorId !== me.id) return fail('You can only edit your own cards', 403);
      const text = cleanText(event.text, CARD_TEXT_MAX, 'Card text');
      if (isError(text)) return fail(text.error);
      card.text = text;
      return ok();
    }
    case 'card:delete': {
      const card = r.cards.find((c) => c.id === event.id);
      if (!card) return fail('Card not found', 404);
      if (card.authorId !== me.id) return fail('You can only delete your own cards', 403);
      if (r.revealed[card.type]) return fail('Cards cannot be deleted after the reveal, but you can still edit them');
      r.cards = r.cards.filter((c) => c.id !== card.id);
      return ok();
    }
    case 'card:discussed': {
      const denied = hostOnly();
      if (denied) return denied;
      const card = r.cards.find((c) => c.id === event.id);
      if (!card) return fail('Card not found', 404);
      if (!r.revealed[card.type]) return fail('Reveal the cards first');
      card.discussed = !card.discussed;
      return ok();
    }
    case 'card:spotlight': {
      const denied = hostOnly();
      if (denied) return denied;
      const card = r.cards.find((c) => c.id === event.id);
      if (!card) return fail('Card not found', 404);
      if (!r.revealed[card.type]) return fail('Reveal the cards first');
      r.spotlightCardId = r.spotlightCardId === card.id ? null : card.id;
      return ok();
    }

    // --- Players -------------------------------------------------------------
    case 'player:doneWriting': {
      me.doneWriting = event.done === true;
      return ok();
    }
    case 'player:remove': {
      const denied = hostOnly();
      if (denied) return denied;
      const target = r.players.find((p) => p.id === event.playerId);
      if (!target) return fail('Player not found', 404);
      if (target.id === me.id) return fail('You cannot remove yourself');
      r.players = r.players.filter((p) => p.id !== target.id);
      r.removedTokens.push(target.token);
      delete r.tavernPicks[target.id];
      delete r.votes[target.id];
      r.suggestions = r.suggestions.filter((s) => s.byPlayerId !== target.id);
      for (const boss of r.bosses) {
        for (const a of boss.attacks) if (a.ownerId === target.id) delete a.ownerId;
      }
      return ok();
    }
    case 'host:claim': {
      if (isHost) return fail('You are already the host');
      const lastSeen = ctx.presence?.[r.hostPlayerId] ?? r.createdAt;
      // The host counts as offline OFFLINE_AFTER_MS after last being seen; the 2 minutes start then.
      if (ctx.now - lastSeen < OFFLINE_AFTER_MS + CLAIM_HOST_AFTER_MS) {
        return fail('The host can only be replaced after being away for 2 minutes', 409);
      }
      const oldHost = r.players.find((p) => p.id === r.hostPlayerId);
      if (oldHost) oldHost.isHost = false;
      me.isHost = true;
      r.hostPlayerId = me.id;
      r.hostToken = ctx.newToken(); // the old host token stops working
      return ok();
    }

    // --- Grouping ------------------------------------------------------------
    case 'group:create': {
      const denied = hostOnly();
      if (denied) return denied;
      if (r.phase !== 'warTable' || r.revealed.votes) return fail('Grouping happens at the War Table before the vote reveal');
      if (!Array.isArray(event.cardIds)) return fail('Pick cards to group');
      const ids = [...new Set(event.cardIds)];
      const cards = ids.map((id) => r.cards.find((c) => c.id === id));
      if (cards.some((c) => !c || c.type !== 'monster')) return fail('Only Monster cards can be grouped');
      const groupIds = [...new Set(cards.map((c) => c!.groupId).filter(Boolean) as string[])];
      const existing = groupIds.map((gid) => r.groups.find((g) => g.id === gid)!).filter(Boolean);
      const memberIds: string[] = [];
      for (const g of existing) for (const cid of g.cardIds) if (!memberIds.includes(cid)) memberIds.push(cid);
      for (const c of cards) if (!memberIds.includes(c!.id)) memberIds.push(c!.id);
      if (memberIds.length < 2) return fail('A group needs at least two cards');
      if (existing.length === 1 && existing[0].cardIds.length === memberIds.length) {
        return fail('These cards are already in one group');
      }
      const firstCard = r.cards.find((c) => c.id === memberIds[0])!;
      const title = existing[0]?.title ?? shorten(firstCard.text, 60);
      const group = { id: ctx.newId(), title, cardIds: memberIds };
      // Coins on the merged cards and old groups move to the new group.
      moveVotes(r, [...memberIds, ...existing.map((g) => g.id)], group.id);
      r.groups = r.groups.filter((g) => !groupIds.includes(g.id));
      r.groups.push(group);
      for (const c of r.cards) if (memberIds.includes(c.id)) c.groupId = group.id;
      if (event.suggestionId) r.suggestions = r.suggestions.filter((s) => s.id !== event.suggestionId);
      return ok();
    }
    case 'group:rename': {
      const denied = hostOnly();
      if (denied) return denied;
      const group = r.groups.find((g) => g.id === event.id);
      if (!group) return fail('Group not found', 404);
      const title = cleanText(event.title, GROUP_TITLE_MAX, 'Group title');
      if (isError(title)) return fail(title.error);
      group.title = title;
      return ok();
    }
    case 'group:ungroup': {
      const denied = hostOnly();
      if (denied) return denied;
      if (r.phase !== 'warTable' || r.revealed.votes) return fail('Grouping happens at the War Table before the vote reveal');
      const group = r.groups.find((g) => g.id === event.id);
      if (!group) return fail('Group not found', 404);
      moveVotes(r, [group.id], group.cardIds[0]);
      r.groups = r.groups.filter((g) => g.id !== group.id);
      for (const c of r.cards) if (c.groupId === group.id) delete c.groupId;
      return ok();
    }
    case 'group:suggest': {
      if (r.phase !== 'warTable' || r.revealed.votes) return fail('Suggestions happen at the War Table before the vote reveal');
      if (!Array.isArray(event.cardIds)) return fail('Pick cards to suggest');
      const ids = [...new Set(event.cardIds)];
      if (ids.length < 2) return fail('Pick at least two cards');
      if (ids.some((id) => r.cards.find((c) => c.id === id)?.type !== 'monster')) {
        return fail('Only Monster cards can be grouped');
      }
      if (r.suggestions.length >= 50) return fail('There are already many suggestions waiting');
      r.suggestions.push({ id: ctx.newId(), cardIds: ids, byPlayerId: me.id });
      return ok();
    }
    case 'group:dismiss': {
      const denied = hostOnly();
      if (denied) return denied;
      r.suggestions = r.suggestions.filter((s) => s.id !== event.id);
      return ok();
    }

    // --- Voting --------------------------------------------------------------
    case 'vote:set': {
      if (r.phase !== 'warTable' || r.subPhase !== 'voting') return fail('Voting is not open');
      if (r.votingLocked) return fail('Voting is locked');
      if (!me.plays) return fail('Only playing members vote');
      if (!voteTargetIds(r).includes(event.targetId)) return fail('You can only vote on Monsters or groups');
      const coins = event.coins;
      if (!Number.isInteger(coins) || coins < 0 || coins > COINS_PER_PLAYER) {
        return fail(`You can put 0 to ${COINS_PER_PLAYER} coins on a Monster`);
      }
      const mine = (r.votes[me.id] ??= {});
      const elsewhere = Object.entries(mine)
        .filter(([t]) => t !== event.targetId)
        .reduce((s, [, n]) => s + n, 0);
      if (elsewhere + coins > COINS_PER_PLAYER) return fail(`You only have ${COINS_PER_PLAYER} gold coins`);
      if (coins === 0) delete mine[event.targetId];
      else mine[event.targetId] = coins;
      return ok();
    }
    case 'vote:lock': {
      const denied = hostOnly();
      if (denied) return denied;
      if (r.phase !== 'warTable') return fail('Voting happens at the War Table');
      r.votingLocked = true;
      return ok();
    }

    // --- Boss ----------------------------------------------------------------
    case 'boss:select': {
      const denied = hostOnly();
      if (denied) return denied;
      if (r.phase !== 'boss') return fail('Bosses are chosen in the Boss Lair');
      if (!voteTargetIds(r).includes(event.targetId)) return fail('Pick a Monster or a group');
      if (r.bosses.some((b) => b.targetId === event.targetId && b !== activeBoss(r))) {
        return fail('That Monster has already been fought');
      }
      const current = activeBoss(r);
      const boss = {
        targetId: event.targetId,
        name: generateBossName(targetTitle(r, event.targetId)),
        attacks: [] as Attack[],
        defeated: false,
      };
      if (!current || current.defeated) {
        if (current?.defeated) return fail('Use "Fight next Monster" to bring out a mini-boss');
        r.bosses.push(boss);
      } else if (current.attacks.length === 0) {
        r.bosses[r.bosses.length - 1] = boss;
      } else {
        return fail('This Boss is already under attack');
      }
      return ok();
    }
    case 'boss:rename': {
      const denied = hostOnly();
      if (denied) return denied;
      const boss = activeBoss(r);
      if (!boss) return fail('There is no Boss yet');
      const name = cleanText(event.name, BOSS_NAME_MAX, 'Boss name');
      if (isError(name)) return fail(name.error);
      boss.name = name;
      return ok();
    }
    case 'boss:defeat': {
      const denied = hostOnly();
      if (denied) return denied;
      const boss = activeBoss(r);
      if (!boss) return fail('There is no Boss yet');
      if (boss.defeated) return fail('This Boss is already defeated');
      if (!boss.attacks.some((a) => a.ownerId)) return fail('The Boss needs at least one Attack with an owner');
      boss.defeated = true;
      return ok();
    }
    case 'boss:next': {
      const denied = hostOnly();
      if (denied) return denied;
      if (r.phase !== 'boss') return fail('Bosses are fought in the Boss Lair');
      const current = activeBoss(r);
      if (current && !current.defeated) return fail('Defeat the current Boss first');
      const fought = new Set(r.bosses.map((b) => b.targetId));
      const next = rankedTargets(r).find((t) => !fought.has(t.targetId));
      if (!next) return fail('There are no Monsters left to fight');
      r.bosses.push({
        targetId: next.targetId,
        name: generateBossName(targetTitle(r, next.targetId)),
        attacks: [],
        defeated: false,
      });
      return ok();
    }

    // --- Attacks -------------------------------------------------------------
    case 'attack:add': {
      if (r.phase !== 'boss') return fail('Attacks happen in the Boss Lair');
      const boss = activeBoss(r);
      if (!boss) return fail('There is no Boss yet');
      if (boss.defeated) return fail('This Boss is already defeated');
      const text = cleanText(event.text, ATTACK_TEXT_MAX, 'Attack');
      if (isError(text)) return fail(text.error);
      const due = validDate(event.dueDate);
      if (isError(due)) return fail(due.error);
      if (event.ownerId && !r.players.some((p) => p.id === event.ownerId)) return fail('Owner not found');
      const attack: Attack = { id: ctx.newId(), text, createdBy: me.id, createdAt: ctx.now };
      if (event.ownerId) attack.ownerId = event.ownerId;
      if (due) attack.dueDate = due;
      boss.attacks.push(attack);
      return ok();
    }
    case 'attack:edit': {
      if (r.phase !== 'boss' && r.phase !== 'loot') return fail('Attacks can only be edited in the Boss Lair or Loot Room');
      const attack = r.bosses.flatMap((b) => b.attacks).find((a) => a.id === event.id);
      if (!attack) return fail('Attack not found', 404);
      if (event.text !== undefined) {
        const text = cleanText(event.text, ATTACK_TEXT_MAX, 'Attack');
        if (isError(text)) return fail(text.error);
        attack.text = text;
      }
      if (event.ownerId !== undefined) {
        if (event.ownerId === null || event.ownerId === '') delete attack.ownerId;
        else if (!r.players.some((p) => p.id === event.ownerId)) return fail('Owner not found');
        else attack.ownerId = event.ownerId;
      }
      if (event.dueDate !== undefined) {
        const due = validDate(event.dueDate);
        if (isError(due)) return fail(due.error);
        if (due) attack.dueDate = due;
        else delete attack.dueDate;
      }
      const boss = r.bosses.find((b) => b.attacks.includes(attack))!;
      if (boss.defeated && !boss.attacks.some((a) => a.ownerId)) {
        return fail('A defeated Boss must keep at least one Attack with an owner');
      }
      return ok();
    }
    case 'attack:delete': {
      if (r.phase !== 'boss') return fail('Attacks can only be removed in the Boss Lair');
      const boss = r.bosses.find((b) => b.attacks.some((a) => a.id === event.id));
      if (!boss) return fail('Attack not found', 404);
      if (boss.defeated) return fail('This Boss is already defeated');
      boss.attacks = boss.attacks.filter((a) => a.id !== event.id);
      return ok();
    }

    // --- End -----------------------------------------------------------------
    case 'session:end': {
      const denied = hostOnly();
      if (denied) return denied;
      goToStep(r, stepIndexOf('loot', 'active'), ctx);
      r.phase = 'ended';
      r.subPhase = 'active';
      r.timer = { durationSec: 0, endsAt: null, pausedRemainingSec: null };
      r.endedAt = ctx.now;
      return ok();
    }

    default:
      return fail('Unknown action');
  }
}
