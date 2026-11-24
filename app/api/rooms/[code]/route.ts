import { JOIN_RATE_LIMIT_PER_MIN } from '@/lib/shared/config';
import { clientIp, errorResponse, json } from '@/lib/server/http';
import { HttpError, normalizeCode, roomInfo } from '@/lib/server/rooms';
import { getStore } from '@/lib/server/store';

// Public room info for the Town Gate (rate-limited, because it reveals whether a code exists).
export async function GET(req: Request, ctx: RouteContext<'/api/rooms/[code]'>) {
  try {
    const code = normalizeCode((await ctx.params).code);
    if (!code) throw new HttpError(404, 'Room not found');
    if (!(await getStore().rateLimit(`join:${clientIp(req)}`, JOIN_RATE_LIMIT_PER_MIN, 60))) {
      throw new HttpError(429, 'Too many attempts, please wait a minute');
    }
    const info = await roomInfo(code);
    if (!info) throw new HttpError(404, 'Room not found');
    return json(info);
  } catch (err) {
    return errorResponse(err);
  }
}
