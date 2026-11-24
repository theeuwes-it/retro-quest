// Tavern character classes and the 12 lobby avatars.

export interface CharacterClass {
  id: string;
  name: string;
  description: string;
}

export const CLASSES: CharacterClass[] = [
  { id: 'paladin', name: 'Victorious Paladin', description: 'Great sprint, we crushed it' },
  { id: 'rogue', name: 'Lucky Rogue', description: 'It went fine, partly by luck' },
  { id: 'wizard', name: 'Wise Wizard', description: 'I learned a lot' },
  { id: 'warrior', name: 'Weary Warrior', description: "Hard work, I'm tired" },
  { id: 'bard', name: 'Lost Bard', description: 'Unclear what we were doing' },
  { id: 'knight', name: 'Cursed Knight', description: 'Rough sprint, things kept going wrong' },
];

export function classById(id: string | undefined): CharacterClass | undefined {
  return CLASSES.find((c) => c.id === id);
}

export interface Avatar {
  id: string;
  name: string;
}

export const AVATARS: Avatar[] = [
  { id: 'knight', name: 'Knight' },
  { id: 'mage', name: 'Mage' },
  { id: 'archer', name: 'Archer' },
  { id: 'cleric', name: 'Cleric' },
  { id: 'thief', name: 'Thief' },
  { id: 'barbarian', name: 'Barbarian' },
  { id: 'druid', name: 'Druid' },
  { id: 'minstrel', name: 'Minstrel' },
  { id: 'monk', name: 'Monk' },
  { id: 'alchemist', name: 'Alchemist' },
  { id: 'ranger', name: 'Ranger' },
  { id: 'witch', name: 'Witch' },
];

export function avatarById(id: string): Avatar | undefined {
  return AVATARS.find((a) => a.id === id);
}
