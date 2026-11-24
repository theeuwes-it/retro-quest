import { TOKEN_HEADER, errorResponse, json } from '@/lib/server/http';
import { HttpError, normalizeCode, viewFlow } from '@/lib/server/rooms';

// The caller's own filtered snapshot of the room (see lib/shared/view.ts).
export async function GET(req: Request, ctx: RouteContext<'/api/rooms/[code]/view'>) {
  try {
    const code = normalizeCode((await ctx.params).code);
    if (!code) throw new HttpError(404, 'Room not found');
    return json(await viewFlow(code, req.headers.get(TOKEN_HEADER)));
  } catch (err) {
    return errorResponse(err);
  }
}
