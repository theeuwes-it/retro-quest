// All game rules and tunables live here, so they are easy to adjust after the first retro.
import type { CardType, Phase, SubPhase } from './types';

export const COINS_PER_PLAYER = 3;

export const BOSS_MAX_HP = 100;
export const FIRST_ATTACK_DAMAGE = 60;
export const NEXT_ATTACK_DAMAGE = 20;

export const CARD_TEXT_MAX = 280;
export const TAVERN_COMMENT_MAX = 140;
export const NAME_MAX = 24;
export const GROUP_TITLE_MAX = 120;
export const BOSS_NAME_MAX = 60;
export const ATTACK_TEXT_MAX = 280;
/** Abuse guard: max cards one player can have of a single type. */
export const MAX_CARDS_PER_PLAYER_PER_TYPE = 30;
/** Abuse guard: no hard player cap in the spec, but stop runaway joins. */
export const MAX_MEMBERS = 40;

// --- Party XP (shared, never per player) ---------------------------------
export const XP = {
  tavernPick: 10,
  card: 10,
  coin: 5,
  attack: 10,
  ownedAttack: 15,
  bossDefeated: 50,
  /** Per playing member, for every location the party reaches. */
  locationReachedPerPlayer: 5,
  /** XP needed per level, multiplied by the number of playing members. */
  perLevelPerPlayer: 25,
};

// --- Presence / host transfer --------------------------------------------
/**
 * A member counts as offline when not seen for this long. Browsers throttle
 * timers in hidden tabs to about once a minute, so this must stay above 60 s
 * or a host who switches tabs would pause the session. Closing the tab is
 * detected immediately through the leave beacon.
 */
export const OFFLINE_AFTER_MS = 75_000;
/** Players may claim host after the host has been away this long. */
export const CLAIM_HOST_AFTER_MS = 120_000;
/** Clients refresh their view at least this often (keeps presence fresh). */
export const VIEW_REFRESH_MS = 8_000;
/** Poll interval when the real-time connection is down or not configured. */
export const POLL_MS = 3_000;

// --- Storage ----------------------------------------------------------------
export const ROOM_TTL_SEC = 7 * 24 * 60 * 60;
export const MAX_WRITE_ATTEMPTS = 8;

// --- Room codes ---------------------------------------------------------------
/** Letters only, without the ambiguous I, L and O. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;

// --- Rate limits (per IP per minute) ------------------------------------------
export const JOIN_RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_JOIN_PER_MIN ?? 20);
export const CREATE_RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_CREATE_PER_MIN ?? 10);

// --- The journey ----------------------------------------------------------------
export interface Step {
  phase: Phase;
  subPhase: SubPhase;
  /** Default timer for this step in seconds (0 = no timer). */
  defaultSec: number;
  label: string;
}

/** Every step the host walks through with Next / Back. Default timings add up to 48 minutes. */
export const STEPS: Step[] = [
  { phase: 'lobby', subPhase: 'active', defaultSec: 0, label: 'Gathering the party' },
  { phase: 'tavern', subPhase: 'writing', defaultSec: 4 * 60, label: 'Choose your class' },
  { phase: 'tavern', subPhase: 'revealed', defaultSec: 0, label: 'The party is revealed' },
  { phase: 'monster', subPhase: 'writing', defaultSec: 4 * 60, label: 'Write Monster cards' },
  { phase: 'monster', subPhase: 'revealed', defaultSec: 7 * 60, label: 'Discuss the Monsters' },
  { phase: 'treasure', subPhase: 'writing', defaultSec: 4 * 60, label: 'Write Treasure cards' },
  { phase: 'treasure', subPhase: 'revealed', defaultSec: 5 * 60, label: 'Discuss the Treasure' },
  { phase: 'potion', subPhase: 'writing', defaultSec: 3 * 60, label: 'Write Potion cards' },
  { phase: 'potion', subPhase: 'revealed', defaultSec: 4 * 60, label: 'Discuss the Potions' },
  { phase: 'warTable', subPhase: 'grouping', defaultSec: 3 * 60, label: 'Group the Monsters' },
  { phase: 'warTable', subPhase: 'voting', defaultSec: 2 * 60, label: 'Spend your gold' },
  { phase: 'warTable', subPhase: 'revealed', defaultSec: 0, label: 'The votes are in' },
  { phase: 'boss', subPhase: 'active', defaultSec: 10 * 60, label: 'Defeat the Boss' },
  { phase: 'loot', subPhase: 'active', defaultSec: 2 * 60, label: 'Count the loot' },
];

export function stepIndexOf(phase: Phase, subPhase: SubPhase): number {
  return STEPS.findIndex((s) => s.phase === phase && s.subPhase === subPhase);
}

export interface Location {
  phase: Exclude<Phase, 'ended'>;
  name: string;
  purpose: string;
}

/** The 8 map locations, in travel order. */
export const LOCATIONS: Location[] = [
  { phase: 'lobby', name: 'Town Gate', purpose: 'Joining' },
  { phase: 'tavern', name: 'The Tavern', purpose: 'Check-in' },
  { phase: 'monster', name: 'Monster Woods', purpose: 'What got in the way' },
  { phase: 'treasure', name: 'Treasure Cave', purpose: 'What went well' },
  { phase: 'potion', name: 'Potion Shop', purpose: 'What helped / ideas to try' },
  { phase: 'warTable', name: 'The War Table', purpose: 'Group and vote' },
  { phase: 'boss', name: 'Boss Lair', purpose: 'Action items' },
  { phase: 'loot', name: 'Loot Room', purpose: 'Wrap-up' },
];

export function locationIndexOf(phase: Phase): number {
  if (phase === 'ended') return LOCATIONS.length - 1;
  return LOCATIONS.findIndex((l) => l.phase === phase);
}

export const CARD_PHASES: Record<CardType, Phase> = {
  monster: 'monster',
  treasure: 'treasure',
  potion: 'potion',
};

export const CARD_TYPE_INFO: Record<CardType, { label: string; plural: string; prompt: string }> = {
  monster: { label: 'Monster', plural: 'Monsters', prompt: 'What got in the way this sprint?' },
  treasure: { label: 'Treasure', plural: 'Treasure', prompt: 'What went well this sprint?' },
  potion: { label: 'Potion', plural: 'Potions', prompt: 'What helped, or what should we try?' },
};

/** Name-tag colours (AA contrast against white text). */
export const NAME_TAG_COLORS = [
  '#8a3b12', '#1f5f8b', '#6b3fa0', '#2e6b30', '#9c2f4f', '#7a5a00',
  '#0f6e6e', '#5b4636', '#3a4ea0', '#8b2f8b', '#4d6b00', '#a03a2a',
];
