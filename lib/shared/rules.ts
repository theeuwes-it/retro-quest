// Small pure helpers shared by the reducer, viewFor and the export.
import {
  BOSS_MAX_HP,
  FIRST_ATTACK_DAMAGE,
  LOCATIONS,
  NEXT_ATTACK_DAMAGE,
  STEPS,
  XP,
  locationIndexOf,
} from './config';
import type { Boss, Room } from './types';

export function playingMembers(room: Room) {
  return room.players.filter((p) => p.plays);
}

export function bossHp(boss: Boss): number {
  const owned = boss.attacks.filter((a) => a.ownerId).length;
  if (owned === 0) return BOSS_MAX_HP;
  const damage = FIRST_ATTACK_DAMAGE + NEXT_ATTACK_DAMAGE * (owned - 1);
  return Math.max(0, BOSS_MAX_HP - damage);
}

export function activeBoss(room: Room): Boss | undefined {
  return room.bosses[room.bosses.length - 1];
}

/** Valid vote targets: revealed Monster cards that are not in a group, plus groups. */
export function voteTargetIds(room: Room): string[] {
  const ids: string[] = [];
  for (const c of room.cards) {
    if (c.type === 'monster' && !c.groupId) ids.push(c.id);
  }
  for (const g of room.groups) ids.push(g.id);
  return ids;
}

export function voteTotals(room: Room): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const id of voteTargetIds(room)) totals[id] = 0;
  for (const perPlayer of Object.values(room.votes)) {
    for (const [target, coins] of Object.entries(perPlayer)) {
      if (target in totals) totals[target] += coins;
    }
  }
  return totals;
}

/** Targets sorted by votes (desc), ties keep creation order. */
export function rankedTargets(room: Room): { targetId: string; total: number }[] {
  const totals = voteTotals(room);
  const order = voteTargetIds(room);
  return order
    .map((targetId, i) => ({ targetId, total: totals[targetId], i }))
    .sort((a, b) => b.total - a.total || a.i - b.i)
    .map(({ targetId, total }) => ({ targetId, total }));
}

export function coinsSpent(room: Room, playerId: string): number {
  return Object.values(room.votes[playerId] ?? {}).reduce((s, n) => s + n, 0);
}

/** Text of a vote target: the card text or the group title. */
export function targetTitle(room: Room, targetId: string): string {
  const group = room.groups.find((g) => g.id === targetId);
  if (group) return group.title;
  const card = room.cards.find((c) => c.id === targetId);
  return card?.text ?? 'Unknown Monster';
}

const STOPWORDS = new Set(
  'the a an and or but of to in on at for with without from by is are was were be been our we us it its this that too very not no so as into than then there their they them just'.split(
    ' ',
  ),
);
const CREATURES = ['Hydra', 'Dragon', 'Slime', 'Golem', 'Wyrm', 'Basilisk', 'Troll', 'Kraken'];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** "flaky pipeline keeps failing" -> "The Flaky Pipeline Hydra" */
export function generateBossName(text: string): string {
  const words = (text.match(/[A-Za-z][A-Za-z'-]*/g) ?? [])
    .filter((w) => w.length > 2 && !STOPWORDS.has(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  const creature = CREATURES[hash(text) % CREATURES.length];
  const name = words.length ? `The ${words.join(' ')} ${creature}` : `The Nameless ${creature}`;
  return name.slice(0, 60);
}

export function partyXp(room: Room) {
  const playing = Math.max(1, playingMembers(room).length);
  const cards = room.cards.length;
  const picks = Object.keys(room.tavernPicks).length;
  const coins = Object.values(room.votes).reduce(
    (s, v) => s + Object.values(v).reduce((a, b) => a + b, 0),
    0,
  );
  const attacks = room.bosses.reduce((s, b) => s + b.attacks.length, 0);
  const owned = room.bosses.reduce((s, b) => s + b.attacks.filter((a) => a.ownerId).length, 0);
  const defeated = room.bosses.filter((b) => b.defeated).length;
  const furthest = STEPS[Math.min(room.furthestStep, STEPS.length - 1)];
  const locationsReached = Math.max(0, Math.min(LOCATIONS.length - 1, locationIndexOf(furthest.phase)));

  const total =
    picks * XP.tavernPick +
    cards * XP.card +
    coins * XP.coin +
    attacks * XP.attack +
    owned * XP.ownedAttack +
    defeated * XP.bossDefeated +
    locationsReached * XP.locationReachedPerPlayer * playing;
  const perLevel = XP.perLevelPerPlayer * playing;
  return {
    total,
    level: 1 + Math.floor(total / perLevel),
    intoLevel: total % perLevel,
    perLevel,
  };
}

export function shorten(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…';
}
