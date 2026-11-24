import { TOKEN_HEADER, errorResponse, json, readJson } from '@/lib/server/http';
import { HttpError, actionFlow, normalizeCode } from '@/lib/server/rooms';
import type { ClientEvent } from '@/lib/shared/types';

// Every game intent: { type, ...payload }. The reducer validates it.
export async function POST(req: Request, ctx: RouteContext<'/api/rooms/[code]/action'>) {
  try {
    const code = normalizeCode((await ctx.params).code);
    if (!code) throw new HttpError(404, 'Room not found');
    const body = await readJson(req);
    if (typeof body.type !== 'string') throw new HttpError(400, 'Missing action type');
    return json(await actionFlow(code, req.headers.get(TOKEN_HEADER), body as unknown as ClientEvent));
  } catch (err) {
    return errorResponse(err);
  }
}
