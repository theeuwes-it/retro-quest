import { describe, expect, it } from 'vitest';
import { baseName, suggestNames } from '@/lib/shared/fantasyNames';
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
});
