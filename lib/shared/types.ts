// Shared types for Retro Quest. The server keeps the full `Room`; clients only
// ever receive a `View` built by `viewFor` in view.ts.

export type Phase =
  | 'lobby'
  | 'tavern'
  | 'monster'
  | 'treasure'
  | 'potion'
  | 'warTable'
  | 'boss'
  | 'loot'
  | 'ended';

/**
 * - `active`   phases without a hidden/revealed split (lobby, boss, loot, ended)
 * - `writing`  tavern and card phases before the reveal
 * - `revealed` after the host reveals (discussion)
 * - `grouping` / `voting` the two War Table steps before the vote reveal
 */
export type SubPhase = 'active' | 'writing' | 'revealed' | 'grouping' | 'voting';

export type CardType = 'treasure' | 'monster' | 'potion';

export interface Timer {
  /** Length the timer starts from (seconds). */
  durationSec: number;
  /** Server timestamp (ms) at which a running timer hits 0; null when not running. */
  endsAt: number | null;
  /** Remaining seconds while paused; null when not paused. */
  pausedRemainingSec: number | null;
}

export interface Player {
  id: string;
  token: string; // secret
  name: string;
  avatarId: string;
  /** Index into the name-tag colour palette. */
  color: number;
  isHost: boolean;
  /** False when the host chose not to play. Non-playing members get no cards/coins. */
  plays: boolean;
  doneWriting: boolean;
  joinedAt: number;
}

export interface Card {
  id: string;
  type: CardType;
  text: string;
  authorId: string;
  anonymous: boolean;
  groupId?: string;
  discussed: boolean;
  createdAt: number;
}

export interface Group {
  id: string;
  title: string;
  cardIds: string[];
}

export interface MergeSuggestion {
  id: string;
  cardIds: string[];
  byPlayerId: string;
}

export interface Attack {
  id: string;
  text: string;
  ownerId?: string;
  dueDate?: string; // YYYY-MM-DD
  createdBy: string;
  createdAt: number;
}

export interface Boss {
  targetId: string;
  name: string;
  attacks: Attack[];
  defeated: boolean;
}

export interface Revealed {
  tavern: boolean;
  monster: boolean;
  treasure: boolean;
  potion: boolean;
  votes: boolean;
}

export interface Room {
  code: string;
  hostPlayerId: string;
  hostToken: string; // secret, never sent to clients
  phase: Phase;
  subPhase: SubPhase;
  revealed: Revealed;
  timer: Timer;
  players: Player[];
  /** Tokens of removed players, so a removed browser gets a clear message. */
  removedTokens: string[];
  tavernPicks: Record<string, { classId: string; comment?: string }>;
  cards: Card[];
  spotlightCardId: string | null;
  groups: Group[];
  suggestions: MergeSuggestion[];
  /** playerId -> targetId -> coins (sum <= COINS_PER_PLAYER) */
  votes: Record<string, Record<string, number>>;
  votingLocked: boolean;
  /** [0] = main boss, then mini-bosses. The last one is the active boss. */
  bosses: Boss[];
  /** Highest step index the party has reached (drives map flags and XP). */
  furthestStep: number;
  createdAt: number;
  endedAt?: number;
}

/** What the route handler stores in Redis. */
export interface StoredRoom {
  version: number;
  room: Room;
}

// ---------------------------------------------------------------------------
// Events (client -> server). `type` is the action name from the spec.

export type ClientEvent =
  | { type: 'phase:set'; phase: Phase; subPhase: SubPhase }
  | { type: 'timer:start'; durationSec?: number }
  | { type: 'timer:pause' }
  | { type: 'timer:resume' }
  | { type: 'timer:add' }
  | { type: 'timer:reset'; durationSec?: number }
  | { type: 'tavern:pick'; classId: string; comment?: string }
  | { type: 'card:add'; cardType: CardType; text: string; anonymous: boolean }
  | { type: 'card:edit'; id: string; text: string }
  | { type: 'card:delete'; id: string }
  | { type: 'card:discussed'; id: string }
  | { type: 'card:spotlight'; id: string }
  | { type: 'player:doneWriting'; done: boolean }
  | { type: 'player:remove'; playerId: string }
  | { type: 'host:claim' }
  | { type: 'reveal' }
  | { type: 'group:create'; cardIds: string[]; suggestionId?: string }
  | { type: 'group:rename'; id: string; title: string }
  | { type: 'group:ungroup'; id: string }
  | { type: 'group:suggest'; cardIds: string[] }
  | { type: 'group:dismiss'; id: string }
  | { type: 'vote:set'; targetId: string; coins: number }
  | { type: 'vote:lock' }
  | { type: 'boss:select'; targetId: string }
  | { type: 'boss:rename'; name: string }
  | { type: 'boss:defeat' }
  | { type: 'boss:next' }
  | { type: 'attack:add'; text: string; ownerId?: string; dueDate?: string }
  | { type: 'attack:edit'; id: string; text?: string; ownerId?: string | null; dueDate?: string | null }
  | { type: 'attack:delete'; id: string }
  | { type: 'session:end' };

export type EventType = ClientEvent['type'];

// ---------------------------------------------------------------------------
// Per-player filtered view (server -> client)

export interface ViewPlayer {
  id: string;
  name: string;
  avatarId: string;
  color: number;
  isHost: boolean;
  plays: boolean;
  online: boolean;
  doneWriting: boolean;
  /** Only present when the Tavern is revealed, or for yourself. */
  classId?: string;
  /** Coins this player has spent (visible to all; where they went is hidden until reveal). */
  coinsSpent: number;
}

export type ViewCard =
  | {
      id: string;
      type: CardType;
      hidden: true;
      /** Absent for anonymous cards. */
      authorId?: string;
      anonymous?: true;
    }
  | {
      id: string;
      type: CardType;
      hidden: false;
      text: string;
      /** Absent for anonymous cards unless you wrote them. */
      authorId?: string;
      anonymous: boolean;
      mine: boolean;
      groupId?: string;
      discussed: boolean;
      createdAt: number;
    };

export interface ViewBoss {
  targetId: string;
  title: string;
  name: string;
  attacks: Attack[];
  defeated: boolean;
  hp: number;
  maxHp: number;
}

export interface View {
  code: string;
  version: number;
  serverNow: number;
  me: ViewPlayer;
  hostPlayerId: string;
  isHost: boolean;
  hostAway: boolean;
  canClaimHost: boolean;
  phase: Phase;
  subPhase: SubPhase;
  stepIndex: number;
  furthestStep: number;
  timer: Timer;
  revealed: Revealed;
  players: ViewPlayer[];
  tavernPicks: { playerId: string; classId: string; comment?: string }[];
  tavernPickedCount: number;
  cards: ViewCard[];
  spotlightCardId: string | null;
  groups: Group[];
  suggestions: MergeSuggestion[];
  votes: {
    mine: Record<string, number>;
    coinsLeft: number;
    locked: boolean;
    /** Only after the votes are revealed. */
    totals: Record<string, number> | null;
  };
  bosses: ViewBoss[];
  xp: { total: number; level: number; intoLevel: number; perLevel: number };
  createdAt: number;
  endedAt?: number;
  realtime: 'ably' | 'poll';
}
