import { TOKEN_HEADER, errorResponse, json } from '@/lib/server/http';
import { tokenRequest } from '@/lib/server/realtime';
import { HttpError, findMember, normalizeCode } from '@/lib/server/rooms';
import { getStore } from '@/lib/server/store';

// Ably token request, subscribe-only on this room's channel.
export async function GET(req: Request, ctx: RouteContext<'/api/rooms/[code]/realtime'>) {
  try {
    const code = normalizeCode((await ctx.params).code);
    if (!code) throw new HttpError(404, 'Room not found');
    const stored = await getStore().get(code);
    if (!stored) throw new HttpError(404, 'Room not found');
    const member = findMember(stored.room, req.headers.get(TOKEN_HEADER));
    if (!member) throw new HttpError(401, 'Join the room first');
    const tr = await tokenRequest(code, member.id);
    if (!tr) throw new HttpError(404, 'Real-time is not configured');
    return json(tr);
  } catch (err) {
    return errorResponse(err);
  }
}
