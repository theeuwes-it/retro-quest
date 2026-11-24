import { CREATE_RATE_LIMIT_PER_MIN } from '@/lib/shared/config';
import { clientIp, errorResponse, json, readJson } from '@/lib/server/http';
import { HttpError, createRoomFlow } from '@/lib/server/rooms';
import { getStore } from '@/lib/server/store';

// room:create -> { code, playerId, token, hostToken }
export async function POST(req: Request) {
  try {
    if (!(await getStore().rateLimit(`create:${clientIp(req)}`, CREATE_RATE_LIMIT_PER_MIN, 60))) {
      throw new HttpError(429, 'Too many rooms created, please wait a minute');
    }
    const body = await readJson(req);
    return json(await createRoomFlow({ hostName: body.hostName, hostPlays: body.hostPlays, avatarId: body.avatarId }), 201);
  } catch (err) {
    return errorResponse(err);
  }
}
