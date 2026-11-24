import 'server-only';
import { NextResponse } from 'next/server';
import { HttpError } from './rooms';
import { ConfigError } from './store';

export const TOKEN_HEADER = 'x-player-token';

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'local';
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) return json({ error: err.message }, err.status);
  if (err instanceof ConfigError) {
    console.error('[config]', err.message);
    return json({ error: 'The server is not configured yet' }, 503);
  }
  console.error(err);
  return json({ error: 'Something went wrong' }, 500);
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}
