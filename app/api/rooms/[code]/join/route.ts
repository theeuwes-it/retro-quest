import { JOIN_RATE_LIMIT_PER_MIN } from '@/lib/shared/config';
import { clientIp, errorResponse, json, readJson } from '@/lib/server/http';
import { HttpError, joinFlow, normalizeCode } from '@/lib/server/rooms';
import { getStore } from '@/lib/server/store';

// room:join -> { code, name, avatarId } or { token } to rejoin. Returns { playerId, token }.
export async function POST(req: Request, ctx: RouteContext<'/api/rooms/[code]/join'>) {
  try {
    const code = normalizeCode((await ctx.params).code);
    if (!code) throw new HttpError(404, 'Room not found');
    const body = await readJson(req);
    // Rejoins carry a secret token, so only fresh joins count toward the code-guessing limit.
    if (!body.token && !(await getStore().rateLimit(`join:${clientIp(req)}`, JOIN_RATE_LIMIT_PER_MIN, 60))) {
      throw new HttpError(429, 'Too many attempts, please wait a minute');
    }
    return json(await joinFlow(code, body));
  } catch (err) {
    return errorResponse(err);
  }
}
