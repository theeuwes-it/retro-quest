import { describe, expect, it } from 'vitest';
import { NAME_STYLES, baseName, nameStyleFor, suggestNames } from '@/lib/shared/fantasyNames';
import { AVATARS } from '@/lib/shared/classes';
import { NAME_MAX } from '@/lib/shared/config';

describe('fantasy name suggestions', () => {
  it('suggests 3 distinct names that include something of the typed name', () => {
    const names = suggestNames('Sander');
    expect(names).toHaveLength(3);
    expect(new Set(names).size).toBe(3);
    for (const n of names) expect(n.toLowerCase()).toContain('san');
  });

  it('is stable while typing and changes with another round', () => {
    expect(suggestNames('Robin')).toEqual(suggestNames('robin '));
    expect(suggestNames('Robin', 1)).not.toEqual(suggestNames('Robin', 0));
  });

  it('always fits the name length limit', () => {
    for (const typed of ['Al', 'Sander', 'Maximiliana-Bartholomew', 'Jo Ann Smith', 'Øyvind', 'Zoë', 'Ngozi']) {
      for (let round = 0; round < 25; round++) {
        for (const n of suggestNames(typed, round)) expect(n.length).toBeLessThanOrEqual(NAME_MAX);
      }
    }
  });

  it('needs at least two letters', () => {
    expect(suggestNames('')).toEqual([]);
    expect(suggestNames('A')).toEqual([]);
    expect(suggestNames('  42 ')).toEqual([]);
  });

  it('uses the first word, letters only, capitalized', () => {
    expect(baseName('  sAnDeR theeuwes ')).toBe('Sander');
    expect(baseName('R2-D2')).toBe('R-d');
    expect(baseName('Øyvind')).toBe('Øyvind');
  });

  it('has a name style for every avatar', () => {
    for (const a of AVATARS) expect(NAME_STYLES[a.id], a.id).toBeDefined();
  });

  it("builds names from the picked avatar's own words", () => {
    for (const a of AVATARS) {
      const style = nameStyleFor(a.id);
      const words = [...style.titles, ...style.epithets, ...style.places, ...style.surnameStart];
      for (let round = 0; round < 5; round++) {
        for (const n of suggestNames('Sander', round, a.id)) {
          expect(words.some((w) => n.includes(w)), `${a.id}: ${n}`).toBe(true);
        }
      }
    }
  });

  it('gives different suggestions for different avatars', () => {
    expect(suggestNames('Sander', 0, 'knight')).not.toEqual(suggestNames('Sander', 0, 'witch'));
  });

  it('gives every avatar 3 names that fit, even for long names', () => {
    for (const a of AVATARS) {
      for (const typed of ['Al', 'Sander', 'Maximiliana', 'Bartholomew-Jo']) {
        for (let round = 0; round < 10; round++) {
          const names = suggestNames(typed, round, a.id);
          expect(names, `${a.id} ${typed} ${round}`).toHaveLength(3);
          for (const n of names) expect(n.length).toBeLessThanOrEqual(NAME_MAX);
        }
      }
    }
  });
});
