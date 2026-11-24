import 'server-only';
import { Redis } from '@upstash/redis';
import { ROOM_TTL_SEC } from '@/lib/shared/config';
import type { StoredRoom } from '@/lib/shared/types';

/**
 * Room storage. One JSON value per room ({ version, room }) with a 7-day TTL.
 * Writes use check-and-set on the version so concurrent writers never
 * overwrite each other. Presence lives in a separate hash so heartbeats never
 * conflict with game writes.
 */
export interface RoomStore {
  kind: 'redis' | 'memory';
  get(code: string): Promise<StoredRoom | null>;
  /** Create only if the code is free. */
  create(code: string, value: StoredRoom): Promise<boolean>;
  /** Write only if the stored version still equals `expectedVersion`. */
  cas(code: string, expectedVersion: number, value: StoredRoom): Promise<boolean>;
  /** Record that a member was seen; returns the previous timestamp (0 if none). */
  touch(code: string, playerId: string, at: number): Promise<number>;
  presence(code: string): Promise<Record<string, number>>;
  /** Fixed-window rate limit. Returns true when the call is allowed. */
  rateLimit(key: string, limit: number, windowSec: number): Promise<boolean>;
}

const roomKey = (code: string) => `rq:room:${code}`;
const presenceKey = (code: string) => `rq:presence:${code}`;

// ---------------------------------------------------------------------------
// Redis (Upstash REST)

const CAS_SCRIPT = `
local cur = redis.call('GET', KEYS[1])
if not cur then return -1 end
local v = cjson.decode(cur)['version']
if tonumber(v) ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1
`;

const TOUCH_SCRIPT = `
local prev = redis.call('HGET', KEYS[1], ARGV[1])
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
if prev then return prev end
return '0'
`;

class RedisStore implements RoomStore {
  kind = 'redis' as const;
  constructor(private redis: Redis) {}

  async get(code: string) {
    const raw = await this.redis.get<string>(roomKey(code));
    if (!raw) return null;
    return JSON.parse(raw) as StoredRoom;
  }

  async create(code: string, value: StoredRoom) {
    const res = await this.redis.set(roomKey(code), JSON.stringify(value), { nx: true, ex: ROOM_TTL_SEC });
    return res === 'OK';
  }

  async cas(code: string, expectedVersion: number, value: StoredRoom) {
    const res = await this.redis.eval(
      CAS_SCRIPT,
      [roomKey(code)],
      [String(expectedVersion), JSON.stringify(value), String(ROOM_TTL_SEC)],
    );
    return Number(res) === 1;
  }

  async touch(code: string, playerId: string, at: number) {
    const prev = await this.redis.eval(TOUCH_SCRIPT, [presenceKey(code)], [playerId, String(at), String(ROOM_TTL_SEC)]);
    return Number(prev) || 0;
  }

  async presence(code: string) {
    const all = (await this.redis.hgetall<Record<string, string>>(presenceKey(code))) ?? {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(all)) out[k] = Number(v) || 0;
    return out;
  }

  async rateLimit(key: string, limit: number, windowSec: number) {
    const window = Math.floor(Date.now() / 1000 / windowSec);
    const k = `rq:rl:${key}:${window}`;
    const count = await this.redis.incr(k);
    if (count === 1) await this.redis.expire(k, windowSec + 1);
    return count <= limit;
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback for local dry runs (`npm run dev` without env vars).
// Values are stored as JSON strings so callers never share object references.

interface MemoryState {
  rooms: Map<string, string>;
  presence: Map<string, Map<string, number>>;
  rl: Map<string, number>;
}

const g = globalThis as unknown as { __retroQuestMemory?: MemoryState };

/** Yield to the event loop so concurrent requests interleave like they would against Redis. */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export class MemoryStore implements RoomStore {
  kind = 'memory' as const;
  private s: MemoryState;
  constructor(state?: MemoryState) {
    this.s = state ?? (g.__retroQuestMemory ??= { rooms: new Map(), presence: new Map(), rl: new Map() });
  }

  async get(code: string) {
    await tick();
    const raw = this.s.rooms.get(code);
    return raw ? (JSON.parse(raw) as StoredRoom) : null;
  }

  async create(code: string, value: StoredRoom) {
    await tick();
    if (this.s.rooms.has(code)) return false;
    this.s.rooms.set(code, JSON.stringify(value));
    return true;
  }

  async cas(code: string, expectedVersion: number, value: StoredRoom) {
    await tick();
    const raw = this.s.rooms.get(code);
    if (!raw) return false;
    if ((JSON.parse(raw) as StoredRoom).version !== expectedVersion) return false;
    this.s.rooms.set(code, JSON.stringify(value));
    return true;
  }

  async touch(code: string, playerId: string, at: number) {
    const map = this.s.presence.get(code) ?? new Map<string, number>();
    this.s.presence.set(code, map);
    const prev = map.get(playerId) ?? 0;
    map.set(playerId, at);
    return prev;
  }

  async presence(code: string) {
    return Object.fromEntries(this.s.presence.get(code) ?? new Map());
  }

  async rateLimit(key: string, limit: number, windowSec: number) {
    const window = Math.floor(Date.now() / 1000 / windowSec);
    const k = `${key}:${window}`;
    const count = (this.s.rl.get(k) ?? 0) + 1;
    this.s.rl.set(k, count);
    return count <= limit;
  }
}

// ---------------------------------------------------------------------------

let cached: RoomStore | null = null;

export class ConfigError extends Error {}

export function getStore(): RoomStore {
  if (cached) return cached;
  // The Vercel Marketplace Upstash integration names these KV_REST_API_*; the spec uses UPSTASH_REDIS_REST_*.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) {
    cached = new RedisStore(new Redis({ url, token, automaticDeserialization: false }));
  } else if (process.env.VERCEL) {
    // Memory is per function instance on Vercel, so it would silently split rooms.
    throw new ConfigError('Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
  } else {
    cached = new MemoryStore();
  }
  return cached;
}
