import { errorResponse, json } from '@/lib/server/http';
import { leaveFlow, normalizeCode } from '@/lib/server/rooms';

// Sent with navigator.sendBeacon when a tab closes, so the party bar updates quickly.
export async function POST(req: Request, ctx: RouteContext<'/api/rooms/[code]/leave'>) {
  try {
    const code = normalizeCode((await ctx.params).code);
    if (!code) return json({ ok: true });
    let token: string | null = null;
    try {
      const body = JSON.parse(await req.text());
      token = typeof body?.token === 'string' ? body.token : null;
    } catch {}
    await leaveFlow(code, token);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
