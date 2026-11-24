import 'server-only';
import Ably from 'ably';

// The real-time channel only ever carries `{ version }`: no retro content, so
// no per-player channel authorisation is needed for privacy. Clients then
// fetch their own filtered view.

let rest: Ably.Rest | null = null;

function client(): Ably.Rest | null {
  const key = process.env.ABLY_API_KEY;
  if (!key) return null;
  rest ??= new Ably.Rest({ key });
  return rest;
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

/** Subscribe-only token request for one room's channel. */
export async function tokenRequest(code: string, playerId: string) {
  const c = client();
  if (!c) return null;
  return c.auth.createTokenRequest({
    clientId: playerId,
    capability: { [channelName(code)]: ['subscribe'] },
    ttl: 3 * 60 * 60 * 1000,
  });
}
