import { describe, expect, it } from 'vitest';
import { parsePresence } from '@/lib/server/store';

describe('parsePresence', () => {
  it('reads the flat array Upstash returns for HGETALL without automatic deserialization', () => {
    // The exact shape documented by @upstash/redis for automaticDeserialization: false.
    expect(parsePresence(['p1', '1732000000000', 'p2', '1732000005000'])).toEqual({
      p1: 1732000000000,
      p2: 1732000005000,
    });
  });

  it('handles an empty or missing hash', () => {
    expect(parsePresence([])).toEqual({});
    expect(parsePresence(null)).toEqual({});
  });

  it('also accepts an object', () => {
    expect(parsePresence({ p1: '5', p2: 7 })).toEqual({ p1: 5, p2: 7 });
  });
});
