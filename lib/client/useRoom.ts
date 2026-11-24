'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { POLL_MS, VIEW_REFRESH_MS } from '@/lib/shared/config';
import type { ClientEvent, View } from '@/lib/shared/types';

export type RoomStatus = 'loading' | 'ready' | 'unauthorized' | 'removed' | 'notfound' | 'error';
export type Connection = 'live' | 'polling' | 'offline';

const TOKEN_HEADER = 'x-player-token';

/**
 * Keeps one player's view of the room fresh. Real-time (Ably) only tells us
 * "version N exists"; we then fetch our own filtered snapshot. Without a live
 * connection we poll every POLL_MS, and we always refresh every
 * VIEW_REFRESH_MS so presence (online dots) stays current.
 */
export function useRoom(code: string, token: string | null) {
  const [view, setView] = useState<View | null>(null);
  const [status, setStatus] = useState<RoomStatus>('loading');
  const [connection, setConnection] = useState<Connection>('polling');
  const [toast, setToast] = useState<string | null>(null);
  const clockOffset = useRef(0);
  const bestRtt = useRef(Infinity);
  const inFlight = useRef(false);
  const again = useRef(false);
  const lastFetch = useRef(0);
  const versionRef = useRef(0);
  const liveRef = useRef(false);

  const fetchView = useCallback(async () => {
    if (!token) return;
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    try {
      do {
        again.current = false;
        const t0 = Date.now();
        let res: Response;
        try {
          res = await fetch(`/api/rooms/${code}/view`, { headers: { [TOKEN_HEADER]: token }, cache: 'no-store' });
        } catch {
          setConnection('offline');
          break;
        }
        const t1 = Date.now();
        lastFetch.current = t1;
        if (res.status === 401) return setStatus('unauthorized');
        if (res.status === 410) return setStatus('removed');
        if (res.status === 404) return setStatus('notfound');
        if (!res.ok) {
          setStatus((s) => (s === 'ready' ? s : 'error'));
          break;
        }
        const next = (await res.json()) as View;
        // Keep the clock offset from the fastest round trip: that's the most accurate one.
        const rtt = t1 - t0;
        if (rtt <= bestRtt.current) {
          bestRtt.current = rtt;
          clockOffset.current = next.serverNow - (t0 + t1) / 2;
        }
        versionRef.current = next.version;
        setView(next);
        setStatus('ready');
        setConnection((c) => (c === 'offline' ? (liveRef.current ? 'live' : 'polling') : c));
      } while (again.current);
    } finally {
      inFlight.current = false;
    }
  }, [code, token]);

  const send = useCallback(
    async (event: ClientEvent): Promise<boolean> => {
      if (!token) return false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(`/api/rooms/${code}/action`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', [TOKEN_HEADER]: token },
            body: JSON.stringify(event),
          });
          const body = await res.json().catch(() => ({}));
          if (res.ok) {
            void fetchView();
            return true;
          }
          if (res.status === 409 && /busy/.test(body.error ?? '')) continue;
          if (res.status === 410) setStatus('removed');
          setToast(body.error ?? 'That did not work');
          void fetchView();
          return false;
        } catch {
          setToast('Connection problem, please try again');
          return false;
        }
      }
      setToast('The room is busy, please try again');
      return false;
    },
    [code, token, fetchView],
  );

  // First load + timers
  useEffect(() => {
    if (!token) return;
    void fetchView();
    const id = window.setInterval(() => {
      const since = Date.now() - lastFetch.current;
      const every = liveRef.current ? VIEW_REFRESH_MS : POLL_MS;
      if (since >= every) void fetchView();
    }, 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchView();
    };
    const onOnline = () => void fetchView();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [token, fetchView]);

  // Tell the others quickly when this tab closes.
  useEffect(() => {
    if (!token) return;
    const onHide = (e: PageTransitionEvent) => {
      if (e.persisted) return;
      try {
        navigator.sendBeacon(`/api/rooms/${code}/leave`, JSON.stringify({ token }));
      } catch {}
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [code, token]);

  // Real-time ping (only when the server has Ably configured)
  const realtime = view?.realtime;
  useEffect(() => {
    if (!token || realtime !== 'ably') return;
    let closed = false;
    let client: import('ably').Realtime | null = null;
    (async () => {
      const Ably = await import('ably');
      if (closed) return;
      client = new Ably.Realtime({
        authUrl: `/api/rooms/${code}/realtime`,
        authHeaders: { [TOKEN_HEADER]: token },
        autoConnect: true,
      });
      client.connection.on((change) => {
        const live = change.current === 'connected';
        liveRef.current = live;
        setConnection(live ? 'live' : 'polling');
        if (live) void fetchView(); // catch up on anything missed
      });
      const channel = client.channels.get(`room-${code}`);
      await channel.subscribe('v', (msg) => {
        const v = Number((msg.data as { version?: number })?.version ?? 0);
        // Presence pings re-send the current version, so fetch on >= as well.
        if (v >= versionRef.current) void fetchView();
      });
    })().catch(() => {
      liveRef.current = false;
      setConnection('polling');
    });
    return () => {
      closed = true;
      liveRef.current = false;
      client?.close();
    };
  }, [code, token, realtime, fetchView]);

  const now = useCallback(() => Date.now() + clockOffset.current, []);

  return { view, status, connection, send, refresh: fetchView, toast, clearToast: () => setToast(null), now };
}
