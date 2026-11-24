// Fantasy questing names built from the name a player types and the character
// (avatar) they picked. Runs locally: no AI service, no cost, and the name never
// leaves the browser. Suggestions are deterministic for (name, avatar, round),
// so they don't flicker while typing.
import { NAME_MAX } from './config';

/** The words a character's names are made of. */
export interface NameStyle {
  titles: string[];
  epithets: string[];
  places: string[];
  /** Surnames are `surnameStart + surnameEnd`, e.g. Iron + shield. */
  surnameStart: string[];
  surnameEnd: string[];
}

/** Used when no avatar is picked (a host who doesn't play). */
const GENERIC: NameStyle = {
  titles: ['Sage', 'Ranger', 'Captain', 'Keeper', 'Warden', 'Scout', 'Mystic', 'Squire', 'Bard'],
  epithets: ['Bold', 'Brave', 'Wise', 'Swift', 'Clever', 'Curious', 'Steadfast', 'Merry', 'Patient', 'Fearless', 'Unflappable', 'Kind'],
  places: ['Oakvale', 'Emberfall', 'Mistmoor', 'Starhaven', 'the North', 'Silverbrook', 'Thornwood', 'Brightwater'],
  surnameStart: ['Oak', 'Storm', 'Ember', 'Frost', 'Moon', 'Silver', 'Thorn', 'River', 'Star', 'Ash'],
  surnameEnd: ['shield', 'song', 'brook', 'heart', 'quill', 'wood', 'fall', 'whisper', 'forge', 'glow'],
};

/** One style per avatar, so a Knight sounds like a knight and a Witch like a witch. */
export const NAME_STYLES: Record<string, NameStyle> = {
  knight: {
    titles: ['Knight', 'Champion', 'Captain', 'Warden'],
    epithets: ['Valiant', 'Stalwart', 'Steadfast', 'Gallant', 'Unbroken', 'Honourable'],
    places: ['Ironhold', 'Highcrest', 'Lionsgate', 'the Silver Keep'],
    surnameStart: ['Iron', 'Steel', 'Lion', 'High', 'Silver'],
    surnameEnd: ['shield', 'helm', 'guard', 'crest', 'blade'],
  },
  mage: {
    titles: ['Archmage', 'Magus', 'Sage', 'Mystic'],
    epithets: ['Arcane', 'Starwise', 'Spellbound', 'Learned', 'Enigmatic', 'Wise'],
    places: ['Moonspire', 'Starhaven', 'the Arcane Tower', 'Runehold'],
    surnameStart: ['Star', 'Moon', 'Rune', 'Spell', 'Astra'],
    surnameEnd: ['weaver', 'caster', 'quill', 'spark', 'gleam'],
  },
  archer: {
    titles: ['Bowmaster', 'Hunter', 'Scout', 'Fletcher'],
    epithets: ['Keen-Eyed', 'Swift', 'Sure-Shot', 'Far-Seeing', 'Quiet', 'Patient'],
    places: ['the Greenwood', 'Hawkridge', 'Windmere', 'Featherfall'],
    surnameStart: ['Hawk', 'Swift', 'Green', 'Wind', 'Falcon'],
    surnameEnd: ['arrow', 'feather', 'string', 'eye', 'flight'],
  },
  cleric: {
    titles: ['Healer', 'Cleric', 'Lightbringer', 'Sage'],
    epithets: ['Kind', 'Gentle', 'Radiant', 'Merciful', 'Hopeful', 'Serene'],
    places: ['Sunhold', 'Brightwater', 'the Dawn Temple', 'Haven'],
    surnameStart: ['Sun', 'Dawn', 'Bright', 'Light', 'Gold'],
    surnameEnd: ['heart', 'grace', 'glow', 'ward', 'hymn'],
  },
  thief: {
    titles: ['Shadow', 'Rogue', 'Whisper', 'Fox'],
    epithets: ['Sly', 'Nimble', 'Unseen', 'Silent', 'Cunning', 'Light-Footed'],
    places: ['Duskport', 'the Underways', 'the Back Alleys', 'Nightmarket'],
    surnameStart: ['Shadow', 'Quick', 'Night', 'Dusk', 'Silk'],
    surnameEnd: ['step', 'cloak', 'finger', 'whisper', 'lock'],
  },
  barbarian: {
    titles: ['Chieftain', 'Champion', 'Berserker', 'Warrior'],
    epithets: ['Mighty', 'Fearless', 'Thunderous', 'Unstoppable', 'Wild', 'Bold'],
    places: ['Frosthold', 'the Wild Steppes', 'the Frozen North', 'Stonepeak'],
    surnameStart: ['Thunder', 'Bear', 'Frost', 'Stone', 'Storm'],
    surnameEnd: ['fist', 'roar', 'hammer', 'hide', 'axe'],
  },
  druid: {
    titles: ['Druid', 'Grovekeeper', 'Warden', 'Mystic'],
    epithets: ['Green', 'Wild', 'Rooted', 'Earthwise', 'Gentle', 'Patient'],
    places: ['the Old Grove', 'Willowmere', 'Mossdeep', 'Thornwood'],
    surnameStart: ['Moss', 'Oak', 'Fern', 'Willow', 'Thorn'],
    surnameEnd: ['root', 'leaf', 'bloom', 'grove', 'branch'],
  },
  minstrel: {
    titles: ['Bard', 'Minstrel', 'Maestro', 'Troubadour'],
    epithets: ['Merry', 'Melodious', 'Silver-Tongued', 'Witty', 'Charming', 'Lyrical'],
    places: ['Songhaven', 'Harpshire', 'the Golden Stage', 'Lutebridge'],
    surnameStart: ['Silver', 'Merry', 'Lark', 'Harp', 'Golden'],
    surnameEnd: ['song', 'tune', 'string', 'verse', 'lilt'],
  },
  monk: {
    titles: ['Master', 'Monk', 'Sage', 'Disciple'],
    epithets: ['Serene', 'Balanced', 'Patient', 'Calm', 'Focused', 'Tranquil'],
    places: ['Cloudrest', 'the Misty Peaks', 'the Quiet Temple', 'Jade Valley'],
    surnameStart: ['Cloud', 'Still', 'Stone', 'River', 'Jade'],
    surnameEnd: ['palm', 'step', 'breath', 'stone', 'path'],
  },
  alchemist: {
    titles: ['Alchemist', 'Artificer', 'Tinkerer', 'Professor'],
    epithets: ['Curious', 'Inventive', 'Ingenious', 'Brilliant', 'Meticulous', 'Bubbly'],
    places: ['Gearholm', 'Emberfall', 'the Copper Lab', 'Brasswick'],
    surnameStart: ['Copper', 'Ember', 'Quick', 'Brass', 'Glass'],
    surnameEnd: ['flask', 'spark', 'fizz', 'cog', 'brew'],
  },
  ranger: {
    titles: ['Ranger', 'Pathfinder', 'Warden', 'Tracker'],
    epithets: ['Wandering', 'Watchful', 'Trailblazing', 'Steadfast', 'Tireless', 'Wise'],
    places: ['the Wildlands', 'Ridgewatch', 'Pinehollow', 'Wolfden'],
    surnameStart: ['Pine', 'Wolf', 'Ridge', 'Trail', 'Ash'],
    surnameEnd: ['walker', 'runner', 'watch', 'track', 'ward'],
  },
  witch: {
    titles: ['Witch', 'Seer', 'Mystic', 'Enchanter'],
    epithets: ['Mysterious', 'Moonlit', 'Cunning', 'Enchanting', 'Uncanny', 'Wise'],
    places: ['Raven Hill', 'Hollow Bog', 'the Moonlit Marsh', 'Nightshade'],
    surnameStart: ['Raven', 'Moon', 'Night', 'Hex', 'Hollow'],
    surnameEnd: ['brew', 'whisper', 'charm', 'thorn', 'cauldron'],
  },
};

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

/** Small seeded PRNG (mulberry32) so the same input always gives the same picks. */
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

type Pick = <T>(list: T[]) => T;

/** "Sander" -> "Sandorin"-style fantasy form of a name. */
function fantasyForm(base: string, pick: Pick): string {
  const lower = base.toLocaleLowerCase();
  // Keep the start of the name so it stays recognisable.
  const stem = lower.length > 4 ? lower.slice(0, Math.ceil(lower.length * 0.6)) : lower;
  const endsWithVowel = VOWEL.test(stem[stem.length - 1] ?? '');
  const suffix = pick(endsWithVowel ? SUFFIX_AFTER_VOWEL : SUFFIX_AFTER_CONSONANT);
  return capitalize(stem + suffix);
}

type Pattern = (base: string, style: NameStyle, pick: Pick) => string;

const PATTERNS: Pattern[] = [
  (b, s, pick) => `${b} the ${pick(s.epithets)}`,
  (b, s, pick) => `${fantasyForm(b, pick)} ${pick(s.surnameStart)}${pick(s.surnameEnd)}`,
  (b, s, pick) => `${b} of ${pick(s.places)}`,
  (b, s, pick) => `${pick(s.titles)} ${fantasyForm(b, pick)}`,
];

export function nameStyleFor(avatarId?: string | null): NameStyle {
  return (avatarId && NAME_STYLES[avatarId]) || GENERIC;
}

/**
 * Up to `count` distinct questing names for what the player typed, in the style
 * of the avatar they picked. `round` gives a fresh set (the "More names" button).
 * Every name fits NAME_MAX.
 */
export function suggestNames(typed: string, round = 0, avatarId?: string | null, count = 3): string[] {
  const base = baseName(typed);
  if (base.length < 2) return [];
  const style = nameStyleFor(avatarId);
  const random = rng(hash(`${base.toLocaleLowerCase()}#${avatarId ?? ''}#${round}`));
  const pick: Pick = (list) => list[Math.floor(random() * list.length)];

  // Each round uses a different order of patterns, so the set feels varied.
  const order = PATTERNS.map((p) => ({ p, k: random() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.p);
  const out: string[] = [];
  for (let attempt = 0; out.length < count && attempt < 60; attempt++) {
    const name = order[attempt % order.length](base, style, pick);
    if (name.length <= NAME_MAX && !out.includes(name)) out.push(name);
  }
  return out;
}
