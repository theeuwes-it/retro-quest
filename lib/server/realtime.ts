import 'server-only';
import { createHttpClient, type PubSubHttpClient } from '@ably/pubsub-server';

// The real-time channel only ever carries `{ version }`: no retro content, so
// no per-player channel authorisation is needed for privacy. Clients then
// fetch their own filtered view.

// Server side of Ably: publishing from our own backend is not counted as a user.
let http: PubSubHttpClient | null = null;

function client(): PubSubHttpClient | null {
  const key = process.env.ABLY_API_KEY;
  if (!key) return null;
  http ??= createHttpClient({ key });
  return http;
}

export function realtimeMode(): 'ably' | 'poll' {
  return process.env.ABLY_API_KEY ? 'ably' : 'poll';
}

export const channelName = (code: string) => `room-${code}`;

export async function publishVersion(code: string, version: number): Promise<void> {
  const c = client();
  if (!c) return;
  try {
    await c.channels.get(channelName(code)).publish('v', { version });
  } catch (err) {
    // Clients fall back to polling, so a failed ping is not fatal.
    console.error('[realtime] publish failed', err);
  }
}

/**
 * Subscribe-only token request for one room's channel. The token carries the
 * player id as client ID, which Ably requires for browsers on MAU-billed accounts.
 */
export async function tokenRequest(code: string, playerId: string) {
  const c = client();
  if (!c) return null;
  return c.auth.createTokenRequest({
    clientId: playerId,
    capability: { [channelName(code)]: ['subscribe'] },
    ttl: 3 * 60 * 60 * 1000,
  });
}
