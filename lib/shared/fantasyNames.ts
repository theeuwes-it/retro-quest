// Fantasy questing names built from the name a player types. Runs locally:
// no AI service, no cost, and the name never leaves the browser.
// Suggestions are deterministic for (name, round), so they don't flicker while typing.
import { NAME_MAX } from './config';

const EPITHETS = [
  'Bold', 'Brave', 'Wise', 'Swift', 'Clever', 'Curious', 'Steadfast', 'Merry',
  'Patient', 'Fearless', 'Unflappable', 'Tireless', 'Radiant', 'Gentle', 'Kind', 'Nimble',
];
const TITLES = ['Sage', 'Ranger', 'Captain', 'Keeper', 'Warden', 'Scout', 'Mystic', 'Squire', 'Bard'];
const PLACES = [
  'Oakvale', 'Emberfall', 'Mistmoor', 'Starhaven', 'the North', 'Silverbrook',
  'Thornwood', 'Duskridge', 'Brightwater', 'Frosthold', 'Willowmere', 'the Dunes',
];
const SURNAME_A = ['Oak', 'Storm', 'Ember', 'Frost', 'Moon', 'Silver', 'Thorn', 'River', 'Star', 'Ash', 'Bright', 'Fern', 'Gold', 'Raven', 'Wind'];
const SURNAME_B = ['shield', 'song', 'brook', 'heart', 'quill', 'wood', 'fall', 'whisper', 'forge', 'glow', 'mantle', 'leaf', 'runner', 'ward', 'weaver'];
// Suffixes that start with a vowel follow a stem ending in a consonant, and the other way round.
const SUFFIX_AFTER_CONSONANT = ['arion', 'oric', 'ellan', 'iel', 'amir', 'orin', 'ara', 'uin', 'elle', 'avar'];
const SUFFIX_AFTER_VOWEL = ['wyn', 'dor', 'mir', 'rion', 'thas', 'nor', 'dra', 'riel', 'ndil', 'ra'];

const VOWEL = /[aeiouyàáâäãåæèéêëìíîïòóôöõøùúûü]/i;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small seeded PRNG (mulberry32) so a name + round always gives the same picks. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const capitalize = (w: string) => (w ? w[0].toLocaleUpperCase() + w.slice(1).toLocaleLowerCase() : w);

/** First word of the typed name, letters only, capitalized and at most 12 letters. */
export function baseName(typed: string): string {
  const first = typed.trim().split(/\s+/)[0] ?? '';
  const letters = (first.match(/[\p{L}'-]/gu) ?? []).join('').replace(/^['-]+|['-]+$/g, '');
  return capitalize(letters.slice(0, 12));
}

/** "Sander" -> "Sandarion"-style fantasy form of a name. */
function fantasyForm(base: string, pick: <T>(list: T[]) => T): string {
  const lower = base.toLocaleLowerCase();
  // Keep the start of the name so it stays recognisable.
  const stem = lower.length > 4 ? lower.slice(0, Math.ceil(lower.length * 0.6)) : lower;
  const endsWithVowel = VOWEL.test(stem[stem.length - 1] ?? '');
  const suffix = pick(endsWithVowel ? SUFFIX_AFTER_VOWEL : SUFFIX_AFTER_CONSONANT);
  return capitalize(stem + suffix);
}

type Pattern = (base: string, pick: <T>(list: T[]) => T) => string;

const PATTERNS: Pattern[] = [
  (b, pick) => `${b} the ${pick(EPITHETS)}`,
  (b, pick) => `${fantasyForm(b, pick)} ${pick(SURNAME_A)}${pick(SURNAME_B)}`,
  (b, pick) => `${b} of ${pick(PLACES)}`,
  (b, pick) => `${pick(TITLES)} ${fantasyForm(b, pick)}`,
];

/**
 * Up to `count` distinct questing names for what the player typed.
 * `round` gives a fresh set (the "More names" button). Every name fits NAME_MAX.
 */
export function suggestNames(typed: string, round = 0, count = 3): string[] {
  const base = baseName(typed);
  if (base.length < 2) return [];
  const random = rng(hash(`${base.toLocaleLowerCase()}#${round}`));
  const pick = <T,>(list: T[]): T => list[Math.floor(random() * list.length)];

  // Each round uses a different order of patterns, so the set feels varied.
  const order = PATTERNS.map((p) => ({ p, k: random() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.p);
  const out: string[] = [];
  for (let attempt = 0; out.length < count && attempt < 40; attempt++) {
    const pattern = order[attempt % order.length];
    const name = pattern(base, pick);
    if (name.length <= NAME_MAX && !out.includes(name)) out.push(name);
  }
  return out;
}
